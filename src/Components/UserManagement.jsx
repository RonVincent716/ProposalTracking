import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { initializeApp, deleteApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import "./UserManagement.css";

/**
 * UserManagement Component
 * Allows SuperAdmin to manage user roles (Admin, Regular User)
 */
export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionUserId, setActionUserId] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showCreateSuccessModal, setShowCreateSuccessModal] = useState(false);
  const [createdUserInfo, setCreatedUserInfo] = useState(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [newUserStatus, setNewUserStatus] = useState("active");

  // Fetch current user role
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        try {
          const currentUserRef = doc(db, "users", user.uid);
          const currentUserSnap = await getDoc(currentUserRef);
          setUserRole(currentUserSnap.exists() ? currentUserSnap.data()?.role : null);
        } catch (error) {
          console.error("Error fetching current user role:", error);
        }
      } else {
        setUserRole(null);
        setCurrentUserId(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const usersList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userRole === "superadmin") {
      fetchUsers();
    }
  }, [userRole]);

  const updateUserRole = async (userId, newRole) => {
    if (userId === currentUserId) {
      alert("You cannot change your own role!");
      return;
    }

    try {
      setActionUserId(userId);
      const userDocRef = doc(db, "users", userId);
      await updateDoc(userDocRef, {
        role: newRole,
        roleUpdatedAt: serverTimestamp()
      });
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      alert(`User role updated to ${newRole}`);
    } catch (error) {
      console.error("Error updating user role:", error);
      alert("Failed to update user role");
    } finally {
      setActionUserId(null);
    }
  };

  const getFriendlyAuthError = (error) => {
    switch (error?.code) {
      case "auth/email-already-in-use":
        return "This email is already registered.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/operation-not-allowed":
        return "Email/password sign-in is not enabled in Firebase Auth.";
      default:
        return error?.message || "Failed to create user.";
    }
  };

  const resetAddUserForm = () => {
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserName("");
    setNewUserRole("user");
    setNewUserStatus("active");
  };

  const addUser = async (e) => {
    e.preventDefault();

    const email = newUserEmail.trim().toLowerCase();
    const password = newUserPassword.trim();
    const displayName = newUserName.trim();

    if (!email || !password) {
      alert("Email and password are required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    const emailExists = users.some((u) => (u.email || "").toLowerCase() === email);
    if (emailExists) {
      alert("A user with this email already exists.");
      return;
    }

    setCreatingUser(true);
    let tempApp = null;
    let secondaryAuth = null;

    try {
      const appName = `superadmin-create-user-${Date.now()}`;
      tempApp = initializeApp(auth.app.options, appName);
      secondaryAuth = getAuth(tempApp);

      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const createdUid = cred.user.uid;
      const now = new Date();

      await setDoc(doc(db, "users", createdUid), {
        uid: createdUid,
        email,
        displayName: displayName || email.split("@")[0],
        role: newUserRole,
        status: newUserStatus,
        createdAt: serverTimestamp(),
        createdBy: currentUserId,
        roleUpdatedAt: serverTimestamp(),
        statusUpdatedAt: serverTimestamp(),
        suspendedAt: newUserStatus === "suspended" ? serverTimestamp() : null,
        suspendedBy: newUserStatus === "suspended" ? currentUserId : null
      });

      setUsers((prev) => [
        {
          id: createdUid,
          uid: createdUid,
          email,
          displayName: displayName || email.split("@")[0],
          role: newUserRole,
          status: newUserStatus,
          createdAt: now,
          roleUpdatedAt: now,
          statusUpdatedAt: now
        },
        ...prev
      ]);

      setCreatedUserInfo({
        email,
        role: newUserRole,
        status: newUserStatus
      });
      resetAddUserForm();
      setShowAddUserModal(false);
      setShowCreateSuccessModal(true);
    } catch (error) {
      console.error("Error creating user:", error);
      alert(getFriendlyAuthError(error));
    } finally {
      if (secondaryAuth) {
        try {
          await signOut(secondaryAuth);
        } catch (error) {
          console.warn("Secondary auth sign-out warning:", error);
        }
      }
      if (tempApp) {
        try {
          await deleteApp(tempApp);
        } catch (error) {
          console.warn("Temporary app cleanup warning:", error);
        }
      }
      setCreatingUser(false);
    }
  };

  const toggleUserStatus = async (user) => {
    if (user.id === currentUserId) {
      alert("You cannot change your own account status!");
      return;
    }

    const currentStatus = user.status === "suspended" ? "suspended" : "active";
    const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
    const confirmMessage =
      nextStatus === "suspended"
        ? `Suspend ${user.email}? They will lose access until reactivated.`
        : `Activate ${user.email}? They will regain access.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setActionUserId(user.id);

      const updatePayload = {
        status: nextStatus,
        statusUpdatedAt: serverTimestamp()
      };

      if (nextStatus === "suspended") {
        updatePayload.suspendedAt = serverTimestamp();
        updatePayload.suspendedBy = auth.currentUser?.uid || currentUserId;
      } else {
        updatePayload.suspendedAt = null;
        updatePayload.suspendedBy = null;
      }

      await updateDoc(doc(db, "users", user.id), updatePayload);

      setUsers(users.map(u =>
        u.id === user.id
          ? { ...u, status: nextStatus }
          : u
      ));
      alert(`User ${nextStatus === "suspended" ? "suspended" : "activated"} successfully`);
    } catch (error) {
      console.error("Error updating user status:", error);
      alert("Failed to update user status");
    } finally {
      setActionUserId(null);
    }
  };

  const deleteUser = async (userId) => {
    if (userId === currentUserId) {
      alert("You cannot delete your own account!");
      return;
    }

    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      setActionUserId(userId);
      await deleteDoc(doc(db, "users", userId));
      setUsers(users.filter(user => user.id !== userId));
      alert("User deleted successfully");
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    } finally {
      setActionUserId(null);
    }
  };

  const normalizeStatus = (status) => {
    return status === "suspended" ? "suspended" : "active";
  };

  const formatDate = (value) => {
    if (!value) return "N/A";
    if (typeof value?.toDate === "function") return value.toDate().toLocaleString();
    if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString();
    return new Date(value).toLocaleString();
  };

  const filteredUsers = users.filter((user) => {
    const email = (user.email || "").toLowerCase();
    const role = (user.role || "user").toLowerCase();
    const status = normalizeStatus(user.status);

    const matchesSearch =
      !searchTerm ||
      email.includes(searchTerm.toLowerCase()) ||
      role.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeCount = users.filter(user => normalizeStatus(user.status) === "active").length;
  const suspendedCount = users.filter(user => normalizeStatus(user.status) === "suspended").length;

  if (userRole !== "superadmin") {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>Only SuperAdmins can access user management</p>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="user-management">
      <div className="management-header">
        <div>
          <h1>User Management</h1>
          <p className="management-subtitle">SuperAdmin feature: suspend or reactivate user accounts.</p>
        </div>
        <button
          type="button"
          className="open-add-user-btn"
          onClick={() => setShowAddUserModal(true)}
        >
          Add User
        </button>
      </div>

      {showAddUserModal && (
        <div
          className="add-user-modal-overlay"
          onClick={() => !creatingUser && setShowAddUserModal(false)}
        >
          <div className="add-user-modal" onClick={(e) => e.stopPropagation()}>
            <form className="add-user-form" onSubmit={addUser}>
              <div className="add-user-modal-header">
                <div>
                  <h2>Add New User</h2>
                  <p>Create a new account and assign role and access status.</p>
                </div>
                <button
                  type="button"
                  className="close-modal-btn"
                  onClick={() => setShowAddUserModal(false)}
                  disabled={creatingUser}
                  aria-label="Close add user modal"
                >
                  X
                </button>
              </div>

              <div className="add-user-modal-body">
                <div className="add-user-grid">
                  <label className="field-group">
                    <span>Email Address</span>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      disabled={creatingUser}
                      required
                      autoFocus
                    />
                  </label>

                  <label className="field-group">
                    <span>Temporary Password</span>
                    <input
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      disabled={creatingUser}
                      minLength={6}
                      required
                    />
                  </label>

                  <label className="field-group">
                    <span>Display Name</span>
                    <input
                      type="text"
                      placeholder="Optional display name"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      disabled={creatingUser}
                    />
                  </label>

                  <label className="field-group">
                    <span>Role</span>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      disabled={creatingUser}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">SuperAdmin</option>
                    </select>
                  </label>

                  <label className="field-group">
                    <span>Account Status</span>
                    <select
                      value={newUserStatus}
                      onChange={(e) => setNewUserStatus(e.target.value)}
                      disabled={creatingUser}
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="add-user-actions">
                <button
                  type="button"
                  className="cancel-user-btn"
                  onClick={() => setShowAddUserModal(false)}
                  disabled={creatingUser}
                >
                  Cancel
                </button>
                <button type="submit" disabled={creatingUser} className="create-user-btn">
                  {creatingUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateSuccessModal && (
        <div
          className="add-user-modal-overlay success-modal-overlay"
          onClick={() => setShowCreateSuccessModal(false)}
        >
          <div className="success-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="success-modal-icon" aria-hidden="true">OK</div>
            <h3>User Created Successfully</h3>
            <p>The account has been created and is ready to use.</p>

            <div className="success-user-details">
              <div>
                <span>Email</span>
                <strong>{createdUserInfo?.email}</strong>
              </div>
              <div>
                <span>Role</span>
                <strong>{createdUserInfo?.role}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{createdUserInfo?.status}</strong>
              </div>
            </div>

            <div className="success-modal-actions">
              <button
                type="button"
                className="cancel-user-btn"
                onClick={() => setShowCreateSuccessModal(false)}
              >
                Done
              </button>
              <button
                type="button"
                className="create-user-btn"
                onClick={() => {
                  setShowCreateSuccessModal(false);
                  setShowAddUserModal(true);
                }}
              >
                Add Another User
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="management-stats">
        <div className="stat-card">
          <span>Total Users</span>
          <strong>{users.length}</strong>
        </div>
        <div className="stat-card active">
          <span>Active</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="stat-card suspended">
          <span>Suspended</span>
          <strong>{suspendedCount}</strong>
        </div>
      </div>

      <div className="management-filters">
        <input
          type="text"
          placeholder="Search by email or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="users-table">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>
                  <span className={`role-badge role-${user.role || "user"}`}>
                    {user.role || "user"}
                  </span>
                </td>
                <td>
                  <span className={`status-badge status-${normalizeStatus(user.status)}`}>
                    {normalizeStatus(user.status)}
                  </span>
                </td>
                <td>{formatDate(user.createdAt)}</td>
                <td>{formatDate(user.statusUpdatedAt || user.roleUpdatedAt)}</td>
                <td className="actions">
                  <select 
                    value={user.role || "user"}
                    onChange={(e) => updateUserRole(user.id, e.target.value)}
                    disabled={user.id === currentUserId || actionUserId === user.id}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">SuperAdmin</option>
                  </select>
                  <button
                    onClick={() => toggleUserStatus(user)}
                    disabled={user.id === currentUserId || actionUserId === user.id}
                    className={normalizeStatus(user.status) === "suspended" ? "activate-btn" : "suspend-btn"}
                  >
                    {normalizeStatus(user.status) === "suspended" ? "Activate" : "Suspend"}
                  </button>
                  <button 
                    onClick={() => deleteUser(user.id)}
                    disabled={user.id === currentUserId || actionUserId === user.id}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan="6" className="empty-row">
                  No users found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

