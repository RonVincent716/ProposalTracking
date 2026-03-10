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
import { MdOutlineEmail, MdLock, MdLogin, MdPersonAdd, MdDashboard } from "react-icons/md";


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

  // Login form JSX with modern design
  return (
    <div style={pageContainer}>
      {/* Animated Background */}
      <div style={bgAnimation}>
        <div style={bgCircle1}></div>
        <div style={bgCircle2}></div>
        <div style={bgCircle3}></div>
      </div>

      {/* Glass Card */}
      <div style={cardContainer}>
        <div style={glassCard}>
          {/* Logo/Header */}
          <div style={headerSection}>
            <div style={logoIcon}>
              <MdDashboard size={40} color="#00D4FF" />
            </div>
            <h1 style={title}>Welcome Back</h1>
            <p style={subtitle}>Sign in to manage your proposals</p>
          </div>

          <form
            style={form}
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            {/* Email Input */}
            <div style={inputGroup}>
              <MdOutlineEmail style={inputIcon} size={20} />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={input}
                required
              />
            </div>

            {/* Password Input */}
            <div style={inputGroup}>
              <MdLock style={inputIcon} size={20} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={input}
                required
              />
            </div>

            {/* Error Message */}
            {error && <p style={errorMsg}>{error}</p>}

            {/* Login Button */}
            <button type="submit" style={primaryBtn} disabled={loading}>
              <MdLogin size={20} style={{ marginRight: 8 }} />
              {loading ? "Signing in..." : "Sign In"}
            </button>

            {/* Divider */}
            <div style={divider}>
              <span style={dividerLine}></span>
              <span style={dividerText}>or continue with</span>
              <span style={dividerLine}></span>
            </div>

            {/* Google Sign-In */}
            <button
              type="button"
              style={googleBtn}
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <FcGoogle style={{ fontSize: 22 }} />
              <span>Google</span>
            </button>

            {/* Signup link */}
            <p style={signupText}>
              Don't have an account?{" "}
              <Link to="/signup" style={signupLink}>
                Create one
              </Link>
            </p>
          </form>
        </div>

        {/* Side decoration */}
        <div style={sideDecoration}>
          <div style={decorationCard}>
            <h2 style={decorationTitle}>Proposal Tracker</h2>
            <p style={decorationText}>Manage, track, and analyze your business proposals with ease</p>
            <div style={featureList}>
              <div style={featureItem}>
                <span style={featureDot}></span>
                <span>Upload & share proposals</span>
              </div>
              <div style={featureItem}>
                <span style={featureDot}></span>
                <span>Real-time view tracking</span>
              </div>
              <div style={featureItem}>
                <span style={featureDot}></span>
                <span>Engagement analytics</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes floatReverse {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(20px) rotate(-5deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

// ------------------- STYLES -------------------

// Page Container with animated gradient background
const pageContainer = {
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  position: "relative",
  overflow: "hidden",
};

// Animated Background Elements
const bgAnimation = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: "hidden",
};

const bgCircle1 = {
  position: "absolute",
  width: "600px",
  height: "600px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
  top: "-200px",
  left: "-200px",
  animation: "float 20s ease-in-out infinite",
};

const bgCircle2 = {
  position: "absolute",
  width: "500px",
  height: "500px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%)",
  bottom: "-150px",
  right: "-100px",
  animation: "floatReverse 15s ease-in-out infinite",
};

const bgCircle3 = {
  position: "absolute",
  width: "300px",
  height: "300px",
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  animation: "pulse 8s ease-in-out infinite",
};

// Card Container
const cardContainer = {
  display: "flex",
  gap: "40px",
  alignItems: "center",
  zIndex: 10,
  maxWidth: "900px",
  width: "90%",
};

// Glassmorphism Login Card
const glassCard = {
  background: "rgba(255, 255, 255, 0.95)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  padding: "50px 45px",
  borderRadius: "24px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.3) inset",
  width: "420px",
  flexShrink: 0,
};

// Header Section
const headerSection = {
  textAlign: "center",
  marginBottom: "35px",
};

const logoIcon = {
  width: "70px",
  height: "70px",
  borderRadius: "20px",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 20px",
  boxShadow: "0 8px 24px rgba(102, 126, 234, 0.4)",
};

const title = {
  fontSize: "28px",
  fontWeight: "700",
  color: "#1a1a2e",
  margin: "0 0 8px 0",
  letterSpacing: "-0.5px",
};

const subtitle = {
  fontSize: "14px",
  color: "#666",
  margin: 0,
};

// Form Styles
const form = {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const inputGroup = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

const inputIcon = {
  position: "absolute",
  left: "16px",
  color: "#667eea",
};

const input = {
  width: "100%",
  padding: "14px 16px 14px 48px",
  fontSize: "15px",
  borderRadius: "12px",
  border: "2px solid #e8ecf4",
  outline: "none",
  transition: "all 0.3s ease",
  background: "#fafbfc",
  color: "#333",
};

const primaryBtn = {
  width: "100%",
  padding: "14px",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "600",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  boxShadow: "0 4px 16px rgba(102, 126, 234, 0.4)",
  transition: "all 0.3s ease",
};

const divider = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  margin: "8px 0",
};

const dividerLine = {
  flex: 1,
  height: "1px",
  background: "#e8ecf4",
};

const dividerText = {
  fontSize: "12px",
  color: "#999",
  fontWeight: "500",
};

const googleBtn = {
  width: "100%",
  padding: "14px",
  border: "2px solid #e8ecf4",
  borderRadius: "12px",
  background: "#fff",
  color: "#333",
  fontSize: "15px",
  fontWeight: "500",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  transition: "all 0.3s ease",
};

const errorMsg = {
  color: "#e53935",
  fontSize: "13px",
  textAlign: "center",
  padding: "10px 16px",
  background: "#ffebee",
  borderRadius: "8px",
  margin: "-5px 0",
};

const signupText = {
  textAlign: "center",
  fontSize: "14px",
  color: "#666",
  margin: "10px 0 0 0",
};

const signupLink = {
  color: "#667eea",
  textDecoration: "none",
  fontWeight: "600",
  transition: "color 0.3s",
};

// Side Decoration (hidden on mobile)
const sideDecoration = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const decorationCard = {
  background: "rgba(255, 255, 255, 0.1)",
  backdropFilter: "blur(10px)",
  padding: "40px",
  borderRadius: "20px",
  color: "#fff",
  maxWidth: "320px",
};

const decorationTitle = {
  fontSize: "32px",
  fontWeight: "700",
  margin: "0 0 16px 0",
  textShadow: "0 2px 10px rgba(0,0,0,0.2)",
};

const decorationText = {
  fontSize: "16px",
  opacity: 0.9,
  marginBottom: "30px",
  lineHeight: 1.6,
};

const featureList = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const featureItem = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  fontSize: "14px",
  opacity: 0.95,
};

const featureDot = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "#00D4FF",
  boxShadow: "0 0 10px #00D4FF",
};