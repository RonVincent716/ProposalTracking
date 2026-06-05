import { useState, useEffect, useMemo, useContext } from 'react';
import {
  MdTrendingUp,
  MdRefresh,
  MdSearch,
  MdFilterList,
  MdCalendarToday,
  MdClear,
  MdAssignmentTurnedIn,
  MdPerson,
  MdCheckCircle,
  MdAccessTime,
  MdClose
} from 'react-icons/md';
import { UserRoleContext } from '../context/UserRoleContext';
import { useUserActivity } from '../hooks/useUserActivity';
import './PerUserStatsTab.css';

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return toDateInputValue(date);
};

const getActivityLabel = (activityType) => {
  const labels = {
    login: 'Login',
    logout: 'Logout',
    view_document: 'View Document',
    download: 'Download',
    edit: 'Edit',
    delete: 'Delete',
    share: 'Share',
    follow_up: 'Follow-Up',
    upload: 'Upload',
    comment: 'Comment',
    review: 'Review',
    export: 'Export',
    import: 'Import',
    sign: 'Sign'
  };
  return labels[activityType] || String(activityType || 'N/A').replace('_', ' ');
};

const formatTime = (date) => {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : date?.toDate?.() || new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const formatDateLabel = (dateValue) => {
  if (!dateValue) return 'N/A';
  const date = new Date(`${dateValue}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export default function PerUserStatsTab() {
  const { role } = useContext(UserRoleContext);
  const { activities, loading, fetchAllActivities } = useUserActivity();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActivityType, setSelectedActivityType] = useState('all');
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [selectedUserKey, setSelectedUserKey] = useState('');
  const todayDate = toDateInputValue(new Date());

  const isAdmin = role === 'admin' || role === 'superadmin';

  useEffect(() => {
    if (!isAdmin) return undefined;
    const unsubscribe = fetchAllActivities(1000);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [isAdmin, fetchAllActivities]);

  useEffect(() => {
    let filtered = activities;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((activity) =>
        activity.userEmail?.toLowerCase().includes(search) ||
        activity.userId?.toLowerCase().includes(search) ||
        activity.activityType?.toLowerCase().includes(search)
      );
    }

    if (selectedActivityType !== 'all') {
      filtered = filtered.filter((activity) => activity.activityType === selectedActivityType);
    }

    if (startDate || endDate) {
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

      filtered = filtered.filter((activity) => {
        const activityDate = activity.createdAt instanceof Date
          ? activity.createdAt
          : activity.createdAt?.toDate?.() || new Date(activity.createdAt);
        if (!(activityDate instanceof Date) || Number.isNaN(activityDate.getTime())) return false;
        if (start && activityDate < start) return false;
        if (end && activityDate > end) return false;
        return true;
      });
    }

    setFilteredActivities(filtered);
  }, [activities, searchTerm, selectedActivityType, startDate, endDate]);

  const getUserKey = (activity) => activity.userEmail || activity.userId || 'unknown-user';

  const getActivityDate = (activity) => (
    activity.createdAt instanceof Date
      ? activity.createdAt
      : activity.createdAt?.toDate?.() || new Date(activity.createdAt)
  );

  const userStats = useMemo(() => {
    const countedTypes = ['login', 'view_document', 'download', 'share', 'follow_up', 'comment', 'sign'];
    const rowsMap = new Map();
    const byType = {};

    filteredActivities.forEach((activity) => {
      const key = getUserKey(activity);
      const existing = rowsMap.get(key) || {
        userKey: key,
        userEmail: activity.userEmail || 'Unknown user',
        total: 0,
        lastActive: null,
        counts: countedTypes.reduce((acc, type) => {
          acc[type] = 0;
          return acc;
        }, {})
      };

      existing.total += 1;
      if (Object.prototype.hasOwnProperty.call(existing.counts, activity.activityType)) {
        existing.counts[activity.activityType] += 1;
      }

      byType[activity.activityType] = (byType[activity.activityType] || 0) + 1;

      const activityDate = getActivityDate(activity);

      if (!existing.lastActive || activityDate > existing.lastActive) {
        existing.lastActive = activityDate;
      }

      rowsMap.set(key, existing);
    });

    const rows = Array.from(rowsMap.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return (b.lastActive?.getTime?.() || 0) - (a.lastActive?.getTime?.() || 0);
    });

    let mostCommonType = 'N/A';
    let mostCommonTypeCount = 0;
    Object.entries(byType).forEach(([type, count]) => {
      if (count > mostCommonTypeCount) {
        mostCommonType = type;
        mostCommonTypeCount = count;
      }
    });

    return {
      rows,
      topUsers: rows.slice(0, 3),
      totalActivities: filteredActivities.length,
      activeUsers: rows.length,
      avgPerUser: rows.length ? (filteredActivities.length / rows.length).toFixed(1) : '0.0',
      mostCommonType,
      mostCommonTypeCount
    };
  }, [filteredActivities]);

  useEffect(() => {
    if (!selectedUserKey) return;
    const userStillVisible = userStats.rows.some((row) => row.userKey === selectedUserKey);
    if (!userStillVisible) {
      setSelectedUserKey('');
    }
  }, [selectedUserKey, userStats.rows]);

  const selectedUserDetail = useMemo(() => {
    if (!selectedUserKey) return null;

    const userRow = userStats.rows.find((row) => row.userKey === selectedUserKey);
    if (!userRow) return null;

    const activitiesForUser = filteredActivities
      .filter((activity) => getUserKey(activity) === selectedUserKey)
      .map((activity) => ({
        ...activity,
        activityDate: getActivityDate(activity)
      }))
      .sort((a, b) => b.activityDate - a.activityDate);

    const typeCounts = {};
    const hourly = Array(24).fill(0);
    const activeDaysSet = new Set();

    activitiesForUser.forEach((activity) => {
      typeCounts[activity.activityType] = (typeCounts[activity.activityType] || 0) + 1;
      const hour = activity.activityDate.getHours();
      hourly[hour] += 1;
      activeDaysSet.add(activity.activityDate.toDateString());
    });

    const peakHour = hourly.indexOf(Math.max(...hourly));
    const sortedTypeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

    return {
      ...userRow,
      activities: activitiesForUser,
      activeDays: activeDaysSet.size,
      avgPerDay: activeDaysSet.size > 0 ? (activitiesForUser.length / activeDaysSet.size).toFixed(2) : '0.00',
      peakHourLabel: `${String(peakHour).padStart(2, '0')}:00`,
      sortedTypeEntries
    };
  }, [filteredActivities, selectedUserKey, userStats.rows]);

  if (!isAdmin) {
    return (
      <div className="per-user-stats-tab access-denied">
        <div className="access-denied-message">
          <p>Access Denied</p>
          <span>Only administrators can view per-user statistics.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="per-user-stats-tab">
      <div className="per-user-header">
        <div className="per-user-title-wrap">
          <MdTrendingUp size={24} />
          <div>
            <h2>Per User Statistics</h2>
            <p>Focused breakdown by user activity performance</p>
          </div>
        </div>
        <button
          className="per-user-refresh"
          onClick={() => fetchAllActivities(1000)}
          disabled={loading}
          title="Refresh"
        >
          <MdRefresh size={18} />
          Refresh
        </button>
      </div>

      <div className="per-user-stats-grid">
        <div className="per-user-stat-card">
          <div className="stat-icon"><MdAssignmentTurnedIn size={22} /></div>
          <div>
            <div className="stat-value">{userStats.totalActivities}</div>
            <div className="stat-label">Total Activities</div>
          </div>
        </div>
        <div className="per-user-stat-card">
          <div className="stat-icon"><MdPerson size={22} /></div>
          <div>
            <div className="stat-value">{userStats.activeUsers}</div>
            <div className="stat-label">Active Users</div>
          </div>
        </div>
        <div className="per-user-stat-card">
          <div className="stat-icon"><MdCheckCircle size={22} /></div>
          <div>
            <div className="stat-value">{userStats.avgPerUser}</div>
            <div className="stat-label">Avg Activities/User</div>
          </div>
        </div>
        <div className="per-user-stat-card">
          <div className="stat-icon"><MdAccessTime size={22} /></div>
          <div>
            <div className="stat-value">{getActivityLabel(userStats.mostCommonType)} ({userStats.mostCommonTypeCount})</div>
            <div className="stat-label">Most Common</div>
          </div>
        </div>
      </div>

      <div className="per-user-summary-strip">
        <span>Showing <strong>{userStats.totalActivities}</strong> activities across <strong>{userStats.activeUsers}</strong> users</span>
        <span>{formatDateLabel(startDate)} - {formatDateLabel(endDate)}</span>
      </div>

      <div className="per-user-filters">
        <div className="filter-group">
          <label className="filter-label"><MdSearch size={16} /> Search</label>
          <input
            className="filter-input"
            type="text"
            placeholder="Search by email or user ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-filter-btn" onClick={() => setSearchTerm('')} title="Clear search">
              <MdClear size={16} />
            </button>
          )}
        </div>

        <div className="filter-group">
          <label className="filter-label"><MdFilterList size={16} /> Activity Type</label>
          <select
            className="filter-input"
            value={selectedActivityType}
            onChange={(e) => setSelectedActivityType(e.target.value)}
          >
            <option value="all">All Activities</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="view_document">View Document</option>
            <option value="download">Download</option>
            <option value="edit">Edit</option>
            <option value="delete">Delete</option>
            <option value="share">Share</option>
            <option value="follow_up">Follow-Up</option>
            <option value="upload">Upload</option>
            <option value="comment">Comment</option>
            <option value="review">Review</option>
            <option value="sign">Sign</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label"><MdCalendarToday size={16} /> Date Range</label>
          <div className="date-range-wrap">
            <input
              className="filter-input"
              type="date"
              value={startDate}
              max={endDate || todayDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              className="filter-input"
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={todayDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="per-user-top">
        <h3>Top Users</h3>
        <div className="per-user-top-meta">
          <span className="top-meta-chip">{formatDateLabel(startDate)} - {formatDateLabel(endDate)}</span>
          <span className="top-meta-chip strong">{userStats.rows.length} users</span>
        </div>
      </div>
      <div className="top-users-grid">
        {userStats.topUsers.length === 0 ? (
          <div className="top-user-card">No user activity found for this filter range.</div>
        ) : (
          userStats.topUsers.map((entry, index) => (
            <button
              key={entry.userKey}
              type="button"
              className={`top-user-card top-user-clickable ${selectedUserKey === entry.userKey ? 'active' : ''}`}
              onClick={() => setSelectedUserKey(entry.userKey)}
              title={`View detailed activity for ${entry.userEmail}`}
            >
              <div className="top-user-rank">#{index + 1}</div>
              <div className="top-user-email">
                <span className="clickable-email-text">{entry.userEmail}</span>
              </div>
              <div className="top-user-meta">
                <span>{entry.total} activities</span>
                <span>Last active: {formatTime(entry.lastActive)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="per-user-table-wrap">
        <table className="per-user-table">
          <thead>
            <tr>
              <th>User Email</th>
              <th>Total</th>
              <th>Login</th>
              <th>View Doc</th>
              <th>Download</th>
              <th>Share</th>
              <th>Follow-Up</th>
              <th>Comment</th>
              <th>Sign</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {userStats.rows.length === 0 ? (
              <tr>
                <td className="empty-row" colSpan={10}>No user rows to display.</td>
              </tr>
            ) : (
              userStats.rows.map((entry) => (
                <tr
                  key={entry.userKey}
                  className={`table-user-row ${selectedUserKey === entry.userKey ? 'active' : ''}`}
                  onClick={() => setSelectedUserKey(entry.userKey)}
                  title={`View detailed activity for ${entry.userEmail}`}
                >
                  <td className="table-user-email">
                    <span className="clickable-email-text">{entry.userEmail}</span>
                  </td>
                  <td>{entry.total}</td>
                  <td>{entry.counts.login}</td>
                  <td>{entry.counts.view_document}</td>
                  <td>{entry.counts.download}</td>
                  <td>{entry.counts.share}</td>
                  <td>{entry.counts.follow_up}</td>
                  <td>{entry.counts.comment}</td>
                  <td>{entry.counts.sign}</td>
                  <td>{formatTime(entry.lastActive)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedUserDetail && (
        <div className="user-detail-modal-overlay" onClick={() => setSelectedUserKey('')}>
          <div className="user-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="user-detail-header">
              <div>
                <h3>{selectedUserDetail.userEmail}</h3>
                <p>Detailed activity summary in selected filter range</p>
              </div>
              <button
                type="button"
                className="close-detail-btn"
                onClick={() => setSelectedUserKey('')}
                title="Close details"
              >
                <MdClose size={18} />
              </button>
            </div>

            <div className="user-detail-metrics">
              <div className="detail-metric">
                <span className="detail-metric-value">{selectedUserDetail.total}</span>
                <span className="detail-metric-label">Total Activities</span>
              </div>
              <div className="detail-metric">
                <span className="detail-metric-value">{selectedUserDetail.activeDays}</span>
                <span className="detail-metric-label">Active Days</span>
              </div>
              <div className="detail-metric">
                <span className="detail-metric-value">{selectedUserDetail.avgPerDay}</span>
                <span className="detail-metric-label">Avg/Day</span>
              </div>
              <div className="detail-metric">
                <span className="detail-metric-value">{selectedUserDetail.peakHourLabel}</span>
                <span className="detail-metric-label">Peak Hour</span>
              </div>
            </div>

            <div className="user-detail-sections">
              <div className="user-detail-card">
                <h4>Activity Types</h4>
                {selectedUserDetail.sortedTypeEntries.length === 0 ? (
                  <div className="detail-empty">No activity type data</div>
                ) : (
                  <div className="type-count-list">
                    {selectedUserDetail.sortedTypeEntries.map(([type, count]) => (
                      <div key={type} className="type-count-item">
                        <span>{getActivityLabel(type)}</span>
                        <strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="user-detail-card">
                <h4>Recent Activity</h4>
                {selectedUserDetail.activities.length === 0 ? (
                  <div className="detail-empty">No recent records</div>
                ) : (
                  <div className="recent-activity-list">
                    {selectedUserDetail.activities.slice(0, 8).map((activity) => (
                      <div key={activity.id} className="recent-activity-item">
                        <div className="recent-activity-top">
                          <span>{getActivityLabel(activity.activityType)}</span>
                          <small>{formatTime(activity.activityDate)}</small>
                        </div>
                        {activity?.details?.documentName && (
                          <div className="recent-activity-meta">Document: {activity.details.documentName}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
