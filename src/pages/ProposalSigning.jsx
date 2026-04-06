import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, storage } from "../firebase";
import { doc, setDoc, updateDoc, serverTimestamp, getDoc, collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { 
  MdDraw, 
  MdTextFields, 
  MdCheckCircle, 
  MdClose,
  MdPerson,
  MdEmail,
  MdDescription,
  MdSchedule,
  MdArrowBack,
  MdDownload,
  MdPrint,
  MdShare
} from "react-icons/md";

export default function ProposalSigning() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState(null);
  const [error, setError] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  
  const [signatureType, setSignatureType] = useState("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [signatureData, setSignatureData] = useState(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [viewTracked, setViewTracked] = useState(false);
  
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState(null);

  // Load proposal data
  useEffect(() => {
    loadProposal();
  }, [proposalId]);

  const loadProposal = async () => {
    try {
      setLoading(true);
      
      let decodedPath;
      try {
        decodedPath = atob(proposalId);
      } catch {
        decodedPath = proposalId;
      }

      console.log("Decoded path:", decodedPath);

      const fileRef = ref(storage, decodedPath);
      const url = await getDownloadURL(fileRef);
      const fileName = decodedPath.split('/').pop();
      
      setProposal({
        id: proposalId,
        name: fileName,
        path: decodedPath,
        url: url,
        uploadedAt: new Date().toISOString()
      });
      
      setPdfUrl(url);
      setLoading(false);
      
    } catch (error) {
      console.error("Error loading proposal:", error);
      setError("Failed to load proposal. The link may be invalid or expired.");
      setLoading(false);
    }
  };

  // Track view only once when signer email is entered
  const trackView = async () => {
    if (!signerEmail || viewTracked || !proposal) return;
    
    try {
      const viewData = {
        fileName: proposal.name,
        filePath: proposal.path,
        viewerEmail: signerEmail,
        viewerName: signerName || signerEmail.split('@')[0],
        viewedAt: serverTimestamp(),
        userAgent: navigator.userAgent,
        page: "signing",
        proposalId: proposal.id,
        status: "viewed"
      };
      
      await addDoc(collection(db, "proposalViews"), viewData);
      setViewTracked(true);
      console.log("✅ View tracked for:", signerEmail);
      
    } catch (error) {
      console.error("Error tracking view:", error);
    }
  };

  // Initialize canvas
  useEffect(() => {
    if (signatureType === "draw" && canvasRef.current && !signed) {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      context.strokeStyle = "#1a1a2e";
      context.lineWidth = 2.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      setCtx(context);
      
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [signatureType, signed]);

  // Track view when email is entered (after debounce)
  useEffect(() => {
    if (signerEmail && signerEmail.includes('@') && proposal && !viewTracked) {
      const timer = setTimeout(() => {
        trackView();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [signerEmail, proposal, viewTracked]);

  // Drawing handlers
  const startDrawing = (e) => {
    if (!ctx || signed) return;
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing || !ctx || signed) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    ctx?.closePath();
  };

  const clearCanvas = () => {
    if (!ctx || !canvasRef.current || signed) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setSignatureData(null);
  };

  const saveDrawing = () => {
    if (!canvasRef.current || signed) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    setSignatureData(dataUrl);
  };

  const handleSign = async () => {
    // Validation
    if (!signerName.trim()) {
      alert("Please enter your full name");
      return;
    }

    if (!signerEmail.trim()) {
      alert("Please enter your email address");
      return;
    }

    if (!signerEmail.includes('@')) {
      alert("Please enter a valid email address");
      return;
    }

    if (signatureType === "draw" && !signatureData) {
      alert("Please draw your signature or switch to type mode");
      return;
    }

    if (signatureType === "type" && !typedSignature.trim()) {
      alert("Please type your signature");
      return;
    }

    if (!agreeToTerms) {
      alert("Please agree to the terms and conditions");
      return;
    }

    setIsSaving(true);

    try {
      const signature = signatureType === "draw" 
        ? signatureData 
        : typedSignature;

      const signingId = `sign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log("=== STARTING SIGNING PROCESS ===");
      console.log("Signer Email:", signerEmail);
      console.log("Proposal Path:", proposal.path);
      console.log("Proposal Name:", proposal.name);

      // Save to signedProposals collection
      const signingData = {
        id: signingId,
        proposalId: proposal.id,
        proposalName: proposal.name,
        proposalPath: proposal.path,
        signedBy: signerName,
        signerEmail: signerEmail,
        signerTitle: signerTitle || "Client",
        signature: signature,
        signatureType: signatureType,
        signedAt: serverTimestamp(),
        signedAtISO: new Date().toISOString(),
        ipAddress: "collected",
        userAgent: navigator.userAgent,
        status: "completed",
        filePath: proposal.path,
        fileName: proposal.name,
        clientEmail: signerEmail,
        clientName: signerName,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, "signedProposals", signingId), signingData);
      console.log("✓ Saved to signedProposals");

      // Save to clientSignedProposals
      const clientSignedId = `client_${signerEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${signingId}`;
      await setDoc(doc(db, "clientSignedProposals", clientSignedId), signingData);
      console.log("✓ Saved to clientSignedProposals");

      // Update sharedProposals
      let sharedQuery = query(
        collection(db, "sharedProposals"),
        where("clientEmail", "==", signerEmail),
        where("filePath", "==", proposal.path)
      );
      let sharedSnapshot = await getDocs(sharedQuery);
      
      if (sharedSnapshot.empty) {
        sharedQuery = query(
          collection(db, "sharedProposals"),
          where("clientEmail", "==", signerEmail),
          where("fileName", "==", proposal.name)
        );
        sharedSnapshot = await getDocs(sharedQuery);
      }
      
      let updatedCount = 0;
      
      for (const sharedDoc of sharedSnapshot.docs) {
        await updateDoc(sharedDoc.ref, {
          status: "signed",
          signedAt: serverTimestamp(),
          signedBy: signerName,
          signedById: signingId,
          signerEmail: signerEmail,
          lastActivity: serverTimestamp()
        });
        updatedCount++;
      }
      
      if (updatedCount === 0) {
        const newSharedId = `shared_${Date.now()}`;
        await setDoc(doc(db, "sharedProposals", newSharedId), {
          filePath: proposal.path,
          fileName: proposal.name,
          clientEmail: signerEmail,
          clientName: signerName,
          sharedBy: signerName,
          sharedByEmail: signerEmail,
          sharedAt: serverTimestamp(),
          status: "signed",
          signedAt: serverTimestamp(),
          signedBy: signerName,
          signedById: signingId,
          viewCount: 0
        });
      }

      console.log("=== SIGNING COMPLETED ===");
      
      setSigned(true);
      
      alert(`✓ Successfully signed ${proposal.name}!`);
      
      setTimeout(() => {
        navigate(`/thank-you?name=${encodeURIComponent(signerName)}&proposal=${encodeURIComponent(proposal.name)}&id=${signingId}`);
      }, 2000);
      
    } catch (error) {
      console.error("Error in signing process:", error);
      alert("Error signing proposal: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div className="spinner"></div>
        <p>Loading proposal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <MdDescription size={64} color="#ef4444" />
        <h2>Proposal Not Found</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')} style={styles.backButton}>
          <MdArrowBack size={18} />
          Go to Homepage
        </button>
      </div>
    );
  }

  if (signed) {
    return (
      <div style={styles.successContainer}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>
            <MdCheckCircle size={80} color="#10B981" />
          </div>
          <h2 style={styles.successTitle}>Thank You, {signerName}!</h2>
          <p style={styles.successMessage}>
            You have successfully signed <strong>{proposal?.name}</strong>
          </p>
          
          <div style={styles.successActions}>
            <button onClick={() => window.print()} style={styles.successButton}>
              <MdPrint size={18} />
              Download Copy
            </button>
            <button onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Link copied!");
            }} style={styles.successButton}>
              <MdShare size={18} />
              Share
            </button>
          </div>
          
          <p style={styles.successRedirect}>
            Redirecting to confirmation page in 2 seconds...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>
          <MdArrowBack size={20} />
          Back
        </button>
        
        <div style={styles.titleGroup}>
          <div style={styles.logo}>
            <MdDraw size={24} color="#fff" />
          </div>
          <div>
            <h1 style={styles.title}>Sign Proposal</h1>
            <p style={styles.subtitle}>Review and sign electronically</p>
          </div>
        </div>
        
        <div style={styles.proposalBadge}>
          <MdDescription size={16} />
          <span>{proposal?.name || "Proposal"}</span>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={styles.stepsContainer}>
        <div style={styles.step(currentStep >= 1)}>
          <span style={styles.stepNumber(1, currentStep >= 1)}>1</span>
          <span style={styles.stepLabel}>Review</span>
        </div>
        <div style={styles.stepLine(currentStep >= 2)} />
        <div style={styles.step(currentStep >= 2)}>
          <span style={styles.stepNumber(2, currentStep >= 2)}>2</span>
          <span style={styles.stepLabel}>Sign</span>
        </div>
        <div style={styles.stepLine(currentStep >= 3)} />
        <div style={styles.step(currentStep >= 3)}>
          <span style={styles.stepNumber(3, currentStep >= 3)}>3</span>
          <span style={styles.stepLabel}>Confirm</span>
        </div>
      </div>

      <div style={styles.mainContent}>
        {/* Left Column - PDF Preview */}
        <div style={styles.previewContainer}>
          <div style={styles.previewHeader}>
            <MdDescription size={20} color="#00D4FF" />
            <span>Document Preview</span>
            <button 
              onClick={() => window.open(pdfUrl, '_blank')}
              style={styles.previewButton}
            >
              <MdDownload size={16} />
              Download
            </button>
          </div>
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
            style={styles.previewFrame}
            title="Proposal Preview"
          />
        </div>

        {/* Right Column - Signing Form */}
        <div style={styles.formContainer}>
          {/* Step 1: Review */}
          {currentStep === 1 && (
            <div style={styles.stepContent}>
              <h3 style={styles.stepTitle}>Step 1: Review Document</h3>
              <p style={styles.stepDescription}>
                Please review the proposal carefully before signing.
              </p>
              
              <div style={styles.reviewCard}>
                <MdCheckCircle size={24} color="#10B981" />
                <div>
                  <h4>Proposal Details</h4>
                  <p>Document: {proposal?.name}</p>
                  <p>Uploaded: {new Date(proposal?.uploadedAt).toLocaleDateString()}</p>
                </div>
              </div>
              
              <button 
                onClick={() => setCurrentStep(2)}
                style={styles.nextButton}
              >
                Continue to Sign
              </button>
            </div>
          )}

          {/* Step 2: Sign */}
          {currentStep === 2 && (
            <div style={styles.stepContent}>
              <h3 style={styles.stepTitle}>Step 2: Sign Document</h3>
              
              {/* Signer Information */}
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Your Information</h4>
                <div style={styles.inputGroup}>
                  <div style={styles.inputWrapper}>
                    <MdPerson size={18} color="#666" />
                    <input
                      type="text"
                      placeholder="Full Name *"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.inputWrapper}>
                    <MdEmail size={18} color="#666" />
                    <input
                      type="email"
                      placeholder="Email Address *"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.inputWrapper}>
                    <MdPerson size={18} color="#666" />
                    <input
                      type="text"
                      placeholder="Title/Position (Optional)"
                      value={signerTitle}
                      onChange={(e) => setSignerTitle(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>

              {/* Signature Type Selector */}
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Signature Method</h4>
                <div style={styles.tabContainer}>
                  <button
                    onClick={() => setSignatureType("draw")}
                    style={styles.tab(signatureType === "draw")}
                  >
                    <MdDraw size={18} />
                    Draw Signature
                  </button>
                  <button
                    onClick={() => setSignatureType("type")}
                    style={styles.tab(signatureType === "type")}
                  >
                    <MdTextFields size={18} />
                    Type Signature
                  </button>
                </div>
              </div>

              {/* Signature Input */}
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Your Signature</h4>
                
                {signatureType === "draw" ? (
                  <div style={styles.canvasContainer}>
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={150}
                      style={styles.canvas}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                    />
                    <div style={styles.canvasControls}>
                      <button onClick={clearCanvas} style={styles.clearBtn}>
                        Clear
                      </button>
                      <button onClick={saveDrawing} style={styles.saveBtn}>
                        <MdCheckCircle size={16} />
                        Save Signature
                      </button>
                    </div>
                    {signatureData && (
                      <div style={styles.savedSignature}>
                        <img src={signatureData} alt="Signature" style={styles.signatureImage} />
                        <span style={styles.savedText}>✓ Signature saved</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={styles.typeContainer}>
                    <input
                      type="text"
                      placeholder="Type your full name"
                      value={typedSignature}
                      onChange={(e) => setTypedSignature(e.target.value)}
                      style={styles.typeInput}
                    />
                    {typedSignature && (
                      <div style={styles.typePreview}>
                        <span style={styles.typeSignature}>{typedSignature}</span>
                        <span style={styles.previewText}>✓ Will be used as signature</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Legal Disclaimer */}
              <div style={styles.disclaimer}>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                  />
                  <span>I agree to the terms and conditions and confirm that this is my legal signature</span>
                </label>
              </div>

              <div style={styles.buttonGroup}>
                <button 
                  onClick={() => setCurrentStep(1)}
                  style={styles.backButtonStyle}
                >
                  Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  disabled={!signerName || !signerEmail || !agreeToTerms || (signatureType === "draw" ? !signatureData : !typedSignature)}
                  style={styles.continueButton(!signerName || !signerEmail || !agreeToTerms || (signatureType === "draw" ? !signatureData : !typedSignature))}
                >
                  Review & Confirm
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {currentStep === 3 && (
            <div style={styles.stepContent}>
              <h3 style={styles.stepTitle}>Step 3: Confirm & Sign</h3>
              
              <div style={styles.confirmCard}>
                <h4>Review Your Information</h4>
                <p><strong>Name:</strong> {signerName}</p>
                <p><strong>Email:</strong> {signerEmail}</p>
                <p><strong>Title:</strong> {signerTitle || "Not specified"}</p>
                <p><strong>Document:</strong> {proposal?.name}</p>
                <p><strong>Signature Method:</strong> {signatureType === "draw" ? "Drawn Signature" : "Typed Signature"}</p>
                
                <div style={styles.signaturePreview}>
                  <strong>Signature:</strong>
                  {signatureType === "draw" ? (
                    <img src={signatureData} alt="Signature" style={styles.confirmSignature} />
                  ) : (
                    <span style={styles.confirmType}>{typedSignature}</span>
                  )}
                </div>
              </div>

              {/* Legal Text */}
              <div style={styles.legalText}>
                <p>
                  By clicking "Sign & Approve", you agree that this electronic signature 
                  is the legal equivalent of your manual signature and you consent to be 
                  legally bound by this agreement. You also acknowledge that you have 
                  read and understood the terms of the proposal.
                </p>
              </div>

              <div style={styles.buttonGroup}>
                <button 
                  onClick={() => setCurrentStep(2)}
                  style={styles.backButtonStyle}
                >
                  Back
                </button>
                <button
                  onClick={handleSign}
                  disabled={isSaving}
                  style={styles.signButton(isSaving)}
                >
                  {isSaving ? (
                    <>
                      <div className="spinner-small" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <MdCheckCircle size={20} />
                      Sign & Approve
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(0, 212, 255, 0.1);
          border-top: 3px solid #00D4FF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .spinner-small {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "'Inter', sans-serif",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    gap: "20px",
    background: "#f8fafc",
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    gap: "16px",
    background: "#f8fafc",
    textAlign: "center",
    padding: "0 20px",
  },
  backButton: {
    padding: "10px 24px",
    background: "#2196F3",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "20px",
  },
  successContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "20px",
  },
  successCard: {
    background: "#fff",
    borderRadius: "24px",
    padding: "50px",
    maxWidth: "500px",
    textAlign: "center",
    boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
  },
  successIcon: {
    marginBottom: "30px",
  },
  successTitle: {
    color: "#1a1a2e",
    fontSize: "32px",
    fontWeight: "700",
    margin: "0 0 15px 0",
  },
  successMessage: {
    color: "#64748b",
    fontSize: "16px",
    lineHeight: "1.6",
    margin: "0 0 30px 0",
  },
  successActions: {
    display: "flex",
    gap: "15px",
    justifyContent: "center",
    marginBottom: "30px",
  },
  successButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    color: "#1a1a2e",
    fontSize: "14px",
    cursor: "pointer",
  },
  successRedirect: {
    color: "#94a3b8",
    fontSize: "14px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 40px",
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    color: "#64748b",
    fontSize: "14px",
    cursor: "pointer",
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
  },
  logo: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#1a1a2e",
    fontSize: "24px",
    fontWeight: "700",
    margin: 0,
  },
  subtitle: {
    color: "#64748b",
    fontSize: "14px",
    margin: "4px 0 0 0",
  },
  proposalBadge: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 20px",
    background: "#f1f5f9",
    borderRadius: "100px",
    color: "#1a1a2e",
    fontSize: "14px",
    fontWeight: "500",
    maxWidth: "300px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  stepsContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    padding: "30px 40px",
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
  },
  step: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    opacity: active ? 1 : 0.5,
  }),
  stepNumber: (number, active) => ({
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: active ? "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)" : "#e2e8f0",
    color: active ? "#fff" : "#94a3b8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "600",
  }),
  stepLabel: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#1a1a2e",
  },
  stepLine: (active) => ({
    width: "60px",
    height: "2px",
    background: active ? "#00D4FF" : "#e2e8f0",
  }),
  mainContent: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "30px",
    padding: "30px 40px",
    maxWidth: "1600px",
    margin: "0 auto",
  },
  previewContainer: {
    background: "#fff",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    height: "fit-content",
    border: "1px solid #e2e8f0",
  },
  previewHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 20px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    color: "#1a1a2e",
    fontWeight: "500",
  },
  previewButton: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    color: "#64748b",
    fontSize: "12px",
    cursor: "pointer",
  },
  previewFrame: {
    width: "100%",
    height: "700px",
    border: "none",
  },
  formContainer: {
    background: "#fff",
    borderRadius: "16px",
    padding: "30px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    border: "1px solid #e2e8f0",
  },
  stepContent: {
    animation: "fadeIn 0.3s ease",
  },
  stepTitle: {
    color: "#1a1a2e",
    fontSize: "20px",
    fontWeight: "600",
    margin: "0 0 10px 0",
  },
  stepDescription: {
    color: "#64748b",
    fontSize: "14px",
    margin: "0 0 25px 0",
  },
  reviewCard: {
    display: "flex",
    gap: "20px",
    padding: "20px",
    background: "#f8fafc",
    borderRadius: "12px",
    marginBottom: "30px",
    border: "1px solid #e2e8f0",
  },
  nextButton: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(0, 212, 255, 0.3)",
  },
  section: {
    marginBottom: "25px",
  },
  sectionTitle: {
    color: "#1a1a2e",
    fontSize: "16px",
    fontWeight: "600",
    margin: "0 0 15px 0",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    transition: "all 0.2s",
  },
  input: {
    flex: 1,
    border: "none",
    background: "transparent",
    fontSize: "14px",
    outline: "none",
    color: "#1a1a2e",
  },
  tabContainer: {
    display: "flex",
    gap: "12px",
  },
  tab: (active) => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px",
    borderRadius: "10px",
    border: active ? "2px solid #00D4FF" : "1px solid #e2e8f0",
    background: active ? "rgba(0, 212, 255, 0.1)" : "#fff",
    color: active ? "#00D4FF" : "#64748b",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  }),
  canvasContainer: {
    background: "#f8fafc",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #e2e8f0",
  },
  canvas: {
    width: "100%",
    height: "150px",
    background: "#fff",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    cursor: "crosshair",
  },
  canvasControls: {
    display: "flex",
    gap: "10px",
    marginTop: "12px",
  },
  clearBtn: {
    padding: "8px 16px",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    color: "#64748b",
    fontSize: "13px",
    cursor: "pointer",
  },
  saveBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    background: "#10B981",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "13px",
    cursor: "pointer",
  },
  savedSignature: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "12px",
    padding: "10px",
    background: "#f0fdf4",
    borderRadius: "8px",
    border: "1px solid #86efac",
  },
  signatureImage: {
    maxHeight: "40px",
    background: "#fff",
    padding: "4px",
    borderRadius: "4px",
  },
  savedText: {
    fontSize: "13px",
    color: "#10B981",
  },
  typeContainer: {
    background: "#f8fafc",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #e2e8f0",
  },
  typeInput: {
    width: "100%",
    padding: "12px",
    fontSize: "18px",
    fontFamily: "'Dancing Script', cursive",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    outline: "none",
    marginBottom: "12px",
  },
  typePreview: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    background: "#fff",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
  },
  typeSignature: {
    fontSize: "24px",
    fontFamily: "'Dancing Script', cursive",
    color: "#1a1a2e",
  },
  previewText: {
    fontSize: "12px",
    color: "#10B981",
  },
  disclaimer: {
    marginBottom: "25px",
    padding: "16px",
    background: "#fff7ed",
    borderRadius: "10px",
    border: "1px solid #fed7aa",
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "14px",
    color: "#9a3412",
    cursor: "pointer",
  },
  buttonGroup: {
    display: "flex",
    gap: "12px",
    marginTop: "20px",
  },
  backButtonStyle: {
    flex: 1,
    padding: "14px",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  continueButton: (disabled) => ({
    flex: 2,
    padding: "14px",
    background: disabled ? "#cbd5e1" : "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 4px 15px rgba(0, 212, 255, 0.3)",
  }),
  confirmCard: {
    padding: "20px",
    background: "#f8fafc",
    borderRadius: "12px",
    marginBottom: "20px",
    border: "1px solid #e2e8f0",
  },
  signaturePreview: {
    marginTop: "15px",
    padding: "15px",
    background: "#fff",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
  },
  confirmSignature: {
    maxHeight: "50px",
    marginTop: "10px",
    display: "block",
  },
  confirmType: {
    display: "block",
    marginTop: "10px",
    fontSize: "20px",
    fontFamily: "'Dancing Script', cursive",
    color: "#1a1a2e",
  },
  legalText: {
    padding: "16px",
    background: "#f0f9ff",
    borderRadius: "10px",
    border: "1px solid #bae6fd",
    fontSize: "13px",
    color: "#0369a1",
    lineHeight: "1.6",
    marginBottom: "20px",
  },
  signButton: (disabled) => ({
    flex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "14px",
    background: disabled ? "#cbd5e1" : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 4px 15px rgba(16, 185, 129, 0.3)",
  }),
};