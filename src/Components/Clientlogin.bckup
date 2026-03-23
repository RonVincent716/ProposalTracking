import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { 
  MdEmail, 
  MdLock, 
  MdVisibility, 
  MdVisibilityOff,
  MdArrowBack,
  MdPerson,
  MdDescription
} from "react-icons/md";
import { FcGoogle } from "react-icons/fc"; 

export default function ClientLogin() {
  const { path } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [proposalInfo, setProposalInfo] = useState(null);

  // Get the return URL from query params or use the encoded path
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo") || (path ? `/p/${path}` : "/");

  useEffect(() => {
    // Check if user is already logged in
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // User is logged in, redirect to proposal
        navigate(returnTo);
      }
    });

    // Try to get proposal name from encoded path
    if (path) {
      try {
        const decodedPath = atob(path);
        const fileName = decodedPath.split('/').pop();
        setProposalInfo({
          name: fileName,
          path: decodedPath
        });
      } catch (e) {
        console.error("Error decoding path:", e);
      }
    }

    return () => unsubscribe();
  }, [path, navigate, returnTo]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if this is a client account
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      if (userDoc.exists() && userDoc.data().role === "client") {
        // Valid client, redirect to proposal
        navigate(returnTo);
      } else {
        // This is an admin account, show error
        await auth.signOut();
        setError("This account is not authorized to view proposals. Please use a client account or sign up as a client.");
      }
    } catch (error) {
      console.error("Login error:", error);
      switch (error.code) {
        case 'auth/user-not-found':
          setError("No account found with this email. Please sign up first.");
          break;
        case 'auth/wrong-password':
          setError("Incorrect password. Please try again.");
          break;
        case 'auth/invalid-email':
          setError("Invalid email address format.");
          break;
        case 'auth/too-many-requests':
          setError("Too many failed attempts. Please try again later.");
          break;
        default:
          setError("Failed to login. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Store additional user info in Firestore with role = "client"
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        email: email,
        role: "client",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });

      // Redirect to proposal
      navigate(returnTo);
    } catch (error) {
      console.error("Signup error:", error);
      switch (error.code) {
        case 'auth/email-already-in-use':
          setError("This email is already registered. Please login instead.");
          break;
        case 'auth/invalid-email':
          setError("Invalid email address format.");
          break;
        case 'auth/weak-password':
          setError("Password is too weak. Please use a stronger password.");
          break;
        default:
          setError("Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if user exists in Firestore, if not create with client role
      const userDoc = await getDoc(doc(db, "users", result.user.uid));
      
      if (!userDoc.exists()) {
        // New user - create with client role
        await setDoc(doc(db, "users", result.user.uid), {
          name: result.user.displayName || "Client",
          email: result.user.email,
          role: "client",
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
      } else if (userDoc.data().role !== "client") {
        // Existing user but not a client
        await auth.signOut();
        setError("This account is not authorized to view proposals.");
        setLoading(false);
        return;
      }

      // Redirect to proposal
      navigate(returnTo);
    } catch (error) {
      console.error("Google sign-in error:", error);
      setError("Failed to sign in with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
      setTimeout(() => {
        setShowReset(false);
        setResetSent(false);
        setResetEmail("");
      }, 3000);
    } catch (error) {
      console.error("Password reset error:", error);
      setError("Failed to send reset email. Please check the email address.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      {/* Background Decoration */}
      <div style={backgroundStyle}></div>
      
      {/* Main Card */}
      <div style={cardStyle}>
        {/* Header with Back Button */}
        <div style={headerStyle}>
          <button onClick={() => navigate(-1)} style={backButtonStyle}>
            <MdArrowBack size={20} />
            Back
          </button>
          <div style={logoStyle}>
            <MdDescription size={28} color="#00D4FF" />
            <span style={logoTextStyle}>Proposal Access</span>
          </div>
        </div>

        {/* Proposal Info */}
        {proposalInfo && (
          <div style={proposalInfoStyle}>
            <MdDescription size={16} color="#00D4FF" />
            <span style={proposalNameStyle}>{proposalInfo.name}</span>
          </div>
        )}

        {/* Title */}
        <h2 style={titleStyle}>
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>
        <p style={subtitleStyle}>
          {isLogin 
            ? "Sign in to view the proposal" 
            : "Sign up to access the proposal"}
        </p>

        {/* Error Message */}
        {error && (
          <div style={errorStyle}>
            {error}
          </div>
        )}

        {/* Reset Success Message */}
        {resetSent && (
          <div style={successStyle}>
            Password reset email sent! Check your inbox.
          </div>
        )}

        {/* Reset Password Form */}
        {showReset ? (
          <form onSubmit={handlePasswordReset} style={formStyle}>
            <div style={inputGroupStyle}>
              <MdEmail size={20} color="#666" style={inputIconStyle} />
              <input
                type="email"
                placeholder="Email address"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            <div style={buttonGroupStyle}>
              <button
                type="button"
                onClick={() => setShowReset(false)}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={primaryButtonStyle(loading)}
              >
                {loading ? "Sending..." : "Send Reset Email"}
              </button>
            </div>
          </form>
        ) : (
          /* Login/Signup Form */
          <form onSubmit={isLogin ? handleLogin : handleSignUp} style={formStyle}>
            {!isLogin && (
              <div style={inputGroupStyle}>
                <MdPerson size={20} color="#666" style={inputIconStyle} />
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                  required={!isLogin}
                />
              </div>
            )}

            <div style={inputGroupStyle}>
              <MdEmail size={20} color="#666" style={inputIconStyle} />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            <div style={inputGroupStyle}>
              <MdLock size={20} color="#666" style={inputIconStyle} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={passwordToggleStyle}
              >
                {showPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
              </button>
            </div>

            {!isLogin && (
              <div style={inputGroupStyle}>
                <MdLock size={20} color="#666" style={inputIconStyle} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={inputStyle}
                  required={!isLogin}
                />
              </div>
            )}

            {isLogin && (
              <button
                type="button"
                onClick={() => setShowReset(true)}
                style={forgotPasswordStyle}
              >
                Forgot password?
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              style={submitButtonStyle(loading)}
            >
              {loading ? "Please wait..." : (isLogin ? "Sign In" : "Create Account")}
            </button>
          </form>
        )}

        {/* Google Sign In Button */}
        {!showReset && (
          <>
            <div style={dividerStyle}>
              <span style={dividerTextStyle}>or</span>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={googleButtonStyle(loading)}
            >
              <FcGoogle size={20} /> {/* Changed from MdGoogle to FcGoogle */}
              Continue with Google
            </button>
          </>
        )}

        {/* Toggle Login/Signup */}
        {!showReset && (
          <div style={toggleContainerStyle}>
            <span style={toggleTextStyle}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setEmail("");
                setPassword("");
                setConfirmPassword("");
                setName("");
              }}
              style={toggleButtonStyle}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>
        )}

        {/* Terms and Privacy */}
        <p style={termsStyle}>
          By continuing, you agree to our{" "}
          <a href="/terms" style={linkStyle}>Terms of Service</a>{" "}
          and{" "}
          <a href="/privacy" style={linkStyle}>Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}

// Styles
const containerStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  padding: "20px",
  fontFamily: "'Inter', sans-serif",
  position: "relative",
  overflow: "hidden",
};

const backgroundStyle = {
  position: "absolute",
  top: "-50%",
  right: "-50%",
  bottom: "-50%",
  left: "-50%",
  background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
  animation: "rotate 20s linear infinite",
};

const cardStyle = {
  background: "rgba(255, 255, 255, 0.95)",
  backdropFilter: "blur(10px)",
  borderRadius: "24px",
  padding: "40px",
  maxWidth: "450px",
  width: "100%",
  boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.2)",
  position: "relative",
  zIndex: 10,
  animation: "slideUp 0.5s ease",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "30px",
};

const backButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  background: "rgba(0,0,0,0.05)",
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: "8px",
  color: "#666",
  fontSize: "14px",
  cursor: "pointer",
  transition: "all 0.2s",
};

const logoStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const logoTextStyle = {
  fontSize: "20px",
  fontWeight: "700",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const proposalInfoStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 16px",
  background: "#f8fafc",
  borderRadius: "12px",
  marginBottom: "20px",
  border: "1px solid #e2e8f0",
};

const proposalNameStyle = {
  fontSize: "14px",
  color: "#1a1a2e",
  fontWeight: "500",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const titleStyle = {
  fontSize: "28px",
  fontWeight: "700",
  color: "#1a1a2e",
  margin: "0 0 10px 0",
};

const subtitleStyle = {
  fontSize: "15px",
  color: "#666",
  margin: "0 0 30px 0",
};

const errorStyle = {
  background: "#fee",
  color: "#c33",
  padding: "12px 16px",
  borderRadius: "8px",
  fontSize: "14px",
  marginBottom: "20px",
  border: "1px solid #fcc",
};

const successStyle = {
  background: "#e8f5e9",
  color: "#2e7d32",
  padding: "12px 16px",
  borderRadius: "8px",
  fontSize: "14px",
  marginBottom: "20px",
  border: "1px solid #a5d6a7",
};

const formStyle = {
  marginBottom: "20px",
};

const inputGroupStyle = {
  position: "relative",
  marginBottom: "15px",
  display: "flex",
  alignItems: "center",
};

const inputIconStyle = {
  position: "absolute",
  left: "12px",
  zIndex: 1,
};

const inputStyle = {
  width: "100%",
  padding: "14px 14px 14px 42px",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  fontSize: "15px",
  outline: "none",
  transition: "all 0.2s",
  background: "#fff",
};

const passwordToggleStyle = {
  position: "absolute",
  right: "12px",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#666",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px",
};

const forgotPasswordStyle = {
  background: "none",
  border: "none",
  color: "#667eea",
  fontSize: "14px",
  cursor: "pointer",
  textAlign: "right",
  width: "100%",
  marginBottom: "20px",
};

const submitButtonStyle = (disabled) => ({
  width: "100%",
  padding: "14px",
  background: disabled ? "#a0aec0" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  border: "none",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "600",
  cursor: disabled ? "not-allowed" : "pointer",
  boxShadow: disabled ? "none" : "0 10px 20px rgba(102, 126, 234, 0.3)",
  transition: "all 0.3s",
});

const buttonGroupStyle = {
  display: "flex",
  gap: "12px",
  marginTop: "20px",
};

const primaryButtonStyle = (disabled) => ({
  flex: 2,
  padding: "12px",
  background: disabled ? "#a0aec0" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  cursor: disabled ? "not-allowed" : "pointer",
});

const secondaryButtonStyle = {
  flex: 1,
  padding: "12px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  color: "#64748b",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
};

const dividerStyle = {
  position: "relative",
  textAlign: "center",
  margin: "20px 0",
};

const dividerTextStyle = {
  background: "#fff",
  padding: "0 10px",
  color: "#999",
  fontSize: "14px",
  position: "relative",
  zIndex: 1,
};

const googleButtonStyle = (disabled) => ({
  width: "100%",
  padding: "12px",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  color: "#1a1a2e",
  fontSize: "15px",
  fontWeight: "500",
  cursor: disabled ? "not-allowed" : "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  transition: "all 0.2s",
  opacity: disabled ? 0.6 : 1,
});

const toggleContainerStyle = {
  marginTop: "20px",
  textAlign: "center",
};

const toggleTextStyle = {
  color: "#666",
  fontSize: "14px",
};

const toggleButtonStyle = {
  background: "none",
  border: "none",
  color: "#667eea",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  marginLeft: "5px",
};

const termsStyle = {
  marginTop: "30px",
  fontSize: "12px",
  color: "#999",
  textAlign: "center",
};

const linkStyle = {
  color: "#667eea",
  textDecoration: "none",
};