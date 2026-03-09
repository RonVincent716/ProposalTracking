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
  MdTimeline
} from "react-icons/md";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
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

  const [user,setUser] = useState(null);
  const [files,setFiles] = useState([]);
  const [views,setViews] = useState([]);
  const [sessions,setSessions] = useState([]);
  const [activeTab,setActiveTab] = useState("home");
  const [loadingFiles,setLoadingFiles] = useState(true);
  const [authChecked,setAuthChecked] = useState(false);

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
          viewedAt:d.viewedAt?.toDate?.() || null
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

    name:file.name.length > 20 ? file.name.substring(0,20)+"..." : file.name,
    views:getViewCount(file.name),
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
    views:dailyViews[date]

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

      const url = await getDownloadURL(
        ref(storage,`proposals/${file.name}`)
      );

      window.open(url,"_blank");

    }catch(error){

      alert(error.message);

    }

  };


  if(!authChecked) return <div style={{padding:40}}>Loading...</div>;

  if(!user) return <Navigate to="/login"/>;


  return(

  <div style={{display:"flex",height:"100vh",fontFamily:"Arial"}}>


  {/* SIDEBAR WITH ICONS */}

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
    {new Set(
    views
    .filter(v=>v.viewerId)
    .map(v=>v.viewerId)
    ).size}
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

  ):(

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


  {/* LIVE VIEWS */}

  {activeTab==="views" && (

  <>

    <h2 style={{display:"flex", alignItems:"center", gap:10}}>
      <MdRemoveRedEye size={28} color="#1976D2" />
      Live Proposal Views
    </h2>

  <table style={table}>

  <thead>
  <tr style={thead}>
  <th style={th}>File</th>
  <th style={th}>Viewer Email</th>
  <th style={th}>Viewer ID</th>
  <th style={th}>Viewed At</th>
  </tr>
  </thead>

  <tbody>

  {views.map((v,i)=>(

  <tr key={i} style={i%2===0?rowEven:rowOdd}>

  <td style={td}>
    <div style={{display:"flex", alignItems:"center", gap:8}}>
      <MdDescription color="#1976D2" />
      {v.fileName||"N/A"}
    </div>
  </td>

  <td style={td}>{v.viewerEmail||"Anonymous"}</td>

  <td style={td}>{v.viewerId||"Anonymous"}</td>

  <td style={td}>
  {v.viewedAt
  ? v.viewedAt.toLocaleString()
  : "Loading"}
  </td>

  </tr>

  ))}

  </tbody>

  </table>

  </>

  )}


  {/* ENGAGEMENT */}

  {activeTab==="engagement" && (

  <>

    <h2 style={{display:"flex", alignItems:"center", gap:10}}>
      <MdTimeline size={28} color="#1976D2" />
      Proposal Engagement Analytics
    </h2>

  <table style={table}>

  <thead>

  <tr style={thead}>
  <th style={th}>Proposal</th>
  <th style={th}>Viewer</th>
  <th style={th}>Time Spent</th>
  <th style={th}>Pages Viewed</th>
  </tr>

  </thead>

  <tbody>

  {sessions.map((s,i)=>(

  <tr key={i} style={i%2===0?rowEven:rowOdd}>

  <td style={td}>
    <div style={{display:"flex", alignItems:"center", gap:8}}>
      <MdDescription color="#1976D2" />
      {s.fileName}
    </div>
  </td>

  <td style={td}>{s.viewerEmail}</td>

  <td style={td}>
    <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center"}}>
      <MdTimeline color="#FF9800" size={16} />
      {Math.round((s.duration||0)/1000)} sec
    </div>
  </td>

  <td style={td}>
    <div style={{display:"flex", alignItems:"center", gap:5, justifyContent:"center"}}>
      <MdDescription color="#4CAF50" size={16} />
      {s.pagesViewed?.length||0} pages
    </div>
  </td>

  </tr>

  ))}

  </tbody>

  </table>

  </>

  )}

  </div>

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
  border: "1px solid #eee",
  ":hover": {
    transform: "translateY(-5px)",
    boxShadow: "0 6px 16px rgba(0,0,0,0.1)"
  }
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