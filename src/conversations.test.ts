import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationManager } from './conversations';

describe('ConversationManager', () => {
	let manager: ConversationManager;

	beforeEach(() => {
		manager = new ConversationManager({ conversations: [] });
	});

	it('should create a new conversation', () => {
		const conv = manager.createConversation('Test Chat');
		expect(conv.title).toBe('Test Chat');
		expect(conv.messages).toHaveLength(0);
		expect(manager.getConversations()).toHaveLength(1);
	});

	it('should get a specific conversation', () => {
		const conv = manager.createConversation('Find Me');
		const found = manager.getConversation(conv.id);
		expect(found?.id).toBe(conv.id);
	});

	it('should filter conversations by search query', () => {
		manager.createConversation('Hello World');
		manager.createConversation('Gemini AI');
		
		expect(manager.getConversations(false, 'hello')).toHaveLength(1);
		expect(manager.getConversations(false, 'ai')).toHaveLength(1);
		expect(manager.getConversations(false, 'xyz')).toHaveLength(0);
	});

	it('should archive and filter archived conversations', () => {
		const conv = manager.createConversation('To Archive');
		manager.archiveConversation(conv.id, true);
		
		expect(manager.getConversations(false)).toHaveLength(0);
		expect(manager.getConversations(true)).toHaveLength(1);
		
		manager.archiveConversation(conv.id, false);
		expect(manager.getConversations(false)).toHaveLength(1);
	});

	it('should delete a conversation', () => {
		const conv = manager.createConversation('To Delete');
		manager.deleteConversation(conv.id);
		expect(manager.getConversations()).toHaveLength(0);
	});

	it('should update conversation and limit messages', () => {
		const conv = manager.createConversation('Limiter');
		conv.messages = Array(30).fill({ role: 'user', parts: [], timestamp: Date.now() });
		manager.updateConversation(conv);
		
		const updated = manager.getConversation(conv.id);
		expect(updated?.messages).toHaveLength(20);
	});

	it('should handle missing conversation during archive/update', () => {
		manager.archiveConversation('non-existent', true);
		manager.updateConversation({ id: 'non-existent' } as any);
		// Should not throw
		expect(manager.getConversations()).toHaveLength(0);
	});

	it('should garbage collect old conversations', () => {
		const oldConv = manager.createConversation('Old');
		oldConv.updatedAt = Date.now() - (40 * 24 * 60 * 60 * 1000); // 40 days old
		
		manager.createConversation('New');
		
		manager.garbageCollect(50, 30); // Max 30 days
		
		expect(manager.getConversations()).toHaveLength(1);
		expect(manager.getConversations()[0].title).toBe('New');
	});

	it('should garbage collect by count limit', () => {
		for (let i = 0; i < 60; i++) {
			manager.createConversation(`Chat ${i}`);
		}
		
		manager.garbageCollect(50, 100);
		expect(manager.toJSON()).toHaveLength(50);
	});

	it('should keep archived conversations during garbage collect', () => {
		const archived = manager.createConversation('Archived Old');
		archived.isArchived = true;
		archived.updatedAt = Date.now() - (100 * 24 * 60 * 60 * 1000);
		
		manager.garbageCollect(10, 30);
		expect(manager.toJSON()).toContain(archived);
	});
});
