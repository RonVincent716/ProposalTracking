// src/components/ProposalsTabWithDelete.jsx
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
  writeBatch,
  addDoc,
  setDoc,
  serverTimestamp
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
  MdRefresh,
  MdInfo,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdMoreVert,
  MdBlockFlipped,
  MdArchive,
  MdUnarchive
} from "react-icons/md";
import ProposalStatusBadge from "../Pages/ProposalStatusBadge";
import { usePermissions } from "../utils/permissions";
import { ActivityLogger } from "../utils/activityLogger";

export default function ProposalsTabWithDelete({ user, onViewClick, onDownloadClick, onShareClick, onSignClick }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [proposalsPerPage] = useState(10);
  const [signedProposals, setSignedProposals] = useState([]);
  const [views, setViews] = useState([]);
  const [rejectedProposals, setRejectedProposals] = useState([]);
  const [archivedProposals, setArchivedProposals] = useState([]);
  const [archiveView, setArchiveView] = useState("active");
  
  // Permission system
  const { role } = usePermissions();
  
  // Selection states
  const [selectedProposals, setSelectedProposals] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  
  // Dropdown menu states
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const canDeleteProposals = role === "admin" || role === "superadmin";

  useEffect(() => {
    if (user) {
      loadProposals();
      loadSignedProposals();
      loadViews();
      loadRejectedProposals();
      loadArchivedProposals();
    }
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdownId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!deleteSuccess) return undefined;
    const timeoutId = setTimeout(() => setDeleteSuccess(null), 3000);
    return () => clearTimeout(timeoutId);
  }, [deleteSuccess]);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const proposalsRef = ref(storage, 'proposals');
      const fileList = await listAll(proposalsRef);
      setFiles(fileList.items);
      setSelectedProposals([]);
      setSelectAll(false);
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

  const loadRejectedProposals = async () => {
    try {
      const rejectedQuery = query(collection(db, "rejectedProposals"));
      const snapshot = await getDocs(rejectedQuery);
      const rejectedData = [];
      snapshot.forEach(doc => {
        rejectedData.push(doc.data());
      });
      setRejectedProposals(rejectedData);
    } catch (error) {
      console.error("Error loading rejected proposals:", error);
    }
  };

  const loadArchivedProposals = async () => {
    try {
      const archivedQuery = query(collection(db, "archivedProposals"));
      const snapshot = await getDocs(archivedQuery);
      const archivedData = [];
      snapshot.forEach((archiveDoc) => {
        archivedData.push({
          id: archiveDoc.id,
          ...archiveDoc.data()
        });
      });
      setArchivedProposals(archivedData);
    } catch (error) {
      console.error("Error loading archived proposals:", error);
    }
  };

  const getArchiveDocId = (fileName) => encodeURIComponent(fileName);

  const isProposalArchived = (fileName) =>
    archivedProposals.some((proposal) => proposal.fileName === fileName || proposal.proposalName === fileName);

  const getViewCount = (fileName) => {
    return views.filter(v => v.fileName === fileName).length;
  };

  const getProposalStatus = (fileName) => {
    const isRejected = rejectedProposals.some(p => p.proposalName === fileName || p.fileName === fileName);
    if (isRejected) return 'rejected';
    
    const isSigned = signedProposals.some(p => p.proposalName === fileName || p.proposalPath?.includes(fileName));
    if (isSigned) return 'signed';
    
    const viewCount = getViewCount(fileName);
    if (viewCount > 0) return 'viewed';
    
    return 'pending';
  };

  const markProposalAsRejected = async (file) => {
    try {
      await addDoc(collection(db, "rejectedProposals"), {
        proposalName: file.name,
        fileName: file.name,
        filePath: `proposals/${file.name}`,
        rejectedAt: new Date(),
        rejectedBy: user?.email
      });
      await loadRejectedProposals();
      alert(`${file.name} marked as rejected`);
    } catch (error) {
      console.error("Error marking proposal as rejected:", error);
      alert("Failed to mark proposal as rejected");
    }
  };

  const activeProposals = files.filter((file) => !isProposalArchived(file.name));
  const archivedFiles = files.filter((file) => isProposalArchived(file.name));
  const visibleFiles = archiveView === "archived" ? archivedFiles : activeProposals;

  const filteredProposals = visibleFiles.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastProposal = currentPage * proposalsPerPage;
  const indexOfFirstProposal = indexOfLastProposal - proposalsPerPage;
  const currentProposals = filteredProposals.slice(indexOfFirstProposal, indexOfLastProposal);
  const totalPages = Math.ceil(filteredProposals.length / proposalsPerPage);

  const handleSelectProposal = (fileName) => {
    if (selectedProposals.includes(fileName)) {
      setSelectedProposals(selectedProposals.filter(name => name !== fileName));
    } else {
      setSelectedProposals([...selectedProposals, fileName]);
    }
  };

  const handleSelectAllOnPage = () => {
    if (selectAll) {
      const currentPageNames = currentProposals.map(p => p.name);
      setSelectedProposals(selectedProposals.filter(name => !currentPageNames.includes(name)));
      setSelectAll(false);
    } else {
      const currentPageNames = currentProposals.map(p => p.name);
      const newSelected = [...new Set([...selectedProposals, ...currentPageNames])];
      setSelectedProposals(newSelected);
      setSelectAll(true);
    }
  };

  const handleSelectAllProposals = () => {
    if (selectedProposals.length === filteredProposals.length) {
      setSelectedProposals([]);
      setSelectAll(false);
    } else {
      const allProposalNames = filteredProposals.map(p => p.name);
      setSelectedProposals(allProposalNames);
      setSelectAll(true);
    }
  };

  const resetSelection = () => {
    setSelectedProposals([]);
    setSelectAll(false);
  };

  const handleArchiveViewChange = (view) => {
    setArchiveView(view);
    setCurrentPage(1);
    resetSelection();
    setOpenDropdownId(null);
  };

  const archiveSingleProposal = async (file) => {
    const fileName = file.name;
    const filePath = `proposals/${fileName}`;

    await setDoc(doc(db, "archivedProposals", getArchiveDocId(fileName)), {
      fileName,
      proposalName: fileName,
      filePath,
      archivedAt: serverTimestamp(),
      archivedBy: user?.email || null,
      archivedByUid: user?.uid || null
    }, { merge: true });
    await ActivityLogger.logArchive(filePath, fileName);
  };

  const restoreSingleProposal = async (file) => {
    const fileName = file.name;
    const filePath = `proposals/${fileName}`;

    await deleteDoc(doc(db, "archivedProposals", getArchiveDocId(fileName)));
    await ActivityLogger.logRestore(filePath, fileName);
  };

  const runBulkArchiveAction = async (action) => {
    const filesToUpdate = files.filter((file) => selectedProposals.includes(file.name));
    const results = { success: [], failed: [] };

    for (const file of filesToUpdate) {
      try {
        if (action === "restore") {
          await restoreSingleProposal(file);
        } else {
          await archiveSingleProposal(file);
        }
        results.success.push(file.name);
      } catch (error) {
        console.error(`Error ${action === "restore" ? "restoring" : "archiving"} ${file.name}:`, error);
        results.failed.push(file.name);
      }
    }

    return results;
  };

  const handleArchiveClick = async (file) => {
    if (!canDeleteProposals) {
      alert("Only Admins and SuperAdmins can archive proposals");
      return;
    }

    try {
      await archiveSingleProposal(file);
      await loadArchivedProposals();
      resetSelection();
      setDeleteSuccess(`Archived "${file.name}"`);
    } catch (error) {
      console.error("Error archiving proposal:", error);
      alert("Failed to archive proposal");
    } finally {
      setOpenDropdownId(null);
    }
  };

  const handleRestoreClick = async (file) => {
    if (!canDeleteProposals) {
      alert("Only Admins and SuperAdmins can restore proposals");
      return;
    }

    try {
      await restoreSingleProposal(file);
      await loadArchivedProposals();
      resetSelection();
      setDeleteSuccess(`Restored "${file.name}"`);
    } catch (error) {
      console.error("Error restoring proposal:", error);
      alert("Failed to restore proposal");
    } finally {
      setOpenDropdownId(null);
    }
  };

  const handleBulkArchiveClick = async () => {
    if (!canDeleteProposals) {
      alert("Only Admins and SuperAdmins can archive proposals");
      return;
    }

    if (selectedProposals.length === 0) {
      alert(`Please select at least one proposal to ${archiveView === "archived" ? "restore" : "archive"}`);
      return;
    }

    const action = archiveView === "archived" ? "restore" : "archive";

    try {
      const results = await runBulkArchiveAction(action);
      await loadArchivedProposals();
      resetSelection();
      const verb = action === "restore" ? "restored" : "archived";
      setDeleteSuccess(
        results.failed.length === 0
          ? `Successfully ${verb} ${results.success.length} proposal${results.success.length !== 1 ? "s" : ""}`
          : `${results.success.length} ${verb}, ${results.failed.length} failed`
      );
    } catch (error) {
      console.error(`Error running bulk ${action}:`, error);
      alert(`Failed to ${action} selected proposals`);
    }
  };

  const handleDeleteClick = (file) => {
    // Check if user has delete permissions
    if (!canDeleteProposals) {
      alert("Only Admins and SuperAdmins can delete proposals");
      return;
    }
    
    setProposalToDelete(file);
    setIsBulkDelete(false);
    setShowDeleteModal(true);
    setDeleteError(null);
    setOpenDropdownId(null);
  };

  const handleBulkDeleteClick = () => {
    // Check if user has delete permissions
    if (!canDeleteProposals) {
      alert("Only Admins and SuperAdmins can delete proposals");
      return;
    }
    
    if (selectedProposals.length === 0) {
      alert("Please select at least one proposal to delete");
      return;
    }
    setIsBulkDelete(true);
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  const deleteSingleProposal = async (file) => {
    const fileName = file.name;
    const filePath = `proposals/${fileName}`;
    
    console.log("Deleting proposal:", fileName);
    
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
    console.log("✅ Deleted from storage:", filePath);
    
    const proposalsQuery = query(
      collection(db, "proposals"),
      where("filePath", "==", filePath)
    );
    const proposalsSnapshot = await getDocs(proposalsQuery);
    
    const sharedQuery = query(
      collection(db, "sharedProposals"),
      where("filePath", "==", filePath)
    );
    const sharedSnapshot = await getDocs(sharedQuery);
    
    const trackingQuery = query(
      collection(db, "proposalPageTracking"),
      where("proposalId", "==", filePath)
    );
    const trackingSnapshot = await getDocs(trackingQuery);
    
    const trackingAltQuery = query(
      collection(db, "proposalPageTracking"),
      where("proposalId", "==", fileName)
    );
    const trackingAltSnapshot = await getDocs(trackingAltQuery);
    
    const viewsQuery = query(
      collection(db, "proposalViews"),
      where("proposalId", "==", filePath)
    );
    const viewsSnapshot = await getDocs(viewsQuery);
    
    const viewsAltQuery = query(
      collection(db, "proposalViews"),
      where("proposalId", "==", fileName)
    );
    const viewsAltSnapshot = await getDocs(viewsAltQuery);
    
    const sessionsQuery = query(
      collection(db, "proposalSessions"),
      where("filePath", "==", filePath)
    );
    const sessionsSnapshot = await getDocs(sessionsQuery);
    
    const batch = writeBatch(db);
    
    proposalsSnapshot.forEach(doc => batch.delete(doc.ref));
    sharedSnapshot.forEach(doc => batch.delete(doc.ref));
    trackingSnapshot.forEach(doc => batch.delete(doc.ref));
    trackingAltSnapshot.forEach(doc => batch.delete(doc.ref));
    viewsSnapshot.forEach(doc => batch.delete(doc.ref));
    viewsAltSnapshot.forEach(doc => batch.delete(doc.ref));
    sessionsSnapshot.forEach(doc => batch.delete(doc.ref));
    batch.delete(doc(db, "archivedProposals", getArchiveDocId(fileName)));
    
    await batch.commit();
    await ActivityLogger.logDelete(filePath, fileName);
    console.log("✅ Deleted all related Firestore records for:", fileName);
  };

  const deleteMultipleProposals = async () => {
    const filesToDelete = files.filter(file => selectedProposals.includes(file.name));
    const results = { success: [], failed: [] };
    
    for (const file of filesToDelete) {
      try {
        await deleteSingleProposal(file);
        results.success.push(file.name);
      } catch (error) {
        console.error(`Error deleting ${file.name}:`, error);
        results.failed.push(file.name);
      }
    }
    
    return results;
  };

  const confirmDelete = async () => {
    if (!canDeleteProposals) {
      setDeleteError("Only Admins and SuperAdmins can delete proposals");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      if (isBulkDelete) {
        const results = await deleteMultipleProposals();
        
        if (results.failed.length === 0) {
          setDeleteSuccess(`Successfully deleted ${results.success.length} proposal${results.success.length !== 1 ? 's' : ''}`);
        } else {
          setDeleteSuccess(`Deleted ${results.success.length} proposal${results.success.length !== 1 ? 's' : ''}, failed to delete ${results.failed.length}`);
        }
        
        setSelectedProposals([]);
        setSelectAll(false);
      } else {
        await deleteSingleProposal(proposalToDelete);
        setDeleteSuccess(`Successfully deleted "${proposalToDelete.name}"`);
      }
      
      await loadProposals();
      await loadArchivedProposals();
      
      setTimeout(() => {
        setDeleteSuccess(null);
        setShowDeleteModal(false);
        setProposalToDelete(null);
        setIsBulkDelete(false);
      }, 2000);
      
    } catch (error) {
      console.error("Error deleting proposal:", error);
      setDeleteError(error.message || "Failed to delete proposal");
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setProposalToDelete(null);
    setIsBulkDelete(false);
    setDeleteError(null);
  };

  const goToPage = (page) => {
    setCurrentPage(page);
    setSelectAll(false);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setSelectAll(false);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      setSelectAll(false);
    }
  };

  const toggleDropdown = (e, fileId) => {
    e.stopPropagation();
    setOpenDropdownId(openDropdownId === fileId ? null : fileId);
  };

  const handleDropdownAction = (e, action, file) => {
    e.stopPropagation();
    setOpenDropdownId(null);
    
    switch(action) {
      case 'share':
        onShareClick?.(file);
        break;
      case 'sign':
        onSignClick?.(file);
        break;
      case 'archive':
        handleArchiveClick(file);
        break;
      case 'restore':
        handleRestoreClick(file);
        break;
      case 'delete':
        handleDeleteClick(file);
        break;
      default:
        break;
    }
  };

  // ========== CLEAN BUTTON STYLES ==========
  
  const primaryButtonStyle = (color) => ({
    padding: "7px 14px",
    background: `${color}0D`,
    color: color,
    border: `1px solid ${color}20`,
    borderRadius: "20px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    fontFamily: "'Inter', system-ui, sans-serif",
  });

  const threeDotButtonStyle = {
    width: "34px",
    height: "34px",
    padding: "0",
    background: "#F8FAFC",
    color: "#64748B",
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
  };

  const dropdownMenuStyle = {
    position: "absolute",
    top: "40px",
    right: "0",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.02)",
    border: "1px solid #E2E8F0",
    minWidth: "160px",
    zIndex: 100,
    overflow: "hidden",
    animation: "dropdownFadeIn 0.2s ease",
  };

  const dropdownItemStyle = (color) => ({
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    color: color,
    transition: "all 0.2s ease",
    borderBottom: "1px solid #F1F5F9",
  });

  if (loading) {
    return (
      <div style={loadingContainer}>
        <div className="proposals-spinner"></div>
        <p>Loading proposals...</p>
        <style>{`
          .proposals-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e2e8f0;
            border-top: 3px solid #00D4FF;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes dropdownFadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={titleStyle}>
          <MdPictureAsPdf size={28} color="#1976D2" />
          Uploaded Proposals
        </h2>
        <div style={headerButtonsStyle}>
          {selectedProposals.length > 0 && canDeleteProposals && (
            <button onClick={handleBulkArchiveClick} style={bulkArchiveButtonStyle}>
              {archiveView === "archived" ? <MdUnarchive size={16} /> : <MdArchive size={16} />}
              {archiveView === "archived" ? "Restore" : "Archive"} ({selectedProposals.length})
            </button>
          )}
          {selectedProposals.length > 0 && canDeleteProposals && (
            <button onClick={handleBulkDeleteClick} style={bulkDeleteButtonStyle}>
              <MdDelete size={16} />
              Delete ({selectedProposals.length})
            </button>
          )}
          <button onClick={loadProposals} style={refreshButtonStyle} title="Refresh">
            <MdRefresh size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div style={archiveTabsStyle}>
        <button
          onClick={() => handleArchiveViewChange("active")}
          style={archiveTabButtonStyle(archiveView === "active")}
        >
          Active
          <span style={archiveTabCountStyle}>{activeProposals.length}</span>
        </button>
        <button
          onClick={() => handleArchiveViewChange("archived")}
          style={archiveTabButtonStyle(archiveView === "archived")}
        >
          Archived
          <span style={archiveTabCountStyle}>{archivedFiles.length}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div style={searchContainerStyle}>
        <div style={searchWrapperStyle}>
          <MdSearch size={18} color="#94A3B8" />
          <input
            type="text"
            placeholder="Search proposals by name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
              setSelectAll(false);
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
          {filteredProposals.length} {archiveView === "archived" ? "archived " : ""}{filteredProposals.length === 1 ? 'proposal' : 'proposals'} found
        </div>
      </div>

      {/* Select All Controls */}
      <div style={selectAllContainerStyle}>
        <div style={selectAllLeftStyle}>
          <button onClick={handleSelectAllOnPage} style={selectButtonStyle}>
            {selectAll ? <MdCheckBox size={16} /> : <MdCheckBoxOutlineBlank size={16} />}
            {selectAll ? "Deselect Page" : "Select Page"}
          </button>
          <button onClick={handleSelectAllProposals} style={selectButtonStyle}>
            {selectedProposals.length === filteredProposals.length && filteredProposals.length > 0 ? 
              <MdCheckBox size={16} /> : <MdCheckBoxOutlineBlank size={16} />}
            {selectedProposals.length === filteredProposals.length && filteredProposals.length > 0 ? 
              "Deselect All" : "Select All"}
          </button>
        </div>
        {selectedProposals.length > 0 && (
          <div style={selectedCountStyle}>
            {selectedProposals.length} selected
          </div>
        )}
      </div>

      {/* Success Toast */}
      {deleteSuccess && (
        <div style={toastSuccessStyle}>
          <MdCheckCircle size={18} color="#10B981" />
          <span>{deleteSuccess}</span>
        </div>
      )}

      {/* Proposals Table */}
      <div style={tableContainerStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={headerRowStyle}>
              <th style={checkboxThStyle}>
                <input
                  type="checkbox"
                  checked={selectAll && currentProposals.length > 0}
                  onChange={handleSelectAllOnPage}
                  title="Select all on current page"
                />
              </th>
              <th style={thStyle}>File</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Views</th>
              <th style={thStyle}>Actions</th>
             </tr>
          </thead>
          <tbody>
            {currentProposals.length === 0 ? (
              <tr>
                <td colSpan="5" style={emptyCellStyle}>
                  <div style={emptyStateStyle}>
                    <MdDescription size={48} color="#CBD5E1" />
                    <p>No proposals found</p>
                    <p style={emptyHintStyle}>
                      {archiveView === "archived"
                        ? "Archived proposals will appear here"
                        : "Upload your first proposal using the Upload tab"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              currentProposals.map((file, index) => {
                const isArchived = archiveView === "archived";
                const status = isArchived ? "archived" : getProposalStatus(file.name);
                const isSigned = status === 'signed';
                const viewCount = getViewCount(file.name);
                const isSelected = selectedProposals.includes(file.name);
                const fileId = file.name.replace(/[^a-zA-Z0-9]/g, '_');
                
                return (
                  <tr key={index} style={index % 2 === 0 ? rowEvenStyle : rowOddStyle}>
                    <td style={checkboxTdStyle}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectProposal(file.name)}
                      />
                    </td>
                    <td style={tdStyle}>
                      <div style={fileNameStyle}>
                        <MdDescription color={isSigned ? "#10B981" : "#1976D2"} size={18} />
                        <span style={fileNameTextStyle}>{file.name}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <ProposalStatusBadge status={status} size="small" />
                    </td>
                    <td style={tdStyle}>
                      <div style={viewCountStyle}>
                        <MdVisibility size={14} color="#94A3B8" />
                        <span>{viewCount}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={actionsStyle}>
                        {/* PRIMARY BUTTONS - Always visible */}
                        <button
                          onClick={() => onViewClick?.(file)}
                          style={primaryButtonStyle("#3B82F6")}
                          title="View Proposal"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#3B82F6";
                            e.currentTarget.style.color = "#fff";
                            e.currentTarget.style.borderColor = "#3B82F6";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#3B82F60D";
                            e.currentTarget.style.color = "#3B82F6";
                            e.currentTarget.style.borderColor = "#3B82F620";
                          }}
                        >
                          <MdVisibility size={14} /> View
                        </button>
                        
                        <button
                          onClick={() => onDownloadClick?.(file)}
                          style={primaryButtonStyle("#10B981")}
                          title="Download"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#10B981";
                            e.currentTarget.style.color = "#fff";
                            e.currentTarget.style.borderColor = "#10B981";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#10B9810D";
                            e.currentTarget.style.color = "#10B981";
                            e.currentTarget.style.borderColor = "#10B98120";
                          }}
                        >
                          <MdFileUpload size={14} /> Download
                        </button>

                        {/* 3-DOT DROPDOWN MENU */}
                        <div style={{ position: "relative" }}>
                          <button
                            onClick={(e) => toggleDropdown(e, fileId)}
                            style={threeDotButtonStyle}
                            title="More actions"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#F1F5F9";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#F8FAFC";
                            }}
                          >
                            <MdMoreVert size={18} />
                          </button>
                          
                          {openDropdownId === fileId && (
                            <div style={dropdownMenuStyle}>
                              {!isArchived && (
                                <>
                                  <div
                                    onClick={(e) => handleDropdownAction(e, 'share', file)}
                                    style={dropdownItemStyle("#F59E0B")}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = "#FFFBEB";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "#fff";
                                    }}
                                  >
                                    <MdEmail size={16} />
                                    Share with Client
                                  </div>
                                  <div
                                    onClick={(e) => handleDropdownAction(e, 'sign', file)}
                                    style={dropdownItemStyle("#8B5CF6")}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = "#F5F3FF";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "#fff";
                                    }}
                                  >
                                    <MdEdit size={16} />
                                    Sign Proposal
                                  </div>
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdownId(null);
                                      markProposalAsRejected(file);
                                    }}
                                    style={dropdownItemStyle("#EF4444")}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = "#FEF2F2";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "#fff";
                                    }}
                                  >
                                    <MdBlockFlipped size={16} />
                                    Reject Proposal
                                  </div>
                                </>
                              )}
                              {canDeleteProposals && !isArchived && (
                                <div
                                  onClick={(e) => handleDropdownAction(e, 'archive', file)}
                                  style={dropdownItemStyle("#475569")}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#F8FAFC";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "#fff";
                                  }}
                                >
                                  <MdArchive size={16} />
                                  Archive Proposal
                                </div>
                              )}
                              {canDeleteProposals && isArchived && (
                                <div
                                  onClick={(e) => handleDropdownAction(e, 'restore', file)}
                                  style={dropdownItemStyle("#059669")}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#ECFDF5";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "#fff";
                                  }}
                                >
                                  <MdUnarchive size={16} />
                                  Restore Proposal
                                </div>
                              )}
                              {canDeleteProposals && (
                                <div
                                  onClick={(e) => handleDropdownAction(e, 'delete', file)}
                                  style={{ ...dropdownItemStyle("#DC2626"), borderBottom: "none" }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#FEF2F2";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "#fff";
                                  }}
                                >
                                  <MdDelete size={16} />
                                  Delete Proposal
                                </div>
                              )}
                            </div>
                          )}
                        </div>
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
      {showDeleteModal && (
        <div style={modalOverlay} onClick={cancelDelete}>
          <div style={deleteModalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={deleteModalHeaderStyle}>
              <MdWarning size={28} color="#DC2626" />
              <h3 style={deleteModalTitleStyle}>
                {isBulkDelete ? `Delete ${selectedProposals.length} Proposals` : "Confirm Delete"}
              </h3>
              <button onClick={cancelDelete} style={deleteModalCloseStyle}>
                <MdClose size={20} />
              </button>
            </div>
            <div style={deleteModalBodyStyle}>
              {isBulkDelete ? (
                <>
                  <p>Are you sure you want to delete the following proposals?</p>
                  <div style={deleteProposalListStyle}>
                    {selectedProposals.slice(0, 10).map(name => (
                      <div key={name} style={deleteProposalItemStyle}>{name}</div>
                    ))}
                    {selectedProposals.length > 10 && (
                      <div style={deleteMoreStyle}>...and {selectedProposals.length - 10} more</div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p>Are you sure you want to delete this proposal?</p>
                  <div style={deleteProposalNameStyle}>
                    <strong>{proposalToDelete?.name}</strong>
                  </div>
                </>
              )}
              <div style={deleteWarningStyle}>
                <MdWarning size={16} color="#F59E0B" />
                <span>This action cannot be undone. This will permanently delete:</span>
              </div>
              <ul style={deleteListStyle}>
                <li>The PDF file from storage</li>
                <li>All view tracking data</li>
                <li>All shared links</li>
                <li>Proposal metadata</li>
                <li>Engagement session data</li>
              </ul>
              {deleteError && (
                <div style={deleteErrorStyle}>
                  <MdWarning size={16} />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>
            <div style={deleteModalFooterStyle}>
              <button onClick={cancelDelete} style={cancelButtonStyle} disabled={isDeleting}>
                <MdCancel size={18} />
                Cancel
              </button>
              <button onClick={confirmDelete} style={confirmButtonStyle} disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <div className="delete-spinner"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <MdDelete size={18} />
                    {isBulkDelete ? `Delete ${selectedProposals.length} Proposals` : "Delete Permanently"}
                  </>
                )}
              </button>
            </div>
          </div>
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
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes dropdownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// ========== STYLES ==========

const containerStyle = {
  padding: "24px",
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  background: "#f8fafc",
  borderRadius: "20px",
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
  marginBottom: "24px",
  flexWrap: "wrap",
  gap: "12px",
};

const headerButtonsStyle = {
  display: "flex",
  gap: "12px",
  alignItems: "center",
};

const titleStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  fontSize: "22px",
  fontWeight: "600",
  margin: 0,
  color: "#1E293B",
};

const refreshButtonStyle = {
  padding: "8px 16px",
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: "10px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  fontWeight: "500",
  color: "#475569",
  transition: "all 0.2s ease",
};

const bulkDeleteButtonStyle = {
  padding: "8px 16px",
  background: "#FEF2F2",
  color: "#DC2626",
  border: "1px solid #FEE2E2",
  borderRadius: "10px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  fontWeight: "500",
  transition: "all 0.2s ease",
};

const bulkArchiveButtonStyle = {
  padding: "8px 16px",
  background: "#F8FAFC",
  color: "#475569",
  border: "1px solid #CBD5E1",
  borderRadius: "10px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  fontWeight: "500",
  transition: "all 0.2s ease",
};

const archiveTabsStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px",
  marginBottom: "20px",
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: "12px",
};

const archiveTabButtonStyle = (active) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 14px",
  border: "none",
  borderRadius: "9px",
  background: active ? "#1E293B" : "transparent",
  color: active ? "#fff" : "#64748B",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "600",
  transition: "all 0.2s ease",
});

const archiveTabCountStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "20px",
  height: "20px",
  padding: "0 6px",
  borderRadius: "10px",
  background: "rgba(148, 163, 184, 0.22)",
  fontSize: "11px",
  fontWeight: "700",
};

const searchContainerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "20px",
  flexWrap: "wrap",
  gap: "16px",
};

const searchWrapperStyle = {
  display: "flex",
  alignItems: "center",
  flex: 1,
  maxWidth: "380px",
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: "12px",
  padding: "8px 14px",
  gap: "10px",
  transition: "all 0.2s ease",
};

const searchInputStyle = {
  flex: 1,
  border: "none",
  outline: "none",
  fontSize: "14px",
  background: "transparent",
  color: "#1E293B",
};

const clearSearchStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#94A3B8",
  fontSize: "14px",
};

const resultCountStyle = {
  fontSize: "13px",
  color: "#64748B",
  fontWeight: "500",
};

const selectAllContainerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "16px",
  padding: "10px 16px",
  background: "#fff",
  borderRadius: "12px",
  border: "1px solid #E2E8F0",
};

const selectAllLeftStyle = {
  display: "flex",
  gap: "16px",
};

const selectButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "500",
  color: "#475569",
  padding: "6px 12px",
  borderRadius: "8px",
  transition: "all 0.2s ease",
};

const selectedCountStyle = {
  fontSize: "13px",
  color: "#DC2626",
  fontWeight: "600",
};

const tableContainerStyle = {
  overflowX: "auto",
  borderRadius: "16px",
  border: "1px solid #E2E8F0",
  background: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const headerRowStyle = {
  background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
  color: "#fff",
};

const thStyle = {
  padding: "14px 16px",
  textAlign: "left",
  fontWeight: "600",
  fontSize: "13px",
};

const checkboxThStyle = {
  padding: "14px 16px",
  textAlign: "center",
  width: "44px",
};

const checkboxTdStyle = {
  padding: "14px 16px",
  textAlign: "center",
  width: "44px",
};

const tdStyle = {
  padding: "14px 16px",
  borderBottom: "1px solid #F1F5F9",
};

const rowEvenStyle = {
  background: "#fff",
};

const rowOddStyle = {
  background: "#F8FAFC",
};

const fileNameStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const fileNameTextStyle = {
  wordBreak: "break-all",
  fontSize: "13px",
  fontWeight: "500",
  color: "#1E293B",
};

const viewCountStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#64748B",
};

const actionsStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  alignItems: "center",
};

const emptyCellStyle = {
  padding: "60px",
  textAlign: "center",
};

const emptyStateStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "12px",
  color: "#94A3B8",
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
  marginTop: "24px",
  flexWrap: "wrap",
};

const paginationButtonStyle = (disabled) => ({
  padding: "8px 16px",
  borderRadius: "10px",
  border: "1px solid #E2E8F0",
  background: disabled ? "#F1F5F9" : "#fff",
  color: disabled ? "#CBD5E1" : "#3B82F6",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "13px",
  fontWeight: "500",
  transition: "all 0.2s ease",
});

const pageNumbersStyle = {
  display: "flex",
  gap: "6px",
};

const pageNumberStyle = (active) => ({
  width: "38px",
  height: "38px",
  borderRadius: "10px",
  border: "none",
  background: active ? "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)" : "#fff",
  color: active ? "#fff" : "#475569",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "500",
  transition: "all 0.2s ease",
  boxShadow: active ? "0 2px 8px rgba(59, 130, 246, 0.3)" : "none",
});

const toastSuccessStyle = {
  position: "fixed",
  bottom: "24px",
  right: "24px",
  background: "#fff",
  color: "#1E293B",
  padding: "12px 20px",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
  zIndex: 2001,
  animation: "fadeIn 0.3s ease",
  border: "1px solid #D1FAE5",
};

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
  borderRadius: "20px",
  width: "90%",
  maxWidth: "500px",
  maxHeight: "80vh",
  overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  animation: "slideUp 0.3s ease",
};

const deleteModalHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "20px 24px",
  background: "#FEF2F2",
  borderBottom: "1px solid #FEE2E2",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const deleteModalTitleStyle = {
  margin: 0,
  flex: 1,
  fontSize: "18px",
  fontWeight: "600",
  color: "#DC2626",
};

const deleteModalCloseStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#94A3B8",
  padding: "4px",
};

const deleteModalBodyStyle = {
  padding: "24px",
};

const deleteProposalNameStyle = {
  background: "#F8FAFC",
  padding: "12px",
  borderRadius: "12px",
  margin: "12px 0",
  wordBreak: "break-all",
  fontSize: "14px",
};

const deleteProposalListStyle = {
  background: "#F8FAFC",
  padding: "12px",
  borderRadius: "12px",
  margin: "12px 0",
  maxHeight: "200px",
  overflowY: "auto",
};

const deleteProposalItemStyle = {
  padding: "8px 12px",
  borderBottom: "1px solid #E2E8F0",
  fontSize: "12px",
  wordBreak: "break-all",
};

const deleteMoreStyle = {
  padding: "8px",
  textAlign: "center",
  fontSize: "12px",
  color: "#64748B",
  fontStyle: "italic",
};

const deleteWarningStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginTop: "16px",
  marginBottom: "12px",
  fontSize: "13px",
  color: "#F59E0B",
};

const deleteListStyle = {
  margin: "12px 0 0 20px",
  fontSize: "12px",
  color: "#64748B",
  lineHeight: "1.7",
};

const deleteErrorStyle = {
  marginTop: "16px",
  padding: "12px",
  background: "#FEF2F2",
  borderRadius: "10px",
  color: "#DC2626",
  fontSize: "12px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const deleteModalFooterStyle = {
  display: "flex",
  gap: "12px",
  padding: "20px 24px",
  borderTop: "1px solid #E2E8F0",
  justifyContent: "flex-end",
  position: "sticky",
  bottom: 0,
  background: "#fff",
};

const cancelButtonStyle = {
  padding: "10px 20px",
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: "10px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  fontWeight: "500",
  color: "#475569",
  transition: "all 0.2s ease",
};

const confirmButtonStyle = {
  padding: "10px 20px",
  background: "#DC2626",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  fontWeight: "500",
  transition: "all 0.2s ease",
};
