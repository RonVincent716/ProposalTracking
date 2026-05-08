# Users Activity Monitor - Admin Feature

## Overview
The Users Activity Monitor is a comprehensive admin feature that tracks and displays all user activities within the proposal management system. It provides real-time monitoring, filtering, search capabilities, and data export functionality.

## Features

### 1. **Real-Time Activity Tracking**
- Logs all user actions (login, logout, document views, downloads, edits, deletions, etc.)
- Stores activity data in Firebase Firestore
- Real-time updates using Firestore listeners

### 2. **Activity Dashboard**
- View all user activities in a paginated list
- Search activities by user email or user ID
- Filter activities by type (login, logout, view document, download, edit, delete, share, upload, etc.)
- Filter by time range (last 24 hours, 7 days, 30 days)

### 3. **Activity Statistics**
- Total activities count
- Unique users count
- Activity types breakdown
- Top users by activity
- Hourly distribution of activities

### 4. **Data Export**
- Export activities as JSON format
- Export activities as CSV format
- Useful for compliance, auditing, and analysis

### 5. **User-Friendly Interface**
- Responsive design (mobile, tablet, desktop)
- Color-coded activity types with icons
- Loading states and empty states
- Pagination support (25 items per page)

## Access Control

Only users with the following roles can access the Users Activity Monitor:
- **Admin**: Full access to view all activities
- **SuperAdmin**: Full access to view all activities

Regular users cannot access this feature.

## Files Created/Modified

### New Files Created:

1. **`src/hooks/useUserActivity.js`**
   - Hook for managing user activity operations
   - Functions: `logActivity()`, `fetchAllActivities()`, `getUserActivities()`, `getActivityStats()`

2. **`src/Components/UsersActivityTab.jsx`**
   - Main component for displaying user activities
   - Features: search, filter, pagination, export, statistics

3. **`src/Components/UsersActivityTab.css`**
   - Comprehensive styling for the Users Activity tab
   - Responsive design for all screen sizes

4. **`src/utils/activityLogger.js`**
   - Utility functions for logging activities
   - Predefined activity types and logging methods
   - Global activity logger for use throughout the app

### Modified Files:

1. **`src/pages/Dashboard.jsx`**
   - Added import for `UsersActivityTab` component
   - Added `MdTrendingUp` icon import
   - Added permission check: `canAccessUserActivity`
   - Added "User Activity" tab button in sidebar
   - Added tab content rendering for user activity

2. **`src/utils/permissions.js`**
   - Added `viewUserActivity` permission for admin and superadmin roles

## Database Schema

Activities are stored in Firestore under the `userActivities` collection:

```javascript
{
  id: "doc_id",
  userId: "firebase_uid",
  userEmail: "user@example.com",
  activityType: "login", // Type of activity
  details: {
    // Activity-specific details
    documentId: "proposal_123",
    documentName: "Q1 Budget Proposal",
    duration: 120, // in seconds
    pages: 15,
    timestamp: "2024-05-01T10:30:00Z",
    userAgent: "Mozilla/5.0..."
  },
  createdAt: Timestamp, // Server timestamp
  ipAddress: "" // For future enhancement
}
```

## Activity Types

The following activity types are tracked:

| Type | Description |
|------|-------------|
| `login` | User logs in |
| `logout` | User logs out |
| `view_document` | User views a document |
| `download` | User downloads a file |
| `edit` | User edits content |
| `delete` | User deletes content |
| `share` | User shares a document |
| `upload` | User uploads a file |
| `comment` | User adds a comment |
| `review` | User reviews a proposal |
| `export` | User exports data |
| `import` | User imports data |
| `sign` | User signs a document |
| `unlock` | User unlocks content |
| `print` | User prints a document |
| `email` | User sends via email |
| `create_discussion` | User creates a discussion |
| `send_message` | User sends a message |
| `access_admin` | User accesses admin features |

## Usage

### Accessing the Feature

1. Log in as an Admin or SuperAdmin user
2. Go to Dashboard
3. Click "See More" in the sidebar to expand additional options
4. Click "User Activity" tab
5. View, search, filter, and export user activities

### Logging Activities in Your Code

#### Example 1: Log Login Activity
```javascript
import { ActivityLogger } from '../utils/activityLogger';

// When user logs in
await ActivityLogger.logLogin(userEmail);
```

#### Example 2: Log Document View
```javascript
import { ActivityLogger } from '../utils/activityLogger';

// When user views a document
await ActivityLogger.logDocumentView(documentId, documentName, durationInSeconds);
```

#### Example 3: Log Download
```javascript
import { ActivityLogger } from '../utils/activityLogger';

// When user downloads a file
await ActivityLogger.logDownload(documentId, documentName);
```

#### Example 4: Custom Activity
```javascript
import { logUserActivity, ActivityTypes } from '../utils/activityLogger';

// Log any custom activity
await logUserActivity(ActivityTypes.CUSTOM_ACTION, {
  documentId: '123',
  customField: 'custom value'
});
```

### Using the Hook in Components

```javascript
import { useUserActivity } from '../hooks/useUserActivity';

function MyComponent() {
  const { 
    activities, 
    loading, 
    error, 
    logActivity, 
    fetchAllActivities, 
    getUserActivities, 
    getActivityStats 
  } = useUserActivity();

  // Fetch activities on mount
  useEffect(() => {
    fetchAllActivities(500);
  }, []);

  // Log an activity
  const handleAction = async () => {
    await logActivity('custom_type', { 
      detail: 'some detail' 
    });
  };

  return (
    // Your component JSX
  );
}
```

## Integration Points

### 1. Authentication
Add activity logging to your login/logout flows:

```javascript
// In your login component
const handleLogin = async (email, password) => {
  // ... login logic
  await ActivityLogger.logLogin(email);
};

// In your logout component
const handleLogout = async () => {
  // ... logout logic
  await ActivityLogger.logLogout(userEmail);
};
```

### 2. Document Operations
Add activity logging to your document handlers:

```javascript
// When viewing a document
useEffect(() => {
  ActivityLogger.logDocumentView(docId, docName, viewDuration);
}, [docId]);

// When downloading a document
const downloadFile = async () => {
  // ... download logic
  await ActivityLogger.logDownload(docId, docName);
};

// When deleting a document
const deleteFile = async () => {
  // ... delete logic
  await ActivityLogger.logDelete(docId, docName);
};
```

### 3. Admin Actions
Log important admin operations:

```javascript
// When sharing a document
const shareDocument = async (docId, sharedWith) => {
  // ... share logic
  await ActivityLogger.logShare(docId, docName, sharedWith);
};
```

## Features in Detail

### Search Functionality
- Search by user email
- Search by user ID
- Real-time filtering as you type

### Filters
- **Activity Type**: Filter by specific activity types
- **Time Range**: View activities from last 24 hours, 7 days, or 30 days

### Statistics Dashboard
- **Total Activities**: Total number of activities recorded
- **Unique Users**: Number of distinct users
- **Activity Types**: Count of different activity types
- **Time Range**: Currently viewed time period

### Export Options

#### JSON Export
- Exports all filtered activities as JSON
- Useful for data analysis and backup
- File naming: `user-activities-{timestamp}.json`

#### CSV Export
- Exports all filtered activities as CSV
- Includes columns: Date, User Email, Activity Type, Details, User Agent
- File naming: `user-activities-{timestamp}.csv`
- Can be imported into Excel, Google Sheets, etc.

### Pagination
- 25 activities per page
- Navigate using Previous/Next buttons
- Shows current page number and total pages

## Security Considerations

1. **Role-Based Access**: Only admins and superadmins can view activities
2. **User Identification**: Activities are linked to user UID and email
3. **Timestamp Verification**: Server-side timestamps prevent tampering
4. **Audit Trail**: All activities are immutable once recorded
5. **Data Retention**: Consider implementing data retention policies in Firebase

## Performance Optimization

1. **Pagination**: Limits data fetched at once
2. **Lazy Loading**: Activities are loaded on demand
3. **Firestore Indexing**: Ensure proper indexes for queries
4. **Caching**: Activities are cached in component state

### Recommended Firestore Indexes

```
Collection: userActivities
Indexes:
- createdAt (descending)
- userId, createdAt (descending)
- activityType, createdAt (descending)
```

## Future Enhancements

1. **IP Address Tracking**: Capture and display user IP addresses
2. **Geographic Data**: Show user location based on IP
3. **Device Information**: Track device type and browser details
4. **Session Tracking**: Group activities by user sessions
5. **Analytics Charts**: Visual representation of activity trends
6. **Alerts/Notifications**: Real-time alerts for suspicious activities
7. **Retention Policies**: Auto-delete old activity records
8. **Advanced Filtering**: Multiple filter combinations
9. **Activity Comparison**: Compare activity patterns over time
10. **Integration with Logging Service**: Send to external logging services

## Troubleshooting

### No activities showing
- Check if user has `viewUserActivity` permission
- Verify Firestore rules allow reading from `userActivities` collection
- Check browser console for errors

### Activities not being logged
- Ensure `ActivityLogger` functions are being called
- Check Firestore write permissions
- Verify Firebase is properly initialized

### Export not working
- Check browser console for errors
- Verify filtered activities exist
- Check browser security settings for download permissions

## Support and Documentation

For more information:
- Check `src/hooks/useUserActivity.js` for hook implementation
- Review `src/Components/UsersActivityTab.jsx` for UI implementation
- See `src/utils/activityLogger.js` for activity logging utilities
- Check `src/utils/permissions.js` for permission definitions

## License

This feature is part of the Proposal Tracking System and follows the same license.
