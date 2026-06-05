import { useState, useEffect, useContext } from 'react';
import {
  MdSearch,
  MdFilterList,
  MdRefresh,
  MdDownload,
  MdCalendarToday,
  MdPerson,
  MdEmail,
  MdAccessTime,
  MdDesktopMac,
  MdInfo,
  MdClear,
  MdGetApp,
  MdTrendingUp,
  MdAssignmentTurnedIn,
  MdVisibility,
  MdCloudDownload,
  MdEdit,
  MdDelete,
  MdShare,
  MdLogin,
  MdLogout,
  MdCheckCircle,
  MdWarning,
  MdPending
} from 'react-icons/md';
import { UserRoleContext } from '../context/UserRoleContext';
import { useUserActivity } from '../hooks/useUserActivity';
import './UsersActivityTab.css';

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return toDateInputValue(date);
};

/**
 * UsersActivityTab Component
 * Displays real-time user activity logs for admin
 */
export default function UsersActivityTab() {
  const { role, user } = useContext(UserRoleContext);
  const { activities, loading, logActivity, fetchAllActivities, getActivityStats } = useUserActivity();

  const [filteredActivities, setFilteredActivities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActivityType, setSelectedActivityType] = useState('all');
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const todayDate = toDateInputValue(new Date());

  // Check if user is admin
  const isAdmin = role === 'admin' || role === 'superadmin';

  // Fetch activities on mount
  useEffect(() => {
    if (isAdmin) {
      const unsubscribe = fetchAllActivities(500);
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [isAdmin, fetchAllActivities]);

  // Filter activities based on search and type
  useEffect(() => {
    let filtered = activities;

    if (searchTerm) {
      filtered = filtered.filter((activity) =>
        activity.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.activityType?.toLowerCase().includes(searchTerm.toLowerCase())
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
    setPage(1);
  }, [activities, searchTerm, selectedActivityType, startDate, endDate]);

  // Fetch stats
  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      const statsData = await getActivityStats(startDate, endDate);
      setStats(statsData);
      setStatsLoading(false);
    };

    if (isAdmin) {
      loadStats();
    }
  }, [startDate, endDate, isAdmin, getActivityStats]);

  // Get activity icon and color
  const getActivityIcon = (activityType) => {
    const iconProps = { size: 18 };
    switch (activityType) {
      case 'login':
        return <MdLogin {...iconProps} style={{ color: '#4CAF50' }} />;
      case 'logout':
        return <MdLogout {...iconProps} style={{ color: '#F44336' }} />;
      case 'view_document':
        return <MdVisibility {...iconProps} style={{ color: '#2196F3' }} />;
      case 'download':
        return <MdCloudDownload {...iconProps} style={{ color: '#FF9800' }} />;
      case 'edit':
        return <MdEdit {...iconProps} style={{ color: '#9C27B0' }} />;
      case 'delete':
        return <MdDelete {...iconProps} style={{ color: '#F44336' }} />;
      case 'share':
        return <MdShare {...iconProps} style={{ color: '#00BCD4' }} />;
      case 'follow_up':
        return <MdEmail {...iconProps} style={{ color: '#2563EB' }} />;
      case 'upload':
        return <MdGetApp {...iconProps} style={{ color: '#FF5722' }} />;
      default:
        return <MdAssignmentTurnedIn {...iconProps} style={{ color: '#607D8B' }} />;
    }
  };

  // Get activity label
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
      import: 'Import'
    };
    return labels[activityType] || activityType.replace('_', ' ').toUpperCase();
  };

  // Get activity status color
  const getActivityStatusColor = (activityType) => {
    const statusMap = {
      login: 'success',
      logout: 'info',
      view_document: 'info',
      download: 'warning',
      edit: 'secondary',
      delete: 'danger',
      share: 'info',
      follow_up: 'info',
      upload: 'warning',
      comment: 'info',
      review: 'secondary',
      export: 'warning',
      import: 'warning'
    };
    return statusMap[activityType] || 'default';
  };

  // Format time
  const formatTime = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : date.toDate?.() || new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
  const startIdx = (page - 1) * itemsPerPage;
  const paginatedActivities = filteredActivities.slice(startIdx, startIdx + itemsPerPage);
  const startRecord = filteredActivities.length === 0 ? 0 : startIdx + 1;
  const endRecord = Math.min(startIdx + itemsPerPage, filteredActivities.length);

  // Export data
  const exportActivities = () => {
    const dataStr = JSON.stringify(filteredActivities, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user-activities-${new Date().toISOString()}.json`;
    link.click();
  };

  // Export CSV
  const exportAsCSV = () => {
    const headers = ['Date', 'User Email', 'Activity Type', 'Details', 'User Agent'];
    const csvContent = [
      headers.join(','),
      ...filteredActivities.map((activity) =>
        [
          formatTime(activity.createdAt),
          activity.userEmail,
          activity.activityType,
          JSON.stringify(activity.details),
          activity.userAgent
        ].map((field) => `"${field}"`).join(',')
      )
    ].join('\n');

    const dataBlob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user-activities-${new Date().toISOString()}.csv`;
    link.click();
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

  const handleStartDateChange = (value) => {
    setStartDate(value);
    if (endDate && value && value > endDate) {
      setEndDate(value);
    }
  };

  const handleEndDateChange = (value) => {
    setEndDate(value);
    if (startDate && value && value < startDate) {
      setStartDate(value);
    }
  };

  if (!isAdmin) {
    return (
      <div className="users-activity-tab access-denied">
        <div className="access-denied-message">
          <MdWarning size={48} />
          <p>Access Denied</p>
          <span>Only administrators can view user activity logs.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="users-activity-tab">
      {/* Header */}
      <div className="activity-header">
        <div className="header-title">
          <MdTrendingUp size={24} />
          <h2>Users Activity Monitor</h2>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => fetchAllActivities(500)}
            disabled={loading}
            title="Refresh activities"
          >
            <MdRefresh size={18} />
            Refresh
          </button>
          <button
            className="btn btn-secondary"
            onClick={exportActivities}
            title="Export as JSON"
          >
            <MdDownload size={18} />
            JSON
          </button>
          <button
            className="btn btn-secondary"
            onClick={exportAsCSV}
            title="Export as CSV"
          >
            <MdGetApp size={18} />
            CSV
          </button>
        </div>
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="activity-stats-grid">
          <div className="stat-card">
            <div className="stat-icon total">
              <MdAssignmentTurnedIn size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalActivities}</span>
              <span className="stat-label">Total Activities</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon users">
              <MdPerson size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.uniqueUsers}</span>
              <span className="stat-label">Unique Users</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <MdCheckCircle size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{Object.keys(stats.byType).length}</span>
              <span className="stat-label">Activity Types</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <MdAccessTime size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{`${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`}</span>
              <span className="stat-label">Date Range</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="activity-filters">
        <div className="filter-group">
          <label htmlFor="search" className="filter-label">
            <MdSearch size={16} />
            Search
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search by email or user ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              className="clear-btn"
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              <MdClear size={16} />
            </button>
          )}
        </div>

        <div className="filter-group">
          <label htmlFor="activity-type" className="filter-label">
            <MdFilterList size={16} />
            Activity Type
          </label>
          <select
            id="activity-type"
            value={selectedActivityType}
            onChange={(e) => setSelectedActivityType(e.target.value)}
            className="filter-select"
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
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">
            <MdCalendarToday size={16} />
            Date Range
          </label>
          <div className="date-range-inputs">
            <input
              id="start-date"
              type="date"
              value={startDate}
              max={endDate || todayDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="filter-select date-input"
            />
            <input
              id="end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={todayDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="filter-select date-input"
            />
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="activity-summary">
        <span className="summary-text">
          Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of <strong>{filteredActivities.length}</strong> activities
        </span>
      </div>

      {/* Activities List */}
      <div className="activities-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading activities...</p>
          </div>
        ) : paginatedActivities.length === 0 ? (
          <div className="empty-state">
            <MdInfo size={48} />
            <p>No activities found</p>
            <span>Try adjusting your filters or search criteria</span>
          </div>
        ) : (
          <div className="activities-list">
            {paginatedActivities.map((activity) => (
              <div key={activity.id} className={`activity-item status-${getActivityStatusColor(activity.activityType)}`}>
                <div className="activity-icon">
                  {getActivityIcon(activity.activityType)}
                </div>
                <div className="activity-details">
                  <div className="activity-header-row">
                    <span className="activity-type">{getActivityLabel(activity.activityType)}</span>
                    <span className="activity-timestamp">{formatTime(activity.createdAt)}</span>
                  </div>
                  <div className="activity-user-row">
                    <span className="user-email">
                      <MdEmail size={14} />
                      {activity.userEmail}
                    </span>
                  </div>
                  {activity.details && (
                    <div className="activity-metadata">
                      {activity.details.documentName && (
                        <span className="metadata-item">
                          <strong>Document:</strong> {activity.details.documentName}
                        </span>
                      )}
                      {activity.details.documentId && (
                        <span className="metadata-item">
                          <strong>ID:</strong> {activity.details.documentId.substring(0, 8)}...
                        </span>
                      )}
                      {activity.details.duration && (
                        <span className="metadata-item">
                          <strong>Duration:</strong> {activity.details.duration}s
                        </span>
                      )}
                      {activity.details.pages && (
                        <span className="metadata-item">
                          <strong>Pages:</strong> {activity.details.pages}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination (below activities) */}
      {filteredActivities.length > 0 && (
        <div className="pagination">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="pagination-btn"
          >
            Previous
          </button>
          <span className="page-indicator">
            Page {page} of {Math.max(1, totalPages)}
          </span>
          <button
            onClick={() => setPage(Math.min(Math.max(1, totalPages), page + 1))}
            disabled={page >= Math.max(1, totalPages)}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
}
