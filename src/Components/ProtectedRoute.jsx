import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function ProtectedRoute({ children }) {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {

      setUser(currentUser);
      setLoading(false);

    });

    return () => unsubscribe();

  }, []);

  if (loading) return (
    <div style={loaderContainer}>
      <div style={spinner}></div>
      <p style={loaderText}>Checking authentication...</p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (!user) return <Navigate to="/login" />;

  return children;

}

// Loader Styles
const loaderContainer = {
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  gap: "20px",
};

const spinner = {
  width: "50px",
  height: "50px",
  border: "4px solid rgba(255, 255, 255, 0.3)",
  borderTop: "4px solid #00D4FF",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const loaderText = {
  color: "#fff",
  fontSize: "16px",
  fontWeight: 500,
  letterSpacing: "0.5px",
  margin: 0,
};