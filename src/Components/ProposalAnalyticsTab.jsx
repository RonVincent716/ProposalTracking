// src/components/ProposalAnalyticsTab.jsx
import { useState, useEffect } from "react";
import { storage, auth, db } from "../firebase";
import { ref, listAll } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  getDocs
} from "firebase/firestore";
import { 
  MdAnalytics, 
  MdDescription, 
  MdVisibility, 
  MdAccessTime, 
  MdBarChart,
  MdTimeline,
  MdWarning,
  MdClose,
  MdInsertDriveFile,
  MdRefresh,
  MdInfo,
  MdBugReport,
  MdStorage,
  MdCheckCircle,
  MdTrendingUp,
  MdTrendingDown,
  MdWhatshot,
  MdPerson,
  MdLocationOn,
  MdDevices,
  MdCalendarToday,
  MdDownload,
  MdFilterList
} from "react-icons/md";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

export default function ProposalAnalyticsTab() {
  const [proposals, setProposals] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [pageAnalytics, setPageAnalytics] = useState([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allTrackingData, setAllTrackingData] = useState([]);
  const [activeChart, setActiveChart] = useState("bar");
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageDetails, setPageDetails] = useState(null);
  const [showPageModal, setShowPageModal] = useState(false);
  const [summaryStats, setSummaryStats] = useState({
    totalProposals: 0,
    totalViews: 0,
    totalTimeSpent: 0,
    totalPageViews: 0
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadAllTrackingData();
        await loadProposals();
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadAllTrackingData = async () => {
    try {
      const trackingRef = collection(db, "proposalPageTracking");
      const snapshot = await getDocs(trackingRef);
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setAllTrackingData(data);
      console.log("Loaded tracking data:", data.length, "records");
      return data;
    } catch (error) {
      console.error("Error loading tracking data:", error);
      return [];
    }
  };

  const loadProposals = async () => {
    setLoading(true);
    try {
      const proposalsRef = ref(storage, 'proposals');
      const fileList = await listAll(proposalsRef);
      
      const trackingData = await loadAllTrackingData();
      const proposalsWithStats = [];
      
      for (const item of fileList.items) {
        const fileName = item.name;
        const filePath = `proposals/${fileName}`;
        const baseFileName = fileName.replace(/^\d+_/, '');
        
        const matchingRecords = trackingData.filter(record => {
          const recordProposalId = record.proposalId || '';
          const recordFileName = record.proposalFileName || '';
          return recordProposalId === filePath || recordFileName === fileName ||
                 recordProposalId.includes(baseFileName) || recordFileName.includes(baseFileName);
        });
        
        const sessionPageMap = new Map();
        let totalTimeSpent = 0;
        
        matchingRecords.forEach(record => {
          const pageNum = record.pageNumber;
          const sessionId = record.sessionId || record.id;
          const timeSpent = record.timeSpentSeconds || 0;
          const action = record.action || "page_time";
          const key = `${sessionId}_${pageNum}`;
          
          if (!sessionPageMap.has(key)) {
            sessionPageMap.set(key, { sessionId, pageNum, timeSpent: 0, viewed: false });
          }

          const sessionPage = sessionPageMap.get(key);
          if (action === "page_view" || action === "page_time" || timeSpent > 0) {
            sessionPage.viewed = true;
          }
          if (action === "page_time" || timeSpent > 0) {
            sessionPage.timeSpent += timeSpent;
            totalTimeSpent += timeSpent;
          }
        });
        
        const uniquePages = new Set();
        sessionPageMap.forEach(sessionPage => {
          if (sessionPage.viewed) uniquePages.add(sessionPage.pageNum);
        });
        
        const viewsQuery = query(collection(db, "proposalViews"), where("fileName", "==", fileName));
        const viewsSnapshot = await getDocs(viewsQuery);
        
        proposalsWithStats.push({
          id: filePath, name: fileName, path: filePath,
          totalViews: viewsSnapshot.size, totalTimeSpent: totalTimeSpent,
          pagesTracked: uniquePages.size, hasTrackingData: uniquePages.size > 0
        });
      }
      
      proposalsWithStats.sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0));
      setProposals(proposalsWithStats);
      
      setSummaryStats({
        totalProposals: fileList.items.length,
        totalViews: proposalsWithStats.reduce((sum, p) => sum + p.totalViews, 0),
        totalTimeSpent: proposalsWithStats.reduce((sum, p) => sum + p.totalTimeSpent, 0),
        totalPageViews: proposalsWithStats.reduce((sum, p) => sum + p.pagesTracked, 0)
      });
      
    } catch (error) {
      console.error("Error loading proposals:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPageAnalytics = async (proposal) => {
    setAnalyticsLoading(true);
    
    try {
      const trackingRef = collection(db, "proposalPageTracking");
      const allSnapshot = await getDocs(trackingRef);
      const baseFileName = proposal.name.replace(/^\d+_/, '');
      const pathWithPrefix = `proposals/${proposal.name}`;
      
      const matchingRecords = [];
      allSnapshot.forEach(doc => {
        const data = doc.data();
        const recordProposalId = data.proposalId || '';
        const recordFileName = data.proposalFileName || '';
        
        if (recordProposalId === pathWithPrefix || recordProposalId === proposal.name ||
            recordFileName === proposal.name || recordProposalId.includes(baseFileName) ||
            recordFileName.includes(baseFileName)) {
          matchingRecords.push({ id: doc.id, ...data });
        }
      });
      
      if (matchingRecords.length === 0) {
        setPageAnalytics([]);
        setAnalyticsLoading(false);
        return;
      }
      
      const sessionPageMap = new Map();
      const pageSessionDetails = new Map();
      
      matchingRecords.forEach(record => {
        const pageNum = record.pageNumber;
        const sessionId = record.sessionId || record.id;
        const timeSpent = record.timeSpentSeconds || 0;
        const action = record.action || "page_time";
        
        let clientEmail = record.clientEmail || record.viewerEmail || record.signerEmail || "anonymous";
        let clientName = record.clientName || record.viewerName || record.signerName || "";
        
        if ((!clientName || clientName === "anonymous" || clientName === "") && clientEmail && clientEmail !== "anonymous") {
          clientName = clientEmail.split('@')[0];
        }
        
        if (!clientName || clientName === "anonymous" || clientName === "") {
          clientName = "Guest User";
        }
        
        const key = `${sessionId}_${pageNum}`;
        if (!sessionPageMap.has(key)) {
          sessionPageMap.set(key, { sessionId, pageNum, timeSpent: 0, viewed: false });
        }
        const sessionPage = sessionPageMap.get(key);
        if (action === "page_view" || action === "page_time" || timeSpent > 0) {
          sessionPage.viewed = true;
        }
        if (timeSpent > 0) sessionPage.timeSpent += timeSpent;
        
        if (!pageSessionDetails.has(pageNum)) {
          pageSessionDetails.set(pageNum, []);
        }
        
        const existingSessions = pageSessionDetails.get(pageNum);
        const existingSession = existingSessions.find(s => s.sessionId === sessionId);
        
        if (!existingSession) {
          pageSessionDetails.get(pageNum).push({
            sessionId,
            clientEmail,
            clientName,
            timeSpent,
            timestamp: record.timestamp?.toDate?.() || new Date(),
            deviceInfo: record.deviceInfo || { device: "Unknown" },
            location: record.location || { city: "Unknown", country: "Unknown" },
            userAgent: record.userAgent || "Unknown"
          });
        } else {
          if (timeSpent > 0) {
            existingSession.timeSpent += timeSpent;
          }
          if ((!existingSession.clientName || existingSession.clientName === "anonymous") && clientName && clientName !== "anonymous") {
            existingSession.clientName = clientName;
          }
          if ((!existingSession.clientEmail || existingSession.clientEmail === "anonymous") && clientEmail && clientEmail !== "anonymous") {
            existingSession.clientEmail = clientEmail;
          }
        }
      });
      
      const pageMap = new Map();
      sessionPageMap.forEach(sessionPage => {
        if (sessionPage.viewed) {
          const pageNum = sessionPage.pageNum;
          if (!pageMap.has(pageNum)) {
            pageMap.set(pageNum, { 
              pageNumber: pageNum, 
              totalTimeSpent: 0, 
              sessionCount: 0,
              sessions: pageSessionDetails.get(pageNum) || []
            });
          }
          const pageData = pageMap.get(pageNum);
          pageData.totalTimeSpent += sessionPage.timeSpent;
          pageData.sessionCount += 1;
        }
      });
      
      const pages = Array.from(pageMap.values())
        .map(page => ({
          pageNumber: page.pageNumber,
          totalTimeSpent: Math.round(page.totalTimeSpent * 10) / 10,
          averageTime: page.sessionCount > 0 ? Math.round((page.totalTimeSpent / page.sessionCount) * 10) / 10 : 0,
          sessionCount: page.sessionCount,
          sessions: page.sessions
        }))
        .sort((a, b) => a.pageNumber - b.pageNumber);
      
      setPageAnalytics(pages);
      
    } catch (error) {
      console.error("Error fetching page analytics:", error);
      setPageAnalytics([]);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const getEngagementLevel = (avgTime) => {
    if (avgTime > 60) return { level: "Excellent", color: "#10B981", bg: "#D1FAE5", icon: "🔥" };
    if (avgTime > 30) return { level: "High", color: "#059669", bg: "#D1FAE5", icon: "📈" };
    if (avgTime > 15) return { level: "Medium", color: "#D97706", bg: "#FEF3C7", icon: "📊" };
    if (avgTime > 8) return { level: "Low", color: "#EA580C", bg: "#FFEDD5", icon: "⚠️" };
    if (avgTime > 3) return { level: "Very Low", color: "#DC2626", bg: "#FEE2E2", icon: "❌" };
    return { level: "No Data", color: "#6B7280", bg: "#F3F4F6", icon: "⚪" };
  };

  const handleViewAnalytics = async (proposal) => {
    setSelectedProposal(proposal);
    setShowAnalytics(true);
    await fetchPageAnalytics(proposal);
  };

  const handlePageSelect = (page) => {
    setSelectedPage(page);
    setPageDetails(page);
    setShowPageModal(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllTrackingData();
    await loadProposals();
    setRefreshing(false);
  };

  const handleDebugCheck = async () => {
    const trackingRef = collection(db, "proposalPageTracking");
    const snapshot = await getDocs(trackingRef);
    alert(`Found ${snapshot.size} tracking records. Check console for details.`);
    console.log("Tracking records:", snapshot.size);
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return "0s";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatDate = (date) => {
    if (!date) return "Unknown";
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div className="spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (!user) {
    return <div style={styles.loginPrompt}>Please login to view analytics</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📊 Page View Analytics</h2>
          <p style={styles.subtitle}>See how readers interact with each page</p>
        </div>
        <div style={styles.headerButtons}>
          <button onClick={handleRefresh} disabled={refreshing} style={styles.refreshButton}>
            <MdRefresh size={18} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📄</div>
          <div><div style={styles.statNumber}>{summaryStats.totalProposals}</div><div style={styles.statLabel}>Proposals</div></div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>👁️</div>
          <div><div style={styles.statNumber}>{summaryStats.totalViews}</div><div style={styles.statLabel}>Total Views</div></div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>⏱️</div>
          <div><div style={styles.statNumber}>{formatTime(summaryStats.totalTimeSpent)}</div><div style={styles.statLabel}>Reading Time</div></div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📑</div>
          <div><div style={styles.statNumber}>{summaryStats.totalPageViews}</div><div style={styles.statLabel}>Pages Tracked</div></div>
        </div>
      </div>

      {/* Proposals List */}
      <div style={styles.listContainer}>
        <h3 style={styles.sectionTitle}>Your Proposals</h3>
        {proposals.length === 0 && (
          <div style={styles.emptyState}>
            <p>📭 No proposals uploaded yet.</p>
            <p style={styles.hint}>Upload a proposal and share the link to start tracking.</p>
          </div>
        )}
        {proposals.map((proposal, index) => (
          <div key={index} style={styles.proposalCard}>
            <div style={styles.proposalInfo}>
              <div style={styles.proposalName}>
                <span style={styles.fileIcon}>📄</span>
                <strong>{proposal.name}</strong>
                {proposal.hasTrackingData && <span style={styles.hasDataBadge}>✓ {proposal.pagesTracked} pages</span>}
              </div>
              <div style={styles.proposalStats}>
                <span>👁️ {proposal.totalViews} views</span>
                <span>⏱️ {formatTime(proposal.totalTimeSpent)}</span>
              </div>
            </div>
            <button onClick={() => handleViewAnalytics(proposal)} style={styles.viewButton} disabled={!proposal.hasTrackingData}>
              📊 {proposal.hasTrackingData ? 'View Analytics' : 'No Data'}
            </button>
          </div>
        ))}
      </div>

      {/* Analytics Modal */}
      {showAnalytics && selectedProposal && (
        <div style={styles.modalOverlay} onClick={() => setShowAnalytics(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📊 Page Analytics</h3>
              <button onClick={() => setShowAnalytics(false)} style={styles.closeButton}>✕</button>
            </div>
            <div style={styles.modalSubtitle}>{selectedProposal.name}</div>

            {analyticsLoading ? (
              <div style={styles.loadingAnalytics}><div className="small-spinner"></div><p>Loading data...</p></div>
            ) : pageAnalytics.length > 0 ? (
              <>
                {/* Quick Stats - Shows only pages with data */}
                <div style={styles.quickStats}>
                  <div>
                    <strong>{pageAnalytics.length}</strong>
                    <span>Pages with Data</span>
                  </div>
                  <div>
                    <strong>{pageAnalytics.reduce((sum, p) => sum + p.sessionCount, 0)}</strong>
                    <span>Total Sessions</span>
                  </div>
                  <div>
                    <strong>{formatTime(pageAnalytics.reduce((sum, p) => sum + p.totalTimeSpent, 0))}</strong>
                    <span>Total Time</span>
                  </div>
                </div>

                {/* Missing Pages Note */}
                {(() => {
                  const maxPageNum = Math.max(...pageAnalytics.map(p => p.pageNumber), 0);
                  const allPageNumbers = Array.from({ length: maxPageNum }, (_, i) => i + 1);
                  const existingPageNumbers = new Set(pageAnalytics.map(p => p.pageNumber));
                  const missingPages = allPageNumbers.filter(p => !existingPageNumbers.has(p));
                  
                  return missingPages.length > 0 && (
                    <div style={styles.missingPagesNote}>
                      <MdInfo size={14} /> Note: Pages {missingPages.join(', ')} have no tracking data yet
                    </div>
                  );
                })()}

                {/* Page Selector Dropdown */}
                <div style={styles.pageSelectorContainer}>
                  <label style={styles.pageSelectorLabel}>
                    <MdFilterList size={16} /> Select Page to View Details:
                  </label>
                  <select 
                    onChange={(e) => {
                      const pageNum = parseInt(e.target.value);
                      const page = pageAnalytics.find(p => p.pageNumber === pageNum);
                      if (page) handlePageSelect(page);
                    }}
                    style={styles.pageSelector}
                    defaultValue=""
                  >
                    <option value="" disabled>Choose a page...</option>
                    {pageAnalytics.map(page => {
                      const badge = getEngagementLevel(page.averageTime);
                      return (
                        <option key={page.pageNumber} value={page.pageNumber}>
                          Page {page.pageNumber} - {formatTime(page.averageTime)} avg ({badge.icon} {badge.level})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Page Thumbnail Grid - Shows ALL pages with indicators for missing data */}
                <div style={styles.pageGrid}>
                  {(() => {
                    const maxPageNum = Math.max(...pageAnalytics.map(p => p.pageNumber), 0);
                    const allPages = Array.from({ length: maxPageNum }, (_, i) => i + 1);
                    
                    return allPages.map(pageNum => {
                      const page = pageAnalytics.find(p => p.pageNumber === pageNum);
                      const hasData = !!page;
                      const badge = hasData ? getEngagementLevel(page.averageTime) : { level: "No Data", color: "#9CA3AF", bg: "#F3F4F6", icon: "⚪" };
                      const avgTime = hasData ? formatTime(page.averageTime) : "No data";
                      const sessions = hasData ? page.sessionCount : 0;
                      
                      return (
                        <div
                          key={pageNum}
                          onClick={() => hasData && handlePageSelect(page)}
                          style={{
                            ...styles.pageCard(badge.color),
                            opacity: hasData ? 1 : 0.6,
                            cursor: hasData ? "pointer" : "not-allowed",
                            position: "relative"
                          }}
                        >
                          <div style={styles.pageNumber}>Page {pageNum}</div>
                          <div style={styles.pageTime}>{avgTime}</div>
                          <div style={styles.pageViews}>{sessions} {sessions === 1 ? 'session' : 'sessions'}</div>
                          <div style={styles.pageBadge(badge)}>{badge.icon} {badge.level}</div>
                          {!hasData && <div style={styles.noDataOverlay}>No Data</div>}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Chart Type Toggle */}
                <div style={styles.chartToggle}>
                  <button onClick={() => setActiveChart("bar")} style={{...styles.chartButton, background: activeChart === "bar" ? '#00D4FF' : '#f0f0f0', color: activeChart === "bar" ? '#fff' : '#666'}}>Bar Chart</button>
                  <button onClick={() => setActiveChart("line")} style={{...styles.chartButton, background: activeChart === "line" ? '#00D4FF' : '#f0f0f0', color: activeChart === "line" ? '#fff' : '#666'}}>Line Chart</button>
                  <button onClick={() => setActiveChart("area")} style={{...styles.chartButton, background: activeChart === "area" ? '#00D4FF' : '#f0f0f0', color: activeChart === "area" ? '#fff' : '#666'}}>Area Chart</button>
                </div>

                {/* Chart Visualization */}
                <div style={{ height: "350px", width: "100%", marginBottom: "30px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {activeChart === "bar" ? (
                      <BarChart data={pageAnalytics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="pageNumber" label={{ value: 'Page Number', position: 'insideBottom', offset: -5 }} />
                        <YAxis label={{ value: 'Average Time (seconds)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const badge = getEngagementLevel(data.averageTime);
                            return (
                              <div style={{ background: "#1f2937", color: "#fff", padding: "10px 15px", borderRadius: "8px", fontSize: "12px" }}>
                                <strong>Page {data.pageNumber}</strong><br/>
                                Avg Time: {formatTime(data.averageTime)}<br/>
                                Total Time: {formatTime(data.totalTimeSpent)}<br/>
                                Sessions: {data.sessionCount}<br/>
                                Engagement: {badge.icon} {badge.level}
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Bar dataKey="averageTime" radius={[8, 8, 0, 0]}>
                          {pageAnalytics.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getEngagementLevel(entry.averageTime).color} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : activeChart === "line" ? (
                      <LineChart data={pageAnalytics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="pageNumber" />
                        <YAxis />
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div style={{ background: "#1f2937", color: "#fff", padding: "10px 15px", borderRadius: "8px", fontSize: "12px" }}>
                                <strong>Page {data.pageNumber}</strong><br/>
                                Avg Time: {formatTime(data.averageTime)}
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Line type="monotone" dataKey="averageTime" stroke="#00D4FF" strokeWidth={3} dot={{ r: 6, fill: '#00D4FF' }} />
                      </LineChart>
                    ) : (
                      <AreaChart data={pageAnalytics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis dataKey="pageNumber" />
                        <YAxis />
                        <Tooltip content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div style={{ background: "#1f2937", color: "#fff", padding: "10px 15px", borderRadius: "8px", fontSize: "12px" }}>
                                <strong>Page {data.pageNumber}</strong><br/>
                                Avg Time: {formatTime(data.averageTime)}
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Area type="monotone" dataKey="averageTime" stroke="#00D4FF" fill="#00D4FF20" strokeWidth={2} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Page Table */}
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>Page</th>
                        <th>Avg Time</th>
                        <th>Total Time</th>
                        <th>Views</th>
                        <th>Engagement</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageAnalytics.map((page) => {
                        const badge = getEngagementLevel(page.averageTime);
                        return (
                          <tr key={page.pageNumber}>
                            <td><strong>Page {page.pageNumber}</strong></td>
                            <td><span style={{color: badge.color, fontWeight: 600}}>{formatTime(page.averageTime)}</span></td>
                            <td>{formatTime(page.totalTimeSpent)}</td>
                            <td>{page.sessionCount}</td>
                            <td><span style={styles.engagementBadge(badge)}>{badge.icon} {badge.level}</span></td>
                            <td>
                              <button onClick={() => handlePageSelect(page)} style={styles.detailButton}>
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Insights */}
                <div style={styles.insights}>
                  <h4>💡 What this tells you</h4>
                  <div style={styles.insightList}>
                    {(() => {
                      const peak = pageAnalytics.reduce((max, p) => p.averageTime > max.averageTime ? p : max, pageAnalytics[0]);
                      const low = pageAnalytics.filter(p => p.averageTime < 10);
                      const totalAvg = pageAnalytics.reduce((sum, p) => sum + p.averageTime, 0) / pageAnalytics.length;
                      return (
                        <>
                          <div>🔥 <strong>Most engaging:</strong> Page {peak.pageNumber} ({formatTime(peak.averageTime)} average)</div>
                          {low.length > 0 && <div>⚠️ <strong>Pages needing attention:</strong> {low.map(p => p.pageNumber).join(', ')}</div>}
                          <div>📊 <strong>Average reading time:</strong> {formatTime(totalAvg)} per page</div>
                          <div>👥 <strong>Total unique sessions:</strong> {pageAnalytics.reduce((sum, p) => sum + p.sessionCount, 0)}</div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </>
            ) : (
              <div style={styles.noData}>
                <p>📭 No tracking data yet</p>
                <p style={styles.hint}>Share this proposal with clients to collect data</p>
                <button onClick={() => { const encoded = btoa(selectedProposal.path); navigator.clipboard.writeText(`${window.location.origin}/p/${encoded}`); alert('Link copied!'); }} style={styles.copyButton}>Copy Share Link</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Page Details Modal */}
      {showPageModal && pageDetails && (
        <div style={styles.modalOverlay} onClick={() => setShowPageModal(false)}>
          <div style={styles.pageModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📄 Page {pageDetails.pageNumber} Details</h3>
              <button onClick={() => setShowPageModal(false)} style={styles.closeButton}>✕</button>
            </div>

            <div style={styles.pageModalContent}>
              {/* Page Stats Summary */}
              <div style={styles.pageStatsGrid}>
                <div style={styles.pageStatCard}>
                  <div style={styles.pageStatIcon}>⏱️</div>
                  <div>
                    <div style={styles.pageStatValue}>{formatTime(pageDetails.averageTime)}</div>
                    <div style={styles.pageStatLabel}>Average Time</div>
                  </div>
                </div>
                <div style={styles.pageStatCard}>
                  <div style={styles.pageStatIcon}>📊</div>
                  <div>
                    <div style={styles.pageStatValue}>{formatTime(pageDetails.totalTimeSpent)}</div>
                    <div style={styles.pageStatLabel}>Total Time</div>
                  </div>
                </div>
                <div style={styles.pageStatCard}>
                  <div style={styles.pageStatIcon}>👥</div>
                  <div>
                    <div style={styles.pageStatValue}>{pageDetails.sessionCount}</div>
                    <div style={styles.pageStatLabel}>Total Views</div>
                  </div>
                </div>
              </div>

              {/* Session Details Table */}
              <h4 style={styles.sectionTitle}>Session Details</h4>
              <div style={styles.sessionTableWrapper}>
                <table style={styles.sessionTable}>
                  <thead>
                    <tr style={styles.sessionTableHeader}>
                      <th style={styles.sessionTableTh}>Viewer</th>
                      <th style={styles.sessionTableTh}>Time Spent</th>
                      <th style={styles.sessionTableTh}>Viewed At</th>
                      <th style={styles.sessionTableTh}>Device</th>
                      <th style={styles.sessionTableTh}>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageDetails.sessions?.map((session, idx) => {
                      const displayName = session.clientName && session.clientName !== "anonymous" && session.clientName !== ""
                        ? session.clientName 
                        : (session.clientEmail && session.clientEmail !== "anonymous" 
                          ? session.clientEmail.split('@')[0] 
                          : "Guest User");
                      const displayEmail = session.clientEmail && session.clientEmail !== "anonymous" 
                        ? session.clientEmail 
                        : "No email provided";
                      const displayInitial = displayName.charAt(0).toUpperCase();
                      
                      return (
                        <tr key={idx} style={idx % 2 === 0 ? styles.sessionRowEven : styles.sessionRowOdd}>
                          <td style={styles.sessionTableTd}>
                            <div style={styles.viewerCell}>
                              <div style={styles.viewerAvatar}>{displayInitial}</div>
                              <div>
                                <div style={styles.viewerName}>{displayName}</div>
                                <div style={styles.viewerEmail}>{displayEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td style={styles.sessionTableTd}>
                            <span style={styles.timeBadge}>{formatTime(session.timeSpent)}</span>
                          </td>
                          <td style={styles.sessionTableTd}>
                            {session.timestamp ? formatDate(session.timestamp) : "Unknown"}
                          </td>
                          <td style={styles.sessionTableTd}>
                            <div style={styles.deviceInfo}>
                              {session.deviceInfo?.device === "Mobile" ? "📱" : "💻"} 
                              {session.deviceInfo?.device || "Desktop"}
                            </div>
                          </td>
                          <td style={styles.sessionTableTd}>
                            <div style={styles.locationInfo}>
                              📍 {session.location?.city || "Unknown"}, {session.location?.country || "Unknown"}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Export Button */}
              <button 
                onClick={() => {
                  const headers = ["Viewer Name", "Viewer Email", "Time Spent (seconds)", "Time Spent", "Viewed At", "Device", "City", "Country"];
                  const rows = pageDetails.sessions.map(s => [
                    s.clientName || "Unknown",
                    s.clientEmail || "Unknown",
                    s.timeSpent,
                    formatTime(s.timeSpent),
                    s.timestamp ? formatDate(s.timestamp) : "Unknown",
                    s.deviceInfo?.device || "Desktop",
                    s.location?.city || "Unknown",
                    s.location?.country || "Unknown"
                  ]);
                  const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `page_${pageDetails.pageNumber}_details.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={styles.exportButton}
              >
                <MdDownload size={16} /> Export to CSV
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #00D4FF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 15px;
        }
        .small-spinner {
          width: 30px;
          height: 30px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #00D4FF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 15px;
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
    padding: "20px",
    fontFamily: "'Inter', system-ui, sans-serif",
    background: "#f5f7fa",
    borderRadius: "16px",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px",
    gap: "20px",
    background: "#fff",
    borderRadius: "16px",
  },
  loginPrompt: {
    textAlign: "center",
    padding: "60px",
    background: "#fff",
    borderRadius: "16px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "10px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "600",
    margin: 0,
    color: "#1a1a2e",
  },
  subtitle: {
    color: "#666",
    fontSize: "13px",
    marginTop: "4px",
  },
  headerButtons: {
    display: "flex",
    gap: "10px",
  },
  refreshButton: {
    padding: "8px 16px",
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "15px",
    marginBottom: "25px",
  },
  statCard: {
    background: "#fff",
    padding: "15px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  statIcon: {
    fontSize: "28px",
  },
  statNumber: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  statLabel: {
    fontSize: "12px",
    color: "#666",
  },
  listContainer: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  sectionTitle: {
    margin: "0 0 15px 0",
    fontSize: "16px",
    color: "#1a1a2e",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px",
    color: "#999",
  },
  hint: {
    fontSize: "12px",
    color: "#00D4FF",
    marginTop: "8px",
  },
  proposalCard: {
    padding: "12px",
    marginBottom: "10px",
    border: "1px solid #eee",
    borderRadius: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
  },
  proposalInfo: {
    flex: 1,
  },
  proposalName: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "6px",
    flexWrap: "wrap",
  },
  fileIcon: {
    fontSize: "16px",
  },
  hasDataBadge: {
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "10px",
    background: "#10B98120",
    color: "#10B981",
  },
  proposalStats: {
    display: "flex",
    gap: "12px",
    fontSize: "12px",
    color: "#666",
  },
  viewButton: {
    padding: "8px 16px",
    background: "#8B5CF6",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "500",
  },
  modalOverlay: {
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
    padding: "20px",
  },
  modalContent: {
    background: "#fff",
    borderRadius: "16px",
    width: "90%",
    maxWidth: "900px",
    maxHeight: "85vh",
    overflowY: "auto",
    padding: "20px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
    animation: "slideUp 0.3s ease",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    paddingBottom: "10px",
    borderBottom: "1px solid #eee",
  },
  modalTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
  },
  modalSubtitle: {
    fontSize: "13px",
    color: "#666",
    marginBottom: "20px",
    wordBreak: "break-all",
  },
  closeButton: {
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    color: "#999",
  },
  quickStats: {
    display: "flex",
    justifyContent: "space-around",
    marginBottom: "20px",
    padding: "15px",
    background: "#f8f9fa",
    borderRadius: "12px",
  },
  missingPagesNote: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 15px",
    marginBottom: "15px",
    background: "#FEF3C7",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#92400E",
    border: "1px solid #FDE68A",
  },
  pageSelectorContainer: {
    marginBottom: "20px",
    padding: "15px",
    background: "#f8f9fa",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
  },
  pageSelectorLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: "500",
    color: "#666",
  },
  pageSelector: {
    padding: "10px 15px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "14px",
    minWidth: "250px",
    cursor: "pointer",
    background: "#fff",
  },
  pageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
    gap: "10px",
    marginBottom: "20px",
  },
  pageCard: (color) => ({
    padding: "12px",
    borderRadius: "10px",
    border: `2px solid ${color}40`,
    background: `${color}10`,
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    position: "relative",
  }),
  pageNumber: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#333",
  },
  pageTime: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#1a1a2e",
    margin: "5px 0",
  },
  pageViews: {
    fontSize: "11px",
    color: "#666",
  },
  pageBadge: (badge) => ({
    display: "inline-block",
    padding: "2px 6px",
    borderRadius: "10px",
    fontSize: "10px",
    marginTop: "6px",
    background: badge.bg,
    color: badge.color,
  }),
  noDataOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "10px",
    fontWeight: "500",
    backdropFilter: "blur(2px)",
  },
  chartToggle: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    justifyContent: "center",
  },
  chartButton: {
    padding: "8px 20px",
    borderRadius: "20px",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    transition: "all 0.2s",
  },
  tableWrapper: {
    overflowX: "auto",
    marginBottom: "20px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  engagementBadge: (badge) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "500",
    background: badge.bg,
    color: badge.color,
  }),
  detailButton: {
    padding: "4px 10px",
    background: "#00D4FF20",
    border: "1px solid #00D4FF",
    borderRadius: "6px",
    color: "#00D4FF",
    fontSize: "11px",
    cursor: "pointer",
  },
  insights: {
    padding: "15px",
    background: "#f0fdf4",
    borderRadius: "12px",
    border: "1px solid #bbf7d0",
  },
  insightList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontSize: "13px",
    color: "#166534",
  },
  loadingAnalytics: {
    textAlign: "center",
    padding: "40px",
    color: "#666",
  },
  noData: {
    textAlign: "center",
    padding: "40px",
    color: "#999",
  },
  copyButton: {
    marginTop: "15px",
    padding: "8px 20px",
    background: "#00D4FF",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
  },
  pageModal: {
    background: "#fff",
    borderRadius: "16px",
    width: "90%",
    maxWidth: "800px",
    maxHeight: "85vh",
    overflowY: "auto",
    padding: "20px",
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
    animation: "slideUp 0.3s ease",
  },
  pageModalContent: {
    padding: "10px",
  },
  pageStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "15px",
    marginBottom: "25px",
  },
  pageStatCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "15px",
    background: "#f8f9fa",
    borderRadius: "12px",
  },
  pageStatIcon: {
    fontSize: "28px",
  },
  pageStatValue: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  pageStatLabel: {
    fontSize: "11px",
    color: "#666",
  },
  sessionTableWrapper: {
    overflowX: "auto",
    marginBottom: "20px",
    maxHeight: "400px",
    overflowY: "auto",
  },
  sessionTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  sessionTableHeader: {
    background: "#f1f5f9",
    position: "sticky",
    top: 0,
  },
  sessionTableTh: {
    padding: "12px",
    textAlign: "left",
    fontWeight: "600",
    color: "#333",
  },
  sessionTableTd: {
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
  },
  sessionRowEven: {
    background: "#fff",
  },
  sessionRowOdd: {
    background: "#f8fafc",
  },
  viewerCell: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  viewerAvatar: {
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
  viewerName: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#1a1a2e",
  },
  viewerEmail: {
    fontSize: "10px",
    color: "#999",
  },
  timeBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "12px",
    background: "#10B98120",
    color: "#10B981",
    fontSize: "11px",
    fontWeight: "500",
  },
  deviceInfo: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
  },
  locationInfo: {
    fontSize: "11px",
    color: "#666",
  },
  exportButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    marginTop: "15px",
  },
};
