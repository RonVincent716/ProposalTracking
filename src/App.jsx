import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./Pages/Dashboard";
import ProposalEditor from "./Pages/ProposalEditor";
import ProposalView from "./Pages/ProposalView";
import ProposalDetail from "./pages/ProposalDetail"; // This is your main viewer
import AuthPage from "./Components/AuthPage";
import Signup from "./pages/Signup";
import ProposalSigning from "./pages/ProposalSigning";
import ThankYou from "./pages/ThankYou";
import ClientLogin from "./pages/ClientLogin"; // Add this import
import ClientDashboard from "./Components/ClientDashboard"; // Add this import
import SmartProposalViewer from "./Components/SmartProposalViewer"; // Add this import
import ProtectedRoute from "./Components/ProtectedRoute";
import SignedProposalDetail from "./Components/SignedProposalDetail"; // Add this import


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
        
        {/* Public Proposal Viewer - Now with auth check */}
        <Route path="/p/:path" element={<ProposalDetail />} />
        
        {/* NEW: Client Login - For accessing proposals */}
        
      
        <Route path="/client-login/:path" element={<ClientLogin />} />
        <Route path="/client-login" element={<ClientLogin />} />
          <Route path="/client-dashboard" element={<ClientDashboard />} />
        
        {/* Signing Routes */}
         <Route path="/p/:encodedPath" element={<SmartProposalViewer />} />
        <Route path="/sign/:proposalId" element={<ProposalSigning />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/signed/:signingId" element={<SignedProposalDetail />} />

        {/* 404 */}
        <Route path="*" element={<div>404 - Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;