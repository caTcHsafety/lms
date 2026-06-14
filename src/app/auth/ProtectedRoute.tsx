import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

interface ProtectedRouteProps {
  allowedRoles?: ('admin' | 'trainer' | 'mentor' | 'student')[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { session, role, mustResetPw, isLoading } = useAuth();
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center p-8"><LoadingSkeleton className="h-full w-full" /></div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (mustResetPw && location.pathname !== '/update-password') {
    return <Navigate to="/update-password" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to their default dashboard if trying to access wrong role route
    return <Navigate to={`/${role}`} replace />;
  }

  // Offline Routing Enforcement
  if (isOffline) {
    if (role === 'student' && !location.pathname.includes('/student')) {
      return <Navigate to="/student" replace />;
    }
    if (role === 'trainer' && !location.pathname.includes('/trainer')) {
      return <Navigate to="/trainer" replace />;
    }
  }

  return (
    <>
      <Outlet />
    </>
  );
};
