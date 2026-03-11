# Obsidian Gemini AI Agent

A professional-grade Obsidian plugin that integrates Google Gemini as a powerful AI agent. Not just a chatbot, but an active participant in your knowledge management workflow.

![GitHub Release](https://img.shields.io/github/v/release/Waldheim-dev/obsidian-gemini-agent?style=flat-square)
![Build Status](https://img.shields.io/github/actions/workflow/status/Waldheim-dev/obsidian-gemini-agent/ci.yml?branch=main&style=flat-square)
![Coverage](https://img.shields.io/badge/Coverage-98%25-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## 🚀 Features

- **Google Gemini Integration**: Access the latest Gemini models (Flash, Pro, Ultra) directly within Obsidian.
- **Dynamic Model Fetching**: Automatically fetches available models from the Google API.
- **Intelligent AI Agent**: Uses **Function Calling** to interact with your vault.
- **Obsidian-Native Tools**:
  - `create_note`: Create notes with metadata and tags.
  - `update_note`: Perform atomic updates to your content.
  - `read_note`: Context-aware reading of your knowledge base.
  - `list_files`: Browse and search your vault structure.
  - `canvas_support`: Programmatically create and modify `.canvas` files.
- **Smart Fallback System**: Automatically switches to alternative models if rate limits or quotas are hit.
- **Privacy-First**:
  - **Exclusion Lists**: Define paths and folders the AI should never access.
  - **Secure Storage**: API keys are stored in your system's native keychain via Obsidian's SecretStorage API.
- **Performance Optimized**: Uses `cachedRead` and `AbortController` for a smooth, non-blocking UI.

## 🛠 Installation

### Via Community Plugins (Pending)
1. Search for `Gemini AI Agent` in the Obsidian Community Plugins tab.
2. Install and Enable.

### Manual Installation
1. Download the latest release (`main.js`, `manifest.json`, `styles.css`).
2. Create a folder: `<your-vault>/.obsidian/plugins/obsidian-gemini-agent/`.
3. Copy the files into that folder.
4. Restart Obsidian or reload plugins.

## ⚙️ Configuration

1. Get a **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).
2. Open Obsidian Settings -> Gemini AI Agent.
3. Paste your API Key (it will be stored securely).
4. Select your preferred model (e.g., `gemini-2.5-flash`).
5. (Optional) Configure excluded paths to protect sensitive information.

## ⌨️ Usage

- **Sidebar Chat**: Click the bot icon in the ribbon to open the chat view.
- **Commands**:
  - `Open Gemini chat`: Opens the interactive agent view.
  - `Summarize current note`: Generates a summary and adds it to the note's frontmatter.
  - `Refresh available models`: Synchronizes the latest model list from Google.

## 🧑‍💻 Development

Built with **TypeScript**, **esbuild**, and **Vitest**.

### Prerequisites
- Node.js (v24 or v25 recommended)
- pnpm

### Setup
```bash
pnpm install
```

### Scripts
- `pnpm dev`: Run esbuild in watch mode.
- `pnpm build`: Run linting, tests, and build for production.
- `pnpm test`: Execute Vitest unit tests with coverage.
- `pnpm lint`: Run ESLint checks.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
Built with ❤️ for the Obsidian Community.
