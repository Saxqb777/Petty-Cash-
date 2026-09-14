import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import RecordsPage from './pages/RecordsPage';
import SettingsPage from './pages/SettingsPage';
import SavingsPage from './pages/SavingsPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import PendingPage from './pages/PendingPage';
import MembersPage from './pages/MembersPage';
import ExpenseTypeBuilderPage from './pages/ExpenseTypeBuilderPage';
import PlatformPage from './pages/PlatformPage';
import GuidePage from './pages/GuidePage';

// 120ms ease-out, opacity and a 4px translate. No spring, no scale.
const pageVariants = {
  initial: { opacity: 0, y: 4 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.14, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.12, ease: 'easeOut' } }
};

function PageWrapper({ children }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit">
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/"         element={<PageWrapper><DashboardPage /></PageWrapper>} />
        <Route path="/upload"   element={<PageWrapper><UploadPage /></PageWrapper>} />
        <Route path="/records"  element={<PageWrapper><RecordsPage /></PageWrapper>} />
        <Route path="/settings" element={<PageWrapper><SettingsPage /></PageWrapper>} />
        <Route path="/savings"  element={<PageWrapper><SavingsPage /></PageWrapper>} />
        <Route path="/members"       element={<PageWrapper><MembersPage /></PageWrapper>} />
        <Route path="/type-builder"  element={<PageWrapper><ExpenseTypeBuilderPage /></PageWrapper>} />
        <Route path="/platform"      element={<PageWrapper><PlatformPage /></PageWrapper>} />
        <Route path="/guide"         element={<PageWrapper><GuidePage /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

function AppShell() {
  const { user } = useAuth();
  const location = useLocation();

  // Still loading auth state
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-paper-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-4 h-4 bg-blue-600 animate-pulse" />
          <span className="font-mono text-2xs uppercase text-ink-400">Loading</span>
        </div>
      </div>
    );
  }

  // Public routes — always accessible
  const publicPaths = ['/login', '/signup', '/pending'];
  if (publicPaths.includes(location.pathname)) {
    // If logged in and active, redirect away from login/signup
    if (user && location.pathname !== '/pending') {
      const active = user.memberships?.find(m => m.status === 'active');
      if (active) return <Navigate to="/" replace />;
    }
    return (
      <Routes>
        <Route path="/login"   element={<LoginPage />} />
        <Route path="/signup"  element={<SignupPage />} />
        <Route path="/pending" element={<PendingPage />} />
      </Routes>
    );
  }

  // Not logged in → redirect to login
  if (!user) return <Navigate to="/login" replace />;

  // Logged in but pending → redirect to pending screen
  const active = user.memberships?.find(m => m.status === 'active');
  if (!active) return <Navigate to="/pending" replace />;

  return (
    <div className="flex min-h-screen bg-paper-100">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto pt-14 lg:pt-0">
        <AnimatedRoutes />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
