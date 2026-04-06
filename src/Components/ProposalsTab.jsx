// src/components/ProposalsTab.jsx
import { useState, useEffect } from "react";
import { storage, auth, db } from "../firebase";
import { ref, listAll, getDownloadURL, deleteObject } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc, 
  writeBatch 
} from "firebase/firestore";
import { 
  MdDescription, 
  MdVisibility, 
  MdFileUpload, 
  MdEmail, 
  MdEdit, 
  MdDelete,
  MdPictureAsPdf,
  MdWarning,
  MdClose,
  MdCheckCircle,
  MdCancel,
  MdSearch,
  MdRefresh
} from "react-icons/md";
import ProposalStatusBadge from "./ProposalStatusBadge";

export default function ProposalsTab({ user, onShareClick, onSignClick, onViewClick, onDownloadClick }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [proposalsPerPage] = useState(10);
  const [signedProposals, setSignedProposals] = useState([]);
  const [views, setViews] = useState([]);
  
  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (user) {
      loadProposals();
      loadSignedProposals();
      loadViews();
    }
  }, [user]);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const proposalsRef = ref(storage, 'proposals');
      const fileList = await listAll(proposalsRef);
      setFiles(fileList.items);
    } catch (error) {
      console.error("Error loading proposals:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSignedProposals = async () => {
    try {
      const q = query(
        collection(db, "signedProposals"),
        where("signerEmail", "==", user?.email)
      );
      const snapshot = await getDocs(q);
      const signed = [];
      snapshot.forEach(doc => {
        signed.push(doc.data());
      });
      setSignedProposals(signed);
    } catch (error) {
      console.error("Error loading signed proposals:", error);
    }
  };

  const loadViews = async () => {
    try {
      const viewsQuery = query(collection(db, "proposalViews"));
      const snapshot = await getDocs(viewsQuery);
      const viewsData = [];
      snapshot.forEach(doc => {
        viewsData.push(doc.data());
      });
      setViews(viewsData);
    } catch (error) {
      console.error("Error loading views:", error);
    }
  };

  const getViewCount = (fileName) => {
    return views.filter(v => v.fileName === fileName).length;
  };

  const handleDeleteClick = (file) => {
    setProposalToDelete(file);
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!proposalToDelete) return;
    
    setDeleting(true);
    setDeleteError(null);
    
    try {
      const filePath = `proposals/${proposalToDelete.name}`;
      
      // 1. Delete from Firebase Storage
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
      console.log("✅ Deleted from storage:", filePath);
      
      // 2. Delete from Firestore proposals collection
      const proposalsQuery = query(
        collection(db, "proposals"),
        where("filePath", "==", filePath)
      );
      const proposalsSnapshot = await getDocs(proposalsQuery);
      
      // 3. Delete from sharedProposals
      const sharedQuery = query(
        collection(db, "sharedProposals"),
        where("filePath", "==", filePath)
      );
      const sharedSnapshot = await getDocs(sharedQuery);
      
      // 4. Delete from proposalPageTracking
      const trackingQuery = query(
        collection(db, "proposalPageTracking"),
        where("proposalId", "==", filePath)
      );
      const trackingSnapshot = await getDocs(trackingQuery);
      
      // 5. Delete from proposalViews
      const viewsQuery = query(
        collection(db, "proposalViews"),
        where("proposalId", "==", filePath)
      );
      const viewsSnapshot = await getDocs(viewsQuery);
      
      // Use batch delete for all Firestore documents
      const batch = writeBatch(db);
      
      proposalsSnapshot.forEach(doc => batch.delete(doc.ref));
      sharedSnapshot.forEach(doc => batch.delete(doc.ref));
      trackingSnapshot.forEach(doc => batch.delete(doc.ref));
      viewsSnapshot.forEach(doc => batch.delete(doc.ref));
      
      await batch.commit();
      console.log("✅ Deleted all related Firestore records");
      
      setDeleteSuccess(`Successfully deleted "${proposalToDelete.name}"`);
      
      // Refresh the proposals list
      await loadProposals();
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setDeleteSuccess(null);
        setShowDeleteModal(false);
        setProposalToDelete(null);
      }, 2000);
      
    } catch (error) {
      console.error("Error deleting proposal:", error);
      setDeleteError(error.message || "Failed to delete proposal");
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setProposalToDelete(null);
    setDeleteError(null);
  };

  // Filter proposals based on search
  const filteredProposals = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const indexOfLastProposal = currentPage * proposalsPerPage;
  const indexOfFirstProposal = indexOfLastProposal - proposalsPerPage;
  const currentProposals = filteredProposals.slice(indexOfFirstProposal, indexOfLastProposal);
  const totalPages = Math.ceil(filteredProposals.length / proposalsPerPage);

  const goToPage = (page) => {
    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  if (loading) {
    return (
      <div style={loadingContainer}>
        <div className="proposals-spinner"></div>
        <p>Loading proposals...</p>
        <style>{`
          .proposals-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #00D4FF;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>
          <MdPictureAsPdf size={28} color="#1976D2" />
          Uploaded Proposals
        </h2>
        <button onClick={loadProposals} style={refreshButtonStyle} title="Refresh">
          <MdRefresh size={18} />
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div style={searchContainerStyle}>
        <div style={searchWrapperStyle}>
          <MdSearch size={18} color="#999" />
          <input
            type="text"
            placeholder="Search proposals by name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={searchInputStyle}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} style={clearSearchStyle}>
              ✕
            </button>
          )}
        </div>
        <div style={resultCountStyle}>
          {filteredProposals.length} {filteredProposals.length === 1 ? 'proposal' : 'proposals'} found
        </div>
      </div>

      {/* Proposals Table */}
      <div style={tableContainerStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={headerRowStyle}>
              <th style={thStyle}>File</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Views</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentProposals.length === 0 ? (
              <tr>
                <td colSpan="4" style={emptyCellStyle}>
                  <div style={emptyStateStyle}>
                    <MdDescription size={48} color="#ccc" />
                    <p>No proposals found</p>
                    <p style={emptyHintStyle}>Upload your first proposal using the Upload tab</p>
                  </div>
                </td>
              </tr>
            ) : (
              currentProposals.map((file, index) => {
                const isSigned = signedProposals.some(p => 
                  p.proposalName === file.name || p.proposalPath?.includes(file.name)
                );
                const viewCount = getViewCount(file.name);
                
                return (
                  <tr key={index} style={index % 2 === 0 ? rowEvenStyle : rowOddStyle}>
                    <td style={tdStyle}>
                      <div style={fileNameStyle}>
                        <MdDescription color={isSigned ? "#10B981" : "#1976D2"} size={18} />
                        <span style={fileNameTextStyle}>{file.name}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <ProposalStatusBadge status={isSigned ? "signed" : "pending"} size="small" />
                    </td>
                    <td style={tdStyle}>
                      <div style={viewCountStyle}>
                        <MdVisibility size={14} color="#666" />
                        <span>{viewCount}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={actionsStyle}>
                        <button
                          onClick={() => onViewClick?.(file)}
                          style={actionButtonStyle("#2196F3")}
                          title="View Proposal"
                        >
                          <MdVisibility size={14} /> View
                        </button>
                        <button
                          onClick={() => onDownloadClick?.(file)}
                          style={actionButtonStyle("#4CAF50")}
                          title="Download"
                        >
                          <MdFileUpload size={14} /> Download
                        </button>
                        <button
                          onClick={() => onShareClick?.(file)}
                          style={actionButtonStyle("#FF9800")}
                          title="Share with Client"
                        >
                          <MdEmail size={14} /> Share
                        </button>
                        <button
                          onClick={() => onSignClick?.(file)}
                          style={actionButtonStyle("#10B981")}
                          title="Sign Proposal"
                        >
                          <MdEdit size={14} /> Sign
                        </button>
                        <button
                          onClick={() => handleDeleteClick(file)}
                          style={actionButtonStyle("#DC2626")}
                          title="Delete Proposal"
                        >
                          <MdDelete size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={paginationStyle}>
          <button
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            style={paginationButtonStyle(currentPage === 1)}
          >
            Previous
          </button>
          <div style={pageNumbersStyle}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  style={pageNumberStyle(currentPage === pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            style={paginationButtonStyle(currentPage === totalPages)}
          >
            Next
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && proposalToDelete && (
        <div style={modalOverlay} onClick={cancelDelete}>
          <div style={deleteModalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={deleteModalHeaderStyle}>
              <MdWarning size={28} color="#DC2626" />
              <h3 style={deleteModalTitleStyle}>Confirm Delete</h3>
              <button onClick={cancelDelete} style={deleteModalCloseStyle}>
                <MdClose size={20} />
              </button>
            </div>
            <div style={deleteModalBodyStyle}>
              <p>Are you sure you want to delete this proposal?</p>
              <div style={deleteProposalNameStyle}>
                <strong>{proposalToDelete.name}</strong>
              </div>
              <div style={deleteWarningStyle}>
                <MdWarning size={16} color="#F59E0B" />
                <span>This action cannot be undone. This will permanently delete:</span>
              </div>
              <ul style={deleteListStyle}>
                <li>The PDF file from storage</li>
                <li>All view tracking data</li>
                <li>All shared links</li>
                <li>Proposal metadata</li>
              </ul>
              {deleteError && (
                <div style={deleteErrorStyle}>
                  <MdWarning size={16} />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>
            <div style={deleteModalFooterStyle}>
              <button onClick={cancelDelete} style={cancelButtonStyle} disabled={deleting}>
                <MdCancel size={18} />
                Cancel
              </button>
              <button onClick={confirmDelete} style={confirmButtonStyle} disabled={deleting}>
                {deleting ? (
                  <>
                    <div className="delete-spinner"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <MdDelete size={18} />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {deleteSuccess && (
        <div style={toastSuccessStyle}>
          <MdCheckCircle size={20} color="#10B981" />
          <span>{deleteSuccess}</span>
        </div>
      )}

      <style>{`
        .delete-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #fff;
          border-top: 2px solid transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          display: inline-block;
          margin-right: 6px;
        }
      `}</style>
    </div>
  );
}

// Styles
const containerStyle = {
  padding: "20px",
  fontFamily: "'Inter', system-ui, sans-serif",
};

const loadingContainer = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "60px",
  gap: "20px",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
  flexWrap: "wrap",
  gap: "10px",
};

const titleStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: "20px",
  fontWeight: "600",
  margin: 0,
};

const refreshButtonStyle = {
  padding: "8px 16px",
  background: "#fff",
  border: "1px solid #ddd",
  borderRadius: "8px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
};

const searchContainerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "20px",
  flexWrap: "wrap",
  gap: "15px",
};

const searchWrapperStyle = {
  display: "flex",
  alignItems: "center",
  flex: 1,
  maxWidth: "400px",
  background: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: "8px",
  padding: "8px 12px",
  gap: "8px",
};

const searchInputStyle = {
  flex: 1,
  border: "none",
  outline: "none",
  fontSize: "14px",
  background: "transparent",
};

const clearSearchStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#999",
  fontSize: "14px",
};

const resultCountStyle = {
  fontSize: "13px",
  color: "#666",
};

const tableContainerStyle = {
  overflowX: "auto",
  borderRadius: "12px",
  border: "1px solid #e0e0e0",
  background: "#fff",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const headerRowStyle = {
  background: "linear-gradient(90deg, #2196F3 0%, #1976D2 100%)",
  color: "#fff",
};

const thStyle = {
  padding: "14px 12px",
  textAlign: "left",
  fontWeight: "600",
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #e0e0e0",
};

const rowEvenStyle = {
  background: "#fff",
};

const rowOddStyle = {
  background: "#f9f9f9",
};

const fileNameStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const fileNameTextStyle = {
  wordBreak: "break-all",
  fontSize: "13px",
};

const viewCountStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const actionsStyle = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
};

const actionButtonStyle = (color) => ({
  padding: "6px 12px",
  background: color,
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "11px",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  transition: "all 0.2s",
});

const emptyCellStyle = {
  padding: "60px",
  textAlign: "center",
};

const emptyStateStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
  color: "#999",
};

const emptyHintStyle = {
  fontSize: "12px",
  color: "#00D4FF",
};

const paginationStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "12px",
  marginTop: "20px",
  flexWrap: "wrap",
};

const paginationButtonStyle = (disabled) => ({
  padding: "8px 16px",
  borderRadius: "6px",
  border: "1px solid #ddd",
  background: disabled ? "#f5f5f5" : "#fff",
  color: disabled ? "#ccc" : "#1976D2",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "13px",
});

const pageNumbersStyle = {
  display: "flex",
  gap: "5px",
};

const pageNumberStyle = (active) => ({
  width: "36px",
  height: "36px",
  borderRadius: "6px",
  border: "none",
  background: active ? "linear-gradient(135deg, #1976D2 0%, #2196F3 100%)" : "#fff",
  color: active ? "#fff" : "#666",
  cursor: "pointer",
  fontSize: "13px",
});

// Modal styles
const modalOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
};

const deleteModalStyle = {
  background: "#fff",
  borderRadius: "16px",
  width: "90%",
  maxWidth: "450px",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  animation: "slideUp 0.3s ease",
};

const deleteModalHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "20px",
  background: "#FEF2F2",
  borderBottom: "1px solid #FEE2E2",
};

const deleteModalTitleStyle = {
  margin: 0,
  flex: 1,
  fontSize: "18px",
  color: "#DC2626",
};

const deleteModalCloseStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#999",
  padding: "4px",
};

const deleteModalBodyStyle = {
  padding: "20px",
};

const deleteProposalNameStyle = {
  background: "#f5f5f5",
  padding: "12px",
  borderRadius: "8px",
  margin: "12px 0",
  wordBreak: "break-all",
  fontSize: "14px",
};

const deleteWarningStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginTop: "15px",
  marginBottom: "10px",
  fontSize: "13px",
  color: "#F59E0B",
};

const deleteListStyle = {
  margin: "10px 0 0 20px",
  fontSize: "12px",
  color: "#666",
  lineHeight: "1.6",
};

const deleteErrorStyle = {
  marginTop: "15px",
  padding: "10px",
  background: "#FEF2F2",
  borderRadius: "8px",
  color: "#DC2626",
  fontSize: "12px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const deleteModalFooterStyle = {
  display: "flex",
  gap: "12px",
  padding: "20px",
  borderTop: "1px solid #e0e0e0",
  justifyContent: "flex-end",
};

const cancelButtonStyle = {
  padding: "10px 20px",
  background: "#f5f5f5",
  border: "1px solid #ddd",
  borderRadius: "8px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "14px",
};

const confirmButtonStyle = {
  padding: "10px 20px",
  background: "#DC2626",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "14px",
};

const toastSuccessStyle = {
  position: "fixed",
  bottom: "20px",
  right: "20px",
  background: "#fff",
  color: "#333",
  padding: "12px 20px",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  zIndex: 2001,
  animation: "fadeIn 0.3s ease",
  border: "1px solid #10B981",
};