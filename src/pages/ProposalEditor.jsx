import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

export default function ProposalEditor() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const createProposal = async () => {
    console.log("Create button clicked");

    if (!title.trim() || !content.trim()) {
      alert("Please fill in both title and content.");
      return;
    }

    try {
      const token = uuidv4();

      await addDoc(collection(db, "proposals"), {
        title,
        content,
        publicToken: token,
        createdAt: new Date(),
        isActive: true,
      });

      alert(`Share link: ${window.location.origin}/p/${token}`);
    } catch (error) {
      console.error("Failed to create proposal:", error);
      alert("Failed to create proposal. See console for details.");
    }
  };

  return (
    <div>
      <h2>Create Proposal</h2>
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        placeholder="Content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button
        onClick={() => {
          console.log("Button clicked");
          createProposal();
        }}
      >
        Create
      </button>
    </div>
  );
}