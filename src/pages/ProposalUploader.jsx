import { useState, useEffect } from "react";
import { storage, auth } from "../firebase";
import { ref, uploadBytesResumable } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";

export default function ProposalUploader() {
  const [file, setFile] = useState(null);
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shareLink, setShareLink] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const sanitizeFileName = (fileName) => fileName.replace(/[^a-zA-Z0-9.]/g, "_");

  const uploadFile = () => {
    if (!file) return alert("Select a file first!");
    if (!user) return alert("Login first");

    setUploading(true);

    const cleanName = sanitizeFileName(file.name);
    const uniqueName = `${Date.now()}_${cleanName}`;
    const filePath = `proposals/${uniqueName}`;
    const fileRef = ref(storage, filePath);

    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (error) => {
        alert(error.message);
        setUploading(false);
      },
      () => {
      const encoded = btoa(filePath); // Base64 encode
const link = `${window.location.origin}/p/${encoded}`;
console.log("Generated share link:", link);
setShareLink(link);

        setShareLink(link); // <-- This ensures link is displayed
        setUploading(false);
        setFile(null);
        setProgress(0);

        alert("Upload successful! Copy or share the link below.");
      }
    );
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Upload Proposal</h2>

      {user ? <p>Logged in as {user.email}</p> : <p>Please login first</p>}

      <input
        type="file"
        accept=".pdf"
        disabled={!user || uploading}
        onChange={(e) => setFile(e.target.files[0])}
      />

      <br /><br />

      <button
        disabled={!file || uploading}
        onClick={uploadFile}
        style={{
          padding: "10px 20px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        Upload
      </button>

      {uploading && <p>Uploading {Math.round(progress)}%</p>}

      {shareLink && (
        <div
          style={{
            marginTop: 20,
            padding: 20,
            border: "2px solid #4CAF50",
            borderRadius: 8,
            background: "#f6fff6",
          }}
        >
          <h3>✅ Upload Successful</h3>
          <p>Share this proposal link:</p>
          <input value={shareLink} readOnly style={{ width: "100%", padding: 10, marginBottom: 10 }} />
          <button
            onClick={() => navigator.clipboard.writeText(shareLink)}
            style={{ padding: "8px 16px", background: "#2196F3", color: "white", border: "none", borderRadius: 4 }}
          >
            Copy Link
          </button>

          <br /><br />

          <a href={shareLink} target="_blank" rel="noopener noreferrer">
            Open Proposal
          </a>
        </div>
      )}
    </div>
  );
}