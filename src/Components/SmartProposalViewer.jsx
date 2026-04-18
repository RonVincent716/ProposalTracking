import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db, storage } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, getDownloadURL } from "firebase/storage";
import { 
  doc, getDoc, setDoc, updateDoc, serverTimestamp, 
  collection, query, where, getDocs, addDoc, orderBy, limit 
} from "firebase/firestore";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { 
  MdEdit, MdFileUpload, MdLogout, MdDescription, MdArrowBack, 
  MdCheckCircle, MdPerson, MdEmail, MdSchedule, MdVisibility, 
  MdDownload, MdHome, MdDashboard 
} from "react-icons/md";
import HighlightButton from "./HighlightButton";
import DiscussionPanel from "./DiscussionPanel";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function SmartProposalViewer() {
  const { encodedPath } = useParams();
  const navigate = useNavigate();

  const [fileUrl, setFileUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isSigned, setIsSigned] = useState(false);
  const [showSignPrompt, setShowSignPrompt] = useState(false);
  const [proposalData, setProposalData] = useState(null);
  const [viewTracked, setViewTracked] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [highlightModeActive, setHighlightModeActive] = useState(false);
  const [discussionPanelOpen, setDiscussionPanelOpen] = useState(false);

  const sessionId = useRef(null);
  const startTime = useRef(Date.now());
  const pagesViewed = useRef(new Set([1]));
  const heartbeatInterval = useRef(null);
  const isTabActive = useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        } else {
          setUserRole("client");
        }
      }
      
      await loadProposal(currentUser);
    });

    return () => unsubscribe();
  }, [encodedPath]);

  // Tab visibility tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabActive.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Heartbeat update for session duration
  useEffect(() => {
    if (!sessionId.current) return;

    heartbeatInterval.current = setInterval(async () => {
      if (!isTabActive.current) return;
      const duration = Date.now() - startTime.current;
      await updateDoc(doc(db, "proposalSessions", sessionId.current), {
        pagesViewed: Array.from(pagesViewed.current),
        duration,
        lastHeartbeat: serverTimestamp(),
      });
    }, 30000);

    return () => clearInterval(heartbeatInterval.current);
  }, [sessionId.current]);

  // Final session save on page unload
  useEffect(() => {
    const saveSession = async () => {
      if (!sessionId.current) return;
      const duration = Date.now() - startTime.current;
      await updateDoc(doc(db, "proposalSessions", sessionId.current), {
        pagesViewed: Array.from(pagesViewed.current),
        duration,
        endedAt: serverTimestamp(),
      });
    };

    window.addEventListener("beforeunload", saveSession);
    return () => {
      saveSession();
      window.removeEventListener("beforeunload", saveSession);
    };
  }, []);

  const decodePath = (encodedPath) => {
    try {
      let decoded = atob(encodedPath);
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      if (base64Regex.test(decoded) && decoded.includes('proposals/')) {
        return decoded;
      }
      if (base64Regex.test(decoded)) {
        try {
          const secondDecode = atob(decoded);
          if (secondDecode.includes('proposals/')) {
            return secondDecode;
          }
        } catch (e) {}
      }
      return decoded;
    } catch (e) {
      return encodedPath;
    }
  };

  const onPageChange = ({ pageNumber }) => {
    setPageNumber(pageNumber);
    pagesViewed.current.add(pageNumber);
  };

  const loadProposal = async (currentUser) => {
    try {
      const decodedPath = decodePath(encodedPath);
      console.log("Loading proposal from path:", decodedPath);
      
      const fileRef = ref(storage, decodedPath);
      const url = await getDownloadURL(fileRef);
      setFileUrl(url);

      const extractedFileName = decodedPath.split('/').pop();
      setFileName(extractedFileName);

      setProposalData({
        filePath: decodedPath,
        fileName: extractedFileName,
        url: url
      });

      // Get view count
      const viewsCountQuery = query(
        collection(db, "proposalViews"),
        where("filePath", "==", decodedPath)
      );
      const viewsCountSnapshot = await getDocs(viewsCountQuery);
      setViewCount(viewsCountSnapshot.size);

      // Track view if user is logged in
      if (currentUser && !viewTracked) {
        await trackView(currentUser, extractedFileName, decodedPath);
        setViewTracked(true);
        
        // Check if already signed
        const signedQuery = query(
          collection(db, "signedProposals"),
          where("proposalPath", "==", decodedPath),
          where("signerEmail", "==", currentUser.email)
        );
        const signedSnapshot = await getDocs(signedQuery);
        setIsSigned(!signedSnapshot.empty);
        
        // If client, show sign prompt
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const role = userDoc.exists() ? userDoc.data().role : "client";
        if (role === "client" && !isSigned) {
          setShowSignPrompt(true);
        }

        // Create engagement session
        await createEngagementSession(currentUser, extractedFileName, decodedPath);
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error loading proposal:", err);
      setError("Failed to load proposal. The link may be invalid or expired.");
      setLoading(false);
    }
  };

  const createEngagementSession = async (currentUser, fileName, filePath) => {
    try {
      const session = await addDoc(collection(db, "proposalSessions"), {
        fileName: fileName,
        filePath: filePath,
        viewerId: currentUser.uid,
        viewerEmail: currentUser.email,
        pagesViewed: [1],
        duration: 0,
        startedAt: serverTimestamp(),
      });
      sessionId.current = session.id;
    } catch (error) {
      console.error("Error creating session:", error);
    }
  };

  const trackView = async (currentUser, fileName, filePath) => {
    try {
      const viewId = `${currentUser.uid}_${Date.now()}`;
      
      await setDoc(doc(db, "proposalViews", viewId), {
        fileName: fileName,
        filePath: filePath,
        viewerId: currentUser.uid,
        viewerEmail: currentUser.email,
        viewerName: currentUser.displayName || currentUser.email.split('@')[0],
        viewedAt: serverTimestamp(),
        userAgent: navigator.userAgent,
        referrer: document.referrer || "direct",
        page: "proposal_viewer",
        proposalId: encodedPath
      });
      
      console.log("View tracked for:", fileName);
      
      const sharedQuery = query(
        collection(db, "sharedProposals"),
        where("filePath", "==", filePath),
        where("clientEmail", "==", currentUser.email)
      );
      const sharedSnapshot = await getDocs(sharedQuery);
      
      if (!sharedSnapshot.empty) {
        const sharedDoc = sharedSnapshot.docs[0];
        await updateDoc(doc(db, "sharedProposals", sharedDoc.id), {
          viewedAt: serverTimestamp(),
          status: "viewed",
          lastActivity: serverTimestamp(),
          viewCount: (sharedDoc.data().viewCount || 0) + 1,
          lastViewedAt: serverTimestamp()
        });
      } else {
        await setDoc(doc(db, "sharedProposals", `${currentUser.uid}_${Date.now()}`), {
          fileName: fileName,
          filePath: filePath,
          clientEmail: currentUser.email,
          clientName: currentUser.displayName || currentUser.email.split('@')[0],
          clientId: currentUser.uid,
          viewedAt: serverTimestamp(),
          status: "viewed",
          source: "direct_link",
          viewCount: 1,
          sharedAt: serverTimestamp(),
          lastViewedAt: serverTimestamp()
        });
      }
      
      setViewTracked(true);
      
    } catch (error) {
      console.error("Error tracking view:", error);
    }
  };

  const handleSignProposal = () => {
    navigate(`/sign/${encodedPath}`);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.click();
  };

  const handleLogin = () => {
    setIsRedirecting(true);
    const returnUrl = encodeURIComponent(`/p/${encodedPath}`);
    navigate(`/client-login?returnTo=${returnUrl}`);
  };

  const handleGoToDashboard = () => {
    navigate("/client-dashboard");
  };

  const handleGoHome = () => {
    navigate("/");
  };

  if (loading || isRedirecting) {
    return (
      <div style={loadingContainerStyle}>
        <div className="spinner"></div>
        <p>{isRedirecting ? "Redirecting..." : "Loading proposal..."}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={errorContainerStyle}>
        <MdDescription size={64} color="#ef4444" />
        <h2>Proposal Not Found</h2>
        <p>{error}</p>
        <div style={errorActionsStyle}>
          <button onClick={handleGoHome} style={errorButtonStyle}>
            <MdHome size={18} />
            Go Home
          </button>
          <button onClick={() => window.location.reload()} style={errorButtonStyle}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <button onClick={() => navigate(-1)} style={backNavButtonStyle}>
            <MdArrowBack size={18} />
            Back
          </button>
          <div style={titleContainerStyle}>
            <MdDescription size={24} color="#1976D2" />
            <div>
              <h2 style={titleStyle}>{fileName}</h2>
              <p style={proposalMetaStyle}>
                {user ? (
                  <>Viewing as: <strong>{user.email}</strong> • {viewCount} {viewCount === 1 ? 'view' : 'views'}</>
                ) : (
                  "Sign in to sign this proposal"
                )}
              </p>
            </div>
          </div>
        </div>
        
        <div style={headerRightStyle}>
          {!user ? (
            <button onClick={handleLogin} style={loginButtonStyle}>
              <MdPerson size={16} />
              Sign in to Sign
            </button>
          ) : userRole === "client" && !isSigned && (
            <button onClick={handleSignProposal} style={signButtonStyle}>
              <MdEdit size={18} />
              Sign This Proposal
            </button>
          )}
          
          <button onClick={handleDownload} style={downloadButtonStyle}>
            <MdDownload size={16} />
            Download
          </button>
          
          {/* Highlight & Discussion Button */}
          {user && (
            <HighlightButton
              isActive={highlightModeActive}
              onToggle={() => {
                setHighlightModeActive(!highlightModeActive);
                setDiscussionPanelOpen(true);
              }}
              unresolvedCount={0}
            />
          )}
          
          {/* MY DASHBOARD BUTTON - Header version */}
          {user && userRole === "client" && (
            <button onClick={handleGoToDashboard} style={dashboardButtonStyle}>
              <MdDashboard size={16} />
              My Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Sign Prompt Banner */}
      {showSignPrompt && !isSigned && (
        <div style={signPromptStyle}>
          <div style={signPromptContentStyle}>
            <div style={signPromptIconStyle}>
              <MdEdit size={24} color="#10B981" />
            </div>
            <div style={signPromptTextStyle}>
              <strong>Ready to sign?</strong> This proposal is waiting for your signature.
            </div>
            <button onClick={handleSignProposal} style={signPromptButtonStyle}>
              Sign Now
            </button>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      <div style={viewerContainerStyle}>
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<div style={pdfLoadingStyle}>Loading PDF...</div>}
          error={<div style={pdfErrorStyle}>Failed to load PDF.</div>}
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            onRenderSuccess={() => onPageChange({ pageNumber })}
            data-testid="pdf-page"
          />
        </Document>
      </div>

      {/* Pagination Controls */}
      <div style={paginationContainerStyle}>
        <button
          onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
          disabled={pageNumber <= 1}
          style={paginationButtonStyle(pageNumber <= 1)}
        >
          Previous
        </button>

        <span style={pageInfoStyle}>
          Page <input
            type="number"
            min={1}
            max={numPages || 1}
            value={pageNumber}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (val >= 1 && val <= (numPages || 1)) {
                setPageNumber(val);
                onPageChange({ pageNumber: val });
              }
            }}
            style={pageInputStyle}
          /> of {numPages || '?'}
        </span>

        <button
          onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages || 1))}
          disabled={pageNumber >= (numPages || 1)}
          style={paginationButtonStyle(pageNumber >= (numPages || 1))}
        >
          Next
        </button>
      </div>

      {/* Floating Buttons for Mobile - Using CSS classes (NO INLINE MEDIA QUERIES) */}
      {!user && (
        <div className="floating-login-button">
          <button onClick={handleLogin}>
            <MdEdit size={18} />
            Sign in to Sign
          </button>
        </div>
      )}

      {user && userRole === "client" && !isSigned && (
        <div className="floating-sign-button">
          <button onClick={handleSignProposal}>
            <MdEdit size={20} />
            Sign
          </button>
        </div>
      )}

      {user && userRole === "client" && (
        <div className="floating-dashboard-button">
          <button onClick={handleGoToDashboard}>
            <MdDashboard size={20} />
            <span>Dashboard</span>
          </button>
        </div>
      )}

      {/* Discussion Panel */}
      {user && (
        <DiscussionPanel
          isOpen={discussionPanelOpen}
          onClose={() => setDiscussionPanelOpen(false)}
          proposalId={proposalData?.filePath || encodedPath}
          proposalName={fileName}
          filePath={proposalData?.filePath}
          currentPage={pageNumber}
          userId={user.uid}
          userEmail={user.email}
          userRole={userRole}
          highlightModeActive={highlightModeActive}
          onHighlightModeChange={setHighlightModeActive}
        />
      )}

      <style>{`
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #00D4FF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        /* Floating button container styles */
        .floating-login-button,
        .floating-sign-button,
        .floating-dashboard-button {
          position: fixed;
          z-index: 1000;
        }
        
        .floating-login-button {
          bottom: 30px;
          right: 30px;
        }
        
        .floating-sign-button {
          bottom: 30px;
          right: 30px;
        }
        
        .floating-dashboard-button {
          bottom: 30px;
          left: 30px;
        }
        
        /* Button styles */
        .floating-login-button button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: #2196F3;
          border: none;
          border-radius: 30px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
          transition: all 0.2s;
        }
        
        .floating-sign-button button {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border: none;
          border-radius: 28px;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
          transition: all 0.2s;
        }
        
        .floating-dashboard-button button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: #2196F3;
          border: none;
          border-radius: 30px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
          transition: all 0.2s;
        }
        
        /* Hover effects */
        .floating-login-button button:hover,
        .floating-dashboard-button button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(33, 150, 243, 0.5);
        }
        
        .floating-sign-button button:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
        }
        
        /* Desktop: hide floating buttons */
        @media (min-width: 768px) {
          .floating-login-button,
          .floating-sign-button,
          .floating-dashboard-button {
            display: none;
          }
        }
        
        /* Mobile: show floating buttons */
        @media (max-width: 767px) {
          .floating-login-button,
          .floating-sign-button,
          .floating-dashboard-button {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}

// Styles
const containerStyle = {
  padding: "20px",
  maxWidth: "1200px",
  margin: "0 auto",
  fontFamily: "'Inter', sans-serif",
  minHeight: "100vh",
  background: "#f8fafc",
  paddingBottom: "80px",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
  padding: "16px 20px",
  background: "#fff",
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  border: "1px solid #eee",
  flexWrap: "wrap",
  gap: "15px",
};

const headerLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: "15px",
  flexWrap: "wrap",
};

const backNavButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 16px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  color: "#64748b",
  fontSize: "14px",
  cursor: "pointer",
  transition: "all 0.2s",
};

const titleContainerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const titleStyle = {
  margin: 0,
  fontSize: "18px",
  fontWeight: "600",
  color: "#1a1a2e",
};

const proposalMetaStyle = {
  margin: "4px 0 0 0",
  fontSize: "12px",
  color: "#64748b",
};

const headerRightStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const loginButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "#2196F3",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 0.2s",
};

const signButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
  transition: "all 0.2s",
};

const downloadButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "#4CAF50",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 0.2s",
};

const dashboardButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  color: "#64748b",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 0.2s",
};

const signPromptStyle = {
  background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
  border: "1px solid #86efac",
  borderRadius: "12px",
  padding: "16px 20px",
  marginBottom: "20px",
  animation: "slideDown 0.3s ease",
};

const signPromptContentStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  justifyContent: "space-between",
};

const signPromptIconStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const signPromptTextStyle = {
  flex: 1,
  fontSize: "14px",
  color: "#166534",
};

const signPromptButtonStyle = {
  padding: "8px 20px",
  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s",
};

const viewerContainerStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  overflow: "auto",
  height: "calc(100vh - 280px)",
  minHeight: "500px",
  background: "#fff",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  padding: "20px",
};

const pdfLoadingStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#666",
  fontSize: "14px",
};

const pdfErrorStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#c33",
  fontSize: "14px",
};

const paginationContainerStyle = {
  marginTop: "20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  padding: "16px",
  background: "#fff",
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  border: "1px solid #eee",
  flexWrap: "wrap",
};

const paginationButtonStyle = (disabled) => ({
  padding: "8px 20px",
  background: disabled ? "#e2e8f0" : "#2196F3",
  color: disabled ? "#94a3b8" : "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "all 0.2s",
});

const pageInfoStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  color: "#1a1a2e",
};

const pageInputStyle = {
  width: "60px",
  padding: "8px",
  textAlign: "center",
  border: "1px solid #e2e8f0",
  borderRadius: "6px",
  fontSize: "14px",
  outline: "none",
};

const loadingContainerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  gap: "20px",
  background: "#fff",
};

const errorContainerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  gap: "20px",
  background: "#fff",
  textAlign: "center",
  padding: "0 20px",
};

const errorActionsStyle = {
  display: "flex",
  gap: "12px",
  marginTop: "20px",
};

const errorButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 20px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  color: "#64748b",
  fontSize: "14px",
  cursor: "pointer",
  transition: "all 0.2s",
};