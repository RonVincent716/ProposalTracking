// src/utils/activityLogger.js
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Activity Logger Utility
 * Use this to log user activities throughout the application
 * Logs directly to Firestore without needing hook initialization
 */

/**
 * Log a user activity directly to Firestore
 * @param {string} activityType - Type of activity (login, logout, view_document, download, etc.)
 * @param {object} details - Additional details about the activity
 */
const logActivityToFirestore = async (activityType, details = {}) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn('No authenticated user. Activity not logged:', activityType);
      return;
    }

    const activityData = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      activityType,
      details: {
        ...details,
        userAgent: navigator.userAgent,
      },
      createdAt: serverTimestamp(),
      ipAddress: '' // This would need server-side collection
    };

    const docRef = await addDoc(collection(db, 'userActivities'), activityData);
    console.log('Activity logged:', activityType, docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

/**
 * Activity types enum for consistency
 */
export const ActivityTypes = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  VIEW_DOCUMENT: 'view_document',
  DOWNLOAD: 'download',
  EDIT: 'edit',
  DELETE: 'delete',
  SHARE: 'share',
  UPLOAD: 'upload',
  COMMENT: 'comment',
  REVIEW: 'review',
  EXPORT: 'export',
  IMPORT: 'import',
  SIGN: 'sign',
  UNLOCK: 'unlock',
  PRINT: 'print',
  EMAIL: 'email',
  CREATE_DISCUSSION: 'create_discussion',
  SEND_MESSAGE: 'send_message',
  ACCESS_ADMIN: 'access_admin',
  PROFILE_UPDATE: 'profile_update',
  EMAIL_SHARE: 'email_share'
};

/**
 * Log specific events
 */
export const ActivityLogger = {
  /**
   * Log user login
   */
  logLogin: async (userEmail) => {
    await logActivityToFirestore(ActivityTypes.LOGIN, {
      userEmail,
      loginTime: new Date().toISOString()
    });
  },

  /**
   * Log user logout
   */
  logLogout: async (userEmail) => {
    await logActivityToFirestore(ActivityTypes.LOGOUT, {
      userEmail,
      logoutTime: new Date().toISOString()
    });
  },

  /**
   * Log document view
   */
  logDocumentView: async (documentId, documentName, duration = null) => {
    await logActivityToFirestore(ActivityTypes.VIEW_DOCUMENT, {
      documentId,
      documentName,
      duration, // in seconds
      viewTime: new Date().toISOString()
    });
  },

  /**
   * Log document download
   */
  logDownload: async (documentId, documentName) => {
    await logActivityToFirestore(ActivityTypes.DOWNLOAD, {
      documentId,
      documentName,
      downloadTime: new Date().toISOString()
    });
  },

  /**
   * Log document edit
   */
  logEdit: async (documentId, documentName, editedFields = []) => {
    await logActivityToFirestore(ActivityTypes.EDIT, {
      documentId,
      documentName,
      editedFields,
      editTime: new Date().toISOString()
    });
  },

  /**
   * Log document delete
   */
  logDelete: async (documentId, documentName) => {
    await logActivityToFirestore(ActivityTypes.DELETE, {
      documentId,
      documentName,
      deleteTime: new Date().toISOString()
    });
  },

  /**
   * Log document share
   */
  logShare: async (documentId, documentName, sharedWith = []) => {
    await logActivityToFirestore(ActivityTypes.SHARE, {
      documentId,
      documentName,
      sharedWith,
      shareTime: new Date().toISOString()
    });
  },

  /**
   * Log document upload
   */
  logUpload: async (documentName, fileSize, fileType) => {
    await logActivityToFirestore(ActivityTypes.UPLOAD, {
      documentName,
      fileSize,
      fileType,
      uploadTime: new Date().toISOString()
    });
  },

  /**
   * Log comment/discussion
   */
  logComment: async (documentId, documentName, commentText = null) => {
    await logActivityToFirestore(ActivityTypes.COMMENT, {
      documentId,
      documentName,
      commentLength: commentText ? commentText.length : 0,
      commentTime: new Date().toISOString()
    });
  },

  /**
   * Log document review
   */
  logReview: async (documentId, documentName, status, comments = null) => {
    await logActivityToFirestore(ActivityTypes.REVIEW, {
      documentId,
      documentName,
      reviewStatus: status,
      hasComments: !!comments,
      reviewTime: new Date().toISOString()
    });
  },

  /**
   * Log data export
   */
  logExport: async (exportType, recordCount) => {
    await logActivityToFirestore(ActivityTypes.EXPORT, {
      exportType,
      recordCount,
      exportTime: new Date().toISOString()
    });
  },

  /**
   * Log data import
   */
  logImport: async (importType, recordCount) => {
    await logActivityToFirestore(ActivityTypes.IMPORT, {
      importType,
      recordCount,
      importTime: new Date().toISOString()
    });
  },

  /**
   * Log document signing
   */
  logSign: async (documentId, documentName) => {
    await logActivityToFirestore(ActivityTypes.SIGN, {
      documentId,
      documentName,
      signTime: new Date().toISOString()
    });
  },

  /**
   * Log access to admin features
   */
  logAdminAccess: async () => {
    await logActivityToFirestore(ActivityTypes.ACCESS_ADMIN, {
      accessTime: new Date().toISOString()
    });
  },

  /**
   * Log email sharing of proposals
   */
  logEmailShare: async (proposalName, recipientEmail, recipientName = null) => {
    await logActivityToFirestore(ActivityTypes.EMAIL_SHARE, {
      proposalName,
      recipientEmail,
      recipientName,
      shareTime: new Date().toISOString()
    });
  },

  /**
   * Log profile updates
   */
  logProfileUpdate: async (updatedFields = []) => {
    await logActivityToFirestore(ActivityTypes.PROFILE_UPDATE, {
      updatedFields,
      updateTime: new Date().toISOString()
    });
  }
};

/**
 * Export the log function for direct use if needed
 */
export const logUserActivity = logActivityToFirestore;
