import { v4 as uuidv4 } from 'uuid';
import { Part } from "@google/generative-ai";

export interface ChatMessage {
	role: 'user' | 'model';
	parts: Part[];
	timestamp: number;
}

export interface Conversation {
	id: string;
	title: string;
	messages: ChatMessage[];
	model: string;
	updatedAt: number;
	isArchived?: boolean;
}

export class ConversationManager {
	private conversations: Conversation[] = [];

	constructor(settings: { conversations: Conversation[] }) {
		this.conversations = settings.conversations || [];
	}

	getConversations = (archived = false, query = ''): Conversation[] => {
		let filtered = this.conversations.filter(c => !!c.isArchived === archived);
		if (query) {
			const lower = query.toLowerCase();
			filtered = filtered.filter(c => c.title.toLowerCase().includes(lower));
		}
		return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
	};

	getConversation = (id: string): Conversation | undefined => {
		return this.conversations.find(c => c.id === id);
	};

	createConversation = (title = 'New chat'): Conversation => {
		const newConv: Conversation = {
			id: uuidv4(),
			title,
			messages: [],
			model: 'auto',
			updatedAt: Date.now()
		};
		this.conversations.push(newConv);
		return newConv;
	};

	updateConversation = (conv: Conversation): void => {
		const index = this.conversations.findIndex(c => c.id === conv.id);
		if (index !== -1) {
			this.conversations[index] = { ...conv, updatedAt: Date.now() };
		}
	};

	deleteConversation = (id: string): void => {
		this.conversations = this.conversations.filter(c => c.id !== id);
	};

	garbageCollect = (): void => {
		const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
		this.conversations = this.conversations.filter(c => 
			c.isArchived || c.updatedAt > oneMonthAgo || c.messages.length > 0
		);
	};

	archiveConversation = (id: string, archive = true): void => {
		const conv = this.getConversation(id);
		if (conv) {
			conv.isArchived = archive;
			this.updateConversation(conv);
		}
	};

	toJSON = (): Conversation[] => {
		return this.conversations;
	};
}
