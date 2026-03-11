import { ItemView, WorkspaceLeaf } from 'obsidian';
import GeminiAgentPlugin from './main';
import { getObsidianTools, toolDeclarations } from './tools';

export const VIEW_TYPE_GEMINI_CHAT = "gemini-chat-view";

export class GeminiChatView extends ItemView {
	plugin: GeminiAgentPlugin;
	messageContainer: HTMLDivElement;
	inputField: HTMLTextAreaElement;
	chat: any; // ChatSession from @google/generative-ai
	abortController: AbortController | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GeminiAgentPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	async onClose() {
		this.cancelRequest();
	}

	cancelRequest() {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
	}

	// ... (rest of methods)

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('gemini-chat-container');

		container.createEl('h4', { text: 'Gemini AI Agent' });

		this.messageContainer = container.createDiv('gemini-chat-messages');
		
		const inputContainer = container.createDiv('gemini-chat-input-container');
		this.inputField = inputContainer.createEl('textarea', {
			placeholder: 'Ask Gemini...',
			cls: 'gemini-chat-input'
		});

		this.inputField.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				this.handleSendMessage();
			}
		});

		const sendButton = inputContainer.createEl('button', {
			text: 'Send',
			cls: 'mod-cta'
		});
		sendButton.onclick = () => this.handleSendMessage();
		
		this.initializeChat();
	}

	async initializeChat() {
		if (this.plugin.genAI) {
			try {
				const model = await this.plugin.getModelWithFallback(this.plugin.settings.modelName);
				// We need to re-apply tools to the model instance from fallback
				const modelWithTools = this.plugin.genAI.getGenerativeModel({ 
					model: model.model,
					tools: [{ functionDeclarations: toolDeclarations }] as any
				});
				this.chat = modelWithTools.startChat();
			} catch (error) {
				this.appendMessage('agent', `Error initializing chat: ${error.message}`);
			}
		}
	}

	async handleSendMessage() {
		const message = this.inputField.value.trim();
		if (!message) return;

		this.appendMessage('user', message);
		this.inputField.value = '';

		if (!this.plugin.genAI) {
			this.appendMessage('agent', 'Error: API Key not configured. Please check settings.');
			return;
		}

		if (!this.chat) {
			await this.initializeChat();
		}

		if (!this.chat) return;

		try {
			this.abortController = new AbortController();
			let result = await this.chat.sendMessage(message);
			let response = await result.response;
			
			let iterations = 0;
			const MAX_ITERATIONS = 5;

			// Agent Loop for Function Calling
			while (iterations < MAX_ITERATIONS && response.candidates[0].content.parts.some((part: any) => !!part.functionCall)) {
				iterations++;
				const toolResults = [];
				const excludedPaths = this.plugin.settings.excludedPaths.split(',').filter(p => p.trim() !== '');
				const tools = getObsidianTools(this.app, excludedPaths);
				
				for (const part of response.candidates[0].content.parts) {
					if (part.functionCall) {
						const name = part.functionCall.name;
						const args = part.functionCall.args;
						
						this.appendMessage('agent', `*Executing ${name}...*`);
						
						const toolFunction = (tools as any)[name];
						if (toolFunction) {
							const resultText = await toolFunction(args);
							toolResults.push({
								functionResponse: {
									name: name,
									response: { result: resultText }
								}
							});
						} else {
							toolResults.push({
								functionResponse: {
									name: name,
									response: { error: `Tool ${name} not found` }
								}
							});
						}
					}
				}
				
				// Send results back to Gemini
				result = await this.chat.sendMessage(toolResults);
				response = await result.response;
			}

			if (iterations >= MAX_ITERATIONS) {
				this.appendMessage('agent', '_Loop detection: Maximum number of tool calls reached._');
			}
			
			// Now we have a final text response, let's stream it (if it's not empty)
			const responseText = response.text();
			if (responseText) {
				const msgEl = this.appendMessage('agent', '');
				const contentEl = msgEl.querySelector('.gemini-message-content') as HTMLDivElement;
				
				// Simulation of streaming for the final response if we didn't use sendMessageStream
				// or just show it if we don't want to overcomplicate the agent loop logic.
				// For a real agent loop with streaming, we'd need to handle each step's stream.
				// Since we already have the full response here from the loop, we'll just display it.
				contentEl.textContent = responseText;
			}
			
			this.abortController = null;
		} catch (error) {
			if (error.name === 'AbortError') {
				this.appendMessage('agent', '_Request cancelled_');
			} else {
				this.appendMessage('agent', `Error: ${error.message}`);
				console.error(error);
			}
		} finally {
			this.abortController = null;
		}
	}

	appendMessage(sender: 'user' | 'agent', text: string) {
		const msgEl = this.messageContainer.createDiv(`gemini-message gemini-message-${sender}`);
		msgEl.createEl('b', { text: sender === 'user' ? 'You' : 'Gemini' });
		msgEl.createEl('div', { text: text, cls: 'gemini-message-content' });
		
		// Scroll to bottom
		this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
		return msgEl;
	}
}
