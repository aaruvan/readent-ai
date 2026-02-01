import { useState, useCallback, useRef, useEffect } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

interface UseEyeTrackingOptions {
  onLookAway: () => void;
  onLookBack: () => void;
  lossMs?: number;
  recoverMs?: number;
  minFaceAreaRatio?: number;
}

interface UseEyeTrackingReturn {
  isTracking: boolean;
  isLookingAway: boolean;
  debug: string;
  logs: string[];
  detectorKind: string;
  error: string | null;
  startTracking: () => void;
  stopTracking: () => void;
}

export const useEyeTracking = ({
  onLookAway,
  onLookBack,
  lossMs = 1200,
  recoverMs = 200,
  minFaceAreaRatio = 0.02,
}: UseEyeTrackingOptions): UseEyeTrackingReturn => {
  const [isTracking, setIsTracking] = useState(false);
  const [isLookingAway, setIsLookingAway] = useState(false);
  const [debug, setDebug] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [detectorKind, setDetectorKind] = useState('none');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const detectorKindRef = useRef<'mediapipe' | 'none'>('none');
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastSeenRef = useRef(0);
  const seenStreakRef = useRef(0);
  const trackingStartRef = useRef(0);
  const hasSeenFaceRef = useRef(false);
  const inFlightRef = useRef(false);
  const lastLogRef = useRef(0);
  const noDetectStartRef = useRef(0);
  const isTrackingRef = useRef(false);
  const isLookingAwayRef = useRef(false);
  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.remove();
    }
    videoRef.current = null;
    detectorRef.current = null;
    lastFrameRef.current = 0;
    lastSeenRef.current = 0;
    seenStreakRef.current = 0;
    hasSeenFaceRef.current = false;
    inFlightRef.current = false;
  }, []);

  const pushLog = useCallback((line: string) => {
    setLogs((prev) => {
      const next = [...prev, line];
      return next.length > 8 ? next.slice(-8) : next;
    });
  }, []);

  const markLookingAway = useCallback(() => {
    if (!isLookingAwayRef.current) {
      setIsLookingAway(true);
      isLookingAwayRef.current = true;
      onLookAway();
      pushLog('state=away');
    }
  }, [onLookAway, pushLog]);

  const markLookingBack = useCallback(() => {
    if (isLookingAwayRef.current) {
      setIsLookingAway(false);
      isLookingAwayRef.current = false;
      onLookBack();
      pushLog('state=back');
    }
  }, [onLookBack, pushLog]);

  const startTracking = useCallback(async () => {
    if (isTrackingRef.current) return;
    setError(null);
    setIsTracking(true);
    setDebug('');
    setLogs([]);
    isTrackingRef.current = true;
    detectorKindRef.current = 'none';
    setDetectorKind('none');
    noDetectStartRef.current = 0;

    try {
      cleanup();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      const video = document.createElement('video');
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      video.autoplay = true;
      video.width = 320;
      video.height = 240;
      video.style.position = 'fixed';
      video.style.opacity = '0.01';
      video.style.pointerEvents = 'none';
      video.style.width = '160px';
      video.style.height = '120px';
      video.style.right = '8px';
      video.style.bottom = '8px';
      video.style.zIndex = '9999';
      document.body.appendChild(video);
      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });
      await video.play();
      videoRef.current = video;
      trackingStartRef.current = performance.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera access failed.');
      setIsTracking(false);
      isTrackingRef.current = false;
      cleanup();
      return;
    }

    try {
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      const modelUrl =
        'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
      detectorRef.current = await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelUrl },
        runningMode: 'VIDEO',
      });
      detectorKindRef.current = 'mediapipe';
      setDetectorKind('mediapipe');
    } catch (err) {
      detectorRef.current = null;
      setError('MediaPipe failed to load. Check network access to jsDelivr and Google Storage.');
      setIsTracking(false);
      isTrackingRef.current = false;
      cleanup();
      return;
    }

    const tick = async (timestampOverride?: number) => {
      if (!videoRef.current || !detectorRef.current) return;
      const now = timestampOverride ?? performance.now();
      if (now - lastFrameRef.current < 100 || inFlightRef.current) {
        if (videoRef.current.requestVideoFrameCallback) {
          videoRef.current.requestVideoFrameCallback((_, meta) => {
            tick(meta.mediaTime * 1000);
          });
        } else {
          rafRef.current = requestAnimationFrame(() => tick());
        }
        return;
      }
      lastFrameRef.current = now;
      inFlightRef.current = true;

      let detections = 0;
      let rawCount = 0;
      let maxAreaRatio = 0;
      try {
        const video = videoRef.current;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const videoArea = video.videoWidth * video.videoHeight;
          const result = detectorRef.current.detectForVideo(video, now);
          const dets = result?.detections || [];
          rawCount = dets.length;
          for (const det of dets) {
            const box = det.boundingBox;
            const area = box?.width && box?.height ? Math.max(0, box.width) * Math.max(0, box.height) : 0;
            const ratio = videoArea > 0 ? area / videoArea : 0;
            if (ratio > maxAreaRatio) maxAreaRatio = ratio;
          }
          detections = rawCount;
        }
      } catch {
        detections = 0;
      }

      const sinceStart = now - trackingStartRef.current;
      const video = videoRef.current;
      const dim = video ? `${video.videoWidth}x${video.videoHeight}` : '0x0';
      const readyState = videoRef.current?.readyState ?? 0;
      const debugLine = `d=${detections} r=${rawCount} a=${maxAreaRatio.toFixed(3)} t=${Math.round(sinceStart)}ms v=${dim} rs=${readyState} k=${detectorKindRef.current}`;
      setDebug(debugLine);
      if (sinceStart - lastLogRef.current > 1000) {
        lastLogRef.current = sinceStart;
        pushLog(debugLine);
      }

      const hasValidFace = detections > 0 && maxAreaRatio >= minFaceAreaRatio;

      if (!hasValidFace) {
        if (!noDetectStartRef.current) {
          noDetectStartRef.current = now;
        }
      } else {
        noDetectStartRef.current = 0;
      }

      if (hasValidFace) {
        if (!hasSeenFaceRef.current) {
          seenStreakRef.current = now;
        }
        hasSeenFaceRef.current = true;
        lastSeenRef.current = now;
        if (now - seenStreakRef.current >= recoverMs) {
          markLookingBack();
        }
      } else {
        seenStreakRef.current = 0;
        if (hasSeenFaceRef.current && now - lastSeenRef.current >= lossMs) {
          markLookingAway();
        }
      }

      inFlightRef.current = false;
      if (videoRef.current?.requestVideoFrameCallback) {
        videoRef.current.requestVideoFrameCallback((_, meta) => {
          tick(meta.mediaTime * 1000);
        });
      } else {
        rafRef.current = requestAnimationFrame(() => tick());
      }
    };

    if (videoRef.current?.requestVideoFrameCallback) {
      videoRef.current.requestVideoFrameCallback((_, meta) => {
        tick(meta.mediaTime * 1000);
      });
    } else {
      rafRef.current = requestAnimationFrame(() => tick());
    }
  }, [cleanup, lossMs, markLookingAway, markLookingBack, minFaceAreaRatio, recoverMs]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    setIsLookingAway(false);
    isLookingAwayRef.current = false;
    setDebug('');
    isTrackingRef.current = false;
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isTracking,
    isLookingAway,
    debug,
    logs,
    detectorKind,
    error,
    startTracking,
    stopTracking,
  };
};

// Helper to calculate rewind position with gradual ramp-up
export const calculateRewindPosition = (
  currentIndex: number,
  rewindWords: number,
  totalWords: number
): { newIndex: number; rampUpSpeed: number } => {
  // Rewind by specified amount, but not below 0
  const newIndex = Math.max(0, currentIndex - rewindWords);
  
  // Ramp up speed starts at 0.5x and increases to 1x over the rewind section
  const rampUpSpeed = 0.5;
  
  return { newIndex, rampUpSpeed };
};
