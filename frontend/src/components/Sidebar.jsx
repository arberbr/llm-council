import './Sidebar.css';
import { useTheme } from '../ThemeContext';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onHomeClick,
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title" onClick={onHomeClick}>
          LLM Council
        </h1>
        <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>

      <div className="conversation-list">
        {conversations.length === 0 ? (
          <div className="no-conversations">No conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''
                }`}
            >
              <div
                className="conversation-main"
                onClick={() => onSelectConversation(conv.id)}
              >
                <div className="conversation-title">
                  {conv.title || 'New Conversation'}
                </div>
              </div>
              <button
                className="conversation-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(conv.id);
                }}
                title="Delete conversation"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
