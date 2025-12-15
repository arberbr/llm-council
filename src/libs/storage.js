/**
 * LocalStorage-based storage for conversations.
 * Mirrors the backend storage API but stores data client-side.
 */

const STORAGE_KEY = 'llm-council-conversations';

/**
 * Get all conversations from localStorage.
 * @returns {Object} Map of conversation IDs to conversation objects
 */
function getAllConversations() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('Failed to parse conversations from localStorage:', e);
    return {};
  }
}

/**
 * Save all conversations to localStorage.
 * @param {Object} conversations - Map of conversation IDs to conversation objects
 */
function saveAllConversations(conversations) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.error('Failed to save conversations to localStorage:', e);
  }
}

/**
 * Generate a UUID v4.
 * @returns {string} UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * List all conversations (metadata only).
 * @returns {Array} List of conversation metadata objects
 */
export function listConversations() {
  const conversations = getAllConversations();
  const list = Object.values(conversations).map((conv) => ({
    id: conv.id,
    created_at: conv.created_at,
    title: conv.title || 'New Conversation',
    message_count: conv.messages?.length || 0,
  }));

  // Sort by creation time, newest first
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return list;
}

/**
 * Create a new conversation.
 * @returns {Object} New conversation object
 */
export function createConversation() {
  const conversations = getAllConversations();

  const conversation = {
    id: generateUUID(),
    created_at: new Date().toISOString(),
    title: 'New Conversation',
    messages: [],
  };

  conversations[conversation.id] = conversation;
  saveAllConversations(conversations);

  return conversation;
}

/**
 * Get a specific conversation.
 * @param {string} conversationId - Conversation ID
 * @returns {Object|null} Conversation object or null if not found
 */
export function getConversation(conversationId) {
  const conversations = getAllConversations();
  return conversations[conversationId] || null;
}

/**
 * Save/update a conversation.
 * @param {Object} conversation - Conversation object to save
 */
export function saveConversation(conversation) {
  const conversations = getAllConversations();
  conversations[conversation.id] = conversation;
  saveAllConversations(conversations);
}

/**
 * Delete a conversation.
 * @param {string} conversationId - Conversation ID
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteConversation(conversationId) {
  const conversations = getAllConversations();

  if (!conversations[conversationId]) {
    return false;
  }

  delete conversations[conversationId];
  saveAllConversations(conversations);
  return true;
}

/**
 * Add a user message to a conversation.
 * @param {string} conversationId - Conversation ID
 * @param {string} content - Message content
 * @returns {Object} Updated conversation
 */
export function addUserMessage(conversationId, content) {
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

/**
 * Add an assistant message with all 3 stages to a conversation.
 * @param {string} conversationId - Conversation ID
 * @param {Array} stage1 - Stage 1 results
 * @param {Array} stage2 - Stage 2 results
 * @param {Object} stage3 - Stage 3 result
 * @param {Object} metadata - Optional metadata (rankings, etc.)
 * @returns {Object} Updated conversation
 */
export function addAssistantMessage(conversationId, stage1, stage2, stage3, metadata = null) {
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  const assistantMessage = {
    role: 'assistant',
    stage1,
    stage2,
    stage3,
  };

  if (metadata) {
    assistantMessage.metadata = metadata;
  }

  conversation.messages.push(assistantMessage);

  saveConversation(conversation);
  return conversation;
}

/**
 * Update the title of a conversation.
 * @param {string} conversationId - Conversation ID
 * @param {string} title - New title
 * @returns {Object} Updated conversation
 */
export function updateConversationTitle(conversationId, title) {
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
