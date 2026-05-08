# Users Activity Monitor - Quick Setup Guide

## Installation Steps

### Step 1: Files are Already Created
The following files have been created for you:
- ✅ `src/hooks/useUserActivity.js` - Hook for managing activities
- ✅ `src/Components/UsersActivityTab.jsx` - Main UI component
- ✅ `src/Components/UsersActivityTab.css` - Styling
- ✅ `src/utils/activityLogger.js` - Activity logging utilities

### Step 2: Dashboard Integration Complete
The Dashboard has been updated:
- ✅ Imports added
- ✅ Permission check added
- ✅ Tab button added to sidebar
- ✅ Tab content rendering added

### Step 3: Permissions Updated
The permissions system has been updated:
- ✅ `viewUserActivity` permission added for admin and superadmin roles

## Testing the Feature

### Quick Test:

1. **Start your development server**
   ```bash
   npm run dev
   ```

2. **Log in as Admin or SuperAdmin**
   - Use admin credentials to log in

3. **Navigate to User Activity**
   - Click "See More" in the sidebar
   - Click "User Activity" tab
   - You should see the activity dashboard

4. **Test Features**
   - Try searching by email
   - Filter by activity type
   - Change time range
   - Export as JSON or CSV

## Enabling Activity Logging

To start logging activities in your app, add these to your authentication handlers:

### In Your Login Component (e.g., `AuthPage.jsx`):

```javascript
import { ActivityLogger } from '../utils/activityLogger';

// After successful login
const handleLoginSuccess = async (userEmail) => {
  // ... your login logic
  await ActivityLogger.logLogin(userEmail);
};
```

### In Your Logout Handler (e.g., `Dashboard.jsx`):

```javascript
import { ActivityLogger } from '../utils/activityLogger';

// When user logs out
const handleLogout = async () => {
  if (user) {
    await ActivityLogger.logLogout(user.email);
  }
  // ... your logout logic
};
```

### In Your Document Viewer Component:

```javascript
import { ActivityLogger } from '../utils/activityLogger';

// When document is viewed
useEffect(() => {
  if (documentId) {
    const startTime = Date.now();
    
    return () => {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      ActivityLogger.logDocumentView(documentId, documentName, duration);
    };
  }
}, [documentId]);
```

## Accessing the Feature

1. Log in with Admin or SuperAdmin account
2. Go to Dashboard
3. In sidebar, expand "See More" section
4. Click "User Activity"
5. View, search, filter, and export activities

## Available Activity Types

```
login, logout, view_document, download, edit, delete, 
share, upload, comment, review, export, import, sign, 
unlock, print, email, create_discussion, send_message, 
access_admin
```

## Common Tasks

### Log a Document View
```javascript
await ActivityLogger.logDocumentView('doc123', 'Budget Proposal.pdf', 120);
```

### Log a Download
```javascript
await ActivityLogger.logDownload('doc123', 'Budget Proposal.pdf');
```

### Log a Delete
```javascript
await ActivityLogger.logDelete('doc123', 'Budget Proposal.pdf');
```

### Log a Share
```javascript
await ActivityLogger.logShare('doc123', 'Budget Proposal.pdf', ['user@example.com']);
```

### Log an Upload
```javascript
await ActivityLogger.logUpload('Budget Proposal.pdf', 2048576, 'application/pdf');
```

### Log a Review
```javascript
await ActivityLogger.logReview('doc123', 'Budget Proposal.pdf', 'approved', 'Looks good!');
```

## Firebase Rules Update

Make sure your Firestore rules allow admins to read from the `userActivities` collection:

```
match /userActivities/{document=**} {
  allow read: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'superadmin'];
  allow write: if request.auth != null;
}
```

## Troubleshooting

### Issue: Can't see User Activity tab
**Solution**: 
- Verify you're logged in as admin or superadmin
- Check if user role in Firestore is correctly set
- Clear browser cache and reload

### Issue: No activities showing
**Solution**:
- Activities are logged when `ActivityLogger` is called
- Add logging calls to your components first
- Check browser console for errors
- Verify Firestore database is accessible

### Issue: Export button not working
**Solution**:
- Check browser console for errors
- Verify browser allows downloads
- Try with fewer filters to reduce data size

## Next Steps

1. **Add activity logging** to key user actions in your app
2. **Test the dashboard** with different filters and searches
3. **Verify data exports** work correctly
4. **Monitor user activities** for insights

## Support Resources

- Documentation: `USERS_ACTIVITY_FEATURE.md`
- Hook implementation: `src/hooks/useUserActivity.js`
- Component: `src/Components/UsersActivityTab.jsx`
- Utilities: `src/utils/activityLogger.js`

## Success Indicators ✅

You know the feature is working when:
- [ ] User Activity tab appears in the admin sidebar
- [ ] Can view activity dashboard without errors
- [ ] Search functionality works
- [ ] Filters work correctly
- [ ] Export to JSON/CSV works
- [ ] Statistics display correctly
- [ ] Activities are logged when performing actions

Enjoy your new Users Activity Monitor! 🎉
