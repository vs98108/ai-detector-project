// Popup script to manage user interaction with AI Detector extension

// Helper to get element by ID
const qs = id => document.getElementById(id);

// Sends a message to the active tab
function sendToActive(tabMsg) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, tabMsg);
    }
  });
}

// Sign up stores credentials locally for demonstration only
qs("signup").onclick = async () => {
  const email = qs("email").value.trim();
  const pass = qs("pass").value;
  if (!email || !pass) {
    qs("authStatus").textContent = "Missing email/password";
    return;
  }
  await chrome.storage.sync.set({ user: { email, passHash: btoa(pass) } });
  qs("authStatus").textContent = "Signed up (local)";
};

// Login sets a simple session token
qs("login").onclick = async () => {
  const email = qs("email").value.trim();
  const pass = qs("pass").value;
  const data = await chrome.storage.sync.get("user");
  const user = data.user;
  if (user && user.email === email && user.passHash === btoa(pass)) {
    await chrome.storage.sync.set({ session: { email } });
    qs("authStatus").textContent = "Logged in";
  } else {
    qs("authStatus").textContent = "Invalid creds";
  }
};

// Buttons to initiate scanning and capture
qs("scanPage").onclick = () => sendToActive({ type: "SCAN_PAGE" });

qs("startCapture").onclick = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    // Ask content script to prepare for capture
    chrome.tabs.sendMessage(tabs[0].id, { type: "INIT_CAPTURE_VIEW" });
    chrome.runtime.sendMessage({ type: "START_TAB_CAPTURE" }, res => {
      if (!res?.ok) {
        alert(res?.error || "Failed to start capture");
        return;
      }
      // Attach capture on page
      sendToActive({ type: "ATTACH_CAPTURE" });
    });
  });
};

qs("stopCapture").onclick = () => {
  chrome.runtime.sendMessage({ type: "STOP_TAB_CAPTURE" });
};

// Feedback interactions: store like/dislike in local storage
qs("likeBtn").onclick = () => sendToActive({ type: "FEEDBACK_MARK", value: "like" });
qs("dislikeBtn").onclick = () => sendToActive({ type: "FEEDBACK_MARK", value: "dislike" });

qs("submitFeedback").onclick = async () => {
  const text = qs("feedback").value.trim();
  const data = await chrome.storage.sync.get("session");
  const session = data.session;
  const fb = { at: Date.now(), by: session?.email || "anon", text };
  const data2 = await chrome.storage.local.get("feedbacks");
  const feedbacks = data2.feedbacks || [];
  feedbacks.push(fb);
  await chrome.storage.local.set({ feedbacks });
  qs("feedback").value = "";
  alert("Saved locally");
};
