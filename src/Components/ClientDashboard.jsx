// src/Components/ClientDashboard.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, storage } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc,
  updateDoc,
  orderBy,
  limit
} from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { 
  MdDescription, 
  MdVisibility, 
  MdDownload,
  MdLogout,
  MdCheckCircle,
  MdSchedule,
  MdPerson,
  MdInsertDriveFile,
  MdAccessTime,
  MdVerified,
  MdPending,
  MdSpaceDashboard,
  MdFolder,
  MdMenu,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdWarning,
  MdRefresh,
  MdHistory,
  MdOpenInNew,
  MdPictureAsPdf,
  MdEdit,
  MdExitToApp,
  MdSearch,
  MdFilterList
} from "react-icons/md";
import ProposalStatusBadge from "../Pages/ProposalStatusBadge";

export default function ClientDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [signedProposalsData, setSignedProposalsData] = useState({});
  const [stats, setStats] = useState({
    total: 0,
    viewed: 0,
    signed: 0,
    pending: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/client-login");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data().role !== "client") {
          await auth.signOut();
          navigate("/client-login");
          return;
        }

        setCurrentUser(user);
        await Promise.all([
          loadClientProposals(user),
          loadRecentlyViewed(user),
          loadSignedProposalsData(user)
        ]);
      } catch (error) {
        console.error("Error checking user:", error);
        navigate("/client-login");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const refreshDashboard = async () => {
    if (!currentUser) return;
    setRefreshing(true);
    try {
      await Promise.all([
        loadClientProposals(currentUser),
        loadRecentlyViewed(currentUser),
        loadSignedProposalsData(currentUser)
      ]);
    } catch (error) {
      console.error("Error refreshing dashboard:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadSignedProposalsData = async (user) => {
    try {
      const signedQuery = query(
        collection(db, "signedProposals"),
        where("signerEmail", "==", user.email)
      );
      const signedSnapshot = await getDocs(signedQuery);
      const signedData = {};
      signedSnapshot.forEach(doc => {
        const data = doc.data();
        signedData[data.proposalPath] = {
          id: doc.id,
          signedAt: data.signedAt,
          signedBy: data.signedBy,
          signature: data.signature
        };
      });
      setSignedProposalsData(signedData);
    } catch (error) {
      console.error("Error loading signed proposals data:", error);
    }
  };

  const loadClientProposals = async (user) => {
    try {
      const proposalsQuery = query(
        collection(db, "sharedProposals"),
        where("clientEmail", "==", user.email)
      );

      const querySnapshot = await getDocs(proposalsQuery);
      const proposalsData = [];
      
      let viewedCount = 0;
      let signedCount = 0;
      let pendingCount = 0;

      for (const documentSnapshot of querySnapshot.docs) {
        const data = documentSnapshot.data();
        const proposalStatus = data.status || "pending";
        const isSigned = proposalStatus === "signed";
        
        let hasViewed = false;
        try {
          const viewsQuery = query(
            collection(db, "proposalViews"),
            where("filePath", "==", data.filePath),
            where("viewerEmail", "==", user.email)
          );
          const viewsSnapshot = await getDocs(viewsQuery);
          hasViewed = !viewsSnapshot.empty || (data.viewCount > 0);
        } catch (error) {
          console.error("Error checking views:", error);
        }
        
        if (isSigned) {
          signedCount++;
        } else if (hasViewed) {
          viewedCount++;
        } else {
          pendingCount++;
        }
        
        let fileUrl = null;
        try {
          const fileRef = ref(storage, data.filePath);
          fileUrl = await getDownloadURL(fileRef);
        } catch (error) {
          console.error("Error getting file URL:", error);
        }

        let senderDisplay = "Admin";
        if (data.sharedByEmail) {
          senderDisplay = data.sharedByEmail;
        } else if (data.sharedBy && data.sharedBy.includes('@')) {
          senderDisplay = data.sharedBy;
        } else if (data.sharedByName) {
          senderDisplay = data.sharedByName;
        }

        proposalsData.push({
          id: documentSnapshot.id,
          fileName: data.fileName,
          filePath: data.filePath,
          fileUrl: fileUrl,
          sharedAt: data.sharedAt?.toDate?.() || new Date(data.sharedAt),
          sharedBy: data.sharedBy,
          sharedByEmail: data.sharedByEmail,
          sharedByName: data.sharedByName,
          senderDisplay: senderDisplay,
          status: isSigned ? "signed" : (hasViewed ? "viewed" : "pending"),
          signedAt: data.signedAt,
          expiresAt: data.expiresAt?.toDate?.() || null,
          viewCount: data.viewCount || 0
        });
      }

      proposalsData.sort((a, b) => b.sharedAt.getTime() - a.sharedAt.getTime());

      setProposals(proposalsData);
      setStats({
        total: proposalsData.length,
        viewed: viewedCount,
        signed: signedCount,
        pending: pendingCount
      });
      
    } catch (error) {
      console.error("Error loading proposals:", error);
    }
  };

  const loadRecentlyViewed = async (user) => {
    try {
      const viewsQuery = query(
        collection(db, "proposalViews"),
        where("viewerEmail", "==", user.email),
        orderBy("viewedAt", "desc"),
        limit(10)
      );
      
      const viewsSnapshot = await getDocs(viewsQuery);
      const viewsData = [];
      
      for (const viewDoc of viewsSnapshot.docs) {
        const data = viewDoc.data();
        
        let fileUrl = null;
        try {
          if (data.filePath) {
            const fileRef = ref(storage, data.filePath);
            fileUrl = await getDownloadURL(fileRef);
          }
        } catch (error) {
          console.error("Error getting file URL:", error);
        }
        
        viewsData.push({
          id: viewDoc.id,
          fileName: data.fileName,
          filePath: data.filePath,
          fileUrl: fileUrl,
          viewedAt: data.viewedAt?.toDate(),
          viewerId: data.viewerId,
          viewerEmail: data.viewerEmail,
          viewerName: data.viewerName
        });
      }
      
      viewsData.sort((a, b) => (b.viewedAt?.getTime() || 0) - (a.viewedAt?.getTime() || 0));
      
      setRecentlyViewed(viewsData);
    } catch (error) {
      console.error("Error loading recently viewed:", error);
    }
  };

  const handleViewProposal = (proposal) => {
    const encodedPath = btoa(proposal.filePath);
    
    if (proposal.status === "signed") {
      const signedData = signedProposalsData[proposal.filePath];
      if (signedData && signedData.id) {
        navigate(`/signed/${signedData.id}`);
      } else {
        window.open(`/p/${encodedPath}`, '_blank');
      }
    } else {
      window.open(`/p/${encodedPath}`, '_blank');
    }
  };

  const handleSignProposal = (proposal) => {
    const encodedPath = btoa(proposal.filePath);
    window.open(`/sign/${encodedPath}`, '_blank');
  };

  const handleDownload = async (proposal) => {
    try {
      const link = document.createElement("a");
      link.href = proposal.fileUrl;
      link.download = proposal.fileName;
      link.click();
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const openLogoutModal = () => {
    setShowLogoutModal(true);
  };

  const closeLogoutModal = () => {
    setShowLogoutModal(false);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      navigate("/client-login");
    } catch (error) {
      console.error("Logout error:", error);
      alert("Failed to logout. Please try again.");
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const filteredProposals = proposals.filter(proposal => {
    const matchesSearch = proposal.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (proposal.senderDisplay || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || proposal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDaysLeft = (expiresAt) => {
    if (!expiresAt) return null;
    const now = new Date();
    const diffTime = expiresAt - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const sidebarItems = [
    { id: "dashboard", icon: <MdSpaceDashboard size={20} />, label: "Dashboard", action: () => setActiveTab("dashboard") },
    { id: "all", icon: <MdFolder size={20} />, label: "All Proposals", action: () => { setActiveTab("all"); setStatusFilter("all"); }, count: proposals.length },
    { id: "recent", icon: <MdHistory size={20} />, label: "Recently Viewed", action: () => setActiveTab("recent"), count: recentlyViewed.length },
    { id: "pending", icon: <MdPending size={20} />, label: "Pending", action: () => { setActiveTab("all"); setStatusFilter("pending"); }, count: stats.pending },
    { id: "signed", icon: <MdVerified size={20} />, label: "Signed", action: () => { setActiveTab("all"); setStatusFilter("signed"); }, count: stats.signed },
  ];

  const renderContent = () => {
    if (activeTab === "dashboard") {
      return (
        <div>
          <div style={overviewSectionStyle}>
            <div style={overviewHeaderStyle}>
              <h3 style={overviewTitleStyle}>Recent Proposals</h3>
              <button 
                onClick={refreshDashboard} 
                style={refreshButtonStyle}
                disabled={refreshing}
              >
                <MdRefresh size={16} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <div style={recentProposalsListStyle}>
              {proposals.slice(0, 5).map((proposal, index) => (
                <div key={proposal.id || index} style={recentProposalItemStyle}>
                  <div style={recentProposalIconStyle}>
                    <MdInsertDriveFile size={20} color={proposal.status === "signed" ? "#10b981" : "#6366f1"} />
                  </div>
                  <div style={recentProposalInfoStyle}>
                    <div style={recentProposalNameStyle}>{proposal.fileName}</div>
                    <div style={recentProposalMetaStyle}>
                      <span>From: {proposal.senderDisplay || proposal.sharedByEmail || proposal.sharedBy || "Admin"}</span>
                      <span>•</span>
                      <span>{proposal.sharedAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ProposalStatusBadge status={proposal.status} size="small" />
                  <button onClick={() => handleViewProposal(proposal)} style={recentProposalButtonStyle}>
                    {proposal.status === "signed" ? "View Signed" : "View"}
                  </button>
                </div>
              ))}
              {proposals.length === 0 && (
                <div style={emptyRecentStyle}>No proposals yet</div>
              )}
            </div>
          </div>

          <div style={overviewSectionStyle}>
            <h3 style={overviewTitleStyle}>Recently Viewed</h3>
            <div style={recentProposalsListStyle}>
              {recentlyViewed.slice(0, 5).map((item, index) => (
                <div key={item.id || index} style={recentProposalItemStyle}>
                  <div style={recentProposalIconStyle}>
                    <MdHistory size={20} color="#3b82f6" />
                  </div>
                  <div style={recentProposalInfoStyle}>
                    <div style={recentProposalNameStyle}>{item.fileName}</div>
                    <div style={recentProposalMetaStyle}>
                      <span>Viewed {item.viewedAt?.toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const encodedPath = btoa(item.filePath);
                      window.open(`/p/${encodedPath}`, '_blank');
                    }}
                    style={recentProposalButtonStyle}
                  >
                    Open
                  </button>
                </div>
              ))}
              {recentlyViewed.length === 0 && (
                <div style={emptyRecentStyle}>No recently viewed proposals</div>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    if (activeTab === "recent") {
      return (
        <>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Recently Viewed</h2>
            <button 
              onClick={refreshDashboard}
              style={refreshButtonStyle}
              disabled={refreshing}
            >
              <MdRefresh size={16} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          
          {recentlyViewed.length === 0 ? (
            <EmptyState icon={<MdHistory size={64} color="#cbd5e1" />} title="No recently viewed proposals" message="When you view a proposal, it will appear here." />
          ) : (
            <RecentlyViewedGrid items={recentlyViewed} />
          )}
        </>
      );
    }
    
    return (
      <>
        <div style={searchContainerStyle}>
          <div style={searchInputWrapper}>
            <MdSearch size={20} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search proposals by name or sender..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={searchInputStyle}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} style={clearSearchStyle}>
                ✕
              </button>
            )}
          </div>
          
          {activeTab === "all" && (
            <div style={filterWrapperStyle}>
              <MdFilterList size={20} color="#94a3b8" />
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={filterSelectStyle}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="viewed">Viewed</option>
                <option value="signed">Signed</option>
              </select>
            </div>
          )}

          {activeTab === "all" && (
            <div style={viewModeToggleStyle}>
              <button
                onClick={() => setViewMode("grid")}
                style={viewModeButtonStyle(viewMode === "grid")}
                title="Grid View"
              >
                <MdSpaceDashboard size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                style={viewModeButtonStyle(viewMode === "list")}
                title="List View"
              >
                <MdFilterList size={18} />
              </button>
            </div>
          )}
        </div>

        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>
            {statusFilter === "signed" ? "Signed Proposals" : 
             statusFilter === "viewed" ? "Viewed Proposals" : 
             statusFilter === "pending" ? "Pending Proposals" : "All Proposals"}
          </h2>
          <div style={resultCountStyle}>
            {filteredProposals.length} {filteredProposals.length === 1 ? 'proposal' : 'proposals'} found
          </div>
        </div>
        
        {filteredProposals.length === 0 ? (
          <EmptyState 
            icon={<MdPictureAsPdf size={64} color="#cbd5e1" />} 
            title={
              statusFilter === "signed" ? "No signed proposals yet" :
              statusFilter === "viewed" ? "No viewed proposals" :
              statusFilter === "pending" ? "No pending proposals" :
              "No proposals found"
            } 
            message={
              statusFilter === "signed" ? "When you sign a proposal, it will appear here." :
              statusFilter === "viewed" ? "When you view a proposal, it will appear here." :
              statusFilter === "pending" ? "Proposals that need your attention will appear here." :
              "When someone shares a proposal with you, it will appear here."
            } 
          />
        ) : viewMode === "grid" ? (
          <ProposalsGrid 
            proposals={filteredProposals} 
            handleViewProposal={handleViewProposal}
            handleSignProposal={handleSignProposal}
            handleDownload={handleDownload} 
            getDaysLeft={getDaysLeft}
            signedProposalsData={signedProposalsData}
          />
        ) : (
          <ProposalsList 
            proposals={filteredProposals} 
            handleViewProposal={handleViewProposal}
            handleSignProposal={handleSignProposal}
            handleDownload={handleDownload}
            signedProposalsData={signedProposalsData}
          />
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div className="spinner"></div>
        <p>Loading your proposals...</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div style={modalOverlayStyle} onClick={closeLogoutModal}>
          <div style={modalContainerStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={modalIconStyle}>
                <MdExitToApp size={32} color="#ef4444" />
              </div>
              <button onClick={closeLogoutModal} style={modalCloseButtonStyle}>
                <MdClose size={20} />
              </button>
            </div>
            <h3 style={modalTitleStyle}>Confirm Logout</h3>
            <p style={modalMessageStyle}>
              Are you sure you want to logout? You will need to sign in again to access your proposals.
            </p>
            <div style={modalButtonGroupStyle}>
              <button 
                onClick={closeLogoutModal} 
                style={modalCancelButtonStyle}
                disabled={isLoggingOut}
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout} 
                style={modalConfirmButtonStyle(isLoggingOut)}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Logging out..." : "Yes, Logout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <div style={mobileOverlayStyle} onClick={() => setMobileMenuOpen(false)} />
      )}

      <div style={sidebarContainerStyle(sidebarCollapsed, mobileMenuOpen)}>
        <div style={sidebarStyle(sidebarCollapsed)}>
          <div style={logoAreaStyle}>
            <div style={logoIconStyle}>
              <MdDescription size={28} color="#fff" />
            </div>
            {!sidebarCollapsed && (
              <div style={logoTextAreaStyle}>
                <h1 style={logoTextStyle}>ProposalHub</h1>
                <p style={logoSubtextStyle}>Client Portal</p>
              </div>
            )}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={collapseButtonStyle}>
              {sidebarCollapsed ? <MdChevronRight size={18} /> : <MdChevronLeft size={18} />}
            </button>
          </div>

          {!sidebarCollapsed && (
            <div style={userProfileStyle}>
              <div style={userAvatarStyle}>
                {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0) || "U"}
              </div>
              <div style={userInfoStyle}>
                <div style={userNameStyle}>{currentUser?.displayName || currentUser?.email?.split('@')[0]}</div>
                <div style={userEmailStyle}>{currentUser?.email}</div>
              </div>
            </div>
          )}

          <nav style={navStyle}>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                style={navItemStyle(
                  activeTab === item.id || 
                  (activeTab === "all" && item.id === "pending" && statusFilter === "pending") || 
                  (activeTab === "all" && item.id === "signed" && statusFilter === "signed")
                )}
              >
                <span style={navIconStyle}>{item.icon}</span>
                {!sidebarCollapsed && (
                  <>
                    <span style={navLabelStyle}>{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span style={navBadgeStyle}>{item.count}</span>
                    )}
                  </>
                )}
              </button>
            ))}
          </nav>

          <div style={bottomActionsStyle}>
            <button onClick={openLogoutModal} style={logoutNavStyle}>
              <MdLogout size={20} />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </div>

      <div style={mainContentStyle(sidebarCollapsed)}>
        <div style={mobileHeaderStyle}>
          <button onClick={() => setMobileMenuOpen(true)} style={menuButtonStyle}>
            <MdMenu size={24} />
          </button>
          <div style={mobileLogoStyle}>
            <MdDescription size={24} color="#6366f1" />
            <span>ProposalHub</span>
          </div>
          <div style={mobileUserAvatarStyle}>
            {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0) || "U"}
          </div>
        </div>

        <div style={welcomeBannerStyle}>
          <div style={welcomeBannerContentStyle}>
            <div>
              <h2 style={welcomeTitleStyle}>Welcome back, {currentUser?.displayName || currentUser?.email?.split('@')[0]}!</h2>
              <p style={welcomeSubtitleStyle}>Here's what's happening with your proposals today.</p>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={welcomeDateStyle}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <button
                onClick={refreshDashboard}
                style={{
                  padding: "8px 16px",
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
                disabled={refreshing}
              >
                <MdRefresh size={16} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        <div style={statsContainerStyle}>
          <StatCard icon={<MdFolder size={24} />} color="#6366f1" value={stats.total} label="Total Proposals" trend="All time" />
          <StatCard icon={<MdPending size={24} />} color="#f59e0b" value={stats.pending} label="Pending Review" trend="Awaiting action" />
          <StatCard icon={<MdVisibility size={24} />} color="#3b82f6" value={stats.viewed} label="Viewed" trend="Opened" />
          <StatCard icon={<MdVerified size={24} />} color="#10b981" value={stats.signed} label="Signed" trend="Completed" />
        </div>

        <div style={contentAreaStyle}>
          {renderContent()}
        </div>
      </div>

      <style>{`
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(99, 102, 241, 0.1);
          border-top: 3px solid #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// Modal Styles
const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  animation: "fadeIn 0.2s ease",
};

const modalContainerStyle = {
  backgroundColor: "#fff",
  borderRadius: "20px",
  width: "90%",
  maxWidth: "420px",
  padding: "28px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  animation: "slideUp 0.3s ease",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "20px",
};

const modalIconStyle = {
  width: "56px",
  height: "56px",
  borderRadius: "28px",
  background: "#fee2e2",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalCloseButtonStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#94a3b8",
  padding: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "8px",
  transition: "all 0.2s",
};

const modalTitleStyle = {
  fontSize: "22px",
  fontWeight: "600",
  color: "#1e293b",
  marginBottom: "12px",
};

const modalMessageStyle = {
  fontSize: "15px",
  color: "#64748b",
  marginBottom: "28px",
  lineHeight: "1.5",
};

const modalButtonGroupStyle = {
  display: "flex",
  gap: "12px",
};

const modalCancelButtonStyle = {
  flex: 1,
  padding: "12px 16px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  color: "#64748b",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 0.2s",
};

const modalConfirmButtonStyle = (disabled) => ({
  flex: 1,
  padding: "12px 16px",
  background: disabled ? "#cbd5e1" : "#ef4444",
  border: "none",
  borderRadius: "12px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "500",
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "all 0.2s",
});

// StatCard Component
const StatCard = ({ icon, color, value, label, trend }) => (
  <div style={statCardStyle}>
    <div style={statIconContainerStyle(color)}>{icon}</div>
    <div style={statInfoStyle}>
      <div style={statValueStyle}>{value}</div>
      <div style={statLabelStyle}>{label}</div>
      <div style={statTrendStyle}>{trend}</div>
    </div>
  </div>
);

// EmptyState Component
const EmptyState = ({ icon, title, message }) => (
  <div style={emptyStateStyle}>
    <div style={emptyStateIconStyle}>{icon}</div>
    <h3 style={emptyStateTitleStyle}>{title}</h3>
    <p style={emptyStateMessageStyle}>{message}</p>
  </div>
);

// ProposalsGrid Component
const ProposalsGrid = ({ proposals, handleViewProposal, handleSignProposal, handleDownload, getDaysLeft, signedProposalsData }) => (
  <div style={proposalsGridStyle}>
    {proposals.map((proposal, index) => {
      const daysLeft = getDaysLeft(proposal.expiresAt);
      const isExpiring = daysLeft !== null && daysLeft <= 3 && daysLeft > 0;
      const isSigned = proposal.status === "signed";
      
      return (
        <div key={proposal.id || index} style={proposalCardStyle}>
          <div style={cardBadgeStyle}>
            <ProposalStatusBadge status={proposal.status} size="small" />
          </div>
          
          <div style={cardIconStyle}>
            {isSigned ? (
              <MdVerified size={40} color="#10b981" />
            ) : (
              <MdInsertDriveFile size={40} color="#6366f1" />
            )}
          </div>
          
          <h3 style={proposalTitleStyle}>{proposal.fileName}</h3>
          
          <div style={proposalMetaStyle}>
            <div style={metaItemStyle}>
              <MdPerson size={14} color="#94a3b8" />
              <span>From: <strong>{proposal.senderDisplay || proposal.sharedByEmail || proposal.sharedBy || "Admin"}</strong></span>
            </div>
            <div style={metaItemStyle}>
              <MdAccessTime size={14} color="#94a3b8" />
              <span>Received: {proposal.sharedAt.toLocaleDateString()}</span>
            </div>
            {isSigned && proposal.signedAt && (
              <div style={metaItemStyle}>
                <MdVerified size={14} color="#10b981" />
                <span style={{ color: "#10b981" }}>
                  Signed {new Date(proposal.signedAt).toLocaleDateString()}
                </span>
              </div>
            )}
            {proposal.expiresAt && !isSigned && (
              <div style={metaItemStyle}>
                <MdSchedule size={14} color={isExpiring ? "#f59e0b" : "#94a3b8"} />
                <span style={isExpiring ? { color: "#f59e0b", fontWeight: "500" } : {}}>
                  {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` : 'Expired'}
                </span>
              </div>
            )}
          </div>

          {isExpiring && !isSigned && (
            <div style={expiringWarningStyle}>
              <MdSchedule size={12} />
              <span>Expiring soon!</span>
            </div>
          )}

          <div style={cardActionsStyle}>
            <button 
              onClick={() => handleViewProposal(proposal)} 
              style={actionButtonStyle(isSigned ? "#10b981" : "#3b82f6")}
            >
              {isSigned ? <MdVerified size={16} /> : <MdVisibility size={16} />}
              {isSigned ? "View Signed" : "View"}
            </button>
            
            {!isSigned && (
              <button onClick={() => handleSignProposal(proposal)} style={actionButtonStyle("#10b981")}>
                <MdEdit size={16} />
                Sign
              </button>
            )}
            
            <button onClick={() => handleDownload(proposal)} style={actionButtonStyle("#64748b")}>
              <MdDownload size={16} />
              Download
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

// ProposalsList Component
const ProposalsList = ({ proposals, handleViewProposal, handleSignProposal, handleDownload, signedProposalsData }) => (
  <div style={proposalsListStyle}>
    <table style={listTableStyle}>
      <thead>
        <tr style={listHeaderStyle}>
          <th style={listHeaderCellStyle}>Proposal</th>
          <th style={listHeaderCellStyle}>From</th>
          <th style={listHeaderCellStyle}>Received</th>
          <th style={listHeaderCellStyle}>Signed Date</th>
          <th style={listHeaderCellStyle}>Status</th>
          <th style={listHeaderCellStyle}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {proposals.map((proposal, index) => {
          const isSigned = proposal.status === "signed";
          return (
            <tr key={proposal.id || index} style={listRowStyle}>
              <td style={listCellStyle}>
                <div style={listFileInfoStyle}>
                  {isSigned ? (
                    <MdVerified size={20} color="#10b981" />
                  ) : (
                    <MdInsertDriveFile size={20} color="#6366f1" />
                  )}
                  <span>{proposal.fileName}</span>
                </div>
              </td>
              <td style={listCellStyle}>
                {proposal.senderDisplay || proposal.sharedByEmail || proposal.sharedBy || "Admin"}
              </td>
              <td style={listCellStyle}>{proposal.sharedAt.toLocaleDateString()}</td>
              <td style={listCellStyle}>
                {isSigned && proposal.signedAt ? (
                  <span style={{ color: "#10b981" }}>
                    {new Date(proposal.signedAt).toLocaleDateString()}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td style={listCellStyle}>
                <ProposalStatusBadge status={proposal.status} size="small" />
              </td>
              <td style={listCellStyle}>
                <div style={listActionsStyle}>
                  <button 
                    onClick={() => handleViewProposal(proposal)} 
                    style={listActionButtonStyle(isSigned ? "#10b981" : "#3b82f6")} 
                    title={isSigned ? "View Signed Document" : "View Proposal"}
                  >
                    {isSigned ? <MdVerified size={14} /> : <MdVisibility size={14} />}
                  </button>
                  {!isSigned && (
                    <button onClick={() => handleSignProposal(proposal)} style={listActionButtonStyle("#10b981")} title="Sign">
                      <MdEdit size={14} />
                    </button>
                  )}
                  <button onClick={() => handleDownload(proposal)} style={listActionButtonStyle("#64748b")} title="Download">
                    <MdDownload size={14} />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// RecentlyViewedGrid Component
const RecentlyViewedGrid = ({ items }) => (
  <div style={recentlyViewedGridStyle}>
    {items.map((item, index) => (
      <div key={item.id || index} style={recentlyViewedCardStyle}>
        <div style={recentlyViewedIconStyle}>
          <MdVisibility size={28} color="#3b82f6" />
        </div>
        <div style={recentlyViewedContentStyle}>
          <div style={recentlyViewedTitle}>{item.fileName}</div>
          <div style={recentlyViewedDate}>
            Viewed: {item.viewedAt?.toLocaleDateString()} at {item.viewedAt?.toLocaleTimeString()}
          </div>
        </div>
        <button 
          onClick={() => {
            const encodedPath = btoa(item.filePath);
            window.open(`/p/${encodedPath}`, '_blank');
          }}
          style={recentlyViewedButtonStyle}
        >
          <MdOpenInNew size={16} />
          Open Again
        </button>
      </div>
    ))}
  </div>
);

// Styles
const containerStyle = {
  display: "flex",
  minHeight: "100vh",
  background: "#f8fafc",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const sidebarContainerStyle = (collapsed, mobileOpen) => ({
  width: collapsed ? 80 : 280,
  transition: "width 0.3s ease",
  position: "fixed",
  left: 0,
  top: 0,
  bottom: 0,
  zIndex: 100,
});

const sidebarStyle = (collapsed) => ({
  width: "100%",
  height: "100%",
  background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
  display: "flex",
  flexDirection: "column",
  boxShadow: "2px 0 10px rgba(0,0,0,0.1)",
  position: "relative",
});

const logoAreaStyle = {
  padding: "24px 20px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  position: "relative",
};

const logoIconStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const logoTextAreaStyle = {
  flex: 1,
};

const logoTextStyle = {
  margin: 0,
  fontSize: "18px",
  fontWeight: "700",
  color: "#fff",
  letterSpacing: "-0.5px",
};

const logoSubtextStyle = {
  margin: "2px 0 0 0",
  fontSize: "11px",
  color: "rgba(255,255,255,0.5)",
};

const collapseButtonStyle = {
  position: "absolute",
  right: "-12px",
  top: "32px",
  width: "24px",
  height: "24px",
  borderRadius: "12px",
  background: "#2d3748",
  border: "none",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s",
};

const userProfileStyle = {
  padding: "20px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};

const userAvatarStyle = {
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "18px",
  fontWeight: "600",
  color: "#fff",
};

const userInfoStyle = {
  flex: 1,
};

const userNameStyle = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#fff",
  marginBottom: "2px",
};

const userEmailStyle = {
  fontSize: "11px",
  color: "rgba(255,255,255,0.6)",
  wordBreak: "break-all",
};

const navStyle = {
  flex: 1,
  padding: "20px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const navItemStyle = (active) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: active ? "rgba(99, 102, 241, 0.2)" : "transparent",
  border: "none",
  width: "100%",
  cursor: "pointer",
  transition: "all 0.2s",
  color: active ? "#fff" : "rgba(255,255,255,0.7)",
  position: "relative",
});

const navIconStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
};

const navLabelStyle = {
  flex: 1,
  textAlign: "left",
  fontSize: "14px",
  fontWeight: "500",
};

const navBadgeStyle = {
  background: "#6366f1",
  color: "#fff",
  fontSize: "11px",
  fontWeight: "600",
  padding: "2px 8px",
  borderRadius: "20px",
};

const bottomActionsStyle = {
  padding: "20px",
  borderTop: "1px solid rgba(255,255,255,0.1)",
};

const logoutNavStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: "rgba(239, 68, 68, 0.1)",
  border: "none",
  width: "100%",
  cursor: "pointer",
  transition: "all 0.2s",
  color: "#ef4444",
};

const mainContentStyle = (collapsed) => ({
  flex: 1,
  marginLeft: collapsed ? 80 : 280,
  transition: "margin-left 0.3s ease",
  minHeight: "100vh",
  background: "#f8fafc",
});

const mobileHeaderStyle = {
  display: "none",
  padding: "16px 20px",
  background: "#fff",
  borderBottom: "1px solid #e2e8f0",
  alignItems: "center",
  justifyContent: "space-between",
};

const menuButtonStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#1e293b",
  padding: "8px",
};

const mobileLogoStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "18px",
  fontWeight: "600",
  color: "#1e293b",
};

const mobileUserAvatarStyle = {
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "14px",
  fontWeight: "600",
  color: "#fff",
};

const mobileOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  zIndex: 99,
  display: "none",
};

const welcomeBannerStyle = {
  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  margin: "24px 24px 0 24px",
  padding: "32px",
  borderRadius: "24px",
  color: "#fff",
};

const welcomeBannerContentStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "16px",
};

const welcomeTitleStyle = {
  margin: 0,
  fontSize: "24px",
  fontWeight: "700",
};

const welcomeSubtitleStyle = {
  margin: "8px 0 0 0",
  fontSize: "14px",
  opacity: 0.9,
};

const welcomeDateStyle = {
  fontSize: "14px",
  padding: "8px 16px",
  background: "rgba(255,255,255,0.2)",
  borderRadius: "100px",
  backdropFilter: "blur(10px)",
};

const statsContainerStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "20px",
  padding: "24px",
};

const statCardStyle = {
  background: "#fff",
  borderRadius: "20px",
  padding: "20px",
  display: "flex",
  alignItems: "center",
  gap: "16px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  border: "1px solid #e2e8f0",
  transition: "all 0.3s",
};

const statIconContainerStyle = (color) => ({
  width: "56px",
  height: "56px",
  borderRadius: "16px",
  background: color,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  opacity: 0.9,
});

const statInfoStyle = {
  flex: 1,
};

const statValueStyle = {
  fontSize: "32px",
  fontWeight: "700",
  color: "#1e293b",
  lineHeight: "1.2",
};

const statLabelStyle = {
  fontSize: "13px",
  color: "#64748b",
  marginTop: "4px",
};

const statTrendStyle = {
  fontSize: "11px",
  color: "#10b981",
  marginTop: "4px",
};

const contentAreaStyle = {
  padding: "0 24px 24px 24px",
};

const searchContainerStyle = {
  display: "flex",
  gap: "16px",
  marginBottom: "32px",
  flexWrap: "wrap",
  alignItems: "center",
};

const searchInputWrapper = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: "12px",
  background: "#fff",
  padding: "12px 20px",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  transition: "all 0.2s",
};

const searchInputStyle = {
  flex: 1,
  border: "none",
  outline: "none",
  fontSize: "14px",
  background: "transparent",
  color: "#1e293b",
};

const clearSearchStyle = {
  background: "none",
  border: "none",
  color: "#94a3b8",
  cursor: "pointer",
  fontSize: "14px",
  padding: "4px",
};

const filterWrapperStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  background: "#fff",
  padding: "12px 20px",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
};

const filterSelectStyle = {
  border: "none",
  outline: "none",
  fontSize: "14px",
  background: "transparent",
  cursor: "pointer",
  color: "#1e293b",
};

const viewModeToggleStyle = {
  display: "flex",
  gap: "8px",
  background: "#fff",
  padding: "4px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
};

const viewModeButtonStyle = (active) => ({
  padding: "8px 12px",
  background: active ? "#6366f1" : "transparent",
  border: "none",
  borderRadius: "8px",
  color: active ? "#fff" : "#64748b",
  cursor: "pointer",
  transition: "all 0.2s",
});

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
  flexWrap: "wrap",
  gap: "16px",
};

const overviewHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
};

const sectionTitleStyle = {
  fontSize: "20px",
  fontWeight: "600",
  color: "#1e293b",
  margin: 0,
};

const resultCountStyle = {
  fontSize: "14px",
  color: "#64748b",
};

const refreshButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 16px",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  color: "#64748b",
  fontSize: "13px",
  cursor: "pointer",
  transition: "all 0.2s",
};

const emptyStateStyle = {
  background: "#fff",
  padding: "60px",
  borderRadius: "20px",
  textAlign: "center",
  border: "1px solid #e2e8f0",
};

const emptyStateIconStyle = {
  marginBottom: "20px",
};

const emptyStateTitleStyle = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#1e293b",
  margin: "0 0 8px 0",
};

const emptyStateMessageStyle = {
  fontSize: "14px",
  color: "#64748b",
  margin: 0,
};

const proposalsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
  gap: "24px",
};

const proposalCardStyle = {
  background: "#fff",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  border: "1px solid #e2e8f0",
  position: "relative",
  transition: "all 0.3s",
};

const cardBadgeStyle = {
  position: "absolute",
  top: "20px",
  right: "20px",
};

const cardIconStyle = {
  marginBottom: "20px",
};

const proposalTitleStyle = {
  margin: "0 0 16px 0",
  fontSize: "16px",
  fontWeight: "600",
  color: "#1e293b",
  lineHeight: "1.4",
  wordBreak: "break-word",
};

const proposalMetaStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  marginBottom: "20px",
  padding: "12px",
  background: "#f8fafc",
  borderRadius: "12px",
};

const metaItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  color: "#64748b",
};

const expiringWarningStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "10px",
  background: "#fef3c7",
  borderRadius: "10px",
  marginBottom: "16px",
  fontSize: "12px",
  color: "#d97706",
};

const cardActionsStyle = {
  display: "flex",
  gap: "10px",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const actionButtonStyle = (color) => ({
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "10px",
  background: "#fff",
  border: `1px solid ${color}20`,
  borderRadius: "10px",
  color: color,
  fontSize: "13px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 0.2s",
});

const proposalsListStyle = {
  background: "#fff",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  overflow: "hidden",
};

const listTableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const listHeaderStyle = {
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};

const listHeaderCellStyle = {
  padding: "16px 20px",
  textAlign: "left",
  fontSize: "13px",
  fontWeight: "600",
  color: "#64748b",
};

const listRowStyle = {
  borderBottom: "1px solid #e2e8f0",
  transition: "background 0.2s",
};

const listCellStyle = {
  padding: "16px 20px",
  fontSize: "14px",
  color: "#1e293b",
};

const listFileInfoStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const listActionsStyle = {
  display: "flex",
  gap: "8px",
};

const listActionButtonStyle = (color) => ({
  padding: "6px 10px",
  background: `${color}10`,
  border: "none",
  borderRadius: "8px",
  color: color,
  cursor: "pointer",
  transition: "all 0.2s",
});

const recentlyViewedGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
  gap: "16px",
};

const recentlyViewedCardStyle = {
  background: "#fff",
  padding: "20px",
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  gap: "16px",
  border: "1px solid #e2e8f0",
  transition: "all 0.2s",
};

const recentlyViewedIconStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "12px",
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const recentlyViewedContentStyle = {
  flex: 1,
};

const recentlyViewedTitle = {
  fontSize: "14px",
  fontWeight: "500",
  color: "#1e293b",
  wordBreak: "break-word",
};

const recentlyViewedDate = {
  fontSize: "12px",
  color: "#94a3b8",
  marginTop: "4px",
};

const recentlyViewedButtonStyle = {
  padding: "8px 14px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  color: "#64748b",
  fontSize: "12px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  transition: "all 0.2s",
};

const overviewSectionStyle = {
  background: "#fff",
  borderRadius: "20px",
  padding: "24px",
  marginBottom: "24px",
  border: "1px solid #e2e8f0",
};

const overviewTitleStyle = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1e293b",
  margin: 0,
};

const recentProposalsListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const recentProposalItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  borderRadius: "12px",
  background: "#f8fafc",
  transition: "all 0.2s",
};

const recentProposalIconStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "10px",
  background: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #e2e8f0",
};

const recentProposalInfoStyle = {
  flex: 1,
};

const recentProposalNameStyle = {
  fontSize: "14px",
  fontWeight: "500",
  color: "#1e293b",
  marginBottom: "4px",
};

const recentProposalMetaStyle = {
  fontSize: "12px",
  color: "#64748b",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const recentProposalButtonStyle = {
  padding: "6px 12px",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  color: "#6366f1",
  fontSize: "12px",
  cursor: "pointer",
  transition: "all 0.2s",
};

const emptyRecentStyle = {
  padding: "40px",
  textAlign: "center",
  color: "#94a3b8",
  fontSize: "14px",
};

const loadingContainerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  gap: "20px",
  background: "#fff",
};