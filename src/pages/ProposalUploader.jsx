import { useState, useEffect } from "react";
import { storage, auth } from "../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { 
  MdCloudUpload, 
  MdCheckCircle, 
  MdContentCopy, 
  MdOpenInNew,
  MdInfo,
  MdEmail
} from "react-icons/md";

export default function ProposalUploader() {
  const [file, setFile] = useState(null);
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shareLink, setShareLink] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const sanitizeFileName = (fileName) => {
    if (!fileName) return "";
    return fileName.replace(/[^a-zA-Z0-9.]/g, "_");
  };

  const uploadFile = () => {
    if (!file) return alert("Select a file first!");
    if (!user) return alert("Login first");

    setUploading(true);
    setShareLink("");
    setDownloadUrl("");
    setUploadedFileName("");

    const cleanName = sanitizeFileName(file.name);
    const uniqueName = `${Date.now()}_${cleanName}`;
    const filePath = `proposals/${uniqueName}`;
    const fileRef = ref(storage, filePath);

    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (error) => {
        alert("Upload error: " + error.message);
        setUploading(false);
      },
      async () => {
        try {
          // Get the actual download URL from Firebase Storage
          const url = await getDownloadURL(fileRef);
          console.log("Download URL from Firebase:", url);
          
          // Create the viewer link using your encoded path method
          const encoded = btoa(filePath); // Base64 encode
          const viewerLink = `${window.location.origin}/p/${encoded}`;
          
          console.log("Viewer link:", viewerLink);
          console.log("Direct download URL:", url);
          
          setShareLink(viewerLink);
          setDownloadUrl(url);
          setUploadedFileName(file.name);

          setUploading(false);
          setFile(null);
          setProgress(0);

          alert("Upload successful! Copy or share the link below.");
        } catch (error) {
          alert("Error getting download URL: " + error.message);
          setUploading(false);
        }
      }
    );
  };

  // Test the link function
  const testLink = async (link) => {
    try {
      const response = await fetch(link, { method: 'HEAD' });
      if (response.ok) {
        alert("✅ Link is reachable!");
      } else {
        alert("❌ Link returned status: " + response.status);
      }
    } catch (error) {
      alert("❌ Link test failed: " + error.message);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerSection}>
        <div style={titleGroup}>
          <MdCloudUpload size={32} color="#00D4FF" />
          <h2 style={titleStyle}>Upload Proposal</h2>
        </div>
        {user && (
          <div style={userInfoStyle}>
            <MdEmail size={16} color="#00D4FF" />
            <span>{user.email}</span>
          </div>
        )}
      </div>

      <div style={uploadCardStyle}>
        <div 
          style={dropZoneStyle(!!file, uploading)}
          onClick={() => !uploading && document.getElementById("fileInput").click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!uploading && e.dataTransfer.files[0]) {
              setFile(e.dataTransfer.files[0]);
            }
          }}
        >
          <input
            id="fileInput"
            type="file"
            accept=".pdf"
            disabled={!user || uploading}
            onChange={(e) => setFile(e.target.files[0])}
            style={{ display: "none" }}
          />
          <MdCloudUpload size={48} color={file ? "#00D4FF" : "rgba(0,0,0,0.2)"} />
          <p style={{ margin: "10px 0 5px 0", fontWeight: 600, color: "#333" }}>
            {file ? file.name : "Click to select or drag PDF"}
          </p>
          <p style={{ fontSize: 12, color: "rgba(0,0,0,0.4)" }}>
            Max file size: 50MB • PDF only
          </p>
        </div>

        <button
          disabled={!file || uploading || !user}
          onClick={uploadFile}
          style={uploadBtnStyle(!file || uploading || !user)}
        >
          {uploading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="spinner" />
              <span>Uploading {Math.round(progress)}%</span>
            </div>
          ) : (
            "Start Upload"
          )}
        </button>

        {uploading && (
          <div style={progressContainer}>
            <div style={progressBar(progress)} />
          </div>
        )}
      </div>

      {shareLink && (
        <div style={successCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 15 }}>
            <MdCheckCircle size={24} color="#10B981" />
            <h3 style={{ margin: 0, fontSize: 18 }}>Upload Successful</h3>
          </div>
          
          <p style={{ fontSize: 14, color: "rgba(0,0,0,0.6)", marginBottom: 10 }}>
            Share this proposal link with your client:
          </p>
          
          <div style={linkContainer}>
            <input 
              value={shareLink} 
              readOnly 
              style={linkInputStyle} 
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
                alert("✅ Link copied to clipboard!");
              }}
              style={iconButtonStyle}
              title="Copy Link"
            >
              <MdContentCopy size={20} />
            </button>
          </div>

          <div style={infoBoxStyle}>
            <MdInfo size={18} color="#FF9800" />
            <span style={{ fontSize: 13, color: "#666" }}>
              This link will open the proposal viewer. Make sure your /p route is properly configured.
            </span>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <button
              onClick={() => window.open(shareLink, "_blank")}
              style={actionBtnStyle}
            >
              <MdOpenInNew size={18} />
              Open Viewer
            </button>
            <button
              onClick={() => window.open(downloadUrl, "_blank")}
              style={{...actionBtnStyle, background: "#00D4FF", color: "#fff", border: "none"}}
            >
              <MdCloudUpload size={18} />
              Direct Download
            </button>
            <button
              onClick={() => testLink(shareLink)}
              style={{...actionBtnStyle, background: "#f4f6f8"}}
            >
              <MdInfo size={18} />
              Test Link
            </button>
          </div>

          {/* Debug info - only show if file exists */}
          {uploadedFileName && (
            <div style={{
              marginTop: 20,
              padding: 10,
              background: "#f4f6f8",
              borderRadius: 8,
              fontSize: 12,
              color: "#666",
              fontFamily: "monospace",
              wordBreak: "break-all"
            }}>
              <strong>Debug Info:</strong><br/>
              File: {uploadedFileName}<br/>
              Encoded Path: {shareLink.split('/').pop()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const containerStyle = {
  maxWidth: 800,
  margin: "0 auto",
  padding: "20px 0",
  fontFamily: "'Inter', system-ui, sans-serif",
  color: "#1a1a2e",
};

const headerSection = {
  marginBottom: 30,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const titleGroup = {
  display: "flex",
  alignItems: "center",
  gap: 15,
};

const titleStyle = {
  margin: 0,
  fontSize: 28,
  fontWeight: 700,
  background: "linear-gradient(to right, #1976D2, #00D4FF)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const userInfoStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 16px",
  background: "rgba(0, 212, 255, 0.1)",
  border: "1px solid rgba(0, 212, 255, 0.2)",
  borderRadius: 100,
  fontSize: 13,
  color: "#666",
  width: "fit-content",
};

const uploadCardStyle = {
  background: "#fff",
  backdropFilter: "blur(12px)",
  borderRadius: 24,
  padding: 30,
  border: "1px solid rgba(0, 0, 0, 0.08)",
  boxShadow: "0 20px 50px rgba(0,0,0,0.1)",
};

const dropZoneStyle = (hasFile, uploading) => ({
  border: `2px dashed ${hasFile ? "#00D4FF" : "rgba(0,0,0,0.2)"}`,
  borderRadius: 16,
  padding: "40px 20px",
  textAlign: "center",
  cursor: uploading ? "not-allowed" : "pointer",
  transition: "all 0.3s ease",
  background: hasFile ? "rgba(0, 212, 255, 0.05)" : "rgba(0,0,0,0.02)",
  marginBottom: 25,
});

const uploadBtnStyle = (disabled) => ({
  width: "100%",
  padding: "16px",
  borderRadius: 14,
  border: "none",
  background: disabled 
    ? "rgba(0,0,0,0.1)" 
    : "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
  color: disabled ? "rgba(0,0,0,0.3)" : "#fff",
  fontSize: 16,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "all 0.3s ease",
  boxShadow: disabled ? "none" : "0 10px 25px rgba(0, 212, 255, 0.3)",
});

const progressContainer = {
  marginTop: 20,
  height: 6,
  background: "rgba(0,0,0,0.05)",
  borderRadius: 10,
  overflow: "hidden",
};

const progressBar = (p) => ({
  width: `${p}%`,
  height: "100%",
  background: "linear-gradient(to right, #00D4FF, #0099CC)",
  transition: "width 0.3s ease",
});

const successCardStyle = {
  marginTop: 30,
  background: "#fff",
  borderRadius: 24,
  padding: 25,
  border: "1px solid rgba(16, 185, 129, 0.3)",
  boxShadow: "0 10px 30px rgba(16, 185, 129, 0.1)",
};

const linkContainer = {
  display: "flex",
  gap: 10,
  background: "#f4f6f8",
  padding: 8,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.1)",
};

const linkInputStyle = {
  flex: 1,
  background: "transparent",
  border: "none",
  color: "#00D4FF",
  padding: "8px 12px",
  fontSize: 14,
  outline: "none",
};

const iconButtonStyle = {
  background: "#f4f6f8",
  border: "none",
  color: "#333",
  padding: 10,
  borderRadius: 8,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s",
  ':hover': {
    background: "#e0e0e0"
  }
};

const actionBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 20px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.1)",
  background: "#f4f6f8",
  color: "#333",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.2s",
  ':hover': {
    background: "#e0e0e0"
  }
};

const infoBoxStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 15,
  padding: "10px 15px",
  background: "#FFF3E0",
  borderRadius: 8,
  border: "1px solid #FFE0B2",
};