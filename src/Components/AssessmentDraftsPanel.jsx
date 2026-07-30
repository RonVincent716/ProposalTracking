import { useState, useEffect } from 'react';
import {
  MdDescription,
  MdEdit,
  MdDelete,
  MdSearch,
  MdRefresh,
  MdClear,
  MdFilterList,
  MdDone,
  MdWarning,
  MdMoreVert,
  MdArchive
} from 'react-icons/md';
import { useAssessmentDrafts } from '../hooks/useAssessmentDrafts';
import './AssessmentDraftsPanel.css';

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp?.toDate?.() || new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function AssessmentDraftsPanel({ adminUserId, adminEmail, onSelectDraft, onPublishDraft }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('draft');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deletingDraftId, setDeletingDraftId] = useState(null);

  const {
    drafts,
    loading,
    error,
    deleteDraft,
    searchDrafts
  } = useAssessmentDrafts(adminUserId, adminEmail);

  const filteredDrafts = searchDrafts(searchTerm, statusFilter);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  };

  const handleDeleteDraft = async (draftId) => {
    setDeletingDraftId(draftId);
    try {
      await deleteDraft(draftId);
      setShowDeleteConfirm(null);
      setSelectedDrafts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(draftId);
        return newSet;
      });
    } catch (err) {
      console.error('Error deleting draft:', err);
      alert('Failed to delete draft');
    } finally {
      setDeletingDraftId(null);
    }
  };

  const toggleSelectDraft = (draftId) => {
    setSelectedDrafts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(draftId)) {
        newSet.delete(draftId);
      } else {
        newSet.add(draftId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedDrafts.size === filteredDrafts.length) {
      setSelectedDrafts(new Set());
    } else {
      setSelectedDrafts(new Set(filteredDrafts.map((d) => d.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Delete ${selectedDrafts.size} draft(s)?`)) return;

    for (const draftId of selectedDrafts) {
      await deleteDraft(draftId);
    }
    setSelectedDrafts(new Set());
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading drafts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <MdWarning size={32} style={styles.errorIcon} />
          <p style={styles.errorText}>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <h2 style={styles.title}>
            <MdDescription size={24} style={{ marginRight: '12px' }} />
            Assessment Drafts
          </h2>
          <button
            style={styles.refreshButton}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh drafts"
          >
            <MdRefresh size={20} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Search & Filter */}
        <div style={styles.searchBar}>
          <MdSearch size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by client name, company, or email..."
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

        {/* Status Filter Tabs */}
        <div style={styles.filterTabs}>
          {['draft', 'published', 'all'].map((filter) => {
            const count =
              filter === 'draft'
                ? drafts.filter((d) => d.status === 'draft').length
                : filter === 'published'
                ? drafts.filter((d) => d.status === 'published').length
                : drafts.length;

            return (
              <button
                key={filter}
                style={{
                  ...styles.filterTab,
                  ...(statusFilter === filter ? styles.filterTabActive : styles.filterTabInactive)
                }}
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'draft' && `📋 Drafts (${count})`}
                {filter === 'published' && `✓ Published (${count})`}
                {filter === 'all' && `All (${count})`}
              </button>
            );
          })}
        </div>

        {/* Bulk Actions */}
        {selectedDrafts.size > 0 && (
          <div style={styles.bulkActions}>
            <span style={styles.selectionCount}>{selectedDrafts.size} selected</span>
            <button
              style={styles.bulkDeleteButton}
              onClick={handleDeleteSelected}
            >
              <MdDelete size={16} />
              Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* Drafts List */}
      <div style={styles.draftsList}>
        {filteredDrafts.length === 0 ? (
          <div style={styles.emptyState}>
            <MdDescription size={48} style={styles.emptyIcon} />
            <p style={styles.emptyText}>
              {searchTerm ? 'No drafts found' : 'No assessment drafts yet'}
            </p>
            <p style={styles.emptySubtext}>
              {searchTerm ? 'Try adjusting your search' : 'Drafts will be created when proposals are uploaded'}
            </p>
          </div>
        ) : (
          <>
            {/* Select All Checkbox */}
            <div style={styles.selectAllRow}>
              <input
                type="checkbox"
                checked={selectedDrafts.size === filteredDrafts.length && filteredDrafts.length > 0}
                onChange={handleSelectAll}
                style={styles.checkbox}
              />
              <span style={styles.selectAllLabel}>Select All</span>
            </div>

            {/* Draft Items */}
            {filteredDrafts.map((draft) => (
              <div key={draft.id} style={styles.draftItem}>
                <input
                  type="checkbox"
                  checked={selectedDrafts.has(draft.id)}
                  onChange={() => toggleSelectDraft(draft.id)}
                  style={styles.checkbox}
                />

                <div style={styles.draftContent}>
                  {/* Top Row */}
                  <div style={styles.draftTop}>
                    <div style={styles.draftInfo}>
                      <h4 style={styles.draftTitle}>{draft.companyName || 'Untitled Draft'}</h4>
                      <p style={styles.draftClient}>
                        {draft.clientName || 'No client'} • {draft.clientEmail}
                      </p>
                    </div>

                    <div style={styles.draftMeta}>
                      {draft.status === 'draft' && (
                        <span style={styles.draftBadge}>🟡 Draft</span>
                      )}
                      {draft.status === 'published' && (
                        <span style={styles.publishedBadge}>✓ Published</span>
                      )}
                    </div>
                  </div>

                  {/* Progress Row */}
                  <div style={styles.draftBottom}>
                    <div style={styles.progressContainer}>
                      <div style={styles.progressBar}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${draft.completionPercentage || 0}%`,
                            backgroundColor:
                              (draft.completionPercentage || 0) >= 90
                                ? '#10b981'
                                : (draft.completionPercentage || 0) >= 50
                                ? '#f59e0b'
                                : '#ef4444'
                          }}
                        ></div>
                      </div>
                      <span style={styles.progressText}>{draft.completionPercentage || 0}%</span>
                    </div>

                    <div style={styles.draftStats}>
                      <span style={styles.stat}>
                        Last edited {formatDate(draft.updatedAt)} by {draft.lastEditedByName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={styles.draftActions}>
                  {draft.status === 'draft' && (
                    <>
                      <button
                        style={styles.actionButton}
                        onClick={() => onSelectDraft(draft.id)}
                        title="Continue editing"
                      >
                        <MdEdit size={18} />
                      </button>
                      <button
                        style={styles.actionButton}
                        onClick={() => onPublishDraft(draft.id)}
                        title="Publish draft"
                      >
                        <MdDone size={18} />
                      </button>
                    </>
                  )}

                  <div style={styles.moreMenu}>
                    <button
                      style={styles.moreButton}
                      onClick={() => setShowDeleteConfirm(draft.id)}
                      title="Delete draft"
                    >
                      <MdDelete size={18} />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation */}
                {showDeleteConfirm === draft.id && (
                  <div style={styles.deleteConfirm}>
                    <p style={styles.deleteConfirmText}>Delete this draft?</p>
                    <div style={styles.deleteConfirmButtons}>
                      <button
                        style={styles.deleteConfirmYes}
                        onClick={() => handleDeleteDraft(draft.id)}
                        disabled={deletingDraftId === draft.id}
                      >
                        {deletingDraftId === draft.id ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button
                        style={styles.deleteConfirmNo}
                        onClick={() => setShowDeleteConfirm(null)}
                        disabled={deletingDraftId === draft.id}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
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
    color: '#64748b'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #0ea5e9',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px'
  },
  loadingText: {
    fontSize: '14px',
    margin: 0
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#dc2626',
    padding: '20px'
  },
  errorIcon: {
    marginBottom: '12px'
  },
  errorText: {
    textAlign: 'center',
    margin: 0
  },

  // Header
  header: {
    padding: '16px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  titleRow: {
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
  bulkActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: '#e0f2fe',
    borderRadius: '6px'
  },
  selectionCount: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#0369a1'
  },
  bulkDeleteButton: {
    marginLeft: 'auto',
    padding: '6px 12px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },

  // Drafts List
  draftsList: {
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
    color: '#cbd5e1',
    marginBottom: '16px'
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
  selectAllRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#0ea5e9'
  },
  selectAllLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#64748b'
  },
  draftItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '14px 16px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    transition: 'background-color 0.2s',
    position: 'relative'
  },
  draftContent: {
    flex: 1,
    minWidth: 0
  },
  draftTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '10px',
    gap: '12px'
  },
  draftInfo: {
    flex: 1,
    minWidth: 0
  },
  draftTitle: {
    margin: '0 0 4px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  draftClient: {
    margin: 0,
    fontSize: '13px',
    color: '#64748b'
  },
  draftMeta: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0
  },
  draftBadge: {
    fontSize: '11px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    whiteSpace: 'nowrap'
  },
  publishedBadge: {
    fontSize: '11px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    whiteSpace: 'nowrap'
  },
  draftBottom: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  progressContainer: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  progressBar: {
    flex: 1,
    height: '4px',
    backgroundColor: '#e2e8f0',
    borderRadius: '2px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s'
  },
  progressText: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    whiteSpace: 'nowrap'
  },
  draftStats: {
    display: 'flex',
    alignItems: 'center'
  },
  stat: {
    fontSize: '12px',
    color: '#94a3b8',
    whiteSpace: 'nowrap'
  },
  draftActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0
  },
  actionButton: {
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
  moreMenu: {
    display: 'flex'
  },
  moreButton: {
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
  deleteConfirm: {
    position: 'absolute',
    bottom: '0',
    left: '0',
    right: '0',
    backgroundColor: '#fee2e2',
    padding: '12px 16px',
    borderTop: '1px solid #fecaca',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px'
  },
  deleteConfirmText: {
    margin: 0,
    fontSize: '13px',
    fontWeight: '600',
    color: '#991b1b'
  },
  deleteConfirmButtons: {
    display: 'flex',
    gap: '8px'
  },
  deleteConfirmYes: {
    padding: '6px 12px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600'
  },
  deleteConfirmNo: {
    padding: '6px 12px',
    backgroundColor: '#ffffff',
    color: '#dc2626',
    border: '1px solid #dc2626',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600'
  }
};
