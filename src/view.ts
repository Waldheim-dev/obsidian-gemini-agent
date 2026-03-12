import { ItemView, WorkspaceLeaf, MarkdownRenderer, TFile, setIcon, Notice } from 'obsidian';
import GeminiAgentPlugin, { MODEL_DISPLAY_NAMES, VIEW_TYPE_GEMINI_CHAT } from './main';
import { getObsidianTools, toolDeclarations } from './tools';
import { Conversation } from './conversations';
import { FileSuggestModal } from './suggest';
import { ChatSession, Content, Part } from "@google/generative-ai";

const THINKING_TIPS = [
	"Tip: use # to attach a file for more context.",
	"Did you know? Gemini can create and edit Obsidian canvas files.",
	"Idea: ask Gemini to summarize your meeting notes.",
	"Tip: you can exclude sensitive folders in the plugin settings.",
	"Did you know? Gemini 1.5 pro has a massive context window.",
	"Idea: ask for a mind-map based on your current project.",
	"Tip: use @mention logic coming soon for even better workflow.",
	"Pro-tip: clear chat frequently to keep the context focused."
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
	headerTitleEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GeminiAgentPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.navigation = true;
		this.icon = 'gemini-sparkle';
		console.debug('Gemini: view instance created');
	}

	getViewType(): string {
		return VIEW_TYPE_GEMINI_CHAT;
	}

	getDisplayText(): string {
		return "Gemini chat";
	}

	async onClose(): Promise<void> {
		this.cancelRequest();
		return Promise.resolve();
	}

	async onOpen(): Promise<void> {
		this.renderOverview();
	}

	cancelRequest = (): void => {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		this.setLoading(false);
	};

	setLoading = (loading: boolean): void => {
		this.isLoading = loading;
		if (loading) {
			this.containerEl.addClass('is-loading');
		} else {
			this.containerEl.removeClass('is-loading');
		}
	};

	renderOverview = (): void => {
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
		newChatBtn.onclick = () => {
			void this.startNewChat();
		};

		const searchContainer = container.createDiv('gemini-search-container');
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search chats...',
			cls: 'gemini-search-input'
		});
		searchInput.value = this.searchQuery;
		searchInput.oninput = (e: Event) => {
			const target = e.target;
			if (target instanceof HTMLInputElement) {
				this.searchQuery = target.value;
				this.renderConversationList(listContainer);
			}
		};

		const listContainer = container.createDiv('gemini-conversation-list');
		this.renderConversationList(listContainer);
	};

	renderConversationList = (container: HTMLElement): void => {
		container.empty();
		if (!this.plugin.conversationManager) return;
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
			
			info.onclick = () => {
				void this.loadConversation(conv);
			};

			const actions = item.createDiv('gemini-conv-actions');
			
			const archiveBtn = actions.createEl('button', { cls: 'clickable-icon', title: conv.isArchived ? 'Unarchive' : 'Archive' });
			setIcon(archiveBtn, conv.isArchived ? 'eye' : 'archive');
			archiveBtn.onclick = (e: MouseEvent) => {
				e.stopPropagation();
				if (this.plugin.conversationManager) {
					this.plugin.conversationManager.archiveConversation(conv.id, !conv.isArchived);
					void this.plugin.saveSettings().then(() => {
						this.renderConversationList(container);
					});
				}
			};

			const deleteBtn = actions.createEl('button', { cls: 'clickable-icon', title: 'Delete' });
			setIcon(deleteBtn, 'trash-2');
			deleteBtn.onclick = (e: MouseEvent) => {
				e.stopPropagation();
				if (this.plugin.conversationManager) {
					this.plugin.conversationManager.deleteConversation(conv.id);
					void this.plugin.saveSettings().then(() => {
						this.renderConversationList(container);
						new Notice('Conversation deleted');
					});
				}
			};
		});
	};

	startNewChat = async (): Promise<void> => {
		if (this.plugin.conversationManager) {
			this.currentConversation = this.plugin.conversationManager.createConversation('New chat');
			this.currentConversation.model = this.plugin.settings.modelName;
			await this.plugin.saveSettings();
			this.renderChatInterface();
			await this.initializeChat();
		}
	};

	loadConversation = async (conv: Conversation): Promise<void> => {
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
	};

	renderChatInterface = (): void => {
		const container = this.contentEl;
		container.empty();

		const header = container.createDiv('gemini-chat-header');
		const backBtn = header.createEl('button', { cls: 'clickable-icon', title: 'Back to overview' });
		setIcon(backBtn, 'arrow-left');
		backBtn.onclick = () => this.renderOverview();

		this.headerTitleEl = header.createEl('h4', { text: this.currentConversation?.title || 'Gemini AI agent', cls: 'gemini-header-title' });

		const modelSelect = header.createEl('select', { cls: 'gemini-model-select-ui' });
		this.plugin.availableModels.forEach(mId => {
			const opt = modelSelect.createEl('option', { text: MODEL_DISPLAY_NAMES[mId] || mId, value: mId });
			if (mId === (this.currentConversation?.model || this.plugin.settings.modelName)) opt.selected = true;
		});
		modelSelect.onchange = () => {
			if (this.currentConversation) {
				this.currentConversation.model = modelSelect.value;
				void this.plugin.saveSettings().then(() => {
					void this.initializeChat(this.currentConversation?.messages);
				});
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
			this.inputField.setCssProps({ height: `${this.inputField.scrollHeight}px` });
		});

		this.inputField.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === '#') {
				setTimeout(() => {
					new FileSuggestModal(this.app, (file) => {
						const value = this.inputField.value;
						const lastHashIndex = value.lastIndexOf('#');
						this.inputField.value = `${value.substring(0, lastHashIndex)}[[${file.path}]] `;
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
				void this.handleSendMessage();
			}
		});

		const sendButton = inputContainer.createEl('button', { cls: 'gemini-send-button', title: 'Send' });
		setIcon(sendButton, 'send');
		sendButton.onclick = () => {
			void this.handleSendMessage();
		};
	};

	initializeChat = async (history: Content[] = []): Promise<void> => {
		if (this.plugin.genAI) {
			try {
				const modelId = this.currentConversation?.model || this.plugin.settings.modelName;
				const model = this.plugin.getModelWithFallback(modelId);

				const systemInstruction = `You are a professional, autonomous AI agent integrated into an Obsidian vault. 
Your goal is to help the user manage their knowledge effectively. 

Capabilities & autonomy:
1. Proactive exploration: If you need more context to answer a question, use 'list_files', 'global_search', or 'read_note' immediately without asking for permission.
2. Organization: When the user asks to "organize", "save", or "research" something, proactively decide to create folders, create notes, or update existing ones.
3. Structure awareness: Always keep track of the vault structure. If a task involves multiple files, read them all to ensure consistency.
4. Tool usage: You have access to specialized Obsidian tools. Use them strategically to perform actions directly in the vault. 

Guidelines:
- If a request is ambiguous, explore the vault first to find relevant information.
- When creating notes, use clean markdown and appropriate tags.
- Be concise but thorough. 
- You act on behalf of the user; if they give you a task that implies vault modification (e.g., "Summarize my meetings from last week into a new note"), do it directly.`;

				const modelWithTools = this.plugin.genAI.getGenerativeModel({ 
					model: model.model,
					tools: [{ functionDeclarations: toolDeclarations }],
					systemInstruction: {
						role: 'system',
						parts: [{ text: systemInstruction }]
					}
				});

				// API only accepts 'role' and 'parts'. Strip 'timestamp' and other local fields.
				const cleanHistory = history.map(msg => ({
					role: msg.role,
					parts: msg.parts
				}));

				this.chat = modelWithTools.startChat({ history: cleanHistory });
			} catch (error) {
				this.chat = null;
				await this.appendMessage('agent', `Error initializing chat: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	};

	handleSendMessage = async (): Promise<void> => {
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
		this.inputField.setCssProps({ height: 'auto' });

		if (!this.plugin.genAI) {
			await this.appendMessage('agent', 'Error: API key not configured.');
			return;
		}

		if (!this.chat) await this.initializeChat();
		if (!this.chat) return;

		this.setLoading(true);
		
		const randomTip = THINKING_TIPS[Math.floor(Math.random() * THINKING_TIPS.length)];
		const randomQuote = THINKING_QUOTES[Math.floor(Math.random() * THINKING_QUOTES.length)];
		
		const thinkingMsg = await this.appendMessage('agent', 'Thinking...');
		thinkingMsg.addClass('gemini-thinking-wrapper');
		const firstChild = thinkingMsg.firstElementChild;
		if (firstChild instanceof HTMLElement) {
			firstChild.empty();
			
			const thinkingContainer = firstChild.createDiv('gemini-thinking-container');
			thinkingContainer.createDiv('gemini-thinking-shimmer').textContent = 'Gemini is processing your request...';
			
			const infoPanel = thinkingContainer.createDiv('gemini-thinking-info');
			infoPanel.createDiv('gemini-thinking-tip').textContent = randomTip;
			infoPanel.createDiv('gemini-thinking-quote').textContent = randomQuote;
			
			const toolStatus = thinkingContainer.createDiv('gemini-tool-status');

			try {
				this.abortController = new AbortController();
				
				let result;
				let response;
				let retryCount = 0;
				const MAX_RETRIES = 2;

				const sendWithRetry = async (prompt: string | Part[] | Array<{ functionResponse: { name: string; response: { result: string } } }>): Promise<{ response: { text: () => string; candidates?: Array<{ content: { parts: Part[] } }> } }> => {
					while (retryCount <= MAX_RETRIES) {
						try {
							return await this.chat!.sendMessage(prompt);
						} catch (error) {
							const errorText = String(error);
							if (errorText.includes('429') || errorText.includes('quota')) {
								if (errorText.includes('limit: 0')) {
									throw new Error("Quota exceeded: daily limit reached for this model. Try switching to a different model (e.g., Gemini 1.5 Flash).", { cause: error });
								}

								retryCount++;
								if (retryCount <= MAX_RETRIES) {
									let delay = 22000; // Default 22s
									const match = errorText.match(/retryDelay":"(\d+)s/);
									if (match) delay = parseInt(match[1]) * 1000 + 1000;
									
									let secondsLeft = Math.round(delay/1000);
									const interval = setInterval(() => {
										secondsLeft--;
										if (secondsLeft > 0) {
											toolStatus.textContent = `Quota exceeded. Retrying in ${secondsLeft}s... (Attempt ${retryCount}/${MAX_RETRIES})`;
										} else {
											clearInterval(interval);
										}
									}, 1000);

									toolStatus.textContent = `Quota exceeded. Retrying in ${secondsLeft}s... (Attempt ${retryCount}/${MAX_RETRIES})`;
									await new Promise(resolve => setTimeout(resolve, delay));
									clearInterval(interval);
									continue;
								}
							}
							throw error;
						}
					}
					throw new Error("Max retries exceeded for quota limit.");
				};

				result = await sendWithRetry(finalPrompt);
				response = await result.response;
				
				let iterations = 0;
				const MAX_ITERATIONS = 5;

				while (iterations < MAX_ITERATIONS && response.candidates && response.candidates[0].content.parts.some((part: Part) => !!part.functionCall)) {
					iterations++;
					
					const toolCalls = response.candidates[0].content.parts.filter((p: Part) => !!p.functionCall);
					
					if (!this.plugin.settings.autoAcceptTools) {
						this.setLoading(false);
						const allowed = await this.requestToolPermission(toolCalls);
						this.setLoading(true);
						
						if (!allowed) {
							const toolResults = toolCalls.map((part: Part) => ({
								functionResponse: { 
									name: part.functionCall!.name, 
									response: { result: "Error: user denied permission to execute this tool." } 
								}
							}));
							result = await sendWithRetry(toolResults);
							response = await result.response;
							continue;
						}
					}

					const toolResults = [];
					const excludedPaths = this.plugin.settings.excludedPaths.split(',').filter(p => p.trim() !== '');
					const tools = getObsidianTools(this.app, excludedPaths);
					
					for (const part of toolCalls) {
						if (part.functionCall) {
							const name = part.functionCall.name;
							const args = part.functionCall.args;
							toolStatus.textContent = `Executing tool: ${name}...`;
							
							const toolFunction = tools[name];
							const resultText = toolFunction ? await toolFunction(args as Record<string, unknown>) : `Tool ${name} not found`;
							toolResults.push({
								functionResponse: { name, response: { result: resultText } }
							});
						}
					}
					result = await sendWithRetry(toolResults);
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

					if (this.currentConversation.title === 'New chat') {
						await this.generateAutoTitle(originalMessage, responseText);
					}
				}
				
				await this.plugin.saveSettings();
			} catch (error) {
				if (thinkingMsg) thinkingMsg.remove();
				if (error instanceof Error && error.name === 'AbortError') {
					await this.appendMessage('agent', '_Request cancelled_');
				} else {
					const errorMsg = error instanceof Error ? error.message : String(error);
					await this.appendMessage('agent', `**Error:** ${errorMsg}`);
				}
			} finally {
				this.abortController = null;
				this.setLoading(false);
			}
		}
	};

	generateAutoTitle = async (userMsg: string, aiMsg: string): Promise<void> => {
		if (!this.plugin.genAI || !this.currentConversation) return;
		try {
			const model = this.plugin.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
			const prompt = `Generiere einen sehr kurzen, prägnanten Titel (max 5 Wörter) für dieser Chat-Anfang. Gib NUR den Titel zurück, keine Anführungszeichen:\nNutzer: ${userMsg}\nKI: ${aiMsg}`;
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
	};

	requestToolPermission = (toolCalls: Part[]): Promise<boolean> => {
		return new Promise((resolve) => {
			const permissionEl = this.messageContainer.createDiv('gemini-tool-permission-card');
			permissionEl.createDiv({ text: 'The agent wants to execute the following tools:', cls: 'gemini-permission-header' });

			const callsList = permissionEl.createDiv('gemini-permission-calls');
			toolCalls.forEach(part => {
				if (part.functionCall) {
					const callItem = callsList.createDiv('gemini-permission-item');
					callItem.createSpan({ text: part.functionCall.name, cls: 'gemini-tool-name' });
					const argsText = JSON.stringify(part.functionCall.args, null, 2);
					callItem.createEl('pre', { text: argsText, cls: 'gemini-tool-args' });
				}
			});

			const actions = permissionEl.createDiv('gemini-permission-actions');
			const allowBtn = actions.createEl('button', { text: 'Allow all', cls: 'mod-cta' });
			const denyBtn = actions.createEl('button', { text: 'Cancel' });

			this.messageContainer.scrollTop = this.messageContainer.scrollHeight;

			allowBtn.onclick = () => {
				permissionEl.remove();
				resolve(true);
			};

			denyBtn.onclick = () => {
				permissionEl.remove();
				resolve(false);
			};
		});
	};

	appendMessage = async (sender: 'user' | 'agent', text: string, scroll = true): Promise<HTMLElement> => {
		const msgEl = this.messageContainer.createDiv(`gemini-message gemini-message-${sender}`);
		const contentEl = msgEl.createDiv('gemini-message-content');
		
		if (sender === 'agent' && text !== 'Thinking...' && !text.includes('Gemini is processing')) {
			await MarkdownRenderer.render(this.app, text, contentEl, '', this);
			
			// Add actions for agent messages
			const actionsEl = msgEl.createDiv('gemini-message-actions');
			
			const copyBtn = actionsEl.createEl('button', { cls: 'gemini-action-btn', title: 'Copy to clipboard' });
			setIcon(copyBtn, 'copy');
			copyBtn.onclick = () => {
				void navigator.clipboard.writeText(text).then(() => {
					new Notice('Copied to clipboard');
				});
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
						void this.handleSendMessage();
					}
				}
			};
		} else {
			contentEl.textContent = text;
		}
		
		if (scroll) this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
		return msgEl;
	};
}
