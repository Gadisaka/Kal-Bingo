import React from "react";
import { User, Users } from "lucide-react";
import Wallet from "../assets/wallet.png";
import { useWalletStore } from "../store/walletStore";
import { useProfileStore } from "../store/profileStore";
import { useInviteStore } from "../store/inviteStore";

export default function BottomNavbar() {
  const { openWallet } = useWalletStore();
  const { openProfile } = useProfileStore();
  const { openInvite } = useInviteStore();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-lg border-t border-white/5 pb-safe">
      <div className="flex items-center justify-around px-2 pb-2 pt-2 max-w-md mx-auto relative">
        {/* Invite */}
        <button
          onClick={openInvite}
          className="flex flex-col items-center gap-1 p-2 rounded-xl transition-colors w-20 text-slate-400 hover:text-slate-200 active:text-sky-400"
        >
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-medium">Invite</span>
        </button>

        {/* Wallet - Main Character */}
        <div className="relative -top-6">
          <button
            onClick={openWallet}
            className="flex items-center justify-center w-16 h-16 bg-[#ffd700] rounded-full shadow-[0_0_20px_rgba(255,215,0,0.4)] border-4 border-slate-950 transform hover:scale-105 transition-transform active:scale-95"
          >
            {/* <Wallet className="w-7 h-7 text-slate-950 fill-slate-950" /> */}
            <img src={Wallet} alt="Wallet" className="w-12 h-12" />
          </button>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-bold text-[#ffd700]">Wallet</span>
          </div>
        </div>

        {/* Profile */}
        <button
          onClick={openProfile}
          className="flex flex-col items-center gap-1 p-2 rounded-xl transition-colors w-20 text-slate-400 hover:text-slate-200 active:text-sky-400"
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </div>
  );
}
