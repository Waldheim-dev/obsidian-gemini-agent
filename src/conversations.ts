import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
	role: 'user' | 'model';
	parts: any[];
	timestamp: number;
}

export interface Conversation {
	id: string;
	title: string;
	messages: ChatMessage[];
	updatedAt: number;
	isArchived: boolean;
	model?: string;
}

export class ConversationManager {
	private conversations: Conversation[] = [];

	constructor(data: any) {
		if (data && Array.isArray(data.conversations)) {
			this.conversations = data.conversations;
		}
	}

	createConversation(title: string = 'New Chat'): Conversation {
		const newConv: Conversation = {
			id: uuidv4(),
			title,
			messages: [],
			updatedAt: Date.now(),
			isArchived: false
		};
		this.conversations.unshift(newConv);
		return newConv;
	}

	getConversations(includeArchived = false, search = ''): Conversation[] {
		return this.conversations
			.filter(c => (includeArchived || !c.isArchived))
			.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
			.sort((a, b) => b.updatedAt - a.updatedAt);
	}

	getConversation(id: string): Conversation | undefined {
		return this.conversations.find(c => c.id === id);
	}

	updateConversation(conv: Conversation) {
		const index = this.conversations.findIndex(c => c.id === conv.id);
		if (index !== -1) {
			conv.updatedAt = Date.now();
			// Limit message history to last 20 messages (Context Shrinking)
			if (conv.messages.length > 20) {
				conv.messages = conv.messages.slice(-20);
			}
			this.conversations[index] = conv;
		}
	}

	garbageCollect(maxConversations = 50, maxAgeDays = 30) {
		const now = Date.now();
		const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

		// Filter by age and keep archived ones
		this.conversations = this.conversations.filter(c => {
			if (c.isArchived) return true;
			const age = now - c.updatedAt;
			return age < maxAgeMs;
		});

		// Limit total number of active conversations
		if (this.conversations.length > maxConversations) {
			const active = this.conversations.filter(c => !c.isArchived);
			const archived = this.conversations.filter(c => c.isArchived);
			
			if (active.length > maxConversations) {
				const truncatedActive = active
					.sort((a, b) => b.updatedAt - a.updatedAt)
					.slice(0, maxConversations);
				this.conversations = [...truncatedActive, ...archived];
			}
		}
	}

	deleteConversation(id: string) {
		this.conversations = this.conversations.filter(c => c.id !== id);
	}

	archiveConversation(id: string, archive = true) {
		const conv = this.getConversation(id);
		if (conv) {
			conv.isArchived = archive;
			this.updateConversation(conv);
		}
	}

	toJSON() {
		return this.conversations;
	}
}
