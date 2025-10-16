// Content script for AI Detector extension
// This script runs on every page and listens for messages to scan
// and highlight text/images as well as capture video/audio frames.

// Ensure overlay root exists once
if (!window.__AID_OVERLAY__) {
  const root = document.createElement("div");
  root.id = "aid-overlay-root";
  document.documentElement.appendChild(root);
  window.__AID_OVERLAY__ = root;
}

// CSS classes used for highlights and boxes are defined in overlay.css
const markClass = "aid-highlight";
const boxClass = "aid-box";

// Helper: walk all text nodes and apply callback
function walkTextNodes(node, cb) {
  const walker = document.createTreeWalker(node || document.body, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = walker.nextNode())) {
    cb(n);
  }
}

// Simple heuristic for AI-generated text
// This can be replaced with a real classifier in the future
function textScore(str) {
  const s = str.replace(/\s+/g, " ").trim();
  if (s.length < 80) return 0;
  const sentences = s.split(/[.!?]\s/).length;
  const words = s.split(/\s/);
  const uniq = new Set(words.map(w => w.toLowerCase())).size;
  const ttr = uniq / words.length; // type-token ratio
  const avgLen = s.length / Math.max(1, sentences);
  let score = 0;
  if (ttr < 0.45) score += 0.4;
  if (avgLen > 160) score += 0.3;
  if (/[;:—]{2,}/.test(s)) score += 0.2;
  if (/\bmoreover\b|\bfurthermore\b|\bin conclusion\b/i.test(s)) score += 0.2;
  return Math.min(1, score);
}

// Highlight an entire text node by replacing it with a span
function highlightTextNode(n, score) {
  const span = document.createElement("span");
  span.className = markClass;
  span.title = `AI-likely: ${(score * 100) | 0}%`;
  span.textContent = n.textContent;
  n.parentNode.replaceChild(span, n);
}

function detectText() {
  walkTextNodes(document.body, n => {
    // Skip if inside existing highlight
    if (n.parentElement && n.parentElement.closest(`.${markClass}`)) return;
    const t = n.textContent;
    const score = textScore(t);
    if (score >= 0.75) {
      highlightTextNode(n, score);
    }
  });
}

// Simple image heuristic: measure global luminance variance
function imageScore(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height).data;
  let varSum = 0;
  const step = 16;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const l = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
      const j = ((Math.min(y + step, height - 1)) * width + Math.min(x + step, width - 1)) * 4;
      const l2 = 0.299 * img[j] + 0.587 * img[j + 1] + 0.114 * img[j + 2];
      varSum += Math.abs(l - l2);
    }
  }
  const norm = varSum / ((width / step) * (height / step));
  return Math.max(0, Math.min(1, 0.8 - norm / 35));
}

// Draw a bounding box overlay around an element
function drawBox(el, label) {
  const r = el.getBoundingClientRect();
  const box = document.createElement("div");
  box.className = boxClass;
  box.style.left = `${window.scrollX + r.left}px`;
  box.style.top = `${window.scrollY + r.top}px`;
  box.style.width = `${r.width}px`;
  box.style.height = `${r.height}px`;
  box.textContent = label;
  // Use highest z-index to ensure overlay on top of page content
  box.style.position = "absolute";
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 8000);
}

function detectImages() {
  const imgs = Array.from(document.images);
  imgs.forEach(img => {
    try {
      const canvas = document.createElement("canvas");
      const w = Math.min(512, img.naturalWidth || img.width);
      const h = Math.min(512, img.naturalHeight || img.height);
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const s = imageScore(canvas);
      if (s >= 0.75) {
        drawBox(img, `AI-likely ${(s * 100) | 0}%`);
      }
    } catch (e) {
      // ignore cross-origin images
    }
  });
}

// Video capture variables
let videoEl;
let canvasEl;
let ctxEl;
let analyzing = false;

async function attachCaptureToPage() {
  // Use getDisplayMedia as fallback for tab capture (requires user grant)
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  } catch (err) {
    alert("Grant screen capture permission to analyze video/audio.");
    return;
  }
  // Create hidden video element
  videoEl = document.createElement("video");
  videoEl.autoplay = true;
  videoEl.muted = true;
  videoEl.srcObject = stream;
  videoEl.style.position = "fixed";
  videoEl.style.right = "0";
  videoEl.style.bottom = "0";
  videoEl.style.width = "160px";
  videoEl.style.height = "90px";
  videoEl.style.opacity = "0.2";
  document.body.appendChild(videoEl);

  // Setup canvas for frame analysis
  canvasEl = document.createElement("canvas");
  canvasEl.width = 640;
  canvasEl.height = 360;
  ctxEl = canvasEl.getContext("2d", { willReadFrequently: true });

  // Setup audio context for heuristics (spectral flatness)
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const src = ac.createMediaStreamSource(stream);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  const spectrum = new Float32Array(analyser.frequencyBinCount);

  analyzing = true;

  function loop() {
    if (!analyzing) return;
    if (videoEl.videoWidth && videoEl.videoHeight) {
      ctxEl.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const frameScore = imageScore(canvasEl);`
      if (frameScore >= 0.75) {
        drawBox(document.documentElement, `Video AI-likely ${(frameScore * 100) | 0}%`);
      }
      analyser.getFloatFrequencyData(spectrum);
      // Additional audio analysis could be implemented here
    }
    setTimeout(() => requestAnimationFrame(loop), 50);
  }
  loop();
}

chrome.runtime.onMessage.addListener(msg => {
  switch (msg.type) {
    case "SCAN_PAGE":
      detectText();
      detectImages();
      break;
    case "INIT_CAPTURE_VIEW":
      // Placeholder for future styling or setup
      break;
    case "ATTACH_CAPTURE":
      attachCaptureToPage();
      break;
    case "FEEDBACK_MARK":
      // Store feedback marker to localStorage with timestamp
      try {
        localStorage.setItem("aid-last-feedback", msg.value);
      } catch (e) {
        // ignore quota errors
      }
      break;
  }
});
