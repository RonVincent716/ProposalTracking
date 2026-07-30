import { useState, useEffect, useCallback, useMemo } from "react";
import { storage, auth, db } from "../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  addDoc, 
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc
} from "firebase/firestore";
import { 
  MdCloudUpload, 
  MdCheckCircle, 
  MdError, 
  MdSend, 
  MdEmail, 
  MdClose,
  MdContentCopy,
  MdOpenInNew,
  MdPerson,
  MdSearch,
  MdInfo
} from "react-icons/md";
import emailjs from '@emailjs/browser';
import { ActivityLogger } from '../utils/activityLogger';

// EmailJS Configuration 
const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_q6k7l9r',
  TEMPLATE_ID: 'template_438lqns',
  PUBLIC_KEY: 'UF-7_4AU7Jw9Sdo5P'
};

export default function ProposalUploader() {
  const [file, setFile] = useState(null);
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shareLink, setShareLink] = useState("");
  const [error, setError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  // Email form state
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
  
  // Client search state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [assessmentDraft, setAssessmentDraft] = useState({
    companyOverview: "",
    strengths: "",
    gaps: "",
    recommendation: "",
    riskLevel: "medium",
    readinessScore: 60,
    adminNotes: ""
  });
  const [assessmentSaving, setAssessmentSaving] = useState(false);
  const [assessmentStatus, setAssessmentStatus] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    return () => unsub();
  }, []);

  // Search for existing clients
  const searchClients = async (term) => {
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("role", "==", "client"),
        where("email", ">=", term.toLowerCase()),
        where("email", "<=", term.toLowerCase() + '\uf8ff')
      );
      const snapshot = await getDocs(q);
      const results = [];
      snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
      });
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching clients:", error);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchTerm) {
        searchClients(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  useEffect(() => {
    const email = (recipientEmail || "").trim().toLowerCase();
    if (!email) {
      setAssessmentDraft({
        companyOverview: "",
        strengths: "",
        gaps: "",
        recommendation: "",
        riskLevel: "medium",
        readinessScore: 60,
        adminNotes: ""
      });
      setAssessmentStatus("");
      return;
    }

    let cancelled = false;

    const loadAssessment = async () => {
      try {
        const assessmentRef = doc(db, "proposalAssessments", email);
        const assessmentSnap = await getDoc(assessmentRef);
        if (cancelled) return;

        if (assessmentSnap.exists()) {
          const data = assessmentSnap.data() || {};
          setAssessmentDraft({
            companyOverview: data.companyOverview || "",
            strengths: Array.isArray(data.strengths)
              ? data.strengths.join("\n")
              : (data.strengths || ""),
            gaps: Array.isArray(data.gaps)
              ? data.gaps.join("\n")
              : (data.gaps || ""),
            recommendation: data.recommendation || "",
            riskLevel: data.riskLevel || "medium",
            readinessScore: Number.isFinite(Number(data.readinessScore)) ? Number(data.readinessScore) : 60,
            adminNotes: data.adminNotes || ""
          });
          setAssessmentStatus("Assessment loaded");
        } else {
          setAssessmentDraft(buildAssessmentDraft());
          setAssessmentStatus("Auto-generated");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading assessment:", error);
          setAssessmentStatus("Unable to load assessment");
        }
      }
    };

    loadAssessment();

    return () => {
      cancelled = true;
    };
  }, [recipientEmail, selectedClient]);

  const sanitizeFileName = useCallback((fileName) => {
    return fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  }, []);

  const validateFile = useCallback((file) => {
    if (!file) return false;
    
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      return false;
    }
    
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 50MB');
      return false;
    }
    
    return true;
  }, []);

  const handleFileChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    setError("");
    setUploadSuccess(false);
    setShareLink("");
    setShowEmailModal(false);

    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
    } else {
      setFile(null);
    }
  }, [validateFile]);

  const uploadFile = useCallback(async () => {
    if (!file) {
      setError("Select a file first!");
      return;
    }
    if (!user) {
      setError("Please login first");
      return;
    }

    setUploading(true);
    setError("");
    setUploadSuccess(false);

    const cleanName = sanitizeFileName(file.name);
    const timestamp = Date.now();
    const uniqueName = `${timestamp}_${cleanName}`;
    const filePath = `proposals/${uniqueName}`;
    const fileRef = ref(storage, filePath);

    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(progress);
      },
      (error) => {
        setError(error.message);
        setUploading(false);
      },
      async () => {
        const url = await getDownloadURL(fileRef);
        const encoded = btoa(filePath);
        const link = `${window.location.origin}/p/${encoded}`;
        setShareLink(link);
        setUploadedFileInfo({
          name: file.name,
          path: filePath,
          link: link,
          size: file.size,
          uploadedAt: new Date()
        });
        
        try {
          // Save proposal to Firestore
          await addDoc(collection(db, "proposals"), {
            fileName: uniqueName,
            originalName: file.name,
            filePath: filePath,
            shareLink: link,
            downloadUrl: url,
            uploadedBy: user.uid,
            uploadedByEmail: user.email,
            uploadedAt: serverTimestamp(),
            size: file.size
          });

          await addDoc(collection(db, "proposalVersions"), {
            proposalId: filePath,
            proposalName: file.name,
            fileName: uniqueName,
            filePath: filePath,
            versionNumber: 1,
            versionLabel: "v1",
            notes: "Initial upload",
            changeSummary: ["Initial version uploaded"],
            uploadedBy: user.uid,
            uploadedByEmail: user.email,
            uploadedAt: serverTimestamp(),
            isLatest: true,
            source: "upload"
          });

          // Log upload activity
          await ActivityLogger.logUpload(file.name, file.size, file.type);

          // Create assessment draft automatically
          try {
            await addDoc(collection(db, "assessmentDrafts"), {
              proposalId: filePath,
              proposalName: file.name,
              clientEmail: recipientEmail?.toLowerCase() || "",
              clientName: recipientName || "",
              companyName: selectedClient?.companyName || "",
              industry: selectedClient?.industry || "",
              phone: selectedClient?.phone || "",
              website: selectedClient?.website || "",
              status: "draft",
              completionPercentage: 0,
              createdByAdminId: user.uid,
              createdByAdminEmail: user.email,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              lastEditedByName: user.email?.split('@')[0] || 'Admin',
              lastEditedAt: new Date().toISOString(),
              draftHistory: [{
                timestamp: new Date().toISOString(),
                action: 'created',
                editedBy: user.email
              }],
              autoSaveEnabled: true,
              companyOverview: "",
              strengths: "",
              gaps: "",
              recommendation: "",
              readinessScore: 60,
              riskLevel: "medium",
              adminNotes: ""
            });
          } catch (err) {
            console.error("Error creating assessment draft:", err);
          }
        } catch (err) {
          console.error("Error saving to Firestore:", err);
        }
        
        setUploading(false);
        setUploadSuccess(true);
        setProgress(0);
        setFile(null);
        
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
        
        setTimeout(() => {
          setShowEmailModal(true);
        }, 500);
      }
    );
  }, [file, user, sanitizeFileName]);

  const selectExistingClient = (client) => {
    setSelectedClient(client);
    setRecipientEmail(client.email);
    setRecipientName(client.displayName || client.email.split('@')[0]);
    setSearchTerm("");
    setSearchResults([]);
  };

  const generatedAssessment = useMemo(() => {
    const email = (recipientEmail || selectedClient?.email || "").trim().toLowerCase();
    const displayName =
      selectedClient?.displayName ||
      recipientName ||
      (email ? email.split("@")[0] : "Unassigned Client");
    const companyName =
      selectedClient?.companyName ||
      selectedClient?.businessName ||
      selectedClient?.organization ||
      "Not specified";
    const industry = selectedClient?.industry || "Not specified";
    const phone = selectedClient?.phone || selectedClient?.phoneNumber || "";
    const website = selectedClient?.website || selectedClient?.companyWebsite || "";
    const notes = selectedClient?.notes || selectedClient?.adminNotes || "";
    const status = selectedClient?.status || "active";

    let score = 35;
    if (email) score += 15;
    if (selectedClient?.displayName || recipientName) score += 10;
    if (selectedClient?.companyName || selectedClient?.businessName || selectedClient?.organization) score += 10;
    if (phone) score += 10;
    if (website) score += 10;
    if (selectedClient?.industry) score += 5;
    if (notes) score += 5;
    score = Math.min(score, 100);

    const gaps = [];
    if (!selectedClient) gaps.push("Client record has not been matched yet.");
    if (!companyName || companyName === "Not specified") gaps.push("No company name is stored for this client.");
    if (!phone) gaps.push("No phone number is available for follow-up.");
    if (!website) gaps.push("No website or online presence is recorded.");
    if (!selectedClient?.industry) gaps.push("Industry is not tagged, so the proposal may feel generic.");

    const strengths = [];
    if (email) strengths.push("A valid client email is ready for sharing.");
    if (selectedClient?.displayName) strengths.push("Client name is already known.");
    if (selectedClient?.status) strengths.push(`Client status is marked as ${selectedClient.status}.`);
    if (notes) strengths.push("Admin notes are already attached to the account.");

    const recommendations = [];
    if (gaps.length > 0) recommendations.push("Use the proposal to fill the missing operational pieces.");
    if (score >= 75) recommendations.push("Client looks ready for a direct send.");
    else if (score >= 50) recommendations.push("Review the gaps first, then share.");
    else recommendations.push("Consider adding more context before sending.");

    const readinessLabel =
      score >= 75 ? "High" : score >= 50 ? "Medium" : "Low";

    return {
      displayName,
      companyName,
      industry,
      phone,
      website,
      status,
      score,
      readinessLabel,
      gaps,
      strengths,
      recommendations,
    };
  }, [recipientEmail, recipientName, selectedClient]);

  function buildAssessmentDraft(source = generatedAssessment) {
    return {
      companyOverview:
        source.companyName && source.companyName !== "Not specified"
          ? `${source.companyName}${source.industry && source.industry !== "Not specified" ? ` - ${source.industry}` : ""}`
          : source.displayName,
      strengths: source.strengths.join("\n"),
      gaps: source.gaps.join("\n"),
      recommendation: source.recommendations.join("\n"),
      riskLevel: source.score >= 75 ? "low" : source.score >= 50 ? "medium" : "high",
      readinessScore: source.score,
      adminNotes: ""
    };
  }

  const saveAssessment = useCallback(async () => {
    const email = (recipientEmail || "").trim().toLowerCase();
    if (!email) {
      setAssessmentStatus("Enter a client email first");
      return;
    }

    setAssessmentSaving(true);
    setAssessmentStatus("");
    try {
      const payload = {
        clientEmail: email,
        clientName: recipientName || selectedClient?.displayName || email.split("@")[0],
        companyOverview: assessmentDraft.companyOverview.trim(),
        strengths: assessmentDraft.strengths
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        gaps: assessmentDraft.gaps
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        recommendation: assessmentDraft.recommendation.trim(),
        riskLevel: assessmentDraft.riskLevel,
        readinessScore: Number(assessmentDraft.readinessScore) || 0,
        adminNotes: assessmentDraft.adminNotes.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || null,
        updatedByEmail: user?.email || null
      };

      await setDoc(doc(db, "proposalAssessments", email), payload, { merge: true });
      setAssessmentStatus("Assessment saved");
    } catch (error) {
      console.error("Error saving assessment:", error);
      setAssessmentStatus("Failed to save assessment");
    } finally {
      setAssessmentSaving(false);
    }
  }, [assessmentDraft, recipientEmail, recipientName, selectedClient, user]);

  const sendEmail = useCallback(async () => {
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

    try {
      // Find or create client in users collection
      let clientId = null;
      const usersQuery = query(
        collection(db, "users"),
        where("email", "==", recipientEmail.toLowerCase())
      );
      const userSnapshot = await getDocs(usersQuery);
      
      if (!userSnapshot.empty) {
        const clientDoc = userSnapshot.docs[0];
        clientId = clientDoc.id;
        const clientData = clientDoc.data();
        
        // Update if role is not set
        if (clientData.role !== "client") {
          await updateDoc(doc(db, "users", clientId), {
            role: "client"
          });
        }
      } else {
        // Create new client user
        const newClientRef = await addDoc(collection(db, "users"), {
          email: recipientEmail.toLowerCase(),
          displayName: recipientName || recipientEmail.split('@')[0],
          role: "client",
          createdAt: serverTimestamp(),
          status: "active"
        });
        clientId = newClientRef.id;
      }
      
      // Save to sharedProposals collection
      await addDoc(collection(db, "sharedProposals"), {
        fileName: uploadedFileInfo?.name,
        filePath: uploadedFileInfo?.path,
        fileUrl: uploadedFileInfo?.link,
        clientEmail: recipientEmail.toLowerCase(),
        clientId: clientId,
        clientName: recipientName || recipientEmail.split('@')[0],
        sharedBy: user.uid,
        sharedByEmail: user.email,
        sharedAt: serverTimestamp(),
        status: "pending",
        viewCount: 0
      });

      // Log share activity
      await ActivityLogger.logShare(uploadedFileInfo?.path, uploadedFileInfo?.name, [recipientEmail]);

      // Send email via EmailJS
      const templateParams = {
        to_email: recipientEmail,
        to_name: recipientName || "Valued Client",
        from_name: user?.displayName || user?.email?.split('@')[0] || "Someone",
        from_email: user?.email,
        proposal_name: uploadedFileInfo?.name || "Proposal",
        proposal_link: shareLink,
        message: emailMessage || "I'd like to share this proposal with you. Please log in to view and sign it.",
        reply_to: user?.email,
        current_date: new Date().toLocaleDateString(),
        login_link: `${window.location.origin}/client-login`
      };

      await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        templateParams
      );

      console.log("Email sent successfully to:", recipientEmail);
      
      // Save email history
      await addDoc(collection(db, "emailHistory"), {
        proposalId: uploadedFileInfo?.path,
        proposalName: uploadedFileInfo?.name,
        recipientEmail: recipientEmail,
        recipientName: recipientName,
        sentBy: user.email,
        sentAt: serverTimestamp(),
        shareLink: shareLink,
        message: emailMessage,
        status: "sent"
      });

      setEmailSent(true);
      
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailSent(false);
        setRecipientEmail("");
        setRecipientName("");
        setEmailMessage("");
        setSelectedClient(null);
      }, 3000);
      
    } catch (error) {
      console.error("Error sending email:", error);
      setEmailError(`Failed to send email: ${error.text || error.message || "Please check your configuration"}`);
    } finally {
      setSendingEmail(false);
    }
  }, [recipientEmail, recipientName, emailMessage, user, uploadedFileInfo, shareLink]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      alert('✓ Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy link');
    }
  }, [shareLink]);

  const closeModal = useCallback(() => {
    setShowEmailModal(false);
    setEmailError("");
    setEmailSent(false);
    setSearchTerm("");
    setSearchResults([]);
    setSelectedClient(null);
  }, []);

  // Email Modal Component
  const EmailModal = useMemo(() => {
    if (!showEmailModal) return null;
    
    return (
      <div style={styles.modalOverlay} onClick={!sendingEmail ? closeModal : undefined}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <h3 style={styles.modalTitle}>
              <MdEmail style={styles.modalIcon} />
              Share Proposal with Client
            </h3>
            {!sendingEmail && !emailSent && (
              <button style={styles.closeButton} onClick={closeModal}>
                <MdClose size={20} />
              </button>
            )}
          </div>

          {emailSent ? (
            <div style={styles.emailSuccess}>
              <MdCheckCircle size={60} style={styles.successIcon} />
              <h3 style={styles.successTitle}>Proposal Shared Successfully!</h3>
              <p style={styles.successMessage}>
                Your proposal has been sent to <strong>{recipientEmail}</strong>
              </p>
              <p style={styles.successNote}>
                The client can now log in to view and sign the proposal.
              </p>
              <button style={styles.doneButton} onClick={closeModal}>
                Done
              </button>
            </div>
          ) : (
            <>
              <div style={styles.modalBody}>
                {/* Search for existing clients */}
                <div style={styles.searchSection}>
                  <label style={styles.label}>
                    <MdSearch size={14} /> Search Existing Client
                  </label>
                  <input
                    type="text"
                    style={styles.searchInput}
                    placeholder="Search by email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={sendingEmail}
                  />
                  {searching && <p style={styles.searchingText}>Searching...</p>}
                  {searchResults.length > 0 && (
                    <div style={styles.searchResults}>
                      {searchResults.map(client => (
                        <div
                          key={client.id}
                          onClick={() => selectExistingClient(client)}
                          style={styles.searchResultItem}
                        >
                          <MdPerson size={16} color="#6366f1" />
                          <div>
                            <div style={styles.resultEmail}>{client.email}</div>
                            <div style={styles.resultName}>{client.displayName || "Client"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={styles.divider}>
                  <span>OR</span>
                </div>

                {/* New client form */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Client Email <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="email"
                    style={styles.input}
                    placeholder="client@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    disabled={sendingEmail}
                    autoFocus
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Client Name (Optional)</label>
                  <input
                    type="text"
                    style={styles.input}
                    placeholder="John Doe"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    disabled={sendingEmail}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Personal Message (Optional)</label>
                  <textarea
                    style={styles.textarea}
                    rows="3"
                    placeholder="Hi, I'd like to share this proposal with you..."
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    disabled={sendingEmail}
                  />
                </div>

                <div style={styles.infoBox}>
                  <MdInfo size={16} color="#00D4FF" />
                  <span>
                    The client will receive an email with a link to log in and access this proposal.
                    They can view, track time spent, and sign the document.
                  </span>
                </div>

                <div style={styles.assessmentPanel}>
                  <div style={styles.assessmentHeader}>
                    <div>
                      <div style={styles.assessmentEyebrow}>Proposal Qualification</div>
                      <h4 style={styles.assessmentTitle}>Auto-generated pre-sales assessment</h4>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <div style={styles.readinessBadge(assessmentDraft.readinessScore)}>
                        {assessmentDraft.readinessScore >= 75 ? "High" : assessmentDraft.readinessScore >= 50 ? "Medium" : "Low"} ({assessmentDraft.readinessScore}%)
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        {assessmentStatus || "Auto-generated"}
                      </div>
                    </div>
                  </div>

                  <div style={styles.assessmentGrid}>
                    <div style={styles.assessmentCard}>
                      <div style={styles.assessmentCardLabel}>Client</div>
                      <div style={styles.assessmentCardValue}>{generatedAssessment.displayName}</div>
                      <div style={styles.assessmentCardMeta}>{recipientEmail || "No email selected yet"}</div>
                    </div>
                    <div style={styles.assessmentCard}>
                      <div style={styles.assessmentCardLabel}>Company</div>
                      <div style={styles.assessmentCardValue}>{generatedAssessment.companyName}</div>
                      <div style={styles.assessmentCardMeta}>{generatedAssessment.industry}</div>
                    </div>
                    <div style={styles.assessmentCard}>
                      <div style={styles.assessmentCardLabel}>Contact</div>
                      <div style={styles.assessmentCardValue}>{generatedAssessment.phone || "Not provided"}</div>
                      <div style={styles.assessmentCardMeta}>{generatedAssessment.website || "No website recorded"}</div>
                    </div>
                  </div>

                  <div style={styles.assessmentColumns}>
                    <div style={styles.assessmentColumn}>
                      <div style={styles.assessmentColumnTitle}>What looks strong</div>
                      <div style={styles.assessmentAutoHint}>Detected automatically from the client record.</div>
                      <textarea
                        rows="4"
                        style={styles.assessmentTextarea}
                        value={assessmentDraft.strengths}
                        onChange={(e) => setAssessmentDraft((current) => ({ ...current, strengths: e.target.value }))}
                        placeholder="List what is already working well..."
                      />
                    </div>

                    <div style={styles.assessmentColumn}>
                      <div style={styles.assessmentColumnTitle}>What is missing</div>
                      <div style={styles.assessmentAutoHint}>These are the gaps the proposal should address.</div>
                      <textarea
                        rows="4"
                        style={styles.assessmentTextarea}
                        value={assessmentDraft.gaps}
                        onChange={(e) => setAssessmentDraft((current) => ({ ...current, gaps: e.target.value }))}
                        placeholder="List the missing pieces or risks..."
                      />
                    </div>
                  </div>

                  <div style={styles.assessmentRecommendation}>
                    <div style={styles.assessmentColumnTitle}>Company overview</div>
                    <div style={styles.assessmentAutoHint}>Auto-generated from company and contact data.</div>
                    <textarea
                      rows="3"
                      style={styles.assessmentTextarea}
                      value={assessmentDraft.companyOverview}
                      onChange={(e) => setAssessmentDraft((current) => ({ ...current, companyOverview: e.target.value }))}
                      placeholder="Summarize the client, their situation, and the context..."
                    />
                    <div style={{ height: 10 }} />
                    <div style={styles.assessmentColumnTitle}>Recommendation</div>
                    <div style={styles.assessmentAutoHint}>Use this as the default sales angle for the proposal.</div>
                    <textarea
                      rows="3"
                      style={styles.assessmentTextarea}
                      value={assessmentDraft.recommendation}
                      onChange={(e) => setAssessmentDraft((current) => ({ ...current, recommendation: e.target.value }))}
                      placeholder="Write the action you recommend before sharing..."
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginTop: "12px" }}>
                      <label style={styles.assessmentField}>
                        <span style={styles.assessmentFieldLabel}>Readiness score</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={assessmentDraft.readinessScore}
                          onChange={(e) => setAssessmentDraft((current) => ({ ...current, readinessScore: e.target.value }))}
                          style={styles.assessmentInput}
                        />
                      </label>
                      <label style={styles.assessmentField}>
                        <span style={styles.assessmentFieldLabel}>Risk level</span>
                        <select
                          value={assessmentDraft.riskLevel}
                          onChange={(e) => setAssessmentDraft((current) => ({ ...current, riskLevel: e.target.value }))}
                          style={styles.assessmentInput}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </label>
                    </div>
                    <div style={{ marginTop: "12px" }}>
                      <div style={styles.assessmentFieldLabel}>Admin notes</div>
                      <textarea
                        rows="3"
                        style={styles.assessmentTextarea}
                        value={assessmentDraft.adminNotes}
                        onChange={(e) => setAssessmentDraft((current) => ({ ...current, adminNotes: e.target.value }))}
                        placeholder="Private internal notes..."
                      />
                    </div>
                    <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={saveAssessment}
                        disabled={assessmentSaving}
                        style={styles.assessmentSaveButton}
                      >
                        {assessmentSaving ? "Saving..." : "Save assessment"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssessmentDraft(buildAssessmentDraft())}
                        style={styles.assessmentResetButton}
                      >
                        Auto-generate
                      </button>
                    </div>
                  </div>
                </div>

                <div style={styles.proposalPreview}>
                  <div style={styles.previewHeader}>
                    <MdOpenInNew size={14} />
                    <span>Proposal to Share</span>
                  </div>
                  <div style={styles.previewContent}>
                    <strong>{uploadedFileInfo?.name}</strong>
                    <div style={styles.previewLink}>
                      {shareLink?.substring(0, 60)}...
                    </div>
                  </div>
                </div>
              </div>

              {emailError && (
                <div style={styles.modalError}>
                  <MdError size={18} />
                  <span>{emailError}</span>
                </div>
              )}

              <div style={styles.modalFooter}>
                <button style={styles.cancelButton} onClick={closeModal} disabled={sendingEmail}>
                  Cancel
                </button>
                <button
                  style={styles.sendButton}
                  onClick={sendEmail}
                  disabled={sendingEmail || !recipientEmail}
                >
                  {sendingEmail ? (
                    <>
                      <div style={styles.spinner}></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <MdSend size={18} />
                      Share Proposal
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }, [showEmailModal, sendingEmail, emailSent, recipientEmail, recipientName, emailMessage, uploadedFileInfo, shareLink, emailError, user, searchTerm, searchResults, searching, sendEmail, closeModal, selectExistingClient]);

  return (
    <div style={styles.container}>
      <div style={styles.uploadCard}>
        <h2 style={styles.title}>📄 Upload & Share Proposal</h2>
        
        {user ? (
          <div style={styles.userInfo}>
            <span>✓ Logged in as: <strong>{user.email}</strong></span>
          </div>
        ) : (
          <div style={styles.warningMessage}>
            ⚠️ Please login to upload files
          </div>
        )}

        <div 
          style={{
            ...styles.dropZone,
            borderColor: error ? '#f44336' : (file ? '#4CAF50' : '#2196F3'),
            backgroundColor: file ? '#f1f8e9' : '#fafafa'
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile && validateFile(droppedFile)) {
              setFile(droppedFile);
            }
          }}
        >
          <MdCloudUpload size={48} color={file ? '#4CAF50' : '#2196F3'} />
          <p style={styles.dropZoneText}>
            {file ? file.name : 'Drag & drop a PDF file here or click to browse'}
          </p>
          {file && (
            <div style={styles.fileDetails}>
              <span>📄 {(file.size / (1024 * 1024)).toFixed(2)} MB</span>
            </div>
          )}
          <input
            id="file-input"
            type="file"
            accept=".pdf"
            style={styles.fileInput}
            onChange={handleFileChange}
            disabled={!user || uploading}
          />
        </div>

        {error && !uploadSuccess && (
          <div style={styles.errorMessage}>
            <MdError size={20} />
            <span>{error}</span>
          </div>
        )}

        {uploadSuccess && (
          <div style={styles.successMessage}>
            <MdCheckCircle size={20} />
            <span>✓ Upload successful!</span>
          </div>
        )}

        <button
          style={{
            ...styles.uploadButton,
            opacity: (!file || uploading || !user) ? 0.6 : 1,
            cursor: (!file || uploading || !user) ? 'not-allowed' : 'pointer'
          }}
          disabled={!file || uploading || !user}
          onClick={uploadFile}
        >
          {uploading ? `Uploading ${Math.round(progress)}%` : 'Upload Proposal'}
        </button>

        {uploading && (
          <div style={styles.progressContainer}>
            <div style={styles.progressBar}>
              <div style={{...styles.progressFill, width: `${progress}%`}} />
            </div>
            <p style={styles.progressText}>{Math.round(progress)}%</p>
          </div>
        )}

        {shareLink && !showEmailModal && (
          <div style={styles.shareContainer}>
            <h3 style={styles.shareTitle}>✨ Proposal Ready to Share!</h3>
            <div style={styles.linkBox}>
              <input 
                type="text" 
                value={shareLink} 
                readOnly 
                style={styles.linkInput}
              />
              <button 
                onClick={copyToClipboard}
                style={styles.copyButton}
                title="Copy link"
              >
                <MdContentCopy size={18} />
                Copy
              </button>
            </div>
            
            <div style={styles.actionButtons}>
              <button
                onClick={() => setShowEmailModal(true)}
                style={styles.emailButton}
              >
                <MdEmail size={18} />
                Share with Client
              </button>
              <a 
                href={shareLink} 
                target="_blank" 
                rel="noopener noreferrer"
                style={styles.previewButton}
              >
                <MdOpenInNew size={18} />
                Preview
              </a>
            </div>
          </div>
        )}
      </div>

      {EmailModal}
    </div>
  );
}

// Styles
const styles = {
  container: {
    padding: '20px',
    maxWidth: '700px',
    margin: '0 auto'
  },
  uploadCard: {
    background: '#fff',
    padding: '30px',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
  },
  title: {
    margin: '0 0 10px 0',
    color: '#333',
    fontSize: '24px',
    fontWeight: '600'
  },
  userInfo: {
    margin: '0 0 20px 0',
    padding: '10px',
    backgroundColor: '#e3f2fd',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#1976D2'
  },
  warningMessage: {
    margin: '0 0 20px 0',
    padding: '10px',
    backgroundColor: '#fff3e0',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#f57c00'
  },
  dropZone: {
    border: '2px dashed',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    cursor: 'pointer',
    position: 'relative',
    marginBottom: '20px',
    transition: 'all 0.3s ease'
  },
  dropZoneText: {
    margin: '15px 0 5px 0',
    color: '#666',
    fontSize: '14px'
  },
  fileDetails: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#4CAF50'
  },
  fileInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer'
  },
  errorMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#f44336',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  successMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#e8f5e9',
    color: '#4CAF50',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  uploadButton: {
    width: '100%',
    padding: '14px',
    background: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'all 0.3s'
  },
  progressContainer: {
    marginTop: '20px'
  },
  progressBar: {
    height: '8px',
    background: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: '#4CAF50',
    transition: 'width 0.3s'
  },
  progressText: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#666',
    textAlign: 'center'
  },
  shareContainer: {
    marginTop: '25px',
    padding: '20px',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #f9fafb 100%)',
    borderRadius: '12px',
    border: '1px solid #e0e0e0'
  },
  shareTitle: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    color: '#333'
  },
  linkBox: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px'
  },
  linkInput: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#666',
    backgroundColor: '#fff'
  },
  copyButton: {
    padding: '10px 20px',
    background: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  actionButtons: {
    display: 'flex',
    gap: '10px'
  },
  emailButton: {
    flex: 1,
    padding: '10px',
    background: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  previewButton: {
    flex: 1,
    padding: '10px',
    background: '#fff',
    color: '#2196F3',
    border: '1px solid #2196F3',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  assessmentField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  assessmentFieldLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155'
  },
  assessmentInput: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '13px',
    background: '#fff',
    color: '#0f172a',
    boxSizing: 'border-box'
  },
  assessmentTextarea: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '13px',
    background: '#fff',
    color: '#0f172a',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '84px',
    fontFamily: 'inherit'
  },
  assessmentSaveButton: {
    border: 'none',
    borderRadius: '10px',
    padding: '10px 14px',
    background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer'
  },
  assessmentResetButton: {
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '10px 14px',
    background: '#fff',
    color: '#334155',
    fontWeight: 700,
    cursor: 'pointer'
  },
  searchSection: {
    marginBottom: '20px'
  },
  searchInput: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  searchingText: {
    fontSize: '12px',
    color: '#666',
    marginTop: '5px'
  },
  searchResults: {
    marginTop: '8px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    maxHeight: '200px',
    overflowY: 'auto'
  },
  searchResultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #f0f0f0',
    transition: 'background 0.2s'
  },
  resultEmail: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#333'
  },
  resultName: {
    fontSize: '11px',
    color: '#666'
  },
  divider: {
    textAlign: 'center',
    margin: '20px 0',
    position: 'relative',
    color: '#999',
    fontSize: '12px'
  },
  infoBox: {
    background: '#e3f2fd',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '12px',
    color: '#1976D2',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    lineHeight: '1.4'
  },
  assessmentPanel: {
    border: '1px solid #dbeafe',
    background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
    borderRadius: '14px',
    padding: '16px',
    marginBottom: '18px',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.05)'
  },
  assessmentHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '14px',
    flexWrap: 'wrap'
  },
  assessmentEyebrow: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#2563eb',
    fontWeight: 700,
    marginBottom: '4px'
  },
  assessmentTitle: {
    margin: 0,
    fontSize: '16px',
    color: '#0f172a'
  },
  readinessBadge: (score) => ({
    padding: '8px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    color: score >= 75 ? '#166534' : score >= 50 ? '#b45309' : '#b91c1c',
    background: score >= 75 ? '#dcfce7' : score >= 50 ? '#fef3c7' : '#fee2e2',
    border: '1px solid',
    borderColor: score >= 75 ? '#86efac' : score >= 50 ? '#fcd34d' : '#fca5a5'
  }),
  assessmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
    marginBottom: '12px'
  },
  assessmentCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px'
  },
  assessmentCardLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
    marginBottom: '6px',
    fontWeight: 700
  },
  assessmentCardValue: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '4px',
    wordBreak: 'break-word'
  },
  assessmentCardMeta: {
    fontSize: '12px',
    color: '#64748b',
    wordBreak: 'break-word'
  },
  assessmentColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginBottom: '12px'
  },
  assessmentColumn: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px'
  },
  assessmentColumnTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '8px'
  },
  assessmentAutoHint: {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '8px'
  },
  assessmentList: {
    margin: 0,
    paddingLeft: '18px',
    color: '#475569',
    fontSize: '13px',
    lineHeight: 1.5
  },
  assessmentEmpty: {
    fontSize: '13px',
    color: '#64748b'
  },
  assessmentRecommendation: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '12px',
    padding: '12px'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    animation: 'slideUp 0.3s ease'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0'
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#333'
  },
  modalIcon: {
    color: '#4CAF50',
    fontSize: '22px'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    borderRadius: '6px',
    transition: 'all 0.2s'
  },
  modalBody: {
    padding: '24px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#555'
  },
  required: {
    color: '#f44336'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  proposalPreview: {
    marginTop: '20px',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px'
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
    fontSize: '12px',
    color: '#666'
  },
  previewContent: {
    fontSize: '13px',
    color: '#333'
  },
  previewLink: {
    fontSize: '11px',
    color: '#2196F3',
    marginTop: '4px',
    wordBreak: 'break-all'
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid #e0e0e0',
    justifyContent: 'flex-end'
  },
  cancelButton: {
    padding: '10px 20px',
    background: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#666',
    transition: 'all 0.2s'
  },
  sendButton: {
    padding: '10px 24px',
    background: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '500'
  },
  modalError: {
    margin: '0 24px 16px 24px',
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#f44336',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px'
  },
  emailSuccess: {
    textAlign: 'center',
    padding: '40px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px'
  },
  successIcon: {
    color: '#4CAF50'
  },
  successTitle: {
    margin: 0,
    fontSize: '20px',
    color: '#333'
  },
  successMessage: {
    margin: 0,
    fontSize: '14px',
    color: '#666'
  },
  successNote: {
    margin: 0,
    fontSize: '12px',
    color: '#10B981'
  },
  doneButton: {
    marginTop: '8px',
    padding: '10px 32px',
    background: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #fff',
    borderTop: '2px solid transparent',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
    display: 'inline-block'
  }
};

// Add animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
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
  
  input:focus, textarea:focus {
    outline: none;
    border-color: #2196F3;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
  }
  
  button:hover {
    transform: translateY(-1px);
  }
  
  button:active {
    transform: translateY(0);
  }
  
  .search-result-item:hover {
    background: #f5f5f5;
  }
`;
document.head.appendChild(styleSheet);
