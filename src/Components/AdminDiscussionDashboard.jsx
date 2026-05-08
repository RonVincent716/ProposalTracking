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
  MdVisibilityOff
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

const AdminDiscussionDashboard = ({ userId, userEmail, userRole, onClose, onDiscussionSeen }) => {
  const [selectedFilter, setSelectedFilter] = useState('open');
  const [allProposalDiscussions, setAllProposalDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState(null);
  const [discussionMessages, setDiscussionMessages] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredDiscussion, setHoveredDiscussion] = useState(null);
  const [showReadStatus, setShowReadStatus] = useState(true);

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

  const notificationRef = useRef(null);
  const hasBootstrappedMessagesRef = useRef(false);
  const hasBootstrappedSignedRef = useRef(false);
  const knownNotificationKeysRef = useRef(new Set());
  const lastSeenRef = useRef(lastSeenByDiscussion);

  const isAdminUser = userRole === 'admin' || userRole === 'superadmin';
  const effectiveError = !isAdminUser ? 'Only admins can access this dashboard' : error;

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

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

    // Check if this notification key has been previously read
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

    return () => unsubscribe?.();
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

    return () => unsubscribe?.();
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

    return () => unsubscribe?.();
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

  const markDiscussionAsSeen = useCallback(
    async (discussionId) => {
      if (!discussionId) return;
      const latestClientMs = getLatestClientMessageMs(discussionMessages[discussionId] || []);
      if (!latestClientMs) return;

      setLastSeenByDiscussion((prev) => ({
        ...prev,
        [discussionId]: latestClientMs
      }));

      // Notify parent component of discussion being seen
      if (onDiscussionSeen) {
        onDiscussionSeen(discussionId, latestClientMs);
      }

      // Mark all chat notifications for this discussion as read
      const discussionNotifications = notifications.filter((n) => n.discussionId === discussionId);
      
      setNotifications((prev) =>
        prev.map((n) =>
          n.discussionId === discussionId
            ? {
                ...n,
                read: true
              }
            : n
        )
      );

      // Persist read status for discussion notifications
      if (discussionNotifications.some((n) => !n.read)) {
        try {
          const newReadKeys = new Set(readNotificationKeys);
          discussionNotifications.forEach((n) => {
            newReadKeys.add(n.key);
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
          console.error('Error persisting read notifications:', error);
        }
      }
    },
    [discussionMessages, notifications, readNotificationKeys, userId, onDiscussionSeen]
  );

  const markNotificationAsRead = async (id) => {
    const notification = notifications.find((n) => n.id === id);
    if (!notification || notification.read) return;

    // Update local state
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              read: true
            }
          : n
      )
    );

    // Persist to Firestore
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

  const clearNotification = async (id) => {
    const notification = notifications.find((n) => n.id === id);
    
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    // Also mark as read when clearing
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
    // Mark all unread notifications as read
    const unreadNotifications = notifications.filter((n) => !n.read);
    
    if (unreadNotifications.length > 0) {
      try {
        const newReadKeys = new Set(readNotificationKeys);
        unreadNotifications.forEach((n) => {
          newReadKeys.add(n.key);
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
        
        // Calculate read percentage
        const totalClientMessages = messages.filter(m => m.senderRole !== 'admin').length;
        const readMessages = totalClientMessages - unreadCount;
        const readPercentage = totalClientMessages > 0 ? (readMessages / totalClientMessages) * 100 : 100;

        return {
          ...discussion,
          unreadCount,
          latestMessage,
          readPercentage,
          totalClientMessages
        };
      }),
    [allProposalDiscussions, discussionMessages, lastSeenByDiscussion]
  );

  const filteredDiscussions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return discussionsWithMessageState.filter((discussion) => {
      const matchesFilter = selectedFilter === 'all' ? true : discussion.status === selectedFilter;
      const matchesSearch =
        normalizedSearch === '' ||
        discussion.proposalName?.toLowerCase().includes(normalizedSearch) ||
        discussion.clientEmail?.toLowerCase().includes(normalizedSearch) ||
        discussion.highlightedText?.toLowerCase().includes(normalizedSearch) ||
        discussion.latestMessage?.message?.toLowerCase().includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [discussionsWithMessageState, selectedFilter, searchTerm]);

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

  if (selectedDiscussionId && selectedDiscussion) {
    return (
      <div style={styles.container}>
        <div style={styles.detailView}>
          <div style={styles.detailHeader}>
            <button
              onClick={() => setSelectedDiscussionId(null)}
              style={styles.backButton}
              title="Back to list"
            >
              <MdArrowBack size={20} />
            </button>
            <div style={styles.detailInfo}>
              <div style={styles.detailTitle}>{selectedDiscussion.proposalName}</div>
              <div style={styles.detailMeta}>
                <span style={styles.detailPage}>Page {selectedDiscussion.pageNumber}</span>
                <span style={styles.detailEmail}>{selectedDiscussion.clientEmail}</span>
              </div>
            </div>
            {selectedDiscussion.status === 'open' && (
              <button
                onClick={() => handleResolveDiscussion(selectedDiscussion.id)}
                style={styles.resolveButton}
              >
                <MdDoneAll size={16} />
                Mark Resolved
              </button>
            )}
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
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoIcon}>
            <MdChat size={22} />
          </div>
          <div>
            <div style={styles.title}>Discussion Center</div>
            <div style={styles.subtitle}>Friendly chat workspace for client comments</div>
          </div>
        </div>

        <div style={styles.headerActions}>
          {unresolvedCount > 0 && (
            <div style={styles.unresolvedBadge}>
              <MdNotificationsNone size={14} />
              <span>{unresolvedCount} open</span>
            </div>
          )}

          {newClientMessageCount > 0 && (
            <div style={styles.newMessageBadge}>
              <MdMessage size={14} />
              <span>{newClientMessageCount} new</span>
            </div>
          )}

          <button
            onClick={() => setShowReadStatus(!showReadStatus)}
            style={styles.iconButton}
            title={showReadStatus ? "Hide read status" : "Show read status"}
          >
            {showReadStatus ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />}
          </button>

          <div style={styles.notificationContainer} ref={notificationRef}>
            <button
              onClick={() => setShowNotifications((prev) => !prev)}
              style={{ ...styles.iconButton, position: 'relative' }}
              title="Notifications"
            >
              {bellBadgeCount > 0 ? (
                <MdNotifications size={20} color="#F59E0B" />
              ) : (
                <MdNotificationsNone size={20} />
              )}
              {bellBadgeCount > 0 && <span style={styles.notificationBadge}>{bellBadgeCount}</span>}
            </button>

            {showNotifications && (
              <div style={styles.notificationPanel}>
                <div style={styles.notificationHeader}>
                  <span style={styles.notificationTitle}>Notifications</span>
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAllNotifications}
                      style={styles.clearAllButton}
                      title="Clear all"
                    >
                      <MdClear size={16} />
                    </button>
                  )}
                </div>

                {notifications.length === 0 && signedProposals.length === 0 ? (
                  <div style={styles.emptyNotifications}>
                    <MdNotificationsNone size={32} color="#94A3B8" />
                    <div>All caught up.</div>
                  </div>
                ) : (
                  <div style={styles.notificationList}>
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        style={{
                          ...styles.notificationItem,
                          ...(notification.read ? styles.notificationItemRead : {})
                        }}
                        onClick={async () => {
                          await markNotificationAsRead(notification.id);
                          if (notification.discussionId) {
                            handleSelectDiscussion(notification.discussionId);
                          }
                        }}
                      >
                        <div style={styles.notificationIcon}>
                          {notification.type === 'chat' ? (
                            <MdMessage size={16} color="#00D4FF" />
                          ) : notification.type === 'signed' ? (
                            <MdCheckCircle size={16} color="#10B981" />
                          ) : (
                            <MdCheck size={16} color="#3B82F6" />
                          )}
                        </div>
                        <div style={styles.notificationContent}>
                          <div style={styles.notificationItemTitle}>{notification.title}</div>
                          <div style={styles.notificationItemMessage}>{notification.message}</div>
                          {notification.email && <div style={styles.notificationEmail}>{notification.email}</div>}
                          <div style={styles.notificationTime}>{getTimeAgo(notification.timestamp)}</div>
                        </div>
                        <button
                          onClick={async (event) => {
                            event.stopPropagation();
                            await clearNotification(notification.id);
                          }}
                          style={styles.notificationClose}
                          title="Dismiss"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {signedProposals.length > 0 && (
                      <div style={styles.notificationSection}>
                        <div style={styles.notificationSectionTitle}>
                          <MdCheckCircle size={14} color="#10B981" />
                          Recently Signed Proposals ({signedProposals.length})
                        </div>
                        {signedProposals.slice(0, 3).map((proposal) => (
                          <div key={proposal.id} style={styles.signedProposalItem}>
                            <div style={styles.signedProposalName}>{proposal.proposalName}</div>
                            <div style={styles.signedProposalMeta}>
                              <span>{proposal.signerEmail || proposal.clientEmail}</span>
                              <span>{getTimeAgo(proposal.signedDate)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleRefresh}
            style={styles.iconButton}
            title="Refresh"
            disabled={refreshing}
          >
            <MdRefresh size={20} style={{ animation: refreshing ? 'spin 0.6s linear infinite' : 'none' }} />
          </button>

          <button onClick={onClose} style={styles.iconButton} title="Close">
            <MdClose size={20} />
          </button>
        </div>
      </div>

      <div style={styles.searchContainer}>
        <MdSearch size={18} color="#94A3B8" />
        <input
          type="text"
          placeholder="Search by proposal, client, or message..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          style={styles.searchInput}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} style={styles.clearSearch}>
            ×
          </button>
        )}
      </div>

      <div style={styles.filterTabs}>
        {[
          {
            key: 'open',
            label: 'Open',
            icon: <MdChat size={14} />,
            count: discussionsWithMessageState.filter((discussion) => discussion.status === 'open').length
          },
          {
            key: 'resolved',
            label: 'Resolved',
            icon: <MdCheckCircle size={14} />,
            count: discussionsWithMessageState.filter((discussion) => discussion.status === 'resolved').length
          },
          {
            key: 'all',
            label: 'All',
            icon: <MdMessage size={14} />,
            count: discussionsWithMessageState.length
          }
        ].map((filter) => (
          <button
            key={filter.key}
            onClick={() => setSelectedFilter(filter.key)}
            style={{
              ...styles.filterTab,
              ...(selectedFilter === filter.key ? styles.filterTabActive : {})
            }}
          >
            {filter.icon}
            {filter.label}
            {filter.count > 0 && (
              <span
                style={{
                  ...styles.filterCount,
                  ...(selectedFilter === filter.key ? styles.filterCountActive : {})
                }}
              >
                {filter.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {loading && (
          <div style={styles.centerMessage}>
            <div style={styles.spinner} />
            <div>Loading discussions...</div>
          </div>
        )}

        {effectiveError && (
          <div style={styles.errorMessage}>
            <div style={styles.errorIcon}>!</div>
            <div>{effectiveError}</div>
          </div>
        )}

        {!loading && !effectiveError && filteredDiscussions.length === 0 && (
          <div style={styles.centerMessage}>
            <div style={styles.emptyIcon}>Chat</div>
            <div style={styles.emptyTitle}>No discussions found</div>
            <div style={styles.emptyText}>
              {searchTerm ? 'Try a different search term' : 'Client comments will appear here'}
            </div>
          </div>
        )}

        {!loading && !effectiveError && filteredDiscussions.length > 0 && (
          <div style={styles.discussionList}>
            {filteredDiscussions.map((discussion) => (
              <div
                key={discussion.id}
                style={{
                  ...styles.discussionCard,
                  ...(selectedDiscussionId === discussion.id ? styles.discussionCardActive : {}),
                  ...(hoveredDiscussion === discussion.id ? styles.discussionCardHover : {}),
                  ...(discussion.unreadCount > 0 && styles.discussionCardUnread)
                }}
                onClick={() => handleSelectDiscussion(discussion.id)}
                onMouseEnter={() => setHoveredDiscussion(discussion.id)}
                onMouseLeave={() => setHoveredDiscussion(null)}
              >
                <div style={styles.cardHeader}>
                  <div style={styles.proposalInfo}>
                    <div 
                      style={{
                        ...styles.proposalIcon,
                        ...(discussion.unreadCount > 0 && styles.proposalIconUnread)
                      }}
                    >
                      <MdDescription size={16} />
                    </div>
                    <div style={styles.proposalTextContainer}>
                      <div style={styles.proposalName}>{discussion.proposalName}</div>
                      <div style={styles.pageInfo}>Page {discussion.pageNumber}</div>
                    </div>
                  </div>

                  {discussion.status === 'resolved' ? (
                    <span style={styles.resolvedBadge}>
                      <MdCheckCircle size={12} />
                      Resolved
                    </span>
                  ) : (
                    <span style={styles.openBadge}>
                      <span style={styles.openDot} />
                      Open
                    </span>
                  )}
                </div>

                <div style={styles.highlightPreview}>
                  "{discussion.highlightedText?.substring(0, 80)}
                  {discussion.highlightedText?.length > 80 ? '...' : ''}"
                </div>

                {discussion.latestMessage?.message && (
                  <div style={styles.latestMessagePreview}>
                    <MdMessage size={12} color="#64748B" />
                    <span>{discussion.latestMessage.message.substring(0, 80)}</span>
                  </div>
                )}

                <div style={styles.cardFooter}>
                  <div style={styles.clientInfo}>
                    <MdPerson size={12} color="#94A3B8" />
                    <span style={styles.clientName}>{discussion.clientEmail?.split('@')[0] || 'Client'}</span>
                  </div>
                  <div style={styles.clientEmailFull}>
                    <MdEmail size={12} color="#94A3B8" />
                    <span style={styles.clientEmailText}>{discussion.clientEmail}</span>
                  </div>
                  <div style={styles.messageStats}>
                    <MdChat size={12} />
                    <span>{discussion.messageCount || 0}</span>
                    <span style={styles.timeAgo}>{getTimeAgo(discussion.lastActivity)}</span>
                  </div>
                </div>

                {showReadStatus && (
                  <div style={styles.readStatusContainer}>
                    <div style={styles.readStatusHeader}>
                      <div style={styles.readStatusLabel}>
                        {getReadStatusIcon(discussion)}
                        <span style={styles.readStatusText}>
                          {discussion.unreadCount === 0 ? 'All messages read' : `${discussion.unreadCount} unread message${discussion.unreadCount > 1 ? 's' : ''}`}
                        </span>
                      </div>
                      {discussion.totalClientMessages > 0 && (
                        <span style={styles.readStatusPercentage}>
                          {Math.round(discussion.readPercentage)}% read
                        </span>
                      )}
                    </div>
                    <div style={styles.progressBarContainer}>
                      <div 
                        style={{
                          ...styles.progressBar,
                          width: `${discussion.readPercentage}%`,
                          ...(discussion.readPercentage === 100 
                            ? styles.progressBarComplete 
                            : discussion.readPercentage > 0 
                              ? styles.progressBarPartial 
                              : styles.progressBarEmpty)
                        }}
                      />
                    </div>
                  </div>
                )}

                {discussion.unreadCount > 0 && (
                  <div style={styles.unreadIndicator}>
                    <div style={styles.unreadDot} />
                    <span style={styles.unreadCount}>{discussion.unreadCount}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }

        ::-webkit-scrollbar {
          width: 6px;
        }

        ::-webkit-scrollbar-track {
          background: #F1F5F9;
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '480px',
    height: '100vh',
    background: '#FFFFFF',
    borderLeft: '1px solid #E2E8F0',
    boxShadow: '-8px 0 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    animation: 'slideIn 0.3s ease'
  },
  detailView: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  },
  detailHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #F1F5F9',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    background: '#FFFFFF',
    flexShrink: 0
  },
  backButton: {
    width: '36px',
    height: '36px',
    padding: 0,
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    cursor: 'pointer',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    ':hover': {
      background: '#F1F5F9',
      transform: 'scale(1.02)'
    }
  },
  detailInfo: {
    flex: 1,
    minWidth: 0
  },
  detailTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%'
  },
  detailMeta: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#64748B',
    flexWrap: 'wrap'
  },
  detailPage: {
    background: '#F1F5F9',
    padding: '2px 8px',
    borderRadius: '4px',
    flexShrink: 0
  },
  detailEmail: {
    color: '#64748B',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px'
  },
  resolveButton: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    border: 'none',
    borderRadius: '10px',
    color: '#FFFFFF',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    ':hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
    }
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #F1F5F9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#FFFFFF',
    flexShrink: 0
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0
  },
  logoIcon: {
    width: '40px',
    height: '40px',
    background: 'linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    flexShrink: 0
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: '-0.3px'
  },
  subtitle: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '2px'
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexShrink: 0
  },
  unresolvedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: '#FEF2F2',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#DC2626',
    whiteSpace: 'nowrap'
  },
  newMessageBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: '#EFF6FF',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#2563EB',
    whiteSpace: 'nowrap'
  },
  iconButton: {
    width: '36px',
    height: '36px',
    padding: 0,
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748B',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    ':hover': {
      background: '#F1F5F9',
      transform: 'scale(1.02)'
    }
  },
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '16px 20px',
    padding: '10px 14px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    transition: 'all 0.2s ease',
    flexShrink: 0,
    ':focus-within': {
      borderColor: '#00D4FF',
      boxShadow: '0 0 0 3px rgba(0,212,255,0.1)'
    }
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '13px',
    color: '#0F172A',
    minWidth: 0,
    '::placeholder': {
      color: '#94A3B8'
    }
  },
  clearSearch: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94A3B8',
    fontSize: '14px',
    padding: '2px',
    flexShrink: 0,
    textTransform: 'uppercase',
    ':hover': {
      color: '#64748B'
    }
  },
  filterTabs: {
    display: 'flex',
    gap: '8px',
    padding: '0 20px 16px 20px',
    borderBottom: '1px solid #F1F5F9',
    flexShrink: 0
  },
  filterTab: {
    flex: 1,
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    ':hover': {
      background: '#F8FAFC',
      borderColor: '#CBD5E1'
    }
  },
  filterTabActive: {
    background: 'linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)',
    borderColor: '#00D4FF',
    color: '#FFFFFF'
  },
  filterCount: {
    background: '#E2E8F0',
    padding: '2px 6px',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: '600',
    color: '#64748B'
  },
  filterCountActive: {
    background: 'rgba(255,255,255,0.25)',
    color: '#FFFFFF'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px'
  },
  centerMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '300px',
    textAlign: 'center'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #E2E8F0',
    borderTopColor: '#00D4FF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '16px'
  },
  errorMessage: {
    background: '#FEF2F2',
    border: '1px solid #FEE2E2',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    color: '#DC2626',
    fontSize: '13px'
  },
  errorIcon: {
    fontSize: '20px',
    fontWeight: 700
  },
  emptyIcon: {
    fontSize: '32px',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#64748B'
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: '8px'
  },
  emptyText: {
    fontSize: '13px',
    color: '#94A3B8'
  },
  discussionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  discussionCard: {
    position: 'relative',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  discussionCardUnread: {
    background: 'linear-gradient(135deg, #FFF5F5 0%, #FFFFFF 100%)',
    borderLeft: '3px solid #EF4444'
  },
  discussionCardHover: {
    transform: 'translateX(-2px)',
    boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
    borderColor: '#CBD5E1'
  },
  discussionCardActive: {
    background: 'linear-gradient(135deg, #F0F9FF 0%, #E6F7FF 100%)',
    borderColor: '#00D4FF',
    boxShadow: '0 4px 12px rgba(0,212,255,0.15)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
    gap: '12px'
  },
  proposalInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: 0
  },
  proposalIcon: {
    width: '32px',
    height: '32px',
    background: '#F1F5F9',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#3B82F6',
    flexShrink: 0
  },
  proposalIconUnread: {
    background: '#FEE2E2',
    color: '#EF4444',
    animation: 'pulse 2s ease-in-out infinite'
  },
  proposalTextContainer: {
    minWidth: 0,
    flex: 1
  },
  proposalName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  pageInfo: {
    fontSize: '11px',
    color: '#94A3B8'
  },
  resolvedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: '500',
    color: '#10B981',
    background: '#D1FAE5',
    padding: '4px 8px',
    borderRadius: '20px',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  openBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: '500',
    color: '#F59E0B',
    background: '#FEF3C7',
    padding: '4px 10px',
    borderRadius: '20px',
    whiteSpace: 'nowrap',
    flexShrink: 0
  },
  openDot: {
    width: '6px',
    height: '6px',
    background: '#F59E0B',
    borderRadius: '50%',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  highlightPreview: {
    fontSize: '12px',
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: '1.5',
    padding: '10px 0',
    borderTop: '1px solid #F1F5F9',
    borderBottom: '1px solid #F1F5F9',
    marginBottom: '10px',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word'
  },
  latestMessagePreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '12px',
    fontSize: '11px',
    color: '#64748B',
    overflow: 'hidden'
  },
  cardFooter: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '12px',
    fontSize: '11px',
    color: '#94A3B8',
    marginBottom: '12px'
  },
  clientInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0
  },
  clientName: {
    fontSize: '11px',
    color: '#64748B'
  },
  clientEmailFull: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
    flex: 1
  },
  clientEmailText: {
    fontSize: '11px',
    color: '#64748B',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  messageStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0
  },
  timeAgo: {
    marginLeft: '4px',
    paddingLeft: '8px',
    borderLeft: '1px solid #E2E8F0'
  },
  readStatusContainer: {
    marginTop: '8px',
    padding: '8px',
    background: '#F8FAFC',
    borderRadius: '8px',
    border: '1px solid #E2E8F0'
  },
  readStatusHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px'
  },
  readStatusLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: '500',
    color: '#475569'
  },
  readStatusText: {
    fontSize: '11px'
  },
  readStatusPercentage: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#00D4FF'
  },
  progressBarContainer: {
    width: '100%',
    height: '4px',
    background: '#E2E8F0',
    borderRadius: '2px',
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.3s ease',
    borderRadius: '2px'
  },
  progressBarComplete: {
    background: 'linear-gradient(90deg, #10B981, #34D399)'
  },
  progressBarPartial: {
    background: 'linear-gradient(90deg, #F59E0B, #FBBF24)'
  },
  progressBarEmpty: {
    background: '#EF4444'
  },
  unreadIndicator: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    background: '#EF4444',
    borderRadius: '50%',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  unreadCount: {
    background: '#EF4444',
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: '700',
    minWidth: '18px',
    height: '18px',
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 5px'
  },
  notificationContainer: {
    position: 'relative'
  },
  notificationBadge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    background: '#EF4444',
    color: '#FFFFFF',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '700',
    border: '2px solid #FFFFFF'
  },
  notificationPanel: {
    position: 'absolute',
    top: '100%',
    right: 0,
    width: '380px',
    maxHeight: '500px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    boxShadow: '0 20px 25px rgba(0,0,0,0.15)',
    zIndex: 2000,
    marginTop: '8px',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideIn 0.2s ease'
  },
  notificationHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #F1F5F9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  },
  notificationTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#0F172A'
  },
  clearAllButton: {
    width: '32px',
    height: '32px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748B',
    transition: 'all 0.2s ease',
    ':hover': {
      background: '#F1F5F9',
      color: '#475569'
    }
  },
  notificationList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  emptyNotifications: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: '14px'
  },
  notificationItem: {
    padding: '12px 16px',
    borderBottom: '1px solid #F1F5F9',
    display: 'flex',
    gap: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: '#F8FAFC',
    margin: '0 8px 8px 8px',
    borderRadius: '8px',
    position: 'relative',
    ':hover': {
      background: '#F1F5F9',
      transform: 'translateX(-2px)'
    }
  },
  notificationItemRead: {
    background: '#FFFFFF',
    opacity: 0.7
  },
  notificationIcon: {
    width: '32px',
    height: '32px',
    background: '#F1F5F9',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  notificationContent: {
    flex: 1,
    minWidth: 0
  },
  notificationItemTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%'
  },
  notificationItemMessage: {
    fontSize: '12px',
    color: '#475569',
    marginBottom: '4px',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word'
  },
  notificationEmail: {
    fontSize: '11px',
    color: '#94A3B8',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%'
  },
  notificationTime: {
    fontSize: '10px',
    color: '#94A3B8'
  },
  notificationClose: {
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '0 4px',
    transition: 'color 0.2s ease',
    textTransform: 'uppercase',
    ':hover': {
      color: '#64748B'
    }
  },
  notificationSection: {
    padding: '12px 16px',
    borderTop: '1px solid #E2E8F0',
    background: '#F8FAFC',
    margin: '0 8px 8px 8px',
    borderRadius: '8px'
  },
  notificationSectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: '8px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  signedProposalItem: {
    padding: '8px 0',
    borderBottom: '1px solid #E2E8F0',
    ':last-child': {
      borderBottom: 'none'
    }
  },
  signedProposalName: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#0F172A',
    marginBottom: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%'
  },
  signedProposalMeta: {
    fontSize: '10px',
    color: '#94A3B8',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '4px',
    alignItems: 'center',
    flexWrap: 'wrap'
  }
};

export default AdminDiscussionDashboard;