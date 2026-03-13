import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { 
  MdCheckCircle, 
  MdDownload, 
  MdPrint, 
  MdHome,
  MdEmail,
  MdDescription,
  MdSchedule,
  MdPerson
} from "react-icons/md";

export default function ThankYou() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);
  const [signingDetails, setSigningDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const name = searchParams.get("name") || "there";
  const proposal = searchParams.get("proposal") || "Proposal";
  const signingId = searchParams.get("id");

  useEffect(() => {
    // Load signing details if ID is provided
    if (signingId) {
      loadSigningDetails();
    } else {
      setLoading(false);
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [signingId]);

  const loadSigningDetails = async () => {
    try {
      const signingRef = doc(db, "signedProposals", signingId);
      const signingSnap = await getDoc(signingRef);
      
      if (signingSnap.exists()) {
        setSigningDetails(signingSnap.data());
      }
    } catch (error) {
      console.error("Error loading signing details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    // In a real app, generate a PDF with signature
    alert("Downloading signed document...");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmailCopy = () => {
    // In a real app, email a copy
    alert("A copy has been sent to your email");
  };

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Success Icon */}
        <div style={iconContainerStyle}>
          <div style={iconWrapperStyle}>
            <MdCheckCircle size={80} color="#10B981" />
          </div>
          <div style={confettiStyle}></div>
        </div>

        {/* Thank You Message */}
        <h1 style={titleStyle}>Thank You, {name}!</h1>
        <p style={messageStyle}>
          You have successfully signed <strong>{proposal}</strong>
        </p>

        {/* Signing Details */}
        {signingDetails && (
          <div style={detailsCardStyle}>
            <h3 style={detailsTitleStyle}>Signing Details</h3>
            
            <div style={detailItemStyle}>
              <MdPerson size={18} color="#64748b" />
              <div>
                <span style={detailLabelStyle}>Signed by:</span>
                <span style={detailValueStyle}>{signingDetails.signedBy}</span>
              </div>
            </div>
            
            <div style={detailItemStyle}>
              <MdEmail size={18} color="#64748b" />
              <div>
                <span style={detailLabelStyle}>Email:</span>
                <span style={detailValueStyle}>{signingDetails.signerEmail}</span>
              </div>
            </div>
            
            <div style={detailItemStyle}>
              <MdSchedule size={18} color="#64748b" />
              <div>
                <span style={detailLabelStyle}>Signed at:</span>
                <span style={detailValueStyle}>
                  {new Date().toLocaleString()}
                </span>
              </div>
            </div>
            
            <div style={detailItemStyle}>
              <MdDescription size={18} color="#64748b" />
              <div>
                <span style={detailLabelStyle}>Document:</span>
                <span style={detailValueStyle}>{signingDetails.proposalName}</span>
              </div>
            </div>

            {/* Signature Preview */}
            {signingDetails.signatureType === "draw" ? (
              <div style={signaturePreviewStyle}>
                <span style={detailLabelStyle}>Signature:</span>
                <img 
                  src={signingDetails.signature} 
                  alt="Signature" 
                  style={signatureImageStyle} 
                />
              </div>
            ) : (
              <div style={signaturePreviewStyle}>
                <span style={detailLabelStyle}>Signature:</span>
                <span style={typedSignatureStyle}>{signingDetails.signature}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={actionsStyle}>
          <button onClick={handleDownload} style={actionButtonStyle}>
            <MdDownload size={20} />
            Download
          </button>
          <button onClick={handlePrint} style={actionButtonStyle}>
            <MdPrint size={20} />
            Print
          </button>
          <button onClick={handleEmailCopy} style={actionButtonStyle}>
            <MdEmail size={20} />
            Email Copy
          </button>
        </div>

        {/* Info Box */}
        <div style={infoBoxStyle}>
          <MdCheckCircle size={20} color="#10B981" />
          <p style={infoTextStyle}>
            A copy of the signed document has been sent to your email.
            You can also download it using the buttons above.
          </p>
        </div>

        {/* Countdown */}
        <p style={countdownStyle}>
          This window will close in {countdown} seconds...
        </p>

        {/* Home Button */}
        <button 
          onClick={() => navigate("/")} 
          style={homeButtonStyle}
        >
          <MdHome size={18} />
          Go to Homepage
        </button>
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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media print {
          button {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

const containerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  padding: "20px",
  fontFamily: "'Inter', sans-serif",
};

const cardStyle = {
  background: "#fff",
  borderRadius: "32px",
  padding: "50px",
  maxWidth: "600px",
  width: "90%",
  textAlign: "center",
  boxShadow: "0 30px 70px rgba(0,0,0,0.3)",
  position: "relative",
  overflow: "hidden",
};

const iconContainerStyle = {
  position: "relative",
  marginBottom: "30px",
};

const iconWrapperStyle = {
  width: "120px",
  height: "120px",
  borderRadius: "50%",
  background: "rgba(16, 185, 129, 0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto",
  border: "3px solid rgba(16, 185, 129, 0.3)",
  animation: "pulse 2s infinite",
};

const confettiStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "200px",
  height: "200px",
  background: "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)",
  animation: "rotate 10s linear infinite",
  pointerEvents: "none",
};

const titleStyle = {
  color: "#1a1a2e",
  fontSize: "36px",
  fontWeight: "800",
  margin: "0 0 15px 0",
  background: "linear-gradient(135deg, #1a1a2e 0%, #2d3748 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const messageStyle = {
  color: "#64748b",
  fontSize: "18px",
  lineHeight: "1.6",
  margin: "0 0 30px 0",
};

const detailsCardStyle = {
  background: "#f8fafc",
  borderRadius: "20px",
  padding: "25px",
  marginBottom: "30px",
  textAlign: "left",
  border: "1px solid #e2e8f0",
};

const detailsTitleStyle = {
  color: "#1a1a2e",
  fontSize: "18px",
  fontWeight: "600",
  margin: "0 0 20px 0",
  paddingBottom: "10px",
  borderBottom: "1px solid #e2e8f0",
};

const detailItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "15px",
};

const detailLabelStyle = {
  color: "#94a3b8",
  fontSize: "13px",
  display: "block",
  marginBottom: "2px",
};

const detailValueStyle = {
  color: "#1a1a2e",
  fontSize: "14px",
  fontWeight: "500",
  display: "block",
};

const signaturePreviewStyle = {
  marginTop: "15px",
  padding: "15px",
  background: "#fff",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
};

const signatureImageStyle = {
  maxHeight: "50px",
  marginTop: "10px",
  display: "block",
};

const typedSignatureStyle = {
  display: "block",
  marginTop: "10px",
  fontSize: "20px",
  fontFamily: "'Dancing Script', cursive",
  color: "#1a1a2e",
};

const actionsStyle = {
  display: "flex",
  gap: "15px",
  justifyContent: "center",
  marginBottom: "30px",
  flexWrap: "wrap",
};

const actionButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 24px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  color: "#1a1a2e",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 0.2s",
};

const infoBoxStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: "15px",
  padding: "20px",
  background: "#f0fdf4",
  borderRadius: "16px",
  marginBottom: "25px",
  textAlign: "left",
  border: "1px solid #86efac",
};

const infoTextStyle = {
  color: "#166534",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: 0,
  flex: 1,
};

const countdownStyle = {
  color: "#94a3b8",
  fontSize: "14px",
  marginBottom: "20px",
};

const homeButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 30px",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  border: "none",
  borderRadius: "12px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: "600",
  cursor: "pointer",
  boxShadow: "0 10px 25px rgba(102, 126, 234, 0.3)",
  transition: "all 0.3s",
};

const loadingContainerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  gap: "20px",
  background: "#f8fafc",
};