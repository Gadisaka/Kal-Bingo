import { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";
import { useAuth } from "../context/AuthContext";
import { socketClient } from "../sockets/socket";

export default function StreakIndicator() {
  const { user } = useAuth();
  const [current, setCurrent] = useState(0);
  const [target, setTarget] = useState(7);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const systemSocket = useMemo(() => socketClient.instance, []);

  useEffect(() => {
    let cancelled = false;
    const fetchStreak = async () => {
      if (!user) return;
      try {
        const res = await axios.get(`${API_URL}/api/user/points`);
        if (cancelled) return;
        const streak = res.data?.streak;
        setCurrent(Number(streak?.current || 0));
        setTarget(Number(res.data?.config?.streak_target_days || 7));
      } catch {
        // ignore and keep defaults
      }
    };
    fetchStreak();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!systemSocket || !user) return;
    const handler = (data) => {
      const pointsMsg = `+${data?.bonusPoints || 0} tokens`;
      setToastMsg(`Streak bonus unlocked! ${pointsMsg}`);
      setShowToast(true);
      setCurrent(0);
      setTimeout(() => setShowToast(false), 4000);
    };
    systemSocket.on("streak:bonus", handler);
    return () => {
      systemSocket.off("streak:bonus", handler);
    };
  }, [systemSocket, user]);

  if (!user) return null;

  return (
    <div className="relative flex items-center gap-2 rounded-2xl border border-orange-300/30 bg-orange-900/50 px-3 py-2 text-orange-100 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
      <Flame className="w-4 h-4 text-amber-300" />
      <span className="text-xs font-semibold uppercase tracking-wide">
        {current}/{target} streak
      </span>
      {showToast && (
        <div className="absolute -bottom-14 right-0 left-0 mx-auto w-max max-w-xs rounded-xl bg-emerald-600 text-white px-4 py-2 text-xs font-semibold shadow-lg animate-pulse">
          {toastMsg || "Streak Bonus Unlocked!"}
        </div>
      )}
    </div>
  );
}
