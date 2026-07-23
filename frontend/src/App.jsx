import { useState } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import theme from "./services/theme.js";
import { AuthProvider } from "./services/auth.jsx";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProjectsListPage from "./pages/ProjectListsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ResourcesPage from "./pages/ResourcesPage";
import BudgetPage from "./pages/BudgetPage";
import AdminPage from "./pages/AdminPage";
import ReportsPage from "./pages/ReportsPage";

const SESSION_KEY = "pms.user";

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

export default function App() {
  // Auth state from backend login, kept for the tab's session so a page
  // refresh doesn't drop you back on the sign-in screen.
  const [user, setUser] = useState(readSession);

  const handleLogin = (userData) => {
    // userData contains: user_id, email, role, roleSelected
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!user ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <AuthProvider user={user} onLogout={handleLogout}>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/projects" element={<ProjectsListPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/resources" element={<ResourcesPage />} />
                <Route path="/budget" element={<BudgetPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                {/* Admin console is administrator-only; the API enforces it too. */}
                <Route
                  path="/admin"
                  element={user.role === "admin" ? <AdminPage /> : <Navigate to="/dashboard" replace />}
                />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      )}
    </ThemeProvider>
  );
}
