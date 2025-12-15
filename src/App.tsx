import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import ChatInterface from './components/ChatInterface';
import { api } from './libs/api';
import { ThemeProvider } from './context/ThemeContext';
import { Conversation, ConversationSummary } from './types';

function App() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const sendingToConversationIdRef = useRef<string | null>(null);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (conversationId) {
      setCurrentConversationId(conversationId);
      const shouldSkipLoad =
        (currentConversation && currentConversation.id === conversationId) ||
        sendingToConversationIdRef.current === conversationId;

      if (!shouldSkipLoad) {
        void loadConversation(conversationId);
      }
    } else {
      setCurrentConversationId(null);
      setCurrentConversation(null);
    }
  }, [conversationId]);

  const loadConversations = async () => {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await api.createConversation();
      setConversations((prev) => [
        {
          id: newConv.id,
          created_at: newConv.created_at,
          title: newConv.title,
          message_count: 0,
        },
        ...prev,
      ]);
      navigate(`/${newConv.id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (id: string) => {
    navigate(`/${id}`);
  };

  const handleHomeClick = () => {
    navigate('/');
  };

  const handleDeleteConversation = async (id: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this conversation? This cannot be undone.',
    );
    if (!confirmed) return;

    try {
      await api.deleteConversation(id);

      setConversations((prev) => prev.filter((c) => c.id !== id));

      if (currentConversationId === id) {
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    const openRouterApiKey = localStorage.getItem('openRouterApiKey');
    const councilModelsStr = localStorage.getItem('councilModels');
    const chairmanModel = localStorage.getItem('chairmanModel');

    const errors: string[] = [];

    if (!openRouterApiKey || !openRouterApiKey.trim()) {
      errors.push('OpenRouter API key is required. Please set it in the settings.');
    }

    if (!chairmanModel || !chairmanModel.trim()) {
      errors.push('Chairman model must be selected. Please select one in the settings.');
    }

    let councilModels: unknown[] = [];
    if (councilModelsStr) {
      try {
        councilModels = JSON.parse(councilModelsStr) as unknown[];
      } catch {
        errors.push('Invalid council models configuration.');
      }
    }

    if (!Array.isArray(councilModels) || councilModels.length < 2) {
      errors.push(
        'At least 2 council models must be selected. Please select at least 2 in the settings.',
      );
    }

    if (errors.length > 0) {
      alert('Configuration Error:\n\n' + errors.join('\n'));
      return;
    }

    setIsLoading(true);

    let collectedStage1: Conversation['messages'][number]['stage1'] = null;
    let collectedStage2: Conversation['messages'][number]['stage2'] = null;
    let collectedStage3: Conversation['messages'][number]['stage3'] = null;
    let collectedMetadata: Conversation['messages'][number]['metadata'] = null;

    try {
      let convId = currentConversationId;
      let isFirstMessage = false;

      if (!convId) {
        const newConv = await api.createConversation();
        convId = newConv.id;
        isFirstMessage = true;

        setConversations((prev) => [
          {
            id: newConv.id,
            created_at: newConv.created_at,
            title: newConv.title,
            message_count: 0,
          },
          ...prev,
        ]);

        const newConversation: Conversation = {
          id: newConv.id,
          created_at: newConv.created_at,
          title: newConv.title || 'New Conversation',
          messages: [],
        };
        setCurrentConversation(newConversation);
        setCurrentConversationId(newConv.id);

        navigate(`/${newConv.id}`, { replace: true });
      } else {
        const existingConv = await api.getConversation(convId);
        isFirstMessage = !existingConv.messages || existingConv.messages.length === 0;
      }

      if (!convId) {
        throw new Error('Failed to determine conversation ID');
      }

      sendingToConversationIdRef.current = convId;

      api.saveUserMessage(convId, content);

      const userMessage: Conversation['messages'][number] = {
        role: 'user',
        content,
      } as any;

      setCurrentConversation((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, userMessage],
            }
          : prev,
      );

      const assistantMessage: Conversation['messages'][number] = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage3: null,
        metadata: null,
        loading: {
          stage1: false,
          stage2: false,
          stage3: false,
        },
      } as any;

      setCurrentConversation((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, assistantMessage],
            }
          : prev,
      );

      await api.sendMessageStream(
        convId,
        content,
        (eventType, event) => {
          switch (eventType) {
            case 'stage1_start':
              setCurrentConversation((prev) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg: any = messages[messages.length - 1];
                if (lastMsg?.loading) {
                  lastMsg.loading.stage1 = true;
                }
                return { ...prev, messages };
              });
              break;

            case 'stage1_complete':
              collectedStage1 = event.data;
              setCurrentConversation((prev) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg: any = messages[messages.length - 1];
                lastMsg.stage1 = event.data;
                if (lastMsg.loading) {
                  lastMsg.loading.stage1 = false;
                }
                return { ...prev, messages };
              });
              break;

            case 'stage2_start':
              setCurrentConversation((prev) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg: any = messages[messages.length - 1];
                if (lastMsg.loading) {
                  lastMsg.loading.stage2 = true;
                }
                return { ...prev, messages };
              });
              break;

            case 'stage2_complete':
              collectedStage2 = event.data;
              collectedMetadata = event.metadata;
              setCurrentConversation((prev) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg: any = messages[messages.length - 1];
                lastMsg.stage2 = event.data;
                lastMsg.metadata = event.metadata;
                if (lastMsg.loading) {
                  lastMsg.loading.stage2 = false;
                }
                return { ...prev, messages };
              });
              break;

            case 'stage3_start':
              setCurrentConversation((prev) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg: any = messages[messages.length - 1];
                if (lastMsg.loading) {
                  lastMsg.loading.stage3 = true;
                }
                return { ...prev, messages };
              });
              break;

            case 'stage3_complete':
              collectedStage3 = event.data;
              setCurrentConversation((prev) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg: any = messages[messages.length - 1];
                lastMsg.stage3 = event.data;
                if (lastMsg.loading) {
                  lastMsg.loading.stage3 = false;
                }
                return { ...prev, messages };
              });
              break;

            case 'title_complete':
              if (event.data && event.data.title) {
                api.updateConversationTitle(convId, event.data.title);
                setCurrentConversation((prev) =>
                  prev
                    ? {
                        ...prev,
                        title: event.data.title,
                      }
                    : prev,
                );
                void loadConversations();
              }
              break;

            case 'complete':
              if (collectedStage1 && collectedStage2 && collectedStage3) {
                api.saveAssistantMessage(
                  convId,
                  collectedStage1,
                  collectedStage2,
                  collectedStage3,
                  collectedMetadata,
                );
              }

              void loadConversations();
              setIsLoading(false);
              sendingToConversationIdRef.current = null;

              if (conversationId && conversationId !== convId) {
                void loadConversation(conversationId);
              }
              break;

            case 'error':
              console.error('Stream error:', event.message);
              setIsLoading(false);
              sendingToConversationIdRef.current = null;
              if (conversationId && conversationId !== convId) {
                void loadConversation(conversationId);
              }
              break;

            default:
              console.log('Unknown event type:', eventType);
          }
        },
        { generateTitle: isFirstMessage },
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      const wasSendingTo = sendingToConversationIdRef.current;
      sendingToConversationIdRef.current = null;

      if (wasSendingTo && currentConversationId === wasSendingTo) {
        setCurrentConversation((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.slice(0, -2),
              }
            : prev,
        );
      }

      setIsLoading(false);

      if (conversationId && wasSendingTo && conversationId !== wasSendingTo) {
        void loadConversation(conversationId);
      }
    }
  };

  return (
    <ThemeProvider>
      <div className="app">
        <button
          className={`sidebar-toggle sidebar-toggle-left ${leftSidebarOpen ? 'active' : ''}`}
          onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          title="Toggle conversations"
        >
          ☰
        </button>

        <button
          className={`sidebar-toggle sidebar-toggle-right ${rightSidebarOpen ? 'active' : ''}`}
          onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
          title="Toggle settings"
        >
          ⚙
        </button>

        {(leftSidebarOpen || rightSidebarOpen) && (
          <div
            className="sidebar-overlay"
            onClick={() => {
              setLeftSidebarOpen(false);
              setRightSidebarOpen(false);
            }}
          />
        )}

        <LeftSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={(id) => {
            handleSelectConversation(id);
            setLeftSidebarOpen(false);
          }}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onHomeClick={handleHomeClick}
          isOpen={leftSidebarOpen}
          onClose={() => setLeftSidebarOpen(false)}
        />
        <ChatInterface
          conversation={currentConversation}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
        <RightSidebar
          isOpen={rightSidebarOpen}
          onClose={() => setRightSidebarOpen(false)}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;


