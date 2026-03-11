#!/bin/bash

# Configuration
PLUGIN_ID="gemini-ai-agent"
VAULT_PATH="/mnt/c/Users/mawa/OneDrive/notice/Arbeit"
TARGET_DIR="${VAULT_PATH}/.obsidian/plugins/${PLUGIN_ID}"

echo "🚀 Deploying ${PLUGIN_ID} to ${TARGET_DIR}..."

# Build the plugin first
npm run build

# Create target directory if it doesn't exist
mkdir -p "${TARGET_DIR}"

# Copy the necessary files
cp main.js manifest.json styles.css "${TARGET_DIR}/"

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "💡 Now go to Obsidian -> Settings -> Community Plugins -> Refresh and enable '${PLUGIN_ID}'"
else
    echo "❌ Deployment failed!"
    exit 1
fi
