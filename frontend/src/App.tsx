// App.tsx - Complete React Query Migration
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Home from "./pages/Home";
import Assessment from "./pages/Assessment";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import { createQueryClient } from "@/services/assessmentApi";

// Create the query client instance with enhanced configuration for assessments
const queryClient = createQueryClient();

// Global error handler for React Query
const handleQueryError = (error: any) => {
  console.error('Global Query Error:', error);
  
  // Handle specific error types
  if (error?.message?.includes('Session expired')) {
    // Could trigger logout here if needed
    console.warn('Session expired - user may need to re-authenticate');
  }
  
  if (error?.message?.includes('Authentication required')) {
    console.warn('Authentication required for this operation');
  }
  
  if (error?.message?.includes('not found')) {
    console.info('Requested resource not found');
  }
  
  // Could integrate with toast notifications here
  // toast.error(error?.message || 'An unexpected error occurred');
};

// Enhanced query client with assessment-specific configurations
const enhancedQueryClient = new QueryClient({
  ...queryClient.getDefaultOptions(),
  defaultOptions: {
    queries: {
      // Inherited from createQueryClient, with additional assessment-specific options
      staleTime: 30 * 1000, // 30 seconds for assessment data
      gcTime: 10 * 60 * 1000, // 10 minutes cache time for assessments
      retry: (failureCount, error: any) => {
        // Assessment-specific retry logic
        if (error?.message?.includes('401') || 
            error?.message?.includes('403') ||
            error?.message?.includes('Authentication required') ||
            error?.message?.includes('Session expired')) {
          return false; // Don't retry auth errors
        }
        
        if (error?.message?.includes('404') || 
            error?.message?.includes('not found')) {
          return false; // Don't retry not found errors
        }
        
        // Retry network errors up to 2 times with exponential backoff
        if (failureCount < 2) {
          return true;
        }
        
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Disable for better UX in assessment flows
      refetchOnMount: true, // Always refetch on component mount
      refetchOnReconnect: true, // Refetch when network reconnects
      // Assessment-specific network settings
      networkMode: 'online', // Only run queries when online
    },
    mutations: {
      // Assessment submission and creation mutations
      retry: (failureCount, error: any) => {
        // Don't retry auth errors for mutations
        if (error?.message?.includes('401') || 
            error?.message?.includes('403') ||
            error?.message?.includes('Session expired')) {
          return false;
        }
        
        // Retry network errors once for mutations
        return failureCount < 1;
      },
      networkMode: 'online',
      onError: handleQueryError,
      // Global success handler could be added here
      onSuccess: (data, variables, context) => {
        console.log('Mutation succeeded:', { data, variables });
      }
    }
  },
  // Global query cache configuration
  queryCache: queryClient.getQueryCache(),
  mutationCache: queryClient.getMutationCache(),
});

// Enhanced error boundary for query errors (optional)
const QueryErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div>
      {children}
    </div>
  );
};


const App = () => {
  return (
    <QueryClientProvider client={enhancedQueryClient}>
      <QueryErrorBoundary>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/auth/login" element={<Login />} />
                
                {/* Protected Routes */}
                <Route 
                  path="/assessment" 
                  element={
                    <ProtectedRoute>
                      <Assessment />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/assessment/:domain" 
                  element={
                    <ProtectedRoute>
                      <Assessment />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Admin Only Routes */}
                <Route 
                  path="/admin/*" 
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <div className="p-8 text-center">
                        <h1 className="text-2xl font-bold">Admin Panel</h1>
                        <p className="text-gray-600 mt-2">Admin functionality coming soon...</p>
                      </div>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Assessor Only Routes */}
                <Route 
                  path="/assessor/*" 
                  element={
                    <ProtectedRoute requiredRole="assessor">
                      <div className="p-8 text-center">
                        <h1 className="text-2xl font-bold">Assessor Dashboard</h1>
                        <p className="text-gray-600 mt-2">Assessor functionality coming soon...</p>
                      </div>
                    </ProtectedRoute>
                  } 
                />
                
                {/* Catch-all route - must be last */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            
          </AuthProvider>
        </TooltipProvider>
      </QueryErrorBoundary>
    </QueryClientProvider>
  );
};

export default App;