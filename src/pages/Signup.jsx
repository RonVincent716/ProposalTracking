// src/pages/Signup.jsx
import { useState } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";



export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Email/password signup
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Signup successful!");
      navigate("/dashboard");
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      alert("Google Sign-In successful!");
      navigate("/dashboard");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div style={containerStyle}>
      <h2>Sign Up</h2>

      <form onSubmit={handleSignup} style={formStyle}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>

      <button onClick={handleGoogleSignIn} style={googleBtnStyle}>
        <FcGoogle style={{ marginRight: 8, fontSize: 20 }} />
        Sign in with Google
      </button>

      <p style={{ marginTop: 20 }}>
        Already have an account? <Link to="/login">Login here</Link>
      </p>
    </div>
  );
}

/* Styles */

const containerStyle = {
  maxWidth: 400,
  margin: "100px auto",
  padding: 20,
  border: "1px solid #ccc",
  borderRadius: 8,
  textAlign: "center",
  fontFamily: "Arial, sans-serif",
  background: "#f9f9f9",
};

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 15,
  marginTop: 20,
};

const inputStyle = {
  padding: 10,
  fontSize: 16,
  borderRadius: 4,
  border: "1px solid #ccc",
};

const buttonStyle = {
  padding: 12,
  backgroundColor: "#1976D2",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 16,
};

const googleBtnStyle = {
  marginTop: 20,
  padding: 12,
  backgroundColor: "#DB4437",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 16,
};