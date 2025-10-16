// Offscreen script for processing video frames

let video, canvas, ctx, tabId;

// Listen for messages from the background script.
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type !== "BEGIN_CAPTURE") return;
  tabId = msg.tabId;

  // Request a stream from the selected desktop source
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: msg.streamId
      }
    },
    audio: false
  });

  // Create a hidden video element to play the captured stream
  video = Object.assign(document.createElement("video"), {
    srcObject: stream,
    playsInline: true,
    muted: true
  });
  await video.play();

  // Create a canvas to extract frames
  canvas = document.createElement("canvas");
  ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Start processing frames
  requestAnimationFrame(loop);
});

// Main loop: grab the current frame, run detection, and send results
async function loop() {
  if (!video.videoWidth) return requestAnimationFrame(loop);

  const w = video.videoWidth;
  const h = video.videoHeight;
  if (canvas.width !== w) {
    canvas.width = w;
    canvas.height = h;
  }

  // Draw the current frame into the canvas
  ctx.drawImage(video, 0, 0, w, h);
  const frame = ctx.getImageData(0, 0, w, h);

  // TODO: integrate advanced detection for video frames here.
  // For now, we return an empty array of boxes.
  const boxes = await detect(frame);

  // Send the detected boxes back to the content script
  chrome.tabs.sendMessage(tabId, { type: "DRAW_BOXES", boxes, frameW: w, frameH: h });
  requestAnimationFrame(loop);
}

// Placeholder detection function; to be replaced with a real model
async function detect(_frame) {
  return [];
}
