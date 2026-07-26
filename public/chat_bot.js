(async function () {
  const script_tag = document.currentScript;
  const bot_id = script_tag.getAttribute("data-bot-id");
  const owner_id = script_tag.getAttribute("data-owner-id");
  // Derive the API origin from the script's own URL so the widget works on any deployment.
  const API_ORIGIN = new URL(script_tag.src).origin;
  const API_URI = API_ORIGIN + "/api/chat";

  if (!bot_id && !owner_id) {
    alert("Oops! Bot ID not found. Please contact the website administrator.");
    return;
  }

  // Stable anonymous session id so a visitor's messages group into one conversation.
  let session_id = localStorage.getItem("supportai_session_id");
  if (!session_id) {
    session_id = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("supportai_session_id", session_id);
  }

  /* ----------------------------- CSS --------------------------------- */
  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600&family=DM+Mono:wght@300;400&display=swap');

    #chatbot-toggle, #chatbot-box {
      --ink:    #0d0d12;
      --paper:  #f7f5f0;
      --cream:  #faf8f4;
      --muted:  #9b9691;
      --border: rgba(13,13,18,.09);
      --glass:  rgba(247,245,240,.92);
    }

    #chatbot-toggle {
      all: unset;
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: var(--ink);
      color: #fff;
      cursor: pointer;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(13,13,18,.28), 0 2px 8px rgba(13,13,18,.14);
      transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s ease;
    }
    #chatbot-toggle:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 16px 48px rgba(13,13,18,.32), 0 4px 12px rgba(13,13,18,.16);
    }
    #chatbot-toggle:active { transform: scale(.96); }

    #chatbot-toggle .icon-chat,
    #chatbot-toggle .icon-close {
      position: absolute;
      transition: opacity .2s ease, transform .3s cubic-bezier(.34,1.56,.64,1);
    }
    #chatbot-toggle.open .icon-chat  { opacity:0; transform:rotate(90deg) scale(.5); }
    #chatbot-toggle .icon-close       { opacity:0; transform:rotate(-90deg) scale(.5); }
    #chatbot-toggle.open .icon-close  { opacity:1; transform:rotate(0deg) scale(1); }

    #chatbot-box {
      position: fixed;
      bottom: 104px;
      right: 28px;
      width: 400px;
      height: 560px;
      background: var(--cream);
      border-radius: 20px;
      box-shadow:
        0 40px 80px rgba(13,13,18,.18),
        0 8px 24px rgba(13,13,18,.1),
        0 0 0 1px var(--border);
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: 'Sora', system-ui, sans-serif;
      z-index: 2147483646;
      transform-origin: bottom right;
    }

    #chatbot-box.visible {
      display: flex;
      animation: cb-pop-in .35s cubic-bezier(.34,1.56,.64,1) forwards;
    }
    @keyframes cb-pop-in {
      from { opacity:0; transform: scale(.82) translateY(12px); }
      to   { opacity:1; transform: scale(1)  translateY(0); }
    }

    /* Header */
    .cb-header {
      padding: 16px 18px;
      background: var(--ink);
      color: #fff;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .cb-header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), #ff8a4c);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .cb-header-info { flex: 1; }
    .cb-header-name {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: .01em;
      line-height: 1.2;
    }
    .cb-header-status {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
    }
    .cb-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 6px #4ade80;
      animation: cb-pulse 2s ease-in-out infinite;
    }
    @keyframes cb-pulse {
      0%,100% { opacity:1; }
      50%      { opacity:.4; }
    }
    .cb-status-text {
      font-size: 11px;
      font-family: 'DM Mono', monospace;
      color: rgba(255,255,255,.5);
      letter-spacing: .04em;
    }

    /* Messages area */
    #chatbot-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: var(--cream);
      scrollbar-width: thin;
      scrollbar-color: var(--border) transparent;
    }
    #chatbot-messages::-webkit-scrollbar { width: 4px; }
    #chatbot-messages::-webkit-scrollbar-track { background: transparent; }
    #chatbot-messages::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 4px;
    }

    .cb-msg {
      max-width: 82%;
      padding: 11px 14px;
      border-radius: 16px;
      font-size: 13.5px;
      line-height: 1.55;
      animation: cb-msg-in .25s cubic-bezier(.34,1.56,.64,1) forwards;
    }
    @keyframes cb-msg-in {
      from { opacity:0; transform:translateY(8px) scale(.97); }
      to   { opacity:1; transform:translateY(0)   scale(1);   }
    }

    .cb-msg.model {
      align-self: flex-start;
      background: #fff;
      color: var(--ink);
      box-shadow: 0 2px 10px rgba(13,13,18,.07);
      border-bottom-left-radius: 4px;
    }
    .cb-msg.user {
      align-self: flex-end;
      background: var(--ink);
      color: #fff;
      border-bottom-right-radius: 4px;
    }

    /* Typing indicator */
    .cb-typing {
      align-self: flex-start;
      display: flex;
      align-items: center;
      gap: 5px;
      background: #fff;
      padding: 12px 16px;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 10px rgba(13,13,18,.07);
      animation: cb-msg-in .25s ease forwards;
    }
    .cb-typing span {
      width: 6px;
      height: 6px;
      background: var(--muted);
      border-radius: 50%;
      animation: cb-bounce 1.3s ease-in-out infinite;
    }
    .cb-typing span:nth-child(2) { animation-delay: .15s; }
    .cb-typing span:nth-child(3) { animation-delay: .30s; }
    @keyframes cb-bounce {
      0%,60%,100% { transform:translateY(0); }
      30%          { transform:translateY(-5px); background: var(--accent); }
    }

    /* Footer / input */
    .cb-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      background: var(--paper);
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    #chat-input {
      flex: 1;
      padding: 10px 14px;
      background: var(--cream);
      border: 1px solid var(--border);
      border-radius: 12px;
      font-family: 'Sora', sans-serif;
      font-size: 13px;
      color: var(--ink);
      outline: none;
      transition: border-color .2s, box-shadow .2s;
      resize: none;
    }
    #chat-input::placeholder { color: var(--muted); }
    #chat-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(232,68,10,.1);
    }

    #send-btn {
      all: unset;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--ink);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background .2s, transform .2s cubic-bezier(.34,1.56,.64,1);
      flex-shrink: 0;
    }
    #send-btn:hover {
      background: var(--accent);
      transform: scale(1.06);
    }
    #send-btn:active { transform: scale(.94); }

    .cb-footer-label {
      width: 100%;
      text-align: center;
      font-size: 10px;
      font-family: 'DM Mono', monospace;
      color: var(--muted);
      letter-spacing: .06em;
      padding: 0 14px 10px;
      background: var(--paper);
      flex-shrink: 0;
    }

    /* Responsive — small devices (≤480px) */
    @media (max-width: 480px) {
      #chatbot-toggle {
        bottom: 16px;
        right: 16px;
        width: 52px;
        height: 52px;
      }
      #chatbot-box {
        right: 12px;
        left: 12px;
        width: auto;
        height: calc(100vh - 140px);
        bottom: 84px;
      }
      .cb-header {
        padding: 14px 16px;
      }
      #chatbot-messages {
        padding: 12px;
      }
      .cb-msg {
        max-width: 88%;
        padding: 10px 12px;
        font-size: 13px;
      }
      .cb-footer {
        padding: 10px 12px;
      }
      #chat-input {
        padding: 8px 12px;
        font-size: 12px;
      }
      #send-btn {
        width: 36px;
        height: 36px;
      }
    }

    /* Responsive — tablets (481px‑768px) */
    @media (min-width: 481px) and (max-width: 768px) {
      #chatbot-box {
        width: 380px;
      }
    }

  `;
  const wrapper = document.createElement("div");
  wrapper.id = "supportai-chatbot-wrapper";
  wrapper.style.setProperty("--accent", "#e8440a");
  const shadow = wrapper.attachShadow({ mode: "open" });
  shadow.appendChild(style);

  /* ---------------------------- Toggle Btn --------------------------- */
  const button = document.createElement("button");
  button.id = "chatbot-toggle";
  button.setAttribute("aria-label", "Open chat");
  button.innerHTML = `
    <svg class="icon-chat" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
    <svg class="icon-close" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  `;

  /* ----------------------------- Messages ----------------------------- */
  const chat_box = document.createElement("div");
  chat_box.id = "chatbot-box";
  chat_box.innerHTML = `
    <div class="cb-header">
      <div class="cb-header-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4"/>
          <path d="M20 21a8 8 0 1 0-16 0"/>
        </svg>
      </div>
      <div class="cb-header-info">
        <div class="cb-header-name">Support Agent</div>
        <div class="cb-header-status">
          <span class="cb-status-dot"></span>
          <span class="cb-status-text">online · ready to help</span>
        </div>
      </div>
    </div>

    <div id="chatbot-messages">
      <div class="cb-msg model">
        Hello! How can I assist you today?
      </div>
    </div>

    <div class="cb-footer">
      <input
        id="chat-input"
        placeholder="Ask anything…"
        autocomplete="off"
      />
      <button id="send-btn" aria-label="Send">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
    <div class="cb-footer-label">Powered by AI SupportAI</div>
  `;

  button.onclick = () => {
    const isOpen = chat_box.classList.toggle("visible");
    button.classList.toggle("open", isOpen);
    chat_box.style.display = isOpen ? "flex" : "none";
    if (isOpen) {
      chat_box.classList.remove("visible");
      void chat_box.offsetWidth;
      chat_box.classList.add("visible");
      chat_box.querySelector("#chat-input").focus();
    }
  };

  shadow.appendChild(button);
  shadow.appendChild(chat_box);
  document.body.appendChild(wrapper);

  const messages = chat_box.querySelector("#chatbot-messages");
  const chat_input = chat_box.querySelector("#chat-input");
  const send_btn = chat_box.querySelector("#send-btn");

  /* ------------------ Apply per-bot appearance ----------------------- */
  if (bot_id) {
    fetch(API_ORIGIN + "/api/chat/config?botId=" + encodeURIComponent(bot_id))
      .then((r) => r.json())
      .then((cfg) => {
        if (!cfg || !cfg.success || !cfg.appearance) return;
        const a = cfg.appearance;

        if (a.accentColor) {
          wrapper.style.setProperty("--accent", a.accentColor);
        }

        const name_el = chat_box.querySelector(".cb-header-name");
        if (a.displayName && name_el) name_el.textContent = a.displayName;

        if (a.avatarUrl) {
          const avatar_el = chat_box.querySelector(".cb-header-avatar");
          if (avatar_el) {
            avatar_el.innerHTML =
              '<img src="' +
              a.avatarUrl +
              '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>';
          }
        }

        const first_msg = messages.querySelector(".cb-msg.model");
        if (a.welcomeMessage && first_msg) first_msg.textContent = a.welcomeMessage;
      })
      .catch(() => {});
  }

  function add_message(text, role) {
    const box = document.createElement("div");
    box.className = `cb-msg ${role}`;
    box.textContent = text;
    messages.appendChild(box);
    messages.scrollTop = messages.scrollHeight;
  }

  send_btn.onclick = sendMessage;

  chat_input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  async function sendMessage() {
    const text = chat_input.value.trim();
    if (!text) return;

    add_message(text, "user");
    chat_input.value = "";

    const typing = document.createElement("div");
    typing.className = "cb-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    try {
      const res = await fetch(API_URI, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          botId: bot_id,
          ownerId: owner_id,
          sessionId: session_id,
        }),
      });

      const val = await res.json();

      typing.remove();
      if (val.success && val.data?.text) {
        add_message(val.data.text, "model");
      } else {
        add_message(
          val.message || "Sorry, I'm not available right now. Please try again later.",
          "model",
        );
      }
    } catch (error) {
      console.log(error);
      typing.remove();
      add_message("Sorry, something went wrong. Please try again.", "model");
    }
  }
})();
