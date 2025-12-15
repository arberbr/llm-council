import { Conversation, ConversationSummary } from '../types';

const STORAGE_KEY = 'llm-council-conversations';

function getAllConversations(): Record<string, Conversation> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? (JSON.parse(data) as Record<string, Conversation>) : {};
  } catch (e) {
    console.error('Failed to parse conversations from localStorage:', e);
    return {};
  }
}

function saveAllConversations(conversations: Record<string, Conversation>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.error('Failed to save conversations to localStorage:', e);
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function listConversations(): ConversationSummary[] {
  const conversations = getAllConversations();
  const list: ConversationSummary[] = Object.values(conversations).map((conv) => ({
    id: conv.id,
    created_at: conv.created_at,
    title: conv.title || 'New Conversation',
    message_count: conv.messages?.length || 0,
  }));

  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return list;
}

export function createConversation(): Conversation {
  const conversations = getAllConversations();

  const conversation: Conversation = {
    id: generateUUID(),
    created_at: new Date().toISOString(),
    title: 'New Conversation',
    messages: [],
  };

  conversations[conversation.id] = conversation;
  saveAllConversations(conversations);

  return conversation;
}

export function getConversation(conversationId: string): Conversation | null {
  const conversations = getAllConversations();
  return conversations[conversationId] || null;
}

export function saveConversation(conversation: Conversation): void {
  const conversations = getAllConversations();
  conversations[conversation.id] = conversation;
  saveAllConversations(conversations);
}

export function deleteConversation(conversationId: string): boolean {
  const conversations = getAllConversations();

  if (!conversations[conversationId]) {
    return false;
  }

  delete conversations[conversationId];
  saveAllConversations(conversations);
  return true;
}

export function addUserMessage(conversationId: string, content: string): Conversation {
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  conversation.messages.push({
    role: 'user',
    content,
  });

  saveConversation(conversation);
  return conversation;
}

export function addAssistantMessage(
  conversationId: string,
  stage1: Conversation['messages'][number]['stage1'],
  stage2: Conversation['messages'][number]['stage2'],
  stage3: Conversation['messages'][number]['stage3'],
  metadata: Conversation['messages'][number]['metadata'] = null,
): Conversation {
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  const assistantMessage = {
    role: 'assistant' as const,
    stage1,
    stage2,
    stage3,
    metadata: metadata ?? undefined,
  };

  conversation.messages.push(assistantMessage);

  saveConversation(conversation);
  return conversation;
}

export function updateConversationTitle(conversationId: string, title: string): Conversation {
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  conversation.title = title;
  saveConversation(conversation);
  return conversation;
}

export const storage = {
  listConversations,
  createConversation,
  getConversation,
  saveConversation,
  deleteConversation,
  addUserMessage,
  addAssistantMessage,
  updateConversationTitle,
};


