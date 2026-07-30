import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  addDoc,
  getDocs
} from 'firebase/firestore';

/**
 * Hook to fetch all discussions for a specific client
 * Used by ClientDiscussionCenter to show discussions across all proposals
 */
export const useClientDiscussions = (clientEmail) => {
  const [discussions, setDiscussions] = useState([]);
  const [messages, setMessages] = useState({}); // Map of discussionId -> messages
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const unsubscribesRef = useRef({});
  const activeListenersRef = useRef(new Set());

  // Fetch all discussions for this client
  useEffect(() => {
    if (!clientEmail) {
      setDiscussions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'proposalDiscussions'),
      where('clientEmail', '==', clientEmail.toLowerCase()),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const discussionData = [];
        snapshot.forEach((doc) => {
          discussionData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setDiscussions(discussionData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching discussions:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    unsubscribesRef.current.discussions = unsubscribe;

    return () => {
      if (unsubscribesRef.current.discussions) {
        unsubscribesRef.current.discussions();
      }
    };
  }, [clientEmail]);

  // Load messages for a specific discussion
  const loadDiscussionMessages = useCallback((discussionId) => {
    if (activeListenersRef.current.has(discussionId)) return;
    activeListenersRef.current.add(discussionId);

    const q = query(
      collection(db, 'proposalDiscussionMessages'),
      where('discussionId', '==', discussionId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = [];
        snapshot.forEach((doc) => {
          msgs.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setMessages((prev) => ({
          ...prev,
          [discussionId]: msgs
        }));
      },
      (err) => {
        console.error('Error loading messages:', err);
      }
    );

    unsubscribesRef.current[`messages_${discussionId}`] = unsubscribe;
  }, []);

  // Unload messages for a specific discussion
  const unloadDiscussionMessages = useCallback((discussionId) => {
    activeListenersRef.current.delete(discussionId);
    if (unsubscribesRef.current[`messages_${discussionId}`]) {
      unsubscribesRef.current[`messages_${discussionId}`]();
      delete unsubscribesRef.current[`messages_${discussionId}`];
    }
    setMessages((prev) => {
      const updated = { ...prev };
      delete updated[discussionId];
      return updated;
    });
  }, []);

  // Add a message to a discussion
  const addMessage = useCallback(async (discussionId, messageText, userEmail, userRole) => {
    try {
      setError(null);
      const messageData = {
        discussionId,
        senderId: userEmail,
        senderEmail: userEmail,
        senderName: userEmail?.split('@')[0] || 'Client',
        senderRole: userRole || 'client',
        message: messageText,
        timestamp: serverTimestamp(),
        isRead: userRole === 'admin' ? false : true
      };

      const docRef = await addDoc(
        collection(db, 'proposalDiscussionMessages'),
        messageData
      );

      // Update discussion's last activity
      await updateDoc(doc(db, 'proposalDiscussions', discussionId), {
        lastActivity: serverTimestamp()
      });

      return docRef.id;
    } catch (err) {
      console.error('Error adding message:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  // Resolve a discussion
  const resolveDiscussion = useCallback(async (discussionId, userEmail) => {
    try {
      setError(null);
      await updateDoc(doc(db, 'proposalDiscussions', discussionId), {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: userEmail
      });
    } catch (err) {
      console.error('Error resolving discussion:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  // Get unresolved discussions count
  const getUnresolvedCount = useCallback(() => {
    return discussions.filter((d) => d.status === 'open').length;
  }, [discussions]);

  // Get messages for a specific discussion
  const getDiscussionMessages = useCallback((discussionId) => {
    return messages[discussionId] || [];
  }, [messages]);

  // Cleanup all listeners
  useEffect(() => {
    return () => {
      Object.values(unsubscribesRef.current).forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  return {
    discussions,
    messages,
    loading,
    error,
    addMessage,
    resolveDiscussion,
    loadDiscussionMessages,
    unloadDiscussionMessages,
    getUnresolvedCount,
    getDiscussionMessages
  };
};
