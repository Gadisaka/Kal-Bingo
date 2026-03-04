import React, { useEffect, useState } from "react";
import { User as UserIcon, LogOut, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useProfileStore } from "../store/profileStore";

const UI_COLORS = {
  base: "#1E2330",
  surface: "#F2F2EC",
  accent: "#3A7A45",
};

export default function ProfileModal() {
  const { user, logout } = useAuth();
  const { isOpen, closeProfile } = useProfileStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => closeProfile(), 300);
  };

  const handleLogout = () => {
    handleClose();
    setTimeout(() => logout(), 300);
  };

  if (!isOpen && !isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end isolate">
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{ backgroundColor: "rgba(30,35,48,0.72)" }}
        onClick={handleClose}
      />

      <div
        className={`relative z-10 w-full h-[85vh] rounded-t-[2.5rem] border-t overflow-hidden transition-transform duration-300 ease-out transform ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.base }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-20 border-b px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
        >
          <div className="w-12" />
          <div
            className="w-12 h-1.5 rounded-full absolute left-1/2 -translate-x-1/2 top-3"
            style={{ backgroundColor: UI_COLORS.accent }}
          />
          <h1 className="text-lg font-bold mt-2" style={{ color: UI_COLORS.base }}>Profile</h1>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-full transition-colors"
            style={{ color: UI_COLORS.base }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto pb-24 px-6 pt-8">
          {/* Profile Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-28 h-28 rounded-full p-1 mb-4 shadow-lg" style={{ backgroundColor: UI_COLORS.accent }}>
              <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: UI_COLORS.base }}>
                <UserIcon className="w-14 h-14 text-[#F2F2EC]" />
              </div>
            </div>

            {/* User Name */}
            <h2 className="text-2xl font-bold mb-1" style={{ color: UI_COLORS.base }}>
              {user?.name || "Guest Player"}
            </h2>
            <p className="text-sm mb-6" style={{ color: UI_COLORS.base }}>
              {user?.phoneNumber || "@guest"}
            </p>

          </div>

          {/* Logout Button */}
          <div className="px-2">
            <button
              onClick={handleLogout}
              className="w-full p-4 rounded-2xl flex items-center justify-center gap-3 transition-colors border active:scale-[0.98]"
              style={{ backgroundColor: UI_COLORS.base, borderColor: UI_COLORS.accent }}
            >
              <LogOut className="w-5 h-5 text-[#F2F2EC]" />
              <span className="font-medium text-[#F2F2EC]">Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
