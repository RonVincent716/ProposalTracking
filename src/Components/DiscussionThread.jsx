// src/Components/DiscussionThread.jsx
import { useState, useRef, useEffect } from 'react';
import { MdSend, MdCheckCircle } from 'react-icons/md';
import { formatRelativeTime } from '../utils/highlightUtils';

const DiscussionThread = ({
  discussion,
  messages = [],
  onAddMessage,
  onResolve,
  userRole,
  onExpand,
  onCollapse,
  forceExpanded = false
}) => {
  const [replyText, setReplyText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const messagesEndRef = useRef(null);

  const viewerIsAdmin = userRole === 'admin' || userRole === 'superadmin';
  const expanded = forceExpanded || isExpanded;
  const messageCount = messages?.length || 0;
  const isResolved = discussion.status === 'resolved';

  useEffect(() => {
    if (expanded && onExpand) {
      onExpand(discussion.id);
    } else if (!expanded && onCollapse) {
      onCollapse(discussion.id);
    }
  }, [expanded, discussion.id, onExpand, onCollapse]);

  useEffect(() => {
    if (expanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, expanded]);

  const handleSendMessage = async () => {
    const cleanText = replyText.trim();
    if (!cleanText) return;

    setIsSending(true);
    try {
      await onAddMessage(discussion.id, cleanText);
      setReplyText('');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleResolve = async () => {
    setResolveError('');
    setShowResolveModal(true);
  };

  const confirmResolve = async () => {
    setIsResolving(true);
    setResolveError('');

    try {
      await onResolve(discussion.id);
      setShowResolveModal(false);
    } catch {
      setResolveError('Failed to resolve this discussion. Please try again.');
    } finally {
      setIsResolving(false);
    }
  };

  const closeResolveModal = () => {
    if (isResolving) return;
    setShowResolveModal(false);
    setResolveError('');
  };

  const getInitials = (nameOrEmail) => {
    if (!nameOrEmail) return 'U';
    const parts = String(nameOrEmail).split(/[.@\s_-]+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'U';
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  };

  const getMessageOwner = (message) => {
    const messageFromAdmin = message.senderRole === 'admin';
    const isOutgoing = viewerIsAdmin ? messageFromAdmin : !messageFromAdmin;
    const displayName = message.senderName || message.senderEmail || (messageFromAdmin ? 'Admin' : 'Client');

    return {
      isOutgoing,
      displayName,
      avatar: getInitials(displayName)
    };
  };

  return (
    <div style={{ ...styles.container, ...(isResolved ? styles.containerResolved : {}) }}>
      <div
        style={styles.header}
        onClick={() => {
          if (!forceExpanded) setIsExpanded((prev) => !prev);
        }}
      >
        <div style={styles.headerLeft}>
          <div
            style={{
              ...styles.colorIndicator,
              backgroundColor: discussion.highlightColor || '#FCD34D'
            }}
          />
          <div style={styles.headerInfo}>
            <div style={styles.highlightText}>
              "{discussion.highlightedText?.substring(0, 72)}
              {discussion.highlightedText?.length > 72 ? '...' : ''}"
            </div>
            <div style={styles.headerMeta}>
              Page {discussion.pageNumber} | {messageCount} message{messageCount !== 1 ? 's' : ''} |{' '}
              {formatRelativeTime(discussion.createdAt)}
            </div>
          </div>
        </div>

        <div style={styles.headerRight}>
          {isResolved && (
            <span style={styles.resolvedBadge}>
              <MdCheckCircle size={14} />
              Resolved
            </span>
          )}
          {!forceExpanded && <span style={styles.expandIcon}>{expanded ? 'v' : '>'}</span>}
        </div>
      </div>

      {expanded && (
        <div style={styles.expandedContent}>
          <div style={styles.contextSection}>
            <div style={styles.contextLabel}>Selected text context</div>
            <div style={styles.contextText}>{discussion.context || 'No additional context provided.'}</div>
          </div>

          <div style={styles.messagesContainer}>
            {messageCount === 0 ? (
              <div style={styles.noMessages}>No replies yet. Start the conversation.</div>
            ) : (
              messages.map((msg) => {
                const owner = getMessageOwner(msg);

                return (
                  <div
                    key={msg.id}
                    style={{
                      ...styles.messageRow,
                      ...(owner.isOutgoing ? styles.messageRowOutgoing : styles.messageRowIncoming)
                    }}
                  >
                    {!owner.isOutgoing && (
                      <div style={{ ...styles.avatar, ...styles.avatarIncoming }}>{owner.avatar}</div>
                    )}

                    <div
                      style={{
                        ...styles.messageBubble,
                        ...(owner.isOutgoing ? styles.messageBubbleOutgoing : styles.messageBubbleIncoming)
                      }}
                    >
                      <div style={styles.messageHeader}>
                        <span style={styles.senderName}>{owner.displayName}</span>
                        <span style={styles.messageTime}>{formatRelativeTime(msg.timestamp)}</span>
                      </div>
                      <div style={styles.messageBody}>{msg.message}</div>
                    </div>

                    {owner.isOutgoing && (
                      <div style={{ ...styles.avatar, ...styles.avatarOutgoing }}>{owner.avatar}</div>
                    )}
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {!isResolved && (
            <div style={styles.replySection}>
              <textarea
                rows={2}
                placeholder="Write a friendly reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isSending) {
                    e.preventDefault();
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
                  ...(isSending || !replyText.trim() ? styles.sendButtonDisabled : {})
                }}
                disabled={isSending || !replyText.trim()}
                title="Send message"
              >
                <MdSend size={18} />
              </button>
            </div>
          )}

          {viewerIsAdmin && !isResolved && (
            <div style={styles.adminActions}>
              <button onClick={handleResolve} style={styles.resolveButton}>
                <MdCheckCircle size={16} />
                Mark as Resolved
              </button>
            </div>
          )}

          <div style={styles.clientInfo}>
            <div style={styles.clientInfoLabel}>Client</div>
            <div>{discussion.clientName || discussion.clientEmail?.split('@')[0] || 'Client'}</div>
            <div style={styles.clientEmail}>{discussion.clientEmail}</div>
          </div>
        </div>
      )}

      {showResolveModal && (
        <div style={styles.resolveModalOverlay} onClick={closeResolveModal}>
          <div style={styles.resolveModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.resolveModalHeader}>
              <div style={styles.resolveModalTitle}>Mark discussion as resolved?</div>
              <div style={styles.resolveModalSubtitle}>
                This will close the thread and show it as resolved for everyone.
              </div>
            </div>

            <div style={styles.resolveModalBody}>
              <div style={styles.resolveContextLabel}>Discussion snippet</div>
              <div style={styles.resolveContextText}>
                "{discussion.highlightedText?.substring(0, 140)}
                {discussion.highlightedText?.length > 140 ? '...' : ''}"
              </div>
              {resolveError && <div style={styles.resolveError}>{resolveError}</div>}
            </div>

            <div style={styles.resolveModalActions}>
              <button
                type="button"
                onClick={closeResolveModal}
                disabled={isResolving}
                style={{
                  ...styles.resolveModalCancelButton,
                  ...(isResolving ? styles.resolveModalButtonDisabled : {})
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmResolve}
                disabled={isResolving}
                style={{
                  ...styles.resolveModalConfirmButton,
                  ...(isResolving ? styles.resolveModalButtonDisabled : {})
                }}
              >
                {isResolving ? 'Resolving...' : 'Yes, Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    marginBottom: '12px',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)'
  },
  containerResolved: {
    opacity: 0.85
  },
  header: {
    padding: '12px 14px',
    background: '#F8FAFC',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    cursor: 'pointer',
    borderBottom: '1px solid #EDF2F7'
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
    borderRadius: '999px',
    marginTop: '4px',
    flexShrink: 0
  },
  headerInfo: {
    flex: 1,
    minWidth: 0
  },
  highlightText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1E293B',
    whiteSpace: 'normal',
    overflow: 'visible',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    lineHeight: 1.4
  },
  headerMeta: {
    fontSize: '11px',
    color: '#64748B',
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
    gap: '4px',
    fontSize: '11px',
    color: '#059669',
    background: '#D1FAE5',
    padding: '4px 8px',
    borderRadius: '999px',
    fontWeight: 600
  },
  expandIcon: {
    fontSize: '12px',
    color: '#64748B',
    fontWeight: 700
  },
  expandedContent: {
    padding: '14px',
    background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)'
  },
  contextSection: {
    marginBottom: '12px',
    padding: '12px 14px',
    background: '#F8FAFC',
    borderRadius: '10px',
    border: '1px solid #D7E1EE',
    maxHeight: '118px',
    overflowY: 'auto'
  },
  contextLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: '4px'
  },
  contextText: {
    fontSize: '12px',
    color: '#334155',
    lineHeight: 1.55,
    fontStyle: 'italic',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word'
  },
  messagesContainer: {
    maxHeight: '330px',
    overflowY: 'auto',
    marginBottom: '12px',
    padding: '8px',
    background: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E2E8F0'
  },
  noMessages: {
    textAlign: 'center',
    padding: '22px 12px',
    color: '#64748B',
    fontSize: '12px',
    background: '#F8FAFC',
    borderRadius: '8px'
  },
  messageRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    marginBottom: '10px'
  },
  messageRowIncoming: {
    justifyContent: 'flex-start'
  },
  messageRowOutgoing: {
    justifyContent: 'flex-end'
  },
  avatar: {
    width: '24px',
    height: '24px',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 700,
    flexShrink: 0
  },
  avatarIncoming: {
    background: '#E2E8F0',
    color: '#334155'
  },
  avatarOutgoing: {
    background: '#DBEAFE',
    color: '#1D4ED8'
  },
  messageBubble: {
    maxWidth: '76%',
    borderRadius: '14px',
    padding: '8px 10px',
    fontSize: '13px',
    lineHeight: 1.45,
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)'
  },
  messageBubbleIncoming: {
    background: '#F1F5F9',
    color: '#0F172A',
    borderBottomLeftRadius: '4px'
  },
  messageBubbleOutgoing: {
    background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
    color: '#0F172A',
    borderBottomRightRadius: '4px'
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '4px'
  },
  senderName: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#334155',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  messageTime: {
    fontSize: '10px',
    color: '#64748B',
    flexShrink: 0
  },
  messageBody: {
    color: '#1E293B',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap'
  },
  replySection: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  replyInput: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #CBD5E1',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'none',
    lineHeight: 1.4
  },
  sendButton: {
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
    color: '#FFFFFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  sendButtonDisabled: {
    background: '#CBD5E1',
    cursor: 'not-allowed'
  },
  adminActions: {
    marginBottom: '12px'
  },
  resolveButton: {
    width: '100%',
    padding: '10px',
    background: '#10B981',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px'
  },
  clientInfo: {
    padding: '10px 12px',
    background: '#FFFFFF',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    fontSize: '12px',
    color: '#334155'
  },
  clientInfoLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: '#64748B',
    marginBottom: '4px'
  },
  clientEmail: {
    fontSize: '11px',
    color: '#64748B'
  },
  resolveModalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.56)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 10000
  },
  resolveModal: {
    width: 'min(100%, 500px)',
    background: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 24px 48px rgba(15, 23, 42, 0.26)',
    overflow: 'hidden'
  },
  resolveModalHeader: {
    padding: '18px 20px 14px',
    borderBottom: '1px solid #E2E8F0',
    background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)'
  },
  resolveModalTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: '#0F172A'
  },
  resolveModalSubtitle: {
    marginTop: '6px',
    fontSize: '13px',
    color: '#475569',
    lineHeight: 1.45
  },
  resolveModalBody: {
    padding: '14px 20px 6px'
  },
  resolveContextLabel: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#64748B',
    marginBottom: '6px'
  },
  resolveContextText: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    background: '#F8FAFC',
    color: '#1E293B',
    fontSize: '13px',
    lineHeight: 1.45
  },
  resolveError: {
    marginTop: '10px',
    fontSize: '12px',
    color: '#B91C1C',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    padding: '8px 10px',
    borderRadius: '8px'
  },
  resolveModalActions: {
    padding: '14px 20px 18px',
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap'
  },
  resolveModalCancelButton: {
    border: '1px solid #CBD5E1',
    background: '#FFFFFF',
    color: '#334155',
    borderRadius: '10px',
    padding: '9px 14px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  resolveModalConfirmButton: {
    border: '1px solid #059669',
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    color: '#FFFFFF',
    borderRadius: '10px',
    padding: '9px 14px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  resolveModalButtonDisabled: {
    opacity: 0.65,
    cursor: 'not-allowed'
  }
};

export default DiscussionThread;
