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
  MdChevronRight,
  MdInfo,
  MdEdit,
  MdPerson,
  MdEmail,
  MdSchedule,
  MdCheckCircleOutline
} from "react-icons/md";
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { Navigate, useNavigate } from "react-router-dom";
import ProposalUploader from "./ProposalUploader";
import ProposalStatusBadge from "./ProposalStatusBadge";

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
  const [signedProposals, setSignedProposals] = useState([]);
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
  const [showLogoutToast, setShowLogoutToast] = useState(false);
  
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

  /* UPDATED LOGOUT WITH TOAST */
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowLogoutModal(false);
      setShowLogoutToast(true);
      
      // Auto redirect after 2 seconds
      setTimeout(() => {
        setShowLogoutToast(false);
        navigate("/login");
      }, 2000);
    } catch (error) {
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

  /* LISTEN TO SIGNED PROPOSALS */
  useEffect(()=>{
    if (!user) return;
    const q = query(
      collection(db, "signedProposals"),
      orderBy("signedAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot)=>{
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        signedAt: doc.data().signedAt?.toDate?.() || new Date()
      }));
      setSignedProposals(data);
    });
    return ()=>unsub();
  },[user]);

  /* COUNT VIEWS PER FILE */
  const getViewCount = (fileName)=>{
    return views.filter(v=>v.fileName===fileName).length;
  };

  /* ========== IMPROVED CHART DATA ========== */

  // Helper function to get week number
  const getWeekNumber = (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  // Calculate daily views for charts
  const dailyViews = {};
  views.forEach(v=>{
    if(!v.viewedAt) return;
    const date = new Date(v.viewedAt).toLocaleDateString();
    if(!dailyViews[date]) dailyViews[date] = 0;
    dailyViews[date]++;
  });

  const rawDailyChartData = Object.keys(dailyViews).map(date=>({
    date,
    views: dailyViews[date]
  }));

  // Process daily chart data - aggregate by week if too many points
  const getDailyChartData = () => {
    if (rawDailyChartData.length === 0) return [];
    
    // Get date range
    const dates = rawDailyChartData.map(d => new Date(d.date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const dayDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
    
    // If data spans more than 30 days, aggregate by week
    if (dayDiff > 30) {
      const weeklyData = {};
      
      rawDailyChartData.forEach(item => {
        const date = new Date(item.date);
        // Get week number and year
        const weekNumber = getWeekNumber(date);
        const weekKey = `${date.getFullYear()}-W${weekNumber}`;
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            date: `W${weekNumber}, ${date.getFullYear()}`,
            views: 0,
            originalDate: date
          };
        }
        weeklyData[weekKey].views += item.views;
      });
      
      // Convert to array and sort by date
      return Object.values(weeklyData)
        .sort((a, b) => a.originalDate - b.originalDate)
        .map(item => ({
          date: item.date,
          views: item.views
        }));
    }
    
    // If data spans 30 days or less, show daily but limit to last 30 days
    return rawDailyChartData.slice(-30);
  };

  // Process proposals chart data - show top 10 if too many
  const getProposalChartData = () => {
    // If there are too many files, show top 10 by views
    if (files.length > 10) {
      // Calculate views for each file and sort
      const filesWithViews = files.map(file => ({
        name: file.name,
        views: getViewCount(file.name),
        fullName: file.name
      }));
      
      // Sort by views (descending) and take top 10
      return filesWithViews
        .sort((a, b) => b.views - a.views)
        .slice(0, 10)
        .map(file => ({
          ...file,
          name: file.name.length > 12 ? file.name.substring(0, 10) + "..." : file.name
        }));
    }
    
    // If 10 or fewer files, show all
    return files.map(file => ({
      name: file.name.length > 12 ? file.name.substring(0, 10) + "..." : file.name,
      views: getViewCount(file.name),
      fullName: file.name
    }));
  };

  const proposalChartData = getProposalChartData();
  const processedDailyChartData = getDailyChartData();

  /* VIEW PROPOSAL */
  const viewProposal = (file)=>{
    const fullPath = `proposals/${file.name}`;
    const encoded = btoa(fullPath);
    const url = `${window.location.origin}/p/${encoded}`;
    setViewUrl(url);
    setViewingFile(file);
    setShowViewModal(true);
  };

  /* HANDLE SIGN PROPOSAL */
  const handleSignProposal = (file) => {
    const fullPath = `proposals/${file.name}`;
    const encoded = btoa(fullPath);
    // Open signing page in new tab
    window.open(`/sign/${encoded}`, '_blank');
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
                onClick={handleLogout}
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

      {/* LOGOUT SUCCESS TOAST NOTIFICATION */}
      {showLogoutToast && (
        <div style={toastOverlayStyle}>
          <div style={toastContainerStyle}>
            <div style={toastIconSectionStyle}>
              <div style={toastIconWrapperStyle}>
                <MdCheckCircle size={28} color="#10B981" />
              </div>
            </div>
            
            <div style={toastContentSectionStyle}>
              <div style={toastTitleStyle}>Logged Out Successfully</div>
              <div style={toastMessageStyle}>You have been securely logged out</div>
              
              <div style={toastProgressContainerStyle}>
                <div style={toastProgressBarStyle} />
              </div>
            </div>
            
            <button 
              onClick={() => setShowLogoutToast(false)}
              style={toastCloseButtonStyle}
            >
              <MdCancel size={18} color="#94A3B8" />
            </button>
          </div>
          <div style={toastTimerStyle}>
            Redirecting to login...
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
            style={sidebarBtn(activeTab==="signed", sidebarCollapsed)} 
            onClick={()=>setActiveTab("signed")}
          >
            <MdCheckCircleOutline size={sidebarCollapsed ? 28 : 22} />
            {!sidebarCollapsed && <span>Signed</span>}
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
          @keyframes toastSlideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes toastFadeOut {
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
          @keyframes toastShrink {
            from {
              width: 100%;
            }
            to {
              width: 0%;
            }
          }
          /* Responsive table styles */
          table {
            width: 100%;
            table-layout: fixed;
            word-wrap: break-word;
          }
          td, th {
            word-break: break-word;
            overflow-wrap: break-word;
          }
          .action-buttons {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            justify-content: center;
          }
          @media (max-width: 768px) {
            .action-buttons {
              flex-direction: column;
            }
            .timestamp-cell {
              font-size: 11px;
            }
          }
        `}</style>

        {/* DASHBOARD */}
        {activeTab==="home" && (
          <>
            <h2 style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
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
                <MdCheckCircleOutline size={32} color="#10B981" style={{marginBottom:10}} />
                <h3>Signed</h3>
                <p style={number}>{signedProposals.length}</p>
              </div>

              <div style={card}>
                <MdAnalytics size={32} color="#FF9800" style={{marginBottom:10}} />
                <h3>Unique Viewers</h3>
                <p style={number}>
                  {new Set(views.filter(v=>v.viewerId).map(v=>v.viewerId)).size}
                </p>
              </div>
            </div>

            <h3 style={{marginTop:40, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
              <MdTimeline color="#2196F3" />
              Analytics Overview
            </h3>

            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(400px, 1fr))", gap:30, marginTop:20}}>
              {/* Views per Proposal Chart */}
              <div style={{minWidth:0, background:"#fff", padding:"20px", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                <h4 style={{marginBottom:15, color:"#333", fontSize:16}}>
                  Views per Proposal {files.length > 10 && "(Top 10)"}
                </h4>
                <div style={{width:"100%", height:350}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={proposalChartData} 
                      margin={{top:20, right:30, left:20, bottom:70}}
                    >
                      <CartesianGrid strokeDasharray="3 3"/>
                      <XAxis 
                        dataKey="name" 
                        tick={{fontSize:11}} 
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        dy={10}
                      />
                      <YAxis 
                        tick={{fontSize:11}}
                        label={{ 
                          value: 'Number of Views', 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { fontSize: 12, fill: '#666' }
                        }}
                      />
                      <Tooltip 
                        formatter={(value) => [`${value} views`, 'Views']}
                        labelFormatter={(label) => {
                          const file = files.find(f => f.name.startsWith(label.replace('...', '')));
                          return file ? file.name : label;
                        }}
                      />
                      <Bar 
                        dataKey="views" 
                        fill="#2196F3"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {files.length > 10 && (
                  <p style={{fontSize:12, color:'#666', marginTop:10, textAlign:'center'}}>
                    Showing top 10 proposals by views. Total proposals: {files.length}
                  </p>
                )}
              </div>

              {/* Daily View Traffic Chart */}
              <div style={{minWidth:0, background:"#fff", padding:"20px", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                <h4 style={{marginBottom:15, color:"#333", fontSize:16}}>
                  Daily View Traffic {processedDailyChartData.length < rawDailyChartData.length && "(Weekly Aggregated)"}
                </h4>
                <div style={{width:"100%", height:350}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={processedDailyChartData} 
                      margin={{top:20, right:30, left:20, bottom:70}}
                    >
                      <CartesianGrid strokeDasharray="3 3"/>
                      <XAxis 
                        dataKey="date" 
                        tick={{fontSize:11}} 
                        interval={Math.floor(processedDailyChartData.length / 8)}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                        dy={10}
                      />
                      <YAxis 
                        tick={{fontSize:11}}
                        label={{ 
                          value: 'Number of Views', 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { fontSize: 12, fill: '#666' }
                        }}
                      />
                      <Tooltip 
                        formatter={(value) => [`${value} views`, 'Views']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="views" 
                        stroke="#4CAF50" 
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#4CAF50" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {processedDailyChartData.length < rawDailyChartData.length && (
                  <p style={{fontSize:12, color:'#666', marginTop:10, textAlign:'center'}}>
                    Data aggregated by week for better readability ({rawDailyChartData.length} days condensed to {processedDailyChartData.length} weeks)
                  </p>
                )}
              </div>
            </div>

            {/* Top User Performance */}
            <h3 style={{marginTop:40, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
              <MdAnalytics color="#FF9800" />
              Top User Performance
            </h3>

            <div style={{marginTop:20, overflowX:"auto"}}>
              <table style={{...table, minWidth:"600px"}}>
                <thead>
                  <tr style={thead}>
                    <th style={th}>Rank</th>
                    <th style={th}>Viewer Email</th>
                    <th style={th}>Time Spent</th>
                    <th style={th}>Pages</th>
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
                          <td style={{...td, maxWidth:"200px", overflow:"hidden", textOverflow:"ellipsis"}}>
                            {user.email}
                          </td>
                          <td style={td}>
                            <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center", flexWrap:"wrap"}}>
                              <MdTimeline color="#FF9800" size={16} />
                              {Math.round(user.duration / 1000)} sec
                            </div>
                          </td>
                          <td style={td}>
                            <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center", flexWrap:"wrap"}}>
                              <MdDescription color="#4CAF50" size={16} />
                              {user.pages}
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
            <h2 style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
              <MdFileUpload size={28} color="#1976D2" />
              Upload New Proposal
            </h2>
            <ProposalUploader/>
          </>
        )}

        {/* PROPOSALS */}
        {activeTab==="proposals" && (
          <>
            <h2 style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
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
                {filteredProposals.length} found
              </span>
            </div>

            {loadingFiles ? (
              <p>Loading...</p>
            ) : (
              <>
                <div style={tableWrapperStyle}>
                  <table style={{...table}}>
                    <thead>
                      <tr style={thead}>
                        <th style={{...th, width:"40%"}}>File</th>
                        <th style={{...th, width:"15%"}}>Status</th>
                        <th style={{...th, width:"10%"}}>Views</th>
                        <th style={{...th, width:"35%"}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProposals.map((file,i) => {
                        // Check if this proposal is signed
                        const isSigned = signedProposals.some(p => 
                          p.proposalName === file.name || p.proposalPath?.includes(file.name)
                        );
                        
                        return (
                          <tr key={i} style={i%2===0?rowEven:rowOdd}>
                            <td style={{...td, textAlign:"left"}}>
                              <div style={{display:"flex", alignItems:"center", gap:8}}>
                                <MdDescription color={isSigned ? "#10B981" : "#1976D2"} style={{flexShrink:0}} />
                                <span style={{wordBreak:"break-word"}}>{file.name}</span>
                              </div>
                            </td>
                            <td style={td}>
                              {isSigned ? (
                                <ProposalStatusBadge status="signed" size="small" />
                              ) : (
                                <ProposalStatusBadge status="pending" size="small" />
                              )}
                            </td>
                            <td style={td}>
                              <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center"}}>
                                {getViewCount(file.name)} <MdRemoveRedEye color="#666" size={16} />
                              </div>
                            </td>
                            <td style={td}>
                              <div className="action-buttons">
                                <button style={compactViewBtn} onClick={()=>viewProposal(file)}>
                                  <MdVisibility size={14} />
                                  <span>View</span>
                                </button>
                                <button style={compactDownloadBtn} onClick={()=>downloadFile(file)}>
                                  <MdFileUpload size={14} />
                                  <span>Download</span>
                                </button>
                                <button 
                                  style={compactSignBtn} 
                                  onClick={() => handleSignProposal(file)}
                                >
                                  <MdEdit size={14} />
                                  <span>Sign</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
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
                      {Array.from({length: Math.min(5, totalProposalPages)}, (_, i) => {
                        let pageNum;
                        if (totalProposalPages <= 5) {
                          pageNum = i + 1;
                        } else if (proposalPage <= 3) {
                          pageNum = i + 1;
                        } else if (proposalPage >= totalProposalPages - 2) {
                          pageNum = totalProposalPages - 4 + i;
                        } else {
                          pageNum = proposalPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setProposalPage(pageNum)}
                            style={pageNumberStyle(proposalPage === pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
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

        {/* SIGNED PROPOSALS TAB */}
        {activeTab==="signed" && (
          <>
            <div style={headerActionsStyle}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MdCheckCircleOutline size={28} color="#10B981" />
                Signed Proposals
              </h2>
              
              <div style={summaryStatsStyle}>
                <div style={statBadgeStyle}>
                  <span style={statLabelStyle}>Total Signed</span>
                  <span style={statValueStyle}>{signedProposals.length}</span>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div style={searchContainerStyle}>
              <input
                type="text"
                placeholder="Search signed proposals..."
                value={viewsSearch}
                onChange={(e) => {
                  setViewsSearch(e.target.value);
                  setViewsPage(1);
                }}
                style={searchInputStyle}
              />
              <span style={searchResultStyle}>
                {signedProposals.length} found
              </span>
            </div>

            <div style={tableWrapperStyle}>
              <table style={{...table}}>
                <thead>
                  <tr style={thead}>
                    <th style={{...th, width:"25%"}}>Proposal</th>
                    <th style={{...th, width:"20%"}}>Signed By</th>
                    <th style={{...th, width:"20%"}}>Email</th>
                    <th style={{...th, width:"15%"}}>Date Signed</th>
                    <th style={{...th, width:"10%"}}>Signature</th>
                    <th style={{...th, width:"10%"}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {signedProposals.map((proposal, i) => (
                    <tr key={proposal.id || i} style={i % 2 === 0 ? rowEven : rowOdd}>
                      <td style={{...td, textAlign:"left"}}>
                        <div style={{display:"flex", alignItems:"center", gap:8}}>
                          <MdDescription color="#10B981" style={{flexShrink:0}} />
                          <span style={{wordBreak:"break-word"}}>
                            {proposal.proposalName || proposal.fileName || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td style={{...td, wordBreak:"break-word"}}>
                        <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center"}}>
                          <MdPerson size={14} color="#64748b" />
                          {proposal.signedBy || 'Unknown'}
                        </div>
                      </td>
                      <td style={{...td, wordBreak:"break-word"}}>
                        <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center"}}>
                          <MdEmail size={14} color="#64748b" />
                          {proposal.signerEmail || 'N/A'}
                        </div>
                      </td>
                      <td style={{...td, fontSize:"12px"}}>
                        <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center"}}>
                          <MdSchedule size={14} color="#64748b" />
                          {proposal.signedAt ? new Date(proposal.signedAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td style={td}>
                        {proposal.signatureType === 'draw' ? (
                          <span style={signatureBadgeStyle}>🖊️ Drawn</span>
                        ) : (
                          <span style={signatureBadgeStyle}>📝 Typed</span>
                        )}
                      </td>
                      <td style={td}>
                        <button
                          onClick={() => {
                            if (proposal.proposalPath) {
                              const encoded = btoa(proposal.proposalPath);
                              window.open(`/sign/${encoded}`, '_blank');
                            }
                          }}
                          style={compactViewBtn}
                        >
                          <MdVisibility size={14} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {signedProposals.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 50 }}>
                        <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:15}}>
                          <MdCheckCircleOutline size={48} color="#ccc" />
                          <p style={{color:"#999", fontSize:16, margin:0}}>No signed proposals yet</p>
                          <p style={{color:"#999", fontSize:14}}>
                            When clients sign proposals, they will appear here
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Cards */}
            {signedProposals.length > 0 && (
              <div style={signedSummaryStyle}>
                <div style={summaryCardStyle}>
                  <MdCheckCircle size={24} color="#10B981" />
                  <div>
                    <span style={summaryCardLabelStyle}>Total Signatures</span>
                    <span style={summaryCardValueStyle}>{signedProposals.length}</span>
                  </div>
                </div>
                
                <div style={summaryCardStyle}>
                  <MdPerson size={24} color="#3b82f6" />
                  <div>
                    <span style={summaryCardLabelStyle}>Unique Signers</span>
                    <span style={summaryCardValueStyle}>
                      {new Set(signedProposals.map(p => p.signerEmail)).size}
                    </span>
                  </div>
                </div>
                
                <div style={summaryCardStyle}>
                  <MdSchedule size={24} color="#8b5cf6" />
                  <div>
                    <span style={summaryCardLabelStyle}>Last Signed</span>
                    <span style={summaryCardValueStyle}>
                      {signedProposals[0]?.signedAt 
                        ? new Date(signedProposals[0].signedAt).toLocaleDateString() 
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* LIVE VIEWS with Delete and Search */}
        {activeTab==="views" && (
          <>
            <div style={headerActionsStyle}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MdRemoveRedEye size={28} color="#1976D2" />
                Live Views
              </h2>
              
              <div style={actionButtonsGroupStyle}>
                {/* Filter Dropdown */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={filterSelectStyle}
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
                    style={deleteButtonStyle}
                  >
                    <MdDelete size={18} />
                    Delete ({selectedViews.length})
                  </button>
                )}

                {/* Delete All Filtered Button */}
                {getFilteredViews().length > 0 && (
                  <button
                    onClick={() => {
                      setDeleteType("filteredViews");
                      setShowDeleteModal(true);
                    }}
                    style={filteredDeleteButtonStyle}
                  >
                    <MdDelete size={18} />
                    Delete {getFilteredViews().length}
                  </button>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div style={searchContainerStyle}>
              <input
                type="text"
                placeholder="Search by file, email or ID..."
                value={viewsSearch}
                onChange={(e) => {
                  setViewsSearch(e.target.value);
                  setViewsPage(1);
                }}
                style={searchInputStyle}
              />
              <span style={searchResultStyle}>
                {filteredViews.length} found
              </span>
            </div>

            {/* Filter Info */}
            <div style={filterInfoStyle}>
              <MdFilterList color="#1976D2" />
              Showing {paginatedViews.length} of {filteredViews.length} views
              {dateFilter !== "all" && ` (${dateFilter})`}
            </div>

            <div style={tableWrapperStyle}>
              <table style={{...table}}>
                <thead>
                  <tr style={thead}>
                    <th style={{...th, width:"5%"}}>
                      <input
                        type="checkbox"
                        onChange={(e) => selectAllViews(e.target.checked)}
                        checked={selectedViews.length === views.length && views.length > 0}
                      />
                    </th>
                    <th style={{...th, width:"30%"}}>File</th>
                    <th style={{...th, width:"30%"}}>Viewer Email</th>
                    <th style={{...th, width:"20%"}}>Viewed At</th>
                    <th style={{...th, width:"15%"}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedViews.map((v, i) => (
                    <tr key={i} style={i % 2 === 0 ? rowEven : rowOdd}>
                      <td style={{...td, width:"5%"}}>
                        <input
                          type="checkbox"
                          checked={selectedViews.includes(v.id)}
                          onChange={() => toggleViewSelection(v.id)}
                        />
                      </td>
                      <td style={{...td, textAlign:"left"}}>
                        <div style={{display:"flex", alignItems:"center", gap:8}}>
                          <MdDescription color="#1976D2" style={{flexShrink:0}} />
                          <span style={{wordBreak:"break-word"}}>{v.fileName || "N/A"}</span>
                        </div>
                      </td>
                      <td style={{...td, wordBreak:"break-word"}}>{v.viewerEmail || "Anonymous"}</td>
                      <td style={{...td, fontSize:"12px", whiteSpace:"nowrap"}} className="timestamp-cell">
                        {v.viewedAt ? new Date(v.viewedAt).toLocaleString() : "Loading"}
                      </td>
                      <td style={td}>
                        <button
                          onClick={() => handleDeleteView(v.id, v.fileName)}
                          style={compactDeleteBtn}
                        >
                          <MdDelete size={14} />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginatedViews.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: 30 }}>
                        No views found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
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
                  {Array.from({length: Math.min(5, totalViewsPages)}, (_, i) => {
                    let pageNum;
                    if (totalViewsPages <= 5) {
                      pageNum = i + 1;
                    } else if (viewsPage <= 3) {
                      pageNum = i + 1;
                    } else if (viewsPage >= totalViewsPages - 2) {
                      pageNum = totalViewsPages - 4 + i;
                    } else {
                      pageNum = viewsPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setViewsPage(pageNum)}
                        style={pageNumberStyle(viewsPage === pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
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
            <div style={headerActionsStyle}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MdTimeline size={28} color="#1976D2" />
                Engagement Analytics
              </h2>
              
              <div style={actionButtonsGroupStyle}>
                {/* Filter Dropdown */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={filterSelectStyle}
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
                    style={deleteButtonStyle}
                  >
                    <MdDelete size={18} />
                    Delete ({selectedSessions.length})
                  </button>
                )}

                {/* Delete All Filtered Button */}
                {getFilteredSessions().length > 0 && (
                  <button
                    onClick={() => {
                      setDeleteType("filteredSessions");
                      setShowDeleteModal(true);
                    }}
                    style={filteredDeleteButtonStyle}
                  >
                    <MdDelete size={18} />
                    Delete {getFilteredSessions().length}
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
                {filteredEngagement.length} found
              </span>
            </div>

            {/* Filter Info */}
            <div style={filterInfoStyle}>
              <MdFilterList color="#1976D2" />
              Showing {paginatedEngagement.length} of {filteredEngagement.length} sessions
              {dateFilter !== "all" && ` (${dateFilter})`}
            </div>

            <div style={tableWrapperStyle}>
              <table style={{...table}}>
                <thead>
                  <tr style={thead}>
                    <th style={{...th, width:"5%"}}>
                      <input
                        type="checkbox"
                        onChange={(e) => selectAllSessions(e.target.checked)}
                        checked={selectedSessions.length === sessions.length && sessions.length > 0}
                      />
                    </th>
                    <th style={{...th, width:"25%"}}>Proposal</th>
                    <th style={{...th, width:"20%"}}>Viewer</th>
                    <th style={{...th, width:"15%"}}>Started</th>
                    <th style={{...th, width:"15%"}}>Last Active</th>
                    <th style={{...th, width:"10%"}}>Duration</th>
                    <th style={{...th, width:"10%"}}>Pages</th>
                    <th style={{...th, width:"10%"}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEngagement.map((s, i) => {
                    // Calculate duration safely
                    let durationSeconds = 0;
                    if (s.duration) {
                      durationSeconds = Math.round(s.duration / 1000);
                    } else if (s.startedAt && s.lastActiveAt) {
                      // If no duration field, calculate from timestamps
                      const start = s.startedAt?.seconds ? new Date(s.startedAt.seconds * 1000) : null;
                      const last = s.lastActiveAt?.seconds ? new Date(s.lastActiveAt.seconds * 1000) : null;
                      if (start && last) {
                        durationSeconds = Math.round((last - start) / 1000);
                      }
                    }

                    // Format dates safely
                    const formatDate = (timestamp) => {
                      if (!timestamp) return 'N/A';
                      try {
                        const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
                        return date.toLocaleString();
                      } catch (e) {
                        return 'Invalid date';
                      }
                    };

                    // Get page count safely
                    const pageCount = s.pagesViewed?.length || s.pageCount || 0;

                    return (
                      <tr key={s.id || i} style={i % 2 === 0 ? rowEven : rowOdd}>
                        <td style={{...td, width:"5%"}}>
                          <input
                            type="checkbox"
                            checked={selectedSessions.includes(s.id)}
                            onChange={() => toggleSessionSelection(s.id)}
                          />
                        </td>
                        <td style={{...td, textAlign:"left"}}>
                          <div style={{display:"flex", alignItems:"center", gap:8}}>
                            <MdDescription color="#1976D2" style={{flexShrink:0}} />
                            <span style={{wordBreak:"break-word"}}>{s.fileName || 'Unknown'}</span>
                          </div>
                        </td>
                        <td style={{...td, wordBreak:"break-word"}}>
                          {s.viewerEmail || s.viewerId || 'Anonymous'}
                        </td>
                        <td style={{...td, fontSize:"11px", whiteSpace:"nowrap"}}>
                          {formatDate(s.startedAt)}
                        </td>
                        <td style={{...td, fontSize:"11px", whiteSpace:"nowrap"}}>
                          {formatDate(s.lastActiveAt)}
                        </td>
                        <td style={td}>
                          <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center"}}>
                            <MdTimeline color="#FF9800" size={16} />
                            <span style={{fontWeight:"bold"}}>
                              {durationSeconds > 0 ? `${durationSeconds}s` : '0s'}
                            </span>
                          </div>
                        </td>
                        <td style={td}>
                          <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center"}}>
                            <MdDescription color="#4CAF50" size={16} />
                            <span style={{fontWeight:"bold"}}>{pageCount}</span>
                          </div>
                        </td>
                        <td style={td}>
                          <button
                            onClick={() => handleDeleteSession(s.id, s.fileName)}
                            style={compactDeleteBtn}
                          >
                            <MdDelete size={14} />
                            <span>Delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedEngagement.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 30 }}>
                        <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:10}}>
                          <MdTimeline size={40} color="#ccc" />
                          <p style={{color:"#999", fontSize:14}}>No engagement data found</p>
                          <p style={{color:"#999", fontSize:12}}>Sessions will appear here when viewers interact with proposals</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Stats */}
            {sessions.length > 0 && (
              <div style={{
                display: "flex",
                gap: 16,
                marginTop: 20,
                padding: "16px 20px",
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #eee",
                flexWrap: "wrap"
              }}>
                <div style={{flex:1, minWidth:150}}>
                  <div style={{fontSize:12, color:"#666", marginBottom:4}}>Total Sessions</div>
                  <div style={{fontSize:24, fontWeight:"bold", color:"#1976D2"}}>{sessions.length}</div>
                </div>
                <div style={{flex:1, minWidth:150}}>
                  <div style={{fontSize:12, color:"#666", marginBottom:4}}>Avg Time Spent</div>
                  <div style={{fontSize:24, fontWeight:"bold", color:"#FF9800"}}>
                    {Math.round(sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / sessions.length / 1000)}s
                  </div>
                </div>
                <div style={{flex:1, minWidth:150}}>
                  <div style={{fontSize:12, color:"#666", marginBottom:4}}>Total Pages Viewed</div>
                  <div style={{fontSize:24, fontWeight:"bold", color:"#4CAF50"}}>
                    {sessions.reduce((acc, s) => acc + (s.pagesViewed?.length || s.pageCount || 0), 0)}
                  </div>
                </div>
                <div style={{flex:1, minWidth:150}}>
                  <div style={{fontSize:12, color:"#666", marginBottom:4}}>Unique Viewers</div>
                  <div style={{fontSize:24, fontWeight:"bold", color:"#9C27B0"}}>
                    {new Set(sessions.map(s => s.viewerId || s.viewerEmail)).size}
                  </div>
                </div>
              </div>
            )}
            
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
                  {Array.from({length: Math.min(5, totalEngagementPages)}, (_, i) => {
                    let pageNum;
                    if (totalEngagementPages <= 5) {
                      pageNum = i + 1;
                    } else if (engagementPage <= 3) {
                      pageNum = i + 1;
                    } else if (engagementPage >= totalEngagementPages - 2) {
                      pageNum = totalEngagementPages - 4 + i;
                    } else {
                      pageNum = engagementPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setEngagementPage(pageNum)}
                        style={pageNumberStyle(engagementPage === pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
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

/* Responsive table wrapper */
const tableWrapperStyle = {
  width: "100%",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  borderRadius: "8px",
  border: "1px solid #eee",
  marginBottom: "10px"
};

/* Header actions styling */
const headerActionsStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
  flexWrap: "wrap",
  gap: 10
};

const actionButtonsGroupStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap"
};

const filterSelectStyle = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  fontSize: "13px"
};

const deleteButtonStyle = {
  padding: "8px 12px",
  background: "#d32f2f",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontWeight: "bold",
  fontSize: "13px",
  whiteSpace: "nowrap"
};

const filteredDeleteButtonStyle = {
  padding: "8px 12px",
  background: "#ff9800",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: "13px",
  whiteSpace: "nowrap"
};

const filterInfoStyle = {
  background: "#e3f2fd",
  padding: "8px 15px",
  borderRadius: 6,
  marginBottom: 15,
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  flexWrap: "wrap"
};

/* Compact action buttons */
const compactViewBtn = {
  padding: "6px 10px",
  background: "#2196F3",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: "12px",
  fontWeight: "bold",
  whiteSpace: "nowrap"
};

const compactDownloadBtn = {
  padding: "6px 10px",
  background: "#4CAF50",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: "12px",
  fontWeight: "bold",
  whiteSpace: "nowrap"
};

const compactSignBtn = {
  padding: "6px 10px",
  background: "#10B981",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: "12px",
  fontWeight: "bold",
  whiteSpace: "nowrap"
};

const compactDeleteBtn = {
  padding: "6px 10px",
  background: "#d32f2f",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: "12px",
  whiteSpace: "nowrap"
};

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
  padding: "30px 20px",
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
  padding: "16px 20px",
  borderRadius: 16,
  marginBottom: 30,
  display: "flex",
  alignItems: "center",
  gap: 16,
  boxShadow: "0 4px 20px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.04)",
  flexWrap: "wrap",
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
  flexShrink: 0,
};

const userInfoTextStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  flex: 1,
  minWidth: "200px",
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
  wordBreak: "break-all",
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
  whiteSpace: "nowrap",
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
  flexWrap: "wrap",
};

const searchInputStyle = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.1)",
  background: "#fff",
  fontSize: 14,
  outline: "none",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  minWidth: "200px",
};

const searchResultStyle = {
  fontSize: 13,
  color: "#666",
  fontWeight: 500,
  whiteSpace: "nowrap",
};

const paginationContainerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  marginTop: 25,
  padding: "15px 0",
  flexWrap: "wrap",
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
  whiteSpace: "nowrap",
});

const pageNumbersStyle = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
  justifyContent: "center",
};

const pageNumberStyle = (isActive) => ({
  width: 36,
  height: 36,
  borderRadius: 6,
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
const summaryContainer = {
  display: "flex",
  gap: 16,
  marginTop: 20,
  flexWrap: "wrap"
};

const card = {
  background: "#fff",
  padding: "20px 16px",
  borderRadius: 12,
  flex: "1 1 180px",
  textAlign: "center",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  transition: "transform 0.3s",
  cursor: "pointer",
  border: "1px solid #eee",
  minWidth: "160px",
};

const number = {
  fontSize: 28,
  fontWeight: "bold",
  margin: "8px 0 0 0",
  color: "#333"
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#fff",
  borderRadius: 8,
  overflow: "hidden",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  tableLayout: "fixed",
};

const thead = {
  background: "linear-gradient(90deg, #2196F3 0%, #1976D2 100%)",
  color: "#fff"
};

const th = {
  padding: "12px 6px",
  border: "none",
  textAlign: "center",
  fontSize: "12px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const td = {
  padding: "10px 6px",
  border: "1px solid #eee",
  textAlign: "center",
  fontSize: "12px",
  verticalAlign: "middle",
  wordBreak: "break-word",
};

const rowEven = { background: "#f9f9f9" };
const rowOdd = { background: "#fff" };

/* Toast Notification Styles */
const toastOverlayStyle = {
  position: "fixed",
  top: "30px",
  right: "30px",
  zIndex: 10000,
  maxWidth: "380px",
  minWidth: "320px",
  animation: "toastSlideIn 0.3s ease, toastFadeOut 0.3s ease 1.7s forwards",
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05)",
  borderRadius: "16px",
  overflow: "hidden",
};

const toastContainerStyle = {
  background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
  borderRadius: "16px",
  padding: "18px 22px",
  display: "flex",
  alignItems: "flex-start",
  gap: "16px",
  border: "1px solid rgba(16, 185, 129, 0.3)",
  boxShadow: "0 0 30px rgba(16, 185, 129, 0.2)",
  position: "relative",
  overflow: "hidden",
  backdropFilter: "blur(10px)",
};

const toastIconSectionStyle = {
  flexShrink: 0,
};

const toastIconWrapperStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  background: "rgba(16, 185, 129, 0.15)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "2px solid rgba(16, 185, 129, 0.3)",
  animation: "pulse 2s infinite",
  boxShadow: "0 0 20px rgba(16, 185, 129, 0.3)",
};

const toastContentSectionStyle = {
  flex: 1,
};

const toastTitleStyle = {
  color: "#fff",
  fontSize: "16px",
  fontWeight: "700",
  marginBottom: "4px",
  letterSpacing: "-0.3px",
  background: "linear-gradient(135deg, #fff 0%, #e0e0e0 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const toastMessageStyle = {
  color: "rgba(255, 255, 255, 0.7)",
  fontSize: "13px",
  marginBottom: "12px",
};

const toastProgressContainerStyle = {
  width: "100%",
  height: "4px",
  background: "rgba(255, 255, 255, 0.1)",
  borderRadius: "4px",
  overflow: "hidden",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
};

const toastProgressBarStyle = {
  height: "100%",
  width: "100%",
  background: "linear-gradient(90deg, #10B981, #34D399, #10B981)",
  backgroundSize: "200% 100%",
  animation: "toastShrink 2s linear forwards",
  borderRadius: "4px",
  boxShadow: "0 0 10px #10B981",
};

const toastCloseButtonStyle = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "6px",
  opacity: 0.7,
  transition: "all 0.2s",
  position: "relative",
  zIndex: 2,
};

const toastTimerStyle = {
  background: "rgba(0, 0, 0, 0.4)",
  backdropFilter: "blur(4px)",
  padding: "10px 16px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.8)",
  textAlign: "center",
  borderTop: "1px solid rgba(255, 255, 255, 0.05)",
  letterSpacing: "0.3px",
};

/* Signed Proposals Styles */
const signedSummaryStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "20px",
  marginTop: "25px",
};

const summaryCardStyle = {
  background: "#fff",
  borderRadius: "12px",
  padding: "20px",
  display: "flex",
  alignItems: "center",
  gap: "15px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const summaryCardLabelStyle = {
  display: "block",
  fontSize: "12px",
  color: "#64748b",
  marginBottom: "4px",
};

const summaryCardValueStyle = {
  display: "block",
  fontSize: "24px",
  fontWeight: "700",
  color: "#1a1a2e",
};

const signatureBadgeStyle = {
  display: "inline-block",
  padding: "4px 8px",
  background: "#f1f5f9",
  borderRadius: "4px",
  fontSize: "11px",
  color: "#64748b",
};

const summaryStatsStyle = {
  display: "flex",
  gap: "10px",
};

const statBadgeStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "#f0fdf4",
  borderRadius: "100px",
  border: "1px solid #86efac",
};

const statLabelStyle = {
  fontSize: "13px",
  color: "#166534",
};

const statValueStyle = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#059669",
};