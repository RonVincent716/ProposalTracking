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

  const sessionId = useRef(null);
  const startTime = useRef(Date.now());
  const pagesViewed = useRef(new Set([1]));
  const heartbeatInterval = useRef(null);
  const isTabActive = useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setError("Login required");
        setLoading(false);
        return;
      }
      await loadProposal(currentUser);
    });

    return () => unsubscribe();
  }, [path]);

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

  if (loading) return <div style={{ padding: 40 }}>Loading proposal...</div>;

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Error: {error}</h2>
        <button onClick={() => navigate("/view")}>Back</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <h2>{fileName}</h2>
        <button
          onClick={handleDownload}
          style={{
            padding: "8px 16px",
            background: "#4CAF50",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Download
        </button>
      </div>

      <div style={{ border: "1px solid #ccc", overflow: "auto", height: "85vh" }}>
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div>Loading PDF...</div>}
          error={<div>Failed to load PDF.</div>}
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            onRenderSuccess={() => onPageChange({ pageNumber })}
          />
        </Document>
      </div>

      {/* ---------- PAGINATION CONTROLS (ADDED) ---------- */}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
          disabled={pageNumber <= 1}
          style={{
            padding: '6px 16px',
            background: pageNumber <= 1 ? '#ccc' : '#2196F3',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer'
          }}
        >
          Previous
        </button>

        <span>
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
            style={{ width: 60, textAlign: 'center' }}
          /> of {numPages}
        </span>

        <button
          onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages || 1))}
          disabled={pageNumber >= (numPages || 1)}
          style={{
            padding: '6px 16px',
            background: pageNumber >= (numPages || 1) ? '#ccc' : '#2196F3',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: pageNumber >= (numPages || 1) ? 'not-allowed' : 'pointer'
          }}
        >
          Next
        </button>
      </div>
      {/* ------------------------------------------------ */}
    </div>
  );
}