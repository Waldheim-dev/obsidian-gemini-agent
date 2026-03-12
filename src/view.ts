import { ItemView, WorkspaceLeaf, MarkdownRenderer, TFile, setIcon, Notice } from 'obsidian';
import GeminiAgentPlugin, { MODEL_DISPLAY_NAMES, VIEW_TYPE_GEMINI_CHAT } from './main';
import { getObsidianTools, toolDeclarations } from './tools';
import { Conversation } from './conversations';
import { FileSuggestModal } from './suggest';
import { ChatSession, Content, Part } from "@google/generative-ai";

const THINKING_TIPS = [
	"Tip: Use # to attach a file for more context.",
	"Did you know? Gemini can create and edit Obsidian Canvas files.",
	"Idea: Ask Gemini to summarize your meeting notes.",
	"Tip: You can exclude sensitive folders in the plugin settings.",
	"Did you know? Gemini 1.5 Pro has a massive context window.",
	"Idea: Ask for a mind-map based on your current project.",
	"Tip: Use @mention logic coming soon for even better workflow.",
	"Pro-Tip: Clear chat frequently to keep the context focused."
];

const THINKING_QUOTES = [
	"\"The only way to do great work is to love what you do.\" - Steve Jobs",
	"\"Knowledge is power.\" - Francis Bacon",
	"\"Design is not just what it looks like and feels like. Design is how it works.\" - Steve Jobs",
	"\"Simplicity is the ultimate sophistication.\" - Leonardo da Vinci",
	"\"Focus on being productive instead of busy.\" - Tim Ferriss",
	"\"Your mind is for having ideas, not holding them.\" - David Allen"
];

export class GeminiChatView extends ItemView {
	plugin: GeminiAgentPlugin;
	messageContainer: HTMLDivElement;
	inputField: HTMLTextAreaElement;
	chat: ChatSession | null = null;
	abortController: AbortController | null = null;
	isLoading = false;
	currentConversation: Conversation | null = null;
	searchQuery = '';
	showArchived = false;
	lastUserMessage = '';
	headerTitleEl: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: GeminiAgentPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.navigation = true;
		this.icon = 'gemini-sparkle';
		console.debug('Gemini: view instance created');
	}

	getViewType() {
		return VIEW_TYPE_GEMINI_CHAT;
	}

	getDisplayText() {
		return "Gemini chat";
	}

	onClose() {
		this.cancelRequest();
		return Promise.resolve();
	}

	cancelRequest() {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		this.setLoading(false);
	}

	setLoading(loading: boolean) {
		this.isLoading = loading;
		if (loading) {
			this.containerEl.addClass('is-loading');
		} else {
			this.containerEl.removeClass('is-loading');
		}
	}

	onOpen() {
		this.renderOverview();
	}

	renderOverview() {
		const container = this.contentEl;
		container.empty();
		container.addClass('gemini-chat-view-container');

		const header = container.createDiv('gemini-chat-header');
		header.createEl('h4', { text: 'Conversations' });
		
		const headerActions = header.createDiv('gemini-header-actions');
		
		const archiveToggle = headerActions.createEl('button', { 
			cls: 'clickable-icon' + (this.showArchived ? ' is-active' : ''), 
			title: 'Show archived' 
		});
		setIcon(archiveToggle, 'archive');
		archiveToggle.onclick = () => {
			this.showArchived = !this.showArchived;
			this.renderOverview();
		};

		const newChatBtn = headerActions.createEl('button', { cls: 'clickable-icon', title: 'New chat' });
		setIcon(newChatBtn, 'plus');
		newChatBtn.onclick = () => void this.startNewChat();

		const searchContainer = container.createDiv('gemini-search-container');
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search chats...',
			cls: 'gemini-search-input'
		});
		searchInput.value = this.searchQuery;
		searchInput.oninput = (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value;
			this.renderConversationList(listContainer);
		};

		const listContainer = container.createDiv('gemini-conversation-list');
		this.renderConversationList(listContainer);
	}

	renderConversationList(container: HTMLElement) {
		container.empty();
		const convs = this.plugin.conversationManager.getConversations(this.showArchived, this.searchQuery);

		if (convs.length === 0) {
			container.createDiv({ text: this.searchQuery ? 'No matches found' : 'No conversations yet', cls: 'gemini-empty-state' });
			return;
		}

		convs.forEach(conv => {
			const item = container.createDiv('gemini-conversation-item');
			if (conv.isArchived) item.addClass('is-archived');
			
			const info = item.createDiv('gemini-conv-info');
			info.createDiv({ text: conv.title, cls: 'gemini-conv-title' });
			info.createDiv({ text: new Date(conv.updatedAt).toLocaleString(), cls: 'gemini-conv-date' });
			
			info.onclick = () => void this.loadConversation(conv);

			const actions = item.createDiv('gemini-conv-actions');
			
			const archiveBtn = actions.createEl('button', { cls: 'clickable-icon', title: conv.isArchived ? 'Unarchive' : 'Archive' });
			setIcon(archiveBtn, conv.isArchived ? 'eye' : 'archive');
			archiveBtn.onclick = async (e) => {
				e.stopPropagation();
				this.plugin.conversationManager.archiveConversation(conv.id, !conv.isArchived);
				await this.plugin.saveSettings();
				this.renderConversationList(container);
			};

			const deleteBtn = actions.createEl('button', { cls: 'clickable-icon', title: 'Delete' });
			setIcon(deleteBtn, 'trash-2');
			deleteBtn.onclick = async (e) => {
				e.stopPropagation();
				this.plugin.conversationManager.deleteConversation(conv.id);
				await this.plugin.saveSettings();
				this.renderConversationList(container);
				new Notice('Conversation deleted');
			};
		});
	}

	async startNewChat() {
		this.currentConversation = this.plugin.conversationManager.createConversation();
		this.currentConversation.model = this.plugin.settings.modelName;
		await this.plugin.saveSettings();
		this.renderChatInterface();
		await this.initializeChat();
	}

	async loadConversation(conv: Conversation) {
		this.currentConversation = conv;
		this.renderChatInterface();
		
		for (const msg of conv.messages) {
			let displayContent = msg.parts[0].text;
			if (msg.role === 'user' && displayContent.includes('\nUser request: ')) {
				displayContent = displayContent.split('\nUser request: ').pop() || displayContent;
			}
			await this.appendMessage(msg.role === 'user' ? 'user' : 'agent', displayContent, false);
		}
		
		await this.initializeChat(conv.messages.map(m => ({
			role: m.role,
			parts: m.parts
		})));
	}

	renderChatInterface() {
		const container = this.contentEl;
		container.empty();

		const header = container.createDiv('gemini-chat-header');
		const backBtn = header.createEl('button', { cls: 'clickable-icon', title: 'Back to overview' });
		setIcon(backBtn, 'arrow-left');
		backBtn.onclick = () => this.renderOverview();

		this.headerTitleEl = header.createEl('h4', { text: this.currentConversation?.title || 'Gemini AI Agent', cls: 'gemini-header-title' });

		const modelSelect = header.createEl('select', { cls: 'gemini-model-select-ui' });
		this.plugin.availableModels.forEach(mId => {
			const opt = modelSelect.createEl('option', { text: MODEL_DISPLAY_NAMES[mId] || mId, value: mId });
			if (mId === (this.currentConversation?.model || this.plugin.settings.modelName)) opt.selected = true;
		});
		modelSelect.onchange = async () => {
			if (this.currentConversation) {
				this.currentConversation.model = modelSelect.value;
				await this.plugin.saveSettings();
				await this.initializeChat(this.currentConversation.messages);
			}
		};

		this.messageContainer = container.createDiv('gemini-chat-messages');
		
		const inputWrapper = container.createDiv('gemini-chat-input-wrapper');
		const inputContainer = inputWrapper.createDiv('gemini-chat-input-container');
		
		this.inputField = inputContainer.createEl('textarea', {
			placeholder: 'Ask Gemini... (use # to attach files)',
			cls: 'gemini-chat-input'
		});

		this.inputField.addEventListener('input', () => {
			this.inputField.setCssProps({ height: 'auto' });
			this.inputField.setCssProps({ height: this.inputField.scrollHeight + 'px' });
		});

		this.inputField.addEventListener('keydown', (e) => {
			if (e.key === '#') {
				setTimeout(() => {
					new FileSuggestModal(this.app, (file) => {
						const value = this.inputField.value;
						const lastHashIndex = value.lastIndexOf('#');
						this.inputField.value = value.substring(0, lastHashIndex) + `[[${file.path}]] `;
						this.inputField.focus();
						this.inputField.dispatchEvent(new Event('input'));
					}).open();
				}, 10);
			}
			
			if (e.key === 'ArrowUp' && this.inputField.value === '' && this.lastUserMessage) {
				this.inputField.value = this.lastUserMessage;
				this.inputField.dispatchEvent(new Event('input'));
			}

			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				this.handleSendMessage();
			}
		});

		const sendButton = inputContainer.createEl('button', { cls: 'gemini-send-button', title: 'Send' });
		setIcon(sendButton, 'send');
		sendButton.onclick = () => void this.handleSendMessage();
	}

	async initializeChat(history: Content[] = []) {
		if (this.plugin.genAI) {
			try {
				const modelId = this.currentConversation?.model || this.plugin.settings.modelName;
				const model = await this.plugin.getModelWithFallback(modelId);
				const modelWithTools = this.plugin.genAI.getGenerativeModel({ 
					model: model.model,
					tools: [{ functionDeclarations: toolDeclarations }]
				});

				// API only accepts 'role' and 'parts'. Strip 'timestamp' and other local fields.
				const cleanHistory = history.map(msg => ({
					role: msg.role,
					parts: msg.parts
				}));

				this.chat = modelWithTools.startChat({ history: cleanHistory });
			} catch (error) {
				await this.appendMessage('agent', `Error initializing chat: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	async handleSendMessage() {
		const originalMessage = this.inputField.value.trim();
		if (!originalMessage || this.isLoading || !this.currentConversation) return;

		this.lastUserMessage = originalMessage;

		const fileMentions = originalMessage.match(/\[\[(.*?)\]\]/g);
		let contextPrefix = '';
		
		if (fileMentions) {
			for (const mention of fileMentions) {
				const path = mention.replace('[[', '').replace(']]', '');
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile) {
					const content = await this.app.vault.cachedRead(file);
					contextPrefix += `\nContent of "${path}":\n${content}\n---\n`;
				}
			}
		}

		const finalPrompt = contextPrefix ? `${contextPrefix}\nUser request: ${originalMessage}` : originalMessage;

		await this.appendMessage('user', originalMessage);
		this.currentConversation.messages.push({
			role: 'user',
			parts: [{ text: finalPrompt }],
			timestamp: Date.now()
		});

		this.inputField.value = '';
		this.inputField.style.setProperty('height', 'auto');

		if (!this.plugin.genAI) {
			await this.appendMessage('agent', 'Error: API Key not configured.');
			return;
		}

		if (!this.chat) await this.initializeChat();
		if (!this.chat) return;

		this.setLoading(true);
		
		const randomTip = THINKING_TIPS[Math.floor(Math.random() * THINKING_TIPS.length)];
		const randomQuote = THINKING_QUOTES[Math.floor(Math.random() * THINKING_QUOTES.length)];
		
		const thinkingMsg = await this.appendMessage('agent', 'Thinking...');
		thinkingMsg.addClass('gemini-thinking-wrapper');
		const contentEl = thinkingMsg.firstElementChild as HTMLElement;
		if (contentEl) {
			contentEl.empty();
			
			const thinkingContainer = contentEl.createDiv('gemini-thinking-container');
			thinkingContainer.createDiv('gemini-thinking-shimmer').textContent = 'Gemini is processing your request...';
			
			const infoPanel = thinkingContainer.createDiv('gemini-thinking-info');
			infoPanel.createDiv('gemini-thinking-tip').textContent = randomTip;
			infoPanel.createDiv('gemini-thinking-quote').textContent = randomQuote;
			
			const toolStatus = thinkingContainer.createDiv('gemini-tool-status');

			try {
				this.abortController = new AbortController();
				let result = await this.chat.sendMessage(finalPrompt);
				let response = await result.response;
				
				let iterations = 0;
				const MAX_ITERATIONS = 5;

				while (iterations < MAX_ITERATIONS && response.candidates && response.candidates[0].content.parts.some((part: Part) => !!part.functionCall)) {
					iterations++;
					const toolResults = [];
					const excludedPaths = this.plugin.settings.excludedPaths.split(',').filter(p => p.trim() !== '');
					const tools = getObsidianTools(this.app, excludedPaths);
					
					for (const part of response.candidates[0].content.parts) {
						if (part.functionCall) {
							const name = part.functionCall.name;
							const args = part.functionCall.args;
							toolStatus.textContent = `Executing tool: ${name}...`;
							
							const toolFunction = tools[name];
							const resultText = toolFunction ? await toolFunction(args) : `Tool ${name} not found`;
							toolResults.push({
								functionResponse: { name, response: { result: resultText } }
							});
						}
					}
					result = await this.chat.sendMessage(toolResults);
					response = await result.response;
				}

				const responseText = response.text();
				thinkingMsg.remove();

				if (responseText) {
					await this.appendMessage('agent', responseText);
					this.currentConversation.messages.push({
						role: 'model',
						parts: [{ text: responseText }],
						timestamp: Date.now()
					});

					if (this.currentConversation.title === 'New Chat') {
						await this.generateAutoTitle(originalMessage, responseText);
					}
				}
				
				await this.plugin.saveSettings();
			} catch (error) {
				if (thinkingMsg) thinkingMsg.remove();
				if (error.name === 'AbortError') {
					await this.appendMessage('agent', '_Request cancelled_');
				} else {
					await this.appendMessage('agent', `**Error:** ${error.message}`);
				}
			} finally {
				this.abortController = null;
				this.setLoading(false);
			}
		}
	}

	async generateAutoTitle(userMsg: string, aiMsg: string) {
		if (!this.plugin.genAI || !this.currentConversation) return;
		try {
			const model = this.plugin.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
			const prompt = `Generiere einen sehr kurzen, prägnanten Titel (max 5 Wörter) für diesen Chat-Anfang. Gib NUR den Titel zurück, keine Anführungszeichen:\nNutzer: ${userMsg}\nKI: ${aiMsg}`;
			const result = await model.generateContent(prompt);
			const title = result.response.text().trim();
			if (title) {
				this.currentConversation.title = title;
				if (this.headerTitleEl) this.headerTitleEl.textContent = title;
				await this.plugin.saveSettings();
			}
		} catch (e) {
			console.error('Failed to generate title', e);
		}
	}

	async appendMessage(sender: 'user' | 'agent', text: string, scroll = true) {
		const msgEl = this.messageContainer.createDiv(`gemini-message gemini-message-${sender}`);
		const contentEl = msgEl.createDiv('gemini-message-content');
		
		if (sender === 'agent' && text !== 'Thinking...' && !text.includes('Gemini is processing')) {
			await MarkdownRenderer.render(this.app, text, contentEl, '', this);
			
			// Add actions for agent messages
			const actionsEl = msgEl.createDiv('gemini-message-actions');
			
			const copyBtn = actionsEl.createEl('button', { cls: 'gemini-action-btn', title: 'Copy to clipboard' });
			setIcon(copyBtn, 'copy');
			copyBtn.onclick = () => {
				navigator.clipboard.writeText(text);
				new Notice('Copied to clipboard');
			};

			const retryBtn = actionsEl.createEl('button', { cls: 'gemini-action-btn', title: 'Regenerate' });
			setIcon(retryBtn, 'refresh-cw');
			retryBtn.onclick = () => {
				// Remove last AI message and re-send last user message
				if (this.currentConversation && this.currentConversation.messages.length > 0) {
					this.currentConversation.messages.pop(); // remove last AI
					const lastUserMsg = this.currentConversation.messages.pop(); // get and remove last user
					if (lastUserMsg) {
						this.inputField.value = lastUserMsg.parts[0].text.split('\nUser request: ').pop() || lastUserMsg.parts[0].text;
						this.handleSendMessage();
					}
				}
			};
		} else {
			contentEl.textContent = text;
		}
		
		if (scroll) this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
		return msgEl;
	}
}
