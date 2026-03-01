import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Games from "./pages/Games";
import Players from "./pages/Players";
import Transactions from "./pages/Transactions";
import SubAdmin from "./pages/SubAdmin";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Ads from "./pages/Ads";
import Revenue from "./pages/Revenue";
import BotManagement from "./pages/BotManagement";
import Withdrawals from "./pages/Withdrawals";

const ProtectedRoute = ({ children, allowedRoles, path }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />;
  }

  // Check page permissions for sub-admins
  if (user.role === "subadmin" && path) {
    const allowedPages = user.allowedPages || [];
    // Normalize path (remove trailing slash if present, except for root)
    const normalizedPath = path === "/" ? "/" : path.replace(/\/$/, "");
    if (!allowedPages.includes(normalizedPath)) {
      return <Navigate to="/" />;
    }
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/"
              element={
                <ProtectedRoute path="/">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/games"
              element={
                <ProtectedRoute path="/games">
                  <Games />
                </ProtectedRoute>
              }
            />
            <Route
              path="/players"
              element={
                <ProtectedRoute path="/players">
                  <Players />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions"
              element={
                <ProtectedRoute path="/transactions">
                  <Transactions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/withdrawals"
              element={
                <ProtectedRoute
                  allowedRoles={["admin", "subadmin"]}
                  path="/withdrawals"
                >
                  <Withdrawals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sub-admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]} path="/sub-admin">
                  <SubAdmin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/revenue"
              element={
                <ProtectedRoute allowedRoles={["admin"]} path="/revenue">
                  <Revenue />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bots"
              element={
                <ProtectedRoute allowedRoles={["admin"]} path="/bots">
                  <BotManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute path="/notifications">
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute path="/settings">
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ads"
              element={
                <ProtectedRoute path="/ads">
                  <Ads />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
