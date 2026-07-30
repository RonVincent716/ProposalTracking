// src/Components/AdminDiscussionDashboard.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MdClose,
  MdRefresh,
  MdCheckCircle,
  MdArrowBack,
  MdDoneAll,
  MdPerson,
  MdEmail,
  MdChat,
  MdMessage,
  MdNotificationsNone,
  MdNotifications,
  MdCheck,
  MdSearch,
  MdDescription,
  MdClear,
  MdMarkChatRead,
  MdMarkChatUnread,
  MdVisibility,
  MdVisibilityOff,
  MdFilterList,
  MdSort,
  MdMoreVert,
  MdStar,
  MdStarBorder,
  MdArchive,
  MdDeleteOutline,
  MdLabel
} from 'react-icons/md';
import { db } from '../firebase';
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  addDoc,
  setDoc,
  getDoc,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import DiscussionThread from './DiscussionThread';
import AssessmentDraftsPanel from './AssessmentDraftsPanel';
import AssessmentDraftEditor from './AssessmentDraftEditor';
import './AdminDiscussionDashboard.css';

const SEEN_STORAGE_KEY_PREFIX = 'admin-discussion-seen:';

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

const AdminDiscussionDashboard = ({ userId, userEmail, userRole, initialTab = 'discussions', onClose, onDiscussionSeen }) => {
  const [activeTab, setActiveTab] = useState(initialTab); // discussions, drafts
  const [selectedFilter, setSelectedFilter] = useState('open');
  const [allProposalDiscussions, setAllProposalDiscussions] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(null);
  const [discussionMessages, setDiscussionMessages] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredDiscussion, setHoveredDiscussion] = useState(null);
  const [showReadStatus, setShowReadStatus] = useState(true);
  const [sortBy, setSortBy] = useState('latest');
  const [showFilters, setShowFilters] = useState(false);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [signedProposals, setSignedProposals] = useState([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [lastSeenByDiscussion, setLastSeenByDiscussion] = useState(() => {
    try {
      const raw = localStorage.getItem(`${SEEN_STORAGE_KEY_PREFIX}${userId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [readNotificationKeys, setReadNotificationKeys] = useState(new Set());
  const [starredDiscussions, setStarredDiscussions] = useState(() => {
    try {
      const saved = localStorage.getItem(`starred-discussions-${userId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const notificationRef = useRef(null);
  const hasBootstrappedMessagesRef = useRef(false);
  const hasBootstrappedSignedRef = useRef(false);
  const knownNotificationKeysRef = useRef(new Set());
  const lastSeenRef = useRef(lastSeenByDiscussion);

  const isAdminUser = userRole === 'admin' || userRole === 'superadmin';
  const effectiveError = !isAdminUser ? 'Only admins can access this dashboard' : error;

  // Save starred discussions to localStorage
  useEffect(() => {
    localStorage.setItem(`starred-discussions-${userId}`, JSON.stringify([...starredDiscussions]));
  }, [starredDiscussions, userId]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Load read notification keys from Firestore
  useEffect(() => {
    if (!isAdminUser || !userId) return;

    const loadReadNotifications = async () => {
      try {
        const docRef = doc(db, 'adminNotificationPreferences', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().readNotificationKeys) {
          setReadNotificationKeys(new Set(docSnap.data().readNotificationKeys));
        }
      } catch (error) {
        console.error('Error loading read notifications:', error);
      }
    };

    loadReadNotifications();
  }, [isAdminUser, userId]);

  useEffect(() => {
    lastSeenRef.current = lastSeenByDiscussion;
    try {
      localStorage.setItem(
        `${SEEN_STORAGE_KEY_PREFIX}${userId}`,
        JSON.stringify(lastSeenByDiscussion)
      );
    } catch {
      // no-op if storage is unavailable
    }
  }, [lastSeenByDiscussion, userId]);

  const addNotification = useCallback((notification) => {
    const key =
      notification.key ||
      `${notification.type}-${notification.discussionId || ''}-${notification.messageId || ''}-${notification.email || ''}`;

    if (knownNotificationKeysRef.current.has(key)) return;
    knownNotificationKeysRef.current.add(key);

    const isAlreadyRead = readNotificationKeys.has(key);

    const notifWithId = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: notification.timestamp || new Date(),
      read: isAlreadyRead,
      key
    };

    setNotifications((prev) => [notifWithId, ...prev].slice(0, 60));
  }, [readNotificationKeys]);

  useEffect(() => {
    if (!isAdminUser) return;

    const discussionsQuery = query(collection(db, 'proposalDiscussions'));

    const unsubscribe = onSnapshot(
      discussionsQuery,
      (snapshot) => {
        const discussions = snapshot.docs
          .map((discussionDoc) => ({
            id: discussionDoc.id,
            ...discussionDoc.data(),
            createdAt: discussionDoc.data().createdAt?.toDate?.() || new Date(),
            resolvedAt: discussionDoc.data().resolvedAt?.toDate?.() || null,
            lastActivity:
              discussionDoc.data().lastActivity?.toDate?.() ||
              discussionDoc.data().createdAt?.toDate?.() ||
              new Date()
          }))
          .sort((a, b) => b.lastActivity - a.lastActivity);

        setAllProposalDiscussions(discussions);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading all discussions:', err);
        setError('Failed to load discussions');
        setLoading(false);
      }
    );

    return () => {
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch (err) {
        console.error('Error unsubscribing from discussions:', err);
      }
    };
  }, [isAdminUser]);

  useEffect(() => {
    if (!isAdminUser) return;

    const messagesQuery = query(
      collection(db, 'proposalDiscussionMessages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const byDiscussion = {};

        snapshot.docs.forEach((messageDoc) => {
          const raw = messageDoc.data();
          const message = {
            id: messageDoc.id,
            ...raw,
            timestamp: raw.timestamp?.toDate?.() || new Date()
          };

          if (!byDiscussion[message.discussionId]) {
            byDiscussion[message.discussionId] = [];
          }
          byDiscussion[message.discussionId].push(message);
        });

        setDiscussionMessages(byDiscussion);

        if (!hasBootstrappedMessagesRef.current) {
          const mergedSeen = { ...lastSeenRef.current };
          Object.entries(byDiscussion).forEach(([discussionId, messages]) => {
            if (!mergedSeen[discussionId]) {
              const latestClientMs = getLatestClientMessageMs(messages);
              if (latestClientMs) mergedSeen[discussionId] = latestClientMs;
            }
          });
          setLastSeenByDiscussion(mergedSeen);
          hasBootstrappedMessagesRef.current = true;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return;

          const raw = change.doc.data();
          if (!raw?.discussionId || raw.senderRole === 'admin') return;

          const messageMs = toMillis(raw.timestamp);
          const lastSeenMs = lastSeenRef.current[raw.discussionId] || 0;
          if (messageMs <= lastSeenMs) return;

          addNotification({
            type: 'chat',
            key: `chat-${change.doc.id}`,
            title: 'New client message',
            message: `New message in ${raw.proposalName || 'a discussion'}`,
            email: raw.senderEmail,
            discussionId: raw.discussionId,
            messageId: change.doc.id,
            timestamp: messageMs ? new Date(messageMs) : new Date()
          });
        });
      },
      (err) => {
        console.error('Error loading discussion messages:', err);
      }
    );

    return () => {
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch (err) {
        console.error('Error unsubscribing from messages:', err);
      }
    };
  }, [isAdminUser, addNotification]);

  useEffect(() => {
    if (!isAdminUser) return;

    const signedQuery = query(collection(db, 'signedProposals'), orderBy('signedAt', 'desc'));

    const unsubscribe = onSnapshot(
      signedQuery,
      (snapshot) => {
        const proposals = snapshot.docs.map((signedDoc) => ({
          id: signedDoc.id,
          ...signedDoc.data(),
          signedDate: signedDoc.data().signedAt?.toDate?.() || new Date()
        }));

        setSignedProposals(proposals);

        if (!hasBootstrappedSignedRef.current) {
          hasBootstrappedSignedRef.current = true;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const signedData = change.doc.data();

          addNotification({
            type: 'signed',
            key: `signed-${change.doc.id}`,
            title: 'Proposal signed',
            message: `${signedData.proposalName || 'A proposal'} was signed`,
            email: signedData.signerEmail || signedData.clientEmail,
            proposalId: change.doc.id,
            timestamp: signedData.signedAt?.toDate?.() || new Date()
          });
        });
      },
      (err) => {
        console.error('Error loading signed proposals:', err);
      }
    );

    return () => {
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch (err) {
        console.error('Error unsubscribing from signed proposals:', err);
      }
    };
  }, [isAdminUser, addNotification]);

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

    return undefined;
  }, [showNotifications]);

  const toggleStarred = (discussionId, e) => {
    e.stopPropagation();
    setStarredDiscussions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(discussionId)) {
        newSet.delete(discussionId);
      } else {
        newSet.add(discussionId);
      }
      return newSet;
    });
  };

  const markDiscussionAsSeen = useCallback(
    async (discussionId) => {
      if (!discussionId) return;
      const latestClientMs = getLatestClientMessageMs(discussionMessages[discussionId] || []);
      if (!latestClientMs) return;

      setLastSeenByDiscussion((prev) => ({
        ...prev,
        [discussionId]: latestClientMs
      }));

      if (onDiscussionSeen) {
        onDiscussionSeen(discussionId, latestClientMs);
      }

      const discussionNotifications = notifications.filter((n) => n.discussionId === discussionId);
      
      setNotifications((prev) =>
        prev.map((n) =>
          n.discussionId === discussionId ? { ...n, read: true } : n
        )
      );

      if (discussionNotifications.some((n) => !n.read)) {
        try {
          const newReadKeys = new Set(readNotificationKeys);
          discussionNotifications.forEach((n) => newReadKeys.add(n.key));
          setReadNotificationKeys(newReadKeys);

          const docRef = doc(db, 'adminNotificationPreferences', userId);
          await setDoc(
            docRef,
            {
              readNotificationKeys: Array.from(newReadKeys),
              lastUpdated: serverTimestamp()
            },
            { merge: true }
          );
        } catch (error) {
          console.error('Error persisting read notifications:', error);
        }
      }
    },
    [discussionMessages, notifications, readNotificationKeys, userId, onDiscussionSeen]
  );

  const markNotificationAsRead = async (id) => {
    const notification = notifications.find((n) => n.id === id);
    if (!notification || notification.read) return;

    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read: true } : n)
    );

    try {
      const newReadKeys = new Set(readNotificationKeys);
      newReadKeys.add(notification.key);
      setReadNotificationKeys(newReadKeys);

      const docRef = doc(db, 'adminNotificationPreferences', userId);
      await setDoc(
        docRef,
        {
          readNotificationKeys: Array.from(newReadKeys),
          lastUpdated: serverTimestamp()
        },
        { merge: true }
      );
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
      const newReadKeys = new Set(readNotificationKeys);
      unreadNotifications.forEach((n) => {
        if (n.key) newReadKeys.add(n.key);
      });
      setReadNotificationKeys(newReadKeys);

      const docRef = doc(db, 'adminNotificationPreferences', userId);
      await setDoc(
        docRef,
        {
          readNotificationKeys: Array.from(newReadKeys),
          lastUpdated: serverTimestamp()
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const clearNotification = async (id) => {
    const notification = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    if (notification && !notification.read) {
      try {
        const newReadKeys = new Set(readNotificationKeys);
        newReadKeys.add(notification.key);
        setReadNotificationKeys(newReadKeys);

        const docRef = doc(db, 'adminNotificationPreferences', userId);
        await setDoc(
          docRef,
          {
            readNotificationKeys: Array.from(newReadKeys),
            lastUpdated: serverTimestamp()
          },
          { merge: true }
        );
      } catch (error) {
        console.error('Error clearing notification:', error);
      }
    }
  };

  const clearAllNotifications = async () => {
    const unreadNotifications = notifications.filter((n) => !n.read);
    
    if (unreadNotifications.length > 0) {
      try {
        const newReadKeys = new Set(readNotificationKeys);
        unreadNotifications.forEach((n) => newReadKeys.add(n.key));
        setReadNotificationKeys(newReadKeys);

        const docRef = doc(db, 'adminNotificationPreferences', userId);
        await setDoc(
          docRef,
          {
            readNotificationKeys: Array.from(newReadKeys),
            lastUpdated: serverTimestamp()
          },
          { merge: true }
        );
      } catch (error) {
        console.error('Error clearing all notifications:', error);
      }
    }

    setNotifications([]);
    knownNotificationKeysRef.current.clear();
  };

  const handleAddMessage = async (discussionId, messageText) => {
    try {
      await addDoc(collection(db, 'proposalDiscussionMessages'), {
        discussionId,
        senderId: userId,
        senderEmail: userEmail,
        senderName: userEmail?.split('@')[0] || 'Admin',
        senderRole: 'admin',
        message: messageText,
        timestamp: serverTimestamp(),
        isRead: false
      });

      const currentCount = (discussionMessages[discussionId]?.length || 0) + 1;
      await updateDoc(doc(db, 'proposalDiscussions', discussionId), {
        messageCount: currentCount,
        lastActivity: serverTimestamp()
      });
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message');
    }
  };

  const handleResolveDiscussion = async (discussionId) => {
    try {
      await updateDoc(doc(db, 'proposalDiscussions', discussionId), {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: userId
      });
      setSelectedDiscussionId(null);
    } catch (err) {
      console.error('Error resolving discussion:', err);
      alert('Failed to resolve discussion');
    }
  };

  const discussionsWithMessageState = useMemo(
    () =>
      allProposalDiscussions.map((discussion) => {
        const messages = discussionMessages[discussion.id] || [];
        const seenMs = lastSeenByDiscussion[discussion.id] || 0;
        const unreadCount = getUnreadCount(messages, seenMs);
        const latestMessage = messages.length ? messages[messages.length - 1] : null;
        
        const totalClientMessages = messages.filter(m => m.senderRole !== 'admin').length;
        const readMessages = totalClientMessages - unreadCount;
        const readPercentage = totalClientMessages > 0 ? (readMessages / totalClientMessages) * 100 : 100;

        return {
          ...discussion,
          unreadCount,
          latestMessage,
          readPercentage,
          totalClientMessages,
          isStarred: starredDiscussions.has(discussion.id)
        };
      }),
    [allProposalDiscussions, discussionMessages, lastSeenByDiscussion, starredDiscussions]
  );

  const filteredDiscussions = useMemo(() => {
    let filtered = [...discussionsWithMessageState];
    
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (normalizedSearch) {
      filtered = filtered.filter((discussion) =>
        discussion.proposalName?.toLowerCase().includes(normalizedSearch) ||
        discussion.clientEmail?.toLowerCase().includes(normalizedSearch) ||
        discussion.highlightedText?.toLowerCase().includes(normalizedSearch) ||
        discussion.latestMessage?.message?.toLowerCase().includes(normalizedSearch)
      );
    }
    
    if (selectedFilter !== 'all') {
      filtered = filtered.filter((discussion) => discussion.status === selectedFilter);
    }
    
    filtered.sort((a, b) => {
      if (sortBy === 'latest') {
        return b.lastActivity - a.lastActivity;
      } else if (sortBy === 'oldest') {
        return a.lastActivity - b.lastActivity;
      } else if (sortBy === 'unread') {
        return b.unreadCount - a.unreadCount;
      } else if (sortBy === 'starred') {
        return (b.isStarred ? 1 : 0) - (a.isStarred ? 1 : 0);
      }
      return 0;
    });
    
    return filtered;
  }, [discussionsWithMessageState, searchTerm, selectedFilter, sortBy]);

  const unresolvedCount = discussionsWithMessageState.filter((d) => d.status === 'open').length;
  const newClientMessageCount = discussionsWithMessageState.reduce(
    (count, discussion) => count + discussion.unreadCount,
    0
  );
  const unreadNotificationCount = notifications.filter((n) => !n.read).length;
  const bellBadgeCount = Math.max(unreadNotificationCount, newClientMessageCount);
  const selectedDiscussion = discussionsWithMessageState.find((d) => d.id === selectedDiscussionId);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleSelectDiscussion = (discussionId) => {
    setSelectedDiscussionId(discussionId);
    markDiscussionAsSeen(discussionId);
  };

  const getTimeAgo = (date) => {
    const timestamp = toMillis(date);
    if (!timestamp) return 'just now';

    const seconds = Math.floor(((nowMs || timestamp) - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getReadStatusIcon = (discussion) => {
    if (discussion.unreadCount === 0) {
      return <MdMarkChatRead size={14} color="#10B981" />;
    }
    return <MdMarkChatUnread size={14} color="#EF4444" />;
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div className="header-left">
          <div className="logo-icon">
            <MdChat size={22} />
          </div>
          <div>
            <div className="title">Messaging</div>
            <div className="subtitle">Proposal discussions</div>
          </div>
        </div>

        <div className="header-actions">
          {unresolvedCount > 0 && (
            <div className="stat-badge open-badge">
              <span className="badge-dot"></span>
              <span>{unresolvedCount} Open</span>
            </div>
          )}

          {newClientMessageCount > 0 && (
            <div className="stat-badge unread-badge">
              <MdMessage size={14} />
              <span>{newClientMessageCount} Unread</span>
            </div>
          )}

          <div className="notification-container" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications((prev) => !prev)}
              className="icon-button notification-button"
            >
              {bellBadgeCount > 0 ? (
                <>
                  <MdNotifications size={20} />
                  <span className="notification-badge">{bellBadgeCount > 9 ? '9+' : bellBadgeCount}</span>
                </>
              ) : (
                <MdNotificationsNone size={20} />
              )}
            </button>

            {showNotifications && (
              <div className="notification-panel">
                <div className="notification-header">
                  <span className="notification-title">Notifications</span>
                  <div className="notification-actions">
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="mark-read-btn"
                      disabled={unreadNotificationCount === 0}
                    >
                      <MdDoneAll size={16} />
                      Mark all read
                    </button>
                    <button
                      onClick={clearAllNotifications}
                      className="clear-all-btn"
                      disabled={notifications.length === 0}
                    >
                      <MdClear size={16} />
                      Clear all
                    </button>
                  </div>
                </div>

                {notifications.length === 0 ? (
                  <div className="empty-notifications">
                    <MdNotificationsNone size={40} color="#CBD5E1" />
                    <div>All caught up!</div>
                  </div>
                ) : (
                  <div className="notification-list">
                    {notifications.slice(0, 10).map((notification) => (
                      <div
                        key={notification.id}
                        className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                        onClick={async () => {
                          await markNotificationAsRead(notification.id);
                          if (notification.discussionId) {
                            handleSelectDiscussion(notification.discussionId);
                          }
                        }}
                      >
                        <div className="notification-icon">
                          {notification.type === 'chat' ? (
                            <MdMessage size={16} />
                          ) : (
                            <MdCheckCircle size={16} />
                          )}
                        </div>
                        <div className="notification-content">
                          <div className="notification-title-text">{notification.title}</div>
                          <div className="notification-message">{notification.message}</div>
                          <div className="notification-time">{getTimeAgo(notification.timestamp)}</div>
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await clearNotification(notification.id);
                          }}
                          className="notification-dismiss"
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

          <button onClick={handleRefresh} className="icon-button" disabled={refreshing}>
            <MdRefresh size={20} className={refreshing ? 'spinning' : ''} />
          </button>

          <button onClick={onClose} className="icon-button close-button">
            <MdClose size={20} />
          </button>
        </div>
      </div>

      <div className="search-section">
        <div className="search-bar">
          <MdSearch size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search discussions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="clear-search">
              ×
            </button>
          )}
        </div>

        <button onClick={() => setShowFilters(!showFilters)} className="filter-toggle">
          <MdFilterList size={18} />
          <span>Filters</span>
        </button>
      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filter-group">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
              <option value="latest">Latest first</option>
              <option value="oldest">Oldest first</option>
              <option value="unread">Most unread</option>
              <option value="starred">Starred first</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Show read status:</label>
            <button onClick={() => setShowReadStatus(!showReadStatus)} className="status-toggle">
              {showReadStatus ? <MdVisibility size={16} /> : <MdVisibilityOff size={16} />}
              <span>{showReadStatus ? 'Hide' : 'Show'} read status</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div style={styles.mainTabs}>
        <button
          style={{
            ...styles.mainTab,
            ...(activeTab === 'discussions' ? styles.mainTabActive : styles.mainTabInactive)
          }}
          onClick={() => {
            setActiveTab('discussions');
            setSelectedDraftId(null);
          }}
        >
          <MdChat size={18} />
          Discussions
        </button>
        <button
          style={{
            ...styles.mainTab,
            ...(activeTab === 'drafts' ? styles.mainTabActive : styles.mainTabInactive)
          }}
          onClick={() => {
            setActiveTab('drafts');
            setSelectedDiscussionId(null);
          }}
        >
          <MdDescription size={18} />
          Assessment Drafts
        </button>
      </div>

      {/* Drafts Tab */}
      {activeTab === 'drafts' && !selectedDraftId && (
        <AssessmentDraftsPanel
          adminUserId={userId}
          adminEmail={userEmail}
          onSelectDraft={setSelectedDraftId}
          onPublishDraft={(draftId) => {
            setSelectedDraftId(null);
          }}
        />
      )}

      {activeTab === 'drafts' && selectedDraftId && (
        <AssessmentDraftEditor
          draftId={selectedDraftId}
          adminUserId={userId}
          adminEmail={userEmail}
          onBack={() => setSelectedDraftId(null)}
          onPublish={() => setSelectedDraftId(null)}
        />
      )}

      {/* Discussions Tab */}
      {activeTab === 'discussions' && (
        <>
          <div className="filter-tabs">
            <button
              onClick={() => setSelectedFilter('open')}
              className={`filter-tab ${selectedFilter === 'open' ? 'active' : ''}`}
            >
              <span className="tab-dot open"></span>
              Open
              <span className="tab-count">{discussionsWithMessageState.filter(d => d.status === 'open').length}</span>
            </button>
            <button
              onClick={() => setSelectedFilter('resolved')}
              className={`filter-tab ${selectedFilter === 'resolved' ? 'active' : ''}`}
            >
              <MdCheckCircle size={12} />
              Resolved
              <span className="tab-count">{discussionsWithMessageState.filter(d => d.status === 'resolved').length}</span>
            </button>
            <button
              onClick={() => setSelectedFilter('all')}
              className={`filter-tab ${selectedFilter === 'all' ? 'active' : ''}`}
            >
              <MdMessage size={12} />
              All
              <span className="tab-count">{discussionsWithMessageState.length}</span>
            </button>
          </div>

          <div className={`discussions-content split-layout ${selectedDiscussion ? 'has-chat' : 'no-chat'}`}>
        <div className="discussions-list-column">
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <div>Loading discussions...</div>
          </div>
        )}

        {effectiveError && (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <div>{effectiveError}</div>
          </div>
        )}

        {!loading && !effectiveError && filteredDiscussions.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-title">No discussions found</div>
            <div className="empty-text">
              {searchTerm ? 'Try a different search term' : 'Client comments will appear here'}
            </div>
          </div>
        )}

        {!loading && !effectiveError && filteredDiscussions.length > 0 && (
          <div className="discussions-list">
            {filteredDiscussions.map((discussion) => (
              <div
                key={discussion.id}
                className={`discussion-card ${discussion.unreadCount > 0 ? 'unread' : ''} ${selectedDiscussionId === discussion.id ? 'active' : ''} ${hoveredDiscussion === discussion.id ? 'hovered' : ''}`}
                onClick={() => handleSelectDiscussion(discussion.id)}
                onMouseEnter={() => setHoveredDiscussion(discussion.id)}
                onMouseLeave={() => setHoveredDiscussion(null)}
              >
                <div className="card-header">
                  <div className="proposal-info">
                    <div className="proposal-icon">
                      <MdDescription size={16} />
                    </div>
                    <div className="proposal-details">
                      <div className="proposal-name">{discussion.proposalName}</div>
                      <div className="page-info">Page {discussion.pageNumber}</div>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button
                      onClick={(e) => toggleStarred(discussion.id, e)}
                      className="star-button"
                      title={discussion.isStarred ? 'Remove from starred' : 'Add to starred'}
                    >
                      {discussion.isStarred ? <MdStar size={16} color="#F59E0B" /> : <MdStarBorder size={16} />}
                    </button>
                    {discussion.status === 'resolved' ? (
                      <span className="status-badge resolved">
                        <MdCheckCircle size={12} />
                        Resolved
                      </span>
                    ) : (
                      <span className="status-badge open">
                        <span className="pulse-dot"></span>
                        Open
                      </span>
                    )}
                  </div>
                </div>

                <div className="highlight-text">
                  "{discussion.highlightedText?.substring(0, 100)}
                  {discussion.highlightedText?.length > 100 ? '...' : ''}"
                </div>

                {discussion.latestMessage?.message && (
                  <div className="latest-message">
                    <MdMessage size={12} className="message-icon" />
                    <span>{discussion.latestMessage.message.substring(0, 80)}</span>
                  </div>
                )}

                <div className="card-footer">
                  <div className="client-info">
                    <MdPerson size={12} />
                    <span>{discussion.clientEmail?.split('@')[0] || 'Client'}</span>
                  </div>
                  <div className="message-stats">
                    <MdChat size={12} />
                    <span>{discussion.messageCount || 0} messages</span>
                    <span className="time-ago">{getTimeAgo(discussion.lastActivity)}</span>
                  </div>
                </div>

                {showReadStatus && (
                  <div className="read-status">
                    <div className="read-status-header">
                      <div className="read-status-label">
                        {getReadStatusIcon(discussion)}
                        <span>
                          {discussion.unreadCount === 0 
                            ? 'All messages read' 
                            : `${discussion.unreadCount} unread`}
                        </span>
                      </div>
                      {discussion.totalClientMessages > 0 && (
                        <span className="read-percentage">{Math.round(discussion.readPercentage)}%</span>
                      )}
                    </div>
                    <div className="progress-bar">
                      <div 
                        className={`progress-fill ${discussion.readPercentage === 100 ? 'complete' : discussion.readPercentage > 0 ? 'partial' : 'empty'}`}
                        style={{ width: `${discussion.readPercentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {discussion.unreadCount > 0 && (
                  <div className="unread-badge">
                    <div className="unread-dot"></div>
                    <span>{discussion.unreadCount}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>

        <div className="discussion-chat-column">
          {selectedDiscussion ? (
            <div className="chat-panel">
              <div className="chat-panel-header">
                <div className="chat-panel-title-group">
                  <div className="chat-panel-title">{selectedDiscussion.proposalName}</div>
                  <div className="chat-panel-meta">
                    <span>Page {selectedDiscussion.pageNumber}</span>
                    <span>{selectedDiscussion.clientEmail}</span>
                  </div>
                </div>
                <div className="chat-panel-actions">
                  {selectedDiscussion.status === 'open' && (
                    <button onClick={() => handleResolveDiscussion(selectedDiscussion.id)} className="chat-resolve-button">
                      <MdDoneAll size={15} />
                      <span>Resolve</span>
                    </button>
                  )}
                  <button onClick={() => setSelectedDiscussionId(null)} className="chat-panel-close" title="Close chat panel">
                    <MdClose size={22} />
                  </button>
                </div>
              </div>

              <DiscussionThread
                discussion={selectedDiscussion}
                messages={discussionMessages[selectedDiscussionId] || []}
                onAddMessage={handleAddMessage}
                onResolve={handleResolveDiscussion}
                userRole={userRole}
                userId={userId}
                forceExpanded
              />
            </div>
          ) : (
            <div className="chat-panel empty-chat-panel">
              <div className="empty-icon">💬</div>
              <div className="empty-title">Pick a conversation</div>
              <div className="empty-text">Select a thread on the left to open the chat panel.</div>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};

// Styles for main tabs
const styles = {
  mainTabs: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc'
  },
  mainTab: {
    padding: '8px 16px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s'
  },
  mainTabActive: {
    backgroundColor: '#0ea5e9',
    color: '#ffffff',
    borderColor: '#0ea5e9'
  },
  mainTabInactive: {
    backgroundColor: '#ffffff',
    color: '#64748b',
    borderColor: '#e2e8f0'
  }
};

export default AdminDiscussionDashboard;
