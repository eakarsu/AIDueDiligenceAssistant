import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Financials from './pages/Financials';
import News from './pages/News';
import Risks from './pages/Risks';
import RedFlags from './pages/RedFlags';
import Market from './pages/Market';
import Competitors from './pages/Competitors';
import Legal from './pages/Legal';
import Management from './pages/Management';
import Deals from './pages/Deals';
import RiskScorer from './pages/RiskScorer';
import SynergyCalculator from './pages/SynergyCalculator';
import ValuationModeler from './pages/ValuationModeler';
import RedFlagDetector from './pages/RedFlagDetector';
import IntegrationPlanner from './pages/IntegrationPlanner';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

const ProtectedRoute = ({ children, requiredPermission }) => {
  const { token, loading, hasPermission } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff' }}>Loading...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Layout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', marginBottom: '20px' }}>!</div>
          <h2 style={{ color: '#fff', fontSize: '22px', marginBottom: '10px' }}>Access Denied</h2>
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>You don't have permission to access this page.</p>
        </div>
      </Layout>
    );
  }

  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
              <Route path="/companies" element={<ProtectedRoute><Layout><Companies /></Layout></ProtectedRoute>} />
              <Route path="/financials" element={<ProtectedRoute><Layout><Financials /></Layout></ProtectedRoute>} />
              <Route path="/news" element={<ProtectedRoute><Layout><News /></Layout></ProtectedRoute>} />
              <Route path="/risks" element={<ProtectedRoute><Layout><Risks /></Layout></ProtectedRoute>} />
              <Route path="/redflags" element={<ProtectedRoute><Layout><RedFlags /></Layout></ProtectedRoute>} />
              <Route path="/market" element={<ProtectedRoute><Layout><Market /></Layout></ProtectedRoute>} />
              <Route path="/competitors" element={<ProtectedRoute><Layout><Competitors /></Layout></ProtectedRoute>} />
              <Route path="/legal" element={<ProtectedRoute><Layout><Legal /></Layout></ProtectedRoute>} />
              <Route path="/management" element={<ProtectedRoute><Layout><Management /></Layout></ProtectedRoute>} />
              <Route path="/deals" element={<ProtectedRoute><Layout><Deals /></Layout></ProtectedRoute>} />
              <Route path="/risk-scorer" element={<ProtectedRoute><Layout><RiskScorer /></Layout></ProtectedRoute>} />
              <Route path="/synergy-calculator" element={<ProtectedRoute><Layout><SynergyCalculator /></Layout></ProtectedRoute>} />
              <Route path="/valuation-modeler" element={<ProtectedRoute><Layout><ValuationModeler /></Layout></ProtectedRoute>} />
              <Route path="/red-flag-detector" element={<ProtectedRoute><Layout><RedFlagDetector /></Layout></ProtectedRoute>} />
              <Route path="/integration-planner" element={<ProtectedRoute><Layout><IntegrationPlanner /></Layout></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
            </Routes>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
