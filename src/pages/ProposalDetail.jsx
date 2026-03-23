import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { storage, auth, db } from "../firebase";
import { ref, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,  
  updateDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { MdEdit, MdFileUpload, MdLogout, MdDescription, MdArrowBack, MdCheckCircle, MdDashboard } from "react-icons/md";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function ProposalDetail() {
  const { path } = useParams();
  const navigate = useNavigate();

  const [fileUrl, setFileUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [isSigned, setIsSigned] = useState(false);

  const sessionId = useRef(null);
  const startTime = useRef(Date.now());
  const pagesViewed = useRef(new Set([1]));
  const heartbeatInterval = useRef(null);
  const isTabActive = useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        const returnUrl = encodeURIComponent(`/p/${path}`);
        navigate(`/client-login?returnTo=${returnUrl}`);
        return;
      }

      setUserEmail(currentUser.email);

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        let role = "unknown";
        if (userDoc.exists()) {
          role = userDoc.data().role || "client";
        } else {
          role = "admin";
        }
        
        setUserRole(role);
        
        setCheckingAuth(false);
        await loadProposal(currentUser);
      } catch (error) {
        console.error("Error checking user role:", error);
        setCheckingAuth(false);
        await loadProposal(currentUser);
      }
    });

    return () => unsubscribe();
  }, [path, navigate]);

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

  const loadProposal = async (user) => {
    try {
      const decodedPath = decodePath(path);
      console.log("Final decoded path:", decodedPath);
      
      const fileRef = ref(storage, decodedPath);
      const url = await getDownloadURL(fileRef);
      setFileUrl(url);

      const extractedFileName = decodedPath.split("/").pop();
      setFileName(extractedFileName);

      // Check if already signed
      const signedQuery = query(
        collection(db, "signedProposals"),
        where("proposalPath", "==", decodedPath),
        where("signerEmail", "==", user.email)
      );
      const signedSnapshot = await getDocs(signedQuery);
      setIsSigned(!signedSnapshot.empty);

      // Log view
      await addDoc(collection(db, "proposalViews"), {
        fileName: extractedFileName,
        filePath: decodedPath,
        viewerId: user.uid,
        viewerEmail: user.email,
        viewedAt: serverTimestamp(),
      });

      // Create session
      const session = await addDoc(collection(db, "proposalSessions"), {
        fileName: extractedFileName,
        filePath: decodedPath,
        viewerId: user.uid,
        viewerEmail: user.email,
        pagesViewed: [1],
        duration: 0,
        startedAt: serverTimestamp(),
      });

      sessionId.current = session.id;
    } catch (err) {
      console.error("Error loading proposal:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onPageChange = ({ pageNumber }) => {
    setPageNumber(pageNumber);
    pagesViewed.current.add(pageNumber);
  };

  // Tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabActive.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Heartbeat update every 30 seconds
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

  // Final save when user leaves
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

  const handleDownload = async () => {
    try {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      link.click();
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const handleSignProposal = () => {
    navigate(`/sign/${path}`);
  };

  const handleGoToDashboard = () => {
    navigate("/client-dashboard");
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  if (checkingAuth || loading) {
    return (
      <div style={loadingContainerStyle}>
        <div className="spinner"></div>
        <p>Loading proposal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={errorContainerStyle}>
        <MdDescription size={64} color="#ef4444" />
        <h2>Error Loading Proposal</h2>
        <p>{error}</p>
        <button onClick={handleGoBack} style={backButtonStyle}>
          <MdArrowBack size={18} />
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <button onClick={handleGoBack} style={backNavButtonStyle}>
            <MdArrowBack size={18} />
            Back
          </button>
          <div style={titleContainerStyle}>
            <MdDescription size={24} color="#1976D2" />
            <div>
              <h2 style={titleStyle}>{fileName}</h2>
              <p style={userInfoStyle}>{userEmail}</p>
            </div>
          </div>
        </div>

        <div style={userRoleContainerStyle}>
          {userRole && (
            <span style={roleBadgeStyle(userRole)}>
              {userRole === 'admin' ? 'Admin' : 'Client'}
            </span>
          )}
          {isSigned && (
            <span style={signedBadgeStyle}>
              <MdCheckCircle size={14} />
              Signed
            </span>
          )}
        </div>

        <div style={headerRightStyle}>
          {/* SIGN BUTTON - Only show for clients who haven't signed */}
          {userRole === 'client' && !isSigned && (
            <button onClick={handleSignProposal} style={signButtonStyle}>
              <MdEdit size={18} />
              Sign This Proposal
            </button>
          )}
          
          {/* GO TO DASHBOARD BUTTON */}
          {userRole === 'client' && (
            <button onClick={handleGoToDashboard} style={dashboardButtonStyle}>
              <MdDashboard size={16} />
              My Dashboard
            </button>
          )}
          
          <button onClick={handleDownload} style={downloadButtonStyle}>
            <MdFileUpload size={16} />
            Download
          </button>
          
          <button onClick={handleLogout} style={logoutButtonStyle}>
            <MdLogout size={16} />
            Logout
          </button>
        </div>
      </div>

      <div style={viewerContainerStyle}>
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div style={pdfLoadingStyle}>Loading PDF...</div>}
          error={<div style={pdfErrorStyle}>Failed to load PDF.</div>}
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            onRenderSuccess={() => onPageChange({ pageNumber })}
          />
        </Document>
      </div>

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
};

const titleContainerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const titleStyle = {
  margin: 0,
  fontSize: "18px",
  fontWeight: "600",
  color: "#1a1a2e",
};

const userInfoStyle = {
  margin: "4px 0 0 0",
  fontSize: "12px",
  color: "#64748b",
};

const userRoleContainerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 16px",
  background: "#f8fafc",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
};

const roleBadgeStyle = (role) => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "600",
  background: role === 'admin' ? '#e3f2fd' : '#f0fdf4',
  color: role === 'admin' ? '#1976D2' : '#10B981',
  border: `1px solid ${role === 'admin' ? '#90caf9' : '#86efac'}`,
});

const signedBadgeStyle = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "600",
  background: "#f0fdf4",
  color: "#10B981",
  border: "1px solid #86efac",
};

const headerRightStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
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
};

const downloadButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "#4CAF50",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
};

const logoutButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "#f1f5f9",
  color: "#64748b",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
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

const backButtonStyle = {
  padding: "10px 24px",
  background: "#2196F3",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  cursor: "pointer",
  marginTop: "20px",
};