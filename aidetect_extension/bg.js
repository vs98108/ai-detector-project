// Background script for AI Detect Overlay extension

let streamId = null;

// When the browser action (extension icon) is clicked, prompt the user
// to choose a screen, window, or tab to capture. Once a source is selected
// create an offscreen document for processing and notify the content script
// to start the overlay.
chrome.action.onClicked.addListener(async (tab) => {
  chrome.desktopCapture.chooseDesktopMedia(
    ["screen", "window", "tab", "audio"],
    tab,
    async (id) => {
      if (!id) return;
      streamId = id;
      // Notify content script to start overlay rendering
      chrome.tabs.sendMessage(tab.id, { type: "START_OVERLAY" });
      // Create an offscreen document to access getUserMedia in MV3
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["USER_MEDIA"],
        justification: "Process screen frames for detection"
      });
      // Begin capturing the selected source
      chrome.runtime.sendMessage({ type: "BEGIN_CAPTURE", streamId: id, tabId: tab.id });
    }
  );
});
