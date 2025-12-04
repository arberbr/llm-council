import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import ChatInterface from './components/ChatInterface';
import { api } from './api';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const sendingToConversationIdRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Sync URL param to currently selected conversation and load it
  useEffect(() => {
    if (conversationId) {
      setCurrentConversationId(conversationId);
      // Only skip loading if:
      // 1. We already have this conversation loaded, OR
      // 2. We're sending a message to THIS SAME conversation (to avoid overwriting optimistic updates)
      // If we're sending to a different conversation and navigate here, we should load it
      const shouldSkipLoad =
        (currentConversation && currentConversation.id === conversationId) ||
        (sendingToConversationIdRef.current === conversationId);

      if (!shouldSkipLoad) {
        loadConversation(conversationId);
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

  const loadConversation = async (id) => {
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
      setConversations([
        { id: newConv.id, created_at: newConv.created_at, message_count: 0 },
        ...conversations,
      ]);
      navigate(`/${newConv.id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (id) => {
    navigate(`/${id}`);
  };

  const handleHomeClick = () => {
    navigate('/');
  };

  const handleDeleteConversation = async (id) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this conversation? This cannot be undone.'
    );
    if (!confirmed) return;

    try {
      await api.deleteConversation(id);

      setConversations((prev) => prev.filter((c) => c.id !== id));

      if (currentConversationId === id) {
        // If we deleted the currently active conversation, go back to the home view
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleSendMessage = async (content) => {
    // Validate settings before sending
    const openRouterApiKey = localStorage.getItem('openRouterApiKey');
    const councilModelsStr = localStorage.getItem('councilModels');
    const chairmanModel = localStorage.getItem('chairmanModel');

    const errors = [];

    if (!openRouterApiKey || !openRouterApiKey.trim()) {
      errors.push('OpenRouter API key is required. Please set it in the settings.');
    }

    if (!chairmanModel || !chairmanModel.trim()) {
      errors.push('Chairman model must be selected. Please select one in the settings.');
    }

    let councilModels = [];
    if (councilModelsStr) {
      try {
        councilModels = JSON.parse(councilModelsStr);
      } catch (e) {
        errors.push('Invalid council models configuration.');
      }
    }

    if (!councilModels || councilModels.length < 2) {
      errors.push('At least 2 council models must be selected. Please select at least 2 in the settings.');
    }

    if (errors.length > 0) {
      alert('Configuration Error:\n\n' + errors.join('\n'));
      return;
    }

    setIsLoading(true);
    try {
      let convId = currentConversationId;

      // If there is no active conversation (e.g., on the homepage), create one first
      if (!convId) {
        const newConv = await api.createConversation();
        convId = newConv.id;

        setConversations((prev) => [
          { id: newConv.id, created_at: newConv.created_at, message_count: 0 },
          ...prev,
        ]);

        // Set the conversation state before navigating to avoid race condition
        const newConversation = {
          id: newConv.id,
          created_at: newConv.created_at,
          title: newConv.title || 'New Conversation',
          messages: [],
        };
        setCurrentConversation(newConversation);
        setCurrentConversationId(newConv.id);

        // Navigate after setting state
        navigate(`/${newConv.id}`, { replace: true });
      }

      // Track which conversation we're sending to
      sendingToConversationIdRef.current = convId;

      // Optimistically add user message to UI
      const userMessage = { role: 'user', content };
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...(prev?.messages ?? []), userMessage],
      }));

      // Create a partial assistant message that will be updated progressively
      const assistantMessage = {
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
      };

      // Add the partial assistant message
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...(prev?.messages ?? []), assistantMessage],
      }));

      // Send message with streaming
      await api.sendMessageStream(convId, content, (eventType, event) => {
        switch (eventType) {
          case 'stage1_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage1 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage1_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage1 = event.data;
              lastMsg.loading.stage1 = false;
              return { ...prev, messages };
            });
            break;

          case 'stage2_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage2 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage2_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage2 = event.data;
              lastMsg.metadata = event.metadata;
              lastMsg.loading.stage2 = false;
              return { ...prev, messages };
            });
            break;

          case 'stage3_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage3 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage3_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage3 = event.data;
              lastMsg.loading.stage3 = false;
              return { ...prev, messages };
            });
            break;

          case 'title_complete':
            // Reload conversations to get updated title
            loadConversations();
            break;

          case 'complete':
            // Stream complete, reload conversations list
            loadConversations();
            setIsLoading(false);
            sendingToConversationIdRef.current = null;
            // If we navigated away during sending, ensure the current conversation is loaded
            if (conversationId && conversationId !== convId) {
              loadConversation(conversationId);
            }
            break;

          case 'error':
            console.error('Stream error:', event.message);
            setIsLoading(false);
            sendingToConversationIdRef.current = null;
            // If we navigated away during sending, ensure the current conversation is loaded
            if (conversationId && conversationId !== convId) {
              loadConversation(conversationId);
            }
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic messages on error (only if we're still on the same conversation)
      const wasSendingTo = sendingToConversationIdRef.current;
      sendingToConversationIdRef.current = null;

      // Only remove optimistic messages if we're still viewing the conversation we were sending to
      if (wasSendingTo && currentConversationId === wasSendingTo) {
        setCurrentConversation((prev) => ({
          ...prev,
          messages: prev?.messages?.slice(0, -2) ?? [],
        }));
      }

      setIsLoading(false);

      // If we navigated away during sending, ensure the current conversation is loaded
      if (conversationId && wasSendingTo && conversationId !== wasSendingTo) {
        loadConversation(conversationId);
      }
    }
  };

  return (
    <ThemeProvider>
      <div className="app">
        <LeftSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onHomeClick={handleHomeClick}
        />
        <ChatInterface
          conversation={currentConversation}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
        <RightSidebar />
      </div>
    </ThemeProvider>
  );
}

export default App;
