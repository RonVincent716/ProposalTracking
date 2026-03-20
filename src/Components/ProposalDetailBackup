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
  getDoc
} from "firebase/firestore";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Use Vite's import.meta.url to load the worker from node_modules
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

  const sessionId = useRef(null);
  const startTime = useRef(Date.now());
  const pagesViewed = useRef(new Set([1]));
  const heartbeatInterval = useRef(null);
  const isTabActive = useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        // Not logged in, redirect to client login
        const returnUrl = encodeURIComponent(`/p/${path}`);
        navigate(`/client-login/${path}?returnTo=${returnUrl}`);
        return;
      }

      // User is logged in - check role but allow both admin and client
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        let role = "unknown";
        if (userDoc.exists()) {
          role = userDoc.data().role || "client";
        } else {
          // If no user document, assume it's an admin from older system
          role = "admin";
        }
        
        setUserRole(role);
        
        // Allow both admins and clients to view proposals
        if (role === 'admin' || role === 'client') {
          console.log(`User authenticated as ${role}, loading proposal...`);
          setCheckingAuth(false);
          await loadProposal(currentUser);
        } else {
          // Unknown role, redirect to client login
          console.log("Unknown user role, redirecting to login");
          await auth.signOut();
          const returnUrl = encodeURIComponent(`/p/${path}`);
          navigate(`/client-login/${path}?returnTo=${returnUrl}`);
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        // If there's an error checking role, still allow access (fail open)
        // This ensures admins can always view proposals even if there's a DB issue
        console.log("Role check failed, but allowing access");
        setCheckingAuth(false);
        await loadProposal(currentUser);
      }
    });

    return () => unsubscribe();
  }, [path, navigate]);

  const loadProposal = async (user) => {
    try {
      const decodedPath = atob(path);
      const fileRef = ref(storage, decodedPath);
      const url = await getDownloadURL(fileRef);
      setFileUrl(url);

      const extractedFileName = decodedPath.split("/").pop();
      setFileName(extractedFileName);

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

  // Download tracking (optional)
  const handleDownload = async () => {
    try {
      await addDoc(collection(db, "proposalDownloads"), {
        fileName,
        viewerId: auth.currentUser?.uid,
        viewerEmail: auth.currentUser?.email,
        downloadedAt: serverTimestamp(),
      });

      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      link.click();
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  // Logout handler - redirect based on role
  const handleLogout = async () => {
    const currentUser = auth.currentUser;
    await auth.signOut();
    
    if (userRole === 'admin') {
      // Admin goes to admin login
      navigate("/login");
    } else {
      // Client goes to client login
      navigate(`/client-login/${path}`);
    }
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
        <h2>Error: {error}</h2>
        <button onClick={() => navigate("/view")} style={buttonStyle}>Back</button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header with user info and logout */}
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <h2 style={titleStyle}>{fileName}</h2>
          <p style={userInfoStyle}>
            Logged in as: {auth.currentUser?.email} 
            {userRole && <span style={roleBadgeStyle(userRole)}> ({userRole})</span>}
          </p>
        </div>
        <div style={headerRightStyle}>
          <button
            onClick={handleDownload}
            style={downloadButtonStyle}
          >
            Download
          </button>
          <button
            onClick={handleLogout}
            style={logoutButtonStyle}
          >
            Logout
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
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
              }
            }}
            style={pageInputStyle}
          /> of {numPages}
        </span>

        <button
          onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages || 1))}
          disabled={pageNumber >= (numPages || 1)}
          style={paginationButtonStyle(pageNumber >= (numPages || 1))}
        >
          Next
        </button>
      </div>

      {/* Add spinner animation */}
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
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
  padding: "16px",
  background: "#fff",
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  border: "1px solid #eee",
};

const headerLeftStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const titleStyle = {
  margin: 0,
  fontSize: "18px",
  fontWeight: "600",
  color: "#1a1a2e",
};

const userInfoStyle = {
  margin: 0,
  fontSize: "13px",
  color: "#666",
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

const roleBadgeStyle = (role) => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: "12px",
  fontSize: "11px",
  fontWeight: "600",
  background: role === 'admin' ? '#e3f2fd' : '#f0fdf4',
  color: role === 'admin' ? '#1976D2' : '#10B981',
  marginLeft: "4px",
});

const headerRightStyle = {
  display: "flex",
  gap: "10px",
};

const downloadButtonStyle = {
  padding: "8px 16px",
  background: "#4CAF50",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 0.2s",
};

const logoutButtonStyle = {
  padding: "8px 16px",
  background: "#f1f5f9",
  color: "#64748b",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 0.2s",
};

const viewerContainerStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  overflow: "auto",
  height: "70vh",
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
};

const pdfErrorStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#c33",
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
  fontSize: "14px",
  color: "#1a1a2e",
};

const pageInputStyle = {
  width: "60px",
  padding: "6px",
  textAlign: "center",
  border: "1px solid #e2e8f0",
  borderRadius: "6px",
  margin: "0 8px",
  fontSize: "14px",
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

const buttonStyle = {
  padding: "10px 24px",
  background: "#2196F3",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  cursor: "pointer",
};