/* global document, window, localStorage, sessionStorage, fetch */

(function () {
  "use strict";

  // ── DOM refs ──────────────────────────────────────────
  const chatMessages = document.getElementById("chat-messages");
  const chatForm = document.getElementById("chat-form");
  const messageInput = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const clearBtn = document.getElementById("clear-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const settingsOverlay = document.getElementById("settings-overlay");
  const apiKeyInput = document.getElementById("api-key-input");
  const saveKeyBtn = document.getElementById("save-key-btn");
  const cancelKeyBtn = document.getElementById("cancel-key-btn");

  // ── State ─────────────────────────────────────────────
  const SESSION_KEY = "chatbot_session";
  const API_KEY_STORAGE = "chatbot_api_key";
  let sessionId = sessionStorage.getItem(SESSION_KEY) || generateId();
  sessionStorage.setItem(SESSION_KEY, sessionId);
  let isWaiting = false;

  // ── Helpers ───────────────────────────────────────────
  function generateId() {
    return "s_" + Math.random().toString(36).substring(2, 10);
  }

  function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || "";
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /** Very small Markdown → HTML converter (covers common patterns) */
  function renderMarkdown(text) {
    let html = text
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, function (_m, _lang, code) {
        return "<pre><code>" + escapeHtml(code.trim()) + "</code></pre>";
      })
      // Inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // Bold
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // Line breaks → paragraphs
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/\n/g, "<br>");

    return "<p>" + html + "</p>";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ── UI Builders ───────────────────────────────────────
  function removeWelcome() {
    const welcome = chatMessages.querySelector(".welcome-message");
    if (welcome) welcome.remove();
  }

  function addMessage(role, content) {
    removeWelcome();

    const wrapper = document.createElement("div");
    wrapper.className = "message " + role;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? "You" : "AI";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = role === "user" ? escapeHtml(content).replace(/\n/g, "<br>") : renderMarkdown(content);

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    scrollToBottom();

    return wrapper;
  }

  function addError(text) {
    removeWelcome();

    const wrapper = document.createElement("div");
    wrapper.className = "message error bot";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "⚠";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    scrollToBottom();
  }

  function showTyping() {
    removeWelcome();

    const wrapper = document.createElement("div");
    wrapper.className = "message bot typing-msg";
    wrapper.id = "typing";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "AI";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML =
      '<div class="typing-indicator"><span></span><span></span><span></span></div>';

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    scrollToBottom();
  }

  function hideTyping() {
    const el = document.getElementById("typing");
    if (el) el.remove();
  }

  function setLoading(loading) {
    isWaiting = loading;
    sendBtn.disabled = loading || messageInput.value.trim().length === 0;
    messageInput.disabled = loading;
    if (!loading) messageInput.focus();
  }

  // ── API ───────────────────────────────────────────────
  async function sendMessage(text) {
    addMessage("user", text);
    showTyping();
    setLoading(true);

    try {
      const body = { message: text, sessionId: sessionId };
      const key = getApiKey();
      if (key) body.apiKey = key;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      hideTyping();

      if (!res.ok) {
        addError(data.error || "Something went wrong.");
        return;
      }

      addMessage("bot", data.reply);
    } catch (_err) {
      hideTyping();
      addError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function clearConversation() {
    try {
      await fetch("/api/chat/" + sessionId, { method: "DELETE" });
    } catch (_e) {
      /* ignore */
    }

    // Reset session
    sessionId = generateId();
    sessionStorage.setItem(SESSION_KEY, sessionId);

    // Reset UI
    chatMessages.innerHTML = "";
    const welcomeHtml =
      '<div class="welcome-message">' +
      '<div class="welcome-icon">🤖</div>' +
      "<h2>Welcome to AI Chatbot</h2>" +
      "<p>Ask me anything! I can help with coding, writing, brainstorming, and much more.</p>" +
      '<div class="suggestions">' +
      '<button class="suggestion" data-msg="Explain how async/await works in JavaScript">💡 Explain async/await</button>' +
      '<button class="suggestion" data-msg="Write a Python function to find prime numbers">🐍 Python prime numbers</button>' +
      '<button class="suggestion" data-msg="What are the best practices for REST API design?">🌐 REST API best practices</button>' +
      "</div></div>";
    chatMessages.innerHTML = welcomeHtml;
    bindSuggestions();
  }

  // ── Event Listeners ───────────────────────────────────
  // Auto-resize textarea
  messageInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 150) + "px";
    sendBtn.disabled = isWaiting || this.value.trim().length === 0;
  });

  // Send on Enter (Shift+Enter for new line)
  messageInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isWaiting && this.value.trim().length > 0) {
        chatForm.dispatchEvent(new Event("submit"));
      }
    }
  });

  chatForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || isWaiting) return;
    messageInput.value = "";
    messageInput.style.height = "auto";
    sendBtn.disabled = true;
    sendMessage(text);
  });

  clearBtn.addEventListener("click", clearConversation);

  // Suggestions
  function bindSuggestions() {
    const buttons = document.querySelectorAll(".suggestion");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const msg = this.getAttribute("data-msg");
        if (msg && !isWaiting) sendMessage(msg);
      });
    });
  }
  bindSuggestions();

  // Settings
  settingsBtn.addEventListener("click", function () {
    apiKeyInput.value = getApiKey();
    settingsOverlay.classList.remove("hidden");
    apiKeyInput.focus();
  });

  cancelKeyBtn.addEventListener("click", function () {
    settingsOverlay.classList.add("hidden");
  });

  saveKeyBtn.addEventListener("click", function () {
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem(API_KEY_STORAGE, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
    settingsOverlay.classList.add("hidden");
  });

  settingsOverlay.addEventListener("click", function (e) {
    if (e.target === settingsOverlay) {
      settingsOverlay.classList.add("hidden");
    }
  });
})();
