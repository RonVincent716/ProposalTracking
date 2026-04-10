import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import {
  MdCheckCircle,
  MdEmail,
  MdForum,
  MdInfo,
  MdMarkEmailRead,
  MdRefresh,
  MdSearch,
  MdWarning
} from "react-icons/md";
import { db } from "../firebase";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "needs_response", label: "Needs Response" },
  { value: "waiting_client", label: "Waiting On Client" },
  { value: "resolved", label: "Resolved" },
  { value: "approved", label: "Approved" },
  { value: "pending_review", label: "Pending Review" }
];

const getStatusStyles = (status) => {
  switch (status) {
    case "needs_response":
      return { background: "#fff7ed", color: "#c2410c", borderColor: "#fdba74" };
    case "waiting_client":
      return { background: "#eff6ff", color: "#1d4ed8", borderColor: "#93c5fd" };
    case "resolved":
      return { background: "#ecfdf5", color: "#166534", borderColor: "#86efac" };
    case "approved":
      return { background: "#f0fdf4", color: "#15803d", borderColor: "#86efac" };
    default:
      return { background: "#f8fafc", color: "#475569", borderColor: "#cbd5e1" };
  }
};

const formatDateTime = (value) => {
  if (!value) return "Not yet";
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);

  if (Number.isNaN(date.getTime())) return "Not yet";
  return date.toLocaleString();
};

export default function ClientFeedbackTab({ currentUser }) {
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedFeedbackId, setSelectedFeedbackId] = useState(null);
  const [draftItems, setDraftItems] = useState([]);
  const [draftStatus, setDraftStatus] = useState("pending_review");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    const feedbackQuery = query(
      collection(db, "proposalFeedback"),
      orderBy("lastUpdated", "desc")
    );

    const unsubscribe = onSnapshot(
      feedbackQuery,
      (snapshot) => {
        const records = snapshot.docs.map((entryDoc) => ({
          id: entryDoc.id,
          ...entryDoc.data()
        }));

        setFeedbackEntries(records);
        setLoading(false);

      },
      (error) => {
        console.error("Error loading proposal feedback:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredFeedback = useMemo(() => {
    const queryText = search.trim().toLowerCase();

    return feedbackEntries.filter((entry) => {
      const matchesStatus =
        statusFilter === "all" || (entry.adminStatus || "pending_review") === statusFilter;
      const matchesSearch =
        !queryText ||
        (entry.proposalName || "").toLowerCase().includes(queryText) ||
        (entry.clientName || "").toLowerCase().includes(queryText) ||
        (entry.clientEmail || "").toLowerCase().includes(queryText);

      return matchesStatus && matchesSearch;
    });
  }, [feedbackEntries, search, statusFilter]);

  const selectedFeedback =
    filteredFeedback.find((entry) => entry.id === selectedFeedbackId) ||
    feedbackEntries.find((entry) => entry.id === selectedFeedbackId) ||
    null;

  useEffect(() => {
    if (!selectedFeedbackId && filteredFeedback.length > 0) {
      setSelectedFeedbackId(filteredFeedback[0].id);
    }
  }, [filteredFeedback, selectedFeedbackId]);

  useEffect(() => {
    if (!selectedFeedback) {
      setDraftItems([]);
      setDraftStatus("pending_review");
      return;
    }

    setDraftItems(
      (selectedFeedback.items || []).map((item) => ({
        ...item
      }))
    );
    setDraftStatus(selectedFeedback.adminStatus || "pending_review");
    setSaveMessage("");
  }, [selectedFeedback]);

  const summary = useMemo(() => {
    const totalDisputed = feedbackEntries.reduce(
      (count, entry) => count + (entry.totalDisputed || 0),
      0
    );
    const needsResponse = feedbackEntries.filter(
      (entry) => entry.adminStatus === "needs_response"
    ).length;
    const waitingClient = feedbackEntries.filter(
      (entry) => entry.adminStatus === "waiting_client"
    ).length;
    const resolved = feedbackEntries.filter((entry) =>
      ["resolved", "approved"].includes(entry.adminStatus)
    ).length;

    return {
      total: feedbackEntries.length,
      totalDisputed,
      needsResponse,
      waitingClient,
      resolved
    };
  }, [feedbackEntries]);

  const updateDraftItem = (sectionKey, field, value) => {
    setDraftItems((currentItems) =>
      currentItems.map((item) =>
        item.sectionKey === sectionKey
          ? {
              ...item,
              [field]: value
            }
          : item
      )
    );
  };

  const handleSaveAdminUpdates = async () => {
    if (!selectedFeedback) return;

    setSaving(true);
    setSaveMessage("");

    try {
      const nowIso = new Date().toISOString();
      const updatedItems = draftItems.map((item) => ({
        ...item,
        adminReply: item.adminReply || "",
        itemStatus:
          item.clientDecision === "approved"
            ? "approved"
            : item.itemStatus || "open",
        adminReplyAt: item.adminReply ? item.adminReplyAt || nowIso : item.adminReplyAt || null
      }));

      await updateDoc(doc(db, "proposalFeedback", selectedFeedback.id), {
        items: updatedItems,
        adminStatus: draftStatus,
        adminResponderEmail: currentUser?.email || "",
        lastUpdated: serverTimestamp()
      });

      setSaveMessage("Admin updates saved.");
    } catch (error) {
      console.error("Error updating proposal feedback:", error);
      setSaveMessage("Could not save admin updates.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Client Feedback</h2>
          <p style={styles.subtitle}>
            Review approvals, negotiation points, and comments submitted from the proposal viewer.
          </p>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{summary.total}</div>
          <div style={styles.summaryLabel}>Feedback Records</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryValue, color: "#c2410c" }}>{summary.totalDisputed}</div>
          <div style={styles.summaryLabel}>Items To Debate</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryValue, color: "#1d4ed8" }}>{summary.needsResponse}</div>
          <div style={styles.summaryLabel}>Need Response</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={{ ...styles.summaryValue, color: "#15803d" }}>{summary.resolved}</div>
          <div style={styles.summaryLabel}>Resolved / Approved</div>
        </div>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <MdSearch size={18} color="#64748b" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by proposal, client, or email..."
            style={styles.searchInput}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          style={styles.select}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.layout}>
        <div style={styles.listColumn}>
          {loading ? (
            <div style={styles.emptyState}>
              <MdRefresh size={22} className="feedback-spin" />
              <span>Loading client feedback...</span>
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div style={styles.emptyState}>
              <MdInfo size={22} color="#94a3b8" />
              <span>No client feedback found for this filter.</span>
            </div>
          ) : (
            filteredFeedback.map((entry) => {
              const badgeStyles = getStatusStyles(entry.adminStatus || "pending_review");
              const isSelected = entry.id === selectedFeedback?.id;

              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedFeedbackId(entry.id)}
                  style={{
                    ...styles.feedbackCard,
                    ...(isSelected ? styles.feedbackCardActive : {})
                  }}
                >
                  <div style={styles.feedbackCardHeader}>
                    <div style={styles.feedbackProposal}>{entry.proposalName || "Untitled Proposal"}</div>
                    <span
                      style={{
                        ...styles.statusBadge,
                        background: badgeStyles.background,
                        color: badgeStyles.color,
                        borderColor: badgeStyles.borderColor
                      }}
                    >
                      {(entry.adminStatus || "pending_review").replace(/_/g, " ")}
                    </span>
                  </div>

                  <div style={styles.feedbackMetaRow}>
                    <MdEmail size={14} />
                    <span>{entry.clientEmail || "Unknown email"}</span>
                  </div>

                  <div style={styles.feedbackMetaRow}>
                    <MdForum size={14} />
                    <span>{entry.clientName || "Unknown client"}</span>
                  </div>

                  <div style={styles.feedbackStats}>
                    <span>{entry.totalApproved || 0} approved</span>
                    <span>{entry.totalDisputed || 0} need discussion</span>
                  </div>

                  <div style={styles.feedbackTimestamp}>
                    Updated {formatDateTime(entry.lastUpdated || entry.lastClientSubmissionAt || entry.createdAt)}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div style={styles.detailColumn}>
          {!selectedFeedback ? (
            <div style={styles.emptyDetail}>
              <MdMarkEmailRead size={28} color="#94a3b8" />
              <div>Select a feedback record to review the disputed sections.</div>
            </div>
          ) : (
            <div style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <div>
                  <div style={styles.detailTitle}>{selectedFeedback.proposalName}</div>
                  <div style={styles.detailClient}>
                    {selectedFeedback.clientName} • {selectedFeedback.clientEmail}
                  </div>
                </div>

                <select
                  value={draftStatus}
                  onChange={(event) => setDraftStatus(event.target.value)}
                  style={styles.select}
                >
                  {STATUS_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.detailInfoGrid}>
                <div style={styles.detailInfoCard}>
                  <div style={styles.detailInfoLabel}>Submitted</div>
                  <div style={styles.detailInfoValue}>
                    {formatDateTime(
                      selectedFeedback.lastClientSubmissionAt || selectedFeedback.createdAt
                    )}
                  </div>
                </div>
                <div style={styles.detailInfoCard}>
                  <div style={styles.detailInfoLabel}>Overall Status</div>
                  <div style={styles.detailInfoValue}>
                    {(selectedFeedback.overallStatus || "pending_review").replace(/_/g, " ")}
                  </div>
                </div>
                <div style={styles.detailInfoCard}>
                  <div style={styles.detailInfoLabel}>Approved</div>
                  <div style={styles.detailInfoValue}>{selectedFeedback.totalApproved || 0}</div>
                </div>
                <div style={styles.detailInfoCard}>
                  <div style={styles.detailInfoLabel}>Need Discussion</div>
                  <div style={{ ...styles.detailInfoValue, color: "#c2410c" }}>
                    {selectedFeedback.totalDisputed || 0}
                  </div>
                </div>
              </div>

              {selectedFeedback.overallComment && (
                <div style={styles.overallComment}>
                  <div style={styles.detailSectionTitle}>Client Overall Comment</div>
                  <div style={styles.overallCommentText}>{selectedFeedback.overallComment}</div>
                </div>
              )}

              <div style={styles.itemsList}>
                {draftItems.map((item) => {
                  const decisionStyles = getStatusStyles(
                    item.clientDecision === "approved" ? "approved" : "needs_response"
                  );

                  return (
                    <div key={item.sectionKey} style={styles.itemCard}>
                      <div style={styles.itemHeader}>
                        <div>
                          <div style={styles.itemTitle}>{item.sectionTitle}</div>
                          <div style={styles.itemDecisionRow}>
                            <span
                              style={{
                                ...styles.statusBadge,
                                background: decisionStyles.background,
                                color: decisionStyles.color,
                                borderColor: decisionStyles.borderColor
                              }}
                            >
                              {item.clientDecision === "approved" ? "Approved" : "Needs Discussion"}
                            </span>
                            <span style={styles.itemStatusText}>
                              Item status: {(item.itemStatus || "open").replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>

                        <select
                          value={item.itemStatus || "open"}
                          onChange={(event) =>
                            updateDraftItem(item.sectionKey, "itemStatus", event.target.value)
                          }
                          style={styles.itemSelect}
                        >
                          <option value="open">Open</option>
                          <option value="replied">Replied</option>
                          <option value="resolved">Resolved</option>
                          <option value="approved">Approved</option>
                        </select>
                      </div>

                      <div style={styles.clientCommentBox}>
                        <div style={styles.detailSectionTitle}>Client Comment</div>
                        <div style={styles.clientCommentText}>
                          {item.clientComment || "No comment provided for this section."}
                        </div>
                      </div>

                      <div style={styles.replyBox}>
                        <div style={styles.detailSectionTitle}>Admin Reply</div>
                        <textarea
                          value={item.adminReply || ""}
                          onChange={(event) =>
                            updateDraftItem(item.sectionKey, "adminReply", event.target.value)
                          }
                          placeholder="Reply to the client or document what should be discussed next..."
                          style={styles.replyTextarea}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {saveMessage && (
                <div
                  style={{
                    ...styles.saveMessage,
                    color: saveMessage.includes("Could not") ? "#991b1b" : "#166534",
                    background: saveMessage.includes("Could not") ? "#fef2f2" : "#ecfdf5",
                    borderColor: saveMessage.includes("Could not") ? "#fca5a5" : "#86efac"
                  }}
                >
                  {saveMessage.includes("Could not") ? <MdWarning size={18} /> : <MdCheckCircle size={18} />}
                  <span>{saveMessage}</span>
                </div>
              )}

              <div style={styles.detailFooter}>
                <div style={styles.footerHint}>
                  Save your replies after reviewing the disputed sections so the team has a clear dashboard record of what still needs discussion.
                </div>
                <button
                  onClick={handleSaveAdminUpdates}
                  disabled={saving}
                  style={saving ? styles.saveButtonDisabled : styles.saveButton}
                >
                  {saving ? "Saving..." : "Save Admin Updates"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .feedback-spin {
          animation: feedback-spin 1s linear infinite;
        }

        @keyframes feedback-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  header: {
    marginBottom: "22px"
  },
  title: {
    margin: 0,
    fontSize: "28px",
    color: "#0f172a"
  },
  subtitle: {
    margin: "8px 0 0 0",
    color: "#64748b",
    fontSize: "14px",
    lineHeight: "1.6"
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginBottom: "22px"
  },
  summaryCard: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "18px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)"
  },
  summaryValue: {
    fontSize: "30px",
    fontWeight: "700",
    color: "#0f172a"
  },
  summaryLabel: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#64748b"
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "18px"
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "12px 14px",
    flex: 1,
    minWidth: "280px"
  },
  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    fontSize: "14px",
    background: "transparent",
    color: "#0f172a"
  },
  select: {
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    fontSize: "14px",
    background: "#ffffff",
    color: "#0f172a"
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(300px, 380px) minmax(0, 1fr)",
    gap: "18px",
    alignItems: "start"
  },
  listColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  feedbackCard: {
    width: "100%",
    textAlign: "left",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.04)"
  },
  feedbackCardActive: {
    borderColor: "#60a5fa",
    boxShadow: "0 12px 26px rgba(37, 99, 235, 0.12)"
  },
  feedbackCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start"
  },
  feedbackProposal: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#0f172a"
  },
  statusBadge: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "7px 10px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "capitalize"
  },
  feedbackMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "10px",
    color: "#64748b",
    fontSize: "13px"
  },
  feedbackStats: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "14px",
    fontSize: "12px",
    color: "#334155",
    fontWeight: "600"
  },
  feedbackTimestamp: {
    marginTop: "12px",
    fontSize: "11px",
    color: "#94a3b8"
  },
  detailColumn: {
    minHeight: "420px"
  },
  detailCard: {
    background: "#ffffff",
    borderRadius: "18px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
    padding: "20px"
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "18px"
  },
  detailTitle: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#0f172a"
  },
  detailClient: {
    marginTop: "6px",
    color: "#64748b",
    fontSize: "14px"
  },
  detailInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
    marginBottom: "18px"
  },
  detailInfoCard: {
    padding: "14px",
    background: "#f8fafc",
    borderRadius: "14px",
    border: "1px solid #e2e8f0"
  },
  detailInfoLabel: {
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em"
  },
  detailInfoValue: {
    marginTop: "6px",
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a"
  },
  overallComment: {
    padding: "16px",
    borderRadius: "16px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginBottom: "18px"
  },
  overallCommentText: {
    marginTop: "8px",
    fontSize: "14px",
    color: "#334155",
    lineHeight: "1.7"
  },
  itemsList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px"
  },
  itemCard: {
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    background: "#ffffff"
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "14px"
  },
  itemTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a"
  },
  itemDecisionRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "8px"
  },
  itemStatusText: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "600",
    textTransform: "capitalize"
  },
  itemSelect: {
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: "13px",
    background: "#ffffff",
    color: "#0f172a"
  },
  detailSectionTitle: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em"
  },
  clientCommentBox: {
    padding: "14px",
    borderRadius: "12px",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    marginBottom: "12px"
  },
  clientCommentText: {
    marginTop: "8px",
    fontSize: "14px",
    color: "#7c2d12",
    lineHeight: "1.7"
  },
  replyBox: {
    padding: "14px",
    borderRadius: "12px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe"
  },
  replyTextarea: {
    width: "100%",
    minHeight: "96px",
    resize: "vertical",
    marginTop: "8px",
    borderRadius: "12px",
    border: "1px solid #bfdbfe",
    padding: "12px 14px",
    fontSize: "14px",
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box"
  },
  saveMessage: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "18px",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid transparent",
    fontSize: "14px",
    fontWeight: "600"
  },
  detailFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: "18px"
  },
  footerHint: {
    fontSize: "13px",
    color: "#64748b",
    lineHeight: "1.6",
    maxWidth: "650px"
  },
  saveButton: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
    color: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(37, 99, 235, 0.18)"
  },
  saveButtonDisabled: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: "700",
    background: "#cbd5e1",
    color: "#ffffff",
    cursor: "not-allowed"
  },
  emptyState: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "18px",
    borderRadius: "16px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#64748b"
  },
  emptyDetail: {
    minHeight: "420px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    textAlign: "center",
    borderRadius: "18px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#64748b",
    padding: "30px"
  }
};
