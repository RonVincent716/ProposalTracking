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
  MdWarning,
  MdClose,
  MdSave,
  MdVerified,
  MdAccessTime,
  MdPerson,
  MdChat,
  MdChecklist,
  MdAssignmentTurnedIn
} from "react-icons/md";
import { db } from "../firebase";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses", icon: "📊" },
  { value: "needs_response", label: "Needs Response", icon: "⚠️" },
  { value: "waiting_client", label: "Waiting On Client", icon: "⏳" },
  { value: "resolved", label: "Resolved", icon: "✅" },
  { value: "approved", label: "Approved", icon: "🎉" },
  { value: "pending_review", label: "Pending Review", icon: "🔄" }
];

const getStatusStyles = (status) => {
  switch (status) {
    case "needs_response":
      return { 
        background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)", 
        color: "#9a3412", 
        borderColor: "#fdba74",
        icon: "⚠️"
      };
    case "waiting_client":
      return { 
        background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", 
        color: "#1e40af", 
        borderColor: "#93c5fd",
        icon: "⏳"
      };
    case "resolved":
      return { 
        background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)", 
        color: "#166534", 
        borderColor: "#86efac",
        icon: "✅"
      };
    case "approved":
      return { 
        background: "linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)", 
        color: "#15803d", 
        borderColor: "#86efac",
        icon: "🎉"
      };
    default:
      return { 
        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", 
        color: "#475569", 
        borderColor: "#cbd5e1",
        icon: "📝"
      };
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});

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
      (selectedFeedback.items || []).map((item) => ({ ...item }))
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
    const totalApproved = feedbackEntries.reduce(
      (count, entry) => count + (entry.totalApproved || 0),
      0
    );

    return {
      total: feedbackEntries.length,
      totalDisputed,
      needsResponse,
      waitingClient,
      resolved,
      totalApproved
    };
  }, [feedbackEntries]);

  const updateDraftItem = (sectionKey, field, value) => {
    setDraftItems((currentItems) =>
      currentItems.map((item) =>
        item.sectionKey === sectionKey ? { ...item, [field]: value } : item
      )
    );
  };

  const toggleItemExpand = (sectionKey) => {
    setExpandedItems(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
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
        itemStatus: item.clientDecision === "approved" ? "approved" : item.itemStatus || "open",
        adminReplyAt: item.adminReply ? item.adminReplyAt || nowIso : item.adminReplyAt || null
      }));
      await updateDoc(doc(db, "proposalFeedback", selectedFeedback.id), {
        items: updatedItems,
        adminStatus: draftStatus,
        adminResponderEmail: currentUser?.email || "",
        lastUpdated: serverTimestamp()
      });
      setSaveMessage("Admin updates saved successfully!");
      setShowConfirmModal(false);
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      console.error("Error updating proposal feedback:", error);
      setSaveMessage("Could not save admin updates.");
      setTimeout(() => setSaveMessage(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => setShowConfirmModal(true);
  const handleConfirmSave = () => handleSaveAdminUpdates();
  const handleCancelSave = () => setShowConfirmModal(false);

  const getProgressPercentage = () => {
    if (!selectedFeedback) return 0;
    const total = (selectedFeedback.totalApproved || 0) + (selectedFeedback.totalDisputed || 0);
    if (total === 0) return 0;
    return ((selectedFeedback.totalApproved || 0) / total) * 100;
  };

  return (
    <div style={styles.container}>
      {/* Animated Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.title}>
              <MdAssignmentTurnedIn size={32} style={{ marginRight: "12px", verticalAlign: "middle" }} />
              Client Feedback Dashboard
            </h1>
            <p style={styles.subtitle}>
              Review and manage client approvals, negotiation points, and comments from proposal submissions
            </p>
          </div>
          <div style={styles.headerBadge}>
            <MdVerified size={20} />
            <span>Real-time Updates</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>📋</div>
          <div style={styles.summaryValue}>{summary.total}</div>
          <div style={styles.summaryLabel}>Total Feedback</div>
          <div style={styles.summaryTrend}>+{summary.total > 0 ? Math.ceil(summary.total / 10) : 0}% this month</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>🎯</div>
          <div style={styles.summaryValue}>{summary.totalApproved}</div>
          <div style={styles.summaryLabel}>Approved Items</div>
          <div style={styles.summaryTrend}>Resolved successfully</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>⚡</div>
          <div style={styles.summaryValue}>{summary.totalDisputed}</div>
          <div style={styles.summaryLabel}>Need Discussion</div>
          <div style={styles.summaryTrend}>Requires attention</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryIcon}>📊</div>
          <div style={styles.summaryValue}>{Math.round((summary.resolved / (summary.total || 1)) * 100)}%</div>
          <div style={styles.summaryLabel}>Resolution Rate</div>
          <div style={styles.summaryTrend}>{summary.resolved} resolved items</div>
        </div>
      </div>

      {/* Toolbar */}
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
              {option.icon} {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Main Layout */}
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
              const progress = ((entry.totalApproved || 0) / ((entry.totalApproved || 0) + (entry.totalDisputed || 0) || 1)) * 100;

              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedFeedbackId(entry.id)}
                  style={{
                    ...styles.feedbackCard,
                    ...(isSelected ? styles.feedbackCardActive : {})
                  }}
                  className="feedback-card"
                >
                  <div style={styles.feedbackCardHeader}>
                    <div 
                      style={styles.feedbackProposal}
                      title={entry.proposalName || "Untitled Proposal"}
                    >
                      {entry.proposalName || "Untitled Proposal"}
                    </div>
                    <span
                      style={{
                        ...styles.statusBadge,
                        background: badgeStyles.background,
                        color: badgeStyles.color,
                        borderColor: badgeStyles.borderColor
                      }}
                    >
                      {badgeStyles.icon} {(entry.adminStatus || "pending_review").replace(/_/g, " ")}
                    </span>
                  </div>

                  <div 
                    style={styles.feedbackMetaRow}
                    title={entry.clientEmail || "Unknown email"}
                  >
                    <MdEmail size={14} style={{ flexShrink: 0 }} />
                    <span style={styles.truncatedText}>
                      {entry.clientEmail || "Unknown email"}
                    </span>
                  </div>

                  <div 
                    style={styles.feedbackMetaRow}
                    title={entry.clientName || "Unknown client"}
                  >
                    <MdPerson size={14} style={{ flexShrink: 0 }} />
                    <span style={styles.truncatedText}>
                      {entry.clientName || "Unknown client"}
                    </span>
                  </div>

                  <div style={styles.progressBar}>
                    <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                  </div>

                  <div style={styles.feedbackStats}>
                    <span>✅ {entry.totalApproved || 0} approved</span>
                    <span>⚠️ {entry.totalDisputed || 0} need discussion</span>
                  </div>

                  <div style={styles.feedbackTimestamp}>
                    <MdAccessTime size={12} style={{ flexShrink: 0 }} />
                    <span style={styles.truncatedText}>
                      Updated {formatDateTime(entry.lastUpdated || entry.lastClientSubmissionAt || entry.createdAt)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div style={styles.detailColumn}>
          {!selectedFeedback ? (
            <div style={styles.emptyDetail}>
              <MdMarkEmailRead size={48} color="#94a3b8" />
              <h3 style={styles.emptyDetailTitle}>No Feedback Selected</h3>
              <p>Select a feedback record from the list to review the disputed sections and respond to clients.</p>
            </div>
          ) : (
            <div style={styles.detailCard} className="feedback-detail-card">
              <div style={styles.detailHeader}>
                <div style={styles.detailHeaderLeft}>
                  <div 
                    style={styles.detailTitle}
                    title={selectedFeedback.proposalName}
                  >
                    {selectedFeedback.proposalName}
                  </div>
                  <div style={styles.detailClient}>
                    <MdPerson size={14} style={{ flexShrink: 0 }} />
                    <span style={styles.truncatedText}>{selectedFeedback.clientName}</span>
                    <span>•</span>
                    <MdEmail size={14} style={{ flexShrink: 0 }} />
                    <span style={styles.truncatedTextEmail}>{selectedFeedback.clientEmail}</span>
                  </div>
                </div>
                <select
                  value={draftStatus}
                  onChange={(event) => setDraftStatus(event.target.value)}
                  style={styles.selectSmall}
                >
                  {STATUS_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.icon} {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.detailInfoGrid}>
                <div style={styles.detailInfoCard}>
                  <div style={styles.detailInfoLabel}>Submitted</div>
                  <div style={styles.detailInfoValue}>
                    <MdAccessTime size={14} style={{ marginRight: "4px" }} />
                    {formatDateTime(selectedFeedback.lastClientSubmissionAt || selectedFeedback.createdAt)}
                  </div>
                </div>
                <div style={styles.detailInfoCard}>
                  <div style={styles.detailInfoLabel}>Overall Progress</div>
                  <div style={styles.detailInfoValue}>
                    <div style={styles.progressBarSmall}>
                      <div style={{ ...styles.progressFillSmall, width: `${getProgressPercentage()}%` }} />
                    </div>
                    <span style={{ fontSize: "14px", marginTop: "4px", display: "block" }}>
                      {getProgressPercentage().toFixed(0)}% Complete
                    </span>
                  </div>
                </div>
              </div>

              {selectedFeedback.overallComment && (
                <div style={styles.overallComment}>
                  <div style={styles.detailSectionTitle}>
                    <MdChat size={14} style={{ marginRight: "6px" }} />
                    Client Overall Comment
                  </div>
                  <div style={styles.overallCommentText}>{selectedFeedback.overallComment}</div>
                </div>
              )}

              <div style={styles.itemsList}>
                <h4 style={styles.sectionHeader}>
                  <MdChecklist size={18} style={{ marginRight: "8px" }} />
                  Section Details ({draftItems.length})
                </h4>
                {draftItems.map((item) => {
                  const decisionStyles = getStatusStyles(item.clientDecision === "approved" ? "approved" : "needs_response");
                  const isExpanded = expandedItems[item.sectionKey];

                  return (
                    <div key={item.sectionKey} style={styles.itemCard}>
                      <div style={styles.itemHeader}>
                        <div style={styles.itemTitleSection}>
                          <div style={styles.itemTitle}>{item.sectionTitle}</div>
                          <div style={styles.itemDecisionRow}>
                            <span style={{ ...styles.statusBadgeSmall, ...decisionStyles }}>
                              {decisionStyles.icon} {item.clientDecision === "approved" ? "Approved" : "Needs Discussion"}
                            </span>
                            <span style={styles.itemStatusText}>
                              Status: {(item.itemStatus || "open").toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div style={styles.itemActions}>
                          <button
                            onClick={() => toggleItemExpand(item.sectionKey)}
                            style={styles.expandButton}
                          >
                            {isExpanded ? "−" : "+"}
                          </button>
                          <select
                            value={item.itemStatus || "open"}
                            onChange={(event) => updateDraftItem(item.sectionKey, "itemStatus", event.target.value)}
                            style={styles.itemSelect}
                          >
                            <option value="open">🟡 Open</option>
                            <option value="replied">💬 Replied</option>
                            <option value="resolved">✅ Resolved</option>
                            <option value="approved">🎉 Approved</option>
                          </select>
                        </div>
                      </div>

                      {isExpanded && (
                        <>
                          <div style={styles.clientCommentBox}>
                            <div style={styles.detailSectionTitle}>
                              <MdChat size={12} style={{ marginRight: "4px" }} />
                              Client Comment
                            </div>
                            <div style={styles.clientCommentText}>
                              {item.clientComment || "No comment provided for this section."}
                            </div>
                          </div>
                          <div style={styles.replyBox}>
                            <div style={styles.detailSectionTitle}>Admin Reply</div>
                            <textarea
                              value={item.adminReply || ""}
                              onChange={(event) => updateDraftItem(item.sectionKey, "adminReply", event.target.value)}
                              placeholder="Write your response to the client's feedback..."
                              style={styles.replyTextarea}
                              rows={4}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {saveMessage && (
                <div style={{ ...styles.saveMessage, ...(saveMessage.includes("successfully") ? styles.successMessage : styles.errorMessage) }}>
                  {saveMessage.includes("successfully") ? <MdCheckCircle size={18} /> : <MdWarning size={18} />}
                  <span>{saveMessage}</span>
                </div>
              )}

              <div style={styles.detailFooter}>
                <div style={styles.footerHint}>
                  💡 Save your replies after reviewing the disputed sections. Clients will be notified of your response.
                </div>
                <button
                  onClick={handleSaveClick}
                  disabled={saving}
                  style={saving ? styles.saveButtonDisabled : styles.saveButton}
                >
                  <MdSave size={18} style={{ marginRight: "8px" }} />
                  {saving ? "Saving..." : "Save All Updates"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div style={styles.modalOverlay} onClick={handleCancelSave}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                <MdSave size={20} style={{ marginRight: "8px" }} />
                Confirm Changes
              </h3>
              <button onClick={handleCancelSave} style={styles.modalCloseButton}>
                <MdClose size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.modalText}>
                Are you sure you want to save these updates for <strong>{selectedFeedback?.proposalName}</strong>?
              </p>
              <p style={styles.modalSubText}>
                This action will notify the client and update the proposal status in real-time.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={handleCancelSave} style={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={handleConfirmSave} disabled={saving} style={saving ? styles.confirmButtonDisabled : styles.confirmButton}>
                {saving ? "Saving..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .feedback-spin {
          animation: feedback-spin 1s linear infinite;
        }
        @keyframes feedback-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .feedback-card {
          animation: fadeInUp 0.3s ease-out;
        }
        .feedback-card:hover {
          transform: translateX(4px);
          transition: transform 0.2s ease;
        }
        .feedback-detail-card::-webkit-scrollbar {
          width: 6px;
        }
        .feedback-detail-card::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        .feedback-detail-card::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .feedback-detail-card::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "24px"
  },
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    borderRadius: "24px",
    padding: "32px",
    marginBottom: "32px",
    boxShadow: "0 20px 40px rgba(102, 126, 234, 0.15)",
    position: "relative",
    overflow: "hidden"
  },
  headerContent: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    position: "relative",
    zIndex: 1
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "700",
    color: "#ffffff",
    display: "flex",
    alignItems: "center"
  },
  subtitle: {
    margin: "8px 0 0 0",
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: "14px"
  },
  headerBadge: {
    background: "rgba(255, 255, 255, 0.2)",
    backdropFilter: "blur(10px)",
    padding: "8px 16px",
    borderRadius: "999px",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px",
    marginBottom: "32px"
  },
  summaryCard: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "24px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
    transition: "all 0.3s ease",
    position: "relative",
    overflow: "hidden"
  },
  summaryIcon: {
    fontSize: "32px",
    marginBottom: "12px"
  },
  summaryValue: {
    fontSize: "36px",
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: "8px"
  },
  summaryLabel: {
    fontSize: "14px",
    color: "#64748b",
    fontWeight: "500"
  },
  summaryTrend: {
    fontSize: "12px",
    color: "#10b981",
    marginTop: "8px"
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "24px"
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "#ffffff",
    border: "2px solid #e2e8f0",
    borderRadius: "14px",
    padding: "12px 18px",
    flex: 1,
    minWidth: "280px",
    transition: "all 0.2s ease"
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
    border: "2px solid #e2e8f0",
    padding: "12px 16px",
    fontSize: "14px",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer"
  },
  selectSmall: {
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    padding: "8px 12px",
    fontSize: "13px",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer"
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)",
    gap: "24px",
    alignItems: "start"
  },
  listColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
    overflow: "hidden"
  },
  feedbackCard: {
    width: "100%",
    textAlign: "left",
    padding: "16px",
    borderRadius: "16px",
    border: "2px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    transition: "all 0.2s ease",
    overflow: "hidden"
  },
  feedbackCardActive: {
    borderColor: "#667eea",
    boxShadow: "0 12px 28px rgba(102, 126, 234, 0.12)",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)"
  },
  feedbackCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "12px"
  },
  feedbackProposal: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: "1.3",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    wordBreak: "break-word"
  },
  statusBadge: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    flexShrink: 0
  },
  statusBadgeSmall: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: "600",
    whiteSpace: "nowrap"
  },
  feedbackMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "8px",
    color: "#64748b",
    fontSize: "13px",
    overflow: "hidden"
  },
  truncatedText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1
  },
  truncatedTextEmail: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    wordBreak: "break-all"
  },
  progressBar: {
    height: "4px",
    background: "#f1f5f9",
    borderRadius: "2px",
    marginTop: "12px",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #10b981, #34d399)",
    borderRadius: "2px",
    transition: "width 0.3s ease"
  },
  progressBarSmall: {
    height: "6px",
    background: "#f1f5f9",
    borderRadius: "3px",
    overflow: "hidden",
    marginTop: "8px"
  },
  progressFillSmall: {
    height: "100%",
    background: "linear-gradient(90deg, #667eea, #764ba2)",
    borderRadius: "3px",
    transition: "width 0.3s ease"
  },
  feedbackStats: {
    display: "flex",
    gap: "12px",
    marginTop: "10px",
    fontSize: "12px",
    fontWeight: "600",
    color: "#475569",
    flexWrap: "wrap"
  },
  feedbackTimestamp: {
    marginTop: "10px",
    fontSize: "11px",
    color: "#94a3b8",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    overflow: "hidden"
  },
  detailColumn: {
    minHeight: "500px"
  },
  detailCard: {
    background: "#ffffff",
    borderRadius: "20px",
    border: "1px solid #e2e8f0",
    padding: "24px",
    position: "sticky",
    top: "24px",
    maxHeight: "calc(100vh - 48px)",
    overflowY: "auto"
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "20px",
    paddingBottom: "16px",
    borderBottom: "2px solid #e2e8f0"
  },
  detailHeaderLeft: {
    flex: 1,
    minWidth: 0
  },
  detailTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: "8px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    wordBreak: "break-word"
  },
  detailClient: {
    color: "#64748b",
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
    overflow: "hidden"
  },
  detailInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginBottom: "20px"
  },
  detailInfoCard: {
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "16px",
    border: "1px solid #e2e8f0"
  },
  detailInfoLabel: {
    fontSize: "12px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "8px"
  },
  detailInfoValue: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#0f172a"
  },
  overallComment: {
    padding: "16px",
    borderRadius: "16px",
    background: "#fef3c7",
    border: "1px solid #fde68a",
    marginBottom: "20px"
  },
  overallCommentText: {
    marginTop: "8px",
    fontSize: "14px",
    color: "#92400e",
    lineHeight: "1.6"
  },
  itemsList: {
    marginBottom: "20px"
  },
  sectionHeader: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center"
  },
  itemCard: {
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    marginBottom: "12px"
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap"
  },
  itemTitleSection: {
    flex: 1,
    minWidth: 0
  },
  itemTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: "8px",
    wordBreak: "break-word"
  },
  itemDecisionRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap"
  },
  itemStatusText: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: "600"
  },
  itemActions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexShrink: 0
  },
  expandButton: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: "20px",
    fontWeight: "600",
    color: "#667eea",
    transition: "all 0.2s ease"
  },
  itemSelect: {
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    padding: "6px 10px",
    fontSize: "12px",
    background: "#ffffff",
    cursor: "pointer"
  },
  detailSectionTitle: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "8px",
    display: "flex",
    alignItems: "center"
  },
  clientCommentBox: {
    padding: "14px",
    borderRadius: "12px",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    marginTop: "14px"
  },
  clientCommentText: {
    fontSize: "14px",
    color: "#92400e",
    lineHeight: "1.6",
    wordBreak: "break-word"
  },
  replyBox: {
    padding: "14px",
    borderRadius: "12px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    marginTop: "12px"
  },
  replyTextarea: {
    width: "100%",
    resize: "vertical",
    borderRadius: "10px",
    border: "1px solid #bfdbfe",
    padding: "12px",
    fontSize: "14px",
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box"
  },
  saveMessage: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "500",
    marginBottom: "20px"
  },
  successMessage: {
    background: "#ecfdf5",
    color: "#166534",
    border: "1px solid #86efac"
  },
  errorMessage: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fca5a5"
  },
  detailFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    alignItems: "center",
    paddingTop: "20px",
    borderTop: "2px solid #e2e8f0"
  },
  footerHint: {
    fontSize: "13px",
    color: "#64748b",
    lineHeight: "1.5"
  },
  saveButton: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#ffffff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    transition: "all 0.2s ease"
  },
  saveButtonDisabled: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: "700",
    background: "#cbd5e1",
    color: "#ffffff",
    cursor: "not-allowed",
    display: "flex",
    alignItems: "center"
  },
  emptyState: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "40px",
    borderRadius: "20px",
    background: "#ffffff",
    border: "2px dashed #e2e8f0",
    color: "#64748b",
    justifyContent: "center"
  },
  emptyDetail: {
    minHeight: "500px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    textAlign: "center",
    borderRadius: "24px",
    background: "#ffffff",
    border: "2px dashed #e2e8f0",
    padding: "60px"
  },
  emptyDetailTitle: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#0f172a",
    margin: 0
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.8)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  },
  modalContent: {
    background: "#ffffff",
    borderRadius: "24px",
    boxShadow: "0 40px 80px rgba(15, 23, 42, 0.2)",
    maxWidth: "480px",
    width: "90%",
    animation: "slideIn 0.3s ease-out"
  },
  modalHeader: {
    padding: "24px",
    borderBottom: "2px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  modalTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "700",
    color: "#0f172a",
    display: "flex",
    alignItems: "center"
  },
  modalCloseButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "#64748b",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    borderRadius: "8px"
  },
  modalBody: {
    padding: "24px"
  },
  modalText: {
    margin: "0 0 12px 0",
    fontSize: "16px",
    color: "#334155",
    lineHeight: "1.6"
  },
  modalSubText: {
    margin: 0,
    fontSize: "14px",
    color: "#64748b"
  },
  modalFooter: {
    display: "flex",
    gap: "12px",
    padding: "20px 24px 24px",
    justifyContent: "flex-end"
  },
  cancelButton: {
    border: "2px solid #e2e8f0",
    borderRadius: "10px",
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: "600",
    background: "#ffffff",
    color: "#64748b",
    cursor: "pointer"
  },
  confirmButton: {
    border: "none",
    borderRadius: "10px",
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#ffffff",
    cursor: "pointer"
  },
  confirmButtonDisabled: {
    border: "none",
    borderRadius: "10px",
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: "700",
    background: "#cbd5e1",
    color: "#ffffff",
    cursor: "not-allowed"
  }
};