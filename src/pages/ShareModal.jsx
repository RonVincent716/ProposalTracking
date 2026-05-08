import { useState } from "react";
import { db, auth } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { 
  MdClose, 
  MdEmail, 
  MdSend, 
  MdCheckCircle, 
  MdError,
  MdOpenInNew,
  MdContentCopy
} from "react-icons/md";
import emailjs from '@emailjs/browser';
import { ActivityLogger } from "../utils/activityLogger";

// EmailJS Configuration - Replace with your actual credentials
const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_q6k7l9r',  // Your EmailJS service ID
  TEMPLATE_ID: 'template_438lqns', // Your EmailJS template ID
  PUBLIC_KEY: 'UF-7_4AU7Jw9Sdo5P'     // Your EmailJS public key
};

const ShareModal = ({ isOpen, onClose, proposal, user }) => {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate share link
  const generateShareLink = () => {
    const fullPath = `proposals/${proposal.name}`;
    const encodedPath = btoa(fullPath);
    return `${window.location.origin}/p/${encodedPath}`;
  };

  const proposalLink = generateShareLink();

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      setEmailError("Please enter recipient email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setSendingEmail(true);
    setEmailError("");

    const templateParams = {
      to_email: recipientEmail,
      to_name: recipientName || "Valued Recipient",
      from_name: user?.displayName || user?.email?.split('@')[0] || "Someone",
      from_email: user?.email,
      proposal_name: proposal.name,
      proposal_link: proposalLink,
      message: emailMessage || "I'd like to share this proposal with you. Please review it and let me know your thoughts.",
      reply_to: user?.email,
      current_date: new Date().toLocaleDateString()
    };

    try {
      // Initialize EmailJS
      emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
      
      const response = await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        templateParams
      );

      console.log("Email sent successfully to:", recipientEmail);
      
      // Save to Firestore
      try {
        await addDoc(collection(db, "emailHistory"), {
          proposalName: proposal.name,
          recipientEmail: recipientEmail,
          recipientName: recipientName,
          sentBy: user.email,
          sentAt: serverTimestamp(),
          shareLink: proposalLink,
          message: emailMessage,
          status: "sent"
        });
      } catch (err) {
        console.error("Error saving email record:", err);
      }

      // Log the email share activity
      await ActivityLogger.logEmailShare(proposal.name, recipientEmail, recipientName);

      setEmailSent(true);
      
      // Reset form after 3 seconds and close modal
      setTimeout(() => {
        resetForm();
        onClose();
      }, 3000);
      
    } catch (error) {
      console.error("Error sending email:", error);
      setEmailError(`Failed to send email: ${error.text || error.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(proposalLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setEmailError("Failed to copy link");
    }
  };

  const resetForm = () => {
    setRecipientEmail("");
    setRecipientName("");
    setEmailMessage("");
    setEmailSent(false);
    setEmailError("");
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <MdEmail size={24} color="#4CAF50" />
            <h3 style={styles.title}>Share Proposal via Email</h3>
          </div>
          <button onClick={handleClose} style={styles.closeButton}>
            <MdClose size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={styles.body}>
          {/* Proposal Info */}
          <div style={styles.proposalInfo}>
            <div style={styles.proposalIcon}>
              <MdOpenInNew size={16} />
            </div>
            <div>
              <div style={styles.proposalLabel}>Proposal</div>
              <div style={styles.proposalName}>{proposal.name}</div>
            </div>
          </div>

          {/* Sender Info */}
          <div style={styles.senderInfo}>
            <div style={styles.senderLabel}>Sending as</div>
            <div style={styles.senderEmail}>{user?.email}</div>
          </div>

          {!emailSent ? (
            <>
              {/* Email Form */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Recipient Email <span style={styles.required}>*</span>
                </label>
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={recipientEmail}
                  onChange={(e) => {
                    setRecipientEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  disabled={sendingEmail}
                  style={styles.input}
                  autoFocus
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Recipient Name (Optional)</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  disabled={sendingEmail}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Personal Message (Optional)</label>
                <textarea
                  placeholder="Hi, I'd like to share this proposal with you. Please review it and let me know your thoughts."
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  disabled={sendingEmail}
                  rows="3"
                  style={styles.textarea}
                />
              </div>

              {/* Link Preview */}
              <div style={styles.linkPreview}>
                <div style={styles.linkPreviewHeader}>
                  <MdContentCopy size={12} />
                  <span>Proposal Link</span>
                </div>
                <div style={styles.linkPreviewContent}>
                  <div style={styles.linkUrl}>{proposalLink.substring(0, 60)}...</div>
                  <button onClick={handleCopyLink} style={styles.copyButton} title="Copy link">
                    {copied ? <MdCheckCircle size={14} /> : <MdContentCopy size={14} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {emailError && (
                <div style={styles.errorMessage}>
                  <MdError size={16} />
                  <span>{emailError}</span>
                </div>
              )}
            </>
          ) : (
            /* Success State */
            <div style={styles.successState}>
              <div style={styles.successIcon}>
                <MdCheckCircle size={48} color="#4CAF50" />
              </div>
              <h4 style={styles.successTitle}>Email Sent Successfully!</h4>
              <p style={styles.successMessage}>
                Your proposal has been sent to <strong>{recipientEmail}</strong>
              </p>
              <div style={styles.successNote}>
                The recipient will receive an email with the proposal link.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!emailSent && (
          <div style={styles.footer}>
            <button onClick={handleClose} style={styles.cancelButton} disabled={sendingEmail}>
              Cancel
            </button>
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail || !recipientEmail}
              style={{
                ...styles.sendButton,
                opacity: (sendingEmail || !recipientEmail) ? 0.6 : 1,
                cursor: (sendingEmail || !recipientEmail) ? "not-allowed" : "pointer",
              }}
            >
              {sendingEmail ? (
                <>
                  <div style={styles.spinner}></div>
                  Sending...
                </>
              ) : (
                <>
                  <MdSend size={18} />
                  Send Email
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: "20px",
    animation: "fadeIn 0.2s ease",
  },
  modal: {
    background: "#fff",
    borderRadius: "24px",
    width: "100%",
    maxWidth: "500px",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.25)",
    animation: "slideUp 0.3s ease",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e8e8e8",
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    color: "#1a1a2e",
  },
  closeButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#999",
    transition: "all 0.2s",
    ":hover": {
      background: "#f5f5f5",
      color: "#666",
    },
  },
  body: {
    padding: "24px",
  },
  proposalInfo: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "12px",
    background: "#f8f9fa",
    borderRadius: "12px",
    marginBottom: "16px",
  },
  proposalIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "#e3f2fd",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#1976D2",
  },
  proposalLabel: {
    fontSize: "11px",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  },
  proposalName: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#333",
    wordBreak: "break-all",
  },
  senderInfo: {
    padding: "12px",
    background: "#f0fdf4",
    borderRadius: "12px",
    marginBottom: "20px",
    border: "1px solid #bbf7d0",
  },
  senderLabel: {
    fontSize: "11px",
    color: "#166534",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  },
  senderEmail: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#15803d",
    wordBreak: "break-all",
  },
  formGroup: {
    marginBottom: "20px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontSize: "13px",
    fontWeight: "500",
    color: "#374151",
  },
  required: {
    color: "#ef4444",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    fontSize: "14px",
    transition: "all 0.2s",
    boxSizing: "border-box",
    outline: "none",
    ":focus": {
      borderColor: "#4CAF50",
      boxShadow: "0 0 0 2px rgba(76, 175, 80, 0.1)",
    },
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    fontSize: "14px",
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
    outline: "none",
    ":focus": {
      borderColor: "#4CAF50",
      boxShadow: "0 0 0 2px rgba(76, 175, 80, 0.1)",
    },
  },
  linkPreview: {
    marginTop: "20px",
    padding: "12px",
    background: "#f8f9fa",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
  },
  linkPreviewHeader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "8px",
    fontSize: "11px",
    color: "#6b7280",
  },
  linkPreviewContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  linkUrl: {
    flex: 1,
    fontSize: "12px",
    color: "#3b82f6",
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  copyButton: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 12px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "12px",
    color: "#6b7280",
    cursor: "pointer",
    transition: "all 0.2s",
    ":hover": {
      background: "#f3f4f6",
      borderColor: "#d1d5db",
    },
  },
  errorMessage: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px",
    background: "#fef2f2",
    borderRadius: "10px",
    marginTop: "16px",
    fontSize: "13px",
    color: "#dc2626",
  },
  successState: {
    textAlign: "center",
    padding: "20px 0",
  },
  successIcon: {
    marginBottom: "16px",
  },
  successTitle: {
    margin: "0 0 8px 0",
    fontSize: "18px",
    fontWeight: "600",
    color: "#1a1a2e",
  },
  successMessage: {
    margin: "0 0 12px 0",
    fontSize: "14px",
    color: "#6b7280",
  },
  successNote: {
    fontSize: "12px",
    color: "#9ca3af",
    padding: "12px",
    background: "#f9fafb",
    borderRadius: "8px",
  },
  footer: {
    display: "flex",
    gap: "12px",
    padding: "16px 24px",
    borderTop: "1px solid #e8e8e8",
    justifyContent: "flex-end",
  },
  cancelButton: {
    padding: "10px 20px",
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "500",
    color: "#6b7280",
    cursor: "pointer",
    transition: "all 0.2s",
    ":hover": {
      background: "#e5e7eb",
    },
  },
  sendButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 24px",
    background: "#4CAF50",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "500",
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.2s",
    ":hover": {
      background: "#43a047",
      transform: "translateY(-1px)",
    },
  },
  spinner: {
    width: "16px",
    height: "16px",
    border: "2px solid #fff",
    borderTop: "2px solid transparent",
    borderRadius: "50%",
    animation: "spin 0.6s linear infinite",
  },
};

// Add animations to document
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default ShareModal;