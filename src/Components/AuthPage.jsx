// src/components/AuthPage.jsx
import { useState } from "react";
import { auth, db } from "../firebase"; // make sure you have your firebase.js initialized
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ActivityLogger } from "../utils/activityLogger";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true); // toggle between login/signup
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {
      if (isLogin) {
        // Login
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Log login activity
        await ActivityLogger.logLogin(userCredential.user.email);
        navigate("/dashboard"); // redirect to dashboard
      } else {
        // Sign Up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create user document in Firestore with default role
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: email,
          role: "user", // Default role for new users
          createdAt: new Date().toISOString(),
          uid: userCredential.user.uid
        });
        
        // Log login activity for new user
        await ActivityLogger.logLogin(userCredential.user.email);
        
        navigate("/dashboard"); // redirect after signup
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  return (
    <div style={{ padding: 40, maxWidth: 400, margin: "0 auto", textAlign: "center" }}>
      <h2>{isLogin ? "Login" : "Sign Up"}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 10 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 10 }}
        />
        <button type="submit" style={{ width: "100%", padding: 10 }}>
          {isLogin ? "Login" : "Sign Up"}
        </button>
      </form>

      <p style={{ marginTop: 20 }}>
        {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{ color: "blue", textDecoration: "underline", border: "none", background: "none", cursor: "pointer" }}
        >
          {isLogin ? "Sign Up" : "Login"}
        </button>
      </p>
    </div>
  );
}