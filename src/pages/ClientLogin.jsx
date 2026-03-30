import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  updatePassword,
  fetchSignInMethodsForEmail
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, updateDoc, query, collection, where, getDocs } from "firebase/firestore";
import { 
  MdEmail, 
  MdLock, 
  MdVisibility, 
  MdVisibilityOff,
  MdArrowBack,
  MdPerson,
  MdDescription,
  MdCheckCircle,
  MdWarning,
  MdDashboard,
  MdHistory,
  MdDelete,
  MdVerified
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
  const [redirectTo, setRedirectTo] = useState("/client-dashboard");
  const [rememberEmail, setRememberEmail] = useState(true);
  const [savedEmails, setSavedEmails] = useState([]);
  const [passwordSetupSent, setPasswordSetupSent] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState("");

  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo");

  // Load saved emails from localStorage on component mount
  useEffect(() => {
    const loadSavedEmails = () => {
      try {
        const saved = localStorage.getItem("savedClientEmails");
        if (saved) {
          const emails = JSON.parse(saved);
          setSavedEmails(emails);
          // If there's a last used email, set it
          const lastUsed = localStorage.getItem("lastUsedClientEmail");
          if (lastUsed && emails.includes(lastUsed)) {
            setEmail(lastUsed);
            // Focus password field when email is auto-filled
            setTimeout(() => {
              const passwordInput = document.getElementById("password-input");
              if (passwordInput) passwordInput.focus();
            }, 100);
          }
        }
      } catch (error) {
        console.error("Error loading saved emails:", error);
      }
    };
    loadSavedEmails();
  }, []);

  // Save email to localStorage when remembered
  const saveEmailToStorage = (emailToSave) => {
    if (!rememberEmail) return;
    
    try {
      let emails = [...savedEmails];
      // Remove if exists
      emails = emails.filter(e => e !== emailToSave);
      // Add to beginning
      emails.unshift(emailToSave);
      // Keep only last 5
      emails = emails.slice(0, 5);
      setSavedEmails(emails);
      localStorage.setItem("savedClientEmails", JSON.stringify(emails));
      localStorage.setItem("lastUsedClientEmail", emailToSave);
    } catch (error) {
      console.error("Error saving email:", error);
    }
  };

  // Remove saved email
  const removeSavedEmail = (emailToRemove) => {
    const emails = savedEmails.filter(e => e !== emailToRemove);
    setSavedEmails(emails);
    localStorage.setItem("savedClientEmails", JSON.stringify(emails));
    if (email === emailToRemove) {
      setEmail(emails[0] || "");
      if (emails[0]) {
        localStorage.setItem("lastUsedClientEmail", emails[0]);
        // Focus password field when email changes
        setTimeout(() => {
          const passwordInput = document.getElementById("password-input");
          if (passwordInput) passwordInput.focus();
        }, 100);
      } else {
        localStorage.removeItem("lastUsedClientEmail");
      }
    }
  };

  // Clear all saved emails
  const clearAllSavedEmails = () => {
    setSavedEmails([]);
    setEmail("");
    localStorage.removeItem("savedClientEmails");
    localStorage.removeItem("lastUsedClientEmail");
  };

  // Generate a random temporary password
  const generateTemporaryPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  useEffect(() => {
    // Determine redirect destination
    if (returnTo) {
      setRedirectTo(returnTo);
    } else if (path) {
      setRedirectTo(`/p/${path}`);
    } else {
      setRedirectTo("/client-dashboard");
    }

    // Check if user is already logged in
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "client") {
          navigate(redirectTo);
        }
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
  }, [path, navigate, returnTo, redirectTo]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password");
      setLoading(false);
      return;
    }

    try {
      // Save the email if remember me is checked
      if (rememberEmail) {
        saveEmailToStorage(email);
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userRole = userDoc.data().role;
        
        if (userRole === "client") {
          await updateDoc(doc(db, "users", userCredential.user.uid), {
            lastLogin: serverTimestamp()
          });
          navigate(redirectTo);
        } else if (userRole === "admin") {
          await auth.signOut();
          setError("This is an admin account. Please use the admin login page.");
        } else {
          await updateDoc(doc(db, "users", userCredential.user.uid), {
            role: "client",
            lastLogin: serverTimestamp()
          });
          navigate(redirectTo);
        }
      } else {
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: userCredential.user.email,
          name: userCredential.user.displayName || email.split('@')[0],
          role: "client",
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });
        navigate(redirectTo);
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

    if (!name.trim()) {
      setError("Please enter your full name");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    try {
      // Save the email if remember me is checked
      if (rememberEmail) {
        saveEmailToStorage(email);
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(userCredential.user, {
        displayName: name
      });
      
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        email: email,
        role: "client",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        emailVerified: userCredential.user.emailVerified,
        hasPassword: true
      });

      navigate(redirectTo);
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
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Save the email for auto-fill
      saveEmailToStorage(user.email);
      setGoogleUserEmail(user.email);
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        // Generate a temporary password for the Google account
        const tempPassword = generateTemporaryPassword();
        
        try {
          // Set a temporary password to enable email/password login
          await updatePassword(user, tempPassword);
          console.log("Temporary password set for Google account");
          
          // Send password reset email so user can set their own password
          await sendPasswordResetEmail(auth, user.email);
          setPasswordSetupSent(true);
          
          await setDoc(doc(db, "users", user.uid), {
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            role: "client",
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            photoURL: user.photoURL,
            authProvider: "both",
            hasPassword: true,
            tempPasswordSet: true
          });
          
          // Auto-fill the email and show success message
          setEmail(user.email);
          
          setTimeout(() => {
            setPasswordSetupSent(false);
          }, 5000);
          
        } catch (passwordError) {
          console.error("Error setting temporary password:", passwordError);
          await setDoc(doc(db, "users", user.uid), {
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            role: "client",
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            photoURL: user.photoURL,
            authProvider: "google",
            hasPassword: false
          });
          setEmail(user.email);
        }
      } else if (userDoc.data().role === "admin") {
        await auth.signOut();
        setError("This Google account is linked to an admin account. Please use the admin login.");
        setLoading(false);
        return;
      } else {
        await updateDoc(doc(db, "users", user.uid), {
          lastLogin: serverTimestamp()
        });
        
        // If user has no password set, automatically send password setup email
        if (!userDoc.data().hasPassword) {
          const tempPassword = generateTemporaryPassword();
          await updatePassword(user, tempPassword);
          await sendPasswordResetEmail(auth, user.email);
          setPasswordSetupSent(true);
          await updateDoc(doc(db, "users", user.uid), {
            hasPassword: true,
            tempPasswordSet: true
          });
          
          setTimeout(() => {
            setPasswordSetupSent(false);
          }, 5000);
        }
        
        setEmail(user.email);
      }
      
      // Don't redirect immediately - let user see the password setup message
      // They can now login with email/password after setting their password
      setLoading(false);
      
    } catch (error) {
      console.error("Google sign-in error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setError("Sign-in cancelled. Please try again.");
      } else if (error.code === 'auth/popup-blocked') {
        setError("Pop-up was blocked. Please allow pop-ups for this site.");
      } else {
        setError("Failed to sign in with Google. Please try again.");
      }
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!resetEmail) {
      setError("Please enter your email address");
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail, {
        url: `${window.location.origin}/client-login`,
        handleCodeInApp: false
      });
      setResetSent(true);
      setTimeout(() => {
        setShowReset(false);
        setResetSent(false);
        setResetEmail("");
      }, 3000);
    } catch (error) {
      console.error("Password reset error:", error);
      if (error.code === 'auth/user-not-found') {
        setError("No account found with this email address.");
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={backgroundStyle}></div>
      <div style={backgroundOverlayStyle}></div>
      
      <div style={cardStyle}>
        <div style={headerStyle}>
          <button onClick={() => navigate(-1)} style={backButtonStyle}>
            <MdArrowBack size={20} />
            Back
          </button>
          <div style={logoStyle}>
            <MdDashboard size={28} color="#00D4FF" />
            <span style={logoTextStyle}>Client Portal</span>
          </div>
        </div>

        {proposalInfo && (
          <div style={proposalInfoStyle}>
            <MdDescription size={20} color="#00D4FF" />
            <div style={proposalInfoContentStyle}>
              <span style={proposalInfoLabel}>Accessing Proposal:</span>
              <span style={proposalNameStyle}>{proposalInfo.name}</span>
            </div>
          </div>
        )}

        <h2 style={titleStyle}>
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>
        <p style={subtitleStyle}>
          {isLogin 
            ? "Sign in to access your proposals" 
            : "Sign up to start reviewing proposals"}
        </p>

        {error && (
          <div style={errorStyle}>
            <MdWarning size={18} />
            <span>{error}</span>
          </div>
        )}

        {resetSent && (
          <div style={successStyle}>
            <MdCheckCircle size={18} />
            <span>Password reset email sent! Check your inbox.</span>
          </div>
        )}

        {passwordSetupSent && (
          <div style={successStyle}>
            <MdVerified size={18} />
            <span>Password setup email sent! Check your inbox to set your password. You can now login with email and password after setting it up.</span>
          </div>
        )}

        {/* Saved Emails Section - Shows recent logins for quick selection */}
        {savedEmails.length > 0 && isLogin && !showReset && (
          <div style={savedEmailsContainerStyle}>
            <div style={savedEmailsHeaderStyle}>
              <MdHistory size={16} />
              <span>Recent logins</span>
              <button onClick={clearAllSavedEmails} style={clearAllButtonStyle} title="Clear all">
                <MdDelete size={14} />
              </button>
            </div>
            <div style={savedEmailsListStyle}>
              {savedEmails.map((savedEmail, index) => (
                <div key={index} style={savedEmailItemStyle}>
                  <button
                    onClick={() => {
                      setEmail(savedEmail);
                      // Focus password field after selecting email
                      setTimeout(() => {
                        const passwordInput = document.getElementById("password-input");
                        if (passwordInput) passwordInput.focus();
                      }, 100);
                    }}
                    style={savedEmailButtonStyle}
                  >
                    <MdEmail size={14} />
                    {savedEmail}
                  </button>
                  <button
                    onClick={() => removeSavedEmail(savedEmail)}
                    style={removeEmailButtonStyle}
                    title="Remove"
                  >
                    <MdDelete size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                autoFocus
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
                  required
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
                autoFocus={isLogin && !email}
              />
            </div>

            <div style={inputGroupStyle}>
              <MdLock size={20} color="#666" style={inputIconStyle} />
              <input
                id="password-input"
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
                  required
                />
              </div>
            )}

            {isLogin && (
              <div style={checkboxContainerStyle}>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                    style={checkboxStyle}
                  />
                  <span style={checkboxTextStyle}>Remember my email</span>
                </label>
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

        {!showReset && (
          <>
            <div style={dividerStyle}>
              <span style={dividerTextStyle}>or continue with</span>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={googleButtonStyle(loading)}
            >
              <FcGoogle size={22} />
              Continue with Google
            </button>
          </>
        )}

        {!showReset && (
          <div style={toggleContainerStyle}>
            <span style={toggleTextStyle}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setPassword("");
                setConfirmPassword("");
                setName("");
                setShowReset(false);
                setPasswordSetupSent(false);
              }}
              style={toggleButtonStyle}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>
        )}

        {!showReset && (
          <div style={featuresStyle}>
            <div style={featureItemStyle}>
              <MdCheckCircle size={14} color="#10B981" />
              <span>Access all your proposals in one place</span>
            </div>
            <div style={featureItemStyle}>
              <MdCheckCircle size={14} color="#10B981" />
              <span>Review and sign documents electronically</span>
            </div>
            <div style={featureItemStyle}>
              <MdCheckCircle size={14} color="#10B981" />
              <span>Track proposal status in real-time</span>
            </div>
          </div>
        )}

        <p style={termsStyle}>
          By continuing, you agree to our{" "}
          <a href="/terms" style={linkStyle}>Terms of Service</a>{" "}
          and{" "}
          <a href="/privacy" style={linkStyle}>Privacy Policy</a>
        </p>
      </div>

      <style>{`
        @keyframes float {
          0% { transform: translate(0, 0); }
          50% { transform: translate(20px, 20px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// Additional Styles
const savedEmailsContainerStyle = {
  marginBottom: "20px",
  padding: "12px",
  background: "#f8fafc",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
};

const savedEmailsHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "12px",
  color: "#64748b",
  marginBottom: "8px",
  paddingBottom: "8px",
  borderBottom: "1px solid #e2e8f0",
};

const savedEmailsListStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const savedEmailItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  background: "#fff",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  overflow: "hidden",
};

const savedEmailButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 10px",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#1e293b",
  fontSize: "13px",
  transition: "all 0.2s",
};

const removeEmailButtonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 8px",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#94a3b8",
  transition: "all 0.2s",
  borderLeft: "1px solid #e2e8f0",
};

const clearAllButtonStyle = {
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px 8px",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#94a3b8",
  fontSize: "11px",
  borderRadius: "6px",
  transition: "all 0.2s",
};

const checkboxContainerStyle = {
  marginBottom: "16px",
  display: "flex",
  alignItems: "center",
};

const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  fontSize: "13px",
  color: "#64748b",
};

const checkboxStyle = {
  width: "16px",
  height: "16px",
  cursor: "pointer",
};

const checkboxTextStyle = {
  userSelect: "none",
};

// Keep all existing styles from your original file
const containerStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  padding: "20px",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  position: "relative",
  overflow: "hidden",
};

const backgroundStyle = {
  position: "absolute",
  top: "-50%",
  right: "-50%",
  bottom: "-50%",
  left: "-50%",
  background: "radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%)",
  animation: "float 20s ease-in-out infinite",
  pointerEvents: "none",
};

const backgroundOverlayStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "radial-gradient(circle at 20% 80%, rgba(102, 126, 234, 0.3) 0%, transparent 50%)",
  pointerEvents: "none",
};

const cardStyle = {
  background: "rgba(255, 255, 255, 0.98)",
  backdropFilter: "blur(10px)",
  borderRadius: "32px",
  padding: "40px",
  maxWidth: "480px",
  width: "100%",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  position: "relative",
  zIndex: 10,
  animation: "slideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
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
  background: "rgba(0, 0, 0, 0.05)",
  border: "1px solid rgba(0, 0, 0, 0.08)",
  borderRadius: "10px",
  color: "#475569",
  fontSize: "14px",
  fontWeight: "500",
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
  gap: "12px",
  padding: "12px 16px",
  background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
  borderRadius: "12px",
  marginBottom: "25px",
  border: "1px solid #e2e8f0",
};

const proposalInfoContentStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const proposalInfoLabel = {
  fontSize: "11px",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const proposalNameStyle = {
  fontSize: "14px",
  fontWeight: "500",
  color: "#1a1a2e",
  wordBreak: "break-all",
};

const titleStyle = {
  fontSize: "32px",
  fontWeight: "700",
  color: "#1a1a2e",
  margin: "0 0 8px 0",
  letterSpacing: "-0.5px",
};

const subtitleStyle = {
  fontSize: "15px",
  color: "#64748b",
  margin: "0 0 30px 0",
  lineHeight: "1.5",
};

const errorStyle = {
  background: "#FEF2F2",
  color: "#DC2626",
  padding: "12px 16px",
  borderRadius: "12px",
  fontSize: "14px",
  marginBottom: "20px",
  border: "1px solid #FECACA",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const successStyle = {
  background: "#F0FDF4",
  color: "#10B981",
  padding: "12px 16px",
  borderRadius: "12px",
  fontSize: "14px",
  marginBottom: "20px",
  border: "1px solid #86EFAC",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const formStyle = {
  marginBottom: "24px",
};

const inputGroupStyle = {
  position: "relative",
  marginBottom: "16px",
  display: "flex",
  alignItems: "center",
};

const inputIconStyle = {
  position: "absolute",
  left: "14px",
  zIndex: 1,
};

const inputStyle = {
  width: "100%",
  padding: "14px 14px 14px 46px",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  fontSize: "15px",
  outline: "none",
  transition: "all 0.2s",
  background: "#fff",
};

const passwordToggleStyle = {
  position: "absolute",
  right: "14px",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#94a3b8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px",
};

const forgotPasswordStyle = {
  background: "none",
  border: "none",
  color: "#667eea",
  fontSize: "13px",
  cursor: "pointer",
  textAlign: "right",
  width: "100%",
  marginBottom: "20px",
};

const submitButtonStyle = (disabled) => ({
  width: "100%",
  padding: "14px",
  background: disabled ? "#cbd5e1" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  border: "none",
  borderRadius: "12px",
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
  background: disabled ? "#cbd5e1" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  border: "none",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "14px",
  fontWeight: "600",
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "all 0.2s",
});

const secondaryButtonStyle = {
  flex: 1,
  padding: "12px",
  background: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  color: "#64748b",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s",
};

const dividerStyle = {
  position: "relative",
  textAlign: "center",
  margin: "24px 0 20px",
};

const dividerTextStyle = {
  background: "#fff",
  padding: "0 12px",
  color: "#94a3b8",
  fontSize: "13px",
  position: "relative",
  zIndex: 1,
};

const googleButtonStyle = (disabled) => ({
  width: "100%",
  padding: "12px",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  color: "#1a1a2e",
  fontSize: "15px",
  fontWeight: "500",
  cursor: disabled ? "not-allowed" : "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  transition: "all 0.2s",
  opacity: disabled ? 0.6 : 1,
});

const toggleContainerStyle = {
  marginTop: "24px",
  textAlign: "center",
};

const toggleTextStyle = {
  color: "#64748b",
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

const featuresStyle = {
  marginTop: "24px",
  padding: "20px",
  background: "#f8fafc",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
};

const featureItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "12px",
  fontSize: "13px",
  color: "#475569",
};

const termsStyle = {
  marginTop: "24px",
  fontSize: "12px",
  color: "#94a3b8",
  textAlign: "center",
  lineHeight: "1.5",
};

const linkStyle = {
  color: "#667eea",
  textDecoration: "none",
};