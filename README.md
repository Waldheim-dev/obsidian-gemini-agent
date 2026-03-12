# Gemini AI Agent

A professional-grade plugin that integrates Google Gemini as a powerful, autonomous AI agent. Designed for researchers, writers, and power-users who want more than just a chatbot.

![GitHub Release](https://img.shields.io/github/v/release/Waldheim-dev/obsidian-gemini-agent?style=flat-square)
[![CI](https://github.com/Waldheim-dev/obsidian-gemini-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Waldheim-dev/obsidian-gemini-agent/actions/workflows/ci.yml)
![Build Status](https://img.shields.io/github/actions/workflow/status/Waldheim-dev/obsidian-gemini-agent/release.yml?branch=main&style=flat-square)
![Coverage](https://img.shields.io/badge/Coverage-98%25-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## 🌟 Why this Plugin?

Unlike standard AI plugins, the **Gemini AI Agent** is designed to be **agentic**. It doesn't just talk to you; it can see your vault, search your notes, execute commands, and organize your files—all while keeping your privacy a top priority.

## 🚀 Features

### 🧠 Autonomous AI Agent
- **Deep Vault Integration**: Gemini can use specific tools to interact with your notes and structure.
- **✨ Auto-Select Mode**: Automatically picks the best available model and handles fallbacks if quotas are exceeded.
- **Context-Aware**: Directly reference files using `#` mentions to include their content in the conversation.

### 🛠 Powerful Tool-Set
Gemini can autonomously perform the following actions:
- **Note Management**: Create, read, and update notes atomically.
- **Folder Control**: Create and organize folders.
- **Global Search**: Search through the content of your entire vault.
- **Command Execution**: Run any plugin or core command (e.g., toggle sidebars, open specific views).
- **Canvas Support**: Create and modify visual mind-maps via `.canvas` files.

### 🎨 Modern UI/UX
- **Conversation Caching**: Persistent chat history with a beautiful "Boxed List" overview.
- **Auto-Titling**: Automatically generates concise titles for your chats.
- **Markdown Native**: Responses are rendered using the native Markdown engine (tables, code blocks, math).
- **Thinking State**: Visual feedback during processing with productivity tips and quotes.
- **Copy & Regenerate**: Easy actions for each message, including one-click copying and re-generating answers.

### 🔒 Privacy & Performance
- **Exclusion Lists**: Prevent the AI from ever seeing specific folders or files.
- **Secure Key Storage**: Uses the system keychain via the SecretStorage API.
- **Context Shrinking**: Intelligent sliding window for history to keep token usage efficient.
- **Garbage Collector**: Automatically cleans up very old or empty chats to save storage.

## ⚙️ Setup

1. **API Key**: Obtain a free key from [Google AI Studio](https://aistudio.google.com/).
2. **Install**: Copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/gemini-ai-agent/`.
3. **Configure**: Enter your key in the plugin settings and choose "✨ Auto-Select".

## ⌨️ Shortcuts & Interaction

- **`#`**: Type `#` in the chat to search and attach a file as context.
- **`Arrow Up`**: Press up in an empty input field to retrieve your last message.
- **`Enter`**: Send message.
- **`Shift + Enter`**: New line.

## 🧑‍💻 Development & Security

We maintain high standards for code quality and security:
- **Linting**: Strict ESLint rules for TypeScript.
- **Testing**: Robust unit tests with Vitest (~98% coverage).
- **Security Scans**: Continuous scanning via Trivy and OSV-Scanner in CI/CD.
- **Automated Releases**: Versioning managed via Semantic Release.

## 📄 License

MIT License. Copyright (c) 2026 Waldheim-dev.

---
Part of the **Waldheim Professional Suite**. Built for the future of networked thought.
