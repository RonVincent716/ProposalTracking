import { createContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export const UserRoleContext = createContext();

export const UserRoleProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          setUser(currentUser);

          // Fetch user role from Firestore
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserRole(userData.role || "user"); // Default to 'user' if no role is set
          } else {
            setUserRole("user"); // Default role if user document doesn't exist
          }
        } else {
          setUser(null);
          setUserRole(null);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error fetching user role:", err);
        setError(err.message);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    role: userRole,
    userRole,
    loading,
    error,
    isAdmin: userRole === "admin",
    isSuperAdmin: userRole === "superadmin",
    isUser: userRole === "user",
  };

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
};
