// extension/eye-tracking/face-detector-tracker.ts
var running = false;
var attentionState = "inattentive";
var lastSeenAt = 0;
var seenStreakStart = 0;
var hasSeenFace = false;
var LOST_MS = 1200;
var RECOVER_MS = 200;
var MAX_FPS = 10;
var MIN_FACE_AREA_RATIO = 0.02;
function setAttention(next, cb, meta) {
  if (next !== attentionState) {
    attentionState = next;
    cb(attentionState, meta);
  }
}
function resetCounters() {
  attentionState = "inattentive";
  lastSeenAt = 0;
  seenStreakStart = 0;
  hasSeenFace = false;
}
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false
  });
  const video = document.createElement("video");
  video.setAttribute("playsinline", "true");
  video.muted = true;
  video.srcObject = stream;
  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });
  await video.play();
  return { stream, video };
}
async function startFaceDetector(onAttentionChange) {
  const FaceDetectorCtor = globalThis.FaceDetector;
  if (!FaceDetectorCtor) {
    throw new Error("FaceDetector API not available. Enable chrome://flags/#enable-experimental-web-platform-features.");
  }
  resetCounters();
  running = true;
  const { stream, video } = await startCamera();
  const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 });
  let lastFrame = 0;
  let inFlight = false;
  async function tick() {
    if (!running) return;
    const now = performance.now();
    if (now - lastFrame < 1e3 / MAX_FPS || inFlight) {
      requestAnimationFrame(tick);
      return;
    }
    lastFrame = now;
    inFlight = true;
    let detections = 0;
    let maxAreaRatio = 0;
    try {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const faces = await detector.detect(video);
        const videoArea = video.videoWidth * video.videoHeight;
        for (const face of faces) {
          const box = face.boundingBox;
          const area = Math.max(0, box.width) * Math.max(0, box.height);
          const ratio = videoArea > 0 ? area / videoArea : 0;
          if (ratio > maxAreaRatio) maxAreaRatio = ratio;
          if (ratio >= MIN_FACE_AREA_RATIO) {
            detections += 1;
          }
        }
      }
    } catch {
      detections = 0;
    }
    if (detections > 0) {
      if (!hasSeenFace) {
        seenStreakStart = now;
      } else if (!seenStreakStart) {
        seenStreakStart = now;
      }
      hasSeenFace = true;
      lastSeenAt = now;
      if (now - seenStreakStart >= RECOVER_MS) {
        setAttention(
          "attentive",
          onAttentionChange,
          `face-detector:d=${detections} a=${maxAreaRatio.toFixed(3)}`
        );
      }
    } else if (hasSeenFace && now - lastSeenAt > LOST_MS) {
      seenStreakStart = 0;
      setAttention(
        "inattentive",
        onAttentionChange,
        `face-detector:d=${detections} a=${maxAreaRatio.toFixed(3)}`
      );
    }
    if (!hasSeenFace && now - lastSeenAt > RECOVER_MS) {
      setAttention(
        "inattentive",
        onAttentionChange,
        `face-detector:d=${detections} a=${maxAreaRatio.toFixed(3)}`
      );
    }
    inFlight = false;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return {
    label: "face-detector",
    stop: () => {
      running = false;
      stream.getTracks().forEach((t) => t.stop());
      video.remove();
    }
  };
}
function stopFaceDetector() {
  running = false;
  resetCounters();
}
export {
  startFaceDetector,
  stopFaceDetector
};
