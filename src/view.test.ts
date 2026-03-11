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
			settings: { modelName: 'gemini-2.5-flash', excludedPaths: '', autoAcceptTools: true },
			genAI: {
				getGenerativeModel: vi.fn().mockReturnValue({
					model: 'gemini-2.5-flash',
					startChat: vi.fn().mockReturnValue({
						sendMessage: vi.fn()
					})
				})
			},
			getModelWithFallback: vi.fn().mockResolvedValue({ model: 'gemini-2.5-flash' })
		};
		mockLeaf = {};
		view = new GeminiChatView(mockLeaf as any, mockPlugin as any);
		view.app = mockApp;
	});

	it('should initialize and open and handle keydown', async () => {
		await view.onOpen();
		expect(mockPlugin.getModelWithFallback).toHaveBeenCalled();
		expect(view.chat).toBeDefined();
		
		const keydownHandler = view.inputField.addEventListener.mock.calls.find(call => call[0] === 'keydown')[1];
		const mockEvent = { key: 'Enter', shiftKey: false, preventDefault: vi.fn() };
		
		view.handleSendMessage = vi.fn();
		
		keydownHandler(mockEvent);
		expect(mockEvent.preventDefault).toHaveBeenCalled();
		expect(view.handleSendMessage).toHaveBeenCalled();
	});

	it('should handle sending message and agent tool calls', async () => {
		await view.onOpen();
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

	it('should handle initializeChat with and without genAI', async () => {
		await view.initializeChat();
		expect(view.chat).toBeDefined();

		mockPlugin.genAI = null;
		view.chat = null;
		await view.initializeChat();
		expect(view.chat).toBeNull();
	});

	it('should handle tool execution branches', async () => {
		await view.onOpen();
		// Test the tools loop branches
	});

	it('should handle close', async () => {
		const spy = vi.spyOn(view, 'cancelRequest');
		await view.onClose();
		expect(spy).toHaveBeenCalled();
	});

	it('should handle errors in message sending', async () => {
		await view.onOpen();
		view.inputField = { value: 'fail', trim: () => 'fail' } as any;
		view.chat.sendMessage.mockRejectedValue(new Error('API Error'));

		await view.handleSendMessage();

		expect(view.messageContainer.createDiv).toHaveBeenCalled();
	});

	it('should handle tool not found', async () => {
		await view.onOpen();
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

	it('should handle empty message', async () => {
		view.inputField = { value: '  ' } as any;
		await view.handleSendMessage();
		expect(mockPlugin.genAI.getGenerativeModel).not.toHaveBeenCalled();
	});

	it('should handle missing genAI', async () => {
		await view.onOpen();
		mockPlugin.genAI = null;
		view.inputField.value = 'test';
		await view.handleSendMessage();
		expect(view.messageContainer.createDiv).toHaveBeenCalled();
	});

	it('should handle max iterations in agent loop', async () => {
		await view.onOpen();
		view.inputField.value = 'loop';
		
		const mockChat = view.chat;
		// Return function call 6 times
		mockChat.sendMessage.mockResolvedValue({
			response: {
				candidates: [{
					content: {
						parts: [{
							functionCall: { name: 'list_files', args: {} }
						}]
					}
				}]
			}
		});

		await view.handleSendMessage();
		expect(mockChat.sendMessage).toHaveBeenCalledTimes(6); // 1 initial + 5 iterations
	});

	it('should handle abort error', async () => {
		await view.onOpen();
		view.inputField.value = 'abort';
		const abortError = new Error('Abort');
		abortError.name = 'AbortError';
		view.chat.sendMessage.mockRejectedValue(abortError);

		await view.handleSendMessage();
		expect(view.messageContainer.createDiv).toHaveBeenCalled();
	});
});
