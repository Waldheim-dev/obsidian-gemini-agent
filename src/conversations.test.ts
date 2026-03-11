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
	});

	it('should delete a conversation', () => {
		const conv = manager.createConversation('To Delete');
		manager.deleteConversation(conv.id);
		expect(manager.getConversations()).toHaveLength(0);
	});
});
