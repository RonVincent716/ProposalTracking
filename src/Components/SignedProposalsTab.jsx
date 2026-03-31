import { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { MdCheckCircleOutline, MdDescription, MdVisibility, MdDelete, MdFilterList, MdSearch, MdClose, MdRefresh, MdWarning } from "react-icons/md";
import { useNavigate } from "react-router-dom";

const SignedProposalsTab = ({ user }) => {
  const navigate = useNavigate();
  const [signedProposals, setSignedProposals] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProposals, setSelectedProposals] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const itemsPerPage = 10;

  // Listen to signed proposals
  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    const q = query(
      collection(db, "signedProposals"),
      orderBy("signedAt", "desc")
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        signedAt: doc.data().signedAt?.toDate?.() || new Date()
      }));
      setSignedProposals(data);
      setLoading(false);
    });
    
    return () => unsub();
  }, [user]);

  // Filter signed proposals based on search
  const filteredProposals = useMemo(() => {
    if (!searchTerm) return signedProposals;
    
    const term = searchTerm.toLowerCase();
    return signedProposals.filter(proposal =>
      (proposal.proposalName || proposal.fileName || "").toLowerCase().includes(term) ||
      (proposal.signedBy || "").toLowerCase().includes(term) ||
      (proposal.signerEmail || "").toLowerCase().includes(term)
    );
  }, [signedProposals, searchTerm]);

  // Paginate proposals
  const paginatedProposals = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProposals.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProposals, currentPage]);

  const totalPages = Math.ceil(filteredProposals.length / itemsPerPage);

  // Selection functions
  const selectAll = useCallback((checked) => {
    if (checked) {
      setSelectedProposals(paginatedProposals.map(p => p.id));
    } else {
      setSelectedProposals([]);
    }
  }, [paginatedProposals]);

  const toggleSelection = useCallback((proposalId) => {
    setSelectedProposals(prev => 
      prev.includes(proposalId) ? prev.filter(id => id !== proposalId) : [...prev, proposalId]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedProposals([]);
  }, []);

  // Delete functions
  const handleDeleteSingle = useCallback((proposalId, proposalName) => {
    setDeleteItem({ id: proposalId, name: proposalName, type: "single" });
    setShowDeleteModal(true);
  }, []);

  const handleDeleteBulk = useCallback(() => {
    if (selectedProposals.length === 0) return;
    setDeleteType("bulk");
    setShowDeleteModal(true);
  }, [selectedProposals]);

  const confirmDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      if (deleteItem) {
        // Delete single proposal
        await deleteDoc(doc(db, "signedProposals", deleteItem.id));
        setDeleteSuccess(`Successfully deleted "${deleteItem.name}"`);
        // Remove from selection if present
        setSelectedProposals(prev => prev.filter(id => id !== deleteItem.id));
      } else if (deleteType === "bulk" && selectedProposals.length > 0) {
        // Delete multiple proposals
        const batch = writeBatch(db);
        selectedProposals.forEach(id => {
          const docRef = doc(db, "signedProposals", id);
          batch.delete(docRef);
        });
        await batch.commit();
        setDeleteSuccess(`Successfully deleted ${selectedProposals.length} signed proposal(s)`);
        setSelectedProposals([]);
      }
      
      // Close modal and reset
      setShowDeleteModal(false);
      setDeleteItem(null);
      setDeleteType(null);
      
      // Auto hide success message after 3 seconds
      setTimeout(() => {
        setDeleteSuccess(null);
      }, 3000);
      
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Error deleting: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteItem, deleteType, selectedProposals]);

  const handleViewDetails = useCallback((proposal) => {
    if (proposal.id) {
      navigate(`/signed/${proposal.id}`);
    } else if (proposal.proposalPath) {
      const encoded = btoa(proposal.proposalPath);
      navigate(`/signed/${proposal.id || encoded}`);
    }
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    setSearchTerm("");
    setCurrentPage(1);
    setSelectedProposals([]);
  }, []);

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Delete Confirmation Modal
  const DeleteModal = () => {
    if (!showDeleteModal) return null;
    
    return (
      <div style={styles.modalOverlay} onClick={() => !isDeleting && setShowDeleteModal(false)}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div style={styles.modalIcon}>
            <MdWarning size={48} color="#f57c00" />
          </div>
          <h3 style={styles.modalTitle}>Confirm Delete</h3>
          <p style={styles.modalText}>
            {deleteItem ? (
              <>Are you sure you want to delete "<strong>{deleteItem.name}</strong>"?</>
            ) : deleteType === "bulk" ? (
              <>Are you sure you want to delete <strong>{selectedProposals.length}</strong> selected signed proposal(s)?</>
            ) : null}
          </p>
          <p style={styles.modalWarning}>This action cannot be undone!</p>
          <div style={styles.modalButtons}>
            <button
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              style={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={isDeleting}
              style={styles.deleteButton}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Success Toast
  const SuccessToast = () => {
    if (!deleteSuccess) return null;
    
    return (
      <div style={styles.toast}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span>{deleteSuccess}</span>
        <button onClick={() => setDeleteSuccess(null)} style={styles.toastClose}>
          <MdClose size={14} />
        </button>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading signed proposals...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          <MdCheckCircleOutline size={28} color="#10B981" />
          Signed Proposals
        </h2>
        <div style={styles.headerStats}>
          <div style={styles.statsBadge}>
            <span>Total Signed</span>
            <strong>{signedProposals.length}</strong>
          </div>
          {selectedProposals.length > 0 && (
            <>
              <button onClick={clearSelection} style={styles.clearButton}>
                Clear ({selectedProposals.length})
              </button>
              <button onClick={handleDeleteBulk} style={styles.bulkDeleteButton}>
                <MdDelete size={18} />
                Delete Selected
              </button>
            </>
          )}
          <button onClick={handleRefresh} style={styles.refreshButton} title="Refresh">
            <MdRefresh size={18} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={styles.searchContainer}>
        <div style={styles.searchWrapper}>
          <MdSearch size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by proposal name, signer, or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} style={styles.clearSearchButton}>
              <MdClose size={16} />
            </button>
          )}
        </div>
        <span style={styles.searchResult}>
          {filteredProposals.length} found
        </span>
      </div>

      {/* Filter Info */}
      {searchTerm && (
        <div style={styles.filterInfo}>
          <MdFilterList size={14} />
          <span>Showing results for: "<strong>{searchTerm}</strong>"</span>
        </div>
      )}

      {/* Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.checkboxTh}>
                <input
                  type="checkbox"
                  onChange={(e) => selectAll(e.target.checked)}
                  checked={selectedProposals.length === paginatedProposals.length && paginatedProposals.length > 0}
                  disabled={paginatedProposals.length === 0}
                />
              </th>
              <th style={styles.th}>Proposal</th>
              <th style={styles.th}>Signed By</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Date Signed</th>
              <th style={styles.th}>Actions</th>
             </tr>
          </thead>
          <tbody>
            {paginatedProposals.map((proposal, i) => (
              <tr key={proposal.id || i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                <td style={styles.checkboxTd}>
                  <input
                    type="checkbox"
                    checked={selectedProposals.includes(proposal.id)}
                    onChange={() => toggleSelection(proposal.id)}
                  />
                </td>
                <td style={styles.td}>
                  <div style={styles.proposalCell}>
                    <MdDescription size={18} color="#10B981" />
                    <span title={proposal.proposalName || proposal.fileName}>
                      {proposal.proposalName || proposal.fileName || 'Unknown'}
                    </span>
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={styles.signerName}>
                    {proposal.signedBy || 'Unknown'}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={styles.signerEmail}>
                    {proposal.signerEmail || 'N/A'}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={styles.dateBadge}>
                    {formatDate(proposal.signedAt)}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={styles.actionButtons}>
                    <button
                      onClick={() => handleViewDetails(proposal)}
                      style={styles.viewButton}
                      title="View Details"
                    >
                      <MdVisibility size={14} />
                      View
                    </button>
                    <button
                      onClick={() => handleDeleteSingle(proposal.id, proposal.proposalName || proposal.fileName)}
                      style={styles.deleteButton}
                      title="Delete"
                    >
                      <MdDelete size={14} />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {signedProposals.length === 0 && (
              <tr>
                <td colSpan={6} style={styles.emptyState}>
                  <div style={styles.emptyStateContent}>
                    <MdCheckCircleOutline size={48} color="#cbd5e1" />
                    <p>No signed proposals yet</p>
                    <span>Signed proposals will appear here when clients sign them</span>
                  </div>
                </td>
              </tr>
            )}
            {filteredProposals.length === 0 && searchTerm && (
              <tr>
                <td colSpan={6} style={styles.emptyState}>
                  <div style={styles.emptyStateContent}>
                    <MdSearch size={48} color="#cbd5e1" />
                    <p>No matching signed proposals found</p>
                    <span>Try a different search term</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={styles.paginationButton(currentPage === 1)}
          >
            Previous
          </button>
          
          <div style={styles.pageNumbers}>
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
                  onClick={() => setCurrentPage(pageNum)}
                  style={styles.pageNumber(currentPage === pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={styles.paginationButton(currentPage === totalPages)}
          >
            Next
          </button>
        </div>
      )}

      {/* Modals */}
      <DeleteModal />
      <SuccessToast />
    </div>
  );
};

const styles = {
  container: {
    padding: "20px",
    background: "#f8fafc",
    minHeight: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: 0,
    fontSize: "24px",
    fontWeight: "600",
    color: "#1e293b",
  },
  headerStats: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  statsBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    background: "#f0fdf4",
    borderRadius: "100px",
    border: "1px solid #bbf7d0",
    fontSize: "13px",
    color: "#166534",
  },
  clearButton: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    transition: "all 0.2s",
  },
  bulkDeleteButton: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    transition: "all 0.2s",
  },
  refreshButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    background: "#fff",
    color: "#64748b",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  searchContainer: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
  searchWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#fff",
    padding: "10px 16px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: "14px",
    background: "transparent",
  },
  clearSearchButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    borderRadius: "4px",
  },
  searchResult: {
    fontSize: "13px",
    color: "#64748b",
    fontWeight: "500",
    whiteSpace: "nowrap",
  },
  filterInfo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    background: "#e3f2fd",
    borderRadius: "8px",
    marginBottom: "16px",
    fontSize: "13px",
    color: "#1976d2",
  },
  tableContainer: {
    width: "100%",
    overflowX: "auto",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "700px",
  },
  tableHeader: {
    background: "linear-gradient(90deg, #10b981 0%, #059669 100%)",
    color: "#fff",
  },
  th: {
    padding: "14px 12px",
    textAlign: "center",
    fontSize: "13px",
    fontWeight: "600",
  },
  checkboxTh: {
    padding: "14px 12px",
    width: "40px",
    textAlign: "center",
  },
  td: {
    padding: "12px 12px",
    borderBottom: "1px solid #e2e8f0",
    textAlign: "center",
    fontSize: "13px",
    verticalAlign: "middle",
  },
  checkboxTd: {
    padding: "12px 12px",
    textAlign: "center",
  },
  rowEven: {
    background: "#fff",
  },
  rowOdd: {
    background: "#f8fafc",
  },
  proposalCell: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textAlign: "left",
  },
  signerName: {
    fontWeight: "500",
    color: "#334155",
  },
  signerEmail: {
    color: "#64748b",
    fontSize: "12px",
  },
  dateBadge: {
    display: "inline-block",
    padding: "4px 8px",
    background: "#f1f5f9",
    borderRadius: "6px",
    fontSize: "11px",
    color: "#475569",
  },
  actionButtons: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  viewButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 12px",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  deleteButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 12px",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
  },
  emptyStateContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    color: "#94a3b8",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    marginTop: "24px",
    padding: "16px 0",
    flexWrap: "wrap",
  },
  paginationButton: (disabled) => ({
    padding: "8px 20px",
    borderRadius: "8px",
    border: "none",
    background: disabled ? "#e2e8f0" : "#fff",
    color: disabled ? "#94a3b8" : "#10b981",
    fontSize: "13px",
    fontWeight: "600",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 1px 2px rgba(0,0,0,0.05)",
    transition: "all 0.2s",
  }),
  pageNumbers: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pageNumber: (isActive) => ({
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    border: "none",
    background: isActive ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "#fff",
    color: isActive ? "#fff" : "#64748b",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: isActive ? "0 2px 8px rgba(16, 185, 129, 0.3)" : "0 1px 2px rgba(0,0,0,0.05)",
    transition: "all 0.2s",
  }),
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: "16px",
    padding: "32px",
    maxWidth: "400px",
    width: "90%",
    textAlign: "center",
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
  },
  modalIcon: {
    marginBottom: "16px",
  },
  modalTitle: {
    margin: "0 0 8px 0",
    fontSize: "20px",
    fontWeight: "600",
    color: "#1e293b",
  },
  modalText: {
    margin: "0 0 8px 0",
    fontSize: "14px",
    color: "#64748b",
    lineHeight: "1.5",
  },
  modalWarning: {
    margin: "0 0 24px 0",
    fontSize: "13px",
    color: "#ef4444",
    fontWeight: "500",
  },
  modalButtons: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
  },
  cancelButton: {
    padding: "10px 24px",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    color: "#64748b",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  deleteButton: {
    padding: "10px 24px",
    background: "#ef4444",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  toast: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 20px",
    background: "#10b981",
    color: "#fff",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 1001,
    animation: "slideIn 0.3s ease",
  },
  toastClose: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    opacity: 0.7,
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    gap: "16px",
    color: "#64748b",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #10b981",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};

// Add animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default SignedProposalsTab;