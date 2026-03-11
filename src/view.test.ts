import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiChatView } from './view';

describe('GeminiChatView', () => {
	let view: GeminiChatView;
	let mockPlugin: any;
	let mockLeaf: any;
	let mockApp: any;

	beforeEach(() => {
		mockApp = {
			vault: { 
				getAbstractFileByPath: vi.fn(), 
				read: vi.fn(), 
				modify: vi.fn(),
				create: vi.fn(),
				cachedRead: vi.fn()
			},
			metadataCache: { getFileCache: vi.fn() }
		};
		mockPlugin = {
			settings: { modelName: 'auto', excludedPaths: '', autoAcceptTools: true },
			availableModels: ['auto', 'gemini-1.5-flash'],
			genAI: {
				getGenerativeModel: vi.fn().mockReturnValue({
					model: 'gemini-1.5-flash',
					generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'Title' } }),
					startChat: vi.fn().mockReturnValue({
						sendMessage: vi.fn()
					})
				})
			},
			getModelWithFallback: vi.fn().mockResolvedValue({ model: 'gemini-1.5-flash' }),
			logToFile: vi.fn().mockResolvedValue(undefined),
			saveSettings: vi.fn().mockResolvedValue(undefined),
			conversationManager: {
				getConversations: vi.fn().mockReturnValue([]),
				createConversation: vi.fn().mockReturnValue({ id: '1', title: 'New Chat', messages: [] }),
				archiveConversation: vi.fn(),
				deleteConversation: vi.fn()
			}
		};
		mockLeaf = {};
		view = new GeminiChatView(mockLeaf as any, mockPlugin as any);
		view.app = mockApp;
	});

	it('should render overview on open', async () => {
		view.contentEl.querySelector = vi.fn().mockReturnValue({ textContent: 'Conversations' });
		await view.onOpen();
		expect(mockPlugin.conversationManager.getConversations).toHaveBeenCalled();
		expect(view.contentEl.querySelector('h4').textContent).toBe('Conversations');
	});

	it('should start a new chat', async () => {
		await view.startNewChat();
		expect(mockPlugin.conversationManager.createConversation).toHaveBeenCalled();
		expect(view.currentConversation).toBeDefined();
		expect(view.inputField).toBeDefined();
	});

	it('should handle sending message and agent tool calls', async () => {
		await view.startNewChat();
		view.inputField.value = 'Create a note';
		
		const mockChat = view.chat;
		mockChat.sendMessage.mockResolvedValueOnce({
			response: {
				candidates: [{
					content: {
						parts: [{
							functionCall: {
								name: 'create_note',
								args: { path: 'test.md', content: 'hello' }
							}
						}]
					}
				}]
			}
		}).mockResolvedValueOnce({
			response: {
				candidates: [{
					content: {
						parts: [{ text: 'Note created!' }]
					}
				}],
				text: () => 'Note created!'
			}
		});

		mockApp.vault.create = vi.fn().mockResolvedValue({ path: 'test.md' });

		await view.handleSendMessage();

		expect(mockChat.sendMessage).toHaveBeenCalledTimes(2);
		expect(view.messageContainer.createDiv).toHaveBeenCalled();
	});

	it('should handle cancel request', () => {
		view.abortController = new AbortController();
		const abortSpy = vi.spyOn(view.abortController, 'abort');
		view.cancelRequest();
		expect(abortSpy).toHaveBeenCalled();
		expect(view.abortController).toBeNull();
	});

	it('should handle errors in message sending', async () => {
		await view.startNewChat();
		view.inputField.value = 'fail';
		view.chat.sendMessage.mockRejectedValue(new Error('API Error'));

		await view.handleSendMessage();
		expect(view.messageContainer.createDiv).toHaveBeenCalled();
	});

	it('should handle tool not found', async () => {
		await view.startNewChat();
		view.inputField.value = 'unknown tool';
		const mockChat = view.chat;
		mockChat.sendMessage.mockResolvedValueOnce({
			response: {
				candidates: [{
					content: {
						parts: [{
							functionCall: {
								name: 'non_existent_tool',
								args: {}
							}
						}]
					}
				}]
			}
		}).mockResolvedValueOnce({
			response: { candidates: [{ content: { parts: [{ text: 'done' }] } }], text: () => 'done' }
		});

		await view.handleSendMessage();
		expect(mockChat.sendMessage).toHaveBeenCalledTimes(2);
	});

	it('should handle missing genAI', async () => {
		await view.startNewChat();
		mockPlugin.genAI = null;
		view.inputField.value = 'test';
		await view.handleSendMessage();
		expect(view.messageContainer.createDiv).toHaveBeenCalled();
	});

	it('should handle max iterations in agent loop', async () => {
		await view.startNewChat();
		view.inputField.value = 'loop';
		
		const mockChat = view.chat;
		mockChat.sendMessage.mockResolvedValue({
			response: {
				candidates: [{
					content: {
						parts: [{
							functionCall: { name: 'list_files', args: {} }
						}]
					}
				}],
				text: () => 'looping'
			}
		});

		await view.handleSendMessage();
		expect(mockChat.sendMessage).toHaveBeenCalledTimes(6);
	});
});
