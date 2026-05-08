import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import {
  deleteUser,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from "firebase/auth";
import { deleteDoc, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ActivityLogger } from "../utils/activityLogger";
import "./UserProfile.css";

const DEFAULT_PREFS = {
  notifications: true,
  theme: "system",
  language: "en"
};

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  const [profileForm, setProfileForm] = useState({
    displayName: "",
    phone: "",
    bio: ""
  });

  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setUserRole(data.role || "user");
          setProfileForm({
            displayName: currentUser.displayName || data.displayName || "",
            phone: data.phone || "",
            bio: data.bio || ""
          });
          setPrefs({ ...DEFAULT_PREFS, ...(data.preferences || {}) });
        } else {
          setUserRole("user");
          setProfileForm({
            displayName: currentUser.displayName || "",
            phone: "",
            bio: ""
          });
          setPrefs(DEFAULT_PREFS);
        }
      } catch (error) {
        console.error("Error loading profile:", error);
        setUserRole("user");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const setStatus = (text, type = "info") => {
    setMessage({ text, type });
  };

  const handleProfileChange = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = async () => {
    if (!user) return;
    const displayName = profileForm.displayName.trim();
    if (!displayName || displayName.length < 2) {
      setStatus("Display name must be at least 2 characters.", "error");
      return;
    }

    try {
      setSavingProfile(true);
      setStatus("");

      await updateProfile(user, { displayName });

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email || null,
          displayName,
          phone: profileForm.phone.trim(),
          bio: profileForm.bio.trim(),
          role: userRole || "user",
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      // Log profile update activity
      const updatedFields = ['displayName', 'phone', 'bio'];
      await ActivityLogger.logProfileUpdate(updatedFields);

      setUser({ ...user, displayName });
      setStatus("Profile details updated.", "success");
    } catch (error) {
      console.error("Error saving profile:", error);
      setStatus("Failed to save profile details.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePreferences = async () => {
    if (!user) return;
    try {
      setSavingPrefs(true);
      setStatus("");
      await setDoc(
        doc(db, "users", user.uid),
        {
          preferences: prefs,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      
      // Log preferences update activity
      const updatedFields = Object.keys(prefs);
      await ActivityLogger.logProfileUpdate(updatedFields);

      setStatus("Account settings saved.", "success");
    } catch (error) {
      console.error("Error saving preferences:", error);
      setStatus("Failed to save account settings.", "error");
    } finally {
      setSavingPrefs(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      setStatus("Password reset email sent. Check your inbox.", "success");
    } catch (error) {
      console.error("Error sending reset email:", error);
      setStatus("Could not send password reset email.", "error");
    }
  };

  const exportData = (format = "json") => {
    if (!user) return;

    const payload = {
      uid: user.uid,
      email: user.email || "",
      emailVerified: !!user.emailVerified,
      role: userRole || "user",
      displayName: profileForm.displayName || "",
      phone: profileForm.phone || "",
      bio: profileForm.bio || "",
      preferences: prefs,
      accountCreated: user.metadata?.creationTime || null,
      lastSignIn: user.metadata?.lastSignInTime || null,
      exportedAt: new Date().toISOString()
    };

    let blob;
    let filename;

    if (format === "csv") {
      const rows = [
        ["field", "value"],
        ["uid", payload.uid],
        ["email", payload.email],
        ["emailVerified", String(payload.emailVerified)],
        ["role", payload.role],
        ["displayName", payload.displayName],
        ["phone", payload.phone],
        ["bio", payload.bio],
        ["notifications", String(payload.preferences.notifications)],
        ["theme", payload.preferences.theme],
        ["language", payload.preferences.language],
        ["accountCreated", payload.accountCreated || ""],
        ["lastSignIn", payload.lastSignIn || ""],
        ["exportedAt", payload.exportedAt]
      ];
      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      filename = "myprofile-data.csv";
    } else {
      blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      filename = "myprofile-data.json";
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(`Data exported as ${format.toUpperCase()}.`, "success");
  };

  const deleteAccountNow = async () => {
    if (!user) return;

    const firstConfirm = window.confirm("Delete your account permanently?");
    if (!firstConfirm) return;
    const secondConfirm = window.confirm("This cannot be undone. Continue?");
    if (!secondConfirm) return;

    try {
      setDeleting(true);
      await deleteUser(user);
      try {
        await deleteDoc(doc(db, "users", user.uid));
      } catch (cleanupError) {
        console.warn("User document cleanup warning:", cleanupError);
      }
      setStatus("Account deleted successfully.", "success");
    } catch (error) {
      console.error("Error deleting account:", error);
      if (error?.code === "auth/requires-recent-login") {
        setStatus("Please sign in again before deleting your account.", "error");
      } else {
        setStatus("Failed to delete account.", "error");
      }
    } finally {
      setDeleting(false);
    }
  };

  const currentSession = useMemo(() => {
    const ua = navigator.userAgent || "Unknown browser";
    const browser = ua.includes("Chrome")
      ? "Chrome"
      : ua.includes("Firefox")
      ? "Firefox"
      : ua.includes("Safari")
      ? "Safari"
      : "Browser";
    return {
      browser,
      platform: navigator.platform || "Unknown OS",
      lastSignIn: user?.metadata?.lastSignInTime || "N/A"
    };
  }, [user]);

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  if (!user) {
    return <div className="not-logged-in">Please log in to view your profile</div>;
  }

  return (
    <div className="user-profile">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">{user.email?.charAt(0).toUpperCase()}</div>
          <div className="profile-info">
            <h2>{profileForm.displayName || user.displayName || "User"}</h2>
            <p className="email">{user.email}</p>
          </div>
        </div>

        {message.text && (
          <div className={`profile-banner ${message.type || "info"}`}>{message.text}</div>
        )}

        <div className="profile-section">
          <h3>Edit Profile</h3>
          <div className="form-grid">
            <div>
              <label>Display Name</label>
              <input
                type="text"
                value={profileForm.displayName}
                onChange={(e) => handleProfileChange("displayName", e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <label>Phone</label>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(e) => handleProfileChange("phone", e.target.value)}
                placeholder="+1 555 123 4567"
              />
            </div>
          </div>
          <div>
            <label>Bio</label>
            <textarea
              rows={3}
              value={profileForm.bio}
              onChange={(e) => handleProfileChange("bio", e.target.value)}
              placeholder="Tell us about yourself"
            />
          </div>
          <button className="save-btn" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save Profile"}
          </button>
        </div>

        <div className="profile-section">
          <h3>Account Settings</h3>
          <div className="settings-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={prefs.notifications}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, notifications: e.target.checked }))
                }
              />
              Email Notifications
            </label>
          </div>
          <div className="form-grid">
            <div>
              <label>Theme Preference</label>
              <select
                value={prefs.theme}
                onChange={(e) => setPrefs((prev) => ({ ...prev, theme: e.target.value }))}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div>
              <label>Language</label>
              <select
                value={prefs.language}
                onChange={(e) => setPrefs((prev) => ({ ...prev, language: e.target.value }))}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
          </div>
          <button className="save-btn" onClick={savePreferences} disabled={savingPrefs}>
            {savingPrefs ? "Saving..." : "Save Settings"}
          </button>
        </div>

        <div className="profile-section">
          <h3>Security Settings</h3>
          <div className="detail-item">
            <label>Role</label>
            <span className={`role-badge role-${userRole}`}>{userRole?.toUpperCase()}</span>
          </div>
          <div className="detail-item">
            <label>Email Verified</label>
            <span>{user.emailVerified ? "Yes" : "No"}</span>
          </div>
          <div className="detail-item">
            <label>Account Created</label>
            <span>
              {user.metadata?.creationTime
                ? new Date(user.metadata.creationTime).toLocaleString()
                : "N/A"}
            </span>
          </div>
          <div className="detail-item">
            <label>Last Sign-in</label>
            <span>
              {user.metadata?.lastSignInTime
                ? new Date(user.metadata.lastSignInTime).toLocaleString()
                : "N/A"}
            </span>
          </div>
          <button className="action-btn" onClick={sendPasswordReset}>
            Send Password Reset Email
          </button>
        </div>

        <div className="profile-section">
          <h3>Session Management</h3>
          <div className="detail-item">
            <label>Current Browser</label>
            <span>{currentSession.browser}</span>
          </div>
          <div className="detail-item">
            <label>Platform</label>
            <span>{currentSession.platform}</span>
          </div>
          <div className="detail-item">
            <label>Last Active</label>
            <span>{currentSession.lastSignIn}</span>
          </div>
          <button className="action-btn" onClick={() => signOut(auth)}>
            Sign Out This Device
          </button>
        </div>

        <div className="profile-section">
          <h3>Data Export</h3>
          <div className="action-group">
            <button className="action-btn" onClick={() => exportData("json")}>
              Download JSON
            </button>
            <button className="action-btn secondary" onClick={() => exportData("csv")}>
              Download CSV
            </button>
          </div>
        </div>

        <div className="profile-section danger">
          <h3>Delete Account</h3>
          <p className="danger-text">
            Permanently remove your account. This action cannot be undone.
          </p>
          <button className="danger-btn" onClick={deleteAccountNow} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
