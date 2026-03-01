import { useEffect, useState } from "react";
import axios from "axios";
import { Star } from "lucide-react";
import { API_URL } from "../constant";
import { useAuth } from "../context/AuthContext";

export default function PointsBadge() {
  const { user } = useAuth();
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchPoints = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/api/user/points`);
        if (!cancelled) {
          setPoints(Number(res.data?.points || 0));
        }
      } catch (err) {
        if (!cancelled) {
          // Fallback to auth user snapshot
          setPoints(Number(user?.points || 0));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPoints();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-indigo-900/80 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur">
      <Star className="w-4 h-4 text-amber-300" />
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-200">
        {loading ? "..." : `${points} tkn`}
      </div>
    </div>
  );
}

