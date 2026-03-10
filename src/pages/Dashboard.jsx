import { useState, useEffect } from "react";
import { db, storage, auth } from "../firebase";
import { 
  MdLogout, 
  MdDashboard, 
  MdDescription, 
  MdUpload, 
  MdVisibility, 
  MdAnalytics,
  MdHome,
  MdPictureAsPdf,
  MdFileUpload,
  MdRemoveRedEye,
  MdTimeline,
  MdDelete,
  MdWarning,
  MdCheckCircle,
  MdCancel,
  MdFilterList,
  MdMenu,
  MdChevronLeft,
  MdChevronRight
} from "react-icons/md";
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { Navigate, useNavigate } from "react-router-dom";
import ProposalUploader from "./ProposalUploader";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [views, setViews] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeTab, setActiveTab] = useState("home");
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Delete functionality states
  const [selectedViews, setSelectedViews] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [dateFilter, setDateFilter] = useState("all");
  
  // Logout confirmation modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // View proposal modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const [viewUrl, setViewUrl] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  
  // Proposals pagination and search state
  const [proposalSearch, setProposalSearch] = useState("");
  const [proposalPage, setProposalPage] = useState(1);
  const proposalsPerPage = 10;

  // Live Views pagination and search state
  const [viewsSearch, setViewsSearch] = useState("");
  const [viewsPage, setViewsPage] = useState(1);
  const viewsPerPage = 10;
  
  // Engagement pagination and search state
  const [engagementSearch, setEngagementSearch] = useState("");
  const [engagementPage, setEngagementPage] = useState(1);
  const engagementPerPage = 10;

  const navigate = useNavigate();
  
  /* AUTH CHECK */
  useEffect(()=>{
    const unsubscribe = onAuthStateChanged(auth,(currentUser)=>{
      setUser(currentUser);
      setAuthChecked(true);
    });
    return ()=>unsubscribe();
  },[]);

  /* LOGOUT */
  const handleLogout = async()=>{
    try{
      await signOut(auth);
      navigate("/login");
      alert("Logged out successfully");
    }catch(error){
      alert(error.message);
    }
  };

  /* LOAD PROPOSALS */
  useEffect(()=>{
    if(!user) return;
    const loadFiles = async()=>{
      setLoadingFiles(true);
      try{
        const proposalsRef = ref(storage,"proposals");
        const fileList = await listAll(proposalsRef);
        setFiles(fileList.items);
      }catch(error){
        console.error(error);
        alert(error.message);
      }finally{
        setLoadingFiles(false);
      }
    };
    loadFiles();
  },[user]);

  /* LISTEN TO VIEW EVENTS */
  useEffect(()=>{
    if (!user) return;
    const q = query(
      collection(db,"proposalViews"),
      orderBy("viewedAt","desc")
    );
    const unsub = onSnapshot(q,(snapshot)=>{
      const data = snapshot.docs.map(doc=>{
        const d = doc.data();
        return{
          id: doc.id,
          ...d,
          viewedAt: d.viewedAt?.toDate?.() || null
        };
      });
      setViews(data);
    });
    return ()=>unsub();
  },[user]);

  /* LISTEN TO ENGAGEMENT SESSIONS */
  useEffect(()=>{
    if (!user) return;
    const unsub = onSnapshot(
      collection(db,"proposalSessions"),
      (snapshot)=>{
        const data = snapshot.docs.map(doc=>({
          id:doc.id,
          ...doc.data()
        }));
        setSessions(data);
      }
    );
    return ()=>unsub();
  },[user]);

  /* COUNT VIEWS PER FILE */
  const getViewCount = (fileName)=>{
    return views.filter(v=>v.fileName===fileName).length;
  };

  /* CHART DATA */
  const proposalChartData = files.map(file=>({
    name: file.name.length > 20 ? file.name.substring(0,20)+"..." : file.name,
    views: getViewCount(file.name),
    fullName: file.name
  }));

  const dailyViews = {};
  views.forEach(v=>{
    if(!v.viewedAt) return;
    const date = new Date(v.viewedAt).toLocaleDateString();
    if(!dailyViews[date]) dailyViews[date] = 0;
    dailyViews[date]++;
  });

  const dailyChartData = Object.keys(dailyViews).map(date=>({
    date,
    views: dailyViews[date]
  }));

  /* VIEW PROPOSAL */
  const viewProposal = (file)=>{
    const fullPath = `proposals/${file.name}`;
    const encoded = btoa(fullPath);
    const url = `${window.location.origin}/p/${encoded}`;
    setViewUrl(url);
    setViewingFile(file);
    setShowViewModal(true);
  };

  /* DOWNLOAD */
  const downloadFile = async(file)=>{
    try{
      const url = await getDownloadURL(ref(storage,`proposals/${file.name}`));
      window.open(url,"_blank");
    }catch(error){
      alert(error.message);
    }
  };

  /* ========== DELETE FUNCTIONS ========== */

  // Filter views based on date
  const getFilteredViews = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return views.filter(v => {
      if (!v.viewedAt) return false;
      const viewDate = new Date(v.viewedAt);
      
      switch(dateFilter) {
        case "today":
          return viewDate >= today;
        case "week":
          return viewDate >= weekAgo;
        case "month":
          return viewDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  // Filter sessions based on date
  const getFilteredSessions = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return sessions.filter(s => {
      if (!s.startedAt) return false;
      const sessionDate = new Date(s.startedAt.seconds * 1000);
      
      switch(dateFilter) {
        case "today":
          return sessionDate >= today;
        case "week":
          return sessionDate >= weekAgo;
        case "month":
          return sessionDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  // Delete single view
  const handleDeleteView = async (viewId, fileName) => {
    setDeleteItem({ id: viewId, name: fileName, type: "view" });
    setShowDeleteModal(true);
  };

  // Delete single session
  const handleDeleteSession = async (sessionId, fileName) => {
    setDeleteItem({ id: sessionId, name: fileName, type: "session" });
    setShowDeleteModal(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteItem) {
        // Single delete
        const collectionName = deleteItem.type === "view" ? "proposalViews" : "proposalSessions";
        await deleteDoc(doc(db, collectionName, deleteItem.id));
        setDeleteSuccess(`Successfully deleted ${deleteItem.name}`);
      } else if (deleteType === "views" && selectedViews.length > 0) {
        // Bulk delete views
        const batch = writeBatch(db);
        selectedViews.forEach(id => {
          const ref = doc(db, "proposalViews", id);
          batch.delete(ref);
        });
        await batch.commit();
        setDeleteSuccess(`Successfully deleted ${selectedViews.length} views`);
        setSelectedViews([]);
      } else if (deleteType === "sessions" && selectedSessions.length > 0) {
        // Bulk delete sessions
        const batch = writeBatch(db);
        selectedSessions.forEach(id => {
          const ref = doc(db, "proposalSessions", id);
          batch.delete(ref);
        });
        await batch.commit();
        setDeleteSuccess(`Successfully deleted ${selectedSessions.length} sessions`);
        setSelectedSessions([]);
      } else if (deleteType === "filteredViews") {
        // Delete all filtered views
        const filteredViews = getFilteredViews();
        if (filteredViews.length > 0) {
          const batch = writeBatch(db);
          filteredViews.forEach(v => {
            const ref = doc(db, "proposalViews", v.id);
            batch.delete(ref);
          });
          await batch.commit();
          setDeleteSuccess(`Successfully deleted ${filteredViews.length} views`);
        }
      } else if (deleteType === "filteredSessions") {
        // Delete all filtered sessions
        const filteredSessions = getFilteredSessions();
        if (filteredSessions.length > 0) {
          const batch = writeBatch(db);
          filteredSessions.forEach(s => {
            const ref = doc(db, "proposalSessions", s.id);
            batch.delete(ref);
          });
          await batch.commit();
          setDeleteSuccess(`Successfully deleted ${filteredSessions.length} sessions`);
        }
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setDeleteSuccess(null), 3000);
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Error deleting: " + error.message);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeleteItem(null);
      setDeleteType(null);
    }
  };

  // Select all views
  const selectAllViews = (checked) => {
    if (checked) {
      setSelectedViews(views.map(v => v.id));
    } else {
      setSelectedViews([]);
    }
  };

  // Select all sessions
  const selectAllSessions = (checked) => {
    if (checked) {
      setSelectedSessions(sessions.map(s => s.id));
    } else {
      setSelectedSessions([]);
    }
  };

  // Toggle view selection
  const toggleViewSelection = (viewId) => {
    if (selectedViews.includes(viewId)) {
      setSelectedViews(selectedViews.filter(id => id !== viewId));
    } else {
      setSelectedViews([...selectedViews, viewId]);
    }
  };

  // Toggle session selection
  const toggleSessionSelection = (sessionId) => {
    if (selectedSessions.includes(sessionId)) {
      setSelectedSessions(selectedSessions.filter(id => id !== sessionId));
    } else {
      setSelectedSessions([...selectedSessions, sessionId]);
    }
  };

  // Filter proposals based on search query
  const filteredProposals = files.filter(file =>
    file.name.toLowerCase().includes(proposalSearch.toLowerCase())
  );

  // Paginate proposals
  const paginatedProposals = filteredProposals.slice(
    (proposalPage - 1) * proposalsPerPage,
    proposalPage * proposalsPerPage
  );

  // Calculate total number of pages
  const totalProposalPages = Math.ceil(filteredProposals.length / proposalsPerPage);

  // Filter views based on search query
  const filteredViews = views.filter(v =>
    (v.fileName || "").toLowerCase().includes(viewsSearch.toLowerCase()) ||
    (v.viewerEmail || "").toLowerCase().includes(viewsSearch.toLowerCase()) ||
    (v.viewerId || "").toLowerCase().includes(viewsSearch.toLowerCase())
  );

  // Paginate views
  const paginatedViews = filteredViews.slice(
    (viewsPage - 1) * viewsPerPage,
    viewsPage * viewsPerPage
  );

  // Calculate total number of pages for views
  const totalViewsPages = Math.ceil(filteredViews.length / viewsPerPage);

  // Filter engagement based on search query
  const filteredEngagement = sessions.filter(s =>
    (s.fileName || "").toLowerCase().includes(engagementSearch.toLowerCase()) ||
    (s.viewerEmail || "").toLowerCase().includes(engagementSearch.toLowerCase())
  );

  // Paginate engagement
  const paginatedEngagement = filteredEngagement.slice(
    (engagementPage - 1) * engagementPerPage,
    engagementPage * engagementPerPage
  );

  // Calculate total number of pages for engagement
  const totalEngagementPages = Math.ceil(filteredEngagement.length / engagementPerPage);

  if(!authChecked) return <div style={{padding:40}}>Loading...</div>;

  if(!user) return <Navigate to="/login"/>

  return(
    <div style={{display:"flex", height:"100vh", fontFamily:"Arial", overflow:"hidden", maxWidth:"100vw"}}>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "#fff",
            padding: "30px 40px",
            borderRadius: "16px",
            maxWidth: "400px",
            width: "90%",
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <div style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <MdLogout size={28} color="#fff" />
            </div>
            
            <h3 style={{margin: "0 0 10px 0", color: "#1a1a2e", fontSize: "22px"}}>
              Confirm Logout
            </h3>
            
            <p style={{margin: "0 0 25px 0", color: "#666", fontSize: "15px", lineHeight: "1.5"}}>
              Are you sure you want to logout from your account?
            </p>
            
            <div style={{display: "flex", gap: "12px", justifyContent: "center"}}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  padding: "12px 24px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  background: "#fff",
                  color: "#666",
                  fontSize: "15px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={async () => {
                  await handleLogout();
                  setShowLogoutModal(false);
                }}
                style={{
                  padding: "12px 24px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                  color: "#fff",
                  fontSize: "15px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(239, 68, 68, 0.3)",
                  transition: "all 0.2s ease",
                }}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PROPOSAL MODAL */}
      {showViewModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px",
          animation: "fadeIn 0.3s ease",
        }}>
          <div style={{
            background: "rgba(255, 255, 255, 0.98)",
            borderRadius: "24px",
            width: "100%",
            maxWidth: "1000px",
            height: "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 25px 80px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            animation: "slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          }}>
            {/* Modal Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 30px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              boxShadow: "0 4px 20px rgba(102, 126, 234, 0.3)",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "15px",
              }}>
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.2)",
                  backdropFilter: "blur(10px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <MdDescription size={24} color="#fff" />
                </div>
                <div>
                  <h3 style={{
                    margin: 0,
                    color: "#fff",
                    fontSize: "18px",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                  }}>
                    Viewing Proposal
                  </h3>
                  <p style={{
                    margin: "4px 0 0 0",
                    color: "rgba(255,255,255,0.8)",
                    fontSize: "13px",
                    maxWidth: "400px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {viewingFile?.name || "Proposal"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingFile(null);
                  setViewUrl("");
                }}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fff",
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.8)";
                  e.currentTarget.style.transform = "rotate(90deg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                  e.currentTarget.style.transform = "rotate(0deg)";
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Modal Content - Iframe */}
            <div style={{
              flex: 1,
              overflow: "hidden",
              position: "relative",
              background: "#f8f9fa",
            }}>
              {!viewUrl ? (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  flexDirection: "column",
                  gap: "20px",
                }}>
                  <div style={{
                    width: "60px",
                    height: "60px",
                    border: "4px solid rgba(102, 126, 234, 0.1)",
                    borderTop: "4px solid #667eea",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }} />
                  <p style={{ color: "#666", fontSize: "14px" }}>Loading proposal...</p>
                </div>
              ) : (
                <iframe
                  src={viewUrl}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                  }}
                  title="Proposal Viewer"
                />
              )}
            </div>
            
            {/* Modal Footer */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "18px 30px",
              background: "#fff",
              borderTop: "1px solid rgba(0,0,0,0.06)",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#666",
                fontSize: "13px",
              }}>
                <MdRemoveRedEye size={16} color="#667eea" />
                <span>Viewing in modal mode</span>
              </div>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingFile(null);
                  setViewUrl("");
                }}
                style={{
                  padding: "12px 28px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)",
                  transition: "all 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>Close Viewer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "#fff",
            padding: 30,
            borderRadius: 12,
            maxWidth: 400,
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
          }}>
            <MdWarning size={48} color="#f57c00" style={{ marginBottom: 20 }} />
            <h3 style={{ marginBottom: 10 }}>Confirm Delete</h3>
            <p style={{ fontSize: 16, marginBottom: 20 }}>
              {deleteItem ? (
                <>Are you sure you want to delete "<strong>{deleteItem.name}</strong>"?</>
              ) : deleteType === "views" ? (
                <>Are you sure you want to delete <strong>{selectedViews.length}</strong> selected views?</>
              ) : deleteType === "sessions" ? (
                <>Are you sure you want to delete <strong>{selectedSessions.length}</strong> selected sessions?</>
              ) : deleteType === "filteredViews" ? (
                <>Are you sure you want to delete all <strong>{getFilteredViews().length}</strong> views in the current filter?</>
              ) : deleteType === "filteredSessions" ? (
                <>Are you sure you want to delete all <strong>{getFilteredSessions().length}</strong> sessions in the current filter?</>
              ) : null}
            </p>
            <p style={{ color: "#d32f2f", fontSize: 14, marginBottom: 25 }}>
              This action cannot be undone!
            </p>
            
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteItem(null);
                  setDeleteType(null);
                }}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#9e9e9e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: isDeleting ? 0.5 : 1
                }}
              >
                <MdCancel size={18} />
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "#d32f2f",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: isDeleting ? 0.5 : 1
                }}
              >
                <MdDelete size={18} />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS TOAST */}
      {deleteSuccess && (
        <div style={{
          position: "fixed",
          top: 20,
          right: 20,
          background: "#4CAF50",
          color: "#fff",
          padding: "15px 25px",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 1001,
          animation: "slideIn 0.3s ease"
        }}>
          <MdCheckCircle size={20} />
          {deleteSuccess}
        </div>
      )}

      {/* SIDEBAR WITH ICONS */}
      <div style={sidebarContainerStyle(sidebarCollapsed)}>

        <div style={floatingSidebarStyle(sidebarCollapsed)}>

          <div style={sidebarHeaderStyle}>
            <div style={logoContainerStyle}>
              <MdDashboard size={sidebarCollapsed ? 32 : 36} color="#00D4FF" />
              {!sidebarCollapsed && (
                <div>
                  <h2 style={{color:"#fff", margin:0, fontSize:22, fontWeight:700, letterSpacing:"1px"}}>Admin</h2>
                  <p style={{color:"rgba(0,212,255,0.7)", margin:0, fontSize:11, letterSpacing:"2px"}}>DASHBOARD</p>
                </div>
              )}
            </div>
          </div>

          <div style={{display:"flex", flexDirection:"column", gap: sidebarCollapsed ? 16 : 10, flex:1, marginTop: sidebarCollapsed ? 30 : 20}}>

          <button 
            style={sidebarBtn(activeTab==="home", sidebarCollapsed)} 
            onClick={()=>setActiveTab("home")}
          >
            <MdHome size={sidebarCollapsed ? 28 : 22} />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </button>

          <button 
            style={sidebarBtn(activeTab==="proposals", sidebarCollapsed)} 
            onClick={()=>setActiveTab("proposals")}
          >
            <MdPictureAsPdf size={sidebarCollapsed ? 28 : 22} />
            {!sidebarCollapsed && <span>Proposals</span>}
          </button>

          <button 
            style={sidebarBtn(activeTab==="upload", sidebarCollapsed)} 
            onClick={()=>setActiveTab("upload")}
          >
            <MdFileUpload size={sidebarCollapsed ? 28 : 22} />
            {!sidebarCollapsed && <span>Upload</span>}
          </button>

          <button 
            style={sidebarBtn(activeTab==="views", sidebarCollapsed)} 
            onClick={()=>setActiveTab("views")}
          >
            <MdRemoveRedEye size={sidebarCollapsed ? 28 : 22} />
            {!sidebarCollapsed && <span>Live Views</span>}
          </button>

          <button 
            style={sidebarBtn(activeTab==="engagement", sidebarCollapsed)} 
            onClick={()=>setActiveTab("engagement")}
          >
            <MdTimeline size={sidebarCollapsed ? 28 : 22} />
            {!sidebarCollapsed && <span>Engagement</span>}
          </button>

          </div>

          <button
            onClick={() => setShowLogoutModal(true)}
            style={logoutBtnStyle(sidebarCollapsed)}
          >
            <MdLogout size={sidebarCollapsed ? 26 : 22}/>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>

        </div>

        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={collapseBtnStyle}
        >
          {sidebarCollapsed ? <MdChevronRight size={32} /> : <MdChevronLeft size={32} />}
        </button>

      </div>

      {/* MAIN CONTENT */}
      <div style={mainContentStyle(sidebarCollapsed)}>

        {/* User Info Bar */}
        <div style={userBarStyle}>
          <div style={avatarStyle}>
            {user?.email?.charAt(0).toUpperCase() || "A"}
          </div>
          <div style={userInfoTextStyle}>
            <div style={userLabelStyle}>Welcome back,</div>
            <div style={userEmailStyle}>{user?.email}</div>
          </div>
          <div style={userBadgeStyle}>
            <span style={dotStyle}></span>
            Online
          </div>
        </div>

        {/* CSS Animation */}
        <style>{`
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
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from {
              transform: translateY(30px) scale(0.95);
              opacity: 0;
            }
            to {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          /* Hide horizontal scrollbar */
          ::-webkit-scrollbar {
            height: 0 !important;
          }
          .recharts-surface {
            overflow: visible !important;
          }
        `}</style>

        {/* DASHBOARD */}
        {activeTab==="home" && (
          <>
            <h2 style={{display:"flex", alignItems:"center", gap:10}}>
              <MdDashboard size={28} color="#1976D2" />
              Dashboard Summary
            </h2>

            <div style={summaryContainer}>
              <div style={card}>
                <MdDescription size={32} color="#1976D2" style={{marginBottom:10}} />
                <h3>Total Proposals</h3>
                <p style={number}>{files.length}</p>
              </div>

              <div style={card}>
                <MdRemoveRedEye size={32} color="#4CAF50" style={{marginBottom:10}} />
                <h3>Total Views</h3>
                <p style={number}>{views.length}</p>
              </div>

              <div style={card}>
                <MdAnalytics size={32} color="#FF9800" style={{marginBottom:10}} />
                <h3>Unique Viewers</h3>
                <p style={number}>
                  {new Set(views.filter(v=>v.viewerId).map(v=>v.viewerId)).size}
                </p>
              </div>
            </div>

            <h3 style={{marginTop:40, display:"flex", alignItems:"center", gap:8}}>
              <MdTimeline color="#2196F3" />
              Views per Proposal                 Daily View Traffic
            </h3>

            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:30, marginTop:20}}>
              {/* Views per Proposal Chart */}
              <div>
                <h4 style={{marginBottom:15, color:"#333", fontSize:16}}>Views per Proposal</h4>
                <div style={{width:"100%", overflow:"hidden"}}>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={proposalChartData}>
                      <CartesianGrid strokeDasharray="3 3"/>
                      <XAxis dataKey="name"/>
                      <YAxis/>
                      <Tooltip/>
                      <Bar dataKey="views" fill="#2196F3"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Daily View Traffic Chart */}
              <div>
                <h4 style={{marginBottom:15, color:"#333", fontSize:16}}>Daily View Traffic</h4>
                <div style={{width:"100%", overflow:"hidden"}}>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3"/>
                      <XAxis dataKey="date"/>
                      <YAxis/>
                      <Tooltip/>
                      <Line type="monotone" dataKey="views" stroke="#4CAF50" strokeWidth={3}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top User Performance */}
            <h3 style={{marginTop:40, display:"flex", alignItems:"center", gap:8}}>
              <MdAnalytics color="#FF9800" />
              Top User Performance
            </h3>

            <div style={{marginTop:20}}>
              <table style={{...table, marginTop:0}}>
                <thead>
                  <tr style={thead}>
                    <th style={th}>Rank</th>
                    <th style={th}>Viewer Email</th>
                    <th style={th}>Total Time Spent</th>
                    <th style={th}>Pages Viewed</th>
                    <th style={th}>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Calculate top viewers by aggregating session data
                    const userStats = {};
                    sessions.forEach(s => {
                      const email = s.viewerEmail || "Anonymous";
                      if (!userStats[email]) {
                        userStats[email] = { email, duration: 0, pages: 0, sessions: 0 };
                      }
                      userStats[email].duration += (s.duration || 0);
                      userStats[email].pages += (s.pagesViewed?.length || 0);
                      userStats[email].sessions += 1;
                    });
                    
                    return Object.values(userStats)
                      .sort((a, b) => b.duration - a.duration)
                      .slice(0, 5)
                      .map((user, i) => (
                        <tr key={i} style={i % 2 === 0 ? rowEven : rowOdd}>
                          <td style={td}>
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#e0e0e0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "bold",
                              fontSize: 14,
                              margin: "0 auto"
                            }}>
                              {i + 1}
                            </div>
                          </td>
                          <td style={td}>{user.email}</td>
                          <td style={td}>
                            <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center"}}>
                              <MdTimeline color="#FF9800" size={16} />
                              {Math.round(user.duration / 1000)} sec
                            </div>
                          </td>
                          <td style={td}>
                            <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center"}}>
                              <MdDescription color="#4CAF50" size={16} />
                              {user.pages} pages
                            </div>
                          </td>
                          <td style={td}>{user.sessions}</td>
                        </tr>
                      ));
                  })()}
                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{textAlign: "center", padding: 30}}>
                        No engagement data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* UPLOAD */}
        {activeTab==="upload" && (
          <>
            <h2 style={{display:"flex", alignItems:"center", gap:10}}>
              <MdFileUpload size={28} color="#1976D2" />
              Upload New Proposal
            </h2>
            <ProposalUploader/>
          </>
        )}

        {/* PROPOSALS */}
        {activeTab==="proposals" && (
          <>
            <h2 style={{display:"flex", alignItems:"center", gap:10}}>
              <MdPictureAsPdf size={28} color="#1976D2" />
              Uploaded Proposals
            </h2>
            
            {/* Search Bar */}
            <div style={searchContainerStyle}>
              <input
                type="text"
                placeholder="Search proposals..."
                value={proposalSearch}
                onChange={(e) => {
                  setProposalSearch(e.target.value);
                  setProposalPage(1);
                }}
                style={searchInputStyle}
              />
              <span style={searchResultStyle}>
                {filteredProposals.length} proposal{filteredProposals.length !== 1 ? 's' : ''} found
              </span>
            </div>

            {loadingFiles ? (
              <p>Loading...</p>
            ) : (
              <>
                <table style={table}>
                  <thead>
                    <tr style={thead}>
                      <th style={th}>File</th>
                      <th style={th}>Views</th>
                      <th style={th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProposals.map((file,i)=>(
                      <tr key={i} style={i%2===0?rowEven:rowOdd}>
                        <td style={td}>
                          <div style={{display:"flex", alignItems:"center", gap:8}}>
                            <MdDescription color="#1976D2" />
                            {file.name}
                          </div>
                        </td>
                        <td style={td}>
                          <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center"}}>
                            {getViewCount(file.name)} <MdRemoveRedEye color="#666" size={16} />
                          </div>
                        </td>
                        <td style={td}>
                          <button style={viewBtn} onClick={()=>viewProposal(file)}>
                            <MdVisibility size={16} style={{marginRight:5}} />
                            View
                          </button>
                          <button style={downloadBtn} onClick={()=>downloadFile(file)}>
                            <MdFileUpload size={16} style={{marginRight:5}} />
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Pagination */}
                {totalProposalPages > 1 && (
                  <div style={paginationContainerStyle}>
                    <button 
                      onClick={() => setProposalPage(p => Math.max(1, p - 1))}
                      disabled={proposalPage === 1}
                      style={paginationBtnStyle(proposalPage === 1)}
                    >
                      Previous
                    </button>
                    
                    <div style={pageNumbersStyle}>
                      {Array.from({length: totalProposalPages}, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setProposalPage(page)}
                          style={pageNumberStyle(proposalPage === page)}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    
                    <button 
                      onClick={() => setProposalPage(p => Math.min(totalProposalPages, p + 1))}
                      disabled={proposalPage === totalProposalPages}
                      style={paginationBtnStyle(proposalPage === totalProposalPages)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* LIVE VIEWS with Delete and Search */}
        {activeTab==="views" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MdRemoveRedEye size={28} color="#1976D2" />
                Live Proposal Views
              </h2>
              
              <div style={{ display: "flex", gap: 10 }}>
                {/* Filter Dropdown */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer"
                  }}
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>

                {/* Bulk Delete Button */}
                {selectedViews.length > 0 && (
                  <button
                    onClick={() => {
                      setDeleteType("views");
                      setShowDeleteModal(true);
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "#d32f2f",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: "bold"
                    }}
                  >
                    <MdDelete size={18} />
                    Delete Selected ({selectedViews.length})
                  </button>
                )}

                {/* Delete All Filtered Button */}
                {getFilteredViews().length > 0 && (
                  <button
                    onClick={() => {
                      setDeleteType("filteredViews");
                      setShowDeleteModal(true);
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "#ff9800",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}
                  >
                    <MdDelete size={18} />
                    Delete {getFilteredViews().length} Filtered
                  </button>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div style={searchContainerStyle}>
              <input
                type="text"
                placeholder="Search by file, viewer email or ID..."
                value={viewsSearch}
                onChange={(e) => {
                  setViewsSearch(e.target.value);
                  setViewsPage(1);
                }}
                style={searchInputStyle}
              />
              <span style={searchResultStyle}>
                {filteredViews.length} view{filteredViews.length !== 1 ? 's' : ''} found
              </span>
            </div>

            {/* Filter Info */}
            <div style={{
              background: "#e3f2fd",
              padding: "8px 15px",
              borderRadius: 6,
              marginBottom: 15,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14
            }}>
              <MdFilterList color="#1976D2" />
              Showing {paginatedViews.length} of {filteredViews.length} views
              {dateFilter !== "all" && ` (filtered by: ${dateFilter})`}
            </div>

            <table style={table}>
              <thead>
                <tr style={thead}>
                  <th style={{ ...th, width: 40 }}>
                    <input
                      type="checkbox"
                      onChange={(e) => selectAllViews(e.target.checked)}
                      checked={selectedViews.length === views.length && views.length > 0}
                    />
                  </th>
                  <th style={th}>File</th>
                  <th style={th}>Viewer Email</th>
                  <th style={th}>Viewer ID</th>
                  <th style={th}>Viewed At</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedViews.map((v, i) => (
                  <tr key={i} style={i % 2 === 0 ? rowEven : rowOdd}>
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={selectedViews.includes(v.id)}
                        onChange={() => toggleViewSelection(v.id)}
                      />
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <MdDescription color="#1976D2" />
                        {v.fileName || "N/A"}
                      </div>
                    </td>
                    <td style={td}>{v.viewerEmail || "Anonymous"}</td>
                    <td style={td}>{v.viewerId || "Anonymous"}</td>
                    <td style={td}>
                      {v.viewedAt ? v.viewedAt.toLocaleString() : "Loading"}
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => handleDeleteView(v.id, v.fileName)}
                        style={{
                          padding: "6px 12px",
                          background: "#d32f2f",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5
                        }}
                      >
                        <MdDelete size={16} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedViews.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                      No views found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {/* Pagination */}
            {totalViewsPages > 1 && (
              <div style={paginationContainerStyle}>
                <button 
                  onClick={() => setViewsPage(p => Math.max(1, p - 1))}
                  disabled={viewsPage === 1}
                  style={paginationBtnStyle(viewsPage === 1)}
                >
                  Previous
                </button>
                
                <div style={pageNumbersStyle}>
                  {Array.from({length: totalViewsPages}, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setViewsPage(page)}
                      style={pageNumberStyle(viewsPage === page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                <button 
                  onClick={() => setViewsPage(p => Math.min(totalViewsPages, p + 1))}
                  disabled={viewsPage === totalViewsPages}
                  style={paginationBtnStyle(viewsPage === totalViewsPages)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* ENGAGEMENT with Delete and Search */}
        {activeTab==="engagement" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MdTimeline size={28} color="#1976D2" />
                Proposal Engagement Analytics
              </h2>
              
              <div style={{ display: "flex", gap: 10 }}>
                {/* Filter Dropdown */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer"
                  }}
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>

                {/* Bulk Delete Button */}
                {selectedSessions.length > 0 && (
                  <button
                    onClick={() => {
                      setDeleteType("sessions");
                      setShowDeleteModal(true);
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "#d32f2f",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: "bold"
                    }}
                  >
                    <MdDelete size={18} />
                    Delete Selected ({selectedSessions.length})
                  </button>
                )}

                {/* Delete All Filtered Button */}
                {getFilteredSessions().length > 0 && (
                  <button
                    onClick={() => {
                      setDeleteType("filteredSessions");
                      setShowDeleteModal(true);
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "#ff9800",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}
                  >
                    <MdDelete size={18} />
                    Delete {getFilteredSessions().length} Filtered
                  </button>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div style={searchContainerStyle}>
              <input
                type="text"
                placeholder="Search by proposal or viewer..."
                value={engagementSearch}
                onChange={(e) => {
                  setEngagementSearch(e.target.value);
                  setEngagementPage(1);
                }}
                style={searchInputStyle}
              />
              <span style={searchResultStyle}>
                {filteredEngagement.length} session{filteredEngagement.length !== 1 ? 's' : ''} found
              </span>
            </div>

            {/* Filter Info */}
            <div style={{
              background: "#e3f2fd",
              padding: "8px 15px",
              borderRadius: 6,
              marginBottom: 15,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14
            }}>
              <MdFilterList color="#1976D2" />
              Showing {paginatedEngagement.length} of {filteredEngagement.length} sessions
              {dateFilter !== "all" && ` (filtered by: ${dateFilter})`}
            </div>

            <table style={table}>
              <thead>
                <tr style={thead}>
                  <th style={{ ...th, width: 40 }}>
                    <input
                      type="checkbox"
                      onChange={(e) => selectAllSessions(e.target.checked)}
                      checked={selectedSessions.length === sessions.length && sessions.length > 0}
                    />
                  </th>
                  <th style={th}>Proposal</th>
                  <th style={th}>Viewer</th>
                  <th style={th}>Time Spent</th>
                  <th style={th}>Pages Viewed</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEngagement.map((s, i) => (
                  <tr key={i} style={i % 2 === 0 ? rowEven : rowOdd}>
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={selectedSessions.includes(s.id)}
                        onChange={() => toggleSessionSelection(s.id)}
                      />
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <MdDescription color="#1976D2" />
                        {s.fileName}
                      </div>
                    </td>
                    <td style={td}>{s.viewerEmail}</td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
                        <MdTimeline color="#FF9800" size={16} />
                        {Math.round((s.duration || 0) / 1000)} sec
                      </div>
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
                        <MdDescription color="#4CAF50" size={16} />
                        {s.pagesViewed?.length || 0} pages
                      </div>
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => handleDeleteSession(s.id, s.fileName)}
                        style={{
                          padding: "6px 12px",
                          background: "#d32f2f",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5
                        }}
                      >
                        <MdDelete size={16} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedEngagement.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                      No engagement data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {/* Pagination */}
            {totalEngagementPages > 1 && (
              <div style={paginationContainerStyle}>
                <button 
                  onClick={() => setEngagementPage(p => Math.max(1, p - 1))}
                  disabled={engagementPage === 1}
                  style={paginationBtnStyle(engagementPage === 1)}
                >
                  Previous
                </button>
                
                <div style={pageNumbersStyle}>
                  {Array.from({length: totalEngagementPages}, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setEngagementPage(page)}
                      style={pageNumberStyle(engagementPage === page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                <button 
                  onClick={() => setEngagementPage(p => Math.min(totalEngagementPages, p + 1))}
                  disabled={engagementPage === totalEngagementPages}
                  style={paginationBtnStyle(engagementPage === totalEngagementPages)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

      </div>

    </div>
  );
}

/* STYLES */

/* FUTURISTIC FLOATING SIDEBAR CONTAINER */
const sidebarContainerStyle = (collapsed) => ({
  position: "relative",
  width: collapsed ? 100 : 280,
  minWidth: collapsed ? 100 : 280,
  padding: "20px 12px",
  transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  display: "flex",
  flexDirection: "column",
  willChange: "width, min-width",
});

/* FLOATING SIDEBAR WITH GLASSMORPHISM */
const floatingSidebarStyle = (collapsed) => ({
  width: collapsed ? 76 : 256,
  height: "calc(100vh - 40px)",
  background: "linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.98) 100%)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: 24,
  padding: collapsed ? "30px 10px" : "30px 20px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 0 60px rgba(0, 212, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  position: "relative",
  overflow: "hidden",
  transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  willChange: "width, padding",
});

/* COLLAPSE BUTTON - Outside sidebar at top right edge */
const collapseBtnStyle = {
  position: "absolute",
  top: 40,
  right: -20,
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: "none",
  background: "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 4px 20px rgba(0, 212, 255, 0.5), 0 0 0 3px rgba(255, 255, 255, 0.1)",
  zIndex: 100,
  transition: "all 0.3s ease",
};

/* SIDEBAR HEADER */
const sidebarHeaderStyle = {
  position: "relative",
  paddingBottom: 20,
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  marginBottom: 10,
};

const logoContainerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
};

/* FUTURISTIC SIDEBAR BUTTON */
const sidebarBtn = (active, collapsed) => ({
  padding: collapsed ? "16px" : "14px 18px",
  border: "none",
  borderRadius: 14,
  cursor: "pointer",
  background: active 
    ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
    : "transparent",
  color: active ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: collapsed ? "center" : "flex-start",
  gap: 12,
  fontSize: collapsed ? 0 : 15,
  fontWeight: active ? 600 : 500,
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  position: "relative",
  overflow: "hidden",
  boxShadow: active 
    ? "0 4px 20px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)" 
    : "none",
  border: active ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
});

/* LOGOUT BUTTON */
const logoutBtnStyle = (collapsed) => ({
  marginTop: "auto",
  padding: collapsed ? "14px" : "14px 18px",
  border: "none",
  borderRadius: 14,
  cursor: "pointer",
  background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%)",
  color: "#EF4444",
  display: "flex",
  alignItems: "center",
  justifyContent: collapsed ? "center" : "flex-start",
  gap: collapsed ? 0 : 10,
  fontSize: collapsed ? 0 : 15,
  fontWeight: 600,
  transition: "all 0.3s ease",
  border: "1px solid rgba(239, 68, 68, 0.3)",
  boxShadow: "0 4px 15px rgba(239, 68, 68, 0.15)",
});

/* MAIN CONTENT - ADAPTS TO SIDEBAR */
const mainContentStyle = (collapsed) => ({
  flex: 1,
  padding: "30px 40px",
  background: "#f4f6f8",
  overflowY: "auto",
  overflowX: "hidden",
  borderRadius: "24px 0 0 0",
  minHeight: "100vh",
  width: collapsed ? "calc(100% - 100px)" : "calc(100% - 280px)",
});

/* USER BAR STYLES */
const userBarStyle = {
  background: "linear-gradient(135deg, #fff 0%, #f8fafc 100%)",
  padding: "16px 24px",
  borderRadius: 16,
  marginBottom: 30,
  display: "flex",
  alignItems: "center",
  gap: 16,
  boxShadow: "0 4px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.04)",
};

const avatarStyle = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontWeight: "bold",
  fontSize: 20,
  boxShadow: "0 4px 12px rgba(0, 212, 255, 0.3)",
};

const userInfoTextStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  flex: 1,
};

const userLabelStyle = {
  fontSize: 12,
  color: "rgba(0,0,0,0.4)",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const userEmailStyle = {
  fontSize: 15,
  color: "#1a1a2e",
  fontWeight: 600,
};

const userBadgeStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  background: "rgba(16, 185, 129, 0.1)",
  borderRadius: 100,
  fontSize: 12,
  fontWeight: 600,
  color: "#10B981",
  border: "1px solid rgba(16, 185, 129, 0.2)",
};

const dotStyle = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#10B981",
  boxShadow: "0 0 8px #10B981",
};

/* SEARCH AND PAGINATION STYLES */
const searchContainerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 15,
  marginBottom: 20,
  marginTop: 10,
};

const searchInputStyle = {
  flex: 1,
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.1)",
  background: "#fff",
  fontSize: 14,
  outline: "none",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

const searchResultStyle = {
  fontSize: 13,
  color: "#666",
  fontWeight: 500,
};

const paginationContainerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  marginTop: 25,
  padding: "15px 0",
};

const paginationBtnStyle = (disabled) => ({
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: disabled ? "rgba(0,0,0,0.05)" : "#fff",
  color: disabled ? "rgba(0,0,0,0.3)" : "#1976D2",
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  boxShadow: disabled ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
  transition: "all 0.2s ease",
});

const pageNumbersStyle = {
  display: "flex",
  gap: 6,
};

const pageNumberStyle = (isActive) => ({
  width: 36,
  height: 36,
  borderRadius: 8,
  border: "none",
  background: isActive ? "linear-gradient(135deg, #1976D2 0%, #2196F3 100%)" : "#fff",
  color: isActive ? "#fff" : "#666",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: isActive ? "0 4px 12px rgba(25, 118, 210, 0.3)" : "0 2px 8px rgba(0,0,0,0.04)",
  transition: "all 0.2s ease",
});

/* OLD STYLES - Keeping for reference */
const sidebarStyle = {
  width: 250,
  background: "linear-gradient(180deg, #1976D2 0%, #1565C0 100%)",
  padding: "25px 15px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  boxShadow: "2px 0 10px rgba(0,0,0,0.1)"
};

const mainContentStyleOld = {
  flex: 1,
  padding: 30,
  background: "#f4f6f8",
  overflowY: "auto"
};

const summaryContainer = {
  display: "flex",
  gap: 20,
  marginTop: 20
};

const card = {
  background: "#fff",
  padding: "25px 20px",
  borderRadius: 12,
  flex: 1,
  textAlign: "center",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  transition: "transform 0.3s",
  cursor: "pointer",
  border: "1px solid #eee"
};

const number = {
  fontSize: 32,
  fontWeight: "bold",
  margin: "10px 0 0 0",
  color: "#333"
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 20,
  background: "#fff",
  borderRadius: 8,
  overflow: "hidden",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
};

const thead = {
  background: "linear-gradient(90deg, #2196F3 0%, #1976D2 100%)",
  color: "#fff"
};

const th = {
  padding: "15px 10px",
  border: "none",
  textAlign: "center",
  fontSize: "14px",
  fontWeight: "bold"
};

const td = {
  padding: "12px 10px",
  border: "1px solid #eee",
  textAlign: "center",
  fontSize: "14px"
};

const rowEven = { background: "#f9f9f9" };
const rowOdd = { background: "#fff" };

const viewBtn = {
  padding: "8px 16px",
  marginRight: 8,
  background: "#2196F3",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  fontSize: "13px",
  fontWeight: "bold",
  transition: "background 0.3s"
};

const downloadBtn = {
  padding: "8px 16px",
  background: "#4CAF50",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  fontSize: "13px",
  fontWeight: "bold",
  transition: "background 0.3s"
};
