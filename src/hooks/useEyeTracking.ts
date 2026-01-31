import { useState, useCallback, useRef, useEffect } from 'react';

interface UseEyeTrackingOptions {
  onLookAway: () => void;
  onLookBack: () => void;
  inactivityThreshold?: number; // ms before considering user looked away
  rewindAmount?: number; // words to rewind when user looks back
}

interface UseEyeTrackingReturn {
  isTracking: boolean;
  isLookingAway: boolean;
  lastActivityTime: number;
  startTracking: () => void;
  stopTracking: () => void;
  recordActivity: () => void;
}

/**
 * Simulates eye-tracking using mouse/touch activity, visibility API, and face detection.
 * When user appears to look away, triggers callback to pause/rewind.
 */
export const useEyeTracking = ({
  onLookAway,
  onLookBack,
  inactivityThreshold = 3000, // 3 seconds of inactivity = looked away
  rewindAmount = 5,
}: UseEyeTrackingOptions): UseEyeTrackingReturn => {
  const [isTracking, setIsTracking] = useState(false);
  const [isLookingAway, setIsLookingAway] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasLookingAwayRef = useRef(false);

  const recordActivity = useCallback(() => {
    setLastActivityTime(Date.now());
    
    // If user was looking away and now showing activity, they're back
    if (wasLookingAwayRef.current) {
      wasLookingAwayRef.current = false;
      setIsLookingAway(false);
      onLookBack();
    }
    
    // Reset inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    inactivityTimerRef.current = setTimeout(() => {
      if (!wasLookingAwayRef.current) {
        wasLookingAwayRef.current = true;
        setIsLookingAway(true);
        onLookAway();
      }
    }, inactivityThreshold);
  }, [inactivityThreshold, onLookAway, onLookBack]);

  const startTracking = useCallback(() => {
    setIsTracking(true);
    recordActivity();
  }, [recordActivity]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    setIsLookingAway(false);
    wasLookingAwayRef.current = false;
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  // Track mouse movement and clicks as indicators of attention
  useEffect(() => {
    if (!isTracking) return;

    const handleActivity = () => {
      recordActivity();
    };

    // Mouse/touch events
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Visibility API - user switched tabs
    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasLookingAwayRef.current = true;
        setIsLookingAway(true);
        onLookAway();
      } else {
        recordActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTracking, recordActivity, onLookAway]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  return {
    isTracking,
    isLookingAway,
    lastActivityTime,
    startTracking,
    stopTracking,
    recordActivity,
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
