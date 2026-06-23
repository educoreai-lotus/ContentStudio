import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Lightweight UX guard — backend enforces trainer-only access on API routes.
 */
const ProtectedRoute = ({ children }) => {
  const { hasToken, isTrainer } = useAuth();

  if (!hasToken) {
    return <Navigate to="/access-denied" replace />;
  }

  if (!isTrainer) {
    return <Navigate to="/access-denied" replace />;
  }

  return children;
};

export default ProtectedRoute;
