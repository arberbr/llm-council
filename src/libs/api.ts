import {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  updateConversationTitle,
  addUserMessage,
  addAssistantMessage,
} from './storage';
import { Conversation } from '../types';

const API_BASE =
  (import.meta as { env: { VITE_REACT_BACKEND_API?: string } }).env
    .VITE_REACT_BACKEND_API || 'http://localhost:3001';

type SendEventType =
  | 'stage1_start'
  | 'stage1_complete'
  | 'stage2_start'
  | 'stage2_complete'
  | 'stage3_start'
  | 'stage3_complete'
  | 'title_complete'
  | 'complete'
  | 'error'
  | string;

interface SendMessageOptions {
  generateTitle?: boolean;
}

export const api = {
  listConversations(): Promise<ReturnType<typeof listConversations>> {
    return Promise.resolve(listConversations());
  },

  createConversation(): Promise<Conversation> {
    return Promise.resolve(createConversation());
  },

  getConversation(conversationId: string): Promise<Conversation> {
    const conv = getConversation(conversationId);
    if (!conv) {
      return Promise.reject(new Error('Conversation not found'));
    }
    return Promise.resolve(conv);
  },

  deleteConversation(
    conversationId: string,
  ): Promise<{ status: 'deleted'; id: string }> {
    const deleted = deleteConversation(conversationId);
    if (!deleted) {
      return Promise.reject(new Error('Conversation not found'));
    }
    return Promise.resolve({ status: 'deleted', id: conversationId });
  },

  updateConversationTitle(
    conversationId: string,
    title: string,
  ): Promise<Conversation> {
    try {
      const conv = updateConversationTitle(conversationId, title);
      return Promise.resolve(conv);
    } catch (e) {
      return Promise.reject(e);
    }
  },

  saveUserMessage(conversationId: string, content: string): Promise<Conversation> {
    try {
      const conv = addUserMessage(conversationId, content);
      return Promise.resolve(conv);
    } catch (e) {
      return Promise.reject(e);
    }
  },

  saveAssistantMessage(
    conversationId: string,
    stage1: Conversation['messages'][number]['stage1'],
    stage2: Conversation['messages'][number]['stage2'],
    stage3: Conversation['messages'][number]['stage3'],
    metadata: Conversation['messages'][number]['metadata'] = null,
  ): Promise<Conversation> {
    try {
      const conv = addAssistantMessage(
        conversationId,
        stage1,
        stage2,
        stage3,
        metadata,
      );
      return Promise.resolve(conv);
    } catch (e) {
      return Promise.reject(e);
    }
  },

  async sendMessageStream(
    conversationId: string,
    content: string,
    onEvent: (eventType: SendEventType, event: any) => void,
    options: SendMessageOptions = {},
  ): Promise<void> {
    const openRouterApiKey = localStorage.getItem('openRouterApiKey');
    const councilModelsStr = localStorage.getItem('councilModels');
    const chairmanModel = localStorage.getItem('chairmanModel');

    const requestBody: Record<string, unknown> = { content };
    if (openRouterApiKey && openRouterApiKey.trim()) {
      requestBody.api_key = openRouterApiKey;
    }
    if (councilModelsStr) {
      try {
        const councilModels = JSON.parse(councilModelsStr) as string[];
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

    if (!response.body) {
      throw new Error('No response body from server');
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
            onEvent(event.type as SendEventType, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  },
};


