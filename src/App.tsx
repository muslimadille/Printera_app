import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import InternalErrors from "./pages/InternalErrors.tsx";
import TemplatesLibrary from "./pages/TemplatesLibrary.tsx";
import Pricing from "./pages/Pricing.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import BillingDetails from "./pages/BillingDetails.tsx";
import TemplateDetail from "./pages/TemplateDetail.tsx";
import PrintTemplate from "./pages/PrintTemplate.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* QawalibLine Core Routes */}
          <Route path="/" element={<TemplatesLibrary />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/billing" element={<BillingDetails />} />
          <Route path="/template/:id" element={<TemplateDetail />} />
          <Route path="/template/:id/print" element={<PrintTemplate />} />
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />

          {/* Legacy & Internal Support */}
          <Route path="/app" element={<Navigate to="/" replace />} />
          <Route path="/__internal/errors" element={<InternalErrors />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
