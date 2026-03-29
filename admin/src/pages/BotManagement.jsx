import React, { useState, useEffect } from "react";
import {
  Bot,
  Settings,
  Users,
  Activity,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Loader2,
  TrendingUp,
  Percent,
  Clock,
  Target,
  ChevronDown,
  Search,
  Edit,
  X,
  Wallet,
} from "lucide-react";
import { API_URL } from "../constant";

const DEFAULT_FIXED_WINDOWS = [
  { key: "midnight", startHour: 0, endHour: 5, label: "06:00-11:59" },
  { key: "morning", startHour: 6, endHour: 11, label: "12:00-05:59" },
  { key: "afternoon", startHour: 12, endHour: 17, label: "06:00-11:59" },
  { key: "night", startHour: 18, endHour: 23, label: "12:00-05:59" },
];

const buildDefaultWindowBots = (minBots = 2, maxBots = 5) =>
  DEFAULT_FIXED_WINDOWS.reduce((acc, windowDef) => {
    acc[windowDef.key] = { min_bots: minBots, max_bots: maxBots };
    return acc;
  }, {});

const mergeWindowsForUi = (backendWindows = []) => {
  if (!Array.isArray(backendWindows) || backendWindows.length === 0) {
    return DEFAULT_FIXED_WINDOWS;
  }

  const frontendLabelByKey = new Map(
    DEFAULT_FIXED_WINDOWS.map((windowDef) => [windowDef.key, windowDef.label]),
  );

  return backendWindows.map((windowDef) => ({
    ...windowDef,
    label: frontendLabelByKey.get(windowDef.key) || windowDef.label,
  }));
};

const ensureConfigWindows = (config) => {
  const fallback = buildDefaultWindowBots(
    config?.min_bots ?? 2,
    config?.max_bots ?? 5,
  );
  const source = config?.time_window_bots || {};
  const normalized = {};

  DEFAULT_FIXED_WINDOWS.forEach((windowDef) => {
    const row = source[windowDef.key] || {};
    const minBots = Number.isInteger(row.min_bots)
      ? row.min_bots
      : fallback[windowDef.key].min_bots;
    const maxBots = Number.isInteger(row.max_bots)
      ? row.max_bots
      : fallback[windowDef.key].max_bots;
    normalized[windowDef.key] = {
      min_bots: minBots,
      max_bots: Math.max(minBots, maxBots),
    };
  });

  return { ...(config || {}), time_window_bots: normalized };
};

const BotManagement = () => {
  const [activeTab, setActiveTab] = useState("config");
  const [configs, setConfigs] = useState([]);
  const [bots, setBots] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
  });

  // Available game stakes from settings
  const [availableStakes, setAvailableStakes] = useState([]);
  const [fixedWindows, setFixedWindows] = useState(DEFAULT_FIXED_WINDOWS);

  // Search state for bots
  const [botSearch, setBotSearch] = useState("");

  // Form state for new/edit config
  const [editConfig, setEditConfig] = useState(null);
  const [newConfig, setNewConfig] = useState({
    stake_amount: "",
    bot_win_rate: 50,
    join_delay_min: 5,
    join_delay_max: 55,
    is_active: true,
    notes: "",
    time_window_bots: buildDefaultWindowBots(2, 5),
  });

  // Edit bot modal state
  const [editBot, setEditBot] = useState(null);
  const [botEditForm, setBotEditForm] = useState({
    name: "",
    phoneNumber: "",
    bot_difficulty: 1,
    balance: 0,
    bonus: 0,
    isActive: true,
  });
  const [savingBot, setSavingBot] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("bingo_admin_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  // Auto-dismiss notifications
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRes, statsRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/bots/config`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_URL}/api/admin/bots/stats`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/settings`, { headers: getAuthHeaders() }),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfigs((configData.configs || []).map(ensureConfigWindows));
        setFixedWindows(mergeWindowsForUi(configData.fixed_windows));
      } else {
        console.error("Config fetch failed:", configRes.status);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      } else {
        console.error("Stats fetch failed:", statsRes.status);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const gameStakes = settingsData.data?.systemGames?.gameStakes || [];
        setAvailableStakes(gameStakes.sort((a, b) => a - b));
      } else {
        console.error("Settings fetch failed:", settingsRes.status);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to fetch bot data. Check if the server is running.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch bot users
  const fetchBots = async (page = 1, search = "") => {
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
      const res = await fetch(
        `${API_URL}/api/admin/bots/users?page=${page}&limit=20${searchParam}`,
        { headers: getAuthHeaders() },
      );
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || []);
        setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
      } else {
        console.error("Failed to fetch bots:", res.status);
        setBots([]);
      }
    } catch (err) {
      console.error("Failed to fetch bots:", err);
      setBots([]);
    }
  };

  // Debounced search for bots
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === "bots") {
        const searchParam = botSearch
          ? `&search=${encodeURIComponent(botSearch)}`
          : "";
        fetch(`${API_URL}/api/admin/bots/users?page=1&limit=20${searchParam}`, {
          headers: getAuthHeaders(),
        })
          .then((res) => (res.ok ? res.json() : Promise.reject()))
          .then((data) => {
            setBots(data.bots || []);
            setPagination(
              data.pagination || { page: 1, total: 0, totalPages: 0 },
            );
          })
          .catch(() => setBots([]));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [botSearch, activeTab]);

  useEffect(() => {
    fetchData();
    fetchBots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save bot config
  const saveConfig = async (config) => {
    setSaving(true);
    try {
      const normalized = ensureConfigWindows(config);
      const allRanges = Object.values(normalized.time_window_bots || {});
      const globalMin = allRanges.length
        ? Math.min(...allRanges.map((r) => Number(r.min_bots || 0)))
        : 0;
      const globalMax = allRanges.length
        ? Math.max(...allRanges.map((r) => Number(r.max_bots || 0)))
        : 0;
      const payload = {
        ...normalized,
        min_bots: globalMin,
        max_bots: globalMax,
      };

      const res = await fetch(`${API_URL}/api/admin/bots/config`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccess("Bot configuration saved successfully");
        fetchData();
        setEditConfig(null);
        setNewConfig({
          stake_amount: "",
          bot_win_rate: 50,
          join_delay_min: 5,
          join_delay_max: 55,
          is_active: true,
          notes: "",
          time_window_bots: buildDefaultWindowBots(2, 5),
        });
      } else {
        const data = await res.json();
        setError(data.message || "Failed to save configuration");
      }
    } catch {
      setError("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  // Toggle config active status
  const toggleConfig = async (stakeAmount) => {
    try {
      const res = await fetch(
        `${API_URL}/api/admin/bots/config/${stakeAmount}/toggle`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
        },
      );

      if (res.ok) {
        fetchData();
      }
    } catch {
      setError("Failed to toggle configuration");
    }
  };

  // Delete config
  const deleteConfig = async (stakeAmount) => {
    if (!confirm(`Delete bot configuration for ${stakeAmount} ETB?`)) return;

    try {
      const res = await fetch(
        `${API_URL}/api/admin/bots/config/${stakeAmount}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
      );

      if (res.ok) {
        setSuccess("Configuration deleted");
        fetchData();
      }
    } catch {
      setError("Failed to delete configuration");
    }
  };

  // Toggle bot active status
  const toggleBot = async (botId) => {
    try {
      const res = await fetch(
        `${API_URL}/api/admin/bots/users/${botId}/toggle`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
        },
      );

      if (res.ok) {
        fetchBots(pagination.page, botSearch);
        // Also refresh stats
        fetchData();
      } else {
        setError("Failed to toggle bot status");
      }
    } catch {
      setError("Failed to toggle bot status");
    }
  };

  // Open edit bot modal
  const openEditBot = (bot) => {
    setEditBot(bot);
    setBotEditForm({
      name: bot.name || "",
      phoneNumber: bot.phoneNumber || "",
      bot_difficulty: bot.bot_difficulty || 1,
      balance: bot.balance || 0,
      bonus: bot.bonus || 0,
      isActive: bot.isActive !== undefined ? bot.isActive : true,
    });
  };

  // Close edit bot modal
  const closeEditBot = () => {
    setEditBot(null);
    setBotEditForm({
      name: "",
      phoneNumber: "",
      bot_difficulty: 1,
      balance: 0,
      bonus: 0,
      isActive: true,
    });
  };

  // Save bot edits
  const saveBotEdit = async () => {
    if (!editBot) return;

    setSavingBot(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${editBot._id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: botEditForm.name,
          phoneNumber: botEditForm.phoneNumber,
          balance: botEditForm.balance,
          bonus: botEditForm.bonus,
          isActive: botEditForm.isActive,
          bot_difficulty: botEditForm.bot_difficulty,
        }),
      });

      if (res.ok) {
        setSuccess("Bot updated successfully");
        closeEditBot();
        fetchBots(pagination.page, botSearch);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to update bot");
      }
    } catch {
      setError("Failed to update bot");
    } finally {
      setSavingBot(false);
    }
  };

  const updateWindowRange = (windowKey, field, value, isEdit) => {
    const numeric = Number(value);
    if (isEdit) {
      const base = ensureConfigWindows(editConfig || {});
      setEditConfig({
        ...base,
        time_window_bots: {
          ...base.time_window_bots,
          [windowKey]: {
            ...base.time_window_bots[windowKey],
            [field]: numeric,
          },
        },
      });
      return;
    }

    const base = ensureConfigWindows(newConfig);
    setNewConfig({
      ...base,
      time_window_bots: {
        ...base.time_window_bots,
        [windowKey]: {
          ...base.time_window_bots[windowKey],
          [field]: numeric,
        },
      },
    });
  };

  const tabs = [
    { id: "config", label: "Win Rate Config", icon: Settings },
    { id: "bots", label: "Bot Users", icon: Users },
    { id: "stats", label: "Statistics", icon: Activity },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-7 h-7 text-primary" />
            Bot Management
          </h2>
          <p className="text-gray-500">
            Configure automated players and win rates for system games
          </p>
        </div>
        <button
          onClick={() => {
            fetchData();
            fetchBots();
          }}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:text-red-900">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 text-green-700 rounded flex justify-between items-center">
          <span>{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="hover:text-green-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Bots</p>
              <p className="text-xl font-bold text-gray-900">
                {stats?.totalBots ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Bots</p>
              <p className="text-xl font-bold text-gray-900">
                {stats?.activeBots ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Settings className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Configs</p>
              <p className="text-xl font-bold text-gray-900">
                {stats?.activeConfigs ?? 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Inactive Bots</p>
              <p className="text-xl font-bold text-gray-900">
                {stats?.inactiveBots ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b">
          <nav className="flex" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 py-4 px-4 text-center border-b-2 font-medium text-sm flex items-center justify-center gap-2
                  ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Win Rate Config Tab */}
          {activeTab === "config" && (
            <div className="space-y-6">
              {/* Add New Config */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  {editConfig ? "Edit Configuration" : "Add New Configuration"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stake Amount (ETB)
                    </label>
                    {editConfig ? (
                      <div className="w-full rounded-lg border-gray-300 border p-2 bg-gray-100 text-gray-700">
                        {editConfig.stake_amount} ETB
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          value={newConfig.stake_amount}
                          onChange={(e) =>
                            setNewConfig({
                              ...newConfig,
                              stake_amount: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border-gray-300 border p-2 appearance-none bg-white pr-8"
                        >
                          <option value="">Select stake amount</option>
                          {availableStakes
                            .filter(
                              (stake) =>
                                !configs.some((c) => c.stake_amount === stake),
                            )
                            .map((stake) => (
                              <option key={stake} value={stake}>
                                {stake} ETB
                              </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                      </div>
                    )}
                    {!editConfig &&
                      availableStakes.filter(
                        (stake) =>
                          !configs.some((c) => c.stake_amount === stake),
                      ).length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          All stakes have configs. Add new stakes in Settings →
                          System Games.
                        </p>
                      )}
                  </div>
                  <div className="md:col-span-3 lg:col-span-4">
                    <div className="rounded-lg border border-gray-300 p-3 bg-white">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Fixed Time Windows (Africa/Addis_Ababa)
                      </p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {fixedWindows.map((windowDef) => {
                          const source = ensureConfigWindows(
                            editConfig || newConfig,
                          );
                          const range = source.time_window_bots?.[
                            windowDef.key
                          ] || {
                            min_bots: 0,
                            max_bots: 0,
                          };
                          return (
                            <div
                              key={windowDef.key}
                              className="border border-gray-200 rounded-md p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium text-gray-900 capitalize">
                                  {windowDef.key}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {windowDef.label}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Min Bots
                                  </label>
                                  <input
                                    type="number"
                                    value={range.min_bots}
                                    onChange={(e) =>
                                      updateWindowRange(
                                        windowDef.key,
                                        "min_bots",
                                        e.target.value,
                                        !!editConfig,
                                      )
                                    }
                                    className="w-full rounded border-gray-300 border p-1.5"
                                    min="0"
                                    max="400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Max Bots
                                  </label>
                                  <input
                                    type="number"
                                    value={range.max_bots}
                                    onChange={(e) =>
                                      updateWindowRange(
                                        windowDef.key,
                                        "max_bots",
                                        e.target.value,
                                        !!editConfig,
                                      )
                                    }
                                    className="w-full rounded border-gray-300 border p-1.5"
                                    min="0"
                                    max="400"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Percent className="w-4 h-4" />
                      Bot Win Rate (%)
                    </label>
                    <input
                      type="number"
                      value={editConfig?.bot_win_rate ?? newConfig.bot_win_rate}
                      onChange={(e) =>
                        editConfig
                          ? setEditConfig({
                              ...editConfig,
                              bot_win_rate: Number(e.target.value),
                            })
                          : setNewConfig({
                              ...newConfig,
                              bot_win_rate: Number(e.target.value),
                            })
                      }
                      className="w-full rounded-lg border-gray-300 border p-2"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Min Delay (s)
                    </label>
                    <input
                      type="number"
                      value={
                        editConfig?.join_delay_min ?? newConfig.join_delay_min
                      }
                      onChange={(e) =>
                        editConfig
                          ? setEditConfig({
                              ...editConfig,
                              join_delay_min: Number(e.target.value),
                            })
                          : setNewConfig({
                              ...newConfig,
                              join_delay_min: Number(e.target.value),
                            })
                      }
                      className="w-full rounded-lg border-gray-300 border p-2"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Max Delay (s)
                    </label>
                    <input
                      type="number"
                      value={
                        editConfig?.join_delay_max ?? newConfig.join_delay_max
                      }
                      onChange={(e) =>
                        editConfig
                          ? setEditConfig({
                              ...editConfig,
                              join_delay_max: Number(e.target.value),
                            })
                          : setNewConfig({
                              ...newConfig,
                              join_delay_max: Number(e.target.value),
                            })
                      }
                      className="w-full rounded-lg border-gray-300 border p-2"
                      min="5"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={editConfig?.notes ?? newConfig.notes}
                      onChange={(e) =>
                        editConfig
                          ? setEditConfig({
                              ...editConfig,
                              notes: e.target.value,
                            })
                          : setNewConfig({
                              ...newConfig,
                              notes: e.target.value,
                            })
                      }
                      className="w-full rounded-lg border-gray-300 border p-2"
                      placeholder="Optional notes..."
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => saveConfig(editConfig || newConfig)}
                    disabled={
                      saving || (!editConfig && !newConfig.stake_amount)
                    }
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editConfig ? "Update" : "Save"} Configuration
                  </button>
                  {editConfig && (
                    <button
                      onClick={() => setEditConfig(null)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Existing Configs */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Configured Stake Amounts
                </h3>
                <div className="space-y-3">
                  {configs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No bot configurations found. Add one above.</p>
                    </div>
                  ) : (
                    configs.map((config) => (
                      <div
                        key={config.stake_amount}
                        className={`bg-white border rounded-lg p-4 ${
                          config.is_active
                            ? "border-green-200"
                            : "border-gray-200 opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-2xl font-bold text-gray-900">
                                {config.stake_amount}
                              </p>
                              <p className="text-xs text-gray-500">ETB</p>
                            </div>
                            <div className="flex gap-6 text-sm">
                              <div>
                                <p className="text-gray-500">Bots</p>
                                <p className="font-medium">
                                  {config.min_bots}-{config.max_bots} (overall)
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Win Rate</p>
                                <p className="font-medium text-primary">
                                  {config.bot_win_rate}%
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Join Delay</p>
                                <p className="font-medium">
                                  {config.join_delay_min}-
                                  {config.join_delay_max}s
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500">Window Ranges</p>
                                <div className="text-xs text-gray-700 space-y-0.5">
                                  {fixedWindows.map((windowDef) => {
                                    const ranges =
                                      ensureConfigWindows(
                                        config,
                                      ).time_window_bots;
                                    const range = ranges[windowDef.key];
                                    return (
                                      <p
                                        key={`${config.stake_amount}-${windowDef.key}`}
                                      >
                                        {windowDef.key}: {range.min_bots}-
                                        {range.max_bots}
                                      </p>
                                    );
                                  })}
                                </div>
                              </div>
                              {config.notes && (
                                <div>
                                  <p className="text-gray-500">Notes</p>
                                  <p className="font-medium text-gray-600">
                                    {config.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleConfig(config.stake_amount)}
                              className={`p-2 rounded-lg ${
                                config.is_active
                                  ? "text-green-600 hover:bg-green-50"
                                  : "text-gray-400 hover:bg-gray-100"
                              }`}
                              title={
                                config.is_active ? "Deactivate" : "Activate"
                              }
                            >
                              {config.is_active ? (
                                <ToggleRight className="w-6 h-6" />
                              ) : (
                                <ToggleLeft className="w-6 h-6" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                setEditConfig(ensureConfigWindows(config))
                              }
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Edit"
                            >
                              <Settings className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => deleteConfig(config.stake_amount)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bot Users Tab */}
          {activeTab === "bots" && (
            <div>
              {/* Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search bots by name or phone..."
                    value={botSearch}
                    onChange={(e) => setBotSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {bots.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {botSearch ? "No bots found" : "No Bot Users Created"}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {botSearch
                      ? "Try adjusting your search query."
                      : "Run the seed script to create bot users."}
                  </p>
                  {!botSearch && (
                    <div className="bg-gray-100 rounded-lg p-4 inline-block text-left">
                      <p className="text-sm text-gray-600 font-mono">
                        cd backend && node scripts/seedBots.js
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Bot Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Difficulty
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Balance
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {bots.map((bot) => (
                          <tr key={bot._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-center text-white text-sm font-medium">
                                  {bot.name?.charAt(0) || "B"}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {bot.name}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {bot.phoneNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                Level {bot.bot_difficulty || 1}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center gap-1">
                                <Wallet className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">
                                  {(
                                    (bot.balance || 0) + (bot.bonus || 0)
                                  ).toLocaleString()}{" "}
                                  ETB
                                </span>
                              </div>
                              {(bot.bonus || 0) > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Bonus: {bot.bonus.toLocaleString()} ETB
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  bot.isActive
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {bot.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => openEditBot(bot)}
                                  className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                                  title="Edit Bot"
                                >
                                  <Edit className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => toggleBot(bot._id)}
                                  className={`${
                                    bot.isActive
                                      ? "text-red-600 hover:text-red-900"
                                      : "text-green-600 hover:text-green-900"
                                  }`}
                                >
                                  {bot.isActive ? "Deactivate" : "Activate"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {pagination.total > 0 ? (
                        <>
                          Page {pagination.page} of {pagination.totalPages} (
                          {pagination.total} total)
                        </>
                      ) : (
                        "No results"
                      )}
                    </p>
                    {pagination.totalPages > 1 && (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            fetchBots(pagination.page - 1, botSearch)
                          }
                          disabled={pagination.page <= 1}
                          className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() =>
                            fetchBots(pagination.page + 1, botSearch)
                          }
                          disabled={pagination.page >= pagination.totalPages}
                          className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === "stats" && (
            <div className="space-y-6">
              {!stats ? (
                <div className="text-center py-12">
                  <Activity className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Statistics Available
                  </h3>
                  <p className="text-gray-500">
                    Statistics will appear once bots and configurations are set
                    up.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Bot Distribution */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Bots by Difficulty Level
                      </h3>
                      {Object.keys(stats.botsByDifficulty || {}).length ===
                      0 ? (
                        <p className="text-gray-500 text-sm">
                          No bot users created yet. Run the seed script to
                          create bots.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(stats.botsByDifficulty || {}).map(
                            ([level, count]) => (
                              <div
                                key={level}
                                className="flex items-center justify-between"
                              >
                                <span className="text-sm text-gray-600">
                                  Level {level === "null" ? "N/A" : level}
                                </span>
                                <div className="flex items-center gap-2">
                                  <div className="w-32 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-primary rounded-full h-2"
                                      style={{
                                        width: `${
                                          stats.totalBots > 0
                                            ? (count / stats.totalBots) * 100
                                            : 0
                                        }%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium w-8">
                                    {count}
                                  </span>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>

                    {/* Active Configurations */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Active Configurations
                      </h3>
                      {!stats.configDetails ||
                      stats.configDetails.length === 0 ? (
                        <p className="text-gray-500 text-sm">
                          No active configurations. Create one in the "Win Rate
                          Config" tab.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {stats.configDetails.map((config) => (
                            <div
                              key={config.stake_amount}
                              className="flex items-center justify-between bg-white p-3 rounded border"
                            >
                              <div>
                                <span className="font-medium">
                                  {config.stake_amount} ETB
                                </span>
                                <span className="text-gray-500 ml-2 text-sm">
                                  ({config.min_bots}-{config.max_bots} bots)
                                </span>
                              </div>
                              <span className="text-primary font-bold">
                                {config.bot_win_rate}% win rate
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      How Win Rate Works
                    </h4>
                    <p className="text-sm text-blue-800">
                      When a game starts, the system rolls a dice (0-100). If
                      the roll is below the configured win rate, bots will
                      receive "best" cards that win earlier in the sequence. If
                      the roll is above the win rate, human players will receive
                      the best cards. The ball sequence remains provably fair -
                      only the card assignment is optimized.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Bot Modal */}
      {editBot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Edit Bot: {editBot.name}
              </h3>
              <button
                onClick={closeEditBot}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bot Name
                </label>
                <input
                  type="text"
                  value={botEditForm.name}
                  onChange={(e) =>
                    setBotEditForm({ ...botEditForm, name: e.target.value })
                  }
                  className="w-full rounded-lg border-gray-300 border p-2"
                  placeholder="Enter bot name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={botEditForm.phoneNumber}
                  onChange={(e) =>
                    setBotEditForm({
                      ...botEditForm,
                      phoneNumber: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border-gray-300 border p-2"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty Level
                </label>
                <input
                  type="number"
                  value={botEditForm.bot_difficulty}
                  onChange={(e) =>
                    setBotEditForm({
                      ...botEditForm,
                      bot_difficulty: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border-gray-300 border p-2"
                  min="1"
                  max="10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Difficulty level between 1-10
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Wallet className="w-4 h-4" />
                    Balance (ETB)
                  </label>
                  <input
                    type="number"
                    value={botEditForm.balance}
                    onChange={(e) =>
                      setBotEditForm({
                        ...botEditForm,
                        balance: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border-gray-300 border p-2"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bonus (ETB)
                  </label>
                  <input
                    type="number"
                    value={botEditForm.bonus}
                    onChange={(e) =>
                      setBotEditForm({
                        ...botEditForm,
                        bonus: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border-gray-300 border p-2"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={botEditForm.isActive}
                    onChange={(e) =>
                      setBotEditForm({
                        ...botEditForm,
                        isActive: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Active Status
                  </span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={closeEditBot}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                disabled={savingBot}
              >
                Cancel
              </button>
              <button
                onClick={saveBotEdit}
                disabled={
                  savingBot || !botEditForm.name || !botEditForm.phoneNumber
                }
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {savingBot ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotManagement;
