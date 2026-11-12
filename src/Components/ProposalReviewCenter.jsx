import { useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { MdCheckCircle, MdDescription, MdOpenInNew, MdRateReview, MdRefresh, MdWarning } from 'react-icons/md';
import { db, storage } from '../firebase';
import { useAssessmentDrafts } from '../hooks/useAssessmentDrafts';

const statusDetails = {
  pending_approval: { label: 'Pending review', color: '#B45309', bg: '#FEF3C7' },
  needs_revision: { label: 'Needs revision', color: '#B91C1C', bg: '#FEE2E2' },
  approved: { label: 'Approved', color: '#047857', bg: '#D1FAE5' },
  sent_for_signature: { label: 'Sent for signature', color: '#6D28D9', bg: '#EDE9FE' },
  draft: { label: 'Draft', color: '#475569', bg: '#E2E8F0' }
};

const toTime = (value) => value?.toDate?.()?.getTime?.() || value?.seconds * 1000 || new Date(value || 0).getTime() || 0;
const displayDate = (value) => value?.toDate?.()?.toLocaleString?.() || (value ? new Date(value).toLocaleString() : 'Not recorded');

export default function ProposalReviewCenter({ user, role, onOpenWorkflow, onClose }) {
  const isAdmin = role === 'admin' || role === 'superadmin';
  const { drafts, loading, saveDraft } = useAssessmentDrafts(user?.uid || '', user?.email || '', false, isAdmin);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState({ loading: false, url: '', error: '' });
  const [submitting, setSubmitting] = useState(false);

  const items = useMemo(() => drafts
    .filter((item) => statusFilter === 'all' || item.status === statusFilter)
    .filter((item) => `${item.proposalName || ''} ${item.companyName || ''} ${item.clientName || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => toTime(b.updatedAt || b.createdAt) - toTime(a.updatedAt || a.createdAt)), [drafts, search, statusFilter]);
  const selected = items.find((item) => item.id === selectedId) || items[0] || null;
  const counts = useMemo(() => ({
    pending_approval: drafts.filter((item) => item.status === 'pending_approval').length,
    needs_revision: drafts.filter((item) => item.status === 'needs_revision').length,
    approved: drafts.filter((item) => item.status === 'approved').length,
    ready: drafts.filter((item) => item.sharingStatus === 'ready_to_share').length
  }), [drafts]);

  const showDocument = async (item) => {
    if (!item) return;
    setPreview({ loading: true, url: '', error: '' });
    try {
      const path = [item.sourceFilePath, item.filePath, item.proposalId].find((value) => typeof value === 'string' && value.startsWith('proposals/'));
      if (path) {
        setPreview({ loading: false, url: await getDownloadURL(ref(storage, path)), error: '' });
        return;
      }
      if (item.downloadUrl || item.fileUrl) {
        setPreview({ loading: false, url: item.downloadUrl || item.fileUrl, error: '' });
        return;
      }
      const proposalId = item.structuredProposalId || item.proposalId;
      if (proposalId && typeof proposalId === 'string' && !proposalId.includes('/')) {
        const proposal = await getDoc(doc(db, 'proposals', proposalId));
        const data = proposal.data();
        if (proposal.exists() && (data.downloadUrl || data.filePath)) {
          setPreview({ loading: false, url: data.downloadUrl || await getDownloadURL(ref(storage, data.filePath)), error: '' });
          return;
        }
      }
      throw new Error('No uploaded document is linked to this request.');
    } catch (error) {
      setPreview({ loading: false, url: '', error: error?.message || 'Unable to load the document.' });
    }
  };

  const selectItem = (item) => {
    setSelectedId(item.id);
    setPreview({ loading: false, url: '', error: '' });
    showDocument(item);
  };

  const resubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await saveDraft(selected.id, {
        ...selected,
        status: 'pending_approval',
        workflowStage: 'internal_review',
        requestStatus: 'waiting_for_admin',
        sharingStatus: 'not_ready',
        canShare: false,
        resubmittedAt: new Date(),
        resubmittedByEmail: user?.email || ''
      });
    } catch (error) {
      console.error('Unable to resubmit proposal:', error);
      window.alert('Unable to resubmit this proposal for review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div><div style={styles.eyebrow}>Proposal workspace</div><h2 style={styles.title}>Proposal Review Center</h2><p style={styles.subtitle}>Review requests, document context, feedback, and approval progress in one place.</p></div>
        <div style={styles.headerActions}>
          {isAdmin && <button style={styles.secondaryButton} onClick={onOpenWorkflow}><MdRateReview /> Open assessment workflow</button>}
          <button style={styles.secondaryButton} onClick={onClose}>Close</button>
        </div>
      </div>
      <div style={styles.stats}>
        {[['Pending review', counts.pending_approval, '#B45309'], ['Needs revision', counts.needs_revision, '#B91C1C'], ['Approved', counts.approved, '#047857'], ['Ready to send', counts.ready, '#1D4ED8']].map(([label, value, color]) => <div key={label} style={styles.stat}><span>{label}</span><strong style={{ color }}>{value}</strong></div>)}
      </div>
      <div style={styles.layout}>
        <section style={styles.listPanel}>
          <div style={styles.filters}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search proposal or client" style={styles.input} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={styles.select}><option value="all">All statuses</option>{Object.entries(statusDetails).map(([value, info]) => <option value={value} key={value}>{info.label}</option>)}</select></div>
          {loading ? <p style={styles.muted}>Loading review requests…</p> : items.length === 0 ? <p style={styles.muted}>No matching review requests.</p> : items.map((item) => { const info = statusDetails[item.status] || statusDetails.draft; return <button key={item.id} onClick={() => selectItem(item)} style={{ ...styles.listItem, ...(selected?.id === item.id ? styles.selectedItem : {}) }}><strong>{item.proposalName || item.companyName || 'Untitled proposal'}</strong><span>{item.clientName || item.clientEmail || 'No client assigned'}</span><small style={{ color: info.color, background: info.bg }}>{info.label}</small></button>; })}
        </section>
        <section style={styles.detailPanel}>
          {!selected ? <div style={styles.empty}><MdDescription size={34} /> Select a proposal to review.</div> : <>
            {(() => { const info = statusDetails[selected.status] || statusDetails.draft; return <><div style={styles.detailHeader}><div><h3 style={{ margin: 0 }}>{selected.proposalName || selected.companyName || 'Untitled proposal'}</h3><p style={styles.muted}>{selected.clientName || 'No client'} · {selected.clientEmail || 'No email'}</p></div><span style={{ ...styles.badge, color: info.color, background: info.bg }}>{info.label}</span></div>
              <div style={styles.documentHeader}><strong>Proposal document</strong><button style={styles.linkButton} onClick={() => showDocument(selected)} disabled={preview.loading}><MdRefresh /> {preview.loading ? 'Loading…' : 'Refresh preview'}</button></div>
              {preview.error && <div style={styles.error}><MdWarning /> {preview.error}</div>}
              {preview.url ? <div style={styles.preview}><a href={preview.url} target="_blank" rel="noreferrer" style={styles.openLink}>Open in new tab <MdOpenInNew /></a><iframe title="Proposal document preview" src={preview.url} style={styles.frame} /></div> : !preview.loading && <button onClick={() => showDocument(selected)} style={styles.previewButton}><MdDescription /> View proposal document</button>}
              {selected.status === 'needs_revision' && <div style={styles.revision}><strong>Admin revision note</strong><p>{selected.approvalNotes || 'The reviewer requested updates. Please review the proposal and resubmit when complete.'}</p><small>{selected.revisionRequestedByName || selected.revisionRequestedByEmail || 'Admin'} · {displayDate(selected.revisionRequestedAt || selected.updatedAt)}</small>{!isAdmin && <button style={styles.primaryButton} disabled={submitting} onClick={resubmit}>{submitting ? 'Resubmitting…' : 'Mark changes complete & resubmit'}</button>}</div>}
              <div style={styles.timeline}><strong>Workflow history</strong><div>✓ Uploaded / created <span>{displayDate(selected.createdAt)}</span></div><div>✓ Review requested <span>{displayDate(selected.updatedAt)}</span></div>{selected.revisionRequestedAt && <div>! Revision requested <span>{displayDate(selected.revisionRequestedAt)}</span></div>}{selected.status === 'approved' && <div><MdCheckCircle color="#059669" /> Approved <span>{displayDate(selected.updatedAt)}</span></div>}</div>
            </>; })()}
          </>}
        </section>
      </div>
    </div>
  );
}

const styles = { page: { background: '#F8FAFC', padding: 20, borderRadius: 16 }, header: { display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }, eyebrow: { color: '#2563EB', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em' }, title: { margin: '4px 0', color: '#0F172A' }, subtitle: { margin: 0, color: '#64748B' }, headerActions: { display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }, secondaryButton: { border: '1px solid #CBD5E1', background: '#fff', padding: '10px 12px', borderRadius: 9, color: '#1E293B', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }, stats: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }, stat: { background: '#fff', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0', display: 'grid', gap: 6 }, layout: { display: 'grid', gridTemplateColumns: 'minmax(270px, .85fr) minmax(0, 1.7fr)', gap: 16 }, listPanel: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, maxHeight: 720, overflow: 'auto' }, filters: { display: 'grid', gap: 8, marginBottom: 12 }, input: { padding: 10, borderRadius: 8, border: '1px solid #CBD5E1' }, select: { padding: 10, borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff' }, listItem: { width: '100%', border: '1px solid #E2E8F0', background: '#fff', textAlign: 'left', padding: 12, borderRadius: 10, marginBottom: 8, cursor: 'pointer', display: 'grid', gap: 5, color: '#0F172A' }, selectedItem: { borderColor: '#2563EB', boxShadow: '0 0 0 2px #DBEAFE' }, detailPanel: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, minWidth: 0 }, detailHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }, badge: { padding: '6px 9px', borderRadius: 999, fontWeight: 800, fontSize: 12 }, muted: { color: '#64748B', fontSize: 13 }, documentHeader: { marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, linkButton: { border: 0, background: 'transparent', color: '#2563EB', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }, preview: { marginTop: 10, border: '1px solid #CBD5E1', borderRadius: 10, overflow: 'hidden' }, openLink: { display: 'flex', justifyContent: 'flex-end', gap: 5, padding: 9, color: '#2563EB', fontWeight: 700, fontSize: 13 }, frame: { width: '100%', height: 500, display: 'block', border: 0 }, previewButton: { width: '100%', marginTop: 10, padding: 16, color: '#2563EB', background: '#EFF6FF', border: '1px dashed #93C5FD', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }, revision: { marginTop: 14, padding: 14, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#7F1D1D' }, primaryButton: { display: 'block', marginTop: 12, border: 0, background: '#1D4ED8', color: '#fff', borderRadius: 8, padding: '10px 12px', fontWeight: 800, cursor: 'pointer' }, timeline: { marginTop: 14, padding: 14, background: '#F8FAFC', borderRadius: 10, display: 'grid', gap: 8, color: '#334155' }, error: { marginTop: 10, padding: 10, borderRadius: 8, color: '#B91C1C', background: '#FEF2F2', display: 'flex', gap: 6 }, empty: { minHeight: 350, color: '#64748B', display: 'grid', placeItems: 'center', textAlign: 'center', gap: 8 } };
