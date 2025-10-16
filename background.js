// Background service worker for AI Detector MVP
// This service manages tab capture streams per tab and coordinates capture

// Use a Map to track active capture streams keyed by tab ID
const streams = new Map();

// Listen for messages from content scripts or the popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // When a tab requests to start capture, use chrome.tabCapture
  if (msg.type === "START_TAB_CAPTURE") {
    chrome.tabCapture.capture({ audio: true, video: true }, stream => {
      if (chrome.runtime.lastError || !stream) {
        sendResponse({ ok: false, error: chrome.runtime.lastError?.message || "capture failed" });
        return;
      }
      // Store the stream for this tab so it can be reused
      if (sender.tab) {
        streams.set(sender.tab.id, stream);
      }
      sendResponse({ ok: true });
    });
    return true; // Keep the channel open for async response
  }

  // Stop a capture for the current tab
  if (msg.type === "STOP_TAB_CAPTURE") {
    if (sender.tab && streams.has(sender.tab.id)) {
      const stream = streams.get(sender.tab.id);
      // Stop all tracks on the stream and remove from map
      stream.getTracks().forEach(t => t.stop());
      streams.delete(sender.tab.id);
    }
    sendResponse({ ok: true });
  }
});
