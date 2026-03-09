import { useState, useEffect } from "react";
import { storage, auth } from "../firebase";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function ProposalView() {
  const [files, setFiles] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(true);

        try {
          const proposalsRef = ref(storage, 'proposals');
          const fileList = await listAll(proposalsRef);
          setFiles(fileList.items);
        } catch (error) {
          console.error("Error listing files:", error);
          alert("Error loading files: " + error.message);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const downloadFile = async (fileRef) => {
    try {
      const url = await getDownloadURL(fileRef);
      window.open(url, "_blank");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const viewProposal = (file) => {
    const fullPath = `proposals/${file.name}`;
    const encodedPath = btoa(fullPath); // 🔹 Base64 encode path
    navigate(`/p/${encodedPath}`);
  };

  if (loading) return <div style={{ padding: 40 }}>Loading files...</div>;

  if (!user) return (
    <div style={{ padding: 40 }}>
      <p>Please <a href="/login">login</a> to view proposals.</p>
    </div>
  );

  return (
    <div style={{ padding: 40 }}>
      <h2>Proposals</h2>
      <p>Found {files.length} file(s)</p>
      {files.length === 0 && <p>No files uploaded yet.</p>}

      {files.map((file, index) => (
        <div key={index} style={{
          padding: 15,
          marginBottom: 10,
          border: '1px solid #ddd',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f9f9f9'
        }}>
          <div style={{ flex: 1 }}>
            <strong>{file.name}</strong>
          </div>

          <div>
            <button
              onClick={() => viewProposal(file)}
              style={{
                marginRight: 10,
                padding: '5px 15px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              View
            </button>

            <button
              onClick={() => downloadFile(ref(storage, `proposals/${file.name}`))}
              style={{
                padding: '5px 15px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              Download
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}