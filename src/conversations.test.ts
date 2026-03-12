import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationManager, Conversation } from './conversations';

describe('ConversationManager', () => {
	let manager: ConversationManager;
	let mockSettings: { conversations: Conversation[] };

	beforeEach(() => {
		mockSettings = { conversations: [] };
		manager = new ConversationManager(mockSettings);
	});

	it('should create a new conversation', () => {
		const conv = manager.createConversation('Test');
		expect(conv.title).toBe('Test');
		expect(conv.messages).toEqual([]);
		expect(manager.getConversations().length).toBe(1);
	});

	it('should get a conversation by id', () => {
		const conv = manager.createConversation();
		expect(manager.getConversation(conv.id)).toBe(conv);
	});

	it('should update a conversation', () => {
		const conv = manager.createConversation('Old');
		conv.title = 'New';
		manager.updateConversation(conv);
		expect(manager.getConversation(conv.id)?.title).toBe('New');
	});

	it('should delete a conversation', () => {
		const conv = manager.createConversation();
		manager.deleteConversation(conv.id);
		expect(manager.getConversations().length).toBe(0);
	});

	it('should archive and unarchive', () => {
		const conv = manager.createConversation();
		manager.archiveConversation(conv.id, true);
		expect(manager.getConversations(true).length).toBe(1);
		expect(manager.getConversations(false).length).toBe(0);

		manager.archiveConversation(conv.id, false);
		expect(manager.getConversations(true).length).toBe(0);
		expect(manager.getConversations(false).length).toBe(1);
	});

	it('should filter by query', () => {
		manager.createConversation('Apple');
		manager.createConversation('Banana');
		expect(manager.getConversations(false, 'app').length).toBe(1);
		expect(manager.getConversations(false, 'ana').length).toBe(1);
	});

	it('should garbage collect old empty chats', () => {
		const oldEmpty = manager.createConversation('Old');
		oldEmpty.updatedAt = Date.now() - 40 * 24 * 60 * 60 * 1000;
		
		const oldWithMessages = manager.createConversation('Old with msg');
		oldWithMessages.updatedAt = Date.now() - 40 * 24 * 60 * 60 * 1000;
		oldWithMessages.messages.push({ role: 'user', parts: [{ text: 'hi' }], timestamp: Date.now() });

		manager.garbageCollect();
		const convs = manager.getConversations();
		expect(convs.find(c => c.id === oldEmpty.id)).toBeUndefined();
		expect(convs.find(c => c.id === oldWithMessages.id)).toBeDefined();
	});

	it('should handle non-existent update', () => {
		const initialCount = manager.getConversations().length;
		manager.updateConversation({ id: 'non-existent', title: '', messages: [], model: '', updatedAt: 0 });
		expect(manager.getConversations().length).toBe(initialCount);
	});
});
