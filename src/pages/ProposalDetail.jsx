// src/pages/ProposalDetail.jsx
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { storage, auth, db } from "../firebase";
import { ref, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,  
  updateDoc,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { MdEdit, MdFileUpload, MdLogout, MdDescription, MdArrowBack, MdCheckCircle, MdDashboard, MdVisibility } from "react-icons/md";
import emailjs from "@emailjs/browser";
import { ActivityLogger } from "../utils/activityLogger";
import ProposalReviewPanel from "../Components/ProposalReviewPanel";
import HighlightButton from "../Components/HighlightButton";
import DiscussionPanel from "../Components/DiscussionPanel";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// EmailJS Configuration
const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_q6k7l9r',
  TEMPLATE_ID: 'template_z3glhb1',
  PUBLIC_KEY: 'UF-7_4AU7Jw9Sdo5P',
  ADMIN_EMAIL: 'ronvincentb@hyacinthindustriesllc.com'
};

export default function ProposalDetail() {
  const { path } = useParams();
  const navigate = useNavigate();

  const [fileUrl, setFileUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [isSigned, setIsSigned] = useState(false);
  const [viewerName, setViewerName] = useState("");
  const [deviceInfo, setDeviceInfo] = useState({});
  const [location, setLocation] = useState(null);
  const [scrollDepth, setScrollDepth] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState("");
  const [pageTrackingStatus, setPageTrackingStatus] = useState("");
  const [highlightModeActive, setHighlightModeActive] = useState(false);
  const [discussionPanelOpen, setDiscussionPanelOpen] = useState(false);
  const sessionId = useRef(null);
  const startTime = useRef(Date.now());
  const pagesViewed = useRef(new Set([1]));
  const heartbeatInterval = useRef(null);
  const isTabActive = useRef(true);
  const pageStartTime = useRef(Date.now());
  const trackedPagesRef = useRef(new Set());
  const lastPageTimeRef = useRef({});
  const activeViewerDocId = useRef(null);
  const currentPageRef = useRef(1);
  const currentScrollDepthRef = useRef(0);
  const proposalMetaRef = useRef({
    proposalId: "",
    fileName: "",
    filePath: ""
  });
  
  // Store viewer data for notification
  const viewerDataRef = useRef({
    name: "",
    email: "",
    device: "",
    location: ""
  });

  // Helper function to get consistent proposal ID
  const getConsistentProposalId = (decodedPath) => {
    if (decodedPath.startsWith('proposals/')) {
      return decodedPath;
    }
    return `proposals/${decodedPath}`;
  };

  useEffect(() => {
    currentPageRef.current = pageNumber;
  }, [pageNumber]);

  useEffect(() => {
    currentScrollDepthRef.current = scrollDepth;
  }, [scrollDepth]);

  const syncActiveViewer = async (overrides = {}, includeStartedAt = false) => {
    if (!activeViewerDocId.current || !proposalMetaRef.current.proposalId || !auth.currentUser) {
      return;
    }

    try {
      const { proposalId, fileName, filePath } = proposalMetaRef.current;
      const resolvedViewerName =
        viewerName ||
        userDisplayName ||
        auth.currentUser.displayName ||
        auth.currentUser.email?.split('@')[0] ||
        "Viewer";
      const resolvedViewerEmail = userEmail || auth.currentUser.email || "anonymous";

      const payload = {
        proposalId,
        proposalName: fileName,
        fileName,
        filePath,
        sessionId: sessionId.current,
        viewerId: auth.currentUser.uid,
        viewerEmail: resolvedViewerEmail,
        viewerName: resolvedViewerName,
        currentPage: currentPageRef.current,
        pagesViewed: Array.from(pagesViewed.current),
        pageCount: pagesViewed.current.size,
        scrollDepth: Math.round(currentScrollDepthRef.current),
        deviceInfo: deviceInfo || {},
        location: location || null,
        status: document.hidden ? "background" : "active",
        lastActive: serverTimestamp(),
        lastActiveClient: Date.now(),
        ...overrides
      };

      if (includeStartedAt) {
        payload.startedAt = serverTimestamp();
      }

      await setDoc(doc(db, "activeViewers", activeViewerDocId.current), payload, { merge: true });
    } catch (error) {
      console.error("Error syncing active viewer:", error);
    }
  };

  const clearActiveViewer = async () => {
    if (!activeViewerDocId.current) return;

    try {
      await deleteDoc(doc(db, "activeViewers", activeViewerDocId.current));
    } catch (error) {
      console.error("Error clearing active viewer:", error);
    }
  };

  // Function to update session with current pages viewed
  const updateSessionPages = async () => {
    if (!sessionId.current) return;
    
    try {
      const pagesArray = Array.from(pagesViewed.current);
      await updateDoc(doc(db, "proposalSessions", sessionId.current), {
        pagesViewed: pagesArray,
        pageCount: pagesArray.length,
        lastUpdated: serverTimestamp(),
        viewerEmail: userEmail,
        viewerName: viewerName || userEmail?.split('@')[0]
      });
      await syncActiveViewer({
        pagesViewed: pagesArray,
        pageCount: pagesArray.length
      });
      console.log(`✅ Session updated: ${pagesArray.length} pages - [${pagesArray.join(', ')}]`);
    } catch (error) {
      console.error("Error updating session pages:", error);
    }
  };

  // Initialize EmailJS and get device info
  useEffect(() => {
    emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    
    const getDeviceInfo = () => {
      const userAgent = navigator.userAgent;
      let device = "Unknown";
      let os = "Unknown";
      let browser = "Unknown";
      
      if (userAgent.indexOf("Win") !== -1) os = "Windows";
      else if (userAgent.indexOf("Mac") !== -1) os = "macOS";
      else if (userAgent.indexOf("Linux") !== -1) os = "Linux";
      else if (userAgent.indexOf("Android") !== -1) os = "Android";
      else if (userAgent.indexOf("iOS") !== -1 || userAgent.indexOf("iPhone") !== -1 || userAgent.indexOf("iPad") !== -1) os = "iOS";
      
      if (userAgent.indexOf("Chrome") !== -1 && userAgent.indexOf("Edg") === -1) browser = "Chrome";
      else if (userAgent.indexOf("Firefox") !== -1) browser = "Firefox";
      else if (userAgent.indexOf("Safari") !== -1 && userAgent.indexOf("Chrome") === -1) browser = "Safari";
      else if (userAgent.indexOf("Edg") !== -1) browser = "Edge";
      else if (userAgent.indexOf("Opera") !== -1) browser = "Opera";
      
      if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) device = "Tablet";
      else if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) device = "Mobile";
      else device = "Desktop";
      
      return {
        userAgent: userAgent,
        platform: os,
        browser: browser,
        device: device,
        language: navigator.language,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    };
    
    const device = getDeviceInfo();
    setDeviceInfo(device);
    viewerDataRef.current.device = `${device.device} - ${device.platform} (${device.browser})`;
    
    const getLocation = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const locationData = {
          city: data.city || 'Unknown',
          country: data.country_name || 'Unknown',
          region: data.region || 'Unknown',
          ip: data.ip || 'Unknown',
        };
        setLocation(locationData);
        viewerDataRef.current.location = `${locationData.city}, ${locationData.country}`;
      } catch {
        console.log('Geolocation not available');
        viewerDataRef.current.location = 'Unknown';
      }
    };
    getLocation();
  }, []);

  // Track page time - prevents duplicates
  const trackPageTime = async (oldPage, timeSpent) => {
    if (timeSpent < 1) return;
    
    const lastTime = lastPageTimeRef.current[oldPage];
    const now = Date.now();
    if (lastTime && (now - lastTime) < 10000) {
      console.log(`⏭️ Skipping duplicate for page ${oldPage} - too soon`);
      return;
    }
    lastPageTimeRef.current[oldPage] = now;
    
    try {
      const decodedPath = decodePath(path);
      const consistentProposalId = getConsistentProposalId(decodedPath);
      const fileName = consistentProposalId.split('/').pop();
      const viewerId = auth.currentUser?.uid || 'unknown';
      
      // Get user's name and email
      const userEmailValue = auth.currentUser?.email || 'anonymous';
      const userNameValue = auth.currentUser?.displayName || userEmailValue.split('@')[0];
      
      const existingQuery = query(
        collection(db, "proposalPageTracking"),
        where("proposalId", "==", consistentProposalId),
        where("clientId", "==", viewerId),
        where("sessionId", "==", sessionId.current),
        where("pageNumber", "==", oldPage)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      const roundedTime = Math.round(timeSpent * 10) / 10;
      
      if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];
        const existingData = existingDoc.data();
        const newTime = (existingData.timeSpentSeconds || 0) + roundedTime;
        
        await updateDoc(doc(db, "proposalPageTracking", existingDoc.id), {
          timeSpentSeconds: newTime,
          lastUpdated: serverTimestamp(),
          viewCount: (existingData.viewCount || 0) + 1,
          clientName: userNameValue,
          clientEmail: userEmailValue
        });
        console.log(`📝 Updated page ${oldPage}: total ${newTime.toFixed(1)}s for ${userNameValue}`);
      } else {
        await addDoc(collection(db, "proposalPageTracking"), {
          proposalId: consistentProposalId,
          proposalFileName: fileName,
          clientId: viewerId,
          clientEmail: userEmailValue,
          clientName: userNameValue,
          pageNumber: oldPage,
          timeSpentSeconds: roundedTime,
          timestamp: serverTimestamp(),
          sessionId: sessionId.current,
          action: "page_time",
          viewCount: 1
        });
        console.log(`✅ Page ${oldPage}: ${roundedTime} seconds tracked for ${userNameValue} (${userEmailValue})`);
      }
      
      setPageTrackingStatus(`Page ${oldPage}: +${roundedTime}s`);
      setTimeout(() => setPageTrackingStatus(""), 2000);
      
    } catch (error) {
      console.error("Error saving page time:", error);
    }
  };

  const trackPageView = async (pageNum) => {
    if (trackedPagesRef.current.has(pageNum)) {
      console.log(`⏭️ Page ${pageNum} already viewed this session`);
      return;
    }
    
    trackedPagesRef.current.add(pageNum);
    
    try {
      const decodedPath = decodePath(path);
      const consistentProposalId = getConsistentProposalId(decodedPath);
      const fileName = consistentProposalId.split('/').pop();
      const viewerId = auth.currentUser?.uid || 'unknown';
      
      // Get user's name and email
      const userEmailValue = auth.currentUser?.email || 'anonymous';
      const userNameValue = auth.currentUser?.displayName || userEmailValue.split('@')[0];
      
      const existingQuery = query(
        collection(db, "proposalPageTracking"),
        where("proposalId", "==", consistentProposalId),
        where("clientId", "==", viewerId),
        where("sessionId", "==", sessionId.current),
        where("pageNumber", "==", pageNum),
        where("action", "==", "page_view")
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (existingSnapshot.empty) {
        await addDoc(collection(db, "proposalPageTracking"), {
          proposalId: consistentProposalId,
          proposalFileName: fileName,
          clientId: viewerId,
          clientEmail: userEmailValue,
          clientName: userNameValue,
          pageNumber: pageNum,
          timeSpentSeconds: 0,
          timestamp: serverTimestamp(),
          sessionId: sessionId.current,
          action: "page_view",
          viewCount: 1
        });
        console.log(`✅ Page ${pageNum} view tracked for ${userNameValue} (${userEmailValue})`);
      }
      
      // Also update the session
      await updateDoc(doc(db, "proposalSessions", sessionId.current), {
        pagesViewed: Array.from(pagesViewed.current),
        pageCount: pagesViewed.current.size,
        lastUpdated: serverTimestamp(),
        viewerEmail: userEmailValue,
        viewerName: userNameValue
      });
      await syncActiveViewer({
        currentPage: pageNum,
        viewerEmail: userEmailValue,
        viewerName: userNameValue
      });
      
    } catch (error) {
      console.error("Error tracking page view:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let loadAttempted = false;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        const returnUrl = encodeURIComponent(`/p/${path}`);
        navigate(`/client-login?returnTo=${returnUrl}`);
        return;
      }

      if (!isMounted) return;

      const email = currentUser.email || 'Unknown';
      let name = currentUser.displayName || email.split('@')[0] || "User";
      
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists() && userDoc.data().name) {
          name = userDoc.data().name;
        }
      } catch (error) {
        console.error("Error getting user name:", error);
      }
      
      viewerDataRef.current.name = name;
      viewerDataRef.current.email = email;
      
      setUserDisplayName(name);
      setViewerName(name);
      setUserEmail(email);

      try {
        let role = "unknown";
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          role = userDoc.data().role || "client";
        } else {
          role = "admin";
        }
        
        if (isMounted) {
          setUserRole(role);
          setCheckingAuth(false);
        }
        
        if (!loadAttempted && isMounted) {
          loadAttempted = true;
          await loadProposal(currentUser);
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        if (isMounted) {
          setCheckingAuth(false);
        }
        if (!loadAttempted && isMounted) {
          loadAttempted = true;
          await loadProposal(currentUser);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [path, navigate]);

  const decodePath = (encodedPath) => {
    try {
      let decoded = atob(encodedPath);
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      if (base64Regex.test(decoded) && decoded.includes('proposals/')) {
        return decoded;
      }
      if (base64Regex.test(decoded)) {
        try {
          const secondDecode = atob(decoded);
          if (secondDecode.includes('proposals/')) {
            return secondDecode;
          }
        } catch {
          // Ignore double-decoding failures and fall back to the first decode.
        }
      }
      return decoded;
    } catch {
      return encodedPath;
    }
  };

  const sendViewNotification = async (proposalName) => {
    if (window._notificationSent) return false;
    
    try {
      const templateParams = {
        to_email: EMAILJS_CONFIG.ADMIN_EMAIL,
        to_name: "Admin",
        proposal_name: proposalName,
        viewer_name: viewerDataRef.current.name,
        viewer_email: viewerDataRef.current.email,
        viewer_id: auth.currentUser?.uid || 'Unknown',
        viewed_at: new Date().toLocaleString(),
        device: viewerDataRef.current.device,
        browser: deviceInfo.browser || 'Unknown',
        platform: deviceInfo.platform || 'Unknown',
        location: viewerDataRef.current.location,
        city: location?.city || 'Unknown',
        country: location?.country || 'Unknown',
        ip_address: location?.ip || 'Unknown',
        screen_size: deviceInfo.screenSize || 'Unknown',
        language: deviceInfo.language || 'Unknown',
        timezone: deviceInfo.timezone || 'Unknown',
        referrer: document.referrer || 'Direct',
        view_link: window.location.href,
        status: "View Started",
        timestamp: new Date().toISOString()
      };

      await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        templateParams
      );

      window._notificationSent = true;
      return true;
      
    } catch (error) {
      console.error("Error sending notification:", error);
      return false;
    }
  };

  const loadProposal = async (user) => {
    try {
      const decodedPath = decodePath(path);
      console.log("Final decoded path:", decodedPath);
      
      const fileRef = ref(storage, decodedPath);
      const url = await getDownloadURL(fileRef);
      setFileUrl(url);

      const extractedFileName = decodedPath.split("/").pop();
      const consistentProposalId = getConsistentProposalId(decodedPath);
      setFileName(extractedFileName);
      proposalMetaRef.current = {
        proposalId: consistentProposalId,
        fileName: extractedFileName,
        filePath: decodedPath
      };

      // Check if already signed
      const signedQuery = query(
        collection(db, "signedProposals"),
        where("proposalPath", "==", decodedPath),
        where("signerEmail", "==", user.email)
      );
      const signedSnapshot = await getDocs(signedQuery);
      setIsSigned(!signedSnapshot.empty);

      // Log view to Firestore with proper user info
      const viewData = {
        proposalId: consistentProposalId,
        proposalName: extractedFileName,
        fileName: extractedFileName,
        filePath: decodedPath,
        viewerId: user.uid,
        viewerEmail: user.email,
        viewerName: viewerName || user.displayName || user.email.split('@')[0],
        viewedAt: serverTimestamp(),
        deviceInfo: deviceInfo,
        location: location,
        referrer: document.referrer || 'direct',
        status: 'active'
      };
      
      await addDoc(collection(db, "proposalViews"), viewData);

      // Create session with proper user info
      const session = await addDoc(collection(db, "proposalSessions"), {
        proposalId: consistentProposalId,
        proposalName: extractedFileName,
        fileName: extractedFileName,
        filePath: decodedPath,
        viewerId: user.uid,
        viewerEmail: user.email,
        viewerName: viewerName || user.displayName || user.email.split('@')[0],
        pagesViewed: [1],
        pageCount: 1,
        duration: 0,
        startedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        currentPage: 1,
        deviceInfo: deviceInfo,
        location: location,
      });

      sessionId.current = session.id;
      activeViewerDocId.current = session.id;
      setSessionReady(true);
      await syncActiveViewer(
        {
          currentPage: 1,
          viewerEmail: user.email,
          viewerName: viewerName || user.displayName || user.email.split('@')[0]
        },
        true
      );
      
      // Track initial page view with proper user info
      await trackPageView(1);
      pageStartTime.current = Date.now();

      // Send view notification
      await sendViewNotification(extractedFileName, decodedPath);
      
    } catch (err) {
      console.error("Error loading proposal:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onPageChange = async ({ pageNumber: newPageNumber }) => {
    // Save time spent on previous page
    const timeSpent = (Date.now() - pageStartTime.current) / 1000;
    if (timeSpent > 0.5) {
      await trackPageTime(pageNumber, timeSpent);
    }
    
    setPageNumber(newPageNumber);
    pageStartTime.current = Date.now();
    
    // Track new page view
    await trackPageView(newPageNumber);
    
    // Update pagesViewed set and session
    if (!pagesViewed.current.has(newPageNumber)) {
      pagesViewed.current.add(newPageNumber);
      console.log(`📄 Page ${newPageNumber} added - Total pages viewed: ${pagesViewed.current.size}`);
      await updateSessionPages();
    }
  };

  const handlePageInputChange = async (e) => {
    const val = parseInt(e.target.value);
    if (val >= 1 && val <= (numPages || 1)) {
      // Save time spent on current page
      const timeSpent = (Date.now() - pageStartTime.current) / 1000;
      if (timeSpent > 0.5) {
        await trackPageTime(pageNumber, timeSpent);
      }
      
      setPageNumber(val);
      pageStartTime.current = Date.now();
      
      if (!pagesViewed.current.has(val)) {
        pagesViewed.current.add(val);
        await trackPageView(val);
        await updateSessionPages();
      }
    }
  };

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const scrollPercentage = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
      setScrollDepth(Math.min(100, scrollPercentage));
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabActive.current = !document.hidden;
      syncActiveViewer();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Heartbeat update every 30 seconds
  useEffect(() => {
    if (!sessionReady || !sessionId.current) return;

    heartbeatInterval.current = setInterval(async () => {
      if (!isTabActive.current) return;
      const duration = Date.now() - startTime.current;
      const pagesArray = Array.from(pagesViewed.current);
      
      await updateDoc(doc(db, "proposalSessions", sessionId.current), {
        pagesViewed: pagesArray,
        pageCount: pagesArray.length,
        duration,
        scrollDepth: Math.round(scrollDepth),
        lastHeartbeat: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        currentPage: currentPageRef.current,
        viewerEmail: userEmail,
        viewerName: viewerName
      });
      await syncActiveViewer({
        currentPage: currentPageRef.current,
        duration,
        scrollDepth: Math.round(currentScrollDepthRef.current)
      });
      console.log(`❤️ Heartbeat: ${pagesArray.length} pages viewed`);
    }, 30000);

    return () => clearInterval(heartbeatInterval.current);
  }, [sessionReady, userEmail, viewerName]);

  // Final save when user leaves (run once on unload/unmount only)
  useEffect(() => {
    const saveSession = async () => {
      if (!sessionId.current) return;
      
      // Save final page time
      const finalTime = (Date.now() - pageStartTime.current) / 1000;
      if (finalTime > 0.5) {
        await trackPageTime(currentPageRef.current, finalTime);
      }
      
      const duration = Date.now() - startTime.current;
      const pagesArray = Array.from(pagesViewed.current);
      
      await updateDoc(doc(db, "proposalSessions", sessionId.current), {
        pagesViewed: pagesArray,
        pageCount: pagesArray.length,
        duration,
        scrollDepth: Math.round(currentScrollDepthRef.current),
        endedAt: serverTimestamp(),
      });
      await clearActiveViewer();
      console.log(`💾 Final session saved: ${pagesArray.length} pages viewed`);
    };

    const handleBeforeUnload = () => {
      void saveSession();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      void saveSession();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const handleDownload = async () => {
    try {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      link.click();
      
      await addDoc(collection(db, "downloadEvents"), {
        fileName: fileName,
        viewerEmail: userEmail,
        viewerName: viewerName,
        downloadedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const handleSignProposal = () => {
    navigate(`/sign/${path}`);
  };

  const handleGoToDashboard = () => {
    navigate("/client-dashboard");
  };

  const handleLogout = async () => {
    // Log logout activity before signing out
    if (auth.currentUser) {
      await ActivityLogger.logLogout(auth.currentUser.email);
    }
    await auth.signOut();
    navigate("/login");
  };

  const handleGoBack = () => {
    // Navigate to the appropriate dashboard based on user role
    if (userRole === 'client') {
      navigate("/client-dashboard");
    } else {
      navigate("/dashboard");
    }
  };

  if (checkingAuth || loading) {
    return (
      <div style={loadingContainerStyle}>
        <div className="spinner"></div>
        <p>Loading proposal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={errorContainerStyle}>
        <MdDescription size={64} color="#ef4444" />
        <h2>Error Loading Proposal</h2>
        <p>{error}</p>
        <button onClick={handleGoBack} style={backButtonStyle}>
          <MdArrowBack size={18} />
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <button onClick={handleGoBack} style={backNavButtonStyle}>
            <MdArrowBack size={18} />
            Back
          </button>
          <div style={titleContainerStyle}>
            <MdDescription size={24} color="#1976D2" />
            <div>
              <h2 style={titleStyle}>{fileName}</h2>
              <p style={userInfoStyle}>{userEmail}</p>
            </div>
          </div>
        </div>

        <div style={userRoleContainerStyle}>
          {userRole && (
            <span style={roleBadgeStyle(userRole)}>
              {userRole === 'admin' ? 'Admin' : 'Client'}
            </span>
          )}
          {isSigned && (
            <span style={signedBadgeStyle}>
              <MdCheckCircle size={14} />
              Signed
            </span>
          )}
        </div>

        <div style={headerRightStyle}>
          {userRole === 'client' && !isSigned && (
            <button onClick={handleSignProposal} style={signButtonStyle}>
              <MdEdit size={18} />
              Sign This Proposal
            </button>
          )}
          
          {/* Highlight & Discussion Button */}
          <HighlightButton
            isActive={highlightModeActive}
            onToggle={() => {
              setHighlightModeActive(!highlightModeActive);
              setDiscussionPanelOpen(true);
            }}
            unresolvedCount={0}
          />
          
          {userRole === 'client' && (
            <button onClick={handleGoToDashboard} style={dashboardButtonStyle}>
              <MdDashboard size={16} />
              My Dashboard
            </button>
          )}
          
          <button onClick={handleDownload} style={downloadButtonStyle}>
            <MdFileUpload size={16} />
            Download
          </button>
          
          <button onClick={handleLogout} style={logoutButtonStyle}>
            <MdLogout size={16} />
            Logout
          </button>
        </div>
      </div>

      {/* Page Tracking Status */}
      {pageTrackingStatus && (
        <div style={trackingStatusStyle}>
          <MdCheckCircle size={16} color="#10B981" />
          <span>{pageTrackingStatus}</span>
        </div>
      )}

      {/* Live Stats Bar */}
      <div style={liveStatsStyle}>
        <div style={statItemStyle}>
          <MdVisibility size={16} color="#2196F3" />
          <span>Viewing as: <strong>{viewerName || "Loading..."}</strong></span>
        </div>
        <div style={statItemStyle}>
          <span>📧 {userEmail || "Loading..."}</span>
        </div>
        <div style={statItemStyle}>
          <span>📄 Pages: <strong>{pagesViewed.current.size}</strong></span>
        </div>
        <div style={statItemStyle}>
          <span>⏱️ Time: {Math.floor((Date.now() - startTime.current) / 1000)}s</span>
        </div>
        <div style={statItemStyle}>
          <span>📊 Scroll: {Math.round(scrollDepth)}%</span>
        </div>
        {deviceInfo.device && deviceInfo.device !== 'Unknown' && (
          <div style={statItemStyle}>
            <span>💻 {deviceInfo.device} - {deviceInfo.platform}</span>
          </div>
        )}
        {location?.city && location?.city !== 'Unknown' && (
          <div style={statItemStyle}>
            <span>📍 {location.city}, {location.country}</span>
          </div>
        )}
      </div>

      <div style={viewerContainerStyle}>
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div style={pdfLoadingStyle}>Loading PDF...</div>}
          error={<div style={pdfErrorStyle}>Failed to load PDF.</div>}
        >
          <Page
            pageNumber={pageNumber}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            onRenderSuccess={() => onPageChange({ pageNumber })}
            width={Math.min(window.innerWidth - 100, 800)}
            data-testid="pdf-page"
          />
        </Document>
      </div>

      <div style={paginationContainerStyle}>
        <button
          onClick={async () => {
            if (pageNumber > 1) {
              const timeSpent = (Date.now() - pageStartTime.current) / 1000;
              if (timeSpent > 0.5) {
                await trackPageTime(pageNumber, timeSpent);
              }
              setPageNumber(prev => Math.max(prev - 1, 1));
              pageStartTime.current = Date.now();
            }
          }}
          disabled={pageNumber <= 1}
          style={paginationButtonStyle(pageNumber <= 1)}
        >
          Previous
        </button>

        <span style={pageInfoStyle}>
          Page <input
            type="number"
            min={1}
            max={numPages || 1}
            value={pageNumber}
            onChange={handlePageInputChange}
            style={pageInputStyle}
          /> of {numPages || '?'}
        </span>

        <button
          onClick={async () => {
            if (pageNumber < (numPages || 1)) {
              const timeSpent = (Date.now() - pageStartTime.current) / 1000;
              if (timeSpent > 0.5) {
                await trackPageTime(pageNumber, timeSpent);
              }
              setPageNumber(prev => Math.min(prev + 1, numPages || 1));
              pageStartTime.current = Date.now();
            }
          }}
          disabled={pageNumber >= (numPages || 1)}
          style={paginationButtonStyle(pageNumber >= (numPages || 1))}
        >
          Next
        </button>
      </div>

      <ProposalReviewPanel
        proposalId={proposalMetaRef.current.proposalId}
        proposalName={proposalMetaRef.current.fileName || fileName}
        filePath={proposalMetaRef.current.filePath}
        userRole={userRole}
        clientId={auth.currentUser?.uid || ""}
        clientEmail={userEmail}
        clientName={viewerName || userDisplayName || auth.currentUser?.displayName || ""}
      />

      {/* Discussion Panel */}
      <DiscussionPanel
        isOpen={discussionPanelOpen}
        onClose={() => setDiscussionPanelOpen(false)}
        proposalId={proposalMetaRef.current.proposalId || path}
        proposalName={fileName}
        filePath={proposalMetaRef.current.filePath}
        currentPage={pageNumber}
        userId={auth.currentUser?.uid}
        userEmail={userEmail || auth.currentUser?.email}
        userRole={userRole}
        highlightModeActive={highlightModeActive}
        onHighlightModeChange={setHighlightModeActive}
      />

      <style>{`
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #00D4FF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Styles
const trackingStatusStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "#f0fdf4",
  borderRadius: "8px",
  marginBottom: "12px",
  fontSize: "12px",
  color: "#166534",
  border: "1px solid #86efac",
  animation: "fadeOut 2s ease forwards",
};

const containerStyle = {
  padding: "20px",
  maxWidth: "1200px",
  margin: "0 auto",
  fontFamily: "'Inter', sans-serif",
  minHeight: "100vh",
  background: "#f8fafc",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
  padding: "16px 20px",
  background: "#fff",
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  border: "1px solid #eee",
  flexWrap: "wrap",
  gap: "15px",
};

const headerLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: "15px",
  flexWrap: "wrap",
};

const backNavButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 16px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  color: "#64748b",
  fontSize: "14px",
  cursor: "pointer",
};

const titleContainerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const titleStyle = {
  margin: 0,
  fontSize: "18px",
  fontWeight: "600",
  color: "#1a1a2e",
};

const userInfoStyle = {
  margin: "4px 0 0 0",
  fontSize: "12px",
  color: "#64748b",
};

const userRoleContainerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 16px",
  background: "#f8fafc",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
};

const roleBadgeStyle = (role) => ({
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "600",
  background: role === 'admin' ? '#e3f2fd' : '#f0fdf4',
  color: role === 'admin' ? '#1976D2' : '#10B981',
  border: `1px solid ${role === 'admin' ? '#90caf9' : '#86efac'}`,
});

const signedBadgeStyle = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "600",
  background: "#f0fdf4",
  color: "#10B981",
  border: "1px solid #86efac",
};

const headerRightStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const signButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
};

const dashboardButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  color: "#64748b",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
};

const downloadButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "#4CAF50",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
};

const logoutButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "#f1f5f9",
  color: "#64748b",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
};

const liveStatsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "20px",
  padding: "12px 20px",
  background: "#fff",
  borderRadius: "12px",
  marginBottom: "20px",
  border: "1px solid #e2e8f0",
  alignItems: "center",
};

const statItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "13px",
  color: "#1a1a2e",
};

const viewerContainerStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  overflow: "auto",
  height: "calc(100vh - 480px)",
  minHeight: "500px",
  background: "#fff",
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  padding: "20px",
  display: "flex",
  justifyContent: "center",
};

const pdfLoadingStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#666",
  fontSize: "14px",
};

const pdfErrorStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#c33",
  fontSize: "14px",
};

const paginationContainerStyle = {
  marginTop: "20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  padding: "16px",
  background: "#fff",
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  border: "1px solid #eee",
  flexWrap: "wrap",
};

const paginationButtonStyle = (disabled) => ({
  padding: "8px 20px",
  background: disabled ? "#e2e8f0" : "#2196F3",
  color: disabled ? "#94a3b8" : "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: disabled ? "not-allowed" : "pointer",
});

const pageInfoStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "14px",
  color: "#1a1a2e",
};

const pageInputStyle = {
  width: "60px",
  padding: "8px",
  textAlign: "center",
  border: "1px solid #e2e8f0",
  borderRadius: "6px",
  fontSize: "14px",
  outline: "none",
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

const errorContainerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  gap: "20px",
  background: "#fff",
  textAlign: "center",
  padding: "0 20px",
};

const backButtonStyle = {
  padding: "10px 24px",
  background: "#2196F3",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  cursor: "pointer",
  marginTop: "20px",
};
