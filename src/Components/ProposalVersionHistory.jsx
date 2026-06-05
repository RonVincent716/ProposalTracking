import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { MdHistory, MdOpenInNew, MdDownload, MdEventNote, MdAdd, MdCloudUpload } from "react-icons/md";
import { db, storage, auth } from "../firebase";
import { ActivityLogger } from "../utils/activityLogger";

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function ProposalVersionHistory({ proposalId, proposalName, filePath, currentVersion = null, visible = true }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState(null);
  const [newVersionNotes, setNewVersionNotes] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  const [versionMessage, setVersionMessage] = useState("");

  useEffect(() => {
    const loadVersions = async () => {
      if (!proposalId && !filePath) {
        setVersions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const versionQuery = query(
          collection(db, "proposalVersions"),
          where("proposalId", "in", [proposalId || filePath, filePath || proposalId])
        );
        const snapshot = await getDocs(versionQuery);
        const data = snapshot.docs.map((versionDoc) => ({
          id: versionDoc.id,
          ...versionDoc.data(),
          uploadedAt: toDate(versionDoc.data().uploadedAt) || toDate(versionDoc.data().createdAt)
        }));

        const unique = [];
        const seen = new Set();
        data.forEach((item) => {
          const key = `${item.proposalId || ""}:${item.versionNumber || item.id}`;
          if (seen.has(key)) return;
          seen.add(key);
          unique.push(item);
        });

        unique.sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));
        setVersions(unique);
        setSelectedVersionId((prev) => prev || unique[0]?.id || null);
      } catch (error) {
        console.error("Error loading proposal versions:", error);
        setVersions([]);
      } finally {
        setLoading(false);
      }
    };

    loadVersions();
  }, [proposalId, filePath]);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) || versions[0] || null,
    [versions, selectedVersionId]
  );

  const handleAddVersion = async () => {
    if (!newVersionFile) {
      setVersionMessage("Select a PDF file first.");
      return;
    }

    if (newVersionFile.type !== "application/pdf") {
      setVersionMessage("Only PDF files are allowed.");
      return;
    }

    setSavingVersion(true);
    setVersionMessage("");

    try {
      const baseProposalId = proposalId || filePath;
      const versionNumber = (versions[0]?.versionNumber || 0) + 1;
      const sanitizedName = newVersionFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const versionPath = `proposalVersions/${encodeURIComponent(baseProposalId)}/v${versionNumber}_${Date.now()}_${sanitizedName}`;
      const versionRef = ref(storage, versionPath);

      const uploadTask = uploadBytesResumable(versionRef, newVersionFile);
      await new Promise((resolve, reject) => {
        uploadTask.on("state_changed", null, reject, resolve);
      });

      const downloadUrl = await getDownloadURL(versionRef);

      await addDoc(collection(db, "proposalVersions"), {
        proposalId: baseProposalId,
        proposalName: proposalName || selectedVersion?.proposalName || "Proposal",
        fileName: newVersionFile.name,
        filePath: filePath || selectedVersion?.filePath || baseProposalId,
        versionNumber,
        versionLabel: `v${versionNumber}`,
        notes: newVersionNotes.trim() || "Added a new revision",
        changeSummary: [newVersionNotes.trim() || "New version uploaded"],
        uploadedBy: auth.currentUser?.uid || null,
        uploadedByEmail: auth.currentUser?.email || null,
        uploadedAt: serverTimestamp(),
        isLatest: true,
        source: "manual_upload",
        downloadUrl
      });

      await ActivityLogger.logEdit(baseProposalId, proposalName || "Proposal", ["added version"]);

      setVersionMessage(`Version v${versionNumber} saved.`);
      setShowAddForm(false);
      setNewVersionFile(null);
      setNewVersionNotes("");
      setSelectedVersionId(null);
      const snapshot = await getDocs(
        query(collection(db, "proposalVersions"), where("proposalId", "==", baseProposalId))
      );
      const refreshed = snapshot.docs.map((versionDoc) => ({
        id: versionDoc.id,
        ...versionDoc.data(),
        uploadedAt: toDate(versionDoc.data().uploadedAt) || toDate(versionDoc.data().createdAt)
      }));
      refreshed.sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));
      setVersions(refreshed);
      setSelectedVersionId(refreshed[0]?.id || null);
    } catch (error) {
      console.error("Error adding version:", error);
      setVersionMessage(`Failed to add version: ${error.message}`);
    } finally {
      setSavingVersion(false);
    }
  };

  if (!visible) return null;

  return (
    <aside style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerTitleStyle}>
          <MdHistory size={18} color="#1d4ed8" />
          <div>
            <h3 style={titleStyle}>Version History</h3>
            <p style={subtitleStyle}>{proposalName || "Proposal"}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {currentVersion && <span style={currentBadgeStyle}>{currentVersion}</span>}
          <button onClick={() => setShowAddForm((v) => !v)} style={primaryButtonStyle}>
            <MdAdd size={16} />
            New Version
          </button>
        </div>
      </div>

      {showAddForm && (
        <div style={addFormStyle}>
          <div style={addFormTitleStyle}>Add a new proposal version</div>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
            style={fileInputStyle}
          />
          <textarea
            value={newVersionNotes}
            onChange={(e) => setNewVersionNotes(e.target.value)}
            placeholder="Add notes for this version"
            style={textareaStyle}
            rows={3}
          />
          {versionMessage && <div style={messageStyle}>{versionMessage}</div>}
          <div style={formActionsStyle}>
            <button onClick={() => setShowAddForm(false)} style={secondaryButtonStyle}>
              Cancel
            </button>
            <button onClick={handleAddVersion} disabled={savingVersion} style={saveButtonStyle}>
              <MdCloudUpload size={16} />
              {savingVersion ? "Saving..." : "Save Version"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={emptyStateStyle}>Loading versions...</div>
      ) : versions.length === 0 ? (
        <div style={emptyStateStyle}>No version records yet.</div>
      ) : (
        <>
          <div style={listStyle}>
            {versions.map((version, index) => (
              <button
                key={`proposal-version-${version.id || version.versionLabel || version.versionNumber || index}-${index}`}
                onClick={() => setSelectedVersionId(version.id)}
                style={versionButtonStyle(selectedVersion?.id === version.id)}
              >
                <div style={versionTopRowStyle}>
                  <strong>{version.versionLabel || `v${version.versionNumber || 1}`}</strong>
                  {version.isLatest && <span style={latestBadgeStyle}>Latest</span>}
                </div>
                <div style={versionMetaStyle}>
                  {version.uploadedAt ? version.uploadedAt.toLocaleString() : "Unknown date"}
                </div>
                <div style={notesStyle}>{version.notes || "No notes added."}</div>
              </button>
            ))}
          </div>

          {selectedVersion && (
            <div style={detailCardStyle}>
              <div style={detailHeaderStyle}>
                <div>
                  <div style={detailVersionLabelStyle}>
                    {selectedVersion.versionLabel || `v${selectedVersion.versionNumber || 1}`}
                  </div>
                  <div style={detailMetaStyle}>
                    {selectedVersion.uploadedAt ? selectedVersion.uploadedAt.toLocaleString() : "Unknown date"}
                  </div>
                </div>
                <button
                  onClick={() => window.open(selectedVersion.downloadUrl || `/p/${btoa(selectedVersion.filePath || filePath)}`, "_blank")}
                  style={iconButtonStyle}
                  title="Open version"
                >
                  <MdOpenInNew size={16} />
                </button>
              </div>

              <div style={summaryBoxStyle}>
                <div style={summaryTitleStyle}>Change Summary</div>
                {Array.isArray(selectedVersion.changeSummary) && selectedVersion.changeSummary.length > 0 ? (
                  <ul style={summaryListStyle}>
                    {selectedVersion.changeSummary.map((item, index) => (
                      <li key={`${selectedVersion.id}-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={emptyNoteStyle}>No change summary available.</div>
                )}
              </div>

              <div style={footerActionsStyle}>
                <button onClick={() => window.open(selectedVersion.downloadUrl || `/p/${btoa(selectedVersion.filePath || filePath)}`, "_blank")} style={secondaryButtonStyle}>
                  <MdOpenInNew size={16} />
                  Open
                </button>
                <button onClick={() => window.open(selectedVersion.downloadUrl || selectedVersion.shareLink || "#", "_blank")} style={secondaryButtonStyle}>
                  <MdDownload size={16} />
                  Download
                </button>
                <button onClick={() => window.navigator.clipboard.writeText(selectedVersion.notes || "")} style={secondaryButtonStyle}>
                  <MdEventNote size={16} />
                  Copy Notes
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

const containerStyle = {
  width: "100%",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "16px",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "14px",
};

const headerTitleStyle = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
};

const titleStyle = {
  margin: 0,
  fontSize: "16px",
  color: "#0f172a",
};

const subtitleStyle = {
  margin: "4px 0 0 0",
  fontSize: "12px",
  color: "#64748b",
};

const currentBadgeStyle = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: "999px",
  padding: "4px 10px",
  fontSize: "11px",
  fontWeight: 700,
};

const listStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  marginBottom: "14px",
};

const versionButtonStyle = (active) => ({
  textAlign: "left",
  border: active ? "1px solid #1d4ed8" : "1px solid #e2e8f0",
  background: active ? "#eff6ff" : "#fff",
  borderRadius: "10px",
  padding: "12px",
  cursor: "pointer",
});

const versionTopRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "4px",
};

const latestBadgeStyle = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: "999px",
  padding: "2px 8px",
  fontSize: "10px",
  fontWeight: 700,
};

const versionMetaStyle = {
  fontSize: "11px",
  color: "#64748b",
  marginBottom: "6px",
};

const notesStyle = {
  fontSize: "12px",
  color: "#334155",
  lineHeight: 1.4,
};

const detailCardStyle = {
  borderTop: "1px solid #e2e8f0",
  paddingTop: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const detailHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
};

const detailVersionLabelStyle = {
  fontSize: "15px",
  fontWeight: 700,
  color: "#0f172a",
};

const detailMetaStyle = {
  fontSize: "12px",
  color: "#64748b",
  marginTop: "3px",
};

const iconButtonStyle = {
  width: "34px",
  height: "34px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#fff",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const summaryBoxStyle = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "12px",
};

const summaryTitleStyle = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#334155",
  marginBottom: "8px",
};

const summaryListStyle = {
  margin: 0,
  paddingLeft: "18px",
  color: "#334155",
  fontSize: "12px",
  lineHeight: 1.5,
};

const emptyNoteStyle = {
  fontSize: "12px",
  color: "#64748b",
};

const footerActionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const secondaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: "12px",
  cursor: "pointer",
};

const primaryButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "none",
  background: "#1d4ed8",
  color: "#fff",
  fontSize: "12px",
  cursor: "pointer",
};

const addFormStyle = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  borderRadius: "10px",
  padding: "12px",
  marginBottom: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "10px"
};

const addFormTitleStyle = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#1e3a8a"
};

const fileInputStyle = {
  fontSize: "12px"
};

const textareaStyle = {
  width: "100%",
  borderRadius: "8px",
  border: "1px solid #bfdbfe",
  padding: "10px",
  fontSize: "12px",
  resize: "vertical"
};

const messageStyle = {
  fontSize: "12px",
  color: "#1e40af"
};

const formActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  flexWrap: "wrap"
};

const saveButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontSize: "12px",
  cursor: "pointer"
};

const emptyStateStyle = {
  padding: "20px 0",
  fontSize: "13px",
  color: "#64748b",
};
