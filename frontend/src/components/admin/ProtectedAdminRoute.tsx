import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Shield, AlertCircle } from 'lucide-react';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // Show access denied if not admin
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-6">
            You don't have administrator privileges to access this area. 
            Please contact your system administrator if you believe this is an error.
          </p>
          <div className="space-y-2 text-sm text-gray-500">
            <p>Current role: <span className="font-medium">{user?.role || 'unknown'}</span></p>
            <p>Required role: <span className="font-medium">admin</span></p>
          </div>
          <div className="mt-6">
            <Navigate to="/" replace />
          </div>
        </div>
      </div>
    );
  }

  // User is admin, render the protected content
  return <>{children}</>;
}