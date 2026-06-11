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

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  enter:   { opacity: 1, y: 0,  transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.18, ease: 'easeIn' } }
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
        <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
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
      <main className="flex-1 overflow-auto">
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
