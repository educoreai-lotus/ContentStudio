import React, { createContext, useContext, useMemo } from 'react';
import { getAuthToken } from '../auth/accessToken.js';
import {
  decodeJwtPayload,
  getDirectoryUserIdFromClaims,
  getOrganizationIdFromClaims,
  isTrainerFromClaims,
} from '../auth/jwtUtils.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const value = useMemo(() => {
    const token = getAuthToken();
    const claims = token ? decodeJwtPayload(token) : null;

    return {
      token,
      claims,
      directoryUserId: getDirectoryUserIdFromClaims(claims),
      organizationId: getOrganizationIdFromClaims(claims),
      isTrainer: isTrainerFromClaims(claims),
      hasToken: Boolean(token),
    };
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
