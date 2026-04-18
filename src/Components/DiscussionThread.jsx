// src/Components/DiscussionThread.jsx
import { useState, useRef, useEffect } from 'react';
import { MdSend, MdClose, MdCheckCircle, MdMoreVert } from 'react-icons/md';
import { formatRelativeTime } from '../utils/highlightUtils';

const DiscussionThread = ({
  discussion,
  messages = [],
  onAddMessage,
  onResolve,
  userRole,
  userId,
  onClose,
  onExpand,
  onCollapse
}) => {
  const [replyText, setReplyText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Load/unload messages when expanding/collapsing
  useEffect(() => {
    if (isExpanded && onExpand) {
      onExpand(discussion.id);
    } else if (!isExpanded && onCollapse) {
      onCollapse(discussion.id);
    }
  }, [isExpanded, discussion.id, onExpand, onCollapse]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isExpanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  const handleSendMessage = async () => {
    if (!replyText.trim()) return;

    setIsSending(true);
    try {
      await onAddMessage(discussion.id, replyText);
      setReplyText('');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleResolve = async () => {
    if (window.confirm('Mark this discussion as resolved?')) {
      try {
        await onResolve(discussion.id);
      } catch (err) {
        alert('Failed to resolve discussion');
      }
    }
  };

  const messageCount = messages?.length || 0;
  const isResolved = discussion.status === 'resolved';

  return (
    <div style={{ ...styles.container, ...(isResolved ? styles.containerResolved : {}) }}>
      {/* Header - Always Visible */}
      <div
        style={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={styles.headerLeft}>
          {/* Color indicator */}
          <div
            style={{
              ...styles.colorIndicator,
              backgroundColor: discussion.highlightColor
            }}
          />
          
          {/* Highlighted text preview */}
          <div style={styles.headerInfo}>
            <div style={styles.highlightText}>
              "{discussion.highlightedText?.substring(0, 60)}
              {discussion.highlightedText?.length > 60 ? '...' : ''}"
            </div>
            <div style={styles.headerMeta}>
              Page {discussion.pageNumber} • {messageCount} message{messageCount !== 1 ? 's' : ''} •{' '}
              {formatRelativeTime(discussion.createdAt)}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div style={styles.headerRight}>
          {isResolved && (
            <span style={styles.resolvedBadge}>
              <MdCheckCircle size={16} style={{ marginRight: '4px' }} />
              Resolved
            </span>
          )}
          <span style={styles.expandIcon}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={styles.expandedContent}>
          {/* Context */}
          <div style={styles.contextSection}>
            <div style={styles.contextLabel}>Context:</div>
            <div style={styles.contextText}>{discussion.context || 'No additional context'}</div>
          </div>

          {/* Messages */}
          <div style={styles.messagesContainer}>
            {messageCount === 0 ? (
              <div style={styles.noMessages}>No messages yet. Be the first to reply!</div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    ...styles.message,
                    ...(msg.senderRole === 'admin' ? styles.messageAdmin : styles.messageClient)
                  }}
                >
                  <div style={styles.messageHeader}>
                    <span style={styles.senderName}>{msg.senderName}</span>
                    <span style={styles.senderRole}>
                      {msg.senderRole === 'admin' ? '👨‍💼 Admin' : '👤 Client'}
                    </span>
                    <span style={styles.messageTime}>
                      {formatRelativeTime(msg.timestamp)}
                    </span>
                  </div>
                  <div style={styles.messageBody}>{msg.message}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply input (not for resolved discussions) */}
          {!isResolved && (
            <div style={styles.replySection}>
              <input
                type="text"
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isSending) {
                    handleSendMessage();
                  }
                }}
                style={styles.replyInput}
                disabled={isSending}
              />
              <button
                onClick={handleSendMessage}
                style={{
                  ...styles.sendButton,
                  ...(isSending ? styles.sendButtonDisabled : {})
                }}
                disabled={isSending || !replyText.trim()}
              >
                <MdSend size={18} />
              </button>
            </div>
          )}

          {/* Admin actions */}
          {userRole === 'admin' && !isResolved && (
            <div style={styles.adminActions}>
              <button
                onClick={handleResolve}
                style={styles.resolveButton}
              >
                <MdCheckCircle size={16} style={{ marginRight: '6px' }} />
                Mark as Resolved
              </button>
            </div>
          )}

          {/* Client info */}
          <div style={styles.clientInfo}>
            <div style={styles.clientInfoLabel}>From:</div>
            <div>{discussion.clientName}</div>
            <div style={styles.clientEmail}>{discussion.clientEmail}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: '#ffffff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: '8px',
    marginBottom: '12px',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  containerResolved: {
    opacity: 0.7,
    borderColor: '#d0d0d0'
  },
  header: {
    padding: '12px 14px',
    background: '#fafafa',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
    ':hover': {
      background: '#f5f5f5'
    }
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    flex: 1,
    minWidth: 0
  },
  colorIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '4px',
    opacity: 0.8
  },
  headerInfo: {
    flex: 1,
    minWidth: 0
  },
  highlightText: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#333',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  headerMeta: {
    fontSize: '11px',
    color: '#888',
    marginTop: '4px'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0
  },
  resolvedBadge: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    color: '#10B981',
    background: '#D1F2EB',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: '500'
  },
  expandIcon: {
    fontSize: '12px',
    color: '#888',
    transition: 'transform 0.2s ease'
  },
  expandedContent: {
    padding: '16px 14px',
    borderTop: '1px solid #e0e0e0',
    background: '#fafafa'
  },
  contextSection: {
    marginBottom: '16px',
    padding: '12px',
    background: '#ffffff',
    borderRadius: '6px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0'
  },
  contextLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: '6px'
  },
  contextText: {
    fontSize: '12px',
    color: '#555',
    lineHeight: '1.4',
    maxHeight: '60px',
    overflow: 'auto',
    fontStyle: 'italic'
  },
  messagesContainer: {
    maxHeight: '300px',
    overflowY: 'auto',
    marginBottom: '12px',
    paddingRight: '6px'
  },
  message: {
    marginBottom: '12px',
    padding: '10px 12px',
    borderRadius: '6px',
    fontSize: '13px'
  },
  messageClient: {
    background: '#f0fdf4',
    borderLeft: '3px solid #10B981'
  },
  messageAdmin: {
    background: '#eff6ff',
    borderLeft: '3px solid #3b82f6'
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
    fontSize: '11px'
  },
  senderName: {
    fontWeight: '600',
    color: '#333'
  },
  senderRole: {
    fontSize: '10px',
    color: '#666'
  },
  messageTime: {
    fontSize: '10px',
    color: '#999',
    marginLeft: 'auto'
  },
  messageBody: {
    color: '#333',
    lineHeight: '1.4',
    wordBreak: 'break-word'
  },
  noMessages: {
    textAlign: 'center',
    padding: '20px 12px',
    color: '#888',
    fontSize: '12px',
    fontStyle: 'italic',
    background: '#ffffff',
    borderRadius: '4px'
  },
  replySection: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  replyInput: {
    flex: 1,
    padding: '8px 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s ease',
    outline: 'none'
  },
  sendButton: {
    padding: '8px 12px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s ease',
    ':hover': {
      background: '#2563eb'
    }
  },
  sendButtonDisabled: {
    background: '#d0d0d0',
    cursor: 'not-allowed'
  },
  adminActions: {
    padding: '12px',
    background: '#ffffff',
    borderRadius: '6px',
    marginBottom: '12px'
  },
  resolveButton: {
    width: '100%',
    padding: '10px',
    background: '#10B981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s ease',
    ':hover': {
      background: '#059669'
    }
  },
  clientInfo: {
    padding: '10px 12px',
    background: '#ffffff',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#666',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: '#e0e0e0'
  },
  clientInfoLabel: {
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: '4px'
  },
  clientEmail: {
    fontSize: '11px',
    color: '#999'
  }
};

export default DiscussionThread;
