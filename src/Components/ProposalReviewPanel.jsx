import { useEffect, useMemo, useState } from "react";
import emailjs from "@emailjs/browser";
import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  MdCheckCircle,
  MdErrorOutline,
  MdForum,
  MdOutlineMarkEmailRead,
  MdRefresh,
  MdSend,
  MdClose
} from "react-icons/md";
import {
  PROPOSAL_REVIEW_SECTIONS,
  buildDefaultProposalFeedbackItems
} from "../constants/proposalReviewSections";

const EMAILJS_CONFIG = {
  SERVICE_ID: "service_q6k7l9r",
  TEMPLATE_ID: "template_z3glhb1",
  PUBLIC_KEY: "UF-7_4AU7Jw9Sdo5P",
  ADMIN_EMAIL: "ronvincentb@hyacinthindustriesllc.com"
};

const createFeedbackDocId = (proposalId, clientId) =>
  `${proposalId}_${clientId}`.replace(/[/.#$[\]\s*]/g, "_");

const mergeFeedbackItems = (existingItems = []) => {
  const existingMap = existingItems.reduce((acc, item) => {
    acc[item.sectionKey] = item;
    return acc;
  }, {});

  return buildDefaultProposalFeedbackItems().map((item) => ({
    ...item,
    ...(existingMap[item.sectionKey] || {})
  }));
};

const getDecisionStyles = (decision) => {
  if (decision === "approved") {
    return {
      background: "#ecfdf5",
      borderColor: "#86efac",
      color: "#166534"
    };
  }

  if (decision === "needs_discussion") {
    return {
      background: "#fff7ed",
      borderColor: "#fdba74",
      color: "#9a3412"
    };
  }

  return {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
    color: "#64748b"
  };
};

export default function ProposalReviewPanel({
  proposalId,
  proposalName,
  filePath,
  userRole,
  clientId,
  clientEmail,
  clientName
}) {
  const [items, setItems] = useState(buildDefaultProposalFeedbackItems());
  const [overallComment, setOverallComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [existingFeedback, setExistingFeedback] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const feedbackDocId = useMemo(() => {
    if (!proposalId || !clientId) return "";
    return createFeedbackDocId(proposalId, clientId);
  }, [proposalId, clientId]);

  const hasMissingDecision = items.some((item) => !item.clientDecision);
  const hasDiscussionWithoutComment = items.some(
    (item) => item.clientDecision === "needs_discussion" && !item.clientComment.trim()
  );
  const approvedCount = items.filter((item) => item.clientDecision === "approved").length;
  const disputedItems = items.filter((item) => item.clientDecision === "needs_discussion");
  const canSubmit =
    !saving &&
    items.length > 0 &&
    !hasMissingDecision &&
    !hasDiscussionWithoutComment &&
    Boolean(proposalId) &&
    Boolean(clientId);

  useEffect(() => {
    emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
  }, []);

  useEffect(() => {
    const loadExistingFeedback = async () => {
      if (!feedbackDocId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const feedbackRef = doc(db, "proposalFeedback", feedbackDocId);
        const snapshot = await getDoc(feedbackRef);

        if (snapshot.exists()) {
          const data = snapshot.data();
          setExistingFeedback({
            id: snapshot.id,
            ...data
          });
          setItems(mergeFeedbackItems(data.items));
          setOverallComment(data.overallComment || "");
          setMessage("Previous feedback loaded. You can update it any time.");
          setMessageType("info");
        } else {
          setItems(buildDefaultProposalFeedbackItems());
          setOverallComment("");
          setExistingFeedback(null);
          setMessage("");
        }
      } catch (error) {
        console.error("Error loading proposal feedback:", error);
        setMessage("Failed to load your review history.");
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    };

    loadExistingFeedback();
  }, [feedbackDocId]);

  const setDecision = (sectionKey, clientDecision) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.sectionKey === sectionKey
          ? {
              ...item,
              clientDecision,
              itemStatus:
                clientDecision === "approved"
                  ? "approved"
                  : item.itemStatus === "approved"
                    ? "open"
                    : item.itemStatus || "open"
            }
          : item
      )
    );
  };

  const setComment = (sectionKey, clientComment) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.sectionKey === sectionKey
          ? {
              ...item,
              clientComment
            }
          : item
      )
    );
  };

  const sendFeedbackNotification = async (payload) => {
    try {
      const disputedTitles = payload.items
        .filter((item) => item.clientDecision === "needs_discussion")
        .map((item) => item.sectionTitle)
        .join(", ");

      await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        {
          to_email: EMAILJS_CONFIG.ADMIN_EMAIL,
          to_name: "Admin",
          proposal_name: payload.proposalName,
          viewer_name: payload.clientName,
          viewer_email: payload.clientEmail,
          viewer_id: payload.clientId,
          viewed_at: new Date().toLocaleString(),
          status: `Feedback Submitted (${payload.totalDisputed} items need discussion)`,
          location: "Proposal Feedback Panel",
          device: "Proposal Review",
          browser: "Web",
          platform: "Client Portal",
          view_link: `${window.location.origin}/dashboard`,
          feedback_summary: `${payload.totalApproved} approved, ${payload.totalDisputed} need discussion.`,
          disputed_sections: disputedTitles || "No disputed sections",
          timestamp: new Date().toISOString()
        }
      );
    } catch (error) {
      console.error("Error sending feedback email:", error);
    }
  };

  const handleSubmitClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = () => {
    handleSubmitFeedback();
  };

  const handleCancelSubmit = () => {
    setShowConfirmModal(false);
  };

  const handleSubmitFeedback = async () => {
    if (!canSubmit) return;

    setSaving(true);
    setMessage("");

    try {
      const nowIso = new Date().toISOString();
      const totalDisputed = disputedItems.length;
      const overallStatus = totalDisputed > 0 ? "needs_discussion" : "approved";
      const nextAdminStatus =
        totalDisputed > 0 ? "needs_response" : "approved";
      const feedbackItems = items.map((item) => ({
        ...item,
        itemStatus:
          item.clientDecision === "approved"
            ? "approved"
            : item.itemStatus === "resolved"
              ? "resolved"
              : item.itemStatus || "open",
        clientUpdatedAt: nowIso
      }));

      const payload = {
        proposalId,
        proposalName,
        filePath,
        clientId,
        clientEmail,
        clientName,
        items: feedbackItems,
        overallComment,
        totalApproved: approvedCount,
        totalDisputed,
        totalSections: feedbackItems.length,
        overallStatus,
        adminStatus:
          existingFeedback?.adminStatus === "resolved" && totalDisputed === 0
            ? "approved"
            : nextAdminStatus,
        lastUpdated: serverTimestamp(),
        lastClientSubmissionAt: serverTimestamp(),
        createdAt: existingFeedback?.createdAt || serverTimestamp()
      };

      await setDoc(doc(db, "proposalFeedback", feedbackDocId), payload, {
        merge: true
      });

      await sendFeedbackNotification({
        ...payload,
        items: feedbackItems,
        clientName,
        clientEmail,
        clientId
      });

      setExistingFeedback((current) => ({
        ...(current || {}),
        ...payload,
        id: feedbackDocId
      }));
      const successMsg = totalDisputed > 0
        ? "Feedback submitted. The admin has been notified about the discussion points."
        : "Feedback submitted. The admin has been notified of your approvals.";
      setMessage(successMsg);
      setMessageType("success");
      setShowConfirmModal(false);
      setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      console.error("Error saving proposal feedback:", error);
      setMessage("We couldn’t submit your feedback. Please try again.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  if (userRole !== "client") {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Proposal Review</h3>
          <p style={styles.subtitle}>
            Approve each section or flag the parts that need discussion. The admin will see your notes in the dashboard.
          </p>
        </div>
        <div style={styles.headerBadge}>
          <MdForum size={18} />
          Negotiation Ready
        </div>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{approvedCount}</div>
          <div style={styles.statLabel}>Approved</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: "#C2410C" }}>{disputedItems.length}</div>
          <div style={styles.statLabel}>Need Discussion</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: "#475569" }}>{items.length}</div>
          <div style={styles.statLabel}>Sections</div>
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>
          <MdRefresh size={18} className="spin-icon" />
          <span>Loading review options...</span>
        </div>
      ) : (
        <>
          {message && (
            <div
              style={{
                ...styles.message,
                ...(messageType === "success"
                  ? styles.successMessage
                  : messageType === "error"
                    ? styles.errorMessage
                    : styles.infoMessage)
              }}
            >
              {messageType === "success" ? (
                <MdCheckCircle size={18} />
              ) : messageType === "error" ? (
                <MdErrorOutline size={18} />
              ) : (
                <MdOutlineMarkEmailRead size={18} />
              )}
              <span>{message}</span>
            </div>
          )}

          <div style={styles.sections}>
            {PROPOSAL_REVIEW_SECTIONS.map((section) => {
              const item = items.find((entry) => entry.sectionKey === section.key) || {
                sectionKey: section.key,
                sectionTitle: section.title,
                clientDecision: "",
                clientComment: "",
                adminReply: "",
                itemStatus: "open"
              };
              const decisionStyles = getDecisionStyles(item.clientDecision);

              return (
                <div key={section.key} style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <div>
                      <div style={styles.sectionTitle}>{section.title}</div>
                      <div style={styles.sectionDescription}>{section.description}</div>
                    </div>
                    <span
                      style={{
                        ...styles.sectionStatus,
                        background: decisionStyles.background,
                        borderColor: decisionStyles.borderColor,
                        color: decisionStyles.color
                      }}
                    >
                      {item.clientDecision === "approved"
                        ? "Approved"
                        : item.clientDecision === "needs_discussion"
                          ? "Needs Discussion"
                          : "Awaiting Decision"}
                    </span>
                  </div>

                  <div style={styles.buttonRow}>
                    <button
                      onClick={() => setDecision(section.key, "approved")}
                      style={{
                        ...styles.decisionButton,
                        ...(item.clientDecision === "approved" ? styles.approveButtonActive : styles.decisionButtonIdle)
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setDecision(section.key, "needs_discussion")}
                      style={{
                        ...styles.decisionButton,
                        ...(item.clientDecision === "needs_discussion" ? styles.discussionButtonActive : styles.decisionButtonIdle)
                      }}
                    >
                      Needs Discussion
                    </button>
                  </div>

                  <textarea
                    value={item.clientComment}
                    onChange={(event) => setComment(section.key, event.target.value)}
                    placeholder={
                      item.clientDecision === "needs_discussion"
                        ? "Explain what should be changed or debated..."
                        : "Optional note for this section..."
                    }
                    style={styles.textarea}
                  />

                  {item.clientDecision === "needs_discussion" && !item.clientComment.trim() && (
                    <div style={styles.warningText}>
                      Add a short note so the admin knows what needs to be debated.
                    </div>
                  )}

                  {item.adminReply && (
                    <div style={styles.adminReplyBox}>
                      <div style={styles.adminReplyTitle}>Admin Reply</div>
                      <div style={styles.adminReplyText}>{item.adminReply}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={styles.overallCard}>
            <div style={styles.overallTitle}>Overall Comment</div>
            <textarea
              value={overallComment}
              onChange={(event) => setOverallComment(event.target.value)}
              placeholder="Optional overall feedback for the proposal..."
              style={{ ...styles.textarea, minHeight: 110 }}
            />
          </div>

          <div style={styles.submitRow}>
            <div style={styles.submitHelp}>
              {hasMissingDecision
                ? "Choose a decision for each section before submitting."
                : hasDiscussionWithoutComment
                  ? "Add comments to each section marked as needing discussion."
                  : "Once submitted, the admin will receive your feedback in the dashboard and by email."}
            </div>

            <button onClick={handleSubmitClick} disabled={!canSubmit} style={canSubmit ? styles.submitButton : styles.submitButtonDisabled}>
              <MdSend size={16} />
              {saving ? "Submitting..." : existingFeedback ? "Update Feedback" : "Submit Feedback"}
            </button>
          </div>
        </>
      )}

      {showConfirmModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                <MdOutlineMarkEmailRead size={20} style={{marginRight: "8px", verticalAlign: "middle"}} />
                Confirm Feedback Submission
              </h3>
              <button
                onClick={handleCancelSubmit}
                style={styles.modalCloseButton}
              >
                <MdClose size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.modalText}>
                Are you sure you want to submit your feedback for <strong>{proposalName}</strong>?
              </p>
              <p style={styles.modalSubText}>
                The admin will review your approvals and discussion points. You can update this feedback anytime.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button
                onClick={handleCancelSubmit}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={saving}
                style={saving ? styles.confirmButtonDisabled : styles.confirmButton}
              >
                {saving ? "Submitting..." : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spin-icon {
          animation: review-spin 1s linear infinite;
        }

        @keyframes review-spin {
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
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    marginTop: "24px",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "22px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "18px"
  },
  title: {
    margin: 0,
    fontSize: "22px",
    color: "#0f172a"
  },
  subtitle: {
    margin: "8px 0 0 0",
    fontSize: "14px",
    lineHeight: "1.6",
    color: "#64748b",
    maxWidth: "720px"
  },
  headerBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "999px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: "13px",
    fontWeight: "600"
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "12px",
    marginBottom: "18px"
  },
  statCard: {
    padding: "16px",
    borderRadius: "14px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0"
  },
  statValue: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#0f172a"
  },
  statLabel: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "6px"
  },
  loadingBox: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 18px",
    borderRadius: "12px",
    background: "#f8fafc",
    color: "#475569",
    fontSize: "14px"
  },
  message: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    borderRadius: "12px",
    marginBottom: "18px",
    fontSize: "14px",
    border: "1px solid transparent"
  },
  successMessage: {
    background: "#ecfdf5",
    color: "#166534",
    borderColor: "#86efac"
  },
  errorMessage: {
    background: "#fef2f2",
    color: "#991b1b",
    borderColor: "#fca5a5"
  },
  infoMessage: {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderColor: "#bfdbfe"
  },
  sections: {
    display: "flex",
    flexDirection: "column",
    gap: "14px"
  },
  sectionCard: {
    padding: "18px",
    borderRadius: "16px",
    border: "1px solid #e2e8f0",
    background: "#ffffff"
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "14px"
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a"
  },
  sectionDescription: {
    marginTop: "5px",
    fontSize: "13px",
    color: "#64748b",
    lineHeight: "1.5",
    maxWidth: "620px"
  },
  sectionStatus: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: "700"
  },
  buttonRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginBottom: "12px"
  },
  decisionButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease"
  },
  decisionButtonIdle: {
    background: "#ffffff",
    color: "#334155"
  },
  approveButtonActive: {
    background: "#16a34a",
    borderColor: "#16a34a",
    color: "#ffffff",
    boxShadow: "0 10px 20px rgba(22, 163, 74, 0.18)"
  },
  discussionButtonActive: {
    background: "#ea580c",
    borderColor: "#ea580c",
    color: "#ffffff",
    boxShadow: "0 10px 20px rgba(234, 88, 12, 0.18)"
  },
  textarea: {
    width: "100%",
    minHeight: "92px",
    resize: "vertical",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    padding: "12px 14px",
    fontSize: "14px",
    color: "#0f172a",
    outline: "none",
    background: "#f8fafc",
    boxSizing: "border-box"
  },
  warningText: {
    marginTop: "8px",
    fontSize: "12px",
    color: "#b45309",
    fontWeight: "600"
  },
  adminReplyBox: {
    marginTop: "12px",
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#f8fafc",
    border: "1px solid #dbeafe"
  },
  adminReplyTitle: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#1d4ed8",
    marginBottom: "6px"
  },
  adminReplyText: {
    fontSize: "13px",
    color: "#334155",
    lineHeight: "1.6"
  },
  overallCard: {
    marginTop: "18px",
    padding: "18px",
    borderRadius: "16px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0"
  },
  overallTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: "10px"
  },
  submitRow: {
    marginTop: "18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap"
  },
  submitHelp: {
    fontSize: "13px",
    color: "#64748b",
    maxWidth: "620px",
    lineHeight: "1.6"
  },
  submitButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 18px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(37, 99, 235, 0.18)"
  },
  submitButtonDisabled: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 18px",
    borderRadius: "12px",
    border: "none",
    background: "#cbd5e1",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "not-allowed"
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  },
  modalContent: {
    background: "#ffffff",
    borderRadius: "16px",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.15)",
    maxWidth: "480px",
    width: "90%",
    animation: "slideIn 0.3s ease-out"
  },
  modalHeader: {
    padding: "24px",
    borderBottom: "1px solid #e2e8f0",
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
    justifyContent: "center",
    borderRadius: "6px",
    transition: "all 0.2s ease"
  },
  modalBody: {
    padding: "20px 24px"
  },
  modalText: {
    margin: "0 0 12px 0",
    fontSize: "15px",
    color: "#334155",
    lineHeight: "1.6"
  },
  modalSubText: {
    margin: 0,
    fontSize: "14px",
    color: "#64748b",
    lineHeight: "1.5"
  },
  modalFooter: {
    display: "flex",
    gap: "12px",
    padding: "16px 24px 24px 24px",
    justifyContent: "flex-end"
  },
  cancelButton: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: "600",
    background: "#ffffff",
    color: "#334155",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)"
  },
  confirmButton: {
    border: "none",
    borderRadius: "10px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#ffffff",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 6px 16px rgba(16, 185, 129, 0.2)"
  },
  confirmButtonDisabled: {
    border: "none",
    borderRadius: "10px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: "700",
    background: "#cbd5e1",
    color: "#ffffff",
    cursor: "not-allowed",
    opacity: "0.6"
  }
};
