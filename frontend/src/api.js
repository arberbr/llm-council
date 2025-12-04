/**
 * API client for the LLM Council backend.
 */

// Use VITE_REACT_BACKEND_API environment variable, fallback to localhost for development
const API_BASE = import.meta.env.VITE_REACT_BACKEND_API || 'http://localhost:8001';

export const api = {
  /**
   * List all conversations.
   */
  async listConversations() {
    const response = await fetch(`${API_BASE}/api/conversations`);
    if (!response.ok) {
      throw new Error('Failed to list conversations');
    }
    return response.json();
  },

  /**
   * Create a new conversation.
   */
  async createConversation() {
    const response = await fetch(`${API_BASE}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }
    return response.json();
  },

  /**
   * Get a specific conversation.
   */
  async getConversation(conversationId) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`
    );
    if (!response.ok) {
      throw new Error('Failed to get conversation');
    }
    return response.json();
  },

  /**
   * Delete a specific conversation.
   */
  async deleteConversation(conversationId) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`,
      {
        method: 'DELETE',
      }
    );
    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }
    return response.json();
  },

  /**
   * Send a message in a conversation.
   */
  async sendMessage(conversationId, content) {
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

    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    return response.json();
  },

  /**
   * Send a message and receive streaming updates.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, onEvent) {
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

    // Debug logging
    console.log('=== FRONTEND: Settings from localStorage ===', {
      rawChairmanModel: chairmanModel,
      rawCouncilModels: councilModelsStr,
      hasApiKey: !!openRouterApiKey
    });
    console.log('=== FRONTEND: Request body being sent ===', requestBody);
    console.log('=== FRONTEND: Final request body JSON ===', JSON.stringify(requestBody));

    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send message');
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
