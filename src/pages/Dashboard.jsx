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
  MdFilterList
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
  
  // Delete functionality states
  const [selectedViews, setSelectedViews] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [dateFilter, setDateFilter] = useState("all");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(null);

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
    window.open(`${window.location.origin}/p/${encoded}`,"_blank");
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


  if(!authChecked) return <div style={{padding:40}}>Loading...</div>;
  if(!user) return <Navigate to="/login"/>;


  return(
    <div style={{display:"flex", height:"100vh", fontFamily:"Arial"}}>

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

      {/* SIDEBAR */}
      <div style={sidebarStyle}>
        <h2 style={{color:"#fff", display:"flex", alignItems:"center", gap:10, marginBottom:20}}>
          <MdDashboard size={28} />
          <span>Admin</span>
        </h2>

        <button 
          style={sidebarBtn(activeTab==="home")} 
          onClick={()=>setActiveTab("home")}
        >
          <MdHome size={20} style={{marginRight:10}} />
          Dashboard
        </button>

        <button 
          style={sidebarBtn(activeTab==="proposals")} 
          onClick={()=>setActiveTab("proposals")}
        >
          <MdPictureAsPdf size={20} style={{marginRight:10}} />
          Proposals
        </button>

        <button 
          style={sidebarBtn(activeTab==="upload")} 
          onClick={()=>setActiveTab("upload")}
        >
          <MdFileUpload size={20} style={{marginRight:10}} />
          Upload Proposal
        </button>

        <button 
          style={sidebarBtn(activeTab==="views")} 
          onClick={()=>setActiveTab("views")}
        >
          <MdRemoveRedEye size={20} style={{marginRight:10}} />
          Live Views
        </button>

        <button 
          style={sidebarBtn(activeTab==="engagement")} 
          onClick={()=>setActiveTab("engagement")}
        >
          <MdTimeline size={20} style={{marginRight:10}} />
          Engagement
        </button>

        <button
          onClick={handleLogout}
          style={{
            marginTop:"auto",
            padding:12,
            border:"none",
            borderRadius:6,
            cursor:"pointer",
            background:"#e53935",
            color:"#fff",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            gap:8,
            fontSize:"16px",
            fontWeight:"bold",
            transition:"background 0.3s"
          }}
          onMouseEnter={(e)=>e.currentTarget.style.background="#c62828"}
          onMouseLeave={(e)=>e.currentTarget.style.background="#e53935"}
        >
          <MdLogout size={22}/>
          Logout
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div style={mainContentStyle}>
        {/* User Info Bar */}
        <div style={{
          background: "#e3f2fd",
          padding: "10px 20px",
          borderRadius: 8,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "#1976D2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: "bold",
            fontSize: 18
          }}>
            {user?.email?.charAt(0).toUpperCase() || "A"}
          </div>
          <div>
            <strong>Logged in as:</strong> {user?.email}
          </div>
        </div>

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
              Views per Proposal
            </h3>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={proposalChartData}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="name"/>
                <YAxis/>
                <Tooltip/>
                <Bar dataKey="views" fill="#2196F3"/>
              </BarChart>
            </ResponsiveContainer>

            <h3 style={{marginTop:40, display:"flex", alignItems:"center", gap:8}}>
              <MdAnalytics color="#4CAF50" />
              Daily View Traffic
            </h3>

            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="date"/>
                <YAxis/>
                <Tooltip/>
                <Line type="monotone" dataKey="views" stroke="#4CAF50" strokeWidth={3}/>
              </LineChart>
            </ResponsiveContainer>
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

            {loadingFiles ? (
              <p>Loading...</p>
            ) : (
              <table style={table}>
                <thead>
                  <tr style={thead}>
                    <th style={th}>File</th>
                    <th style={th}>Views</th>
                    <th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file,i)=>(
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
            )}
          </>
        )}

        {/* LIVE VIEWS with Delete */}
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
              Showing {getFilteredViews().length} of {views.length} views
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
                {getFilteredViews().map((v, i) => (
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
                {getFilteredViews().length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                      No views found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* ENGAGEMENT with Delete */}
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
              Showing {getFilteredSessions().length} of {sessions.length} sessions
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
                {getFilteredSessions().map((s, i) => (
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
                {getFilteredSessions().length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                      No engagement data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
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
      `}</style>
    </div>
  );
}

/* STYLES */
const sidebarStyle = {
  width: 250,
  background: "linear-gradient(180deg, #1976D2 0%, #1565C0 100%)",
  padding: "25px 15px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  boxShadow: "2px 0 10px rgba(0,0,0,0.1)"
};

const sidebarBtn = (active) => ({
  padding: "12px 15px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  background: active ? "rgba(255,255,255,0.2)" : "transparent",
  color: "#fff",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  fontSize: "15px",
  fontWeight: active ? "bold" : "normal",
  transition: "all 0.3s",
  backdropFilter: active ? "blur(5px)" : "none",
  ":hover": {
    background: "rgba(255,255,255,0.1)"
  }
});

const mainContentStyle = {
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