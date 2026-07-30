import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MdArrowBack,
  MdSave,
  MdPublish,
  MdDelete,
  MdCheck,
  MdHistory,
  MdAccessTime
} from 'react-icons/md';
import { useAssessmentDrafts } from '../hooks/useAssessmentDrafts';
import './AssessmentDraftEditor.css';

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp?.toDate?.() || new Date(timestamp);
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

export default function AssessmentDraftEditor({
  draftId,
  adminUserId,
  adminEmail,
  onBack,
  onPublish
}) {
  const [draft, setDraft] = useState(null);
  const [draftData, setDraftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    saveDraft,
    autoSaveDraft,
    deleteDraft,
    getDraft,
    publishDraft,
    getDraftHistory,
    calculateCompletion
  } = useAssessmentDrafts(adminUserId, adminEmail, true); // Skip listener to avoid conflicts with AssessmentDraftsPanel

  const autoSaveTimeoutRef = useRef(null);
  const draftHistoryRef = useRef([]);

  // Load draft
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const loadedDraft = await getDraft(draftId);
        if (loadedDraft) {
          setDraft(loadedDraft);
          setDraftData({
            clientName: loadedDraft.clientName || '',
            companyName: loadedDraft.companyName || '',
            industry: loadedDraft.industry || '',
            phone: loadedDraft.phone || '',
            website: loadedDraft.website || '',
            companyOverview: loadedDraft.companyOverview || '',
            strengths: loadedDraft.strengths || '',
            gaps: loadedDraft.gaps || '',
            recommendation: loadedDraft.recommendation || '',
            readinessScore: loadedDraft.readinessScore || 60,
            riskLevel: loadedDraft.riskLevel || 'medium',
            adminNotes: loadedDraft.adminNotes || ''
          });
          const history = await getDraftHistory(draftId);
          draftHistoryRef.current = history;
        }
      } catch (err) {
        console.error('Error loading draft:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDraft();
  }, [draftId, getDraft, getDraftHistory]);

  // Auto-save on changes
  useEffect(() => {
    if (!draftData || draft?.status === 'published') return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await autoSaveDraft(draftId, draftData);
      } catch (err) {
        console.error('Error auto-saving:', err);
      }
    }, 2000);

    return () => clearTimeout(autoSaveTimeoutRef.current);
  }, [draftData, draftId, autoSaveDraft, draft?.status]);

  const handleFieldChange = (field, value) => {
    setDraftData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleManualSave = async () => {
    try {
      await saveDraft(draftId, draftData);
      alert('Draft saved successfully!');
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishDraft(draftId, draftData);
      alert('Assessment published successfully!');
      setShowPublishConfirm(false);
      if (onPublish) onPublish(draftId);
    } catch (err) {
      alert('Failed to publish: ' + err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this draft? This action cannot be undone.')) return;

    setDeleting(true);
    try {
      await deleteDraft(draftId);
      alert('Draft deleted');
      onBack();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p>Loading draft...</p>
        </div>
      </div>
    );
  }

  if (!draftData) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <p>Draft not found</p>
          <button style={styles.backLink} onClick={onBack}>
            ← Back to Drafts
          </button>
        </div>
      </div>
    );
  }

  const completion = calculateCompletion(draftData);
  const isPublished = draft?.status === 'published';

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onBack} title="Back to drafts">
          <MdArrowBack size={20} />
        </button>
        <div style={styles.headerTitle}>
          <h2 style={styles.title}>{draftData.companyName || 'Untitled Draft'}</h2>
          <p style={styles.subtitle}>
            {draftData.clientName} • {draftData.clientEmail || 'No email'}
          </p>
        </div>
        <div style={styles.headerRight}>
          {isPublished && (
            <div style={styles.publishedBadge}>✓ Published</div>
          )}
          {!isPublished && (
            <div style={styles.completionBadge(completion)}>
              {completion}% Complete
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Tabs */}
        <div style={styles.tabsContainer}>
          <button
            style={{
              ...styles.tab,
              ...(showHistory ? {} : styles.tabActive)
            }}
            onClick={() => setShowHistory(false)}
          >
            Edit
          </button>
          <button
            style={{
              ...styles.tab,
              ...(showHistory ? styles.tabActive : {})
            }}
            onClick={() => setShowHistory(true)}
          >
            <MdHistory size={16} />
            History
          </button>
        </div>

        {!showHistory ? (
          /* Edit Tab */
          <div style={styles.formContainer}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Client Information</h3>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Client Name</label>
                  <input
                    type="text"
                    value={draftData.clientName}
                    onChange={(e) => handleFieldChange('clientName', e.target.value)}
                    placeholder="John Smith"
                    style={styles.input}
                    disabled={isPublished}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    value={draftData.clientEmail || ''}
                    placeholder="john@example.com"
                    style={{...styles.input, backgroundColor: '#f1f5f9'}}
                    disabled
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Company Name</label>
                  <input
                    type="text"
                    value={draftData.companyName}
                    onChange={(e) => handleFieldChange('companyName', e.target.value)}
                    placeholder="Acme Corp"
                    style={styles.input}
                    disabled={isPublished}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Industry</label>
                  <input
                    type="text"
                    value={draftData.industry}
                    onChange={(e) => handleFieldChange('industry', e.target.value)}
                    placeholder="Technology"
                    style={styles.input}
                    disabled={isPublished}
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Phone</label>
                  <input
                    type="tel"
                    value={draftData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    style={styles.input}
                    disabled={isPublished}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Website</label>
                  <input
                    type="url"
                    value={draftData.website}
                    onChange={(e) => handleFieldChange('website', e.target.value)}
                    placeholder="https://example.com"
                    style={styles.input}
                    disabled={isPublished}
                  />
                </div>
              </div>
            </div>

            {/* Assessment Content */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Assessment Content</h3>

              <div style={styles.formGroup}>
                <label style={styles.label}>Company Overview</label>
                <textarea
                  value={draftData.companyOverview}
                  onChange={(e) => handleFieldChange('companyOverview', e.target.value)}
                  placeholder="Summarize the client and their situation..."
                  style={styles.textarea}
                  rows="3"
                  disabled={isPublished}
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>What Looks Strong</label>
                  <textarea
                    value={draftData.strengths}
                    onChange={(e) => handleFieldChange('strengths', e.target.value)}
                    placeholder="List strengths detected from client record..."
                    style={styles.textarea}
                    rows="3"
                    disabled={isPublished}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>What is Missing</label>
                  <textarea
                    value={draftData.gaps}
                    onChange={(e) => handleFieldChange('gaps', e.target.value)}
                    placeholder="List gaps or risks to address..."
                    style={styles.textarea}
                    rows="3"
                    disabled={isPublished}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Recommendation</label>
                <textarea
                  value={draftData.recommendation}
                  onChange={(e) => handleFieldChange('recommendation', e.target.value)}
                  placeholder="Write your recommended action for this proposal..."
                  style={styles.textarea}
                  rows="3"
                  disabled={isPublished}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Admin Notes</label>
                <textarea
                  value={draftData.adminNotes}
                  onChange={(e) => handleFieldChange('adminNotes', e.target.value)}
                  placeholder="Internal notes for your team..."
                  style={styles.textarea}
                  rows="2"
                  disabled={isPublished}
                />
              </div>
            </div>

            {/* Scoring */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Assessment Scores</h3>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Readiness Score</label>
                  <div style={styles.scoreInput}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={draftData.readinessScore}
                      onChange={(e) => handleFieldChange('readinessScore', Number(e.target.value))}
                      style={styles.slider}
                      disabled={isPublished}
                    />
                    <span style={styles.scoreValue}>{draftData.readinessScore}%</span>
                  </div>
                  <div style={styles.scoreLabel}>
                    {draftData.readinessScore >= 75 ? 'High' : draftData.readinessScore >= 50 ? 'Medium' : 'Low'}
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Risk Level</label>
                  <select
                    value={draftData.riskLevel}
                    onChange={(e) => handleFieldChange('riskLevel', e.target.value)}
                    style={styles.select}
                    disabled={isPublished}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* History Tab */
          <div style={styles.historyContainer}>
            {draftHistoryRef.current.length === 0 ? (
              <p style={styles.noHistory}>No history yet</p>
            ) : (
              <div style={styles.timeline}>
                {draftHistoryRef.current.map((entry, idx) => (
                  <div key={idx} style={styles.timelineEntry}>
                    <div style={styles.timelineDot}></div>
                    <div style={styles.timelineContent}>
                      <p style={styles.timelineAction}>
                        {entry.action === 'created' && '📝 Draft created'}
                        {entry.action === 'updated' && '✏️ Draft updated'}
                        {entry.action === 'published' && '📤 Draft published'}
                      </p>
                      <p style={styles.timelineMeta}>
                        by {entry.editedBy} • {formatDate(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div style={styles.footer}>
        <div style={styles.autoSaveStatus}>
          <MdAccessTime size={12} />
          Auto-saves every 2 seconds • Last edited: {formatDate(draft?.updatedAt)}
        </div>

        <div style={styles.actions}>
          {!isPublished ? (
            <>
              <button
                style={styles.saveButton}
                onClick={handleManualSave}
              >
                <MdSave size={16} />
                Save Draft
              </button>
              <button
                style={styles.publishButton}
                onClick={() => setShowPublishConfirm(true)}
              >
                <MdPublish size={16} />
                Publish Assessment
              </button>
              <button
                style={styles.deleteButton}
                onClick={handleDelete}
                disabled={deleting}
              >
                <MdDelete size={16} />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </>
          ) : (
            <div style={styles.publishedStatus}>
              <MdCheck size={20} />
              Published - Read Only
            </div>
          )}
        </div>
      </div>

      {/* Publish Confirmation */}
      {showPublishConfirm && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Publish Assessment</h3>
            <p style={styles.modalText}>
              Are you sure you want to publish this assessment? This will mark it as final and send it to the client records.
            </p>
            <div style={styles.modalActions}>
              <button
                style={styles.modalCancel}
                onClick={() => setShowPublishConfirm(false)}
                disabled={publishing}
              >
                Cancel
              </button>
              <button
                style={styles.modalConfirm}
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
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
    height: '100%'
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
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#dc2626'
  },
  backLink: {
    marginTop: '12px',
    padding: '8px 16px',
    backgroundColor: '#0ea5e9',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
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
  headerTitle: {
    flex: 1
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b'
  },
  subtitle: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8'
  },
  headerRight: {
    display: 'flex',
    gap: '8px'
  },
  completionBadge: (completion) => ({
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor:
      completion >= 90 ? '#d1fae5' :
      completion >= 50 ? '#fef3c7' :
      '#fee2e2',
    color:
      completion >= 90 ? '#065f46' :
      completion >= 50 ? '#92400e' :
      '#991b1b'
  }),
  publishedBadge: {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: '#d1fae5',
    color: '#065f46'
  },

  // Tabs
  tabsContainer: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#ffffff'
  },
  tab: {
    flex: 1,
    padding: '12px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s'
  },
  tabActive: {
    color: '#0ea5e9',
    borderBottomColor: '#0ea5e9'
  },

  // Content
  content: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  formContainer: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569'
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  textarea: {
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical',
    transition: 'border-color 0.2s'
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer'
  },
  scoreInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  slider: {
    flex: 1,
    height: '6px',
    accentColor: '#0ea5e9'
  },
  scoreValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
    minWidth: '40px',
    textAlign: 'right'
  },
  scoreLabel: {
    fontSize: '12px',
    color: '#64748b'
  },

  // History
  historyContainer: {
    padding: '24px',
    flex: 1,
    overflowY: 'auto'
  },
  noHistory: {
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: '14px'
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  timelineEntry: {
    display: 'flex',
    gap: '12px'
  },
  timelineDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#0ea5e9',
    marginTop: '4px',
    flexShrink: 0
  },
  timelineContent: {
    flex: 1
  },
  timelineAction: {
    margin: '0 0 2px 0',
    fontSize: '13px',
    fontWeight: '600',
    color: '#1e293b'
  },
  timelineMeta: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8'
  },

  // Footer
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px'
  },
  autoSaveStatus: {
    fontSize: '11px',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  saveButton: {
    padding: '8px 14px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s'
  },
  publishButton: {
    padding: '8px 14px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  deleteButton: {
    padding: '8px 14px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  publishedStatus: {
    padding: '8px 14px',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },

  // Modal
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '400px',
    width: '90%'
  },
  modalTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b'
  },
  modalText: {
    margin: '0 0 20px 0',
    fontSize: '13px',
    color: '#64748b',
    lineHeight: '1.5'
  },
  modalActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  modalCancel: {
    padding: '8px 16px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600'
  },
  modalConfirm: {
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600'
  }
};
