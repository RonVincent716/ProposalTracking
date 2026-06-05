// src/components/Dashboard.jsx
import { useState, useEffect, useRef, useMemo } from "react";
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
  MdCheckCircleOutline,
  MdChat,
  MdNotifications,
  MdNotificationsNone,
  MdDoneAll,
  MdClear,
  MdVisibilityOff,
  MdGroup,
  MdTrendingUp,
  MdSettings,
  MdHelpOutline,
  MdSwitchAccount
} from "react-icons/md";
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, writeBatch, addDoc, serverTimestamp, getDoc, setDoc } from "firebase/firestore";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { Navigate, useNavigate } from "react-router-dom";
import ProposalUploader from "./ProposalUploader";
import ProposalStatusBadge from "./ProposalStatusBadge";
import ShareModal from "./ShareModal";
import { ActivityLogger } from "../utils/activityLogger";
import SignedProposalsTab from "../Components/SignedProposalsTab";
import ProposalAnalyticsTab from "../Components/ProposalAnalyticsTab";
import ProposalsTabWithDelete from "../Components/ProposalsTabWithDelete";
import RealTimeViewTracker from "../Components/RealTimeViewTracker";
import MyTemplatesTab from "../Components/MyTemplatesTab";
import FollowUpCenter from "../Components/FollowUpCenter";
import AdminDiscussionDashboard from "../Components/AdminDiscussionDashboard";
import UserProfile from "../Components/UserProfile";
import UserManagement from "../Components/UserManagement";
import UsersActivityTab from "../Components/UsersActivityTab";
import PerUserStatsTab from "../Components/PerUserStatsTab";
import { usePermissions } from "../utils/permissions";

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
  const [activeViewers, setActiveViewers] = useState([]);
  const [activeTab, setActiveTab] = useState("home");
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAdminDiscussionDashboard, setShowAdminDiscussionDashboard] = useState(false);
  const [showMoreMenuItems, setShowMoreMenuItems] = useState(false);
  
  // Notification system states
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readNotificationKeys, setReadNotificationKeys] = useState(new Set());
  const [readNotificationKeysLoaded, setReadNotificationKeysLoaded] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const notificationRef = useRef(null);
  const profileMenuRef = useRef(null);
  const readNotificationKeysRef = useRef(new Set());
  const previousSignedRef = useRef(new Set());
  const previousViewsRef = useRef(new Set());
  
  // Discussion unread count
  const [unreadDiscussionCount, setUnreadDiscussionCount] = useState(0);
  const [discussionStats, setDiscussionStats] = useState({
    total: 0,
    open: 0,
    resolved: 0
  });
  const [orgUserStats, setOrgUserStats] = useState({
    totalUsers: 0,
    activeAdmins: 0,
    pendingRequests: 0,
    suspendedUsers: 0
  });
  const [lastSeenByDiscussion, setLastSeenByDiscussion] = useState(() => {
    try {
      const raw = localStorage.getItem(`dashboard-discussion-seen:${user?.uid || ''}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    readNotificationKeysRef.current = readNotificationKeys;
  }, [readNotificationKeys]);

  useEffect(() => {
    if (!user?.uid) {
      setLastSeenByDiscussion({});
      return;
    }

    try {
      const raw = localStorage.getItem(`dashboard-discussion-seen:${user.uid}`);
      setLastSeenByDiscussion(raw ? JSON.parse(raw) : {});
    } catch {
      setLastSeenByDiscussion({});
    }
  }, [user?.uid]);
  
  // Delete functionality states
  const [selectedViews, setSelectedViews] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [dateFilter, setDateFilter] = useState("all");

  // Share proposal modal state (for link generation)
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingProposal, setSharingProposal] = useState(null);
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [showShareSuccess, setShowShareSuccess] = useState(false);

  // Email Modal States
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailProposal, setEmailProposal] = useState(null);

  // Logout confirmation modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showLogoutSuccess, setShowLogoutSuccess] = useState(false);
  const [showLogoutToast, setShowLogoutToast] = useState(false);
  
  // View proposal modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const [viewUrl, setViewUrl] = useState("");
  const [liveTrackerProposal, setLiveTrackerProposal] = useState(null);
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
  const { role, loading: permissionsLoading, can } = usePermissions();
  const isRestrictedUser = role === "user";
  const canDeleteData = role === "admin" || role === "superadmin";
  const canAccessUsersTab = can("viewAllUsers");
  const canAccessDiscussions = can("viewAdminDiscussions");
  const canAccessUserActivity = can("viewUserActivity");

  const timestampToMs = (value) => {
    if (!value) return 0;
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    if (value?.seconds) return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getSessionSortTimestamp = (session) =>
    timestampToMs(
      session?.lastActiveAt ||
      session?.lastActivity ||
      session?.updatedAt ||
      session?.endTime ||
      session?.startedAt ||
      session?.startTime ||
      session?.createdAt
    );
  
  /* AUTH CHECK */
  useEffect(()=>{
    const unsubscribe = onAuthStateChanged(auth,(currentUser)=>{
      setUser(currentUser);
      setAuthChecked(true);
    });
    return ()=>unsubscribe();
  },[]);

  useEffect(() => {
    if (!role) return;

    if (
      isRestrictedUser &&
      activeTab !== "home" &&
      activeTab !== "upload" &&
      activeTab !== "views" &&
      activeTab !== "profile"
    ) {
      setActiveTab("views");
    }

    if (isRestrictedUser && showMoreMenuItems) {
      setShowMoreMenuItems(false);
    }

    if (isRestrictedUser && showAdminDiscussionDashboard) {
      setShowAdminDiscussionDashboard(false);
    }
  }, [role, activeTab, isRestrictedUser, showMoreMenuItems, showAdminDiscussionDashboard]);

  /* LOAD READ NOTIFICATION KEYS FROM FIRESTORE */
  useEffect(() => {
    if (!user) {
      setReadNotificationKeys(new Set());
      setReadNotificationKeysLoaded(false);
      return;
    }

    const loadReadNotifications = async () => {
      try {
        const docRef = doc(db, 'dashboardNotificationPreferences', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().readNotificationKeys) {
          setReadNotificationKeys(new Set(docSnap.data().readNotificationKeys));
        } else {
          setReadNotificationKeys(new Set());
        }
      } catch (error) {
        console.error('Error loading read notifications:', error);
      } finally {
        setReadNotificationKeysLoaded(true);
      }
    };

    loadReadNotifications();
  }, [user]);

  useEffect(() => {
    if (!readNotificationKeysLoaded) return;

    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read:
          (notification.key && readNotificationKeys.has(notification.key)) ||
          (notification.legacyKey && readNotificationKeys.has(notification.legacyKey)) ||
          notification.read
      }))
    );
  }, [readNotificationKeys, readNotificationKeysLoaded]);

  /* HELPER FUNCTIONS FOR DISCUSSION UNREAD COUNT */
  const toMillis = (value) => {
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getLatestClientMessageMs = (messages = []) => {
    let latest = 0;
    messages.forEach((msg) => {
      if (msg.senderRole === 'admin') return;
      const ts = toMillis(msg.timestamp);
      if (ts > latest) latest = ts;
    });
    return latest;
  };

  const getUnreadCount = (messages = [], seenMs = 0) =>
    messages.reduce((count, msg) => {
      if (msg.senderRole === 'admin') return count;
      return toMillis(msg.timestamp) > seenMs ? count + 1 : count;
    }, 0);

  /* LOAD DISCUSSION UNREAD COUNT */
  useEffect(() => {
    if (!user || !canAccessDiscussions) return;

    // Persist last seen to localStorage
    try {
      localStorage.setItem(
        `dashboard-discussion-seen:${user.uid}`,
        JSON.stringify(lastSeenByDiscussion)
      );
    } catch {
      // no-op
    }

    // Listen to discussions
    const discussionsQuery = query(collection(db, 'proposalDiscussions'));
    const messagesQuery = query(
      collection(db, 'proposalDiscussionMessages'),
      orderBy('timestamp', 'asc')
    );

    let discussionData = {};
    let messageData = {};
    let totalUnread = 0;

    const unsubDiscussions = onSnapshot(
      discussionsQuery,
      (snapshot) => {
        discussionData = {};
        snapshot.docs.forEach((doc) => {
          discussionData[doc.id] = {
            id: doc.id,
            ...doc.data()
          };
        });
        // Recalculate unread count
        calculateUnreadCount();
      },
      (error) => {
        console.error('Error loading discussions:', error);
      }
    );

    const unsubMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        messageData = {};
        snapshot.docs.forEach((doc) => {
          const raw = doc.data();
          if (!messageData[raw.discussionId]) {
            messageData[raw.discussionId] = [];
          }
          messageData[raw.discussionId].push({
            id: doc.id,
            ...raw,
            timestamp: raw.timestamp?.toDate?.() || new Date()
          });
        });
        // Recalculate unread count
        calculateUnreadCount();
      },
      (error) => {
        console.error('Error loading messages:', error);
      }
    );

    const calculateUnreadCount = () => {
      totalUnread = 0;
      Object.values(discussionData).forEach((discussion) => {
        const messages = messageData[discussion.id] || [];
        const seenMs = lastSeenByDiscussion[discussion.id] || 0;
        const unread = getUnreadCount(messages, seenMs);
        totalUnread += unread;
      });
      setUnreadDiscussionCount(totalUnread);
    };

    return () => {
      unsubDiscussions();
      unsubMessages();
    };
  }, [user, canAccessDiscussions, lastSeenByDiscussion]);

  useEffect(() => {
    if (!user || !canAccessDiscussions) {
      setDiscussionStats({ total: 0, open: 0, resolved: 0 });
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "proposalDiscussions"),
      (snapshot) => {
        let open = 0;
        let resolved = 0;
        snapshot.docs.forEach((discussionDoc) => {
          const status = discussionDoc.data()?.status || "open";
          if (status === "resolved") {
            resolved += 1;
          } else {
            open += 1;
          }
        });
        setDiscussionStats({
          total: snapshot.size,
          open,
          resolved
        });
      },
      (error) => {
        console.error("Error loading discussion stats:", error);
      }
    );

    return () => unsubscribe();
  }, [user, canAccessDiscussions]);

  useEffect(() => {
    if (!user || role !== "superadmin") {
      setOrgUserStats({
        totalUsers: 0,
        activeAdmins: 0,
        pendingRequests: 0,
        suspendedUsers: 0
      });
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        let activeAdmins = 0;
        let pendingRequests = 0;
        let suspendedUsers = 0;

        snapshot.docs.forEach((userDoc) => {
          const data = userDoc.data() || {};
          const normalizedRole = (data.role || "user").toLowerCase();
          const normalizedStatus = (data.status || "active").toLowerCase();

          if ((normalizedRole === "admin" || normalizedRole === "superadmin") && normalizedStatus !== "suspended") {
            activeAdmins += 1;
          }
          if (normalizedStatus === "pending" || normalizedStatus === "invited") {
            pendingRequests += 1;
          }
          if (normalizedStatus === "suspended") {
            suspendedUsers += 1;
          }
        });

        setOrgUserStats({
          totalUsers: snapshot.size,
          activeAdmins,
          pendingRequests,
          suspendedUsers
        });
      },
      (error) => {
        console.error("Error loading organization user stats:", error);
      }
    );

    return () => unsubscribe();
  }, [user, role]);

  /* UPDATED LOGOUT WITH SUCCESS MODAL */
  const handleLogout = async () => {
    try {
      // Log logout activity before signing out
      if (user) {
        await ActivityLogger.logLogout(user.email);
      }
      await signOut(auth);
      setShowLogoutModal(false);
      setShowLogoutSuccess(true);
      
      // Auto redirect after 3 seconds
      setTimeout(() => {
        setShowLogoutSuccess(false);
        navigate("/login");
      }, 3000);
    } catch (error) {
      alert(error.message);
    }
  };

  /* HANDLE SHARE PROPOSAL (Link Generation) */
  const handleShareProposal = (file) => {
    setSharingProposal(file);
    setClientEmail("");
    setClientName("");
    setShareLink("");
    setShowShareModal(true);
  };

  /* GENERATE SHARE LINK */
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

      // Add to sharedProposals collection for client dashboard
      await addDoc(collection(db, "sharedProposals"), {
        fileName: sharingProposal.name,
        filePath: fullPath,
        clientEmail: clientEmail,
        clientName: clientName || clientEmail.split('@')[0],
        sharedBy: user.email,
        sharedByEmail: user.email,
        sharedAt: serverTimestamp(),
        status: "pending",
        viewCount: 0
      });
      await ActivityLogger.logShare(fullPath, sharingProposal.name, [clientEmail]);
      
      console.log("✅ Added to sharedProposals for:", clientEmail);
      
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
        const data = snapshot.docs
          .map(doc=>({
            id:doc.id,
            ...doc.data()
          }))
          .sort((a, b) => {
            const diff = getSessionSortTimestamp(b) - getSessionSortTimestamp(a);
            if (diff !== 0) return diff;
            return (b.id || "").localeCompare(a.id || "");
          });
        setSessions(data);
      }
    );
    return ()=>unsub();
  },[user]);

  /* LISTEN TO ACTIVE VIEWERS */
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(collection(db, "activeViewers"), (snapshot) => {
      const now = Date.now();
      const liveData = snapshot.docs
        .map((viewerDoc) => {
          const data = viewerDoc.data();
          const lastActiveFromServer = data.lastActive?.toDate?.() || (data.lastActive ? new Date(data.lastActive) : null);
          const lastActiveFromClient = data.lastActiveClient ? new Date(data.lastActiveClient) : null;
          const lastActive = lastActiveFromServer || lastActiveFromClient;

          return {
            id: viewerDoc.id,
            ...data,
            lastActive
          };
        })
        .filter((viewer) => viewer.lastActive && (now - viewer.lastActive.getTime()) < 120000)
        .sort((a, b) => b.lastActive - a.lastActive);

      setActiveViewers(liveData);
    });

    return () => unsub();
  }, [user]);

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
      
      // Track new signed proposals using ref (no infinite loop)
      data.forEach(proposal => {
        if (!previousSignedRef.current.has(proposal.id)) {
          previousSignedRef.current.add(proposal.id);
          addNotification({
            type: 'signed',
            sourceId: proposal.id,
            key: `signed-${proposal.id}`,
            title: 'Proposal Signed',
            message: `${proposal.proposalName} was signed by ${proposal.clientEmail?.split('@')[0]}`,
            email: proposal.clientEmail,
            proposalId: proposal.id,
            timestamp: proposal.signedAt,
            icon: 'checkCircle'
          });
        }
      });
      
      setSignedProposals(data);
    });
    return ()=>unsub();
  },[user]);

  /* TRACK NEW PROPOSAL VIEWS */
  useEffect(() => {
    if (!user || views.length === 0) return;

    views.forEach(view => {
      const viewKey = `${view.id}-${view.fileName}`;
      if (!previousViewsRef.current.has(viewKey)) {
        previousViewsRef.current.add(viewKey);
        addNotification({
          type: 'view',
          sourceId: view.id,
          key: `view-${view.id}`,
          title: 'Proposal Viewed',
          message: `${view.fileName} viewed by ${view.viewerEmail?.split('@')[0]}`,
          email: view.viewerEmail,
          fileName: view.fileName,
          timestamp: view.viewedAt,
          icon: 'eye'
        });
      }
    });
  }, [views, user]);

  /* CLOSE NOTIFICATION PANEL WHEN CLICKING OUTSIDE */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProfileMenu]);

  const buildNotificationKey = (notification) => {
    if (notification.key) return notification.key;
    if (notification.sourceId) return `${notification.type}-${notification.sourceId}`;
    return `${notification.type}-${notification.email || 'unknown'}-${notification.fileName || notification.proposalId || ''}`;
  };

  const buildLegacyNotificationKey = (notification) =>
    `${notification.type}-${notification.email}-${notification.fileName || notification.proposalId || ''}`;

  const persistReadNotificationKeys = async (nextReadKeys) => {
    if (!user?.uid) return;
    const docRef = doc(db, 'dashboardNotificationPreferences', user.uid);
    await setDoc(
      docRef,
      {
        readNotificationKeys: Array.from(nextReadKeys),
        lastUpdated: serverTimestamp()
      },
      { merge: true }
    );
  };

  /* ADD NOTIFICATION HELPER */
  const addNotification = (notification) => {
    setNotifications(prev => {
      // Prevent duplicate notifications within 5 seconds
      const now = Date.now();
      const isDuplicate = prev.some(n => 
        n.type === notification.type && 
        n.email === notification.email && 
        (now - (n.timestamp?.getTime?.() || new Date(n.timestamp).getTime() || 0)) < 5000
      );
      
      if (isDuplicate) return prev;
      
      // Create a stable unique key for this notification
      const key = buildNotificationKey(notification);
      const legacyKey = buildLegacyNotificationKey(notification);
      
      // Check if this notification was previously read
      const isAlreadyRead =
        readNotificationKeysRef.current.has(key) ||
        readNotificationKeysRef.current.has(legacyKey);
      
      const id = now + Math.random();
      const notifWithId = {
        ...notification,
        id,
        timestamp: notification.timestamp || new Date(),
        read: isAlreadyRead,
        key,
        legacyKey
      };
      
      return [notifWithId, ...prev].slice(0, 50);
    });
  };

  /* MARK NOTIFICATION AS READ */
  const markNotificationAsRead = async (id) => {
    const notification = notifications.find((n) => n.id === id);
    if (!notification || notification.read) return;

    // Update local state
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );

    // Persist to Firestore
    try {
      const newReadKeys = new Set(readNotificationKeysRef.current);
      if (notification.key) {
        newReadKeys.add(notification.key);
      }
      if (notification.legacyKey) {
        newReadKeys.add(notification.legacyKey);
      }
      readNotificationKeysRef.current = newReadKeys;
      setReadNotificationKeys(newReadKeys);
      await persistReadNotificationKeys(newReadKeys);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    const unreadNotifications = notifications.filter((n) => !n.read);
    if (unreadNotifications.length === 0) return;

    setNotifications((prev) =>
      prev.map((n) => (n.read ? n : { ...n, read: true }))
    );

    try {
      const newReadKeys = new Set(readNotificationKeysRef.current);
      unreadNotifications.forEach((n) => {
        if (n.key) {
          newReadKeys.add(n.key);
        }
        if (n.legacyKey) {
          newReadKeys.add(n.legacyKey);
        }
      });
      readNotificationKeysRef.current = newReadKeys;
      setReadNotificationKeys(newReadKeys);
      await persistReadNotificationKeys(newReadKeys);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  /* CLEAR SINGLE NOTIFICATION */
  const clearNotification = async (id) => {
    const notification = notifications.find((n) => n.id === id);
    
    setNotifications(prev => prev.filter(n => n.id !== id));

    // Also mark as read when clearing
    if (notification && !notification.read) {
      try {
        const newReadKeys = new Set(readNotificationKeysRef.current);
        if (notification.key) {
          newReadKeys.add(notification.key);
        }
        if (notification.legacyKey) {
          newReadKeys.add(notification.legacyKey);
        }
        readNotificationKeysRef.current = newReadKeys;
        setReadNotificationKeys(newReadKeys);
        await persistReadNotificationKeys(newReadKeys);
      } catch (error) {
        console.error('Error clearing notification:', error);
      }
    }
  };

  /* CLEAR ALL NOTIFICATIONS */
  const clearAllNotifications = async () => {
    // Mark all unread notifications as read
    const unreadNotifications = notifications.filter((n) => !n.read);
    
    if (unreadNotifications.length > 0) {
      try {
        const newReadKeys = new Set(readNotificationKeysRef.current);
        unreadNotifications.forEach((n) => {
          if (n.key) {
            newReadKeys.add(n.key);
          }
          if (n.legacyKey) {
            newReadKeys.add(n.legacyKey);
          }
        });
        readNotificationKeysRef.current = newReadKeys;
        setReadNotificationKeys(newReadKeys);
        await persistReadNotificationKeys(newReadKeys);
      } catch (error) {
        console.error('Error clearing all notifications:', error);
      }
    }

    setNotifications([]);
  };

  /* FORMAT TIME AGO */
  const getTimeAgo = (date) => {
    if (!date) return 'just now';
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

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

  /* VIEW PROPOSAL */
  const viewProposal = (file)=>{
    const fullPath = `proposals/${file.name}`;
    const encoded = btoa(fullPath);
    const url = `${window.location.origin}/p/${encoded}`;
    void ActivityLogger.logDocumentView(fullPath, file.name);
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
      await ActivityLogger.logDownload(`proposals/${file.name}`, file.name);
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
      const sessionMs = timestampToMs(s.startedAt || s.startTime || s.createdAt);
      if (!sessionMs) return false;
      const sessionDate = new Date(sessionMs);
      
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
    if (!canDeleteData) {
      alert("Only Admins and SuperAdmins can delete data");
      return;
    }

    setDeleteItem({ id: viewId, name: fileName, type: "view" });
    setShowDeleteModal(true);
  };

  // Delete single session
  const handleDeleteSession = async (sessionId, fileName) => {
    if (!canDeleteData) {
      alert("Only Admins and SuperAdmins can delete data");
      return;
    }

    setDeleteItem({ id: sessionId, name: fileName, type: "session" });
    setShowDeleteModal(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!canDeleteData) {
      setShowDeleteModal(false);
      alert("Only Admins and SuperAdmins can delete data");
      return;
    }

    setIsDeleting(true);
    try {
      if (deleteItem) {
        const collectionName = deleteItem.type === "view" ? "proposalViews" : "proposalSessions";
        await deleteDoc(doc(db, collectionName, deleteItem.id));
        await ActivityLogger.logDelete(`${collectionName}/${deleteItem.id}`, deleteItem.name);
        setDeleteSuccess(`Successfully deleted ${deleteItem.name}`);
      } else if (deleteType === "views" && selectedViews.length > 0) {
        const batch = writeBatch(db);
        selectedViews.forEach(id => {
          const ref = doc(db, "proposalViews", id);
          batch.delete(ref);
        });
        await batch.commit();
        await ActivityLogger.logDelete("proposalViews/bulk", `Bulk delete ${selectedViews.length} views`);
        setDeleteSuccess(`Successfully deleted ${selectedViews.length} views`);
        setSelectedViews([]);
      } else if (deleteType === "sessions" && selectedSessions.length > 0) {
        const batch = writeBatch(db);
        selectedSessions.forEach(id => {
          const ref = doc(db, "proposalSessions", id);
          batch.delete(ref);
        });
        await batch.commit();
        await ActivityLogger.logDelete("proposalSessions/bulk", `Bulk delete ${selectedSessions.length} sessions`);
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
          await ActivityLogger.logDelete("proposalViews/filtered", `Filtered delete ${filteredViews.length} views`);
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
          await ActivityLogger.logDelete("proposalSessions/filtered", `Filtered delete ${filteredSessions.length} sessions`);
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
    if (!canDeleteData) return;

    if (checked) {
      setSelectedViews(views.map(v => v.id));
    } else {
      setSelectedViews([]);
    }
  };

  // Select all sessions
  const selectAllSessions = (checked) => {
    if (!canDeleteData) return;

    if (checked) {
      setSelectedSessions(filteredEngagement.map(s => s.id));
    } else {
      setSelectedSessions([]);
    }
  };

  // Toggle view selection
  const toggleViewSelection = (viewId) => {
    if (!canDeleteData) return;

    if (selectedViews.includes(viewId)) {
      setSelectedViews(selectedViews.filter(id => id !== viewId));
    } else {
      setSelectedViews([...selectedViews, viewId]);
    }
  };

  // Toggle session selection
  const toggleSessionSelection = (sessionId) => {
    if (!canDeleteData) return;

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

  // Filter + sort engagement (latest activity first)
  const filteredEngagement = useMemo(() => {
    const normalizedSearch = engagementSearch.trim().toLowerCase();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    return sessions
      .filter((s) => {
        const proposalName = (s.fileName || s.proposalName || s.proposal || "").toLowerCase();
        const viewer = (s.viewerEmail || s.email || s.userEmail || "").toLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          proposalName.includes(normalizedSearch) ||
          viewer.includes(normalizedSearch);

        if (!matchesSearch) return false;
        if (dateFilter === "all") return true;

        const sessionMs = timestampToMs(s.startedAt || s.startTime || s.createdAt);
        if (!sessionMs) return false;
        const sessionDate = new Date(sessionMs);

        if (dateFilter === "today") return sessionDate >= today;
        if (dateFilter === "week") return sessionDate >= weekAgo;
        if (dateFilter === "month") return sessionDate >= monthAgo;
        return true;
      })
      .sort((a, b) => {
        const diff = getSessionSortTimestamp(b) - getSessionSortTimestamp(a);
        if (diff !== 0) return diff;
        return (b.id || "").localeCompare(a.id || "");
      });
  }, [sessions, engagementSearch, dateFilter]);

  const paginatedEngagement = filteredEngagement.slice(
    (engagementPage - 1) * engagementPerPage,
    engagementPage * engagementPerPage
  );

  const totalEngagementPages = Math.ceil(filteredEngagement.length / engagementPerPage);

  useEffect(() => {
    if (totalEngagementPages === 0 && engagementPage !== 1) {
      setEngagementPage(1);
      return;
    }
    if (totalEngagementPages > 0 && engagementPage > totalEngagementPages) {
      setEngagementPage(totalEngagementPages);
    }
  }, [engagementPage, totalEngagementPages]);
  const activeViewerGroups = Object.values(
    activeViewers.reduce((acc, viewer) => {
      const key = viewer.proposalId || viewer.filePath || viewer.fileName || viewer.id;

      if (!acc[key]) {
        acc[key] = {
          proposalId: viewer.proposalId || viewer.filePath || viewer.fileName,
          proposalName: viewer.proposalName || viewer.fileName || "Unknown proposal",
          viewers: []
        };
      }

      acc[key].viewers.push(viewer);
      return acc;
    }, {})
  ).sort((a, b) => b.viewers.length - a.viewers.length);
  const uniqueActiveViewerCount = new Set(
    activeViewers.map((viewer) => viewer.viewerId || viewer.viewerEmail || viewer.id)
  ).size;
  const unreadNotificationCount = notifications.filter((notification) => !notification.read).length;
  const signedTodayCount = signedProposals.filter((proposal) => {
    const signedAt = proposal?.signedAt instanceof Date
      ? proposal.signedAt
      : proposal?.signedAt?.toDate?.() || new Date(proposal?.signedAt);
    if (!(signedAt instanceof Date) || Number.isNaN(signedAt.getTime())) return false;
    const now = new Date();
    return (
      signedAt.getFullYear() === now.getFullYear() &&
      signedAt.getMonth() === now.getMonth() &&
      signedAt.getDate() === now.getDate()
    );
  }).length;
  const unsignedProposalCount = Math.max(files.length - signedProposals.length, 0);
  const totalUniqueViewers = new Set(
    views
      .map((view) => view.viewerEmail || view.viewerId)
      .filter(Boolean)
  ).size;

  const roleDashboardTitle =
    role === "superadmin"
      ? "Superadmin Overview"
      : role === "admin"
        ? "Operations Overview"
        : "Personal Workspace";

  const roleDashboardSubtitle =
    role === "superadmin"
      ? "Organization controls, user health, and platform activity in one place."
      : role === "admin"
        ? "Execution-focused metrics to manage proposals and discussions quickly."
        : "Your focused workspace for daily proposal and communication activity.";

  const roleDashboardCards = useMemo(() => {
    if (role === "superadmin") {
      return [
        { key: "users", label: "Total Users", value: orgUserStats.totalUsers, icon: MdGroup, color: "#2563EB" },
        { key: "admins", label: "Active Admins", value: orgUserStats.activeAdmins, icon: MdPerson, color: "#0EA5E9" },
        { key: "open-discussions", label: "Open Discussions", value: discussionStats.open, icon: MdChat, color: "#F59E0B" },
        { key: "suspended", label: "Suspended Accounts", value: orgUserStats.suspendedUsers, icon: MdWarning, color: "#EF4444" },
        { key: "signed-today", label: "Signed Today", value: signedTodayCount, icon: MdCheckCircleOutline, color: "#10B981" },
        { key: "alerts", label: "Pending Requests", value: orgUserStats.pendingRequests, icon: MdNotificationsNone, color: "#7C3AED" }
      ];
    }

    if (role === "admin") {
      return [
        { key: "open-discussions", label: "Open Discussions", value: discussionStats.open, icon: MdChat, color: "#F59E0B" },
        { key: "unread-messages", label: "Unread Discussion Msg", value: unreadDiscussionCount, icon: MdNotifications, color: "#2563EB" },
        { key: "pending-sign", label: "Pending Signatures", value: unsignedProposalCount, icon: MdSchedule, color: "#EF4444" },
        { key: "signed-today", label: "Signed Today", value: signedTodayCount, icon: MdCheckCircleOutline, color: "#10B981" },
        { key: "active-viewers", label: "Active Viewers", value: uniqueActiveViewerCount, icon: MdRemoveRedEye, color: "#0EA5E9" },
        { key: "new-notifications", label: "New Notifications", value: unreadNotificationCount, icon: MdNotificationsNone, color: "#7C3AED" }
      ];
    }

    return [
      { key: "my-proposals", label: "Available Proposals", value: files.length, icon: MdDescription, color: "#2563EB" },
      { key: "views", label: "View Records", value: views.length, icon: MdVisibility, color: "#0EA5E9" },
      { key: "active-now", label: "Active Live Sessions", value: uniqueActiveViewerCount, icon: MdTimeline, color: "#F59E0B" },
      { key: "signed", label: "Signed Proposals", value: signedProposals.length, icon: MdCheckCircleOutline, color: "#10B981" },
      { key: "notifications", label: "Unread Notifications", value: unreadNotificationCount, icon: MdNotifications, color: "#7C3AED" },
      { key: "unique-viewers", label: "Unique Viewers", value: totalUniqueViewers, icon: MdGroup, color: "#1D4ED8" }
    ];
  }, [
    role,
    orgUserStats.totalUsers,
    orgUserStats.activeAdmins,
    orgUserStats.suspendedUsers,
    orgUserStats.pendingRequests,
    discussionStats.open,
    unreadDiscussionCount,
    unsignedProposalCount,
    signedTodayCount,
    uniqueActiveViewerCount,
    unreadNotificationCount,
    files.length,
    views.length,
    signedProposals.length,
    totalUniqueViewers
  ]);

  const roleQuickActions = useMemo(() => {
    if (role === "superadmin") {
      return [
        { id: "users", label: "Manage Users", icon: MdGroup, action: () => setActiveTab("users"), visible: canAccessUsersTab },
        { id: "activity", label: "User Activity", icon: MdTrendingUp, action: () => setActiveTab("user-activity"), visible: canAccessUserActivity },
        { id: "discussions", label: "Open Discussions", icon: MdChat, action: () => setShowAdminDiscussionDashboard(true), visible: canAccessDiscussions },
        { id: "analytics", label: "View Analytics", icon: MdAnalytics, action: () => setActiveTab("analytics"), visible: true }
      ].filter((item) => item.visible !== false);
    }

    if (role === "admin") {
      return [
        { id: "discussions", label: "Discussion Center", icon: MdChat, action: () => setShowAdminDiscussionDashboard(true), visible: canAccessDiscussions },
        { id: "upload", label: "Upload Proposal", icon: MdFileUpload, action: () => setActiveTab("upload"), visible: true },
        { id: "proposals", label: "Manage Proposals", icon: MdPictureAsPdf, action: () => setActiveTab("proposals"), visible: true },
        { id: "engagement", label: "Engagement", icon: MdTimeline, action: () => setActiveTab("engagement"), visible: true }
      ].filter((item) => item.visible !== false);
    }

    return [
      { id: "views", label: "Open Live Views", icon: MdRemoveRedEye, action: () => setActiveTab("views"), visible: true },
      { id: "upload", label: "Upload", icon: MdFileUpload, action: () => setActiveTab("upload"), visible: true },
      { id: "profile", label: "My Profile", icon: MdPerson, action: () => setActiveTab("profile"), visible: true }
    ];
  }, [role, canAccessUsersTab, canAccessUserActivity, canAccessDiscussions]);

  const formatActiveLastSeen = (date) => {
    if (!date) return "Just now";
    const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (diff < 5) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  const userDisplayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const profileMenuItemStyle = {
    width: "100%",
    padding: "12px 16px",
    border: "none",
    background: "transparent",
    color: "#0F172A",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.2s ease",
  };

  const handleProfileMenuItemHover = (event, isHovering) => {
    event.currentTarget.style.background = isHovering ? "#F8FAFC" : "transparent";
  };

  if(!authChecked || permissionsLoading) return <div style={{padding:40}}>Loading...</div>;

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

      {/* LOGOUT SUCCESS MODAL */}
      {showLogoutSuccess && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          animation: "fadeIn 0.3s ease",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background: "linear-gradient(135deg, #fff 0%, #f9fafb 100%)",
            padding: "50px 40px",
            borderRadius: "20px",
            maxWidth: "420px",
            width: "90%",
            textAlign: "center",
            boxShadow: "0 25px 80px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
            animation: "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}>
            {/* SUCCESS CHECKMARK */}
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 25px",
              boxShadow: "0 15px 40px rgba(16, 185, 129, 0.3)",
              position: "relative",
              animation: "scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}>
              <MdCheckCircle size={44} color="#fff" />
            </div>
            
            {/* TITLE */}
            <h2 style={{
              margin: "0 0 12px 0",
              color: "#1f2937",
              fontSize: "28px",
              fontWeight: "700",
              letterSpacing: "-0.5px",
            }}>
              Logout Successful
            </h2>
            
            {/* MESSAGE */}
            <p style={{
              margin: "0 0 30px 0",
              color: "#6b7280",
              fontSize: "16px",
              lineHeight: "1.6",
              fontWeight: "500",
            }}>
              You have been successfully logged out from your account. Redirecting to login page...
            </p>
            
            {/* LOADING INDICATOR */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginBottom: "10px",
            }}>
              <div style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#00D4FF",
                animation: "pulse 1.5s ease-in-out infinite",
              }}></div>
              <div style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#00D4FF",
                animation: "pulse 1.5s ease-in-out infinite 0.3s",
              }}></div>
              <div style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#00D4FF",
                animation: "pulse 1.5s ease-in-out infinite 0.6s",
              }}></div>
            </div>
            
            {/* PROGRESS BAR */}
            <div style={{
              width: "100%",
              height: "3px",
              background: "rgba(0, 212, 255, 0.1)",
              borderRadius: "3px",
              overflow: "hidden",
              marginTop: "20px",
            }}>
              <div style={{
                height: "100%",
                background: "linear-gradient(90deg, #00D4FF 0%, #0099CC 100%)",
                borderRadius: "3px",
                animation: "progress 3s ease forwards",
              }}></div>
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

      {/* SHARE PROPOSAL MODAL (Link Generation) */}
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

      {liveTrackerProposal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.82)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2100,
          padding: "20px",
        }}>
          <RealTimeViewTracker
            proposalId={liveTrackerProposal.proposalId}
            proposalName={liveTrackerProposal.proposalName}
            onClose={() => setLiveTrackerProposal(null)}
          />
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && canDeleteData && (
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

      {/* ========== IMPROVED SIDEBAR ========== */}
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
          padding: sidebarCollapsed ? "24px 10px" : "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 0 60px rgba(0, 212, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          position: "relative",
          overflow: "visible",
          transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: "width, padding",
        }}>

          {/* Logo Section */}
          <div style={{
            position: "relative",
            paddingBottom: 20,
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            marginBottom: 20,
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
                  <h2 style={{color:"#fff", margin:0, fontSize:22, fontWeight:700, letterSpacing:"1px"}}>HHI ProposalTracker</h2>
                  <p style={{color:"rgba(0,212,255,0.7)", margin:0, fontSize:11, letterSpacing:"2px"}}>DASHBOARD</p>
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Menu Container */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: sidebarCollapsed ? 12 : 10,
            overflowY: "auto",
            overflowX: "visible",
            paddingBottom: "16px",
            marginBottom: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0, 212, 255, 0.3) transparent",
          }}>
            
            {/* PRIMARY MENU ITEMS */}
            {!isRestrictedUser && (
              <button 
                style={{
                  padding: sidebarCollapsed ? "12px" : "10px 16px",
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: activeTab==="home" 
                    ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                    : "transparent",
                  color: activeTab==="home" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  gap: 12,
                  fontSize: sidebarCollapsed ? 0 : 14,
                  fontWeight: activeTab==="home" ? 600 : 500,
                  transition: "all 0.2s ease",
                  boxShadow: activeTab==="home" 
                    ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                    : "none",
                  border: activeTab==="home" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                  whiteSpace: "nowrap",
                }} 
                onClick={()=>setActiveTab("home")}
              >
                <MdHome size={sidebarCollapsed ? 22 : 18} />
                {!sidebarCollapsed && <span>Dashboard</span>}
              </button>
            )}

            {!isRestrictedUser && (
              <button 
                style={{
                  padding: sidebarCollapsed ? "12px" : "10px 16px",
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: activeTab==="proposals" 
                    ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                    : "transparent",
                  color: activeTab==="proposals" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  gap: 12,
                  fontSize: sidebarCollapsed ? 0 : 14,
                  fontWeight: activeTab==="proposals" ? 600 : 500,
                  transition: "all 0.2s ease",
                  boxShadow: activeTab==="proposals" 
                    ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                    : "none",
                  border: activeTab==="proposals" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                  whiteSpace: "nowrap",
                }} 
                onClick={()=>setActiveTab("proposals")}
              >
                <MdPictureAsPdf size={sidebarCollapsed ? 22 : 18} />
                {!sidebarCollapsed && <span>Proposals</span>}
              </button>
            )}

            {!isRestrictedUser && (
              <button 
                style={{
                  padding: sidebarCollapsed ? "12px" : "10px 16px",
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: activeTab==="follow-ups" 
                    ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                    : "transparent",
                  color: activeTab==="follow-ups" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  gap: 12,
                  fontSize: sidebarCollapsed ? 0 : 14,
                  fontWeight: activeTab==="follow-ups" ? 600 : 500,
                  transition: "all 0.2s ease",
                  boxShadow: activeTab==="follow-ups" 
                    ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                    : "none",
                  border: activeTab==="follow-ups" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                  whiteSpace: "nowrap",
                }} 
                onClick={()=>setActiveTab("follow-ups")}
              >
                <MdSchedule size={sidebarCollapsed ? 22 : 18} />
                {!sidebarCollapsed && <span>Follow-Ups</span>}
              </button>
            )}

            {!isRestrictedUser && (
              <button 
                style={{
                  padding: sidebarCollapsed ? "12px" : "10px 16px",
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: activeTab==="signed" 
                    ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                    : "transparent",
                  color: activeTab==="signed" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  gap: 12,
                  fontSize: sidebarCollapsed ? 0 : 14,
                  fontWeight: activeTab==="signed" ? 600 : 500,
                  transition: "all 0.2s ease",
                  boxShadow: activeTab==="signed" 
                    ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                    : "none",
                  border: activeTab==="signed" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                  whiteSpace: "nowrap",
                }} 
                onClick={()=>setActiveTab("signed")}
              >
                <MdCheckCircleOutline size={sidebarCollapsed ? 22 : 18} />
                {!sidebarCollapsed && <span>Signed</span>}
              </button>
            )}

            <button 
              style={{
                padding: sidebarCollapsed ? "12px" : "10px 16px",
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
                background: activeTab==="upload" 
                  ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                  : "transparent",
                color: activeTab==="upload" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: 12,
                fontSize: sidebarCollapsed ? 0 : 14,
                fontWeight: activeTab==="upload" ? 600 : 500,
                transition: "all 0.2s ease",
                boxShadow: activeTab==="upload" 
                  ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                  : "none",
                border: activeTab==="upload" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                whiteSpace: "nowrap",
              }} 
              onClick={()=>setActiveTab("upload")}
            >
              <MdFileUpload size={sidebarCollapsed ? 22 : 18} />
              {!sidebarCollapsed && <span>Upload</span>}
            </button>

            <button 
              style={{
                padding: sidebarCollapsed ? "12px" : "10px 16px",
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
                background: activeTab==="views" 
                  ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                  : "transparent",
                color: activeTab==="views" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: 12,
                fontSize: sidebarCollapsed ? 0 : 14,
                fontWeight: activeTab==="views" ? 600 : 500,
                transition: "all 0.2s ease",
                boxShadow: activeTab==="views" 
                  ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                  : "none",
                border: activeTab==="views" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                whiteSpace: "nowrap",
              }} 
              onClick={()=>setActiveTab("views")}
            >
              <MdRemoveRedEye size={sidebarCollapsed ? 22 : 18} />
              {!sidebarCollapsed && <span>Live Views</span>}
            </button>

            {canAccessDiscussions && (
              <button 
                style={{
                  padding: sidebarCollapsed ? "12px" : "10px 16px",
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: showAdminDiscussionDashboard
                    ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                    : "transparent",
                  color: showAdminDiscussionDashboard ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  gap: 12,
                  fontSize: sidebarCollapsed ? 0 : 14,
                  fontWeight: showAdminDiscussionDashboard ? 600 : 500,
                  transition: "all 0.2s ease",
                  boxShadow: showAdminDiscussionDashboard
                    ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                    : "none",
                  border: showAdminDiscussionDashboard ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                  whiteSpace: "nowrap",
                  position: "relative"
                }} 
                onClick={()=>setShowAdminDiscussionDashboard(true)}
              >
                <MdChat size={sidebarCollapsed ? 22 : 18} />
                {!sidebarCollapsed && <span>Discussions</span>}
                {unreadDiscussionCount > 0 && !sidebarCollapsed && (
                  <span style={{
                    marginLeft: "auto",
                    background: "#EF4444",
                    color: "#FFFFFF",
                    borderRadius: "12px",
                    padding: "2px 8px",
                    fontSize: "12px",
                    fontWeight: "700",
                    minWidth: "24px",
                    textAlign: "center"
                  }}>
                    {unreadDiscussionCount}
                  </span>
                )}
                {unreadDiscussionCount > 0 && sidebarCollapsed && (
                  <span style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    background: "#EF4444",
                    color: "#FFFFFF",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: "700",
                    border: "2px solid rgba(255, 255, 255, 0.3)"
                  }}>
                    {unreadDiscussionCount > 9 ? '9+' : unreadDiscussionCount}
                  </span>
                )}
              </button>
            )}

            {/* SEE MORE BUTTON */}
            {!isRestrictedUser && (
            <button 
              style={{
                padding: sidebarCollapsed ? "12px" : "10px 16px",
                border: "1px solid rgba(0, 212, 255, 0.4)",
                borderRadius: 12,
                cursor: "pointer",
                background: showMoreMenuItems
                  ? "linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 153, 204, 0.08) 100%)" 
                  : "transparent",
                color: "#00D4FF",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "space-between",
                gap: 12,
                fontSize: sidebarCollapsed ? 0 : 13,
                fontWeight: 600,
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
                marginTop: "4px",
              }} 
              onClick={()=>setShowMoreMenuItems(!showMoreMenuItems)}
            >
              <div style={{display: "flex", alignItems: "center", gap: 12}}>
                <MdFilterList size={sidebarCollapsed ? 20 : 16} />
                {!sidebarCollapsed && <span>See More</span>}
              </div>
              {!sidebarCollapsed && (
                <span style={{fontSize: 14, color: "rgba(0, 212, 255, 0.7)"}}>
                  {showMoreMenuItems ? "−" : "+"}
                </span>
              )}
            </button>
            )}

            {/* HIDDEN MENU ITEMS - SHOW WHEN EXPANDED */}
            {!isRestrictedUser && showMoreMenuItems && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: sidebarCollapsed ? 10 : 8,
                paddingTop: "8px",
                marginTop: "4px",
                borderTop: "1px solid rgba(0, 212, 255, 0.15)",
              }}>
                <button 
                  style={{
                    padding: sidebarCollapsed ? "10px" : "10px 16px",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: activeTab==="mytemplates" 
                      ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                      : "transparent",
                    color: activeTab==="mytemplates" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    gap: 12,
                    fontSize: sidebarCollapsed ? 0 : 14,
                    fontWeight: activeTab==="mytemplates" ? 600 : 500,
                    transition: "all 0.2s ease",
                    boxShadow: activeTab==="mytemplates" 
                      ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                      : "none",
                    border: activeTab==="mytemplates" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                    whiteSpace: "nowrap",
                  }} 
                  onClick={()=>setActiveTab("mytemplates")}
                >
                  <MdContentCopy size={sidebarCollapsed ? 20 : 16} />
                  {!sidebarCollapsed && <span>My Templates</span>}
                </button>

                <button 
                  style={{
                    padding: sidebarCollapsed ? "10px" : "10px 16px",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: activeTab==="engagement" 
                      ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                      : "transparent",
                    color: activeTab==="engagement" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    gap: 12,
                    fontSize: sidebarCollapsed ? 0 : 14,
                    fontWeight: activeTab==="engagement" ? 600 : 500,
                    transition: "all 0.2s ease",
                    boxShadow: activeTab==="engagement" 
                      ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                      : "none",
                    border: activeTab==="engagement" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                    whiteSpace: "nowrap",
                  }} 
                  onClick={()=>setActiveTab("engagement")}
                >
                  <MdTimeline size={sidebarCollapsed ? 20 : 16} />
                  {!sidebarCollapsed && <span>Engagement</span>}
                </button>

                <button 
                  style={{
                    padding: sidebarCollapsed ? "10px" : "10px 16px",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: activeTab==="analytics" 
                      ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                      : "transparent",
                    color: activeTab==="analytics" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    gap: 12,
                    fontSize: sidebarCollapsed ? 0 : 14,
                    fontWeight: activeTab==="analytics" ? 600 : 500,
                    transition: "all 0.2s ease",
                    boxShadow: activeTab==="analytics" 
                      ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                      : "none",
                    border: activeTab==="analytics" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                    whiteSpace: "nowrap",
                  }} 
                  onClick={()=>setActiveTab("analytics")}
                >
                  <MdAnalytics size={sidebarCollapsed ? 20 : 16} />
                  {!sidebarCollapsed && <span>Analytics</span>}
                </button>

                {canAccessUsersTab && (
                <button 
                  style={{
                    padding: sidebarCollapsed ? "10px" : "10px 16px",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: activeTab==="users" 
                      ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                      : "transparent",
                    color: activeTab==="users" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    gap: 12,
                    fontSize: sidebarCollapsed ? 0 : 14,
                    fontWeight: activeTab==="users" ? 600 : 500,
                    transition: "all 0.2s ease",
                    boxShadow: activeTab==="users" 
                      ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                      : "none",
                    border: activeTab==="users" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                    whiteSpace: "nowrap",
                  }} 
                  onClick={()=>setActiveTab("users")}
                >
                  <MdGroup size={sidebarCollapsed ? 20 : 16} />
                  {!sidebarCollapsed && <span>Users</span>}
                </button>
                )}

                {canAccessUserActivity && (
                <button 
                  style={{
                    padding: sidebarCollapsed ? "10px" : "10px 16px",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: activeTab==="user-activity" 
                      ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                      : "transparent",
                    color: activeTab==="user-activity" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    gap: 12,
                    fontSize: sidebarCollapsed ? 0 : 14,
                    fontWeight: activeTab==="user-activity" ? 600 : 500,
                    transition: "all 0.2s ease",
                    boxShadow: activeTab==="user-activity" 
                      ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                      : "none",
                    border: activeTab==="user-activity" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                    whiteSpace: "nowrap",
                  }} 
                  onClick={()=>setActiveTab("user-activity")}
                >
                  <MdTrendingUp size={sidebarCollapsed ? 20 : 16} />
                  {!sidebarCollapsed && <span>User Activity</span>}
                </button>
                )}

                {canAccessUserActivity && (
                <button 
                  style={{
                    padding: sidebarCollapsed ? "10px" : "10px 16px",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: activeTab==="per-user-stats" 
                      ? "linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 153, 204, 0.15) 100%)" 
                      : "transparent",
                    color: activeTab==="per-user-stats" ? "#00D4FF" : "rgba(255, 255, 255, 0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    gap: 12,
                    fontSize: sidebarCollapsed ? 0 : 14,
                    fontWeight: activeTab==="per-user-stats" ? 600 : 500,
                    transition: "all 0.2s ease",
                    boxShadow: activeTab==="per-user-stats" 
                      ? "0 2px 12px rgba(0, 212, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" 
                      : "none",
                    border: activeTab==="per-user-stats" ? "1px solid rgba(0, 212, 255, 0.3)" : "1px solid transparent",
                    whiteSpace: "nowrap",
                  }} 
                  onClick={()=>setActiveTab("per-user-stats")}
                >
                  <MdPerson size={sidebarCollapsed ? 20 : 16} />
                  {!sidebarCollapsed && <span>Per User Stats</span>}
                </button>
                )}
              </div>
            )}
          </div>

          {/* LOGOUT BUTTON - Fixed at bottom with proper spacing */}
          <div style={{
            marginTop: "auto",
            paddingTop: "16px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          }}>
            <button
              onClick={() => setShowLogoutModal(true)}
              style={{
                width: "100%",
                padding: sidebarCollapsed ? "12px" : "10px 16px",
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
                background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%)",
                color: "#EF4444",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                gap: sidebarCollapsed ? 0 : 12,
                fontSize: sidebarCollapsed ? 0 : 14,
                fontWeight: 600,
                transition: "all 0.2s ease",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                boxShadow: "0 2px 8px rgba(239, 68, 68, 0.1)",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.15) 100%)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(239, 68, 68, 0.1)";
              }}
            >
              <MdLogout size={sidebarCollapsed ? 20 : 16} />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>

        </div>

        {/* COLLAPSE BUTTON */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
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
          {sidebarCollapsed ? <MdChevronRight size={28} /> : <MdChevronLeft size={28} />}
        </button>

      </div>

      {/* MAIN CONTENT */}
      <div style={{
        flex: 1,
        padding: "0 20px 30px 20px",
        background: "#f4f6f8",
        overflowY: "auto",
        overflowX: "hidden",
        borderRadius: "24px 0 0 0",
        minHeight: "100vh",
        width: sidebarCollapsed ? "calc(100% - 100px)" : "calc(100% - 280px)",
      }}>

        {/* User Info Bar - STICKY TOPBAR */}
        <div style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "18px 20px",
          borderRadius: "0 0 16px 16px",
          marginBottom: 30,
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: "0 8px 32px rgba(102, 126, 234, 0.3), 0 0 0 1px rgba(102, 126, 234, 0.2)",
          border: "1px solid rgba(102, 126, 234, 0.3)",
          flexWrap: "wrap",
          backdropFilter: "blur(10px)",
          transition: "all 0.3s ease",
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            flex: 1,
            minWidth: "200px",
          }}>
            <div style={{
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.7)",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>Welcome back,</div>
            <div style={{
              fontSize: 15,
              color: "#ffffff",
              fontWeight: 600,
              wordBreak: "break-all",
            }}>{user?.email}</div>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: "rgba(255, 255, 255, 0.15)",
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 600,
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            whiteSpace: "nowrap",
            backdropFilter: "blur(5px)",
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

          {/* ROLE INDICATOR */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: role === "superadmin" 
              ? "rgba(239, 68, 68, 0.25)" 
              : role === "admin" 
              ? "rgba(168, 85, 247, 0.25)"
              : "rgba(59, 130, 246, 0.25)",
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 600,
            color: "#ffffff",
            border: role === "superadmin"
              ? "1px solid rgba(239, 68, 68, 0.5)"
              : role === "admin"
              ? "1px solid rgba(168, 85, 247, 0.5)"
              : "1px solid rgba(59, 130, 246, 0.5)",
            whiteSpace: "nowrap",
            backdropFilter: "blur(5px)",
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: role === "superadmin"
                ? "#EF4444"
                : role === "admin"
                ? "#A855F7"
                : "#3B82F6",
              boxShadow: role === "superadmin"
                ? "0 0 8px #EF4444"
                : role === "admin"
                ? "0 0 8px #A855F7"
                : "0 0 8px #3B82F6",
            }}></span>
            {role === "superadmin" ? "Super Admin" : role === "admin" ? "Admin" : "User"}
          </div>

          {/* NOTIFICATION BELL */}
          <div 
            ref={notificationRef}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileMenu(false);
              }}
              style={{
                position: "relative",
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.15)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
                backdropFilter: "blur(5px)",
              }}
              title="Notifications"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
              }}
            >
              {notifications.filter(n => !n.read).length > 0 || signedProposals.length > 0 ? (
                <MdNotifications size={20} />
              ) : (
                <MdNotificationsNone size={20} />
              )}
              {notifications.filter(n => !n.read).length > 0 && (
                <span style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  background: "#EF4444",
                  color: "#FFFFFF",
                  borderRadius: "50%",
                  width: "20px",
                  height: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: "700",
                  border: "2px solid rgba(255, 255, 255, 0.3)"
                }}>
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>

            {/* NOTIFICATION PANEL */}
            {showNotifications && (
              <div style={{
                position: "absolute",
                top: "100%",
                right: 0,
                width: "360px",
                maxHeight: "500px",
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                boxShadow: "0 20px 25px rgba(0,0,0,0.15)",
                zIndex: 2000,
                marginTop: "8px",
                display: "flex",
                flexDirection: "column",
                animation: "slideIn 0.2s ease",
              }}>
                {/* Notification Header */}
                <div style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #F1F5F9",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexShrink: 0
                }}>
                  <span style={{
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#0F172A"
                  }}>Notifications</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      onClick={markAllNotificationsAsRead}
                      disabled={!notifications.some((n) => !n.read)}
                      style={{
                        height: "32px",
                        padding: "0 10px",
                        background: "#EFF6FF",
                        border: "1px solid #BFDBFE",
                        borderRadius: "8px",
                        cursor: notifications.some((n) => !n.read) ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#2563EB",
                        fontSize: "12px",
                        fontWeight: 600,
                        gap: "4px",
                        opacity: notifications.some((n) => !n.read) ? 1 : 0.45,
                        transition: "all 0.2s ease"
                      }}
                      title="Mark all read"
                    >
                      <MdDoneAll size={15} />
                      Mark all read
                    </button>
                    <button
                      onClick={clearAllNotifications}
                      disabled={notifications.length === 0}
                      style={{
                        height: "32px",
                        padding: "0 10px",
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        cursor: notifications.length > 0 ? "pointer" : "not-allowed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#64748B",
                        fontSize: "12px",
                        fontWeight: 600,
                        gap: "4px",
                        opacity: notifications.length > 0 ? 1 : 0.45,
                        transition: "all 0.2s ease"
                      }}
                      title="Clear all"
                    >
                      <MdClear size={15} />
                      Clear all
                    </button>
                  </div>
                </div>

                {/* Notification List */}
                {notifications.length === 0 ? (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "40px 20px",
                    color: "#94A3B8",
                    textAlign: "center",
                    fontSize: "14px"
                  }}>
                    <MdNotificationsNone size={32} color="#94A3B8" />
                    <div style={{ marginTop: "12px" }}>All caught up!</div>
                  </div>
                ) : (
                  <div style={{
                    flex: 1,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column"
                  }}>
                    {notifications.map(notif => (
                      <div
                        key={notif.id}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #F1F5F9",
                          display: "flex",
                          gap: "12px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          background: notif.read ? "#FFFFFF" : "#F8FAFC",
                          opacity: notif.read ? 0.7 : 1,
                        }}
                        onClick={async () => await markNotificationAsRead(notif.id)}
                      >
                        <div style={{
                          width: "32px",
                          height: "32px",
                          background: "#F1F5F9",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          {notif.type === 'signed' ? (
                            <MdCheckCircle size={16} color="#10B981" />
                          ) : notif.type === 'view' ? (
                            <MdVisibility size={16} color="#00D4FF" />
                          ) : (
                            <MdInfo size={16} color="#3B82F6" />
                          )}
                        </div>
                        <div style={{
                          flex: 1,
                          minWidth: 0
                        }}>
                          <div style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "#0F172A",
                            marginBottom: "2px"
                          }}>
                            {notif.title}
                          </div>
                          <div style={{
                            fontSize: "12px",
                            color: "#475569",
                            marginBottom: "4px"
                          }}>
                            {notif.message}
                          </div>
                          {notif.email && (
                            <div style={{
                              fontSize: "11px",
                              color: "#94A3B8",
                              marginBottom: "4px"
                            }}>
                              {notif.email}
                            </div>
                          )}
                          <div style={{
                            fontSize: "10px",
                            color: "#94A3B8"
                          }}>
                            {getTimeAgo(notif.timestamp)}
                          </div>
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await clearNotification(notif.id);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#94A3B8",
                            fontSize: "20px",
                            cursor: "pointer",
                            padding: "0 4px",
                            transition: "color 0.2s ease"
                          }}
                          title="Dismiss"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PROFILE MENU */}
          <div
            ref={profileMenuRef}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
              }}
              style={{
                height: "42px",
                minWidth: "42px",
                padding: "0 10px",
                borderRadius: "999px",
                background: "rgba(255, 255, 255, 0.2)",
                border: "1px solid rgba(255, 255, 255, 0.35)",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.25s ease",
                backdropFilter: "blur(6px)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              }}
              title="Profile menu"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.28)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
              }}
            >
              <span style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "14px",
                fontWeight: "700",
                boxShadow: "0 4px 10px rgba(236, 72, 153, 0.35)",
              }}>
                {userDisplayName?.charAt(0).toUpperCase() || "U"}
              </span>
              <MdChevronRight
                size={16}
                style={{
                  transform: showProfileMenu ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                  color: "rgba(255,255,255,0.9)",
                }}
              />
            </button>

            {showProfileMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  right: 0,
                  width: "320px",
                  background: "#ffffff",
                  border: "1px solid #E2E8F0",
                  borderRadius: "14px",
                  boxShadow: "0 24px 40px rgba(15, 23, 42, 0.24)",
                  overflow: "hidden",
                  zIndex: 2200,
                  animation: "scaleIn 0.18s ease",
                }}
              >
                <div style={{ padding: "16px", borderBottom: "1px solid #F1F5F9", display: "flex", gap: "12px", alignItems: "center" }}>
                  <div style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    fontSize: "16px",
                  }}>
                    {userDisplayName?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "230px" }}>
                      {userDisplayName}
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "230px" }}>
                      {user?.email}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveTab("profile");
                    setShowProfileMenu(false);
                  }}
                  style={profileMenuItemStyle}
                  onMouseEnter={(event) => handleProfileMenuItemHover(event, true)}
                  onMouseLeave={(event) => handleProfileMenuItemHover(event, false)}
                >
                  <MdPerson size={18} />
                  <span>My Profile</span>
                </button>

                <button
                  onClick={() => {
                    setShowLogoutModal(true);
                    setShowProfileMenu(false);
                  }}
                  style={profileMenuItemStyle}
                  onMouseEnter={(event) => handleProfileMenuItemHover(event, true)}
                  onMouseLeave={(event) => handleProfileMenuItemHover(event, false)}
                >
                  <MdSwitchAccount size={18} />
                  <span>Switch account</span>
                </button>

                <button
                  onClick={() => {
                    setShowLogoutModal(true);
                    setShowProfileMenu(false);
                  }}
                  style={{ ...profileMenuItemStyle, color: "#dc2626" }}
                  onMouseEnter={(event) => handleProfileMenuItemHover(event, true)}
                  onMouseLeave={(event) => handleProfileMenuItemHover(event, false)}
                >
                  <MdLogout size={18} />
                  <span>Sign out</span>
                </button>

                <div style={{ height: "1px", background: "#F1F5F9", margin: "4px 0" }} />

                <button
                  onClick={() => {
                    setActiveTab("profile");
                    setShowProfileMenu(false);
                  }}
                  style={profileMenuItemStyle}
                  onMouseEnter={(event) => handleProfileMenuItemHover(event, true)}
                  onMouseLeave={(event) => handleProfileMenuItemHover(event, false)}
                >
                  <MdSettings size={18} />
                  <span>Settings</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (canAccessDiscussions) {
                      setShowAdminDiscussionDashboard(true);
                    } else {
                      setActiveTab("profile");
                    }
                  }}
                  style={profileMenuItemStyle}
                  onMouseEnter={(event) => handleProfileMenuItemHover(event, true)}
                  onMouseLeave={(event) => handleProfileMenuItemHover(event, false)}
                >
                  <MdHelpOutline size={18} />
                  <span>Help</span>
                </button>
              </div>
            )}
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

          @keyframes scaleIn {
            from {
              transform: scale(0);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          @keyframes progress {
            from {
              width: 0%;
            }
            to {
              width: 100%;
            }
          }

          /* Custom scrollbar for sidebar */
          div::-webkit-scrollbar {
            width: 4px;
          }
          
          div::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
          }
          
          div::-webkit-scrollbar-thumb {
            background: rgba(0, 212, 255, 0.3);
            border-radius: 4px;
          }
          
          div::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 212, 255, 0.5);
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

        {/* DASHBOARD CONTENT */}
        {activeTab === "home" && (
          <>
            <div style={{
              background: "linear-gradient(135deg, #FFFFFF 0%, #F8FAFF 100%)",
              border: "1px solid #E2E8F0",
              borderRadius: 16,
              padding: "20px 22px",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
              marginBottom: 18
            }}>
              <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <MdDashboard size={28} color="#1976D2" />
                {roleDashboardTitle}
              </h2>
              <p style={{ margin: "8px 0 0 0", color: "#475569", fontSize: 14 }}>
                {roleDashboardSubtitle}
              </p>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 14,
              marginBottom: 18
            }}>
              {roleDashboardCards.map((card) => {
                const CardIcon = card.icon;
                return (
                  <div
                    key={card.key}
                    style={{
                      background: "#fff",
                      borderRadius: 14,
                      border: "1px solid #E2E8F0",
                      padding: "16px 14px",
                      boxShadow: "0 3px 10px rgba(15, 23, 42, 0.06)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>{card.label}</div>
                      <CardIcon size={20} color={card.color} />
                    </div>
                    <div style={{
                      marginTop: 8,
                      fontSize: 28,
                      fontWeight: 700,
                      color: "#0F172A",
                      lineHeight: 1.1
                    }}>
                      {card.value}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
              marginBottom: 20
            }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#0F172A", fontSize: 16 }}>Quick Actions</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {roleQuickActions.map((actionItem) => {
                  const ActionIcon = actionItem.icon;
                  return (
                    <button
                      key={actionItem.id}
                      onClick={actionItem.action}
                      style={{
                        border: "1px solid #BFDBFE",
                        background: "linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 100%)",
                        borderRadius: 10,
                        padding: "9px 13px",
                        color: "#1D4ED8",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7
                      }}
                    >
                      <ActionIcon size={16} />
                      {actionItem.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {role !== "user" ? (
              <>
                <h3 style={{ marginTop: 30, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <MdTimeline color="#2196F3" />
                  Analytics Overview
                </h3>

                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 24,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                }}>
                  <h4 style={{ margin: "0 0 16px 0", color: "#1E293B", fontSize: 16 }}>
                    Views per Proposal {files.length > 10 && "(Top 10)"}
                  </h4>
                  <div style={{ width: "100%", height: 360, minWidth: 0, minHeight: 360 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={360}>
                      <BarChart
                        data={proposalChartData.length ? proposalChartData : [{ name: "No Data", views: 0 }]}
                        margin={{ top: 20, right: 20, left: 10, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="views" fill="#2196F3" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 20,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                }}>
                  <h4 style={{ margin: "0 0 16px 0", color: "#1E293B", fontSize: 16 }}>
                    Daily View Traffic
                  </h4>
                  <div style={{ width: "100%", height: 360, minWidth: 0, minHeight: 360 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={360}>
                      <LineChart
                        data={dailyChartData.length ? dailyChartData : [{ date: "No Data", views: 0 }]}
                        margin={{ top: 20, right: 20, left: 10, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" angle={-35} textAnchor="end" height={70} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="views" stroke="#4CAF50" strokeWidth={3} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <div style={{
                background: "#fff",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: 20,
                marginTop: 4,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
              }}>
                <h3 style={{ margin: "0 0 10px 0", color: "#0F172A", fontSize: 16 }}>Your Focus Today</h3>
                <p style={{ margin: 0, color: "#64748B", fontSize: 14, lineHeight: 1.6 }}>
                  Use your quick actions to upload proposals, review live activity, and keep your profile updated.
                  This workspace is intentionally simplified for faster daily execution.
                </p>
              </div>
            )}
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

        {/* PROPOSALS TAB */}
        {!isRestrictedUser && activeTab === "proposals" && (
          <ProposalsTabWithDelete 
            user={user}
            onViewClick={(file) => viewProposal(file)}
            onDownloadClick={(file) => downloadFile(file)}
            onShareClick={(file) => {
              setEmailProposal(file);
              setShowEmailModal(true);
            }}
            onSignClick={(file) => handleSignProposal(file)}
          />
        )}

        {/* SIGNED PROPOSALS TAB */}
        {!isRestrictedUser && activeTab === "signed" && (
          <SignedProposalsTab user={user} />
        )}

        {!isRestrictedUser && activeTab === "follow-ups" && (
          <FollowUpCenter currentUser={user} />
        )}

        {/* MY TEMPLATES TAB */}
        {!isRestrictedUser && activeTab === "mytemplates" && (
          <MyTemplatesTab currentUser={user} />
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
                {canDeleteData && selectedViews.length > 0 && (
                  <button onClick={() => { setDeleteType("views"); setShowDeleteModal(true); }}
                    style={{ padding: "8px 12px", background: "#d32f2f", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <MdDelete size={18} /> Delete ({selectedViews.length})
                  </button>
                )}
                {canDeleteData && getFilteredViews().length > 0 && (
                  <button onClick={() => { setDeleteType("filteredViews"); setShowDeleteModal(true); }}
                    style={{ padding: "8px 12px", background: "#ff9800", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <MdDelete size={18} /> Delete {getFilteredViews().length}
                  </button>
                )}
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 20
            }}>
              <div style={{ background: "#fff", padding: 18, borderRadius: 14, border: "1px solid #dbeafe", boxShadow: "0 4px 16px rgba(59, 130, 246, 0.08)" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Active Right Now</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: "#1976D2" }}>{activeViewers.length}</div>
              </div>
              <div style={{ background: "#fff", padding: 18, borderRadius: 14, border: "1px solid #dcfce7", boxShadow: "0 4px 16px rgba(16, 185, 129, 0.08)" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Live Proposals</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: "#10B981" }}>{activeViewerGroups.length}</div>
              </div>
              <div style={{ background: "#fff", padding: 18, borderRadius: 14, border: "1px solid #fef3c7", boxShadow: "0 4px 16px rgba(245, 158, 11, 0.08)" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Unique Live Viewers</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: "#D97706" }}>{uniqueActiveViewerCount}</div>
              </div>
            </div>

            <div style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              marginBottom: 20,
              border: "1px solid #e2e8f0",
              boxShadow: "0 6px 20px rgba(15, 23, 42, 0.05)"
            }}>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Who's viewing right now</h3>
                <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#64748b" }}>
                  Clients with activity in the last 60 seconds appear here.
                </p>
              </div>

              {activeViewerGroups.length === 0 ? (
                <div style={{ padding: "28px 18px", borderRadius: 12, background: "#f8fafc", textAlign: "center", color: "#64748b" }}>
                  No clients are actively viewing proposals right now.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {activeViewerGroups.map((group) => (
                    <div key={group.proposalId} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{group.proposalName}</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                            {group.viewers.length} active viewer{group.viewers.length === 1 ? "" : "s"}
                          </div>
                        </div>
                        <button
                          onClick={() => setLiveTrackerProposal({
                            proposalId: group.proposalId,
                            proposalName: group.proposalName
                          })}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "none",
                            background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8
                          }}
                        >
                          <MdVisibility size={16} />
                          Open Tracker
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {group.viewers.map((viewer) => (
                          <div key={viewer.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                                {viewer.viewerName || viewer.viewerEmail || "Anonymous"}
                              </div>
                              <div style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <span>{viewer.viewerEmail || "No email"}</span>
                                <span>Page {viewer.currentPage || 1}</span>
                                <span>{viewer.deviceInfo?.device || "Desktop"}</span>
                                <span>{viewer.location?.city || "Unknown"}, {viewer.location?.country || "Unknown"}</span>
                              </div>
                            </div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 600 }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 4px rgba(34, 197, 94, 0.15)" }}></span>
                              {formatActiveLastSeen(viewer.lastActive)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                      {canDeleteData && (
                        <input
                          type="checkbox"
                          onChange={(e) => selectAllViews(e.target.checked)}
                          checked={selectedViews.length === views.length && views.length > 0}
                        />
                      )}
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
                        {canDeleteData && (
                          <input
                            type="checkbox"
                            checked={selectedViews.includes(v.id)}
                            onChange={() => toggleViewSelection(v.id)}
                          />
                        )}
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
                        {canDeleteData && (
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
                        )}
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

        {/* ENGAGEMENT TAB */}
        {!isRestrictedUser && activeTab === "engagement" && (
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

                {canDeleteData && selectedSessions.length > 0 && (
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

                {canDeleteData && getFilteredSessions().length > 0 && (
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
                      {canDeleteData && (
                        <input
                          type="checkbox"
                          onChange={(e) => selectAllSessions(e.target.checked)}
                          checked={
                            filteredEngagement.length > 0 &&
                            filteredEngagement.every((s) => selectedSessions.includes(s.id))
                          }
                        />
                      )}
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
                    }}>Viewer Email</th>
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
                    let durationSeconds = 0;
                    
                    if (s.duration) {
                      if (s.duration > 1000) {
                        durationSeconds = Math.round(s.duration / 1000);
                      } else {
                        durationSeconds = Math.round(s.duration);
                      }
                    } else if (s.timeSpent) {
                      durationSeconds = Math.round(s.timeSpent);
                    }

                    durationSeconds = Math.max(0, durationSeconds);

                    const formatDate = (timestamp) => {
                      if (!timestamp) return 'N/A';
                      try {
                        if (timestamp.seconds) {
                          return new Date(timestamp.seconds * 1000).toLocaleString();
                        } else if (timestamp instanceof Date) {
                          return timestamp.toLocaleString();
                        } else {
                          return new Date(timestamp).toLocaleString();
                        }
                      } catch (e) {
                        return 'Invalid date';
                      }
                    };

                    const startTime = s.startedAt || s.startTime || s.createdAt;
                    const lastActive = s.lastActiveAt || s.endTime || s.updatedAt || s.lastActivity;
                    const pageCount = s.pagesViewed?.length || s.pageCount || s.pages || s.totalPages || 0;
                    const viewerEmail = s.viewerEmail || s.email || s.userEmail || 'Anonymous';
                    const proposalName = s.fileName || s.proposalName || s.proposal || 'Unknown';

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
                          {canDeleteData && (
                            <input
                              type="checkbox"
                              checked={selectedSessions.includes(s.id)}
                              onChange={() => toggleSessionSelection(s.id)}
                            />
                          )}
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
                          {viewerEmail}
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
                          {canDeleteData && (
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
                          )}
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
                    {new Set(sessions.map(s => s.viewerEmail || s.email || s.userEmail)).size}
                  </div>
                </div>
              </div>
            )}

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

        {/* NEW ANALYTICS TAB - Page View Tracking */}
        {!isRestrictedUser && activeTab === "analytics" && (
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "24px",
            marginTop: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            minHeight: "calc(100vh - 200px)",
            overflow: "visible"
          }}>
            <ProposalAnalyticsTab />
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "0px",
            marginTop: "0px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            minHeight: "calc(100vh - 200px)",
            overflow: "visible"
          }}>
            <UserProfile />
          </div>
        )}

        {/* USERS TAB - SuperAdmin Only */}
        {canAccessUsersTab && activeTab === "users" && (
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "0px",
            marginTop: "0px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            minHeight: "calc(100vh - 200px)",
            overflow: "visible"
          }}>
            <UserManagement />
          </div>
        )}

        {/* USERS ACTIVITY TAB - Admin Only */}
        {canAccessUserActivity && activeTab === "user-activity" && (
          <div style={{
            background: "transparent",
            borderRadius: "0px",
            padding: "0px",
            marginTop: "0px",
            boxShadow: "none",
            minHeight: "calc(100vh - 200px)",
            overflow: "visible"
          }}>
            <UsersActivityTab />
          </div>
        )}

        {canAccessUserActivity && activeTab === "per-user-stats" && (
          <div style={{
            background: "transparent",
            borderRadius: "0px",
            padding: "0px",
            marginTop: "0px",
            boxShadow: "none",
            minHeight: "calc(100vh - 200px)",
            overflow: "visible"
          }}>
            <PerUserStatsTab />
          </div>
        )}

        {/* Share Modal */}
        <ShareModal
          isOpen={showEmailModal}
          onClose={() => {
            setShowEmailModal(false);
            setEmailProposal(null);
          }}
          proposal={emailProposal}
          user={user}
        />
        
      </div>

      {/* Admin Discussion Dashboard */}
      {showAdminDiscussionDashboard && user && canAccessDiscussions && (
        <AdminDiscussionDashboard
          userId={user.uid}
          userEmail={user.email}
          userRole={role || "user"}
          onClose={() => setShowAdminDiscussionDashboard(false)}
          onDiscussionSeen={(discussionId, lastSeenMs) => {
            setLastSeenByDiscussion(prev => ({
              ...prev,
              [discussionId]: lastSeenMs
            }));
          }}
        />
      )}
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
