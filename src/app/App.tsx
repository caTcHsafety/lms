import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Toaster } from "sonner";
import { StorageWarning } from "@/components/StorageWarning";
import { useEffect } from "react";
import Login from "./auth/Login";
import ForgotPassword from "./auth/ForgotPassword";
import UpdatePassword from "./auth/UpdatePassword";
import AdminPortal from "./admin/AdminPortal";
import MentorPortal from "./mentor/MentorPortal";
import StudentPortal from "./student/StudentPortal";
import TrainerPortal from "./trainer/TrainerPortal";

const RootRedirect = () => {
  const { session, role, isLoading } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Handle password recovery redirect
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      navigate('/update-password', { replace: true });
      return;
    }
  }, [navigate]);
  
  if (isLoading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (role) return <Navigate to={`/${role}`} replace />;
  return <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            
            {/* Role portals */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/*" element={<AdminPortal />} />
            </Route>
            
            <Route element={<ProtectedRoute allowedRoles={['mentor']} />}>
              <Route path="/mentor/*" element={<MentorPortal />} />
            </Route>
            
            <Route element={<ProtectedRoute allowedRoles={['student']} />}>
              <Route path="/student/*" element={<StudentPortal />} />
            </Route>
            
            <Route element={<ProtectedRoute allowedRoles={['trainer']} />}>
              <Route path="/trainer/*" element={<TrainerPortal />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
        <StorageWarning />
      </AuthProvider>
    </ErrorBoundary>
  );
}
