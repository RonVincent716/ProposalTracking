# Role-Based User System - Setup Guide

## ✅ What's Been Installed

Your app now has a complete role-based user system with three user types:

### User Roles:
- **`user`** - Regular user (default for new signups)
- **`admin`** - Admin with elevated permissions
- **`superadmin`** - SuperAdmin with full system access

---

## 🚀 New Routes Available

1. **`/profile`** - View your user profile and role
2. **`/user-management`** - SuperAdmin dashboard to manage all users (SuperAdmin only)

---

## 📁 New Files Created

```
src/
├── context/
│   └── UserRoleContext.jsx          # Global role context provider
├── Components/
│   ├── RoleBasedAccess.jsx          # Role-based rendering components
│   ├── UserManagement.jsx           # SuperAdmin user management dashboard
│   ├── UserManagement.css           # Styling for UserManagement
│   ├── UserProfile.jsx              # User profile display component
│   └── UserProfile.css              # Styling for UserProfile
└── hooks/
    └── useUserRole.js               # Custom hook for accessing user role
```

---

## 🔧 How to Use

### 1. Access User Role in Any Component

```jsx
import { useUserRole } from "../hooks/useUserRole";

export default function MyComponent() {
  const { role, user, loading } = useUserRole();

  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>Welcome, {user?.email}</h1>
      <p>Your role: {role}</p>
    </div>
  );
}
```

### 2. Conditional Rendering by Role

```jsx
import { SuperAdminOnly, AdminOnly, UserOnly } from "../Components/RoleBasedAccess";

export default function Dashboard() {
  return (
    <div>
      <SuperAdminOnly>
        <UserManagement />
      </SuperAdminOnly>

      <AdminOnly>
        <AdminPanel />
      </AdminOnly>

      <UserOnly>
        <UserDashboard />
      </UserOnly>
    </div>
  );
}
```

### 3. Generic Role-Based Access

```jsx
import { RoleBasedAccess } from "../Components/RoleBasedAccess";

<RoleBasedAccess 
  roles={["admin", "superadmin"]}
  fallback={<div>You don't have permission</div>}
>
  <SensitiveContent />
</RoleBasedAccess>
```

---

## 📊 Firestore Collection Structure

The system expects a `users` collection in your Firestore database:

```json
{
  "users": {
    "[userUID]": {
      "email": "user@example.com",
      "role": "user | admin | superadmin",
      "createdAt": "2026-04-24T12:00:00.000Z",
      "uid": "[userUID]"
    }
  }
}
```

**New user accounts automatically get the role `"user"` by default.**

---

## 🛡️ Firestore Security Rules

Update your Firestore rules to this (Firebase Console > Firestore > Rules):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - users can read their own, superadmin can read all
    match /users/{userId} {
      allow read: if request.auth.uid == userId || 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "superadmin";
      allow create: if request.auth.uid == userId;
      allow update: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "superadmin";
      allow delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "superadmin";
    }

    // Add your other collections here
    match /{document=**} {
      allow read, write: if false; // Default deny all
    }
  }
}
```

---

## 🎯 Making a User SuperAdmin

### Option 1: Firebase Console
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Find the user document in the `users` collection
4. Edit the `role` field from `"user"` to `"superadmin"`

### Option 2: Using Cloud Functions
Create a function to promote users:

```javascript
// functions/promoteToAdmin.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.promoteToSuperAdmin = functions.https.onCall(async (data, context) => {
  // Check if caller is already superadmin
  const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (callerDoc.data().role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Only superadmins can promote users');
  }

  // Promote the target user
  await admin.firestore().collection('users').doc(data.userId).update({
    role: 'superadmin'
  });

  return { message: 'User promoted to superadmin' };
});
```

### Option 3: Using the UserManagement Component
Once you have a SuperAdmin user, they can:
1. Navigate to `/user-management`
2. Find any user in the table
3. Change their role using the dropdown menu

---

## 🔐 Protected Routes

All role-checking is automatic. Example:

```jsx
<Route
  path="/admin-only"
  element={
    <ProtectedRoute>
      <AdminOnly fallback={<div>Access Denied</div>}>
        <AdminComponent />
      </AdminOnly>
    </ProtectedRoute>
  }
/>
```

---

## 💡 Helper Functions

The `useUserRole.js` hook includes helper functions:

```jsx
import { useUserRole, hasRole, isAdmin, isSuperAdmin } from "../hooks/useUserRole";

const { role } = useUserRole();

// Check role hierarchy
hasRole(role, "admin"); // true if admin or superadmin
isAdmin(role); // true if admin or superadmin
isSuperAdmin(role); // true if superadmin only
```

---

## 🧪 Testing the System

1. **Sign up a new user** at `/auth` → Auto-assigned as `"user"`
2. **View your profile** at `/profile`
3. **Get first SuperAdmin** → Use Firebase Console to set role to `"superadmin"`
4. **Access User Management** → SuperAdmin logs in and visits `/user-management`
5. **Manage users** → Change roles, delete users, etc.

---

## ❓ Troubleshooting

### Users not getting role in Firestore?
- Check that the signup is completing without errors
- Verify Firestore database is enabled
- Check browser console for errors

### Profile page shows wrong role?
- Refresh the page (role is cached)
- Check Firestore console for correct role value

### User Management page shows "Access Denied"?
- Verify your user has `role: "superadmin"` in Firestore
- Check browser console for authentication errors

---

## 📝 Next Steps

1. ✅ Firestore rules updated with role-based access
2. ✅ First SuperAdmin user created (manual in Firebase Console)
3. ✅ Use `/user-management` to manage users
4. ✅ Add role checks to other components as needed

---

Questions? Check the component files or Firebase documentation!
