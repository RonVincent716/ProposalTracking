import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  updateDoc,
  doc
} from "firebase/firestore";
import emailjs from "@emailjs/browser";
import {
  MdAccessTime,
  MdCheckCircle,
  MdEmail,
  MdError,
  MdOpenInNew,
  MdRefresh,
  MdSchedule,
  MdSend,
  MdVisibility
} from "react-icons/md";
import { db } from "../firebase";
import { ActivityLogger } from "../utils/activityLogger";

const EMAILJS_CONFIG = {
  SERVICE_ID: "service_q6k7l9r",
  TEMPLATE_ID: "template_438lqns",
  PUBLIC_KEY: "UF-7_4AU7Jw9Sdo5P"
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const daysBetween = (date, now = new Date()) => {
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
};

const formatDate = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleDateString() : "N/A";
};

const buildProposalLink = (filePath) => {
  if (!filePath) return `${window.location.origin}/client-dashboard`;
  return `${window.location.origin}/p/${btoa(filePath)}`;
};

const normalize = (value) => String(value || "").toLowerCase();

export default function FollowUpCenter({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharedProposals, setSharedProposals] = useState([]);
  const [views, setViews] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [signedProposals, setSignedProposals] = useState([]);
  const [archivedProposals, setArchivedProposals] = useState([]);
  const [statusFilter, setStatusFilter] = useState("needs-follow-up");
  const [page, setPage] = useState(1);
  const [sendingId, setSendingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const itemsPerPage = 10;

  const loadData = async ({ soft = false } = {}) => {
    if (soft) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [
        sharedSnapshot,
        viewsSnapshot,
        sessionsSnapshot,
        signedSnapshot,
        archivedSnapshot
      ] = await Promise.all([
        getDocs(collection(db, "sharedProposals")),
        getDocs(collection(db, "proposalViews")),
        getDocs(collection(db, "proposalSessions")),
        getDocs(collection(db, "signedProposals")),
        getDocs(collection(db, "archivedProposals"))
      ]);

      setSharedProposals(sharedSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setViews(viewsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setSessions(sessionsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setSignedProposals(signedSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setArchivedProposals(archivedSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (error) {
      console.error("Error loading follow-up center:", error);
      setNotice({ type: "error", text: "Unable to load follow-up data right now." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    loadData();
  }, []);

  const followUps = useMemo(() => {
    const now = new Date();
    const archivedPaths = new Set(
      archivedProposals.flatMap((proposal) => [
        proposal.filePath,
        proposal.fileName,
        proposal.proposalName
      ]).filter(Boolean)
    );

    return sharedProposals
      .filter((proposal) => proposal.filePath && !archivedPaths.has(proposal.filePath) && !archivedPaths.has(proposal.fileName))
      .map((proposal) => {
        const filePath = proposal.filePath;
        const fileName = proposal.fileName || proposal.proposalName || "Proposal";
        const clientEmail = proposal.clientEmail || proposal.recipientEmail || "";
        const sharedAt = toDate(proposal.sharedAt);
        const expiresAt = toDate(proposal.expiresAt);
        const lastFollowUpAt = toDate(proposal.lastFollowUpAt);
        const proposalViews = views.filter((view) =>
          view.filePath === filePath ||
          view.proposalId === filePath ||
          view.fileName === fileName ||
          (clientEmail && normalize(view.viewerEmail) === normalize(clientEmail) && view.filePath === filePath)
        );
        const proposalSessions = sessions.filter((session) =>
          session.filePath === filePath ||
          session.proposalId === filePath ||
          session.fileName === fileName ||
          session.proposalName === fileName
        );
        const signed = proposal.status === "signed" || signedProposals.some((signedProposal) =>
          signedProposal.proposalPath === filePath ||
          signedProposal.filePath === filePath ||
          signedProposal.proposalName === fileName ||
          (clientEmail && normalize(signedProposal.signerEmail || signedProposal.clientEmail) === normalize(clientEmail) &&
            (signedProposal.proposalPath === filePath || signedProposal.proposalName === fileName))
        );

        const lastViewedAt = proposalViews
          .map((view) => toDate(view.viewedAt || view.createdAt))
          .filter(Boolean)
          .sort((a, b) => b.getTime() - a.getTime())[0] || null;
        const lastSessionAt = proposalSessions
          .map((session) => toDate(session.lastActiveAt || session.lastActivity || session.updatedAt || session.endTime || session.startedAt || session.createdAt))
          .filter(Boolean)
          .sort((a, b) => b.getTime() - a.getTime())[0] || null;
        const lastActivityAt = [lastViewedAt, lastSessionAt, sharedAt]
          .filter(Boolean)
          .sort((a, b) => b.getTime() - a.getTime())[0] || null;

        const daysSinceShared = daysBetween(sharedAt, now);
        const daysSinceActivity = daysBetween(lastActivityAt, now);
        const daysSinceFollowUp = daysBetween(lastFollowUpAt, now);
        const daysUntilExpiry = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS) : null;
        const viewCount = Math.max(proposal.viewCount || 0, proposalViews.length);

        let reason = "Monitor";
        let priority = "low";
        let score = 1;

        if (!signed && daysUntilExpiry !== null && daysUntilExpiry < 0) {
          reason = "Overdue";
          priority = "urgent";
          score = 5;
        } else if (!signed && daysUntilExpiry !== null && daysUntilExpiry <= 3) {
          reason = "Expiring soon";
          priority = "urgent";
          score = 5;
        } else if (!signed && viewCount > 0 && daysSinceActivity !== null && daysSinceActivity >= 1) {
          reason = "Viewed, not signed";
          priority = "high";
          score = 4;
        } else if (!signed && viewCount === 0 && daysSinceShared !== null && daysSinceShared >= 2) {
          reason = "No views yet";
          priority = "medium";
          score = 3;
        } else if (!signed && daysSinceActivity !== null && daysSinceActivity >= 5) {
          reason = "Inactive";
          priority = "medium";
          score = 3;
        } else if (signed) {
          reason = "Signed";
          priority = "complete";
          score = 0;
        }

        return {
          ...proposal,
          fileName,
          filePath,
          clientEmail,
          clientName: proposal.clientName || proposal.recipientName || clientEmail.split("@")[0] || "Client",
          sharedAt,
          expiresAt,
          lastActivityAt,
          lastFollowUpAt,
          daysSinceShared,
          daysSinceActivity,
          daysSinceFollowUp,
          daysUntilExpiry,
          viewCount,
          signed,
          reason,
          priority,
          score,
          link: proposal.shareLink || proposal.fileUrl || buildProposalLink(filePath)
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.lastActivityAt?.getTime?.() || 0) - (a.lastActivityAt?.getTime?.() || 0);
      });
  }, [archivedProposals, sessions, sharedProposals, signedProposals, views]);

  const filteredFollowUps = followUps.filter((item) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "needs-follow-up") return !item.signed && item.score >= 3;
    if (statusFilter === "viewed") return !item.signed && item.viewCount > 0;
    if (statusFilter === "no-views") return !item.signed && item.viewCount === 0;
    if (statusFilter === "sent") return !!item.lastFollowUpAt;
    return true;
  });

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sharedProposals.length, views.length, sessions.length, signedProposals.length, archivedProposals.length]);

  const totalPages = Math.max(1, Math.ceil(filteredFollowUps.length / itemsPerPage));
  const paginatedFollowUps = filteredFollowUps.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const summary = {
    needsFollowUp: followUps.filter((item) => !item.signed && item.score >= 3).length,
    urgent: followUps.filter((item) => item.priority === "urgent").length,
    viewedUnsigned: followUps.filter((item) => !item.signed && item.viewCount > 0).length,
    remindersSent: followUps.filter((item) => !!item.lastFollowUpAt).length
  };

  const sendReminder = async (item) => {
    if (!item.clientEmail) {
      setNotice({ type: "error", text: "This proposal has no client email." });
      return;
    }

    setSendingId(item.id);
    setNotice(null);

    const message = item.reason === "No views yet"
      ? "Just checking that you received this proposal. Please review it when you have a moment."
      : item.reason === "Expiring soon"
        ? "This proposal is close to its expiry date. Please review and sign it when you are ready."
        : "Following up on this proposal. Let me know if you have questions or need any changes.";

    try {
      await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        {
          to_email: item.clientEmail,
          to_name: item.clientName || "Valued Client",
          from_name: currentUser?.displayName || currentUser?.email?.split("@")[0] || "Admin",
          from_email: currentUser?.email || "",
          proposal_name: item.fileName,
          proposal_link: item.link,
          message,
          reply_to: currentUser?.email || "",
          current_date: new Date().toLocaleDateString(),
          login_link: `${window.location.origin}/client-login`
        }
      );

      await addDoc(collection(db, "followUpReminders"), {
        sharedProposalId: item.id,
        proposalName: item.fileName,
        filePath: item.filePath,
        clientEmail: item.clientEmail,
        clientName: item.clientName,
        reason: item.reason,
        sentBy: currentUser?.email || null,
        sentAt: serverTimestamp(),
        status: "sent"
      });

      await addDoc(collection(db, "emailHistory"), {
        proposalId: item.filePath,
        proposalName: item.fileName,
        recipientEmail: item.clientEmail,
        recipientName: item.clientName,
        sentBy: currentUser?.email || null,
        sentAt: serverTimestamp(),
        shareLink: item.link,
        message,
        status: "sent",
        type: "follow_up"
      });

      await updateDoc(doc(db, "sharedProposals", item.id), {
        lastFollowUpAt: serverTimestamp(),
        lastFollowUpBy: currentUser?.email || null,
        followUpCount: (item.followUpCount || 0) + 1
      });

      await ActivityLogger.logFollowUp(item.filePath, item.fileName, item.clientEmail, item.reason);
      setNotice({ type: "success", text: `Reminder sent to ${item.clientEmail}` });
      await loadData({ soft: true });
    } catch (error) {
      console.error("Error sending follow-up reminder:", error);
      setNotice({ type: "error", text: `Failed to send reminder: ${error.text || error.message}` });
    } finally {
      setSendingId(null);
    }
  };

  if (loading) {
    return (
      <div style={loadingStyle}>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div style={spinnerStyle} />
        <div>Loading follow-up center...</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>
            <MdSchedule size={28} color="#1976D2" />
            Follow-Up Center
          </h2>
        </div>
        <button onClick={() => loadData({ soft: true })} disabled={refreshing} style={refreshButtonStyle}>
          <MdRefresh size={16} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div style={summaryGridStyle}>
        <SummaryCard icon={<MdError size={22} />} label="Needs Follow-Up" value={summary.needsFollowUp} color="#DC2626" />
        <SummaryCard icon={<MdAccessTime size={22} />} label="Urgent" value={summary.urgent} color="#F59E0B" />
        <SummaryCard icon={<MdVisibility size={22} />} label="Viewed Unsigned" value={summary.viewedUnsigned} color="#2563EB" />
        <SummaryCard icon={<MdEmail size={22} />} label="Reminders Sent" value={summary.remindersSent} color="#059669" />
      </div>

      <div style={toolbarStyle}>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={selectStyle}>
          <option value="needs-follow-up">Needs Follow-Up</option>
          <option value="viewed">Viewed, Unsigned</option>
          <option value="no-views">No Views</option>
          <option value="sent">Reminder Sent</option>
          <option value="all">All Active Shares</option>
        </select>
        <div style={resultCountStyle}>{filteredFollowUps.length} proposals</div>
      </div>

      {notice && (
        <div style={noticeStyle(notice.type)}>
          {notice.type === "success" ? <MdCheckCircle size={18} /> : <MdError size={18} />}
          {notice.text}
        </div>
      )}

      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={tableHeaderStyle}>
              <th style={thStyle}>Proposal</th>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Activity</th>
              <th style={thStyle}>Follow-Up</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedFollowUps.length === 0 ? (
              <tr>
                <td colSpan="6" style={emptyStyle}>No proposals match this view.</td>
              </tr>
            ) : (
              paginatedFollowUps.map((item) => (
                <tr key={item.id} style={rowStyle}>
                  <td style={tdStyle}>
                    <div style={proposalNameStyle}>{item.fileName}</div>
                    <div style={mutedStyle}>Shared {formatDate(item.sharedAt)}</div>
                  </td>
                  <td style={tdStyle}>
                    <div>{item.clientName}</div>
                    <div style={mutedStyle}>{item.clientEmail || "No email"}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={priorityStyle(item.priority)}>{item.reason}</span>
                    {item.daysUntilExpiry !== null && (
                      <div style={mutedStyle}>
                        {item.daysUntilExpiry < 0 ? `${Math.abs(item.daysUntilExpiry)}d overdue` : `${item.daysUntilExpiry}d left`}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div>{item.viewCount} views</div>
                    <div style={mutedStyle}>
                      Last activity {item.daysSinceActivity === null ? "N/A" : `${item.daysSinceActivity}d ago`}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div>{item.lastFollowUpAt ? formatDate(item.lastFollowUpAt) : "Not sent"}</div>
                    <div style={mutedStyle}>{item.followUpCount || 0} reminders</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={actionsStyle}>
                      <button
                        onClick={() => sendReminder(item)}
                        disabled={sendingId === item.id || item.signed}
                        style={sendButtonStyle(sendingId === item.id || item.signed)}
                      >
                        <MdSend size={15} />
                        {sendingId === item.id ? "Sending..." : "Send Reminder"}
                      </button>
                      <button onClick={() => window.open(item.link, "_blank")} style={openButtonStyle}>
                        <MdOpenInNew size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredFollowUps.length > itemsPerPage && (
        <div style={paginationStyle}>
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            style={paginationButtonStyle(page === 1)}
          >
            Previous
          </button>

          <div style={pageNumbersStyle}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = index + 1;
              } else if (page <= 3) {
                pageNumber = index + 1;
              } else if (page >= totalPages - 2) {
                pageNumber = totalPages - 4 + index;
              } else {
                pageNumber = page - 2 + index;
              }

              return (
                <button
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                  style={pageNumberStyle(page === pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            style={paginationButtonStyle(page === totalPages)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <div style={summaryCardStyle}>
      <div style={{ ...summaryIconStyle, background: `${color}14`, color }}>{icon}</div>
      <div>
        <div style={summaryValueStyle}>{value}</div>
        <div style={summaryLabelStyle}>{label}</div>
      </div>
    </div>
  );
}

const containerStyle = {
  padding: "24px",
  background: "#F8FAFC",
  borderRadius: "16px",
  fontFamily: "'Inter', system-ui, sans-serif"
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginBottom: "20px",
  flexWrap: "wrap"
};

const titleStyle = {
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: "24px",
  color: "#0F172A"
};

const refreshButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "9px 14px",
  border: "1px solid #CBD5E1",
  borderRadius: "10px",
  background: "#FFFFFF",
  color: "#334155",
  cursor: "pointer",
  fontWeight: 600
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "14px",
  marginBottom: "18px"
};

const summaryCardStyle = {
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: "12px",
  padding: "16px",
  display: "flex",
  gap: "12px",
  alignItems: "center"
};

const summaryIconStyle = {
  width: "42px",
  height: "42px",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const summaryValueStyle = {
  fontSize: "26px",
  fontWeight: 800,
  color: "#0F172A",
  lineHeight: 1
};

const summaryLabelStyle = {
  marginTop: "5px",
  fontSize: "12px",
  color: "#64748B",
  fontWeight: 600
};

const toolbarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "14px",
  flexWrap: "wrap"
};

const selectStyle = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #CBD5E1",
  background: "#FFFFFF",
  color: "#334155",
  fontWeight: 600
};

const resultCountStyle = {
  color: "#64748B",
  fontSize: "13px",
  fontWeight: 600
};

const noticeStyle = (type) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 14px",
  borderRadius: "10px",
  marginBottom: "14px",
  background: type === "success" ? "#ECFDF5" : "#FEF2F2",
  color: type === "success" ? "#047857" : "#B91C1C",
  border: `1px solid ${type === "success" ? "#A7F3D0" : "#FECACA"}`,
  fontSize: "13px",
  fontWeight: 600
});

const tableWrapStyle = {
  overflowX: "auto",
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  borderRadius: "14px"
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "980px"
};

const tableHeaderStyle = {
  background: "#0F172A",
  color: "#FFFFFF"
};

const thStyle = {
  padding: "14px",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: 700
};

const tdStyle = {
  padding: "14px",
  borderBottom: "1px solid #E2E8F0",
  verticalAlign: "middle",
  fontSize: "13px",
  color: "#1E293B"
};

const rowStyle = {
  background: "#FFFFFF"
};

const proposalNameStyle = {
  fontWeight: 700,
  maxWidth: "260px",
  wordBreak: "break-word"
};

const mutedStyle = {
  color: "#64748B",
  fontSize: "12px",
  marginTop: "4px"
};

const priorityStyle = (priority) => {
  const colors = {
    urgent: ["#FEE2E2", "#B91C1C", "#FCA5A5"],
    high: ["#FFF7ED", "#C2410C", "#FDBA74"],
    medium: ["#FEF3C7", "#B45309", "#FCD34D"],
    low: ["#EFF6FF", "#1D4ED8", "#BFDBFE"],
    complete: ["#ECFDF5", "#047857", "#A7F3D0"]
  };
  const [background, color, border] = colors[priority] || colors.low;
  return {
    display: "inline-flex",
    padding: "4px 9px",
    borderRadius: "999px",
    background,
    color,
    border: `1px solid ${border}`,
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap"
  };
};

const actionsStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center"
};

const sendButtonStyle = (disabled) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 10px",
  border: "none",
  borderRadius: "9px",
  background: disabled ? "#E2E8F0" : "#2563EB",
  color: disabled ? "#94A3B8" : "#FFFFFF",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "12px",
  fontWeight: 700,
  whiteSpace: "nowrap"
});

const openButtonStyle = {
  width: "34px",
  height: "34px",
  border: "1px solid #CBD5E1",
  borderRadius: "9px",
  background: "#FFFFFF",
  color: "#334155",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center"
};

const paginationStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "12px",
  marginTop: "20px",
  flexWrap: "wrap"
};

const paginationButtonStyle = (disabled) => ({
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid #CBD5E1",
  background: disabled ? "#F1F5F9" : "#fff",
  color: disabled ? "#94A3B8" : "#334155",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "13px",
  fontWeight: 600
});

const pageNumbersStyle = {
  display: "flex",
  gap: "6px"
};

const pageNumberStyle = (active) => ({
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  border: "none",
  background: active ? "#1d4ed8" : "#fff",
  color: active ? "#fff" : "#334155",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 600,
  boxShadow: active ? "0 2px 8px rgba(29, 78, 216, 0.25)" : "none"
});

const emptyStyle = {
  padding: "42px",
  textAlign: "center",
  color: "#64748B"
};

const loadingStyle = {
  minHeight: "260px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  color: "#64748B"
};

const spinnerStyle = {
  width: "38px",
  height: "38px",
  borderRadius: "50%",
  border: "3px solid #E2E8F0",
  borderTopColor: "#2563EB",
  animation: "spin 1s linear infinite"
};
