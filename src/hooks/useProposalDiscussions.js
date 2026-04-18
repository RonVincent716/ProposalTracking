// src/hooks/useProposalDiscussions.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  writeBatch
} from 'firebase/firestore';

export const useProposalDiscussions = (proposalId, proposalName, filePath, userId, userEmail, userRole) => {
  const [discussions, setDiscussions] = useState([]);
  const [messages, setMessages] = useState({}); // Map of discussionId -> messages
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const unsubscribesRef = useRef({}); // Store unsubscribes to cleanup
  const activeListenersRef = useRef(new Set()); // Track active listeners

  // Create a new discussion (highlight)
  const addDiscussion = useCallback(async (highlightData) => {
    try {
      setError(null);
      console.log('useProposalDiscussions.addDiscussion called with:', { highlightData, proposalId, userId, userEmail });
      
      if (!proposalId || !userId || !userEmail) {
        throw new Error(`Missing required data: proposalId=${proposalId}, userId=${userId}, userEmail=${userEmail}`);
      }
      
      const discussionData = {
        proposalId,
        proposalName,
        filePath,
        clientId: userId,
        clientEmail: userEmail,
        clientName: userEmail?.split('@')[0] || 'Client',
        pageNumber: highlightData.pageNumber,
        highlightedText: highlightData.text,
        highlightColor: highlightData.color || '#FFFF00',
        startIndex: highlightData.startIndex || 0,
        endIndex: highlightData.endIndex || 0,
        context: highlightData.context || '', // Surrounding text for context
        status: 'open', // open, resolved
        createdAt: serverTimestamp(),
        resolvedAt: null,
        resolvedBy: null,
        messageCount: 0
      };

      console.log('Saving discussion to Firestore:', discussionData);
      const docRef = await addDoc(collection(db, 'proposalDiscussions'), discussionData);
      console.log('Discussion saved with ID:', docRef.id);
      return docRef.id;
    } catch (err) {
      console.error('Error creating discussion:', err);
      setError(err.message);
      throw err;
    }
  }, [proposalId, proposalName, filePath, userId, userEmail]);

  // Add a message to a discussion (real-time chat)
  const addMessage = useCallback(async (discussionId, messageText) => {
    try {
      setError(null);
      const messageData = {
        discussionId,
        senderId: userId,
        senderEmail: userEmail,
        senderName: userEmail?.split('@')[0] || 'User',
        senderRole: userRole || 'client',
        message: messageText,
        timestamp: serverTimestamp(),
        isRead: userRole === 'admin' ? false : true // Mark unread for recipient
      };

      const docRef = await addDoc(
        collection(db, 'proposalDiscussionMessages'),
        messageData
      );

      // Increment message count on discussion
      await updateDoc(doc(db, 'proposalDiscussions', discussionId), {
        messageCount: (await getDiscussionMessageCount(discussionId)) + 1,
        lastActivity: serverTimestamp()
      });

      return docRef.id;
    } catch (err) {
      console.error('Error adding message:', err);
      setError(err.message);
      throw err;
    }
  }, [userId, userEmail, userRole]);

  // Get message count for a discussion
  const getDiscussionMessageCount = async (discussionId) => {
    try {
      const q = query(
        collection(db, 'proposalDiscussionMessages'),
        where('discussionId', '==', discussionId)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (err) {
      console.error('Error counting messages:', err);
      return 0;
    }
  };

  // Resolve a discussion (admin only)
  const resolveDiscussion = useCallback(async (discussionId) => {
    if (userRole !== 'admin') {
      setError('Only admins can resolve discussions');
      return;
    }

    try {
      setError(null);
      await updateDoc(doc(db, 'proposalDiscussions', discussionId), {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: userId
      });
    } catch (err) {
      console.error('Error resolving discussion:', err);
      setError(err.message);
      throw err;
    }
  }, [userRole, userId]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (discussionId, messageIds) => {
    try {
      const batch = writeBatch(db);
      messageIds.forEach(messageId => {
        batch.updateDoc(
          doc(db, 'proposalDiscussionMessages', messageId),
          { isRead: true }
        );
      });
      await batch.commit();
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }, []);

  // Load all discussions for this proposal (real-time listener)
  useEffect(() => {
    if (!proposalId || !userId) return;

    setLoading(true);
    const q = query(
      collection(db, 'proposalDiscussions'),
      where('proposalId', '==', proposalId)
      // Removed orderBy to avoid composite index requirement
      // Sorting is done in component instead
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const discussionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          resolvedAt: doc.data().resolvedAt?.toDate?.() || null
        }));
        // Sort by createdAt descending in component
        discussionsData.sort((a, b) => b.createdAt - a.createdAt);
        setDiscussions(discussionsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading discussions:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [proposalId, userId]);

  // Load messages for a specific discussion (real-time listener)
  const loadDiscussionMessages = useCallback((discussionId) => {
    if (!discussionId || activeListenersRef.current.has(discussionId)) {
      return; // Already listening
    }

    activeListenersRef.current.add(discussionId);

    const q = query(
      collection(db, 'proposalDiscussionMessages'),
      where('discussionId', '==', discussionId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date()
        }));
        setMessages(prev => ({
          ...prev,
          [discussionId]: messagesData
        }));
      },
      (err) => {
        console.error(`Error loading messages for ${discussionId}:`, err);
        setError(err.message);
      }
    );

    unsubscribesRef.current[discussionId] = unsubscribe;
    return unsubscribe;
  }, []);

  // Unload messages for a specific discussion
  const unloadDiscussionMessages = useCallback((discussionId) => {
    if (unsubscribesRef.current[discussionId]) {
      unsubscribesRef.current[discussionId]();
      delete unsubscribesRef.current[discussionId];
      activeListenersRef.current.delete(discussionId);
    }
  }, []);

  // Cleanup all listeners on unmount
  useEffect(() => {
    return () => {
      Object.values(unsubscribesRef.current).forEach(unsub => unsub?.());
      activeListenersRef.current.clear();
    };
  }, []);

  // Get discussions for a specific page
  const getDiscussionsForPage = useCallback((pageNumber) => {
    return discussions.filter(d => d.pageNumber === pageNumber);
  }, [discussions]);

  // Get unresolved discussions count
  const getUnresolvedCount = useCallback(() => {
    return discussions.filter(d => d.status === 'open').length;
  }, [discussions]);

  return {
    // State
    discussions,
    messages,
    loading,
    error,

    // Methods
    addDiscussion,
    addMessage,
    resolveDiscussion,
    markMessagesAsRead,
    loadDiscussionMessages,
    unloadDiscussionMessages,

    // Helpers
    getDiscussionsForPage,
    getUnresolvedCount
  };
};
