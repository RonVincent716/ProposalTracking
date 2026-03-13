import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./Pages/Dashboard";
import ProposalEditor from "./Pages/ProposalEditor";
import ProposalView from "./Pages/ProposalView";
import ProposalDetail from "./pages/ProposalDetail";
import AuthPage from "./Components/AuthPage";
import Signup from "./pages/Signup";

// Import your new signing components
import ProposalSigning from "./pages/ProposalSigning";
import ThankYou from "./pages/Thankyou";

import ProtectedRoute from "./Components/ProtectedRoute";

function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* Default route */}
        <Route path="/" element={<Login />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
        <Route path="/auth" element={<AuthPage />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/editor"
          element={
            <ProtectedRoute>
              <ProposalEditor />
            </ProtectedRoute>
          }
        />

        <Route
          path="/view"
          element={
            <ProtectedRoute>
              <ProposalView />
            </ProtectedRoute>
          }
        />
        
        {/* Public Proposal Viewer */}
        <Route path="/p/:path" element={<ProposalDetail />} />

        {/* NEW: Public Signing Route - For clients to sign proposals */}
        <Route path="/sign/:proposalId" element={<ProposalSigning />} />
        
        {/* NEW: Thank You Page After Signing */}
        <Route path="/thank-you" element={<ThankYou />} />

        {/* 404 */}
        <Route path="*" element={<div>404 - Page Not Found</div>} />

      </Routes>

    </BrowserRouter>

  );

}

export default App;