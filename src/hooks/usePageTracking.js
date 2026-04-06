// src/hooks/usePageTracking.js
import { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';

export const usePageTracking = (proposalId, clientId, totalPages) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [timeOnCurrentPage, setTimeOnCurrentPage] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [pageTimes, setPageTimes] = useState({});
  
  const pageStartTimeRef = useRef(Date.now());
  const intervalRef = useRef(null);
  const isActiveRef = useRef(true);

  useEffect(() => {
    if (proposalId && clientId) {
      startTracking();
      setupVisibilityTracking();
      updateActiveViewers(1);
      
      return () => {
        stopTracking();
        updateActiveViewers(-1);
      };
    }
  }, [proposalId, clientId]);

  useEffect(() => {
    if (currentPage && proposalId) {
      trackPageChange();
    }
  }, [currentPage]);

  const startTracking = () => {
    recordViewStart();
    
    intervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        const elapsed = Math.floor((Date.now() - pageStartTimeRef.current) / 1000);
        setTimeOnCurrentPage(elapsed);
        setTotalTime(prev => prev + 1);
      }
    }, 1000);
  };

  const stopTracking = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    const finalTime = (Date.now() - pageStartTimeRef.current) / 1000;
    if (finalTime > 0.5 && proposalId) {
      await savePageTime(currentPage, finalTime);
    }
    
    await saveSessionComplete();
  };

  const trackPageChange = async () => {
    const timeSpent = (Date.now() - pageStartTimeRef.current) / 1000;
    
    if (timeSpent > 0.5 && proposalId) {
      await savePageTime(currentPage, timeSpent);
      
      setPageTimes(prev => ({
        ...prev,
        [currentPage]: (prev[currentPage] || 0) + timeSpent
      }));
      
      console.log(`📊 Page ${currentPage}: ${timeSpent.toFixed(2)} seconds`);
    }
    
    pageStartTimeRef.current = Date.now();
    setTimeOnCurrentPage(0);
  };

  const savePageTime = async (pageNum, timeSpent) => {
    try {
      // Save to proposalPageTracking collection
      await addDoc(collection(db, "proposalPageTracking"), {
        proposalId: proposalId,
        clientId: clientId,
        pageNumber: pageNum,
        timeSpentSeconds: Math.round(timeSpent * 10) / 10,
        timestamp: serverTimestamp(),
        sessionId: sessionStorage.getItem('trackingSessionId') || generateSessionId(),
      });
      
      // Also update the engagement sessions collection (for your existing Engagement tab)
      const sessionsRef = collection(db, "proposalSessions");
      await addDoc(sessionsRef, {
        proposalId: proposalId,
        fileName: proposalId.split('/').pop(),
        viewerEmail: localStorage.getItem('clientEmail') || 'anonymous',
        viewerId: clientId,
        duration: timeSpent * 1000, // in milliseconds
        pagesViewed: [pageNum],
        pageCount: 1,
        startedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        pageNumber: pageNum,
        timeOnPage: timeSpent
      });
      
    } catch (error) {
      console.error("Error saving page time:", error);
    }
  };

  const recordViewStart = async () => {
    try {
      const sessionId = generateSessionId();
      sessionStorage.setItem('trackingSessionId', sessionId);
      
      // Record view start
      await addDoc(collection(db, "proposalViews"), {
        proposalId: proposalId,
        fileName: proposalId.split('/').pop(),
        viewerId: clientId,
        viewerEmail: localStorage.getItem('clientEmail') || 'anonymous',
        viewedAt: serverTimestamp(),
        sessionId: sessionId
      });
      
    } catch (error) {
      console.error("Error recording view start:", error);
    }
  };

  const saveSessionComplete = async () => {
    try {
      const totalSeconds = totalTime;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      await addDoc(collection(db, "proposalViewComplete"), {
        proposalId: proposalId,
        clientId: clientId,
        totalTimeSpent: totalSeconds,
        formattedTime: `${minutes}m ${seconds}s`,
        pageTimes: pageTimes,
        completedAt: serverTimestamp(),
        sessionId: sessionStorage.getItem('trackingSessionId')
      });
      
      console.log(`✅ Session saved: Total time ${minutes}m ${seconds}s, Pages: ${Object.keys(pageTimes).length}`);
      
    } catch (error) {
      console.error("Error saving session:", error);
    }
  };

  const updateActiveViewers = async (change) => {
    try {
      const analyticsId = proposalId.replace(/[\/\.\#\$\[\]\*\s]/g, '_');
      const analyticsRef = doc(db, "proposalAnalytics", analyticsId);
      const analyticsDoc = await getDoc(analyticsRef);
      
      if (analyticsDoc.exists()) {
        await updateDoc(analyticsRef, {
          currentViewers: increment(change),
          totalViews: change === 1 ? increment(1) : increment(0),
          lastUpdated: serverTimestamp()
        });
      } else {
        await setDoc(analyticsRef, {
          proposalId: proposalId,
          currentViewers: change === 1 ? 1 : 0,
          totalViews: change === 1 ? 1 : 0,
          totalTimeSpent: 0,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error updating active viewers:", error);
    }
  };

  const setupVisibilityTracking = () => {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        isActiveRef.current = false;
        const timeSpent = (Date.now() - pageStartTimeRef.current) / 1000;
        if (timeSpent > 0.5) {
          savePageTime(currentPage, timeSpent);
        }
        console.log("⏸️ Tracking paused - Tab inactive");
      } else {
        isActiveRef.current = true;
        pageStartTimeRef.current = Date.now();
        console.log("▶️ Tracking resumed - Tab active");
      }
    });
    
    window.addEventListener('beforeunload', () => {
      stopTracking();
    });
  };

  const generateSessionId = () => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return {
    currentPage,
    totalPages,
    timeOnCurrentPage: formatTime(timeOnCurrentPage),
    totalTime: formatTime(totalTime),
    pageTimes,
    goToPage,
    setCurrentPage
  };
};