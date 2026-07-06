import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import InternalErrors from "./pages/InternalErrors.tsx";

const queryClient = new QueryClient();

// Beta deployment: only /app is exposed publicly. All other routes redirect
// to /app. Other page components (Landing, LandingV2, NotFound, etc.) are
// preserved in the codebase but not mounted in the router.
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/app" element={<Index />} />
          <Route path="/__internal/errors" element={<InternalErrors />} />
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
