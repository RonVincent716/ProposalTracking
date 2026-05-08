# Role-Based Access Control (RBAC) System

## 📊 Access Permissions Matrix

| Feature | User | Admin | SuperAdmin |
|---------|------|-------|-----------|
| **Dashboard** | ✅ View | ✅ View | ✅ View |
| **Upload Proposals** | ✅ Yes | ✅ Yes | ✅ Yes |
| **View Own Proposals** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Edit Own Proposals** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Delete Own Proposals** | ✅ Yes | ✅ Yes | ✅ Yes |
| **View All Proposals** | ❌ No | ✅ Yes | ✅ Yes |
| **Delete Any Proposal** | ❌ No | ✅ Yes | ✅ Yes |
| **View Analytics** | ✅ Own | ✅ All | ✅ All |
| **View Live Viewers** | ✅ Own | ✅ All | ✅ All |
| **View Signed Proposals** | ✅ Yes | ✅ Yes | ✅ Yes |
| **My Profile** | ✅ Yes | ✅ Yes | ✅ Yes |
| **User Management** | ❌ No | ❌ No | ✅ Yes |
| **Change User Roles** | ❌ No | ❌ No | ✅ Yes |
| **Delete Users** | ❌ No | ❌ No | ✅ Yes |
| **View All Users** | ❌ No | ❌ No | ✅ Yes |
| **Analytics Dashboard** | ✅ Own | ✅ All | ✅ All |
| **Feedback Tab** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Discussions** | ✅ Own | ✅ All | ✅ All |
| **Admin Discussion Dashboard** | ❌ No | ✅ Yes | ✅ Yes |

---

## 🔐 Detailed Role Descriptions

### **USER (Regular User)**
Regular users can manage their own proposals but cannot see or manage other users' content.

**Allowed:**
- Upload new proposals
- View their own proposals
- Edit their own proposals
- Delete their own proposals
- View analytics for their own proposals
- See who's viewing their proposals in real-time
- Sign proposals
- View signed proposals
- Leave feedback on proposals
- Access their profile

**Restricted:**
- Cannot view other users' proposals
- Cannot delete other users' proposals
- Cannot access user management
- Cannot see all users
- Cannot change any user's role
- Cannot view admin discussion dashboard

---

### **ADMIN (Administrator)**
Admins have broader access and can manage content across the platform, but cannot manage users.

**Allowed:**
- Everything a User can do
- View ALL proposals (all users')
- Delete any proposal
- View analytics for all proposals
- See all live viewers across proposals
- Access admin discussion dashboard
- View feedback from all users
- See engagement metrics for all proposals

**Restricted:**
- Cannot access user management
- Cannot view all users list
- Cannot change any user's role
- Cannot delete users
- Cannot promote users to admin/superadmin

---

### **SUPERADMIN (Super Administrator)**
SuperAdmins have full system access including user management.

**Allowed:**
- Everything an Admin can do
- View all users
- Change any user's role (user → admin → superadmin)
- Delete users from the system
- Manage user access permissions
- Access user management dashboard
- Complete system administration

**No Restrictions:**
- Full access to all features
- Unlimited permissions

---

## 🛡️ Implementation Guide

### How to Restrict Access to Features:

#### **Method 1: Using Role-Based Components**

```jsx
import { AdminOnly, SuperAdminOnly, UserOnly } from "../Components/RoleBasedAccess";

// Only admins and superadmins see this
<AdminOnly fallback={<div>Access Denied</div>}>
  <AdminPanel />
</AdminOnly>

// Only superadmins see this
<SuperAdminOnly fallback={<div>SuperAdmin Only</div>}>
  <UserManagement />
</SuperAdminOnly>

// Only regular users see this
<UserOnly fallback={<div>Not for admins</div>}>
  <UserDashboard />
</UserOnly>
```

#### **Method 2: Using useUserRole Hook**

```jsx
import { useUserRole } from "../hooks/useUserRole";

export default function FeatureComponent() {
  const { role, loading } = useUserRole();

  if (loading) return <div>Loading...</div>;

  if (role === "superadmin") {
    return <SuperAdminFeature />;
  }

  if (role === "admin") {
    return <AdminFeature />;
  }

  if (role === "user") {
    return <UserFeature />;
  }

  return <div>Access Denied</div>;
}
```

#### **Method 3: Generic RoleBasedAccess Component**

```jsx
import { RoleBasedAccess } from "../Components/RoleBasedAccess";

<RoleBasedAccess 
  roles={["admin", "superadmin"]}
  fallback={<div>Admins only</div>}
>
  <AdminFeature />
</RoleBasedAccess>
```

---

## 📁 Current Access Control Files

All these files work together to provide access control:

```
src/
├── context/
│   └── UserRoleContext.jsx        # Manages user role state globally
├── hooks/
│   └── useUserRole.js             # Hook to access user role anywhere
├── Components/
│   ├── RoleBasedAccess.jsx        # Components for conditional rendering
│   ├── UserManagement.jsx         # SuperAdmin-only component
│   └── UserProfile.jsx            # User profile display
└── Pages/
    └── Dashboard.jsx              # Main dashboard with role-based tabs
```

---

## 🔒 Firestore Security Rules

The system is protected by Firestore rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - admins can read all, users only their own
    match /users/{userId} {
      allow read: if request.auth.uid == userId || 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "superadmin";
      allow create: if request.auth.uid == userId;
      allow update: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "superadmin";
      allow delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "superadmin";
    }

    // Proposals collection - users see own, admins see all
    match /proposals/{proposalId} {
      allow read: if resource.data.userId == request.auth.uid || 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ["admin", "superadmin"];
      allow create: if request.auth.uid != null;
      allow update: if resource.data.userId == request.auth.uid || 
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "superadmin";
      allow delete: if resource.data.userId == request.auth.uid || 
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ["admin", "superadmin"];
    }
  }
}
```

---

## 🎯 Feature Access Examples

### Dashboard Navigation

**Regular User sees:**
- Dashboard (home)
- Proposals (own only)
- Signed
- Upload
- Live Views
- Feedback
- Engagement
- Analytics
- My Profile

**Admin sees:**
All of the above PLUS visibility into all users' proposals

**SuperAdmin sees:**
All of the above PLUS:
- Users management tab (in See More menu)

---

## 🚀 Testing Access Control

### Test as Regular User:
1. Sign up at `/auth`
2. Role automatically set to `"user"`
3. You see only your proposals
4. Try accessing `/user-management` → Access Denied ✓

### Test as Admin:
1. SuperAdmin promotes you to `"admin"` via Users tab
2. You can now see all proposals
3. Try accessing `/user-management` → Access Denied ✓

### Test as SuperAdmin:
1. You have full access to everything
2. Go to Dashboard → See More → Users
3. Manage all users freely ✓

---

## 🛠️ Adding New Access Controls

To add access control to a new feature:

### Step 1: Identify the Role Requirement
```jsx
// Only SuperAdmin can do X
<SuperAdminOnly>
  <NewFeature />
</SuperAdminOnly>
```

### Step 2: Add Role Check in Component
```jsx
import { useUserRole } from "../hooks/useUserRole";

export default function NewFeature() {
  const { role, loading } = useUserRole();

  if (loading) return <div>Loading...</div>;
  if (role !== "superadmin") return <div>Access Denied</div>;

  return <div>SuperAdmin Content</div>;
}
```

### Step 3: Protect Backend Routes
If using a backend API, verify role server-side:
```javascript
// Cloud Function example
if (userRole !== "superadmin") {
  throw new Error("Unauthorized");
}
```

---

## 🔄 Role Hierarchy

```
SuperAdmin (Highest)
    ↓
    Admin
    ↓
User (Lowest)
```

**SuperAdmin can do everything Admins can do.**
**Admins can do everything Users can do.**
**Users have basic access.**

---

## ⚠️ Important Security Notes

1. **Never trust frontend checks alone** - Always verify on backend/Firestore
2. **Firestore Rules are enforced** - Users can't bypass them
3. **Role changes are immediate** - Requires page refresh to see changes
4. **SuperAdmin is powerful** - Only assign to trusted users

---

## 📞 Common Scenarios

### Scenario 1: User uploads a proposal
✅ **User**: Can upload, view, edit, delete their own
❌ **Others**: Cannot see or modify

### Scenario 2: Admin views analytics
✅ **Admin**: Can view ALL proposals analytics
❌ **User**: Can only view their own

### Scenario 3: User tries to delete another user's proposal
❌ **Blocked by frontend** - Not shown in UI
❌ **Blocked by Firestore rules** - Even if they try to force it

### Scenario 4: Promoting a user to admin
✅ **Only SuperAdmin** can do this via User Management
❌ **Users/Admins** cannot access the UI

---

## 🎓 Next Steps

1. Sign up and become SuperAdmin (via Firebase Console)
2. Go to Dashboard → See More → Users
3. Promote another user to Admin
4. Test accessing admin features with that account
5. Try accessing restricted features with a regular user account

All access is enforced both frontend and backend! 🔒
