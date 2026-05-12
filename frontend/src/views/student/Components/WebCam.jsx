import React, { useRef, useState, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';
import Webcam from 'react-webcam';
import { drawRect } from './utilities';
import { Box, Card } from '@mui/material';
import swal from 'sweetalert';
import axiosInstance from '../../../axios';

export default function Home({ cheatingLog, updateCheatingLog }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [lastDetectionTime, setLastDetectionTime] = useState({});
  const [screenshots, setScreenshots] = useState([]);

  // Initialize screenshots array when component mounts
  useEffect(() => {
    if (cheatingLog && cheatingLog.screenshots) {
      setScreenshots(cheatingLog.screenshots);
    }
  }, [cheatingLog]);

  const captureScreenshotAndUpload = async (type) => {
    const video = webcamRef.current?.video;

    if (
      !video ||
      video.readyState !== 4 || // ensure video is ready
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      console.warn('Video not ready for screenshot');
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.5); // Using 0.5 quality to save space

    try {
      const response = await axiosInstance.post('/api/upload-screenshot', {
        image: dataUrl,
        username: cheatingLog?.username || 'Unknown',
        type: type,
        timestamp: Date.now()
      });

      console.log('✅ Uploaded screenshot locally:', response.data.url);
      
      const screenshot = {
        url: response.data.url,
        type: type,
        detectedAt: new Date()
      };

      // Update local screenshots state
      setScreenshots(prev => [...prev, screenshot]);
      
      return screenshot;
    } catch (error) {
      console.error('❌ Local upload failed:', error);
      return null;
    }
  };

  const handleDetection = async (type) => {
    const now = Date.now();
    const lastTime = lastDetectionTime[type] || 0;

    if (now - lastTime >= 3000) {
      setLastDetectionTime((prev) => ({ ...prev, [type]: now }));

      // Capture and upload screenshot
      const screenshot = await captureScreenshotAndUpload(type);
      
      if (screenshot) {
        // Update cheating log with new count and screenshot
        const updatedLog = {
          ...cheatingLog,
          [`${type}Count`]: (cheatingLog[`${type}Count`] || 0) + 1,
          screenshots: [...(cheatingLog.screenshots || []), screenshot]
        };

        console.log('Updating cheating log with:', updatedLog);
        updateCheatingLog(updatedLog);
      }

      switch (type) {
        case 'noFace':
          swal('Face Not Visible', 'Warning Recorded', 'warning');
          break;
        case 'multipleFace':
          swal('Multiple Faces Detected', 'Warning Recorded', 'warning');
          break;
        case 'cellPhone':
          swal('Cell Phone Detected', 'Warning Recorded', 'warning');
          break;
        case 'prohibitedObject':
          swal('Prohibited Object Detected', 'Warning Recorded', 'warning');
          break;
        default:
          break;
      }
    }
  };

  const runCoco = async () => {
    try {
      const net = await cocossd.load();
      console.log('AI model loaded.');
      setInterval(() => detect(net), 1000);
    } catch (error) {
      console.error('Error loading model:', error);
      swal('Error', 'Failed to load AI model. Please refresh the page.', 'error');
    }
  };

  const detect = async (net) => {
    if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
      const video = webcamRef.current.video;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      webcamRef.current.video.width = videoWidth;
      webcamRef.current.video.height = videoHeight;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      try {
        const obj = await net.detect(video);
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        drawRect(obj, ctx);

        let person_count = 0;
        let faceDetected = false;

        obj.forEach((element) => {
          const detectedClass = element.class;
          console.log('Detected:', detectedClass);

          if (detectedClass === 'cell phone') handleDetection('cellPhone');
          if (detectedClass === 'book' || detectedClass === 'laptop')
            handleDetection('prohibitedObject');
          if (detectedClass === 'person') {
            faceDetected = true;
            person_count++;
            if (person_count > 1) handleDetection('multipleFace');
          }
        });

        if (!faceDetected) handleDetection('noFace');
      } catch (error) {
        console.error('Error during detection:', error);
      }
    }
  };

  useEffect(() => {
    runCoco();
  }, []);

  return (
    <Box>
      <Card variant="outlined" sx={{ position: 'relative', width: '100%', height: '100%' }}>
        <Webcam
          ref={webcamRef}
          audio={false}
          muted
          screenshotFormat="image/jpeg"
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: 'user',
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 10,
          }}
        />
      </Card>
    </Box>
  );
}

