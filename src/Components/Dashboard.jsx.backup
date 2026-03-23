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
  MdShare,
  MdContentCopy,
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

  // Share proposal modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingProposal, setSharingProposal] = useState(null);
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [showShareSuccess, setShowShareSuccess] = useState(false);

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

  /* HANDLE SHARE PROPOSAL */
  const handleShareProposal = (file) => {
    setSharingProposal(file);
    setClientEmail("");
    setClientName("");
    setShareLink("");
    setShowShareModal(true);
  };

  /* FIXED: GENERATE SHARE LINK - SINGLE ENCODING ONLY */
  const generateShareLink = async () => {
    if (!clientEmail) {
      alert("Please enter client email");
      return;
    }

    try {
      const fullPath = `proposals/${sharingProposal.name}`;
      
      // Encode the path ONLY ONCE
      const encodedPath = btoa(fullPath);
      
      // Create the correct share link - use /p/ route
      const link = `${window.location.origin}/p/${encodedPath}`;
      
      setShareLink(link);
      setShowShareSuccess(true);
      
      // Auto hide success message after 3 seconds
      setTimeout(() => {
        setShowShareSuccess(false);
      }, 3000);
      
    } catch (error) {
      console.error("Error generating link:", error);
      alert("Error generating link: " + error.message);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    alert("Link copied to clipboard!");
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

  /* ========== SIMPLIFIED CHART DATA FUNCTIONS ========== */

  // Process proposals chart data
  const getProposalChartData = () => {
    if (!files.length) return [];
    
    // Calculate views for each file
    const data = files.map(file => {
      const viewCount = views.filter(v => v.fileName === file.name).length;
      return {
        name: file.name.length > 20 ? file.name.substring(0, 17) + "..." : file.name,
        views: viewCount
      };
    });
    
    // Sort by views (descending) and return top 10
    return data.sort((a, b) => b.views - a.views).slice(0, 10);
  };

  // Calculate daily views for charts
  const getDailyViewsData = () => {
    const dailyViewsMap = {};
    
    views.forEach(v => {
      if (!v.viewedAt) return;
      
      try {
        let dateStr;
        if (v.viewedAt?.toDate) {
          // Firebase timestamp
          dateStr = v.viewedAt.toDate().toLocaleDateString();
        } else if (v.viewedAt instanceof Date) {
          dateStr = v.viewedAt.toLocaleDateString();
        } else if (typeof v.viewedAt === 'string') {
          dateStr = new Date(v.viewedAt).toLocaleDateString();
        } else if (v.viewedAt?.seconds) {
          // Firebase timestamp object
          dateStr = new Date(v.viewedAt.seconds * 1000).toLocaleDateString();
        } else {
          return;
        }
        
        dailyViewsMap[dateStr] = (dailyViewsMap[dateStr] || 0) + 1;
      } catch (e) {
        console.error("Error processing date:", e);
      }
    });
    
    return Object.entries(dailyViewsMap)
      .map(([date, views]) => ({ date, views }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Set the chart data
  const proposalChartData = getProposalChartData();
  const dailyChartData = getDailyViewsData();

  // Log for debugging
  console.log("Views count:", views.length);
  console.log("Proposal chart data:", proposalChartData);
  console.log("Daily chart data:", dailyChartData);

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
        const collectionName = deleteItem.type === "view" ? "proposalViews" : "proposalSessions";
        await deleteDoc(doc(db, collectionName, deleteItem.id));
        setDeleteSuccess(`Successfully deleted ${deleteItem.name}`);
      } else if (deleteType === "views" && selectedViews.length > 0) {
        const batch = writeBatch(db);
        selectedViews.forEach(id => {
          const ref = doc(db, "proposalViews", id);
          batch.delete(ref);
        });
        await batch.commit();
        setDeleteSuccess(`Successfully deleted ${selectedViews.length} views`);
        setSelectedViews([]);
      } else if (deleteType === "sessions" && selectedSessions.length > 0) {
        const batch = writeBatch(db);
        selectedSessions.forEach(id => {
          const ref = doc(db, "proposalSessions", id);
          batch.delete(ref);
        });
        await batch.commit();
        setDeleteSuccess(`Successfully deleted ${selectedSessions.length} sessions`);
        setSelectedSessions([]);
      } else if (deleteType === "filteredViews") {
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

  const totalProposalPages = Math.ceil(filteredProposals.length / proposalsPerPage);

  // Filter views based on search query
  const filteredViews = views.filter(v =>
    (v.fileName || "").toLowerCase().includes(viewsSearch.toLowerCase()) ||
    (v.viewerEmail || "").toLowerCase().includes(viewsSearch.toLowerCase()) ||
    (v.viewerId || "").toLowerCase().includes(viewsSearch.toLowerCase())
  );

  const paginatedViews = filteredViews.slice(
    (viewsPage - 1) * viewsPerPage,
    viewsPage * viewsPerPage
  );

  const totalViewsPages = Math.ceil(filteredViews.length / viewsPerPage);

  // Filter engagement based on search query
  const filteredEngagement = sessions.filter(s =>
    (s.fileName || "").toLowerCase().includes(engagementSearch.toLowerCase()) ||
    (s.viewerEmail || "").toLowerCase().includes(engagementSearch.toLowerCase())
  );

  const paginatedEngagement = filteredEngagement.slice(
    (engagementPage - 1) * engagementPerPage,
    engagementPage * engagementPerPage
  );

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
        <div style={{
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
        }}>
          <div style={{
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
          }}>
            <div style={{flexShrink: 0}}>
              <div style={{
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
              }}>
                <MdCheckCircle size={28} color="#10B981" />
              </div>
            </div>
            
            <div style={{flex: 1}}>
              <div style={{
                color: "#fff",
                fontSize: "16px",
                fontWeight: "700",
                marginBottom: "4px",
                letterSpacing: "-0.3px",
                background: "linear-gradient(135deg, #fff 0%, #e0e0e0 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>Logged Out Successfully</div>
              <div style={{
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: "13px",
                marginBottom: "12px",
              }}>You have been securely logged out</div>
              
              <div style={{
                width: "100%",
                height: "4px",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "4px",
                overflow: "hidden",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
              }}>
                <div style={{
                  height: "100%",
                  width: "100%",
                  background: "linear-gradient(90deg, #10B981, #34D399, #10B981)",
                  backgroundSize: "200% 100%",
                  animation: "toastShrink 2s linear forwards",
                  borderRadius: "4px",
                  boxShadow: "0 0 10px #10B981",
                }} />
              </div>
            </div>
            
            <button 
              onClick={() => setShowLogoutToast(false)}
              style={{
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
              }}
            >
              <MdCancel size={18} color="#94A3B8" />
            </button>
          </div>
          <div style={{
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)",
            padding: "10px 16px",
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.8)",
            textAlign: "center",
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            letterSpacing: "0.3px",
          }}>
            Redirecting to login...
          </div>
        </div>
      )}

      {/* SHARE PROPOSAL MODAL - CORRECTLY PLACED */}
      {showShareModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: "20px",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "24px",
            padding: "30px",
            maxWidth: "500px",
            width: "90%",
            boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
          }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "22px", color: "#1a1a2e" }}>
              Share Proposal
            </h3>
            <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: "14px" }}>
              Share "{sharingProposal?.name}" with a client
            </p>

            {!shareLink ? (
              <>
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", color: "#666" }}>
                    Client Email *
                  </label>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", color: "#666" }}>
                    Client Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => setShowShareModal(false)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#64748b",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generateShareLink}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Generate Link
                  </button>
                </div>
              </>
            ) : (
              <>
                {showShareSuccess && (
                  <div style={{
                    background: "#f0fdf4",
                    border: "1px solid #86efac",
                    color: "#10B981",
                    padding: "12px",
                    borderRadius: "8px",
                    marginBottom: "20px",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}>
                    <MdCheckCircle size={18} />
                    Link generated successfully!
                  </div>
                )}

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "13px", color: "#666" }}>
                    Share this link with your client:
                  </label>
                  <div style={{
                    display: "flex",
                    gap: "10px",
                    background: "#f8fafc",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                  }}>
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      style={{
                        flex: 1,
                        padding: "10px",
                        border: "none",
                        background: "transparent",
                        fontSize: "13px",
                        color: "#00D4FF",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={copyToClipboard}
                      style={{
                        padding: "8px 16px",
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        color: "#666",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <MdContentCopy size={16} />
                      Copy
                    </button>
                  </div>
                </div>

                <div style={{
                  background: "#fff3cd",
                  border: "1px solid #ffeeba",
                  color: "#856404",
                  padding: "12px",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  fontSize: "13px",
                }}>
                  <strong>Note:</strong> The client will need to log in to view this proposal.
                </div>

                <button
                  onClick={() => setShowShareModal(false)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#2196F3",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </>
            )}
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
      <div style={{
        position: "relative",
        width: sidebarCollapsed ? 100 : 280,
        minWidth: sidebarCollapsed ? 100 : 280,
        padding: "20px 12px",
        transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        willChange: "width, min-width",
      }}>

        <div style={{
          width: sidebarCollapsed ? 76 : 256,
          height: "calc(100vh - 40px)",
          background: "linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.98) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: 24,
          padding: sidebarCollapsed ? "30px 10px" : "30px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 0 60px rgba(0, 212, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          position: "relative",
          overflow: "hidden",
          transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: "width, padding",
        }}>

          <div style={{
            position: "relative",
            paddingBottom: 20,
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            marginBottom: 10,
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}>
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
              style={{
                padding: sidebarCollapsed ? "16px" : "14px 18px",
                border: "none",
                borderRadius: 14,
                cursor: "pointer",
                background: activeTab==="home" 
                  ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                  : "transparent",
                color: activeTab==="home" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: 12,
                fontSize: sidebarCollapsed ? 0 : 15,
                fontWeight: activeTab==="home" ? 600 : 500,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                overflow: "hidden",
                boxShadow: activeTab==="home" 
                  ? "0 4px 20px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)" 
                  : "none",
                border: activeTab==="home" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
              }} 
              onClick={()=>setActiveTab("home")}
            >
              <MdHome size={sidebarCollapsed ? 28 : 22} />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </button>

            <button 
              style={{
                padding: sidebarCollapsed ? "16px" : "14px 18px",
                border: "none",
                borderRadius: 14,
                cursor: "pointer",
                background: activeTab==="proposals" 
                  ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                  : "transparent",
                color: activeTab==="proposals" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: 12,
                fontSize: sidebarCollapsed ? 0 : 15,
                fontWeight: activeTab==="proposals" ? 600 : 500,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                overflow: "hidden",
                boxShadow: activeTab==="proposals" 
                  ? "0 4px 20px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)" 
                  : "none",
                border: activeTab==="proposals" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
              }} 
              onClick={()=>setActiveTab("proposals")}
            >
              <MdPictureAsPdf size={sidebarCollapsed ? 28 : 22} />
              {!sidebarCollapsed && <span>Proposals</span>}
            </button>

            <button 
              style={{
                padding: sidebarCollapsed ? "16px" : "14px 18px",
                border: "none",
                borderRadius: 14,
                cursor: "pointer",
                background: activeTab==="signed" 
                  ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                  : "transparent",
                color: activeTab==="signed" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: 12,
                fontSize: sidebarCollapsed ? 0 : 15,
                fontWeight: activeTab==="signed" ? 600 : 500,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                overflow: "hidden",
                boxShadow: activeTab==="signed" 
                  ? "0 4px 20px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)" 
                  : "none",
                border: activeTab==="signed" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
              }} 
              onClick={()=>setActiveTab("signed")}
            >
              <MdCheckCircleOutline size={sidebarCollapsed ? 28 : 22} />
              {!sidebarCollapsed && <span>Signed</span>}
            </button>

            <button 
              style={{
                padding: sidebarCollapsed ? "16px" : "14px 18px",
                border: "none",
                borderRadius: 14,
                cursor: "pointer",
                background: activeTab==="upload" 
                  ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                  : "transparent",
                color: activeTab==="upload" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: 12,
                fontSize: sidebarCollapsed ? 0 : 15,
                fontWeight: activeTab==="upload" ? 600 : 500,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                overflow: "hidden",
                boxShadow: activeTab==="upload" 
                  ? "0 4px 20px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)" 
                  : "none",
                border: activeTab==="upload" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
              }} 
              onClick={()=>setActiveTab("upload")}
            >
              <MdFileUpload size={sidebarCollapsed ? 28 : 22} />
              {!sidebarCollapsed && <span>Upload</span>}
            </button>

            <button 
              style={{
                padding: sidebarCollapsed ? "16px" : "14px 18px",
                border: "none",
                borderRadius: 14,
                cursor: "pointer",
                background: activeTab==="views" 
                  ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                  : "transparent",
                color: activeTab==="views" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: 12,
                fontSize: sidebarCollapsed ? 0 : 15,
                fontWeight: activeTab==="views" ? 600 : 500,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                overflow: "hidden",
                boxShadow: activeTab==="views" 
                  ? "0 4px 20px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)" 
                  : "none",
                border: activeTab==="views" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
              }} 
              onClick={()=>setActiveTab("views")}
            >
              <MdRemoveRedEye size={sidebarCollapsed ? 28 : 22} />
              {!sidebarCollapsed && <span>Live Views</span>}
            </button>

            <button 
              style={{
                padding: sidebarCollapsed ? "16px" : "14px 18px",
                border: "none",
                borderRadius: 14,
                cursor: "pointer",
                background: activeTab==="engagement" 
                  ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                  : "transparent",
                color: activeTab==="engagement" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: 12,
                fontSize: sidebarCollapsed ? 0 : 15,
                fontWeight: activeTab==="engagement" ? 600 : 500,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                overflow: "hidden",
                boxShadow: activeTab==="engagement" 
                  ? "0 4px 20px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)" 
                  : "none",
                border: activeTab==="engagement" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
              }} 
              onClick={()=>setActiveTab("engagement")}
            >
              <MdTimeline size={sidebarCollapsed ? 28 : 22} />
              {!sidebarCollapsed && <span>Engagement</span>}
            </button>

          </div>

          <button
            onClick={() => setShowLogoutModal(true)}
            style={{
              marginTop: "auto",
              padding: sidebarCollapsed ? "14px" : "14px 18px",
              border: "none",
              borderRadius: 14,
              cursor: "pointer",
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%)",
              color: "#EF4444",
              display: "flex",
              alignItems: "center",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: sidebarCollapsed ? 0 : 10,
              fontSize: sidebarCollapsed ? 0 : 15,
              fontWeight: 600,
              transition: "all 0.3s ease",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              boxShadow: "0 4px 15px rgba(239, 68, 68, 0.15)",
            }}
          >
            <MdLogout size={sidebarCollapsed ? 26 : 22}/>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>

        </div>

        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
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
          }}
        >
          {sidebarCollapsed ? <MdChevronRight size={32} /> : <MdChevronLeft size={32} />}
        </button>

      </div>

      {/* MAIN CONTENT */}
      <div style={{
        flex: 1,
        padding: "30px 20px",
        background: "#f4f6f8",
        overflowY: "auto",
        overflowX: "hidden",
        borderRadius: "24px 0 0 0",
        minHeight: "100vh",
        width: sidebarCollapsed ? "calc(100% - 100px)" : "calc(100% - 280px)",
      }}>

        {/* User Info Bar */}
        <div style={{
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
        }}>
          <div style={{
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
          }}>
            {user?.email?.charAt(0).toUpperCase() || "A"}
          </div>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flex: 1,
            minWidth: "200px",
          }}>
            <div style={{
              fontSize: 12,
              color: "rgba(0,0,0,0.4)",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>Welcome back,</div>
            <div style={{
              fontSize: 15,
              color: "#1a1a2e",
              fontWeight: 600,
              wordBreak: "break-all",
            }}>{user?.email}</div>
          </div>
          <div style={{
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
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#10B981",
              boxShadow: "0 0 8px #10B981",
            }}></span>
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
          
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
            }
            50% {
              box-shadow: 0 0 20px 5px rgba(16, 185, 129, 0.2);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
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
        {activeTab === "home" && (
          <>
            <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <MdDashboard size={28} color="#1976D2" />
              Dashboard Summary
            </h2>

            <div style={{
              display: "flex",
              gap: 16,
              marginTop: 20,
              flexWrap: "wrap"
            }}>
              <div style={{
                background: "#fff",
                padding: "20px 16px",
                borderRadius: 12,
                flex: "1 1 180px",
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                border: "1px solid #eee",
                minWidth: "160px",
              }}>
                <MdDescription size={32} color="#1976D2" style={{ marginBottom: 10 }} />
                <h3>Total Proposals</h3>
                <p style={{ fontSize: 28, fontWeight: "bold", margin: "8px 0 0 0", color: "#333" }}>{files.length}</p>
              </div>

              <div style={{
                background: "#fff",
                padding: "20px 16px",
                borderRadius: 12,
                flex: "1 1 180px",
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                border: "1px solid #eee",
                minWidth: "160px",
              }}>
                <MdRemoveRedEye size={32} color="#4CAF50" style={{ marginBottom: 10 }} />
                <h3>Total Views</h3>
                <p style={{ fontSize: 28, fontWeight: "bold", margin: "8px 0 0 0", color: "#333" }}>{views.length}</p>
              </div>

              <div style={{
                background: "#fff",
                padding: "20px 16px",
                borderRadius: 12,
                flex: "1 1 180px",
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                border: "1px solid #eee",
                minWidth: "160px",
              }}>
                <MdCheckCircleOutline size={32} color="#10B981" style={{ marginBottom: 10 }} />
                <h3>Signed</h3>
                <p style={{ fontSize: 28, fontWeight: "bold", margin: "8px 0 0 0", color: "#333" }}>{signedProposals.length}</p>
              </div>

              <div style={{
                background: "#fff",
                padding: "20px 16px",
                borderRadius: 12,
                flex: "1 1 180px",
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                border: "1px solid #eee",
                minWidth: "160px",
              }}>
                <MdAnalytics size={32} color="#FF9800" style={{ marginBottom: 10 }} />
                <h3>Unique Viewers</h3>
                <p style={{ fontSize: 28, fontWeight: "bold", margin: "8px 0 0 0", color: "#333" }}>
                  {new Set(views.filter(v => v.viewerId).map(v => v.viewerId)).size}
                </p>
              </div>
            </div>

            {/* FIXED ANALYTICS OVERVIEW SECTION */}
            <h3 style={{ marginTop: 40, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <MdTimeline color="#2196F3" />
              Analytics Overview
            </h3>

            {/* Debug info to see what data is available */}
            <div style={{ 
              marginBottom: 20, 
              padding: 10, 
              background: "#f0f0f0", 
              borderRadius: 8,
              fontSize: 12,
              color: "#666"
            }}>
              <strong>Debug Info:</strong><br />
              Total Views: {views.length}<br />
              Proposals: {files.length}<br />
              Chart Data Points: {proposalChartData.length}<br />
              Daily Data Points: {dailyChartData.length}
            </div>

            {/* First chart - Views per Proposal */}
            <div style={{ 
              background: "#fff", 
              borderRadius: 12, 
              padding: 20, 
              marginBottom: 30,
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)" 
            }}>
              <h4 style={{ margin: "0 0 20px 0", color: "#333", fontSize: 16 }}>
                Views per Proposal {files.length > 10 && "(Top 10)"}
              </h4>
              
              {/* Fixed height container for chart */}
              <div style={{ width: "100%", height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={proposalChartData.length ? proposalChartData : [{ name: "No Data", views: 0 }]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={70}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="views" fill="#2196F3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {files.length === 0 && (
                <p style={{ textAlign: "center", color: "#999", marginTop: 20 }}>No proposals uploaded yet</p>
              )}
            </div>

            {/* Second chart - Daily View Traffic */}
            <div style={{ 
              background: "#fff", 
              borderRadius: 12, 
              padding: 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)" 
            }}>
              <h4 style={{ margin: "0 0 20px 0", color: "#333", fontSize: 16 }}>
                Daily View Traffic
              </h4>
              
              {/* Fixed height container for chart */}
              <div style={{ width: "100%", height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dailyChartData.length ? dailyChartData : [{ date: "No Data", views: 0 }]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      angle={-45} 
                      textAnchor="end" 
                      height={70}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="views" stroke="#4CAF50" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {views.length === 0 && (
                <p style={{ textAlign: "center", color: "#999", marginTop: 20 }}>No view data available yet</p>
              )}
            </div>

            {/* Top User Performance */}
            <h3 style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <MdAnalytics color="#FF9800" />
              Top User Performance
            </h3>

            <div style={{ marginTop: 20, overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#fff",
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                tableLayout: "fixed",
                minWidth: "600px"
              }}>
                <thead>
                  <tr style={{
                    background: "linear-gradient(90deg, #2196F3 0%, #1976D2 100%)",
                    color: "#fff"
                  }}>
                    <th style={{ padding: "12px 6px", textAlign: "center", fontSize: "12px" }}>Rank</th>
                    <th style={{ padding: "12px 6px", textAlign: "center", fontSize: "12px" }}>Viewer Email</th>
                    <th style={{ padding: "12px 6px", textAlign: "center", fontSize: "12px" }}>Time Spent</th>
                    <th style={{ padding: "12px 6px", textAlign: "center", fontSize: "12px" }}>Pages</th>
                    <th style={{ padding: "12px 6px", textAlign: "center", fontSize: "12px" }}>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
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
                        <tr key={i} style={i % 2 === 0 ? { background: "#f9f9f9" } : { background: "#fff" }}>
                          <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%",
                              background: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#e0e0e0",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontWeight: "bold", fontSize: 14, margin: "0 auto"
                            }}>{i + 1}</div>
                          </td>
                          <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>{user.email}</td>
                          <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                            {Math.round(user.duration / 1000)} sec
                          </td>
                          <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                            {user.pages}
                          </td>
                          <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                            {user.sessions}
                          </td>
                        </tr>
                      ));
                  })()}
                  {sessions.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 30 }}>No engagement data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* UPLOAD */}
        {activeTab === "upload" && (
          <>
            <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <MdFileUpload size={28} color="#1976D2" />
              Upload New Proposal
            </h2>
            <ProposalUploader />
          </>
        )}

        {/* PROPOSALS TAB WITH SHARE BUTTON */}
        {activeTab === "proposals" && (
          <>
            <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <MdPictureAsPdf size={28} color="#1976D2" />
              Uploaded Proposals
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 20, marginTop: 10, flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Search proposals..."
                value={proposalSearch}
                onChange={(e) => { setProposalSearch(e.target.value); setProposalPage(1); }}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)",
                  background: "#fff", fontSize: 14, outline: "none", minWidth: "200px"
                }}
              />
              <span style={{ fontSize: 13, color: "#666", fontWeight: 500, whiteSpace: "nowrap" }}>
                {filteredProposals.length} found
              </span>
            </div>

            {loadingFiles ? (
              <p>Loading...</p>
            ) : (
              <>
                <div style={{ width: "100%", overflowX: "auto", borderRadius: "8px", border: "1px solid #eee", marginBottom: "10px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", tableLayout: "fixed" }}>
                    <thead>
                      <tr style={{ background: "linear-gradient(90deg, #2196F3 0%, #1976D2 100%)", color: "#fff" }}>
                        <th style={{ padding: "12px 6px", width: "35%" }}>File</th>
                        <th style={{ padding: "12px 6px", width: "10%" }}>Status</th>
                        <th style={{ padding: "12px 6px", width: "10%" }}>Views</th>
                        <th style={{ padding: "12px 6px", width: "45%" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProposals.map((file, i) => {
                        const isSigned = signedProposals.some(p => p.proposalName === file.name || p.proposalPath?.includes(file.name));
                        return (
                          <tr key={i} style={i % 2 === 0 ? { background: "#f9f9f9" } : { background: "#fff" }}>
                            <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "left" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <MdDescription color={isSigned ? "#10B981" : "#1976D2"} />
                                <span>{file.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                              {isSigned ? <ProposalStatusBadge status="signed" size="small" /> : <ProposalStatusBadge status="pending" size="small" />}
                            </td>
                            <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                              {getViewCount(file.name)} <MdRemoveRedEye color="#666" size={16} />
                            </td>
                            <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                              <div className="action-buttons" style={{ display: "flex", gap: "4px", flexWrap: "wrap", justifyContent: "center" }}>
                                <button style={{
                                  padding: "6px 10px",
                                  background: "#2196F3",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4
                                }} onClick={() => viewProposal(file)}>
                                  <MdVisibility size={14} /> View
                                </button>
                                
                                <button style={{
                                  padding: "6px 10px",
                                  background: "#4CAF50",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4
                                }} onClick={() => downloadFile(file)}>
                                  <MdFileUpload size={14} /> Download
                                </button>
                                
                                {/* SHARE BUTTON - Only in Proposals tab */}
                                <button style={{
                                  padding: "6px 10px",
                                  background: "#FF9800",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4
                                }} onClick={() => handleShareProposal(file)}>
                                  <MdShare size={14} /> Share
                                </button>
                                
                                <button style={{
                                  padding: "6px 10px",
                                  background: "#10B981",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4
                                }} onClick={() => handleSignProposal(file)}>
                                  <MdEdit size={14} /> Sign
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {totalProposalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 25, flexWrap: "wrap" }}>
                    <button onClick={() => setProposalPage(p => Math.max(1, p - 1))} disabled={proposalPage === 1}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: proposalPage === 1 ? "rgba(0,0,0,0.05)" : "#fff", color: proposalPage === 1 ? "rgba(0,0,0,0.3)" : "#1976D2", cursor: proposalPage === 1 ? "not-allowed" : "pointer" }}>
                      Previous
                    </button>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {Array.from({ length: Math.min(5, totalProposalPages) }, (_, i) => {
                        let pageNum;
                        if (totalProposalPages <= 5) pageNum = i + 1;
                        else if (proposalPage <= 3) pageNum = i + 1;
                        else if (proposalPage >= totalProposalPages - 2) pageNum = totalProposalPages - 4 + i;
                        else pageNum = proposalPage - 2 + i;
                        return (
                          <button key={pageNum} onClick={() => setProposalPage(pageNum)}
                            style={{ width: 36, height: 36, borderRadius: 6, border: "none", background: proposalPage === pageNum ? "linear-gradient(135deg, #1976D2 0%, #2196F3 100%)" : "#fff", color: proposalPage === pageNum ? "#fff" : "#666", cursor: "pointer" }}>
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => setProposalPage(p => Math.min(totalProposalPages, p + 1))} disabled={proposalPage === totalProposalPages}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: proposalPage === totalProposalPages ? "rgba(0,0,0,0.05)" : "#fff", color: proposalPage === totalProposalPages ? "rgba(0,0,0,0.3)" : "#1976D2", cursor: proposalPage === totalProposalPages ? "not-allowed" : "pointer" }}>
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* SIGNED PROPOSALS TAB */}
        {activeTab === "signed" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MdCheckCircleOutline size={28} color="#10B981" />
                Signed Proposals
              </h2>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: "#f0fdf4", borderRadius: "100px", border: "1px solid #86efac" }}>
                  <span style={{ fontSize: "13px", color: "#166534" }}>Total Signed</span>
                  <span style={{ fontSize: "16px", fontWeight: "700", color: "#059669" }}>{signedProposals.length}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 20, marginTop: 10, flexWrap: "wrap" }}>
              <input type="text" placeholder="Search signed proposals..." value={viewsSearch}
                onChange={(e) => { setViewsSearch(e.target.value); setViewsPage(1); }}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", minWidth: "200px" }} />
              <span style={{ fontSize: 13, color: "#666", fontWeight: 500, whiteSpace: "nowrap" }}>{signedProposals.length} found</span>
            </div>

            <div style={{ width: "100%", overflowX: "auto", borderRadius: "8px", border: "1px solid #eee", marginBottom: "10px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ background: "linear-gradient(90deg, #2196F3 0%, #1976D2 100%)", color: "#fff" }}>
                    <th style={{ padding: "12px 6px", width: "25%" }}>Proposal</th>
                    <th style={{ padding: "12px 6px", width: "20%" }}>Signed By</th>
                    <th style={{ padding: "12px 6px", width: "20%" }}>Email</th>
                    <th style={{ padding: "12px 6px", width: "15%" }}>Date Signed</th>
                    <th style={{ padding: "12px 6px", width: "10%" }}>Signature</th>
                    <th style={{ padding: "12px 6px", width: "10%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {signedProposals.map((proposal, i) => (
                    <tr key={proposal.id || i} style={i % 2 === 0 ? { background: "#f9f9f9" } : { background: "#fff" }}>
                      <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <MdDescription color="#10B981" />
                          <span>{proposal.proposalName || proposal.fileName || 'Unknown'}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>{proposal.signedBy || 'Unknown'}</td>
                      <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>{proposal.signerEmail || 'N/A'}</td>
                      <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                        {proposal.signedAt ? new Date(proposal.signedAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                        {proposal.signatureType === 'draw' ? '🖊️ Drawn' : '📝 Typed'}
                      </td>
                      <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                        <button onClick={() => { if (proposal.proposalPath) { const encoded = btoa(proposal.proposalPath); window.open(`/sign/${encoded}`, '_blank'); } }}
                          style={{ padding: "6px 10px", background: "#2196F3", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
                          <MdVisibility size={14} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {signedProposals.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 50 }}>No signed proposals yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* LIVE VIEWS TAB */}
        {activeTab === "views" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}><MdRemoveRedEye size={28} color="#1976D2" /> Live Views</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", fontSize: "13px" }}>
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
                {selectedViews.length > 0 && (
                  <button onClick={() => { setDeleteType("views"); setShowDeleteModal(true); }}
                    style={{ padding: "8px 12px", background: "#d32f2f", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <MdDelete size={18} /> Delete ({selectedViews.length})
                  </button>
                )}
                {getFilteredViews().length > 0 && (
                  <button onClick={() => { setDeleteType("filteredViews"); setShowDeleteModal(true); }}
                    style={{ padding: "8px 12px", background: "#ff9800", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <MdDelete size={18} /> Delete {getFilteredViews().length}
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 20, flexWrap: "wrap" }}>
              <input type="text" placeholder="Search by file, email or ID..." value={viewsSearch}
                onChange={(e) => { setViewsSearch(e.target.value); setViewsPage(1); }}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", minWidth: "200px" }} />
              <span style={{ fontSize: 13, color: "#666" }}>{filteredViews.length} found</span>
            </div>

            <div style={{
              background: "#e3f2fd",
              padding: "8px 15px",
              borderRadius: 6,
              marginBottom: 15,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              flexWrap: "wrap"
            }}>
              <MdFilterList color="#1976D2" />
              Showing {paginatedViews.length} of {filteredViews.length} views
              {dateFilter !== "all" && ` (${dateFilter})`}
            </div>

            <div style={{
              width: "100%",
              overflowX: "auto",
              borderRadius: "8px",
              border: "1px solid #eee",
              marginBottom: "20px"
            }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                tableLayout: "fixed",
              }}>
                <thead>
                  <tr style={{ background: "linear-gradient(90deg, #2196F3 0%, #1976D2 100%)", color: "#fff" }}>
                    <th style={{ padding: "12px 6px", width: "5%" }}>
                      <input
                        type="checkbox"
                        onChange={(e) => selectAllViews(e.target.checked)}
                        checked={selectedViews.length === views.length && views.length > 0}
                      />
                    </th>
                    <th style={{ padding: "12px 6px", width: "30%" }}>File</th>
                    <th style={{ padding: "12px 6px", width: "30%" }}>Viewer Email</th>
                    <th style={{ padding: "12px 6px", width: "20%" }}>Viewed At</th>
                    <th style={{ padding: "12px 6px", width: "15%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedViews.map((v, i) => (
                    <tr key={i} style={i % 2 === 0 ? { background: "#f9f9f9" } : { background: "#fff" }}>
                      <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedViews.includes(v.id)}
                          onChange={() => toggleViewSelection(v.id)}
                        />
                      </td>
                      <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <MdDescription color="#1976D2" />
                          <span>{v.fileName || "N/A"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                        {v.viewerEmail || "Anonymous"}
                      </td>
                      <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                        {v.viewedAt ? new Date(v.viewedAt).toLocaleString() : "Loading"}
                      </td>
                      <td style={{ padding: "10px 6px", border: "1px solid #eee", textAlign: "center" }}>
                        <button
                          onClick={() => handleDeleteView(v.id, v.fileName)}
                          style={{
                            padding: "6px 10px",
                            background: "#d32f2f",
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          <MdDelete size={14} /> Delete
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
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                marginTop: 25,
                padding: "15px 0",
                flexWrap: "wrap",
              }}>
                <button 
                  onClick={() => setViewsPage(p => Math.max(1, p - 1))}
                  disabled={viewsPage === 1}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: viewsPage === 1 ? "rgba(0,0,0,0.05)" : "#fff",
                    color: viewsPage === 1 ? "rgba(0,0,0,0.3)" : "#1976D2",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: viewsPage === 1 ? "not-allowed" : "pointer",
                    boxShadow: viewsPage === 1 ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Previous
                </button>
                
                <div style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}>
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
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          border: "none",
                          background: viewsPage === pageNum ? "linear-gradient(135deg, #1976D2 0%, #2196F3 100%)" : "#fff",
                          color: viewsPage === pageNum ? "#fff" : "#666",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: viewsPage === pageNum ? "0 4px 12px rgba(25, 118, 210, 0.3)" : "0 2px 8px rgba(0,0,0,0.04)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button 
                  onClick={() => setViewsPage(p => Math.min(totalViewsPages, p + 1))}
                  disabled={viewsPage === totalViewsPages}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: viewsPage === totalViewsPages ? "rgba(0,0,0,0.05)" : "#fff",
                    color: viewsPage === totalViewsPages ? "rgba(0,0,0,0.3)" : "#1976D2",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: viewsPage === totalViewsPages ? "not-allowed" : "pointer",
                    boxShadow: viewsPage === totalViewsPages ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* ENGAGEMENT with Delete and Search */}
        {activeTab === "engagement" && (
          <>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
              flexWrap: "wrap",
              gap: 10
            }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MdTimeline size={28} color="#1976D2" />
                Engagement Analytics
              </h2>

              <div style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap"
              }}>
                {/* Filter Dropdown */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: "13px"
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
                    }}
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
                    style={{
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
                    }}
                  >
                    <MdDelete size={18} />
                    Delete {getFilteredSessions().length}
                  </button>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 15,
              marginBottom: 20,
              marginTop: 10,
              flexWrap: "wrap",
            }}>
              <input
                type="text"
                placeholder="Search by proposal or viewer..."
                value={engagementSearch}
                onChange={(e) => {
                  setEngagementSearch(e.target.value);
                  setEngagementPage(1);
                }}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "#fff",
                  fontSize: 14,
                  outline: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  minWidth: "200px",
                }}
              />
              <span style={{
                fontSize: 13,
                color: "#666",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}>
                {filteredEngagement.length} found
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
              fontSize: 13,
              flexWrap: "wrap"
            }}>
              <MdFilterList color="#1976D2" />
              Showing {paginatedEngagement.length} of {filteredEngagement.length} sessions
              {dateFilter !== "all" && ` (${dateFilter})`}
            </div>

            <div style={{
              width: "100%",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              borderRadius: "8px",
              border: "1px solid #eee",
              marginBottom: "10px"
            }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#fff",
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                tableLayout: "fixed",
              }}>
                <thead>
                  <tr style={{
                    background: "linear-gradient(90deg, #2196F3 0%, #1976D2 100%)",
                    color: "#fff"
                  }}>
                    <th style={{
                      padding: "12px 6px",
                      border: "none",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      width: "5%"
                    }}>
                      <input
                        type="checkbox"
                        onChange={(e) => selectAllSessions(e.target.checked)}
                        checked={selectedSessions.length === sessions.length && sessions.length > 0}
                      />
                    </th>
                    <th style={{
                      padding: "12px 6px",
                      border: "none",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      width: "25%"
                    }}>Proposal</th>
                    <th style={{
                      padding: "12px 6px",
                      border: "none",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      width: "20%"
                    }}>Viewer</th>
                    <th style={{
                      padding: "12px 6px",
                      border: "none",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      width: "15%"
                    }}>Started</th>
                    <th style={{
                      padding: "12px 6px",
                      border: "none",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      width: "15%"
                    }}>Last Active</th>
                    <th style={{
                      padding: "12px 6px",
                      border: "none",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      width: "10%"
                    }}>Time Spent</th>
                    <th style={{
                      padding: "12px 6px",
                      border: "none",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      width: "10%"
                    }}>Pages</th>
                    <th style={{
                      padding: "12px 6px",
                      border: "none",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      width: "10%"
                    }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEngagement.map((s, i) => {
                    // Calculate duration safely - check multiple possible field names
                    let durationSeconds = 0;
                    
                    // Check for duration field (could be in milliseconds or seconds)
                    if (s.duration) {
                      // If duration is in milliseconds, convert to seconds
                      if (s.duration > 1000) {
                        durationSeconds = Math.round(s.duration / 1000);
                      } else {
                        durationSeconds = Math.round(s.duration);
                      }
                    } 
                    // Check for timeSpent field
                    else if (s.timeSpent) {
                      durationSeconds = Math.round(s.timeSpent);
                    }
                    // Calculate from timestamps if available
                    else if (s.startedAt || s.startTime) {
                      const start = s.startedAt?.seconds 
                        ? new Date(s.startedAt.seconds * 1000) 
                        : s.startTime?.seconds 
                          ? new Date(s.startTime.seconds * 1000)
                          : s.startedAt 
                            ? new Date(s.startedAt)
                            : null;
                            
                      const end = s.lastActiveAt?.seconds 
                        ? new Date(s.lastActiveAt.seconds * 1000)
                        : s.endTime?.seconds
                          ? new Date(s.endTime.seconds * 1000)
                          : s.lastActiveAt
                            ? new Date(s.lastActiveAt)
                            : new Date(); // Use current time if no end time
                      
                      if (start) {
                        durationSeconds = Math.round((end - start) / 1000);
                      }
                    }

                    // Ensure durationSeconds is a positive number
                    durationSeconds = Math.max(0, durationSeconds);

                    // Format dates safely - handle multiple possible field names
                    const formatDate = (timestamp) => {
                      if (!timestamp) return 'N/A';
                      try {
                        if (timestamp.seconds) {
                          // Firebase timestamp
                          return new Date(timestamp.seconds * 1000).toLocaleString();
                        } else if (timestamp instanceof Date) {
                          return timestamp.toLocaleString();
                        } else {
                          // Try to parse as date string
                          return new Date(timestamp).toLocaleString();
                        }
                      } catch (e) {
                        return 'Invalid date';
                      }
                    };

                    // Get start time - check multiple possible field names
                    const startTime = s.startedAt || s.startTime || s.createdAt;
                    
                    // Get last active time - check multiple possible field names
                    const lastActive = s.lastActiveAt || s.endTime || s.updatedAt || s.lastActivity;

                    // Get page count safely - check multiple possible field names
                    const pageCount = s.pagesViewed?.length || 
                                     s.pageCount || 
                                     s.pages || 
                                     s.totalPages || 
                                     0;

                    // Get viewer name/email safely
                    const viewerName = s.viewerName || 
                                      s.name || 
                                      s.userName || 
                                      s.viewerEmail || 
                                      s.email || 
                                      s.userEmail || 
                                      'Anonymous';

                    // Get proposal name safely
                    const proposalName = s.fileName || 
                                        s.proposalName || 
                                        s.proposal || 
                                        s.documentName || 
                                        s.name || 
                                        'Unknown';

                    return (
                      <tr key={s.id || i} style={i % 2 === 0 ? { background: "#f9f9f9" } : { background: "#fff" }}>
                        <td style={{
                          padding: "10px 6px",
                          border: "1px solid #eee",
                          textAlign: "center",
                          fontSize: "12px",
                          verticalAlign: "middle",
                          wordBreak: "break-word",
                          width: "5%"
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedSessions.includes(s.id)}
                            onChange={() => toggleSessionSelection(s.id)}
                          />
                        </td>
                        <td style={{
                          padding: "10px 6px",
                          border: "1px solid #eee",
                          textAlign: "center",
                          fontSize: "12px",
                          verticalAlign: "middle",
                          wordBreak: "break-word",
                          textAlign: "left"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <MdDescription color="#1976D2" style={{ flexShrink: 0 }} />
                            <span style={{ wordBreak: "break-word" }}>{proposalName}</span>
                          </div>
                        </td>
                        <td style={{
                          padding: "10px 6px",
                          border: "1px solid #eee",
                          textAlign: "center",
                          fontSize: "12px",
                          verticalAlign: "middle",
                          wordBreak: "break-word",
                        }}>
                          {viewerName}
                        </td>
                        <td style={{
                          padding: "10px 6px",
                          border: "1px solid #eee",
                          textAlign: "center",
                          fontSize: "11px",
                          verticalAlign: "middle",
                          wordBreak: "break-word",
                          whiteSpace: "nowrap"
                        }}>
                          {formatDate(startTime)}
                        </td>
                        <td style={{
                          padding: "10px 6px",
                          border: "1px solid #eee",
                          textAlign: "center",
                          fontSize: "11px",
                          verticalAlign: "middle",
                          wordBreak: "break-word",
                          whiteSpace: "nowrap"
                        }}>
                          {formatDate(lastActive)}
                        </td>
                        <td style={{
                          padding: "10px 6px",
                          border: "1px solid #eee",
                          textAlign: "center",
                          fontSize: "12px",
                          verticalAlign: "middle",
                          wordBreak: "break-word",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
                            <MdTimeline color="#FF9800" size={16} />
                            <span style={{ fontWeight: "bold" }}>
                              {durationSeconds > 0 ? `${durationSeconds}s` : '< 1s'}
                            </span>
                          </div>
                        </td>
                        <td style={{
                          padding: "10px 6px",
                          border: "1px solid #eee",
                          textAlign: "center",
                          fontSize: "12px",
                          verticalAlign: "middle",
                          wordBreak: "break-word",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
                            <MdDescription color="#4CAF50" size={16} />
                            <span style={{ fontWeight: "bold" }}>{pageCount}</span>
                          </div>
                        </td>
                        <td style={{
                          padding: "10px 6px",
                          border: "1px solid #eee",
                          textAlign: "center",
                          fontSize: "12px",
                          verticalAlign: "middle",
                          wordBreak: "break-word",
                        }}>
                          <button
                            onClick={() => handleDeleteSession(s.id, proposalName)}
                            style={{
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
                            }}
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
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                          <MdTimeline size={40} color="#ccc" />
                          <p style={{ color: "#999", fontSize: 14, margin: 0 }}>No engagement data found</p>
                          <p style={{ color: "#999", fontSize: 12 }}>
                            Sessions will appear here when viewers interact with proposals
                          </p>
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
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Total Sessions</div>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#1976D2" }}>{sessions.length}</div>
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Avg Time Spent</div>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#FF9800" }}>
                    {(() => {
                      const totalDuration = sessions.reduce((acc, s) => {
                        if (s.duration) {
                          return acc + (s.duration > 1000 ? s.duration / 1000 : s.duration);
                        }
                        return acc;
                      }, 0);
                      const avgSeconds = Math.round(totalDuration / sessions.length);
                      return avgSeconds > 0 ? `${avgSeconds}s` : '< 1s';
                    })()}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Total Pages Viewed</div>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#4CAF50" }}>
                    {sessions.reduce((acc, s) => {
                      const pages = s.pagesViewed?.length || s.pageCount || s.pages || 0;
                      return acc + pages;
                    }, 0)}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Unique Viewers</div>
                  <div style={{ fontSize: 24, fontWeight: "bold", color: "#9C27B0" }}>
                    {new Set(sessions.map(s => s.viewerId || s.viewerEmail || s.email || s.userId)).size}
                  </div>
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalEngagementPages > 1 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                marginTop: 25,
                padding: "15px 0",
                flexWrap: "wrap",
              }}>
                <button
                  onClick={() => setEngagementPage(p => Math.max(1, p - 1))}
                  disabled={engagementPage === 1}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: engagementPage === 1 ? "rgba(0,0,0,0.05)" : "#fff",
                    color: engagementPage === 1 ? "rgba(0,0,0,0.3)" : "#1976D2",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: engagementPage === 1 ? "not-allowed" : "pointer",
                    boxShadow: engagementPage === 1 ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Previous
                </button>

                <div style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}>
                  {Array.from({ length: Math.min(5, totalEngagementPages) }, (_, i) => {
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
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          border: "none",
                          background: engagementPage === pageNum ? "linear-gradient(135deg, #1976D2 0%, #2196F3 100%)" : "#fff",
                          color: engagementPage === pageNum ? "#fff" : "#666",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          boxShadow: engagementPage === pageNum ? "0 4px 12px rgba(25, 118, 210, 0.3)" : "0 2px 8px rgba(0,0,0,0.04)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setEngagementPage(p => Math.min(totalEngagementPages, p + 1))}
                  disabled={engagementPage === totalEngagementPages}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: engagementPage === totalEngagementPages ? "rgba(0,0,0,0.05)" : "#fff",
                    color: engagementPage === totalEngagementPages ? "rgba(0,0,0,0.3)" : "#1976D2",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: engagementPage === totalEngagementPages ? "not-allowed" : "pointer",
                    boxShadow: engagementPage === totalEngagementPages ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
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