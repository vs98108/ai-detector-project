// Content script responsible for rendering detection overlays and polling the page
// for AI-generated text blocks. The actual detection logic is defined in
// detector.js and exposed via the global function `detectBlocks`.

let overlay;
let canvas;
let ctx;

// Ensure the overlay DOM elements are created and sized correctly
function ensureOverlay() {
  if (overlay) return;
  overlay = Object.assign(document.createElement("div"), {
    id: "ai-detect-overlay",
    style: `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483647;
      display: block;
    `
  });
  canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  overlay.appendChild(canvas);
  document.documentElement.appendChild(overlay);
  ctx = canvas.getContext("2d");
  onResize();
  new ResizeObserver(onResize).observe(document.documentElement);
  window.addEventListener("resize", onResize);
}

// Resize the canvas to account for device pixel ratio
function onResize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Listen for messages from the background and offscreen scripts
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START_OVERLAY") {
    ensureOverlay();
    // Start the periodic DOM scan for text blocks
    scanAndDraw();
  }
  if (msg.type === "DRAW_BOXES") {
    draw(msg);
  }
});

// Periodically scan the DOM for AI-generated text blocks and draw them
function scanAndDraw() {
  const boxes = window.detectBlocks ? window.detectBlocks() : [];
  draw({ boxes, frameW: window.innerWidth, frameH: window.innerHeight });
  setTimeout(scanAndDraw, 1000);
}

// Render the bounding boxes onto the overlay canvas
function draw({ boxes, frameW, frameH }) {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sx = vw / frameW;
  const sy = vh / frameH;

  boxes.forEach((b) => {
    const x = b.x * sx;
    const y = b.y * sy;
    const w = b.w * sx;
    const h = b.h * sy;
    // Draw outline
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.strokeRect(x, y, w, h);
    // Draw translucent fill
    ctx.fillStyle = "rgba(255, 255, 0, 0.25)";
    ctx.fillRect(x, y, w, h);
    // Draw label background
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    const text = `${b.label || "AI"} ${(b.score ?? 0).toFixed(2)}`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillRect(x, y - 18, textWidth + 10, 18);
    // Draw label text
    ctx.fillStyle = "white";
    ctx.fillText(text, x + 4, y - 5);
  });
}
