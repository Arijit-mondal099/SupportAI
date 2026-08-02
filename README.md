<div align="center">

# <a href="https://supportai-seven.vercel.app" style="color: white; text-decoration: none;"><img alt="SupportAI" src="public/favicon.png" width="40" height="40" align="center" style="vertical-align: middle; margin-right: 2px; margin-bottom: 4px;"> SupportAI</a>

**AI-powered customer support, trained on your knowledge.**

[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/Arijit-mondal099/AI-Customer-Support-Chatbot/pulls)

[English](README.md) | [हिंदी](README.hi.md) | [बांলা](README.bn.md)

</div>

---

<div align="center">

Build custom AI support agents that know your business. Configure personality, tone, and provider per agent. Add your knowledge — files, URLs, text, or Notion — and embed a zero-dependency chat widget on any site with one `<script>` tag. No third-party processors, no hidden costs, no data leaving your stack.

</div>

<div align="center">

</div>

<div align="center">

<img alt="SupportAI Dashboard" src="public/dashboard.png" width="700">

</div>

## What is SupportAI?

SupportAI is a full-stack platform for creating AI-powered customer support chatbots. Each agent carries its own persona, AI provider (Google Gemini or OpenAI), API key, and knowledge base — giving you complete control over data and cost.

Built for businesses, developers, and SaaS products that want intelligent, on-brand support without sending customer data to third-party chat platforms. Your API keys, your knowledge, your infrastructure.

---

## Features

| Feature                  | Description                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| **AI Chat**              | Natural, context-aware responses powered by Gemini or GPT                     |
| **RAG Knowledge Base**   | Upload PDFs, DOCX, TXT, MD, CSV — or paste text, scrape a URL, connect Notion |
| **Custom Persona**       | Configure bot name, communication tone, and personality per agent             |
| **Embed Widget**         | Drop-in `<script>` tag — 5KB vanilla JS, zero dependencies, any site          |
| **Multi-provider**       | Per-agent choice of Google Gemini or OpenAI, with own model and API key       |
| **Conversation History** | Multi-turn chats persisted per visitor session                                |
| **Analytics Dashboard**  | Account-level stats, 14-day message chart, top agents, per-bot analytics      |

---

## Build Your First Agent

Agents are created and managed from the **Dashboard**. Sign in, then click **New agent**. Each agent is fully self-contained — its own provider, model, and API key — so you can mix and match providers across your account.

The creation flow is a 4-step wizard:

### Step 1 — Basics

Give your agent context so it stays on-brand:

- **Agent name** — an internal label you'll recognize later (e.g. "Acme Returns")
- **Business name** + **Industry** — used to ground the agent's tone and terminology
- **Support email** — shown to visitors when the bot escalates to a human
- **Business description** — a short paragraph about what you offer, who you serve, and what sets you apart

### Step 2 — Persona

Make the agent feel like part of your team:

- **Bot display name** — the name shown in the chat window (e.g. "Aria", "Max")
- **Communication tone** — pick from Friendly, Professional, Casual, Formal, Empathetic, Concise, Playful, or Technical
- **Personality & instructions** — free-form guidance: how it greets users, topics to avoid, edge-case handling, etc.

### Step 3 — Model & Key

Choose the brain behind the agent:

- **Provider** — Google Gemini or OpenAI
- **Model** — e.g. Gemini 2.0 Flash or GPT-4o mini
- **API key** — paste a key from your provider's console. Each agent uses its own key, so you can track cost per agent.

### Step 4 — Review

Check the summary, then decide:

- Toggle **Make live now** to publish the agent to embedded sites immediately — or leave it in draft and finish configuring first.

> Once created, you can open **Config** to switch the status between **draft** and **live** at any time. An agent must be **live** before visitors can chat with it through the embed widget.

---

## Add Knowledge

An agent is only as smart as the information you give it. After creating an agent, open its **Knowledge** tab and add sources. You can use any combination:

| Source     | Format                  | When to use it                                           |
| ---------- | ----------------------- | -------------------------------------------------------- |
| **Text**   | Plain text              | Paste FAQs, policies, product details, or return reasons |
| **URL**    | Web page URL            | Scrape a help article, docs page, or product page        |
| **File**   | PDF, DOCX, TXT, MD, CSV | Upload a manual, spreadsheet, or long-form document      |
| **Notion** | Page or database ID     | Index your Notion workspace content                      |

### Adding a source

1. Open the agent → **Knowledge** tab.
2. Pick a source type from the tabs: **Text**, **URL**, **File**, or **Notion**.
3. Fill in the content and click **Add to knowledge base**.
4. The document is indexed and its status updates in the list below:

| Status         | What it means                                       |
| -------------- | --------------------------------------------------- |
| **ready**      | Indexed and available to answer questions           |
| **processing** | Still being split and embedded — check back         |
| **error**      | Something went wrong — re-add or try a smaller file |

> Notion requires an integration token set up once in **Plugins**. Make sure your integration is invited to the page or database you want to index (share → invite → your integration name).

Each knowledge source is automatically split into chunks and made searchable, so the agent can find the most relevant answers to each question you ask it.

---

## Embed on Your Site

Once an agent is **live**, you can put it on any website:

1. Open the agent → **Embed** tab.
2. Copy the single script tag.
3. Paste it into your site's HTML, just before the closing `</body>` tag.
4. Save and deploy — the chat widget appears in the bottom-right corner.

```html
<script
  src="https://supportai-seven.vercel.app/chat_bot.js"
  data-bot-id="YOUR_CHAT_BOT_ID"
></script>
```

This script is a self-contained **5KB vanilla JavaScript file** — no build step, no dependencies, no framework required. It works on any static or dynamic site (WordPress, Shopify, Next.js, plain HTML, you name it).

The widget automatically:

- Uses the **accent color**, **display name**, **avatar**, and **welcome message** you set in the agent's **Appearance** tab
- Generates an anonymous session ID (stored in `localStorage`) so multi-turn conversations persist across page loads
- Is responsive — full-width on mobile, compact on desktop

**Responsive sizing:** Full-width on mobile (≤480px), 380px on tablet, 400×560 on desktop.

---

## Dashboard Guide

Everything you need to build, tune, and monitor your agents lives in the Dashboard.

### Account-wide views

| Page                             | What you see                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Overview** (`/dashboard`)      | A snapshot across all your agents: total agents, live count, conversations, messages, a 14-day message chart, your top agents, and recent conversations. Click **New agent** from here to start. |
| **Agents** (`/dashboard/agents`) | A grid of every agent you've created. Each card shows its status (live/draft) and a quick **Open** link to manage it. Use the three-dot menu to delete an agent.                                 |

### Per-agent views

Open any agent to see its tab bar:

| Tab               | What you do here                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Overview**      | Quick stats: conversation count, message count, last active time, and key details (provider, model, API key status).                             |
| **Playground**    | Test your agent right in the browser. Send messages and see replies — without saving anything to the conversation history.                       |
| **Config**        | Edit the agent name, status (draft/live), business info, persona, provider, model, and API key. Also where you can permanently delete the agent. |
| **Knowledge**     | Add, browse, and remove knowledge sources (Text, URL, File, Notion). Watch each document progress from `processing` to `ready`.                  |
| **Appearance**    | Customize how the embedded widget looks: accent color, display name, avatar image URL, and welcome message. A live preview updates as you type.  |
| **Embed**         | Grab the `<script>` snippet for this agent and confirm it's **live**.                                                                            |
| **Conversations** | Browse every visitor session for this agent. Click a session to read the full transcript.                                                        |

---

## How It Works

1. **Create your agent** — give it a name, business context, and personality.
2. **Pick a provider** — choose Google Gemini or OpenAI, and paste that agent's API key.
3. **Add your knowledge** — upload files, paste text, scrape URLs, or connect Notion.
4. **Test in the Playground** — refine the persona and tone until it sounds right.
5. **Embed** — copy one `<script>` tag and drop it on your site.

At chat time, the agent combines your configured persona (system prompt) with the most relevant knowledge retrieved from your sources, then responds through your chosen provider — all in your own stack.

---

## License

[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Released under the MIT License. See [LICENSE](LICENSE) for details.
