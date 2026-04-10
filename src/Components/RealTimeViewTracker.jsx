// src/Components/RealTimeViewTracker.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, limit, getDocs, deleteDoc } from "firebase/firestore";
import { 
  MdVisibility, 
  MdPerson, 
  MdLocationOn, 
  MdDevices, 
  MdAccessTime,
  MdClose,
  MdRefresh,
  MdTrendingUp,
  MdWarning,
  MdDesktopMac,
  MdPhoneAndroid,
  MdTabletMac
} from "react-icons/md";

export default function RealTimeViewTracker({ proposalId, proposalName, onClose }) {
  const [activeViewers, setActiveViewers] = useState([]);
  const [viewHistory, setViewHistory] = useState([]);
  const [stats, setStats] = useState({
    totalActive: 0,
    totalToday: 0,
    peakConcurrent: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!proposalId) return;
    
    console.log("🔍 RealTimeViewTracker mounted for proposal:", proposalId);
    
    // Listen to active viewers in real-time
    const activeQuery = query(
      collection(db, "activeViewers"),
      where("proposalId", "==", proposalId)
    );
    
    const unsubscribeActive = onSnapshot(activeQuery, (snapshot) => {
      console.log(`📊 Active viewers snapshot received: ${snapshot.size} documents`);
      const viewers = [];
      const now = Date.now();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - Viewer: ${data.viewerEmail}, lastActive:`, data.lastActive);
        
        let lastActive;
        if (data.lastActive?.toDate) {
          lastActive = data.lastActive.toDate();
        } else if (data.lastActive) {
          lastActive = new Date(data.lastActive);
        } else {
          lastActive = new Date();
        }
        
        const isActive = (now - lastActive.getTime()) < 60000; // Active within last 60 seconds
        
        if (isActive) {
          viewers.push({
            id: doc.id,
            ...data,
            lastActive: lastActive
          });
        } else {
          console.log(`  - Removing inactive viewer: ${data.viewerEmail}`);
          // Remove inactive viewers
          deleteDoc(doc.ref).catch(console.error);
        }
      });
      
      // Sort manually by lastActive (newest first)
      viewers.sort((a, b) => b.lastActive - a.lastActive);
      
      setActiveViewers(viewers);
      setStats(prev => ({
        ...prev,
        totalActive: viewers.length,
        peakConcurrent: Math.max(prev.peakConcurrent, viewers.length)
      }));
      setLoading(false);
      setError(null);
    }, (error) => {
      console.error("Error in active viewers listener:", error);
      setError("Failed to load active viewers: " + error.message);
      setLoading(false);
    });
    
    // Listen to view history
    const historyQuery = query(
      collection(db, "proposalViews"),
      where("proposalId", "==", proposalId),
      limit(50)
    );
    
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
      const history = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        let viewedAt;
        if (data.viewedAt?.toDate) {
          viewedAt = data.viewedAt.toDate();
        } else if (data.viewedAt) {
          viewedAt = new Date(data.viewedAt);
        } else {
          viewedAt = new Date();
        }
        
        history.push({
          id: doc.id,
          ...data,
          viewedAt: viewedAt
        });
      });
      
      // Sort manually by viewedAt (newest first)
      history.sort((a, b) => b.viewedAt - a.viewedAt);
      
      setViewHistory(history);
      
      // Calculate today's views
      const today = new Date().toDateString();
      const todayViews = history.filter(v => v.viewedAt.toDateString() === today);
      setStats(prev => ({ 
        ...prev, 
        totalToday: todayViews.length
      }));
    }, (error) => {
      console.error("Error in history listener:", error);
    });
    
    return () => {
      console.log("🔍 RealTimeViewTracker unmounting");
      unsubscribeActive();
      unsubscribeHistory();
    };
  }, [proposalId]);

  const refreshData = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const activeQuery = query(
        collection(db, "activeViewers"),
        where("proposalId", "==", proposalId)
      );
      const snapshot = await getDocs(activeQuery);
      const viewers = [];
      const now = Date.now();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        let lastActive;
        if (data.lastActive?.toDate) {
          lastActive = data.lastActive.toDate();
        } else if (data.lastActive) {
          lastActive = new Date(data.lastActive);
        } else {
          lastActive = new Date();
        }
        
        const isActive = (now - lastActive.getTime()) < 60000;
        if (isActive) {
          viewers.push({ id: doc.id, ...data, lastActive });
        }
      });
      
      viewers.sort((a, b) => b.lastActive - a.lastActive);
      setActiveViewers(viewers);
      setStats(prev => ({ ...prev, totalActive: viewers.length }));
    } catch (error) {
      console.error("Error refreshing data:", error);
      setError("Failed to refresh: " + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return date.toLocaleDateString();
  };

  const getDeviceIcon = (deviceInfo) => {
    if (!deviceInfo) return <MdDesktopMac size={14} />;
    if (deviceInfo.device === "Mobile") return <MdPhoneAndroid size={14} />;
    if (deviceInfo.device === "Tablet") return <MdTabletMac size={14} />;
    return <MdDesktopMac size={14} />;
  };

  const getDeviceName = (deviceInfo) => {
    if (!deviceInfo) return "Desktop";
    return deviceInfo.device || "Desktop";
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div className="spinner"></div>
        <p>Loading live viewers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <MdWarning size={48} color="#EF4444" />
        <p style={styles.errorText}>{error}</p>
        <button onClick={refreshData} style={styles.retryButton}>
          <MdRefresh size={16} /> Retry
        </button>
        <button onClick={onClose} style={styles.closeErrorButton}>Close</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <MdVisibility size={24} color="#00D4FF" />
          <h3 style={styles.title}>Live View Tracking</h3>
          {activeViewers.length > 0 && (
            <span style={styles.liveBadge}>
              <span className="pulse-dot"></span>
              {activeViewers.length} Active Now
            </span>
          )}
        </div>
        <div style={styles.headerActions}>
          <button onClick={refreshData} disabled={refreshing} style={styles.refreshButton} title="Refresh">
            <MdRefresh size={18} />
          </button>
          <button onClick={onClose} style={styles.closeButton}>
            <MdClose size={20} />
          </button>
        </div>
      </div>

      {/* Proposal Name */}
      <div style={styles.proposalInfo}>
        <span style={styles.proposalLabel}>Proposal:</span>
        <span style={styles.proposalName}>
          {proposalName
            ? proposalName.length > 50
              ? `${proposalName.substring(0, 50)}...`
              : proposalName
            : "Unknown proposal"}
        </span>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>👁️</div>
          <div>
            <div style={styles.statValue}>{activeViewers.length}</div>
            <div style={styles.statLabel}>Active Now</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📊</div>
          <div>
            <div style={styles.statValue}>{stats.totalToday}</div>
            <div style={styles.statLabel}>Views Today</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🔥</div>
          <div>
            <div style={styles.statValue}>{stats.peakConcurrent}</div>
            <div style={styles.statLabel}>Peak Concurrent</div>
          </div>
        </div>
      </div>

      {/* Active Viewers Section */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>
          <span className="live-indicator"></span>
          Currently Viewing ({activeViewers.length})
        </h4>
        
        {activeViewers.length === 0 ? (
          <div style={styles.emptyState}>
            <MdVisibility size={32} color="#ccc" />
            <p>No one is viewing this proposal right now</p>
            <p style={styles.emptySubtext}>When a client opens this proposal, they'll appear here in real-time</p>
          </div>
        ) : (
          <div style={styles.activeList}>
            {activeViewers.map((viewer) => (
              <div key={viewer.id} style={styles.activeCard}>
                <div style={styles.activeAvatar}>
                  {viewer.viewerName?.charAt(0).toUpperCase() || viewer.viewerEmail?.charAt(0).toUpperCase() || "U"}
                </div>
                <div style={styles.activeInfo}>
                  <div style={styles.activeName}>{viewer.viewerName || viewer.viewerEmail?.split('@')[0] || "Guest User"}</div>
                  <div style={styles.activeMeta}>
                    <span>📄 Page {viewer.currentPage || 1}</span>
                    <span>{getDeviceIcon(viewer.deviceInfo)} {getDeviceName(viewer.deviceInfo)}</span>
                    <span>📍 {viewer.location?.city || "Unknown"}, {viewer.location?.country || "Unknown"}</span>
                  </div>
                </div>
                <div style={styles.activeTime}>
                  <span className="live-dot-small"></span>
                  Active now
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent View History */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Recent Views ({viewHistory.length})</h4>
        
        <div style={styles.historyList}>
          {viewHistory.slice(0, 15).map((view) => (
            <div key={view.id} style={styles.historyItem}>
              <div style={styles.historyAvatar}>
                {view.viewerName?.charAt(0).toUpperCase() || view.viewerEmail?.charAt(0).toUpperCase() || "?"}
              </div>
              <div style={styles.historyInfo}>
                <div style={styles.historyName}>{view.viewerName || view.viewerEmail?.split('@')[0] || "Anonymous"}</div>
                <div style={styles.historyMeta}>
                  <span>{getDeviceIcon(view.deviceInfo)} {view.deviceInfo?.device || "Desktop"}</span>
                  <span>•</span>
                  <span>📍 {view.location?.city || "Unknown"}, {view.location?.country || "Unknown"}</span>
                </div>
              </div>
              <div style={styles.historyTime}>{formatTime(view.viewedAt)}</div>
            </div>
          ))}
          {viewHistory.length === 0 && (
            <div style={styles.emptyHistory}>
              <p>No recent views yet</p>
              <p style={styles.emptySubtext}>Views will appear here when clients open the proposal</p>
            </div>
          )}
        </div>
      </div>

      {/* Tips Section */}
      <div style={styles.tipsSection}>
        <h4 style={styles.tipsTitle}>💡 Pro Tips</h4>
        <ul style={styles.tipsList}>
          <li>Active viewers are updated in real-time</li>
          <li>Viewers are considered active for 60 seconds after their last action</li>
          <li>Use this data to follow up with clients while they're viewing</li>
          <li>Refresh to get the latest data</li>
        </ul>
      </div>

      <style>{`
        .spinner {
          width: 30px;
          height: 30px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #00D4FF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        .pulse-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10B981;
          margin-right: 6px;
          animation: pulse 1.5s infinite;
        }
        .live-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #EF4444;
          margin-right: 8px;
          animation: pulse 1.5s infinite;
        }
        .live-dot-small {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10B981;
          margin-right: 4px;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    background: "#fff",
    borderRadius: "20px",
    padding: "20px",
    width: "100%",
    maxWidth: "550px",
    maxHeight: "85vh",
    overflowY: "auto",
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
    animation: "slideUp 0.3s ease",
  },
  loadingContainer: {
    textAlign: "center",
    padding: "40px",
    background: "#fff",
    borderRadius: "16px",
  },
  errorContainer: {
    textAlign: "center",
    padding: "40px",
    background: "#fff",
    borderRadius: "16px",
  },
  errorText: {
    color: "#EF4444",
    marginTop: "12px",
    fontSize: "14px",
  },
  retryButton: {
    marginTop: "16px",
    padding: "8px 16px",
    background: "#2196F3",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  closeErrorButton: {
    marginTop: "12px",
    marginLeft: "12px",
    padding: "8px 16px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: "8px",
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
    paddingBottom: "15px",
    borderBottom: "1px solid #e0e0e0",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  headerActions: {
    display: "flex",
    gap: "8px",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    color: "#1a1a2e",
  },
  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    background: "#10B98120",
    borderRadius: "20px",
    fontSize: "12px",
    color: "#10B981",
    fontWeight: "500",
  },
  refreshButton: {
    background: "#f5f5f5",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    cursor: "pointer",
    padding: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#666",
    padding: "6px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  proposalInfo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    background: "#f8f9fa",
    borderRadius: "10px",
    marginBottom: "15px",
    fontSize: "12px",
  },
  proposalLabel: {
    fontWeight: "600",
    color: "#666",
  },
  proposalName: {
    color: "#00D4FF",
    fontWeight: "500",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
    marginBottom: "20px",
  },
  statCard: {
    background: "#f8f9fa",
    padding: "12px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  statIcon: {
    fontSize: "24px",
  },
  statValue: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  statLabel: {
    fontSize: "11px",
    color: "#666",
  },
  section: {
    marginBottom: "20px",
  },
  sectionTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "12px",
    display: "flex",
    alignItems: "center",
  },
  emptyState: {
    textAlign: "center",
    padding: "30px",
    color: "#999",
  },
  emptySubtext: {
    fontSize: "11px",
    marginTop: "8px",
    color: "#bbb",
  },
  activeList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  activeCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    background: "#f0fdf4",
    borderRadius: "12px",
    border: "1px solid #86efac",
  },
  activeAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "#10B981",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "16px",
  },
  activeInfo: {
    flex: 1,
  },
  activeName: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#1a1a2e",
  },
  activeMeta: {
    display: "flex",
    gap: "12px",
    fontSize: "11px",
    color: "#666",
    flexWrap: "wrap",
  },
  activeTime: {
    fontSize: "11px",
    color: "#10B981",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  historyList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxHeight: "300px",
    overflowY: "auto",
  },
  historyItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px",
    background: "#f8f9fa",
    borderRadius: "10px",
  },
  historyAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#00D4FF",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "14px",
  },
  historyInfo: {
    flex: 1,
  },
  historyName: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#1a1a2e",
  },
  historyMeta: {
    display: "flex",
    gap: "6px",
    fontSize: "10px",
    color: "#666",
    marginTop: "2px",
    flexWrap: "wrap",
  },
  historyTime: {
    fontSize: "10px",
    color: "#999",
  },
  emptyHistory: {
    textAlign: "center",
    padding: "20px",
    color: "#999",
  },
  tipsSection: {
    marginTop: "15px",
    padding: "12px",
    background: "#f0f9ff",
    borderRadius: "12px",
    border: "1px solid #bae6fd",
  },
  tipsTitle: {
    fontSize: "12px",
    fontWeight: "600",
    margin: "0 0 8px 0",
    color: "#0369a1",
  },
  tipsList: {
    margin: 0,
    paddingLeft: "20px",
    fontSize: "11px",
    color: "#0284c7",
    lineHeight: "1.6",
  },
};
