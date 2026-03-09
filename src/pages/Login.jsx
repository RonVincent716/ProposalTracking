// src/pages/Login.jsx
import { useState, useEffect } from "react";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";


export default function Login() {  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate("/dashboard");
    });
    return () => unsub();
  }, [navigate]);

  // Email/password login
  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // User info: result.user
      navigate("/dashboard");
    } catch (err) {
      console.error("Google Sign-In Error:", err);
      setError(err.message || "Google Sign-In failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={container}>
      <form
        style={form}
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        <h2 style={title}>Login</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
          required
        />

        {error && <p style={errorMsg}>{error}</p>}

        <button type="submit" style={button} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        {/* Google Sign-In */}
        <button
          type="button"
          style={googleBtn}
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <FcGoogle style={{ marginRight: 8, fontSize: 20 }} />
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>

        {/* Signup link */}
        <p style={{ marginTop: 15, textAlign: "center" }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "#1976d2", textDecoration: "underline" }}>
            Sign Up here
          </Link>
        </p>
      </form>
    </div>
  );
}

// ------------------- STYLES -------------------

const container = {
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "#f4f6f8",
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
};

const form = {
  backgroundColor: "white",
  padding: "40px",
  borderRadius: "10px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  width: "320px",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const title = {
  textAlign: "center",
  color: "#1976d2",
  marginBottom: "10px",
};

const input = {
  padding: "12px",
  fontSize: "16px",
  borderRadius: "6px",
  border: "1px solid #ccc",
  outline: "none",
  transition: "border-color 0.3s",
};

const button = {
  padding: "12px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#1976d2",
  color: "#fff",
  fontSize: "16px",
  cursor: "pointer",
  transition: "background-color 0.3s",
};

const googleBtn = {
  padding: "12px",
  border: "none",
  borderRadius: "6px",
  backgroundColor: "#DB4437",
  color: "#fff",
  fontSize: "16px",
  cursor: "pointer",
};

const errorMsg = {
  color: "#e53935",
  fontSize: "14px",
  textAlign: "center",
  marginTop: "-10px",
};