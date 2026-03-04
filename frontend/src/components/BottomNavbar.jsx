import React from "react";
import { User, Users } from "lucide-react";
import Wallet from "../assets/wallet.png";
import { useWalletStore } from "../store/walletStore";
import { useProfileStore } from "../store/profileStore";
import { useInviteStore } from "../store/inviteStore";

const UI_COLORS = {
  base: "#1E2330",
  surface: "#F2F2EC",
  accent: "#3A7A45",
};

export default function BottomNavbar() {
  const { openWallet } = useWalletStore();
  const { openProfile } = useProfileStore();
  const { openInvite } = useInviteStore();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t pb-safe"
      style={{ backgroundColor: UI_COLORS.base, borderColor: UI_COLORS.accent }}
    >
      <div className="flex items-center justify-around px-2 pb-2 pt-2 max-w-md mx-auto relative">
        {/* Invite */}
        <button
          onClick={openInvite}
          className="flex flex-col items-center gap-1 p-2 rounded-xl transition-colors w-20"
          style={{ color: UI_COLORS.surface }}
        >
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-medium">Share</span>
        </button>

        {/* Wallet - Main Character */}
        <div className="relative -top-6">
          <button
            onClick={openWallet}
            className="flex items-center justify-center w-16 h-16 rounded-full border-4 transform hover:scale-105 transition-transform active:scale-95"
            style={{
              backgroundColor: UI_COLORS.surface,
              borderColor: UI_COLORS.accent,
            }}
          >
            {/* <Wallet className="w-7 h-7 text-slate-950 fill-slate-950" /> */}
            <img src={Wallet} alt="Wallet" className="w-12 h-12" />
          </button>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-bold" style={{ color: UI_COLORS.surface }}>
              Wallet
            </span>
          </div>
        </div>

        {/* Profile */}
        <button
          onClick={openProfile}
          className="flex flex-col items-center gap-1 p-2 rounded-xl transition-colors w-20"
          style={{ color: UI_COLORS.surface }}
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] font-medium">Me</span>
        </button>
      </div>
    </div>
  );
}
