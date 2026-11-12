import { useMemo, useState } from 'react';
import {
  MdAdd,
  MdArticle,
  MdChecklist,
  MdComment,
  MdDescription,
  MdFactCheck,
  MdFilterList,
  MdSend,
  MdTaskAlt,
  MdTrendingUp,
  MdWarning,
  MdRefresh,
  MdReplay,
  MdRateReview,
  MdOpenInNew,
  MdPictureAsPdf
} from 'react-icons/md';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { useAssessmentDrafts } from '../hooks/useAssessmentDrafts';
import { db, storage } from '../firebase';

const statusConfig = {
  draft: { label: 'Draft', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  pending_approval: { label: 'Pending Approval', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.12)' },
  needs_revision: { label: 'Needs Revision', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.12)' },
  approved: { label: 'Approved', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  sent_for_signature: { label: 'Sent for E-signature', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.12)' },
  published: { label: 'Published', color: '#0F766E', bg: 'rgba(15, 118, 110, 0.12)' }
};

const formatDate = (value) => {
  if (!value) return 'No updates yet';
  const date = value?.toDate?.() || new Date(value);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export default function AssessmentWorkflowPanel({ user, role }) {
  const [refreshing, setRefreshing] = useState(false);
  const [busyDraftId, setBusyDraftId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [documentPreview, setDocumentPreview] = useState({ loading: false, url: '', error: '' });

  const {
    drafts,
    loading,
    error,
    createDraft,
    saveDraft
  } = useAssessmentDrafts(user?.uid || '', user?.email || '', false, role === 'admin' || role === 'superadmin');

  const workflowStats = useMemo(() => {
    const stats = {
      draft: 0,
      pending_approval: 0,
      needs_revision: 0,
      approved: 0,
      sent_for_signature: 0
    };

    drafts.forEach((draft) => {
      if (stats[draft.status] !== undefined) {
        stats[draft.status] += 1;
      }
    });

    return stats;
  }, [drafts]);

  const filteredDrafts = useMemo(() => {
    const arr = [...drafts];
    const byStatus = statusFilter === 'all' ? arr : arr.filter(d => d.status === statusFilter);
    return byStatus.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  }, [drafts, statusFilter]);

  const recentItems = useMemo(() => filteredDrafts.slice(0, 8), [filteredDrafts]);

  const handleCreateDraft = async (type = 'proposal') => {
    try {
      const title = type === 'quote' ? 'New Quote' : 'New Proposal';
      const today = new Date().toISOString().slice(0, 10);
      const draftId = await createDraft({
        companyName: `${title} ${today}`,
        clientName: 'New client',
        clientEmail: 'client@example.com',
        industry: 'Business services',
        companyOverview: 'Drafted from the assessment workflow.',
        recommendation: 'Prepare a concise proposal with pricing and next-step options.',
        strengths: 'Strong fit and clear goals.',
        gaps: 'Add a tailored implementation plan.',
        riskLevel: 'medium',
        readinessScore: 70,
        adminNotes: 'Ready for internal review.',
        status: 'draft',
        workflowStage: 'draft',
        approvalNotes: ''
      });

      if (draftId) {
        window.alert(`${title} created. Open it from the list below to continue the workflow.`);
      }
    } catch (err) {
      console.error('Error creating draft:', err);
      window.alert('Unable to create workflow item right now.');
    }
  };

  const handleWorkflowAction = async (draft, action) => {
    try {
      setBusyDraftId(draft.id);
      let nextStatus = draft.status;
      let notes = draft.approvalNotes || '';
      let workflowStage = draft.workflowStage || draft.status;

      if (action === 'request_approval') {
        nextStatus = 'pending_approval';
        workflowStage = 'internal_approval';
      } else if (action === 'needs_revision') {
        // open revision modal to collect notes
        setSelectedDraft(draft);
        setEditDraft({ ...draft });
        setRevisionModalOpen(true);
        setBusyDraftId(null);
        return;
      } else if (action === 'approve') {
        nextStatus = 'approved';
        workflowStage = 'approved';
      } else if (action === 'send_signature') {
        nextStatus = 'sent_for_signature';
        workflowStage = 'client_signature';
      }

      const sharingStatus = nextStatus === 'approved' || nextStatus === 'sent_for_signature'
        ? 'ready_to_share'
        : nextStatus === 'needs_revision'
          ? 'not_ready'
          : (draft.sharingStatus || 'not_ready');

      await saveDraft(draft.id, {
        ...draft,
        status: nextStatus,
        workflowStage,
        requestStatus: nextStatus,
        sharingStatus,
        canShare: sharingStatus === 'ready_to_share',
        approvalNotes: notes,
        lastWorkflowAction: action,
        updatedAt: new Date()
      });
      await syncSharedProposalStatus(draft, nextStatus, sharingStatus, notes);
    } catch (err) {
      console.error('Error updating workflow:', err);
      window.alert('Unable to move this item through the workflow.');
    } finally {
      setBusyDraftId(null);
    }
  };

  const handleOpenDraftDetails = (draft) => {
    setSelectedDraft(draft);
    setEditDraft({ ...draft });
    setDocumentPreview({ loading: false, url: '', error: '' });

    // Approval requests created from an uploaded proposal should immediately show its file.
    if (draft.sourceFilePath || draft.filePath || draft.proposalId || draft.structuredProposalId || draft.downloadUrl || draft.fileUrl) {
      handlePreviewDocument(draft);
    }
  };

  const handleCloseDraftDetails = () => {
    setSelectedDraft(null);
    setEditDraft(null);
    setDocumentPreview({ loading: false, url: '', error: '' });
  };

  const syncSharedProposalStatus = async (draft, status, sharingStatus, approvalNotes) => {
    const filePath = draft.sourceFilePath || (typeof draft.proposalId === 'string' && draft.proposalId.startsWith('proposals/') ? draft.proposalId : '');
    if (!filePath) return;

    const sharedSnapshot = await getDocs(query(collection(db, 'sharedProposals'), where('filePath', '==', filePath)));
    await Promise.all(sharedSnapshot.docs.map((sharedDoc) => updateDoc(sharedDoc.ref, {
      approvalStatus: status,
      sharingStatus,
      canShare: sharingStatus === 'ready_to_share',
      approvalNotes: approvalNotes || '',
      updatedAt: new Date()
    })));
  };

  const resolveProposalDocument = async (draft) => {
    // Existing assessment records store the Storage path in sourceFilePath or proposalId.
    const storedPath = [draft.sourceFilePath, draft.filePath, draft.proposalId]
      .find((value) => typeof value === 'string' && value.startsWith('proposals/'));

    if (storedPath) {
      return getDownloadURL(ref(storage, storedPath));
    }

    if (draft.downloadUrl || draft.fileUrl) {
      return draft.downloadUrl || draft.fileUrl;
    }

    // New structured proposals use a Firestore document ID, so resolve its current file path.
    const structuredProposalId = draft.structuredProposalId || draft.proposalId;
    if (structuredProposalId && typeof structuredProposalId === 'string' && !structuredProposalId.includes('/')) {
      const proposalSnapshot = await getDoc(doc(db, 'proposals', structuredProposalId));
      if (proposalSnapshot.exists()) {
        const proposal = proposalSnapshot.data();
        if (proposal.downloadUrl) return proposal.downloadUrl;
        if (proposal.filePath) return getDownloadURL(ref(storage, proposal.filePath));
      }
    }

    throw new Error('No uploaded document is linked to this approval request.');
  };

  const handlePreviewDocument = async (draft) => {
    setDocumentPreview({ loading: true, url: '', error: '' });
    try {
      const url = await resolveProposalDocument(draft);
      setDocumentPreview({ loading: false, url, error: '' });
    } catch (err) {
      console.error('Unable to load proposal document:', err);
      setDocumentPreview({
        loading: false,
        url: '',
        error: err?.code === 'storage/object-not-found'
          ? 'The uploaded proposal file is no longer available in storage.'
          : (err?.message || 'Unable to load the uploaded proposal document.')
      });
    }
  };

  const handleSaveDraftEdits = async () => {
    if (!editDraft) return;
    try {
      setBusyDraftId(editDraft.id);
      // if saving from a revision flow, mark status appropriately
      const nextStatus = revisionModalOpen ? 'needs_revision' : (editDraft.status || 'draft');
      const workflowStage = revisionModalOpen ? 'revision' : (editDraft.workflowStage || nextStatus);
      const revisionMetadata = revisionModalOpen
        ? {
          requestStatus: 'needs_revision',
          revisionRequestedByEmail: user?.email || '',
          revisionRequestedByName: user?.displayName || user?.email?.split('@')[0] || 'Admin',
          revisionRequestedAt: new Date()
        }
        : {};
      const sharingStatus = nextStatus === 'approved' || nextStatus === 'sent_for_signature' ? 'ready_to_share' : 'not_ready';
      await saveDraft(editDraft.id, {
        ...editDraft,
        ...revisionMetadata,
        status: nextStatus,
        workflowStage,
        sharingStatus,
        canShare: sharingStatus === 'ready_to_share',
        updatedAt: new Date()
      });
      await syncSharedProposalStatus(editDraft, nextStatus, sharingStatus, editDraft.approvalNotes || '');
      setSelectedDraft({ ...editDraft, ...revisionMetadata, status: nextStatus, workflowStage });
      setEditDraft(null);
      setRevisionModalOpen(false);
    } catch (err) {
      console.error('Error saving draft edits:', err);
      window.alert('Unable to save changes right now.');
    } finally {
      setBusyDraftId(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div style={styles.card}>
        <div style={styles.loadingBox}>Loading assessment workflow...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.card}>
        <div style={styles.errorBox}>Unable to load workflow items.</div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.heroCard}>
        <div>
          <div style={styles.eyebrow}></div>
          <h2 style={styles.title}>Assessment Workflow</h2>
          <p style={styles.subtitle}>
            Create business proposals and quotes, route them through internal approval, collect team revisions, and send approved items for client e-signature.
          </p>
        </div>
        <div style={styles.heroActions}>
          <button style={styles.primaryButton} onClick={() => handleCreateDraft('proposal')}>
            <MdAdd size={18} />
            Create Proposal
          </button>
          <button style={styles.secondaryButton} onClick={() => handleCreateDraft('quote')}>
            <MdDescription size={18} />
            Create Quote
          </button>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <MdArticle size={24} color="#2563EB" style={{ marginBottom: 8 }} />
          <div style={styles.statLabel}>Drafts</div>
          <div style={styles.statValue}>{workflowStats.draft}</div>
        </div>
        <div style={styles.statCard}>
          <MdFactCheck size={24} color="#2563EB" style={{ marginBottom: 8 }} />
          <div style={styles.statLabel}>Pending Approval</div>
          <div style={styles.statValue}>{workflowStats.pending_approval}</div>
        </div>
        <div style={styles.statCard}>
          <MdReplay size={24} color="#DC2626" style={{ marginBottom: 8 }} />
          <div style={styles.statLabel}>Needs Revision</div>
          <div style={styles.statValue}>{workflowStats.needs_revision}</div>
        </div>
        <div style={styles.statCard}>
          <MdRateReview size={24} color="#7C3AED" style={{ marginBottom: 8 }} />
          <div style={styles.statLabel}>Sent for Signature</div>
          <div style={styles.statValue}>{workflowStats.sent_for_signature}</div>
        </div>
      </div>

      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitleRow}>
            <MdChecklist size={20} color="#2563EB" />
            <h3 style={styles.sectionTitle}>Workflow stages</h3>
          </div>
          <div style={styles.stageBadges}>
            {['draft', 'pending_approval', 'needs_revision', 'approved', 'sent_for_signature'].map((stage) => (
              <div key={stage} style={styles.stageBadge}>
                <span style={{ color: statusConfig[stage]?.color }}>{statusConfig[stage]?.label}</span>
                <strong>{workflowStats[stage] || 0}</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.workflowSteps}>
          {[
            { title: '1. Draft', subtitle: 'Create and refine your proposal or quote', icon: MdDescription },
            { title: '2. Internal Approval', subtitle: 'Route for team review before send-out', icon: MdFactCheck },
            { title: '3. Team Comments', subtitle: 'Capture revision notes and feedback', icon: MdComment },
            { title: '4. Client E-signature', subtitle: 'Send approved proposals to clients', icon: MdSend }
          ].map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.title} style={styles.stepCard}>
                <Icon size={22} color="#2563EB" />
                <div>
                  <div style={styles.stepTitle}>{step.title}</div>
                  <div style={styles.stepSubtitle}>{step.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionTitleRow}>
            <MdTrendingUp size={20} color="#0F766E" />
            <h3 style={styles.sectionTitle}>Recent workflow items</h3>
          </div>
          <button style={styles.iconButton} onClick={handleRefresh} disabled={refreshing}>
            <MdRefresh size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        <div style={styles.filterBar}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.filterSelect}>
              <option value="all">All statuses</option>
              {Object.keys(statusConfig).map((k) => (
                <option key={k} value={k}>{statusConfig[k].label}</option>
              ))}
            </select>
          </div>

          <div style={styles.filterSummary}>{filteredDrafts.length} item{filteredDrafts.length === 1 ? '' : 's'} shown</div>
        </div>

        <div style={styles.list}>
          {recentItems.length === 0 ? (
            <div style={styles.emptyState}>
              <MdWarning size={24} color="#F59E0B" />
              No workflow items yet. Create a proposal or quote to start the process.
            </div>
          ) : recentItems.map((draft) => {
            const cfg = statusConfig[draft.status] || statusConfig.draft;
            return (
              <div key={draft.id} style={styles.itemCard}>
                <div style={{ ...styles.itemMain, cursor: 'pointer' }} onClick={() => handleOpenDraftDetails(draft)}>
                  <div style={styles.itemTitleRow}>
                    <div style={styles.itemTitle}>{draft.companyName || 'Untitled workflow item'}</div>
                    <span style={{ ...styles.statusBadge, background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div style={styles.itemMeta}>
                    {draft.clientName || 'New client'} • {draft.clientEmail || 'No email'}
                  </div>
                  <div style={styles.itemNotes}>
                    {draft.approvalNotes || 'Team comments and revision notes will appear here.'}
                  </div>
                  <div style={styles.itemClickHint}>Click for details</div>
                </div>

                <div style={styles.actions}>
                  <button style={styles.smallButton} onClick={() => handleWorkflowAction(draft, 'request_approval')} disabled={busyDraftId === draft.id}>
                    <MdFactCheck size={15} />
                    Approve Request
                  </button>
                  <button style={styles.smallButton} onClick={() => handleWorkflowAction(draft, 'needs_revision')} disabled={busyDraftId === draft.id}>
                    <MdReplay size={15} />
                    Revision
                  </button>
                  <button style={styles.smallButton} onClick={() => handleWorkflowAction(draft, 'approve')} disabled={busyDraftId === draft.id}>
                    <MdTaskAlt size={15} />
                    Approve
                  </button>
                  <button style={styles.smallButton} onClick={() => handleWorkflowAction(draft, 'send_signature')} disabled={busyDraftId === draft.id}>
                    <MdRateReview size={15} />
                    E-signature
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail / Edit Modal */}
      {selectedDraft && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ width: 760, maxWidth: '94%', background: '#fff', borderRadius: 12, padding: 18, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{selectedDraft.companyName || 'Workflow item'}</h3>
                <div style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
                  {selectedDraft.clientName || 'New client'} • {selectedDraft.clientEmail || 'No email'} • {statusConfig[selectedDraft.status]?.label || 'Status unknown'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  style={styles.smallButton}
                  onClick={() => handlePreviewDocument(selectedDraft)}
                  disabled={documentPreview.loading}
                >
                  <MdPictureAsPdf size={16} />
                  {documentPreview.loading ? 'Loading document...' : 'View document'}
                </button>
                <button style={styles.smallButton} onClick={handleCloseDraftDetails}>
                  Close
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Company</label>
                <input style={styles.modalInput} value={editDraft?.companyName || ''} onChange={(e) => setEditDraft({ ...editDraft, companyName: e.target.value })} />
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Client</label>
                <input style={styles.modalInput} value={editDraft?.clientName || ''} onChange={(e) => setEditDraft({ ...editDraft, clientName: e.target.value })} />
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Client Email</label>
                <input style={styles.modalInput} value={editDraft?.clientEmail || ''} onChange={(e) => setEditDraft({ ...editDraft, clientEmail: e.target.value })} />
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Industry</label>
                <input style={styles.modalInput} value={editDraft?.industry || ''} onChange={(e) => setEditDraft({ ...editDraft, industry: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: 16, color: '#0F172A' }}>Proposal preview</h4>
                <span style={{ fontSize: 12, color: '#64748B' }}>Review the document content and leave your recommendations below.</span>
              </div>
              <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                {documentPreview.error && (
                  <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, color: '#B91C1C', fontSize: 13 }}>
                    {documentPreview.error}
                  </div>
                )}
                {documentPreview.url && (
                  <div style={{ border: '1px solid #CBD5E1', borderRadius: 12, overflow: 'hidden', background: '#F8FAFC' }}>
                    <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottom: '1px solid #E2E8F0' }}>
                      <strong style={{ fontSize: 13 }}>Uploaded proposal document</strong>
                      <a href={documentPreview.url} target="_blank" rel="noreferrer" style={{ color: '#1D4ED8', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        Open in new tab <MdOpenInNew size={15} />
                      </a>
                    </div>
                    <iframe title={`${selectedDraft.proposalName || selectedDraft.companyName || 'Proposal'} preview`} src={documentPreview.url} style={{ display: 'block', width: '100%', height: 520, border: 0 }} />
                  </div>
                )}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Company overview</div>
                  <div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>{selectedDraft.companyOverview || 'No company overview provided.'}</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Strengths</div>
                  <div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>{selectedDraft.strengths || 'No strengths documented yet.'}</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Gaps / Risks</div>
                  <div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>{selectedDraft.gaps || 'No risk items recorded yet.'}</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Recommendation</div>
                  <div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>{selectedDraft.recommendation || 'No recommendation yet.'}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Risk Level</label>
                  <input style={styles.modalInput} value={editDraft?.riskLevel || ''} onChange={(e) => setEditDraft({ ...editDraft, riskLevel: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Readiness Score</label>
                  <input type="number" min="0" max="100" style={styles.modalInput} value={editDraft?.readinessScore || 0} onChange={(e) => setEditDraft({ ...editDraft, readinessScore: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Recommendation / Notes</label>
                <textarea rows={4} style={{ ...styles.modalInput, resize: 'vertical' }} value={editDraft?.recommendation || ''} onChange={(e) => setEditDraft({ ...editDraft, recommendation: e.target.value })} />
              </div>
              <div>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Admin Notes</label>
                <textarea rows={4} style={{ ...styles.modalInput, resize: 'vertical' }} value={editDraft?.adminNotes || ''} onChange={(e) => setEditDraft({ ...editDraft, adminNotes: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ color: '#64748B', fontSize: 13 }}>
                Last updated: {formatDate(selectedDraft.updatedAt)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={{ ...styles.smallButton, background: '#fff' }} onClick={handleCloseDraftDetails}>Cancel</button>
                <button style={styles.primaryButton} onClick={handleSaveDraftEdits} disabled={busyDraftId === (editDraft && editDraft.id)}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revision modal (when triggered from Revision action) */}
      {revisionModalOpen && selectedDraft && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2001 }}>
          <div style={{ width: 560, maxWidth: '94%', background: '#fff', borderRadius: 12, padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>Request Revision</h3>
            <p style={{ color: '#64748B' }}>Add a note for the team describing required changes.</p>
            <textarea rows={5} style={{ ...styles.modalInput, marginTop: 8 }} value={editDraft?.approvalNotes || ''} onChange={(e) => setEditDraft({ ...editDraft, approvalNotes: e.target.value })} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button style={styles.smallButton} onClick={() => { setRevisionModalOpen(false); setEditDraft(null); setSelectedDraft(null); }}>Cancel</button>
              <button style={styles.primaryButton} onClick={handleSaveDraftEdits} disabled={busyDraftId === (editDraft && editDraft.id)}>Send Revision</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18
  },
  card: {
    padding: 12
  },
  heroCard: {
    background: 'linear-gradient(135deg, #0B1220 0%, #1D4ED8 100%)',
    borderRadius: 20,
    borderTopLeftRadius: 28,
    padding: 22,
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'nowrap',
    position: 'relative',
    zIndex: 50,
    width: '100%',
    maxWidth: '100%',
    boxShadow: '0 12px 30px rgba(13, 71, 161, 0.12)',
    overflow: 'hidden'
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    opacity: 0.85,
    marginBottom: 6
  },
  title: {
    margin: '0 0 6px 0',
    fontSize: 22,
    fontWeight: 800
  },
  subtitle: {
    margin: 0,
    maxWidth: 660,
    lineHeight: 1.5,
    color: 'rgba(255,255,255,0.92)'
  },
  heroActions: {
    display: 'flex',
    gap: 12,
    flexWrap: 'nowrap'
  },
  primaryButton: {
    border: 'none',
    borderRadius: 12,
    padding: '10px 16px',
    background: '#fff',
    color: '#1D4ED8',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 6px 18px rgba(13, 71, 161, 0.12)'
  },
  secondaryButton: {
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 12,
    padding: '10px 16px',
    background: 'transparent',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 14,
    alignItems: 'stretch'
  },
  statCard: {
    background: '#fff',
    border: '1px solid #E6EEF8',
    borderRadius: 12,
    padding: 18,
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    justifyContent: 'center'
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0F172A',
    marginTop: 8
  },
  sectionCard: {
    background: '#fff',
    border: '1px solid #E6EEF8',
    borderRadius: 14,
    padding: 16,
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'nowrap'
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    color: '#0F172A'
  },
  stageBadges: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap'
  },
  stageBadge: {
    border: '1px solid #E6EEF8',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 13,
    background: '#F8FAFC',
    display: 'flex',
    gap: 8,
    alignItems: 'center'
  },
  workflowSteps: {
    display: 'flex',
    gap: 12,
    alignItems: 'stretch',
    overflowX: 'auto'
  },
  stepCard: {
    background: '#F8FAFC',
    border: '1px solid #E6EEF8',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 220
  },
  stepTitle: {
    fontWeight: 800,
    color: '#0F172A',
    marginBottom: 4
  },
  stepSubtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 1.35
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  itemCard: {
    border: '1px solid #E6EEF8',
    borderRadius: 12,
    padding: 16,
    background: '#FFFFFF',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start'
  },
  itemMain: {
    marginBottom: 0,
    flex: 1
  },
  itemTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap'
  },
  itemTitle: {
    fontWeight: 800,
    color: '#0F172A'
  },
  statusBadge: {
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700
  },
  itemMeta: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6
  },
  itemNotes: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    lineHeight: 1.5
  },
  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  smallButton: {
    border: '1px solid #DBEAFE',
    background: '#EFF6FF',
    color: '#1D4ED8',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8
  },
  iconButton: {
    border: '1px solid #E6EEF8',
    background: '#fff',
    borderRadius: 10,
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  loadingBox: {
    padding: 24,
    textAlign: 'center',
    color: '#64748B'
  },
  errorBox: {
    padding: 24,
    textAlign: 'center',
    color: '#DC2626'
  },
  emptyState: {
    padding: 18,
    borderRadius: 10,
    border: '1px dashed #CBD5E1',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#F8FAFC'
  },
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0F172A'
  },
  filterSelect: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #E6EEF8',
    background: '#fff'
  },
  filterSummary: {
    fontSize: 13,
    color: '#64748B'
  },
  itemClickHint: {
    marginTop: 10,
    fontSize: 12,
    color: '#2563EB',
    fontWeight: 700
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #CBD5E1',
    fontSize: 14,
    outline: 'none'
  }
};
