import React, { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Gamepad2,
  Users,
  ArrowRightLeft,
  ArrowUpCircle,
  UserCog,
  Bell,
  Settings,
  Megaphone,
  LogOut,
  Menu,
  X,
  BarChart3,
  Trophy,
  Bot,
} from "lucide-react";
import clsx from "clsx";

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Games", path: "/games", icon: Gamepad2 },
    { name: "Players", path: "/players", icon: Users },
    { name: "Transactions", path: "/transactions", icon: ArrowRightLeft },
    {
      name: "Withdrawals",
      path: "/withdrawals",
      icon: ArrowUpCircle,
    },
    { name: "Sub Admin", path: "/sub-admin", icon: UserCog, role: "admin" },
    { name: "Revenue", path: "/revenue", icon: BarChart3 },
    { name: "Leaderboard", path: "/leaderboard", icon: Trophy },
    { name: "Bot Management", path: "/bots", icon: Bot },
    { name: "Notifications", path: "/notifications", icon: Bell },
    { name: "Ads", path: "/ads", icon: Megaphone },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  // Filter items based on role and page permissions
  const filteredNavItems = navItems.filter((item) => {
    // Admin-only pages
    if (item.role && item.role !== user?.role) {
      return false;
    }

    // For sub-admins, check page permissions
    if (user?.role === "subadmin") {
      const allowedPages = user.allowedPages || [];
      return allowedPages.includes(item.path);
    }

    // Admins can see all pages
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transition-transform duration-200 ease-in-out",
          // On large screens, always show sidebar (translate-0), ignore mobile toggle
          "lg:translate-x-0",
          // On mobile, toggle visibility based on state
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b">
            <h1 className="text-2xl font-bold text-primary">Bingo</h1>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  )
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.username}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm lg:hidden">
          <div className="h-16 flex items-center px-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-4 text-lg font-semibold text-gray-900">
              {navItems.find((i) => i.path === location.pathname)?.name ||
                "Admin"}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
