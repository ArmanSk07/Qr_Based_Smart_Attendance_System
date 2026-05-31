import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scanner from './pages/Scanner';
import ForgotPassword from './pages/ForgotPassword'; // 🟢 NEW
import ResetPassword from './pages/ResetPassword';   // 🟢 NEW
import './styles/Dashboard.css';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useApp();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} /> {/* 🟢 NEW */}
          <Route path="/reset-password/:uid/:token" element={<ResetPassword />} /> {/* 🟢 NEW */}

          {/* Protected Routes (Require Login) */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
        
          <Route path="/scanner" element={
            <ProtectedRoute>
              <Scanner />
            </ProtectedRoute>
          } />

          {/* Redirect all unknown paths to Login */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}