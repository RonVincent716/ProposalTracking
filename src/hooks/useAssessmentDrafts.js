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
  getDocs,
  deleteDoc,
  getDoc,
  setDoc
} from 'firebase/firestore';

/**
 * Hook to manage assessment drafts
 * Handles creating, updating, deleting, and retrieving drafts
 * Also manages auto-save functionality
 * 
 * @param {string} adminUserId - Admin's user ID
 * @param {string} adminEmail - Admin's email
 * @param {boolean} skipListener - Skip setting up main listener (default: false). Set to true when using in editor to avoid duplicate listeners
 */
export const useAssessmentDrafts = (adminUserId, adminEmail, skipListener = false) => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // idle, saving, saved, error
  
  const unsubscribersRef = useRef({});
  const autoSaveTimersRef = useRef({});

  // Fetch all assessment drafts for this admin (skip if in editor mode)
  useEffect(() => {
    // Skip listener setup if requested (e.g., in AssessmentDraftEditor to avoid conflicts)
    if (skipListener) {
      setLoading(false);
      return;
    }

    if (!adminUserId) {
      setDrafts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'assessmentDrafts'),
      where('createdByAdminId', '==', adminUserId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const draftData = [];
        snapshot.forEach((doc) => {
          draftData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setDrafts(draftData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching drafts:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    unsubscribersRef.current.drafts = unsubscribe;

    return () => {
      if (unsubscribersRef.current.drafts) {
        unsubscribersRef.current.drafts();
      }
    };
  }, [adminUserId, skipListener]);

  // Create a new draft
  const createDraft = useCallback(async (draftData) => {
    try {
      setError(null);
      const newDraft = {
        ...draftData,
        createdByAdminId: adminUserId,
        createdByAdminEmail: adminEmail,
        status: 'draft',
        completionPercentage: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastEditedByName: adminEmail?.split('@')[0] || 'Admin',
        lastEditedAt: new Date().toISOString(),
        draftHistory: [{
          timestamp: new Date().toISOString(),
          action: 'created',
          editedBy: adminEmail
        }],
        autoSaveEnabled: true
      };

      const docRef = await addDoc(collection(db, 'assessmentDrafts'), newDraft);
      return docRef.id;
    } catch (err) {
      console.error('Error creating draft:', err);
      setError(err.message);
      throw err;
    }
  }, [adminUserId, adminEmail]);

  // Calculate completion percentage
  const calculateCompletion = (draft) => {
    const fields = [
      draft.clientName,
      draft.companyName,
      draft.industry,
      draft.companyOverview,
      draft.strengths?.length > 0,
      draft.gaps?.length > 0,
      draft.recommendation,
      draft.readinessScore,
      draft.riskLevel,
      draft.adminNotes
    ];
    const filledFields = fields.filter(Boolean).length;
    return Math.round((filledFields / fields.length) * 100);
  };

  // Auto-save draft
  const autoSaveDraft = useCallback(async (draftId, updates) => {
    if (!draftId) return;

    // Clear existing timer for this draft
    if (autoSaveTimersRef.current[draftId]) {
      clearTimeout(autoSaveTimersRef.current[draftId]);
    }

    // Set new timer for auto-save (3 seconds after last change)
    autoSaveTimersRef.current[draftId] = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving');
        
        const completion = calculateCompletion(updates);
        
        await updateDoc(doc(db, 'assessmentDrafts', draftId), {
          ...updates,
          updatedAt: serverTimestamp(),
          completionPercentage: completion,
          lastEditedAt: new Date().toISOString(),
          lastEditedByName: adminEmail?.split('@')[0] || 'Admin'
        });

        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Error auto-saving draft:', err);
        setAutoSaveStatus('error');
      }
    }, 3000); // Wait 3 seconds after user stops typing
  }, [adminEmail]);

  // Manual save draft
  const saveDraft = useCallback(async (draftId, updates) => {
    try {
      setError(null);
      setAutoSaveStatus('saving');

      const completion = calculateCompletion(updates);

      await updateDoc(doc(db, 'assessmentDrafts', draftId), {
        ...updates,
        updatedAt: serverTimestamp(),
        completionPercentage: completion,
        lastEditedAt: new Date().toISOString(),
        lastEditedByName: adminEmail?.split('@')[0] || 'Admin'
      });

      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
      return true;
    } catch (err) {
      console.error('Error saving draft:', err);
      setError(err.message);
      setAutoSaveStatus('error');
      throw err;
    }
  }, [adminEmail]);

  // Delete draft
  const deleteDraft = useCallback(async (draftId) => {
    try {
      setError(null);
      await deleteDoc(doc(db, 'assessmentDrafts', draftId));
    } catch (err) {
      console.error('Error deleting draft:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  // Get draft by ID
  const getDraft = useCallback(async (draftId) => {
    try {
      const docSnap = await getDoc(doc(db, 'assessmentDrafts', draftId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (err) {
      console.error('Error getting draft:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  // Convert draft to final assessment
  const publishDraft = useCallback(async (draftId, finalData) => {
    try {
      setError(null);

      // Get the draft
      const draftSnap = await getDoc(doc(db, 'assessmentDrafts', draftId));
      if (!draftSnap.exists()) {
        throw new Error('Draft not found');
      }

      const draft = draftSnap.data();

      // Create final assessment in proposalAssessments collection
      const assessmentData = {
        clientEmail: finalData.clientEmail || draft.clientEmail,
        clientName: finalData.clientName || draft.clientName,
        companyName: finalData.companyName || draft.companyName,
        industry: finalData.industry || draft.industry,
        phone: finalData.phone || draft.phone,
        website: finalData.website || draft.website,
        companyOverview: finalData.companyOverview || draft.companyOverview,
        strengths: finalData.strengths || draft.strengths,
        gaps: finalData.gaps || draft.gaps,
        recommendation: finalData.recommendation || draft.recommendation,
        readinessScore: finalData.readinessScore || draft.readinessScore,
        riskLevel: finalData.riskLevel || draft.riskLevel,
        adminNotes: finalData.adminNotes || draft.adminNotes,
        updatedAt: serverTimestamp(),
        updatedBy: adminEmail,
        draftId: draftId,
        publishedAt: serverTimestamp(),
        status: 'published'
      };

      // Save to proposalAssessments
      await setDoc(
        doc(db, 'proposalAssessments', finalData.clientEmail?.toLowerCase() || draft.clientEmail?.toLowerCase()),
        assessmentData,
        { merge: true }
      );

      // Update draft status
      await updateDoc(doc(db, 'assessmentDrafts', draftId), {
        status: 'published',
        publishedAt: serverTimestamp(),
        publishedBy: adminEmail
      });

      return true;
    } catch (err) {
      console.error('Error publishing draft:', err);
      setError(err.message);
      throw err;
    }
  }, [adminEmail]);

  // Get draft history
  const getDraftHistory = useCallback(async (draftId) => {
    try {
      const draftSnap = await getDoc(doc(db, 'assessmentDrafts', draftId));
      if (draftSnap.exists()) {
        return draftSnap.data().draftHistory || [];
      }
      return [];
    } catch (err) {
      console.error('Error getting draft history:', err);
      return [];
    }
  }, []);

  // Search drafts
  const searchDrafts = useCallback((searchTerm, statusFilter = 'all') => {
    return drafts.filter((draft) => {
      const matchesSearch =
        draft.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        draft.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        draft.clientEmail?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        draft.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [drafts]);

  return {
    drafts,
    loading,
    error,
    autoSaveStatus,
    createDraft,
    saveDraft,
    autoSaveDraft,
    deleteDraft,
    getDraft,
    publishDraft,
    getDraftHistory,
    searchDrafts,
    calculateCompletion
  };
};
