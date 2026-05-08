// src/Components/DiscussionPanel.jsx
import { useState, useEffect } from 'react';
import { MdClose, MdRefresh, MdFilter } from 'react-icons/md';
import { useProposalDiscussions } from '../hooks/useProposalDiscussions';
import { getSelectedTextData, highlightTextInDOM, getColorForDiscussion, generateHighlightId } from '../utils/highlightUtils';
import DiscussionThread from './DiscussionThread';
import { ActivityLogger } from '../utils/activityLogger';

const DiscussionPanel = ({
  isOpen,
  onClose,
  proposalId,
  proposalName,
  filePath,
  currentPage,
  userId,
  userEmail,
  userRole,
  highlightModeActive = false,
  onHighlightModeChange
}) => {
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, open, resolved
  const [refreshing, setRefreshing] = useState(false);
  const [expandedDiscussion, setExpandedDiscussion] = useState(null);

  const {
    discussions,
    messages,
    loading,
    error,
    addDiscussion,
    addMessage,
    resolveDiscussion,
    loadDiscussionMessages,
    unloadDiscussionMessages,
    getDiscussionsForPage,
    getUnresolvedCount
  } = useProposalDiscussions(proposalId, proposalName, filePath, userId, userEmail, userRole);

  // Render highlights for all discussions on current page
  useEffect(() => {
    const pageDiscussions = getDiscussionsForPage(currentPage);
    pageDiscussions.forEach((discussion, index) => {
      const color = getColorForDiscussion(discussion.id, index);
      highlightTextInDOM(
        document.querySelector('[data-testid="pdf-page"]') || document.body,
        discussion.highlightedText,
        color,
        discussion.id
      );
    });
  }, [discussions, currentPage, getDiscussionsForPage]);

  // Handle text selection and highlight
  useEffect(() => {
    if (!highlightModeActive) {
      console.log('Highlight mode OFF, not attaching mouseup listener');
      return;
    }

    console.log('Highlight mode ON, attaching mouseup listener');

    const handleMouseUp = async () => {
      console.log('=== MOUSEUP EVENT FIRED ===');
      const selectedData = getSelectedTextData();
      console.log('Text selected:', selectedData);
      if (!selectedData) {
        console.log('No valid text selection, returning');
        return;
      }

      // Prompt user to confirm highlight
      const shouldHighlight = window.confirm(
        `Highlight: "${selectedData.text.substring(0, 50)}..."?\n\nClick OK to create a discussion.`
      );

      console.log('User clicked dialog:', shouldHighlight ? 'OK' : 'CANCEL');

      if (!shouldHighlight) {
        window.getSelection().removeAllRanges();
        return;
      }

      try {
        console.log('Creating discussion with data:', {
          text: selectedData.text,
          context: selectedData.context,
          pageNumber: currentPage,
          proposalId,
          userId
        });

        const discussionId = await addDiscussion({
          text: selectedData.text,
          context: selectedData.context,
          color: '#FFFF00',
          pageNumber: currentPage,
          startIndex: selectedData.startIndex,
          endIndex: selectedData.endIndex
        });

        console.log('Discussion created successfully:', discussionId);

        // Show the new discussion in the panel
        setExpandedDiscussion(discussionId);
        loadDiscussionMessages(discussionId);

        window.getSelection().removeAllRanges();
      } catch (err) {
        console.error('Error creating discussion:', err);
        alert('Failed to create discussion: ' + err.message);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    console.log('Mouseup listener attached');
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      console.log('Mouseup listener removed');
    };
  }, [highlightModeActive, currentPage, addDiscussion, loadDiscussionMessages, proposalId, userId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Re-render highlights
      const pageDiscussions = getDiscussionsForPage(currentPage);
      pageDiscussions.forEach((discussion, index) => {
        const color = getColorForDiscussion(discussion.id, index);
        highlightTextInDOM(
          document.querySelector('[data-testid="pdf-page"]') || document.body,
          discussion.highlightedText,
          color,
          discussion.id
        );
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Filter discussions based on status
  const filteredDiscussions = discussions.filter(d => {
    if (selectedFilter === 'open') return d.status === 'open';
    if (selectedFilter === 'resolved') return d.status === 'resolved';
    return true; // 'all'
  });

  const unresolvedCount = getUnresolvedCount();
  const pageDiscussions = filteredDiscussions.filter(d => d.pageNumber === currentPage);

  return (
    <div style={{ ...styles.container, ...(isOpen ? styles.containerOpen : styles.containerClosed) }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={styles.title}>Discussions</span>
          {unresolvedCount > 0 && (
            <span style={styles.badge}>{unresolvedCount}</span>
          )}
        </div>
        <div style={styles.headerActions}>
          <button
            onClick={handleRefresh}
            style={styles.iconButton}
            title="Refresh highlights"
            disabled={refreshing}
          >
            <MdRefresh size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={onClose}
            style={styles.iconButton}
            title="Close panel"
          >
            <MdClose size={18} />
          </button>
        </div>
      </div>

      {/* Highlight mode info */}
      <div style={styles.modeInfo}>
        <div style={{ ...styles.modeIndicator, ...(highlightModeActive ? styles.modeIndicatorActive : {}) }}>
          {highlightModeActive ? '✓ Highlight Mode ON' : 'Highlight Mode OFF'}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={styles.filterTabs}>
        {['all', 'open', 'resolved'].map(filter => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            style={{
              ...styles.filterTab,
              ...(selectedFilter === filter ? styles.filterTabActive : {})
            }}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
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
            <div>No {selectedFilter !== 'all' ? selectedFilter : ''} discussions yet.</div>
            {highlightModeActive && (
              <div style={styles.emptySubtext}>Highlight text to start discussing!</div>
            )}
          </div>
        )}

        {!loading && !error && filteredDiscussions.length > 0 && (
          <>
            {/* Page-specific discussions */}
            {pageDiscussions.length > 0 && (
              <div>
                <div style={styles.sectionLabel}>On this page ({currentPage})</div>
                {pageDiscussions.map(discussion => (
                  <DiscussionThread
                    key={discussion.id}
                    discussion={discussion}
                    messages={messages[discussion.id] || []}
                    onAddMessage={addMessage}
                    onResolve={resolveDiscussion}
                    userRole={userRole}
                    userId={userId}
                    onClose={() => unloadDiscussionMessages(discussion.id)}
                    onExpand={loadDiscussionMessages}
                    onCollapse={unloadDiscussionMessages}
                  />
                ))}
              </div>
            )}

            {/* Other page discussions */}
            {filteredDiscussions.filter(d => d.pageNumber !== currentPage).length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={styles.sectionLabel}>On other pages</div>
                {filteredDiscussions
                  .filter(d => d.pageNumber !== currentPage)
                  .sort((a, b) => a.pageNumber - b.pageNumber)
                  .map(discussion => (
                    <DiscussionThread
                      key={discussion.id}
                      discussion={discussion}
                      messages={messages[discussion.id] || []}
                      onAddMessage={addMessage}
                      onResolve={resolveDiscussion}
                      userRole={userRole}
                      userId={userId}
                      onClose={() => unloadDiscussionMessages(discussion.id)}
                      onExpand={loadDiscussionMessages}
                      onCollapse={unloadDiscussionMessages}
                    />
                  ))}
              </div>
            )}
          </>
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
    width: '400px',
    height: '100vh',
    background: '#ffffff',
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: '#e0e0e0',
    boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 999,
    transition: 'transform 0.3s ease',
    fontFamily: "'Inter', sans-serif"
  },
  containerOpen: {
    transform: 'translateX(0)'
  },
  containerClosed: {
    transform: 'translateX(100%)',
    pointerEvents: 'none'
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
    background: '#FF6B6B',
    color: 'white',
    fontSize: '11px',
    fontWeight: 'bold',
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
  modeInfo: {
    padding: '10px 14px',
    background: '#FFF3CD',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#FFD700',
    flexShrink: 0
  },
  modeIndicator: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#856404',
    display: 'flex',
    alignItems: 'center'
  },
  modeIndicatorActive: {
    color: '#10B981',
    background: '#D1F2EB',
    padding: '6px 10px',
    borderRadius: '4px'
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
    flex: 1,
    padding: '8px 12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    background: '#ffffff',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#666',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  filterTabActive: {
    background: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px',
    background: '#ffffff'
  },
  centerMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
    color: '#888',
    fontSize: '13px'
  },
  spinner: {
    width: '24px',
    height: '24px',
    borderWidth: '3px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '12px'
  },
  errorMessage: {
    padding: '12px',
    background: '#FEE2E2',
    borderRadius: '6px',
    color: '#991B1B',
    fontSize: '12px',
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start'
  },
  errorIcon: {
    fontSize: '16px',
    flexShrink: 0
  },
  emptyIcon: {
    fontSize: '32px',
    marginBottom: '8px'
  },
  emptySubtext: {
    fontSize: '11px',
    color: '#aaa',
    marginTop: '8px'
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: '#888',
    padding: '8px 0 12px 0',
    marginBottom: '8px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#e0e0e0'
  }
};

export default DiscussionPanel;
