// src/hooks/useUserActivity.js
import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  where,
  limit
} from 'firebase/firestore';

/**
 * Hook to track and manage user activities
 * Logs: login, logout, view document, download, edit, delete, share, etc.
 */
export const useUserActivity = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Log an activity
  const logActivity = useCallback(async (activityType, details = {}) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const activityData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        activityType, // 'login', 'logout', 'view_document', 'download', 'edit', 'delete', 'share', etc.
        details: {
          ...details,
          userAgent: navigator.userAgent,
          timestamp: serverTimestamp()
        },
        createdAt: serverTimestamp(),
        ipAddress: '' // This would need server-side collection
      };

      const docRef = await addDoc(collection(db, 'userActivities'), activityData);
      return docRef.id;
    } catch (err) {
      console.error('Error logging activity:', err);
    }
  }, []);

  // Fetch all activities (for admin)
  const fetchAllActivities = useCallback((limitCount = 500) => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'userActivities'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const activityList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }));
        setActivities(activityList);
        setLoading(false);
      }, (err) => {
        console.error('Error fetching activities:', err);
        setError(err.message);
        setLoading(false);
      });

      return unsubscribe;
    } catch (err) {
      console.error('Error setting up activity listener:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  // Get activities for a specific user
  const getUserActivities = useCallback(async (userId) => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'userActivities'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      const snapshot = await getDocs(q);
      const activityList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }));
      setActivities(activityList);
      setLoading(false);
      return activityList;
    } catch (err) {
      console.error('Error fetching user activities:', err);
      setError(err.message);
      setLoading(false);
      return [];
    }
  }, []);

  // Get activity statistics for a selected date range
  const getActivityStats = useCallback(async (startDate, endDate) => {
    try {
      const start = startDate ? new Date(startDate) : new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, 'userActivities'),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const activityList = snapshot.docs.map((doc) => doc.data());

      // Calculate stats
      const stats = {
        totalActivities: activityList.length,
        uniqueUsers: new Set(activityList.map((a) => a.userId)).size,
        byType: {},
        topUsers: {},
        hourlyDistribution: Array(24).fill(0)
      };

      activityList.forEach((activity) => {
        // Count by type
        stats.byType[activity.activityType] = (stats.byType[activity.activityType] || 0) + 1;

        // Count by user
        stats.topUsers[activity.userEmail] = (stats.topUsers[activity.userEmail] || 0) + 1;

        // Hourly distribution
        const hour = new Date(activity.createdAt?.toDate?.() || activity.createdAt).getHours();
        stats.hourlyDistribution[hour]++;
      });

      return stats;
    } catch (err) {
      console.error('Error calculating activity stats:', err);
      return null;
    }
  }, []);

  return {
    activities,
    loading,
    error,
    logActivity,
    fetchAllActivities,
    getUserActivities,
    getActivityStats
  };
};
