import express from "express";
import dotenv from "dotenv";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import connectDB from "./config/db.js";
import cookieParser from "cookie-parser";
import examRoutes from "./routes/examRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import codingRoutes from "./routes/codingRoutes.js";
import resultRoutes from "./routes/resultRoutes.js";
import { exec } from "child_process";
import fs from "fs";
import { writeFileSync } from "fs";
import path from "path";
import cors from "cors";
dotenv.config();
connectDB();
const app = express();
const port = process.env.PORT || 5000;

// to parse req body
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://ai-proctored-system.vercel.app",
      "http://localhost:3000",
      "http://localhost:5000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.post("/run-python", (req, res) => {
  const { code } = req.body; // Get Python code from request body
  writeFileSync("script.py", code); // Write code to script.py file

  exec("python script.py", (error, stdout, stderr) => {
    if (error) {
      res.send(`Error is: ${stderr}`); // Send error message if any
    } else {
      res.send(stdout); // Send output of the Python script
    }
  });
});

app.post("/run-javascript", (req, res) => {
  const { code } = req.body; // Get JavaScript code from request body
  writeFileSync("script.js", code); // Write code to script.js file

  exec("node script.js", (error, stdout, stderr) => {
    if (error) {
      res.send(`Error: ${stderr}`); // Send error message if any
    } else {
      res.send(stdout); // Send output of the JavaScript code
    }
  });
});

app.post("/run-java", (req, res) => {
  const { code } = req.body; // Get Java code from request body
  writeFileSync("Main.java", code); // Write code to Main.java file

  exec("javac Main.java && java Main", (error, stdout, stderr) => {
    if (error) {
      res.send(`Error: ${stderr}`); // Send error message if any
    } else {
      res.send(stdout); // Send output of the Java program
    }
  });
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/users", examRoutes);
app.use("/api/users", resultRoutes);
app.use("/api/coding", codingRoutes);

// Endpoint to save screenshots to local filesystem
app.post("/api/upload-screenshot", (req, res) => {
  const { image, username, type, timestamp } = req.body;
  console.log(`\n🚨 PROHIBITION DETECTED 🚨`);
  console.log(`Student: ${username || 'Unknown'} | Type: ${type}`);
  
  if (!image) {
    return res.status(400).json({ success: false, message: "No image provided" });
  }

  try {
    // Extract base64 data
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, message: "Invalid image format" });
    }

    const imageBuffer = Buffer.from(matches[2], "base64");
    
    // Ensure uploads directory exists (path.resolve() is already the backend folder)
    const uploadsDir = path.join(path.resolve(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Format filename safely
    const safeUsername = (username || "Unknown").replace(/[^a-z0-9]/gi, '_');
    const safeType = (type || "Unknown").replace(/[^a-z0-9]/gi, '_');
    const safeTimestamp = (timestamp || Date.now()).toString().replace(/[^a-z0-9]/gi, '_');
    const filename = `${safeUsername}_${safeType}_${safeTimestamp}.jpg`;
    
    const filePath = path.join(uploadsDir, filename);
    
    // Write file
    fs.writeFileSync(filePath, imageBuffer);
    console.log(`✅ Image successfully stored at: ${filePath}`);
    
    // Return the full URL so the frontend can display it correctly
    const backendUrl = req.protocol + '://' + req.get('host');
    res.json({ success: true, url: `${backendUrl}/uploads/${filename}` });
  } catch (error) {
    console.error("❌ Error saving screenshot:", error);
    res.status(500).json({ success: false, message: "Failed to save screenshot" });
  }
});

// we we are deploying this in production
// make frontend build then
if (process.env.NODE_ENV === "production") {
  const __dirname = path.resolve();
  // we making front build folder static to serve from this app
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  // if we get an routes that are not define by us we show then index html file
  // every enpoint that is not api/users go to this index file
  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname, "../frontend", "dist", "index.html"))
  );
} else {
  // Make uploads directory accessible in dev
  const __dirname = path.resolve();
  app.use('/uploads', express.static(path.join(__dirname, "uploads")));
  
  app.get("/", (req, res) => {
    res.send("<h1>server is running </h1>");
  });
}

// Error handling middleware - must be after all routes
app.use(notFound);
app.use(errorHandler);

// Server
app.listen(port, () => {
  console.log(`server is running on http://localhost:${port}`);
});

// Todos:
// -**POST /api/users**- Register a users
// -**POST /api/users/auth**- Authenticate a user and get token
// -**POST /api/users/logout**- logou user and clear cookie
// -**GET /api/users/profile**- Get user Profile
// -**PUT /api/users/profile**- Update user Profile
