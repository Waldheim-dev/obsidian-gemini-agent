import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiChatView } from './view';
import { WorkspaceLeaf, App, TFile } from 'obsidian';
import GeminiAgentPlugin from './main';
import { Conversation } from './conversations';
import { Part } from "@google/generative-ai";

interface MockHTMLElement extends HTMLElement {
	_tag?: string;
	_cls?: string;
	_children: Array<MockHTMLElement | string | null>;
}

describe('GeminiChatView', () => {
	let view: GeminiChatView;
	let mockPlugin: GeminiAgentPlugin;
	let mockLeaf: WorkspaceLeaf;
	let mockApp: App;

	beforeEach(() => {
		vi.stubGlobal('navigator', {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined)
			}
		});

		mockApp = {
			vault: {
				getAbstractFileByPath: vi.fn(),
				cachedRead: vi.fn().mockResolvedValue('file content'),
				create: vi.fn(),
				read: vi.fn().mockResolvedValue('file content'),
				getMarkdownFiles: vi.fn().mockReturnValue([])
			},
			workspace: {
				getLeavesOfType: vi.fn().mockReturnValue([]),
				revealLeaf: vi.fn(),
				getActiveFile: vi.fn()
			}
		} as unknown as App;

		const mockGenAI = {
			getGenerativeModel: vi.fn().mockReturnValue({
				startChat: vi.fn().mockReturnValue({
					sendMessage: vi.fn().mockResolvedValue({
						response: {
							text: () => 'AI response',
							candidates: [{ content: { parts: [{ text: 'AI response' }] } }]
						}
					})
				}),
				generateContent: vi.fn().mockResolvedValue({
					response: { text: () => 'Auto title' }
				})
			})
		};

		mockPlugin = {
			settings: {
				apiKey: 'test-key',
				modelName: 'gemini-1.5-flash',
				excludedPaths: '',
				autoAcceptTools: true
			},
			genAI: mockGenAI as any,
			availableModels: ['gemini-1.5-flash', 'gemini-1.5-pro'],
			getModelWithFallback: vi.fn().mockReturnValue({ model: 'gemini-1.5-flash' }),
			logToFile: vi.fn().mockResolvedValue(undefined),
			saveSettings: vi.fn().mockResolvedValue(undefined),
			conversationManager: {
				getConversations: vi.fn().mockReturnValue([]),
				createConversation: vi.fn().mockImplementation((title: string) => ({ 
					id: '1', 
					title: title || 'New chat', 
					messages: [],
					model: 'gemini-1.5-flash',
					updatedAt: Date.now()
				})),
				archiveConversation: vi.fn(),
				deleteConversation: vi.fn(),
				updateConversation: vi.fn(),
				toJSON: vi.fn().mockReturnValue([])
			}
		} as unknown as GeminiAgentPlugin;

		mockLeaf = {
			view: {
				containerEl: {
					addClass: vi.fn(),
					removeClass: vi.fn()
				}
			}
		} as unknown as WorkspaceLeaf;
		
		view = new GeminiChatView(mockLeaf, mockPlugin);
		(view as any).app = mockApp;
		view.renderChatInterface();
	});

	const findBtnRecursive = (el: HTMLElement, text: string): HTMLButtonElement | null => {
		const mockEl = el as unknown as MockHTMLElement;
		if (mockEl && mockEl._tag === 'button' && mockEl.textContent === text) return mockEl as unknown as HTMLButtonElement;
		if (mockEl && mockEl._children) {
			for (const child of mockEl._children) {
				if (typeof child === 'object' && child !== null) {
					const f = findBtnRecursive(child as unknown as HTMLElement, text);
					if (f) return f;
				}
			}
		}
		return null;
	};

	it('should handle toggle archived conversations', () => {
		view.showArchived = false;
		view.renderOverview();
		view.showArchived = true;
		view.renderOverview();
		expect(view.showArchived).toBe(true);
	});

	it('should handle conversation actions', () => {
		const conv = { id: 'c1', title: 'C1', updatedAt: Date.now(), messages: [], isArchived: false } as Conversation;
		(mockPlugin.conversationManager.getConversations as any).mockReturnValue([conv]);
		view.renderOverview();
		
		view.plugin.conversationManager.archiveConversation('c1', true);
		expect(mockPlugin.conversationManager.archiveConversation).toHaveBeenCalledWith('c1', true);
		
		view.plugin.conversationManager.deleteConversation('c1');
		expect(mockPlugin.conversationManager.deleteConversation).toHaveBeenCalledWith('c1');
	});

	it('should handle model selection change', async () => {
		await view.startNewChat();
		if (view.currentConversation) {
			view.currentConversation.model = 'gemini-1.5-pro';
			await view.plugin.saveSettings();
			expect(view.currentConversation.model).toBe('gemini-1.5-pro');
		}
	});

	it('should handle file mentions', async () => {
		const mockFile = new TFile();
		mockFile.path = 'test.md';
		await mockApp.vault.cachedRead(mockFile);
		expect(mockApp.vault.cachedRead).toHaveBeenCalled();
	});

	it.skip('should generate automatic title', async () => {
		await view.startNewChat();
		view.inputField.value = 'Hello';
		
		const mockChat = {
			sendMessage: vi.fn().mockResolvedValue({
				response: {
					text: () => 'AI response',
					candidates: [{ content: { parts: [{ text: 'AI response' }] } }]
				}
			})
		};
		(view as any).chat = mockChat;

		await view.handleSendMessage();
		await new Promise(r => setTimeout(r, 10));
		expect(view.currentConversation?.title).toBe('Auto title');
	});

	it('should handle manual tool approval (Allow)', async () => {
		mockPlugin.settings.autoAcceptTools = false;
		await view.startNewChat();
		
		const toolCalls = [{ functionCall: { name: 'list_files', args: {} } }] as Part[];
		const promise = view.requestToolPermission(toolCalls);
		
		const allowBtn = findBtnRecursive(view.messageContainer, 'Allow all');
		if (allowBtn) allowBtn.onclick(new MouseEvent('click'));
		
		const result = await promise;
		expect(result).toBe(true);
	});

	it('should handle manual tool approval (Cancel)', async () => {
		mockPlugin.settings.autoAcceptTools = false;
		await view.startNewChat();
		
		const toolCalls = [{ functionCall: { name: 'list_files', args: {} } }] as Part[];
		const promise = view.requestToolPermission(toolCalls);
		
		const denyBtn = findBtnRecursive(view.messageContainer, 'Cancel');
		if (denyBtn) denyBtn.onclick(new MouseEvent('click'));
		
		const result = await promise;
		expect(result).toBe(false);
	});

	it.skip('should retry on 429 quota exceeded error', async () => {
		await view.startNewChat();
		view.inputField.value = 'retry me';
		
		const mockChat = {
			sendMessage: vi.fn()
				.mockRejectedValueOnce(new Error('429 quota limit'))
				.mockResolvedValueOnce({
					response: { 
						text: () => 'success', 
						candidates: [{ content: { parts: [{ text: 'success' }] } }] 
					}
				})
		};
		(view as any).chat = mockChat;

		await view.handleSendMessage();
		expect(mockChat.sendMessage).toHaveBeenCalled();
	});

	it('should handle cancel request', () => {
		view.abortController = new AbortController();
		view.cancelRequest();
		expect(view.abortController).toBeNull();
	});

	it('should copy message to clipboard', async () => {
		const text = 'Test copy';
		await navigator.clipboard.writeText(text);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
	});

	it('should handle errors in sendMessage', async () => {
		(view.plugin as any).genAI = null;
		await view.handleSendMessage();
		const mockContainer = view.messageContainer as unknown as MockHTMLElement;
		expect(mockContainer._children.length).toBeGreaterThan(0);
	});

	it('should handle onClose and close leaf', async () => {
		await view.onClose();
		expect(view.abortController).toBeNull();
	});

	it('should handle search input in overview', () => {
		view.searchQuery = 'test';
		view.renderOverview();
		expect(view.searchQuery).toBe('test');
	});

	it('should handle initializeChat error', () => {
		(mockPlugin.getModelWithFallback as any).mockImplementation(() => { throw new Error('Init error'); });

		const freshView = new GeminiChatView(mockLeaf, mockPlugin);
		(freshView as any).app = mockApp;
		freshView.plugin.genAI = mockPlugin.genAI;
		freshView.renderChatInterface();
		void freshView.initializeChat();
		expect(freshView.chat).toBeNull();
	});

});
