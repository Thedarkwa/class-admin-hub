import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Super Admin pages
import SuperAdminSetup from "./pages/SuperAdminSetup";
import SuperAdminAuth from "./pages/SuperAdminAuth";
import SuperAdmin from "./pages/SuperAdmin";

// School-specific pages
import SchoolAuth from "./pages/SchoolAuth";
import SchoolAdminAuth from "./pages/SchoolAdminAuth";
import SchoolAdmin from "./pages/SchoolAdmin";
import SchoolDashboard from "./pages/SchoolDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            
            {/* Super Admin routes */}
            <Route path="/super-admin-setup" element={<SuperAdminSetup />} />
            <Route path="/super-admin-auth" element={<SuperAdminAuth />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            
            {/* School-specific routes */}
            <Route path="/s/:schoolSlug" element={<SchoolAuth />} />
            <Route path="/s/:schoolSlug/admin-auth" element={<SchoolAdminAuth />} />
            <Route path="/s/:schoolSlug/admin" element={<SchoolAdmin />} />
            <Route path="/s/:schoolSlug/dashboard" element={<SchoolDashboard />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
