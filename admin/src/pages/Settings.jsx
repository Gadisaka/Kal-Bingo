import React, { useState, useEffect } from "react";
import {
  Save,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Phone,
  User,
} from "lucide-react";
import useSettingsStore from "../store/settingsStore";
import axios from "axios";
import { API_URL } from "../constant";

const Settings = () => {
  const [activeTab, setActiveTab] = useState("system");
  const [newStake, setNewStake] = useState("");

  // Deposit account settings state
  const [depositSettings, setDepositSettings] = useState({
    telebirr: {
      enabled: true,
      accountName: "",
      phoneNumber: "",
    },
    deposit: {
      minAmount: 10,
      maxAmount: 100000,
    },
  });
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositSaving, setDepositSaving] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [depositSuccess, setDepositSuccess] = useState("");

  // Get state and actions from store
  const {
    settings,
    spinConfig,
    loading,
    saving,
    error,
    success,
    fetchSettings,
    fetchSpinConfig,
    saveSystemSettings,
    saveUserGamesSettings,
    updateSystemField,
    updateUserGamesField,
    updateWelcomeBonusField,
    saveWelcomeBonusSettings,
    addStake,
    removeStake,
    clearError,
    clearSuccess,
  } = useSettingsStore();

  const systemSettings = {
    maxPlayers: settings?.systemGames?.maxPlayers ?? 100,
    minStake: settings?.systemGames?.minStake ?? 10,
    maxStake: settings?.systemGames?.maxStake ?? 1000,
    callInterval: settings?.systemGames?.callInterval ?? 5,
    winCut: settings?.systemGames?.winCut ?? 10,
    gameStakes: settings?.systemGames?.gameStakes ?? [10, 20, 30, 50, 100],
    waitingRoomDuration: settings?.systemGames?.waitingRoomDuration ?? 60,
  };

  const welcomeBonusSettings = {
    enabled: settings?.welcomeBonus?.enabled ?? true,
    amount: settings?.welcomeBonus?.amount ?? 50,
  };

  const userGamesSettings = settings?.userGames || {
    maxPlayers: 50,
    minStake: 5,
    maxStake: 500,
    winCut: 10,
    hostShare: 5,
  };

  // Fetch deposit account settings
  const fetchDepositSettings = async () => {
    setDepositLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_URL}/api/admin/deposit-accounts`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success && response.data.data) {
        setDepositSettings({
          telebirr: response.data.data.depositAccounts?.telebirr || {
            enabled: true,
            accountName: "",
            phoneNumber: "",
          },
          deposit: response.data.data.deposit || {
            minAmount: 10,
            maxAmount: 100000,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching deposit settings:", error);
      setDepositError("Failed to load deposit settings");
    } finally {
      setDepositLoading(false);
    }
  };

  // Save deposit account settings
  const saveDepositSettings = async () => {
    setDepositSaving(true);
    setDepositError("");
    setDepositSuccess("");
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${API_URL}/api/admin/deposit-accounts`,
        {
          telebirr: depositSettings.telebirr,
          deposit: depositSettings.deposit,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.data.success) {
        setDepositSuccess("Deposit settings saved successfully!");
        setTimeout(() => setDepositSuccess(""), 3000);
      }
    } catch (error) {
      console.error("Error saving deposit settings:", error);
      setDepositError(
        error.response?.data?.message || "Failed to save deposit settings"
      );
    } finally {
      setDepositSaving(false);
    }
  };

  // Fetch settings on component mount
  useEffect(() => {
    fetchSettings();
    fetchSpinConfig();
    fetchDepositSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear messages when component unmounts
  useEffect(() => {
    return () => {
      clearError();
      clearSuccess();
    };
  }, [clearError, clearSuccess]);

  const handleSystemChange = (e) => {
    const { name, value } = e.target;
    // Convert to number for numeric fields
    const numericFields = [
      "maxPlayers",
      "minStake",
      "maxStake",
      "callInterval",
      "winCut",
      "waitingRoomDuration",
    ];
    const processedValue = numericFields.includes(name) ? Number(value) : value;
    updateSystemField(name, processedValue);
  };

  const handleUserGamesChange = (e) => {
    const { name, value } = e.target;
    // Convert to number for numeric fields
    const numericFields = [
      "maxPlayers",
      "minStake",
      "maxStake",
      "winCut",
      "hostShare",
    ];
    const processedValue = numericFields.includes(name) ? Number(value) : value;
    updateUserGamesField(name, processedValue);
  };

  const handleAddStake = () => {
    if (newStake) {
      addStake(Number(newStake));
      setNewStake("");
    }
  };

  const handleRemoveStake = (stake) => {
    removeStake(stake);
  };

  const tabs = [
    { id: "system", label: "System Games" },
    { id: "welcomeBonus", label: "Welcome Bonus" },
    { id: "deposit", label: "Deposit" },
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500">Manage your game configuration</p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="text-red-700 hover:text-red-900 ml-4"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 text-green-700 rounded flex justify-between items-center">
          <span>{success}</span>
          <button
            onClick={clearSuccess}
            className="text-green-700 hover:text-green-900 ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b">
          <nav className="flex" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  w-1/4 py-4 px-1 text-center border-b-2 font-medium text-sm
                  ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "system" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Players
                  </label>
                  <input
                    type="number"
                    name="maxPlayers"
                    value={systemSettings.maxPlayers}
                    onChange={handleSystemChange}
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Call Interval (seconds)
                  </label>
                  <input
                    type="number"
                    name="callInterval"
                    value={systemSettings.callInterval}
                    onChange={handleSystemChange}
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                  />
                </div> */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Stake (Birr)
                  </label>
                  <input
                    type="number"
                    name="minStake"
                    value={systemSettings.minStake}
                    onChange={handleSystemChange}
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Stake (Birr)
                  </label>
                  <input
                    type="number"
                    name="maxStake"
                    value={systemSettings.maxStake}
                    onChange={handleSystemChange}
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Win Cut (%)
                  </label>
                  <input
                    type="number"
                    name="winCut"
                    value={systemSettings.winCut}
                    onChange={handleSystemChange}
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Waiting Room Duration (seconds)
                  </label>
                  <input
                    type="number"
                    name="waitingRoomDuration"
                    value={systemSettings.waitingRoomDuration ?? 60}
                    onChange={handleSystemChange}
                    min="10"
                    max="300"
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Countdown time before game starts after first player joins
                    (10-300 seconds)
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  Game Stakes Configuration
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex gap-4 mb-4">
                    <input
                      type="number"
                      placeholder="Enter stake amount"
                      value={newStake}
                      onChange={(e) => setNewStake(e.target.value)}
                      className="flex-1 rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                    />
                    <button
                      onClick={handleAddStake}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Stake
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {systemSettings.gameStakes.map((stake) => (
                      <div
                        key={stake}
                        className="flex items-center justify-between bg-white p-3 rounded border border-gray-200 shadow-sm"
                      >
                        <span className="font-medium">{stake} Birr</span>
                        <button
                          onClick={() => handleRemoveStake(stake)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "user" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Players
                  </label>
                  <input
                    type="number"
                    name="maxPlayers"
                    value={userGamesSettings.maxPlayers}
                    onChange={handleUserGamesChange}
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Stake (Birr)
                  </label>
                  <input
                    type="number"
                    name="minStake"
                    value={userGamesSettings.minStake}
                    onChange={handleUserGamesChange}
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Stake (Birr)
                  </label>
                  <input
                    type="number"
                    name="maxStake"
                    value={userGamesSettings.maxStake}
                    onChange={handleUserGamesChange}
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Win Cut (%)
                  </label>
                  <input
                    type="number"
                    name="winCut"
                    value={userGamesSettings.winCut}
                    onChange={handleUserGamesChange}
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentage of winnings that goes to the system
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Host Share (%)
                  </label>
                  <input
                    type="number"
                    name="hostShare"
                    value={userGamesSettings.hostShare}
                    onChange={handleUserGamesChange}
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentage of winnings that goes to the game host
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "spin" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Spin Cost (Points)
                  </label>
                  <input
                    type="number"
                    value={spinConfig?.spinCostPoints || 500}
                    onChange={(e) =>
                      updateSpinConfigField(
                        "spinCostPoints",
                        Number(e.target.value)
                      )
                    }
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Points required to purchase one spin
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bonus Cash Reward (ETB)
                  </label>
                  <input
                    type="number"
                    value={spinConfig?.spinRewardBonusCash || 50}
                    onChange={(e) =>
                      updateSpinConfigField(
                        "spinRewardBonusCash",
                        Number(e.target.value)
                      )
                    }
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Amount awarded when BONUS_CASH outcome is selected
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points Reward
                  </label>
                  <input
                    type="number"
                    value={spinConfig?.spinRewardPoints || 200}
                    onChange={(e) =>
                      updateSpinConfigField(
                        "spinRewardPoints",
                        Number(e.target.value)
                      )
                    }
                    className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Points awarded when POINTS outcome is selected
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Spin Odds Configuration
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure the probability weights for each outcome. Higher
                  values mean higher probability. Values are relative weights
                  (not percentages).
                </p>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="space-y-4">
                    {Object.entries(spinConfig?.spinOdds || {}).map(
                      ([outcome, weight]) => {
                        const totalWeight = Object.values(
                          spinConfig?.spinOdds || {}
                        ).reduce((sum, w) => sum + Number(w || 0), 0);
                        const percentage =
                          totalWeight > 0
                            ? (
                                (Number(weight || 0) / totalWeight) *
                                100
                              ).toFixed(1)
                            : "0.0";

                        const getOutcomeLabel = (outcome) => {
                          switch (outcome) {
                            case "NO_PRIZE":
                              return "No Prize";
                            case "FREE_SPIN":
                              return "Free Spin";
                            case "BONUS_CASH":
                              return "Bonus Cash";
                            case "POINTS":
                              return "Points";
                            default:
                              return outcome;
                          }
                        };

                        return (
                          <div
                            key={outcome}
                            className="flex items-center justify-between bg-white p-3 rounded border border-gray-200"
                          >
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {getOutcomeLabel(outcome)}
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={weight || 0}
                                  onChange={(e) =>
                                    updateSpinOddsField(
                                      outcome,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-24 rounded-lg border-gray-300 border p-2 text-sm focus:ring-primary focus:border-primary"
                                  min="0"
                                  step="0.01"
                                />
                                <span className="text-sm text-gray-500">
                                  Weight
                                </span>
                                <span className="text-sm font-semibold text-primary">
                                  ({percentage}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-800">
                      <strong>Note:</strong> The percentages shown are
                      calculated based on the relative weights. Adjust weights
                      to change the probability distribution.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "welcomeBonus" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Welcome Bonus</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Non-withdrawable bonus (Birr) given to every new user when they register. Players can use it to play games but cannot withdraw it.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Enable Welcome Bonus
                    </label>
                    <button
                      onClick={() => updateWelcomeBonusField("enabled", !welcomeBonusSettings.enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        welcomeBonusSettings.enabled ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          welcomeBonusSettings.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {welcomeBonusSettings.enabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bonus Amount (Birr)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={welcomeBonusSettings.amount}
                        onChange={(e) => updateWelcomeBonusField("amount", Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        This amount is added as non-withdrawable bonus to the new user's wallet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "deposit" && (
            <div className="space-y-8">
              {depositError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded flex justify-between items-center">
                  <span>{depositError}</span>
                  <button
                    onClick={() => setDepositError("")}
                    className="text-red-700 hover:text-red-900 ml-4"
                  >
                    ×
                  </button>
                </div>
              )}

              {depositSuccess && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 text-green-700 rounded flex justify-between items-center">
                  <span>{depositSuccess}</span>
                  <button
                    onClick={() => setDepositSuccess("")}
                    className="text-green-700 hover:text-green-900 ml-4"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Telebirr Account Settings */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xs">TB</span>
                  </div>
                  Telebirr Account
                </h3>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="telebirrEnabled"
                      checked={depositSettings.telebirr.enabled}
                      onChange={(e) =>
                        setDepositSettings({
                          ...depositSettings,
                          telebirr: {
                            ...depositSettings.telebirr,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <label
                      htmlFor="telebirrEnabled"
                      className="text-sm font-medium text-gray-700"
                    >
                      Enable Telebirr deposits
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <User className="w-4 h-4 inline mr-1" />
                        Account Name
                      </label>
                      <input
                        type="text"
                        value={depositSettings.telebirr.accountName}
                        onChange={(e) =>
                          setDepositSettings({
                            ...depositSettings,
                            telebirr: {
                              ...depositSettings.telebirr,
                              accountName: e.target.value,
                            },
                          })
                        }
                        placeholder="Enter full account name"
                        className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        The name on the Telebirr account
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Phone className="w-4 h-4 inline mr-1" />
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={depositSettings.telebirr.phoneNumber}
                        onChange={(e) =>
                          setDepositSettings({
                            ...depositSettings,
                            telebirr: {
                              ...depositSettings.telebirr,
                              phoneNumber: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g., 0912345678"
                        className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        The Telebirr phone number to receive payments
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Deposit Limits */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Deposit Limits
                </h3>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Deposit (Birr)
                      </label>
                      <input
                        type="number"
                        value={depositSettings.deposit.minAmount}
                        onChange={(e) =>
                          setDepositSettings({
                            ...depositSettings,
                            deposit: {
                              ...depositSettings.deposit,
                              minAmount: Number(e.target.value),
                            },
                          })
                        }
                        min="1"
                        className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Deposit (Birr)
                      </label>
                      <input
                        type="number"
                        value={depositSettings.deposit.maxAmount}
                        onChange={(e) =>
                          setDepositSettings({
                            ...depositSettings,
                            deposit: {
                              ...depositSettings.deposit,
                              maxAmount: Number(e.target.value),
                            },
                          })
                        }
                        min="1"
                        className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Card */}
              {depositSettings.telebirr.enabled &&
                depositSettings.telebirr.phoneNumber && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Preview (How users will see it)
                    </h3>
                    <div className="bg-slate-900 p-6 rounded-lg border border-slate-700 max-w-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold">TB</span>
                        </div>
                        <div>
                          <h4 className="text-white font-bold">Telebirr</h4>
                          <p className="text-slate-400 text-sm">Mobile Money</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="bg-slate-800 rounded-lg p-3">
                          <p className="text-slate-400 text-xs">Account Name</p>
                          <p className="text-white font-medium">
                            {depositSettings.telebirr.accountName || "Not set"}
                          </p>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-3">
                          <p className="text-slate-400 text-xs">Phone Number</p>
                          <p className="text-white font-mono font-bold text-lg">
                            {depositSettings.telebirr.phoneNumber || "Not set"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* {activeTab === "bonus" && (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900">
                Bonus Settings
              </h3>
              <p>Configuration for bonuses and promotions will appear here.</p>
            </div>
          )} */}

          <div className="mt-8 pt-6 border-t flex justify-end">
            <button
              onClick={
                activeTab === "system"
                  ? saveSystemSettings
                  : activeTab === "welcomeBonus"
                  ? saveWelcomeBonusSettings
                  : activeTab === "deposit"
                  ? saveDepositSettings
                  : () => {}
              }
              disabled={saving || depositSaving}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving || depositSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
