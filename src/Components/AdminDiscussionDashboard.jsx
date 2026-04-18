// src/Components/AdminDiscussionDashboard.jsx
import { useState, useEffect } from 'react';
import { MdClose, MdRefresh, MdCheckCircle, MdArrowBack } from 'react-icons/md';
import { db } from '../firebase';
import { collection, query, onSnapshot, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import DiscussionThread from './DiscussionThread';

const AdminDiscussionDashboard = ({ userId, userEmail, userRole, onClose }) => {
  const [selectedFilter, setSelectedFilter] = useState('open');
  const [allProposalDiscussions, setAllProposalDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(null);
  const [discussionMessages, setDiscussionMessages] = useState({});
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Load all discussions in real-time
  useEffect(() => {
    if (userRole !== 'admin') {
      setError('Only admins can access this dashboard');
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'proposalDiscussions'));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const discussions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          resolvedAt: doc.data().resolvedAt?.toDate?.() || null
        }));
        discussions.sort((a, b) => b.createdAt - a.createdAt);
        setAllProposalDiscussions(discussions);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading all discussions:', err);
        setError('Failed to load discussions');
        setLoading(false);
      }
    );

    return () => unsubscribe?.();
  }, [userRole]);

  // Load messages for selected discussion
  useEffect(() => {
    if (!selectedDiscussionId) return;

    setLoadingMessages(true);
    const q = query(
      collection(db, 'proposalDiscussionMessages')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messages = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || new Date()
          }))
          .filter(msg => msg.discussionId === selectedDiscussionId)
          .sort((a, b) => a.timestamp - b.timestamp);
        
        setDiscussionMessages(prev => ({
          ...prev,
          [selectedDiscussionId]: messages
        }));
        setLoadingMessages(false);
      },
      (err) => {
        console.error('Error loading messages:', err);
        setLoadingMessages(false);
      }
    );

    return () => unsubscribe?.();
  }, [selectedDiscussionId]);

  // Handle adding message
  const handleAddMessage = async (discussionId, messageText) => {
    try {
      await addDoc(collection(db, 'proposalDiscussionMessages'), {
        discussionId,
        senderId: userId,
        senderEmail: userEmail,
        senderName: userEmail?.split('@')[0] || 'Admin',
        senderRole: 'admin',
        message: messageText,
        timestamp: serverTimestamp(),
        isRead: false
      });

      // Update message count
      const discussion = allProposalDiscussions.find(d => d.id === discussionId);
      if (discussion) {
        const currentCount = discussionMessages[discussionId]?.length || 0;
        await updateDoc(doc(db, 'proposalDiscussions', discussionId), {
          messageCount: currentCount + 1,
          lastActivity: serverTimestamp()
        });
      }
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message');
    }
  };

  // Handle resolving discussion
  const handleResolveDiscussion = async (discussionId) => {
    try {
      await updateDoc(doc(db, 'proposalDiscussions', discussionId), {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: userId
      });
      setSelectedDiscussionId(null);
    } catch (err) {
      console.error('Error resolving discussion:', err);
      alert('Failed to resolve discussion');
    }
  };

  // Filter discussions
  const filteredDiscussions = allProposalDiscussions.filter(d => {
    if (selectedFilter === 'open') return d.status === 'open';
    if (selectedFilter === 'resolved') return d.status === 'resolved';
    return true;
  });

  const unresolvedCount = allProposalDiscussions.filter(d => d.status === 'open').length;
  const selectedDiscussion = allProposalDiscussions.find(d => d.id === selectedDiscussionId);

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  if (selectedDiscussionId && selectedDiscussion) {
    return (
      <div style={styles.container}>
        {/* Detail view */}
        <div style={styles.detailView}>
          <div style={styles.detailHeader}>
            <button
              onClick={() => setSelectedDiscussionId(null)}
              style={styles.backButton}
              title="Back to list"
            >
              <MdArrowBack size={18} />
            </button>
            <div>
              <div style={styles.detailTitle}>{selectedDiscussion.proposalName}</div>
              <div style={styles.detailMeta}>
                Page {selectedDiscussion.pageNumber} • {selectedDiscussion.clientEmail}
              </div>
            </div>
          </div>

          <DiscussionThread
            discussion={selectedDiscussion}
            messages={discussionMessages[selectedDiscussionId] || []}
            onAddMessage={handleAddMessage}
            onResolve={handleResolveDiscussion}
            userRole={userRole}
            userId={userId}
          />
        </div>
        
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={styles.title}>Admin Discussion Center</span>
          {unresolvedCount > 0 && (
            <span style={styles.badge}>{unresolvedCount}</span>
          )}
        </div>
        <div style={styles.headerActions}>
          <button
            onClick={handleRefresh}
            style={styles.iconButton}
            title="Refresh discussions"
            disabled={refreshing}
          >
            <MdRefresh size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={onClose}
            style={styles.iconButton}
            title="Close dashboard"
          >
            <MdClose size={18} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={styles.filterTabs}>
        {[
          { key: 'open', label: 'Open', count: allProposalDiscussions.filter(d => d.status === 'open').length },
          { key: 'resolved', label: 'Resolved', count: allProposalDiscussions.filter(d => d.status === 'resolved').length },
          { key: 'all', label: 'All', count: allProposalDiscussions.length }
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setSelectedFilter(filter.key)}
            style={{
              ...styles.filterTab,
              ...(selectedFilter === filter.key ? styles.filterTabActive : {})
            }}
          >
            {filter.label}
            {filter.count > 0 && <span style={styles.filterCount}>{filter.count}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {loading && (
          <div style={styles.centerMessage}>
            <div style={styles.spinner} />
            <div>Loading discussions...</div>
          </div>
        )}

        {error && (
          <div style={styles.errorMessage}>
            <div style={styles.errorIcon}>⚠️</div>
            <div>{error}</div>
          </div>
        )}

        {!loading && !error && filteredDiscussions.length === 0 && (
          <div style={styles.centerMessage}>
            <div style={styles.emptyIcon}>💬</div>
            <div>No {selectedFilter !== 'all' ? selectedFilter : ''} discussions.</div>
          </div>
        )}

        {!loading && !error && filteredDiscussions.length > 0 && (
          <div>
            {filteredDiscussions.map(discussion => (
              <div
                key={discussion.id}
                style={{
                  ...styles.discussionCard,
                  ...(selectedDiscussionId === discussion.id ? styles.discussionCardActive : {})
                }}
                onClick={() => setSelectedDiscussionId(discussion.id)}
              >
                <div style={styles.discussionHeader}>
                  <div style={styles.discussionMeta}>
                    <span style={styles.proposalName}>{discussion.proposalName}</span>
                    <span style={styles.pageNumber}>Page {discussion.pageNumber}</span>
                  </div>
                  {discussion.status === 'resolved' && (
                    <span style={styles.resolvedBadge}>
                      <MdCheckCircle size={14} style={{ marginRight: '4px' }} />
                      Resolved
                    </span>
                  )}
                </div>
                <div style={styles.clientInfo}>
                  <span style={styles.clientEmail}>{discussion.clientEmail}</span>
                  {discussion.messageCount > 0 && (
                    <span style={styles.messageCount}>{discussion.messageCount} messages</span>
                  )}
                </div>
                <div style={styles.highlightPreview}>
                  "{discussion.highlightedText?.substring(0, 60)}
                  {discussion.highlightedText?.length > 60 ? '...' : ''}"
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '500px',
    height: '100vh',
    background: '#ffffff',
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: '#e0e0e0',
    boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 998,
    fontFamily: "'Inter', sans-serif"
  },
  detailView: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  },
  detailHeader: {
    padding: '12px 14px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#fafafa',
    flexShrink: 0
  },
  backButton: {
    padding: '6px',
    background: 'transparent',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  },
  detailTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333'
  },
  detailMeta: {
    fontSize: '11px',
    color: '#888'
  },
  header: {
    padding: '16px 14px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fafafa',
    flexShrink: 0
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333'
  },
  badge: {
    background: '#ef4444',
    color: '#fff',
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '12px',
    minWidth: '24px',
    textAlign: 'center'
  },
  headerActions: {
    display: 'flex',
    gap: '8px'
  },
  iconButton: {
    padding: '6px',
    background: 'transparent',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    transition: 'all 0.2s ease'
  },
  filterTabs: {
    display: 'flex',
    gap: '8px',
    padding: '12px 14px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#e0e0e0',
    background: '#fafafa',
    flexShrink: 0
  },
  filterTab: {
    padding: '8px 12px',
    background: '#f0f0f0',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  filterTabActive: {
    background: '#2196F3',
    borderColor: '#1976D2',
    color: '#fff'
  },
  filterCount: {
    background: 'rgba(255,255,255,0.3)',
    padding: '0 4px',
    borderRadius: '3px',
    fontSize: '11px'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 14px'
  },
  centerMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888',
    textAlign: 'center'
  },
  spinner: {
    width: '40px',
    height: '40px',
    borderWidth: '3px',
    borderStyle: 'solid',
    borderColor: '#f3f3f3',
    borderTopColor: '#2196F3',
    borderRadius: '50%',
    marginBottom: '16px'
  },
  errorMessage: {
    background: '#FEE2E2',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#FCA5A5',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    color: '#991B1B'
  },
  errorIcon: {
    fontSize: '20px',
    flexShrink: 0
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '12px'
  },
  discussionCard: {
    background: '#ffffff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  discussionCardActive: {
    background: '#E3F2FD',
    borderColor: '#2196F3'
  },
  discussionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px'
  },
  discussionMeta: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  proposalName: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#333',
    maxWidth: '250px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  pageNumber: {
    fontSize: '11px',
    color: '#888',
    background: '#f0f0f0',
    padding: '2px 6px',
    borderRadius: '3px'
  },
  clientInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '11px',
    marginBottom: '8px',
    color: '#666'
  },
  clientEmail: {
    fontWeight: '500'
  },
  messageCount: {
    background: '#2196F3',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px'
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
  highlightPreview: {
    fontSize: '12px',
    color: '#555',
    fontStyle: 'italic',
    lineHeight: '1.4'
  }
};

export default AdminDiscussionDashboard;
