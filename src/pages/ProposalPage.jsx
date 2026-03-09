import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { storage, db } from "../firebase";
import { ref, getDownloadURL } from "firebase/storage";
import {
  addDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";

export default function ProposalPage() {
  const { path } = useParams();

  const [url, setUrl] = useState(null);

  useEffect(() => {
    const loadProposal = async () => {
      try {
        const decoded = decodeURIComponent(path);

        const fileRef = ref(storage, decoded);

        const downloadURL = await getDownloadURL(fileRef);

        setUrl(downloadURL);

        await addDoc(collection(db, "proposalViews"), {
          filePath: decoded,
          fileName: decoded.split("/").pop(),
          viewedAt: serverTimestamp()
        });

      } catch (error) {
        console.error(error);
      }
    };

    loadProposal();
  }, [path]);

  if (!url) return <div>Loading proposal...</div>;

  return (
    <div style={{ height: "100vh" }}>
      <iframe
        src={url}
        width="100%"
        height="100%"
        title="Proposal Viewer"
      />
    </div>
  );
}