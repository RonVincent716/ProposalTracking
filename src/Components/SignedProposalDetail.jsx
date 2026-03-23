import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, storage } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { 
  MdCheckCircle, 
  MdArrowBack, 
  MdDescription, 
  MdDownload, 
  MdPerson, 
  MdEmail, 
  MdSchedule,
  MdPrint,
  MdShare
} from "react-icons/md";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function SignedProposalDetail() {
  const { signingId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signingData, setSigningData] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    loadSignedProposal();
  }, [signingId]);

  const loadSignedProposal = async () => {
    try {
      setLoading(true);
      
      // Get signing data from Firestore
      const signingRef = doc(db, "signedProposals", signingId);
      const signingSnap = await getDoc(signingRef);
      
      if (!signingSnap.exists()) {
        setError("Signed proposal not found");
        setLoading(false);
        return;
      }
      
      const data = signingSnap.data();
      setSigningData(data);
      setFileName(data.proposalName);
      
      // Get the PDF file
      if (data.proposalPath) {
        const fileRef = ref(storage, data.proposalPath);
        const url = await getDownloadURL(fileRef);
        setFileUrl(url);
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error loading signed proposal:", err);
      setError("Failed to load signed proposal");
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (fileUrl) {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      link.click();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copied to clipboard!");
  };

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div className="spinner"></div>
        <p>Loading signed proposal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={errorContainerStyle}>
        <MdDescription size={64} color="#ef4444" />
        <h2>Signed Proposal Not Found</h2>
        <p>{error}</p>
        <button onClick={() => navigate("/dashboard")} style={backButtonStyle}>
          <MdArrowBack size={18} />
          Back to Dashboard
        </button>
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
            <MdCheckCircle size={28} color="#10B981" />
            <div>
              <h1 style={titleStyle}>Signed Proposal</h1>
              <p style={subtitleStyle}>Electronically signed and verified</p>
            </div>
          </div>
        </div>
        
        <div style={headerRightStyle}>
          <button onClick={handlePrint} style={printButtonStyle}>
            <MdPrint size={16} />
            Print
          </button>
          <button onClick={handleShare} style={shareButtonStyle}>
            <MdShare size={16} />
            Share
          </button>
          <button onClick={handleDownload} style={downloadButtonStyle}>
            <MdDownload size={16} />
            Download
          </button>
        </div>
      </div>

      {/* Signature Confirmation Card */}
      <div style={confirmationCardStyle}>
        <div style={confirmationHeaderStyle}>
          <MdCheckCircle size={48} color="#10B981" />
          <h2 style={confirmationTitleStyle}>Proposal Signed Successfully!</h2>
          <p style={confirmationMessageStyle}>
            This proposal has been electronically signed and is legally binding.
          </p>
        </div>
        
        <div style={signatureDetailsStyle}>
          <h3 style={detailsTitleStyle}>Signature Details</h3>
          
          <div style={detailsGridStyle}>
            <div style={detailItemStyle}>
              <MdPerson size={20} color="#10B981" />
              <div>
                <span style={detailLabelStyle}>Signed by</span>
                <span style={detailValueStyle}>{signingData?.signedBy}</span>
              </div>
            </div>
            
            <div style={detailItemStyle}>
              <MdEmail size={20} color="#10B981" />
              <div>
                <span style={detailLabelStyle}>Email address</span>
                <span style={detailValueStyle}>{signingData?.signerEmail}</span>
              </div>
            </div>
            
            <div style={detailItemStyle}>
              <MdSchedule size={20} color="#10B981" />
              <div>
                <span style={detailLabelStyle}>Signed on</span>
                <span style={detailValueStyle}>
                  {signingData?.signedAt?.toDate 
                    ? signingData.signedAt.toDate().toLocaleString()
                    : new Date(signingData?.signedAt).toLocaleString()}
                </span>
              </div>
            </div>
            
            <div style={detailItemStyle}>
              <MdDescription size={20} color="#10B981" />
              <div>
                <span style={detailLabelStyle}>Document</span>
                <span style={detailValueStyle}>{signingData?.proposalName}</span>
              </div>
            </div>
          </div>
          
          {/* Signature Preview */}
          <div style={signaturePreviewStyle}>
            <h4 style={previewTitleStyle}>Signature</h4>
            {signingData?.signatureType === 'draw' ? (
              <div style={drawSignatureStyle}>
                <img src={signingData.signature} alt="Signature" style={signatureImageStyle} />
              </div>
            ) : (
              <div style={typedSignatureStyle}>
                <span>{signingData?.signature}</span>
              </div>
            )}
            <p style={signatureMethodStyle}>
              Signature method: {signingData?.signatureType === 'draw' ? 'Drawn signature' : 'Typed signature'}
            </p>
          </div>
        </div>
      </div>

      {/* Document Preview */}
      <div style={documentPreviewStyle}>
        <h3 style={previewHeaderStyle}>Signed Document</h3>
        <div style={viewerContainerStyle}>
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div style={pdfLoadingStyle}>Loading document...</div>}
            error={<div style={pdfErrorStyle}>Failed to load document.</div>}
          >
            <Page
              pageNumber={pageNumber}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
        </div>
        
        {/* Pagination Controls */}
        {numPages > 1 && (
          <div style={paginationContainerStyle}>
            <button
              onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
              disabled={pageNumber <= 1}
              style={paginationButtonStyle(pageNumber <= 1)}
            >
              Previous
            </button>
            
            <span style={pageInfoStyle}>
              Page {pageNumber} of {numPages}
            </span>
            
            <button
              onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
              disabled={pageNumber >= numPages}
              style={paginationButtonStyle(pageNumber >= numPages)}
            >
              Next
            </button>
          </div>
        )}
      </div>
      
      {/* Footer Actions */}
      <div style={footerStyle}>
        <button onClick={() => navigate("/dashboard")} style={dashboardButtonStyle}>
          Back to Dashboard
        </button>
        <button onClick={handleDownload} style={downloadButtonStyle}>
          <MdDownload size={18} />
          Download Signed Copy
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
        @media print {
          .no-print {
            display: none !important;
          }
          button {
            display: none !important;
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
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "30px",
  padding: "20px 24px",
  background: "#fff",
  borderRadius: "16px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  border: "1px solid #e2e8f0",
  flexWrap: "wrap",
  gap: "15px",
};

const headerLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: "20px",
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
  gap: "12px",
};

const titleStyle = {
  margin: 0,
  fontSize: "24px",
  fontWeight: "700",
  color: "#1a1a2e",
};

const subtitleStyle = {
  margin: "4px 0 0 0",
  fontSize: "13px",
  color: "#64748b",
};

const headerRightStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const printButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 16px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  color: "#64748b",
  fontSize: "13px",
  cursor: "pointer",
};

const shareButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 16px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  color: "#64748b",
  fontSize: "13px",
  cursor: "pointer",
};

const downloadButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 16px",
  background: "#4CAF50",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "13px",
  fontWeight: "500",
  cursor: "pointer",
};

const confirmationCardStyle = {
  background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
  border: "1px solid #86efac",
  borderRadius: "20px",
  padding: "30px",
  marginBottom: "30px",
};

const confirmationHeaderStyle = {
  textAlign: "center",
  marginBottom: "30px",
};

const confirmationTitleStyle = {
  fontSize: "28px",
  fontWeight: "700",
  color: "#166534",
  margin: "15px 0 10px 0",
};

const confirmationMessageStyle = {
  fontSize: "16px",
  color: "#15803d",
  margin: 0,
};

const signatureDetailsStyle = {
  background: "#fff",
  borderRadius: "16px",
  padding: "24px",
};

const detailsTitleStyle = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#1a1a2e",
  margin: "0 0 20px 0",
  paddingBottom: "10px",
  borderBottom: "2px solid #e2e8f0",
};

const detailsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "20px",
  marginBottom: "25px",
};

const detailItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  background: "#f8fafc",
  borderRadius: "12px",
};

const detailLabelStyle = {
  display: "block",
  fontSize: "12px",
  color: "#64748b",
  marginBottom: "4px",
};

const detailValueStyle = {
  display: "block",
  fontSize: "15px",
  fontWeight: "600",
  color: "#1a1a2e",
};

const signaturePreviewStyle = {
  marginTop: "20px",
  padding: "20px",
  background: "#f8fafc",
  borderRadius: "12px",
  textAlign: "center",
};

const previewTitleStyle = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#1a1a2e",
  margin: "0 0 15px 0",
};

const drawSignatureStyle = {
  display: "flex",
  justifyContent: "center",
  marginBottom: "10px",
};

const signatureImageStyle = {
  maxHeight: "80px",
  background: "#fff",
  padding: "8px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
};

const typedSignatureStyle = {
  fontSize: "32px",
  fontFamily: "'Dancing Script', cursive",
  color: "#1a1a2e",
  marginBottom: "10px",
};

const signatureMethodStyle = {
  fontSize: "12px",
  color: "#64748b",
  margin: 0,
};

const documentPreviewStyle = {
  background: "#fff",
  borderRadius: "16px",
  padding: "24px",
  border: "1px solid #e2e8f0",
  marginBottom: "30px",
};

const previewHeaderStyle = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#1a1a2e",
  margin: "0 0 20px 0",
};

const viewerContainerStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  overflow: "auto",
  height: "600px",
  background: "#f8fafc",
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
  padding: "12px",
  background: "#fff",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
};

const paginationButtonStyle = (disabled) => ({
  padding: "6px 16px",
  background: disabled ? "#e2e8f0" : "#2196F3",
  color: disabled ? "#94a3b8" : "#fff",
  border: "none",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: "500",
  cursor: disabled ? "not-allowed" : "pointer",
});

const pageInfoStyle = {
  fontSize: "14px",
  color: "#1a1a2e",
};

const footerStyle = {
  display: "flex",
  justifyContent: "center",
  gap: "20px",
  marginTop: "20px",
};

const dashboardButtonStyle = {
  padding: "12px 24px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  color: "#64748b",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
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