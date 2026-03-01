import React, { useState, useEffect } from "react";
import {
  Users,
  RefreshCw,
  Filter,
  Search,
  Edit,
  X,
  Save,
  Trash2,
} from "lucide-react";
import usePlayersStore from "../store/playersStore";

const Players = () => {
  const {
    players,
    loading,
    error,
    success,
    pagination,
    filters,
    selectedPlayer,
    fetchPlayers,
    updatePlayer,
    deletePlayer,
    setFilters,
    setPagination,
    setSelectedPlayer,
    clearSelectedPlayer,
    clearError,
    clearSuccess,
  } = usePlayersStore();

  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phoneNumber: "",
    isVerified: false,
    isActive: true,
    points: 0,
    balance: 0,
    bonus: 0,
  });

  useEffect(() => {
    fetchPlayers(pagination.page, pagination.limit, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, filters.search, filters.isVerified]);

  const handleFilterChange = (key, value) => {
    setFilters({ [key]: value });
  };

  const handleLimitChange = (newLimit) => {
    setPagination({
      limit: parseInt(newLimit),
      page: 1, // Reset to first page when changing limit
    });
  };

  const handlePlayerClick = (player) => {
    setSelectedPlayer(player);
    setEditForm({
      name: player.name,
      phoneNumber: player.phoneNumber,
      isVerified: player.isVerified,
      isActive: player.isActive,
      points: player.points || 0,
      balance: player.balance || 0,
      bonus: player.bonus || 0,
    });
    setIsEditMode(false);
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    if (selectedPlayer) {
      setEditForm({
        name: selectedPlayer.name,
        phoneNumber: selectedPlayer.phoneNumber,
        isVerified: selectedPlayer.isVerified,
        isActive: selectedPlayer.isActive,
        points: selectedPlayer.points || 0,
        balance: selectedPlayer.balance || 0,
        bonus: selectedPlayer.bonus || 0,
      });
    }
  };

  const handleSave = async () => {
    if (!selectedPlayer) return;

    const result = await updatePlayer(selectedPlayer.id, editForm);
    if (result.success) {
      setIsEditMode(false);
      // Update selected player with new data from result
      if (result.data) {
        setSelectedPlayer({ ...selectedPlayer, ...result.data });
      } else {
        // Fallback: find updated player from list
        const updatedPlayer = players.find((p) => p.id === selectedPlayer.id);
        if (updatedPlayer) {
          setSelectedPlayer(updatedPlayer);
        }
      }
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedPlayer) return;

    const result = await deletePlayer(selectedPlayer.id);
    if (result.success) {
      setShowDeleteConfirm(false);
      clearSelectedPlayer();
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const getStatusBadge = (isVerified, isActive) => {
    if (!isActive) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
          Inactive
        </span>
      );
    }
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          isVerified
            ? "bg-green-100 text-green-800"
            : "bg-yellow-100 text-yellow-800"
        }`}
      >
        {isVerified ? "Verified" : "Unverified"}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "Br 0";
    return `Br ${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 text-green-700 rounded">
          <div className="flex justify-between items-center">
            <span>{success}</span>
            <button onClick={clearSuccess}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded">
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <button onClick={clearError}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Players</h2>
          <p className="text-gray-500">
            Manage registered players (Users only)
          </p>
        </div>
        <button
          onClick={() => fetchPlayers()}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <div className="flex gap-4 flex-1 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verification
              </label>
              <select
                value={filters.isVerified}
                onChange={(e) =>
                  handleFilterChange("isVerified", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All</option>
                <option value="true">Verified</option>
                <option value="false">Unverified</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Players Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading && players.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <p className="text-gray-500">Loading players...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded">
              {error}
            </div>
          </div>
        ) : players.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              No Players Found
            </h3>
            <p className="text-gray-500 mt-2">
              No players match your search criteria.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Points
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referral
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {players.map((player) => (
                    <tr
                      key={player.id}
                      onClick={() => handlePlayerClick(player)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {player.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {player.phoneNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(player.isVerified, player.isActive)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(player.balance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {player.points || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.referralNumber || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(player.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(pagination.totalPages > 1 || pagination.total > 0) && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-700">
                      Showing{" "}
                      <span className="font-medium">
                        {pagination.total === 0
                          ? 0
                          : (pagination.page - 1) * pagination.limit + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-medium">
                        {Math.min(
                          pagination.page * pagination.limit,
                          pagination.total
                        )}
                      </span>{" "}
                      of <span className="font-medium">{pagination.total}</span>{" "}
                      players
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-700">Per page:</label>
                      <select
                        value={pagination.limit}
                        onChange={(e) => handleLimitChange(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>
                  </div>
                  {pagination.totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setPagination({
                            page: Math.max(1, pagination.page - 1),
                          })
                        }
                        disabled={pagination.page === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() =>
                          setPagination({
                            page: Math.min(
                              pagination.totalPages,
                              pagination.page + 1
                            ),
                          })
                        }
                        disabled={pagination.page === pagination.totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">
                Player Details
              </h3>
              <div className="flex gap-2">
                {!isEditMode && (
                  <>
                    <button
                      onClick={handleEdit}
                      className="p-2 text-primary hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Player"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleDeleteClick}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Player"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
                <button
                  onClick={clearSelectedPlayer}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {isEditMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={editForm.phoneNumber}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          phoneNumber: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Balance
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.balance}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          balance: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bonus
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.bonus}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          bonus: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Points
                    </label>
                    <input
                      type="number"
                      value={editForm.points}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          points: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.isVerified}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              isVerified: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Verified
                        </span>
                      </label>
                    </div>
                    <div className="flex-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              isActive: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Active
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={handleSave}
                      className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Save Changes
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Name
                    </label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedPlayer.name}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Phone Number
                    </label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedPlayer.phoneNumber}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Status
                    </label>
                    <div className="mt-1">
                      {getStatusBadge(
                        selectedPlayer.isVerified,
                        selectedPlayer.isActive
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Balance
                    </label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {formatCurrency(selectedPlayer.balance || 0)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Bonus
                    </label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {formatCurrency(selectedPlayer.bonus || 0)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Total Balance
                    </label>
                    <p className="text-lg font-semibold text-green-600 mt-1">
                      {formatCurrency(
                        (selectedPlayer.balance || 0) +
                          (selectedPlayer.bonus || 0)
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Points
                    </label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedPlayer.points || 0}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Referral Number
                    </label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedPlayer.referralNumber || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Joined
                    </label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {formatDate(selectedPlayer.createdAt)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Last Updated
                    </label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {formatDate(selectedPlayer.updatedAt)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedPlayer && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Delete Player
                  </h3>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold">{selectedPlayer.name}</span>?
                This action cannot be undone and will permanently remove the
                player and all associated data.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={handleDeleteCancel}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Players;
