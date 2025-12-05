/**
 * API client for the LLM Council.
 * Conversation storage is handled via localStorage.
 * Backend is only used for LLM council processing.
 */

import {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  updateConversationTitle,
  addUserMessage,
  addAssistantMessage,
} from './storage';

// Use VITE_REACT_BACKEND_API environment variable, fallback to localhost for development
const API_BASE = import.meta.env.VITE_REACT_BACKEND_API || 'http://localhost:8001';

export const api = {
  /**
   * List all conversations from localStorage.
   */
  listConversations() {
    return Promise.resolve(listConversations());
  },

  /**
   * Create a new conversation in localStorage.
   */
  createConversation() {
    return Promise.resolve(createConversation());
  },

  /**
   * Get a specific conversation from localStorage.
   */
  getConversation(conversationId) {
    const conv = getConversation(conversationId);
    if (!conv) {
      return Promise.reject(new Error('Conversation not found'));
    }
    return Promise.resolve(conv);
  },

  /**
   * Delete a specific conversation from localStorage.
   */
  deleteConversation(conversationId) {
    const deleted = deleteConversation(conversationId);
    if (!deleted) {
      return Promise.reject(new Error('Conversation not found'));
    }
    return Promise.resolve({ status: 'deleted', id: conversationId });
  },

  /**
   * Update conversation title in localStorage.
   */
  updateConversationTitle(conversationId, title) {
    try {
      const conv = updateConversationTitle(conversationId, title);
      return Promise.resolve(conv);
    } catch (e) {
      return Promise.reject(e);
    }
  },

  /**
   * Save user message to localStorage.
   */
  saveUserMessage(conversationId, content) {
    try {
      const conv = addUserMessage(conversationId, content);
      return Promise.resolve(conv);
    } catch (e) {
      return Promise.reject(e);
    }
  },

  /**
   * Save assistant message to localStorage.
   */
  saveAssistantMessage(conversationId, stage1, stage2, stage3, metadata = null) {
    try {
      const conv = addAssistantMessage(conversationId, stage1, stage2, stage3, metadata);
      return Promise.resolve(conv);
    } catch (e) {
      return Promise.reject(e);
    }
  },

  /**
   * Send a message and receive streaming updates from the backend.
   * Storage is handled client-side; backend only processes LLM calls.
   * @param {string} conversationId - The conversation ID (for reference only, not sent to backend)
   * @param {string} content - The message content
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @param {Object} options - Additional options
   * @param {boolean} options.generateTitle - Whether to generate a title for this message
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, onEvent, options = {}) {
    // Read settings from localStorage
    const openRouterApiKey = localStorage.getItem('openRouterApiKey');
    const councilModelsStr = localStorage.getItem('councilModels');
    const chairmanModel = localStorage.getItem('chairmanModel');

    const requestBody = { content };
    if (openRouterApiKey && openRouterApiKey.trim()) {
      requestBody.api_key = openRouterApiKey;
    }
    if (councilModelsStr) {
      try {
        const councilModels = JSON.parse(councilModelsStr);
        if (councilModels && Array.isArray(councilModels) && councilModels.length > 0) {
          requestBody.council_models = councilModels;
        }
      } catch (e) {
        console.error('Failed to parse councilModels:', e);
      }
    }
    if (chairmanModel && chairmanModel.trim()) {
      requestBody.chairman_model = chairmanModel;
    }
    if (options.generateTitle) {
      requestBody.generate_title = true;
    }

    const response = await fetch(`${API_BASE}/api/council/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to process message');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            onEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  },
};
