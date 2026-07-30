import { useState, useEffect, useRef } from 'react';
import {
  MdChat,
  MdSend,
  MdCheckCircle,
  MdClose,
  MdRefresh,
  MdSearch,
  MdFilterList,
  MdDescription,
  MdClear,
  MdArrowBack,
  MdOpenInNew,
  MdMarkChatRead,
  MdAccessTime
} from 'react-icons/md';
import { useClientDiscussions } from '../hooks/useClientDiscussions';
import { formatRelativeTime } from '../utils/highlightUtils';
import './ClientDiscussionCenter.css';

const formatDateShort = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp?.toDate?.() || new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function ClientDiscussionCenter({ userEmail, userId, userName = '' }) {
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, open, resolved
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const {
    discussions,
    messages,
    loading,
    error,
    addMessage,
    resolveDiscussion,
    loadDiscussionMessages,
    unloadDiscussionMessages,
    getUnresolvedCount,
    getDiscussionMessages
  } = useClientDiscussions(userEmail);

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedDiscussionId, messages]);

  // Load messages when discussion is selected
  useEffect(() => {
    if (selectedDiscussionId) {
      loadDiscussionMessages(selectedDiscussionId);
    }
    return () => {
      if (selectedDiscussionId) {
        unloadDiscussionMessages(selectedDiscussionId);
      }
    };
  }, [selectedDiscussionId, loadDiscussionMessages, unloadDiscussionMessages]);

  const handleSendMessage = async () => {
    if (!replyText.trim() || !selectedDiscussionId) return;

    setSendingMessage(true);
    try {
      await addMessage(selectedDiscussionId, replyText.trim(), userEmail, 'client');
      setReplyText('');
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message: ' + err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleResolveDiscussion = async (discussionId) => {
    if (!window.confirm('Mark this discussion as resolved?')) return;

    try {
      await resolveDiscussion(discussionId, userEmail);
      if (selectedDiscussionId === discussionId) {
        setSelectedDiscussionId(null);
      }
    } catch (err) {
      console.error('Error resolving discussion:', err);
      alert('Failed to resolve discussion');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // The hook automatically refetches, just clear selection briefly
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setRefreshing(false);
    }
  };

  // Filter discussions
  const filteredDiscussions = discussions.filter((discussion) => {
    const matchesSearch =
      discussion.proposalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      discussion.highlightedText?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'open' && discussion.status === 'open') ||
      (statusFilter === 'resolved' && discussion.status === 'resolved');

    return matchesSearch && matchesStatus;
  });

  const selectedDiscussion = discussions.find((d) => d.id === selectedDiscussionId);
  const discussionMsgs = getDiscussionMessages(selectedDiscussionId);

  const unresolvedCount = getUnresolvedCount();

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <MdChat size={48} style={styles.loadingIcon} />
          <p style={styles.loadingText}>Loading discussions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>Error: {error}</p>
        </div>
      </div>
    );
  }

  // Show selected discussion detail
  if (selectedDiscussion) {
    return (
      <div style={styles.container}>
        <div style={styles.discussionDetailPanel}>
          {/* Header */}
          <div style={styles.detailHeader}>
            <button
              style={styles.backButton}
              onClick={() => setSelectedDiscussionId(null)}
              title="Back to discussions"
            >
              <MdArrowBack size={20} />
            </button>
            <div style={styles.detailHeaderContent}>
              <h3 style={styles.detailTitle}>
                <MdDescription size={18} style={{ marginRight: '8px' }} />
                {selectedDiscussion.proposalName}
              </h3>
              <p style={styles.detailMeta}>
                Page {selectedDiscussion.pageNumber} • {formatDateShort(selectedDiscussion.createdAt)}
              </p>
            </div>
            {selectedDiscussion.status === 'open' && (
              <button
                style={styles.resolveButton}
                onClick={() => handleResolveDiscussion(selectedDiscussionId)}
                title="Mark as resolved"
              >
                <MdCheckCircle size={20} />
              </button>
            )}
            {selectedDiscussion.status === 'resolved' && (
              <div style={styles.resolvedBadge}>
                <MdCheckCircle size={16} />
                Resolved
              </div>
            )}
          </div>

          {/* Highlighted Text */}
          <div style={styles.highlightBox}>
            <div style={styles.highlightLabel}>Highlighted Text:</div>
            <div style={styles.highlightContent}>{selectedDiscussion.highlightedText}</div>
          </div>

          {/* Messages */}
          <div style={styles.messagesContainer}>
            {discussionMsgs.length === 0 ? (
              <div style={styles.noMessagesContainer}>
                <MdChat size={32} style={styles.noMessagesIcon} />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              discussionMsgs.map((message) => {
                const isAdmin = message.senderRole === 'admin' || message.senderRole === 'superadmin';
                return (
                  <div
                    key={message.id}
                    style={{
                      ...styles.messageWrapper,
                      justifyContent: isAdmin ? 'flex-start' : 'flex-end'
                    }}
                  >
                    <div
                      style={{
                        ...styles.message,
                        ...(isAdmin ? styles.adminMessage : styles.clientMessage)
                      }}
                    >
                      <div style={styles.messageSender}>
                        {isAdmin ? (
                          <>
                            <span style={styles.adminBadge}>Admin</span>
                            <span style={styles.messageTime}>
                              {formatRelativeTime(message.timestamp)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span>You</span>
                            <span style={styles.messageTime}>
                              {formatRelativeTime(message.timestamp)}
                            </span>
                          </>
                        )}
                      </div>
                      <div style={styles.messageContent}>{message.message}</div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {selectedDiscussion.status === 'open' && (
            <div style={styles.inputContainer}>
              <input
                type="text"
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !sendingMessage) {
                    handleSendMessage();
                  }
                }}
                style={styles.input}
                disabled={sendingMessage}
              />
              <button
                style={styles.sendButton}
                onClick={handleSendMessage}
                disabled={sendingMessage || !replyText.trim()}
              >
                {sendingMessage ? '...' : <MdSend size={20} />}
              </button>
            </div>
          )}

          {selectedDiscussion.status === 'resolved' && (
            <div style={styles.resolvedNotice}>
              <MdCheckCircle size={16} />
              This discussion has been resolved
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show discussions list
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h2 style={styles.title}>
            <MdChat size={24} style={{ marginRight: '10px' }} />
            Discussion Center
          </h2>
          <button
            style={styles.refreshButton}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh discussions"
          >
            <MdRefresh size={20} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Search & Filters */}
        <div style={styles.searchBar}>
          <MdSearch size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search discussions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button
              style={styles.clearButton}
              onClick={() => setSearchTerm('')}
            >
              <MdClear size={18} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div style={styles.filterTabs}>
          {['all', 'open', 'resolved'].map((filter) => (
            <button
              key={filter}
              style={{
                ...styles.filterTab,
                ...(statusFilter === filter ? styles.filterTabActive : styles.filterTabInactive)
              }}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'all' && `All (${discussions.length})`}
              {filter === 'open' && `Open (${unresolvedCount})`}
              {filter === 'resolved' && `Resolved (${discussions.filter((d) => d.status === 'resolved').length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Discussions List */}
      <div style={styles.discussionsList}>
        {filteredDiscussions.length === 0 ? (
          <div style={styles.emptyState}>
            <MdChat size={48} style={styles.emptyIcon} />
            <p style={styles.emptyText}>
              {searchTerm ? 'No discussions found' : 'No discussions yet'}
            </p>
            <p style={styles.emptySubtext}>
              {searchTerm ? 'Try adjusting your search' : 'Discussions will appear when admins share feedback'}
            </p>
          </div>
        ) : (
          filteredDiscussions.map((discussion) => (
            <div
              key={discussion.id}
              style={{
                ...styles.discussionItem,
                ...(selectedDiscussionId === discussion.id ? styles.discussionItemActive : {}),
                backgroundColor: discussion.status === 'resolved' ? '#f1f5f9' : '#ffffff'
              }}
              onClick={() => setSelectedDiscussionId(discussion.id)}
            >
              <div style={styles.discussionItemTop}>
                <div style={styles.discussionInfo}>
                  <h4 style={styles.discussionProposal}>{discussion.proposalName}</h4>
                  <p style={styles.discussionText}>
                    "{discussion.highlightedText.substring(0, 60)}
                    {discussion.highlightedText.length > 60 ? '...' : ''}"
                  </p>
                </div>
                <div style={styles.discussionMeta}>
                  {discussion.status === 'resolved' && (
                    <div style={styles.resolvedStatusBadge}>
                      <MdCheckCircle size={14} />
                    </div>
                  )}
                  {discussion.status === 'open' && (
                    <div style={styles.openStatusBadge}>Open</div>
                  )}
                </div>
              </div>

              <div style={styles.discussionItemBottom}>
                <div style={styles.discussionStats}>
                  <span style={styles.stat}>
                    <MdChat size={14} />
                    {(messages[discussion.id]?.length || 0)} messages
                  </span>
                  <span style={styles.stat}>
                    <MdAccessTime size={14} />
                    {formatDateShort(discussion.lastActivity || discussion.createdAt)}
                  </span>
                </div>
                <button
                  style={styles.openButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDiscussionId(discussion.id);
                  }}
                >
                  <MdOpenInNew size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    color: '#64748b'
  },
  loadingIcon: {
    color: '#94a3b8',
    marginBottom: '16px'
  },
  loadingText: {
    fontSize: '14px',
    color: '#64748b'
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    padding: '20px'
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center'
  },

  // Header styles
  header: {
    flex: '0 0 auto',
    padding: '16px',
    borderRight: '1px solid #e2e8f0',
    borderBottom: '1px solid #e2e8f0',
    minWidth: '300px',
    maxWidth: '400px',
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center'
  },
  refreshButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#64748b',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    transition: 'all 0.2s'
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '8px 12px'
  },
  searchIcon: {
    color: '#94a3b8',
    flexShrink: 0
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    fontFamily: 'inherit',
    color: '#1e293b'
  },
  clearButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  filterTabs: {
    display: 'flex',
    gap: '8px'
  },
  filterTab: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: '#ffffff'
  },
  filterTabActive: {
    backgroundColor: '#0ea5e9',
    color: '#ffffff',
    borderColor: '#0ea5e9'
  },
  filterTabInactive: {
    color: '#64748b',
    backgroundColor: '#f1f5f9'
  },

  // Discussions list
  discussionsList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#94a3b8',
    padding: '40px 20px'
  },
  emptyIcon: {
    marginBottom: '16px',
    color: '#cbd5e1'
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#64748b',
    margin: '0 0 8px 0'
  },
  emptySubtext: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: 0
  },
  discussionItem: {
    padding: '16px',
    borderBottom: '1px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  discussionItemActive: {
    backgroundColor: '#f0f9ff',
    borderLeft: '3px solid #0ea5e9'
  },
  discussionItemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px'
  },
  discussionInfo: {
    flex: 1,
    minWidth: 0
  },
  discussionProposal: {
    margin: '0 0 4px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  discussionText: {
    margin: 0,
    fontSize: '13px',
    color: '#64748b',
    lineHeight: '1.4'
  },
  discussionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  openStatusBadge: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#0d9488',
    backgroundColor: '#d1fae5',
    padding: '3px 8px',
    borderRadius: '4px',
    whiteSpace: 'nowrap'
  },
  resolvedStatusBadge: {
    color: '#10b981',
    display: 'flex',
    alignItems: 'center'
  },
  discussionItemBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  discussionStats: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#94a3b8'
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  openButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#64748b',
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    transition: 'all 0.2s'
  },

  // Discussion detail panel
  discussionDetailPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff'
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc'
  },
  backButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#64748b',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '6px',
    transition: 'all 0.2s'
  },
  detailHeaderContent: {
    flex: 1
  },
  detailTitle: {
    margin: '0 0 4px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center'
  },
  detailMeta: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8'
  },
  resolveButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#10b981',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '6px',
    transition: 'all 0.2s'
  },
  resolvedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#10b981',
    backgroundColor: '#d1fae5',
    padding: '6px 12px',
    borderRadius: '6px'
  },

  // Highlighted text
  highlightBox: {
    padding: '12px',
    backgroundColor: '#fffbeb',
    borderLeft: '3px solid #f59e0b',
    margin: '12px',
    borderRadius: '4px'
  },
  highlightLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#b45309',
    marginBottom: '6px'
  },
  highlightContent: {
    fontSize: '13px',
    color: '#1e293b',
    lineHeight: '1.5',
    fontStyle: 'italic'
  },

  // Messages
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  noMessagesContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#94a3b8'
  },
  noMessagesIcon: {
    color: '#cbd5e1',
    marginBottom: '12px'
  },
  messageWrapper: {
    display: 'flex',
    marginBottom: '4px'
  },
  message: {
    padding: '10px 12px',
    borderRadius: '8px',
    maxWidth: '70%',
    wordWrap: 'break-word'
  },
  adminMessage: {
    backgroundColor: '#dbeafe',
    color: '#0c4a6e'
  },
  clientMessage: {
    backgroundColor: '#e2e8f0',
    color: '#1e293b'
  },
  messageSender: {
    fontSize: '11px',
    fontWeight: '600',
    marginBottom: '4px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  messageTime: {
    fontSize: '10px',
    opacity: 0.7,
    fontWeight: 'normal'
  },
  adminBadge: {
    backgroundColor: '#0ea5e9',
    color: '#ffffff',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px'
  },
  messageContent: {
    fontSize: '14px',
    lineHeight: '1.4'
  },

  // Input
  inputContainer: {
    display: 'flex',
    gap: '8px',
    padding: '12px',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc'
  },
  input: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  sendButton: {
    padding: '10px 14px',
    backgroundColor: '#0ea5e9',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    fontWeight: '600'
  },
  resolvedNotice: {
    padding: '12px',
    backgroundColor: '#d1fae5',
    color: '#10b981',
    borderTop: '1px solid #e2e8f0',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }
};
