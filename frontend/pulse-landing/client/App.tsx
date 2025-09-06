import "./global.css";

import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ThemeToggleFloating } from "@/components/ui/theme-toggle";

// React Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Page imports
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import WalletRegistration from "./pages/WalletRegistration";
import PoolDiscovery from "./pages/PoolDiscovery";
import PoolerConsole from "./pages/PoolerConsole";
import BlockOperations from "./pages/BlockOperations";
import PerformanceAnalytics from "./pages/PerformanceAnalytics";
import WorkHistory from "./pages/WorkHistory";
import NetworkStatus from "./pages/NetworkStatus";
import MyPool from "./pages/MyPool";
import PoolerStatus from "./pages/PoolerStatus";
import ManageFarmers from "./pages/ManageFarmers";
import PoolOperatorDev from "./pages/PoolOperatorDev";
import NotFound from "./pages/NotFound";

// Icons for placeholder pages
import { 
  Network, 
  Leaf, 
  Users, 
  Zap, 
  Activity, 
  BarChart3, 
  HardHat,
  Truck,
  Pickaxe
} from 'lucide-react';

// ✅ Create a QueryClient instance
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ThemeToggleFloating />
            <Routes>
              {/* Public routes without AppLayout (no sidebar) */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth/signin" element={<SignIn />} />
              <Route path="/farmer/wallet" element={<WalletRegistration />} />
              <Route path="/pool-operator" element={<PoolOperatorDev />} />

              {/* App routes with layout (sidebar, header) */}
              <Route element={<AppLayout />}>
                {/* Main Dashboard */}
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Network Status */}
                <Route path="/network" element={<NetworkStatus />} />

                {/* Farmer Routes */}
                <Route path="/farmer/pools" element={<PoolDiscovery />} />
                <Route path="/farmer/my-pool" element={<MyPool />} />
                <Route path="/farmer/work-history" element={<WorkHistory />} />

                {/* Pooler Routes */}
                <Route path="/pooler/blocks" element={<PoolerConsole />} />
                <Route path="/pooler/status" element={<PoolerStatus />} />
                <Route path="/pooler/farmers" element={<ManageFarmers />} />

                {/* Block Operations Routes */}
                <Route path="/operations/plant" element={<BlockOperations />} />
                <Route path="/operations/work" element={<BlockOperations />} />
                <Route path="/operations/harvest" element={<BlockOperations />} />

                {/* Analytics Routes */}
                <Route path="/analytics/performance" element={<PerformanceAnalytics />} />
                <Route path="/analytics/work" element={<WorkHistory />} />
              </Route>

              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
