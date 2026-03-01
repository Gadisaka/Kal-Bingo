import React, { useState, useEffect, useCallback } from "react";
import {
  UserCog,
  RefreshCw,
  Filter,
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import useSubAdminStore from "../store/subAdminStore";

// Available pages that sub-admins can be granted access to
const AVAILABLE_PAGES = [
  { path: "/", label: "Dashboard", icon: "📊" },
  { path: "/games", label: "Games", icon: "🎮" },
  { path: "/players", label: "Players", icon: "👥" },
  { path: "/transactions", label: "Transactions", icon: "💸" },
  { path: "/withdrawals", label: "Withdrawals", icon: "💰" },
  { path: "/revenue", label: "Revenue", icon: "💰" },
  { path: "/bots", label: "Bot Management", icon: "🤖" },
  { path: "/notifications", label: "Notifications", icon: "🔔" },
  { path: "/ads", label: "Ads", icon: "📢" },
  { path: "/settings", label: "Settings", icon: "⚙️" },
];

const SubAdmin = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingSubAdmin, setEditingSubAdmin] = useState(null);
  const [validationError, setValidationError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    pin: "",
    isActive: true,
    allowedPages: [],
  });

  const {
    subAdmins,
    loading,
    saving,
    error,
    success,
    pagination,
    filters,
    fetchSubAdmins,
    createSubAdmin,
    updateSubAdmin,
    deleteSubAdmin,
    setFilters,
    setPagination,
    clearError,
    clearSuccess,
  } = useSubAdminStore();

  // Fetch sub-admins on component mount and when filters/pagination change
  const loadSubAdmins = useCallback(() => {
    fetchSubAdmins(pagination.page, pagination.limit, filters);
  }, [fetchSubAdmins, pagination.page, pagination.limit, filters]);

  useEffect(() => {
    loadSubAdmins();
  }, [loadSubAdmins]);

  // Clear messages when component unmounts
  useEffect(() => {
    return () => {
      clearError();
      clearSuccess();
    };
  }, [clearError, clearSuccess]);

  const handleFilterChange = (key, value) => {
    setFilters({ [key]: value });
  };

  const handlePageChange = (newPage) => {
    setPagination({ page: newPage });
  };

  const openAddModal = () => {
    setEditingSubAdmin(null);
    setValidationError("");
    setFormData({
      name: "",
      phoneNumber: "",
      pin: "",
      isActive: true,
      allowedPages: [],
    });
    setShowModal(true);
  };

  const openEditModal = (subAdmin) => {
    setEditingSubAdmin(subAdmin);
    setValidationError("");
    setFormData({
      name: subAdmin.name,
      phoneNumber: subAdmin.phoneNumber,
      pin: "", // Don't show PIN for security
      isActive: subAdmin.isActive,
      allowedPages: subAdmin.allowedPages || [],
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSubAdmin(null);
    setValidationError("");
    setFormData({
      name: "",
      phoneNumber: "",
      pin: "",
      isActive: true,
      allowedPages: [],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError("");

    // Validation
    if (!formData.name || !formData.phoneNumber) {
      setValidationError("Name and phone number are required");
      return;
    }

    // PIN is required only for new sub-admins
    if (!editingSubAdmin && !formData.pin) {
      setValidationError("Password is required for new sub-admins");
      return;
    }

    // At least one page must be selected
    if (!formData.allowedPages || formData.allowedPages.length === 0) {
      setValidationError("At least one page access must be selected");
      return;
    }

    const submitData = { ...formData };
    // Don't send PIN if empty (for updates)
    if (!submitData.pin) {
      delete submitData.pin;
    }
    // Ensure allowedPages is always an array
    if (!Array.isArray(submitData.allowedPages)) {
      submitData.allowedPages = [];
    }

    const result = editingSubAdmin
      ? await updateSubAdmin(editingSubAdmin.id, submitData)
      : await createSubAdmin(submitData);

    if (result.success) {
      closeModal();
      // Refresh the page after creating a new sub-admin
      if (!editingSubAdmin) {
        window.location.reload();
      }
    }
  };

  const handleDelete = async (id) => {
    if (
      window.confirm(
        "Are you sure you want to permanently delete this sub-admin? This action cannot be undone and will permanently remove the sub-admin and all associated data."
      )
    ) {
      await deleteSubAdmin(id);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (isActive) => {
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}
      >
        {isActive ? "Active" : "Inactive"}
      </span>
    );
  };

  // create

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Sub Admin Management
          </h2>
          <p className="text-gray-500">
            Manage sub-admin accounts and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSubAdmins}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Sub Admin
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="text-red-700 hover:text-red-900"
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
            className="text-green-700 hover:text-green-900"
          >
            ×
          </button>
        </div>
      )}

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
                Status
              </label>
              <select
                value={filters.isActive}
                onChange={(e) => handleFilterChange("isActive", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Admins Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading && subAdmins.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCog className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <p className="text-gray-500">Loading sub-admins...</p>
          </div>
        ) : error && subAdmins.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded">
              {error}
            </div>
          </div>
        ) : subAdmins.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCog className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              No Sub-Admins Found
            </h3>
            <p className="text-gray-500 mt-2">
              No sub-admins match your search criteria. Click "Add Sub Admin" to
              create one.
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
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Access Pages
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subAdmins.map((subAdmin) => (
                    <tr
                      key={subAdmin.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {subAdmin.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {subAdmin.phoneNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(subAdmin.isActive)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {subAdmin.lastLogin
                          ? formatDate(subAdmin.lastLogin)
                          : "Never"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(subAdmin.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="flex flex-wrap gap-1">
                          {subAdmin.allowedPages &&
                          subAdmin.allowedPages.length > 0 ? (
                            subAdmin.allowedPages.map((path) => {
                              const page = AVAILABLE_PAGES.find(
                                (p) => p.path === path
                              );
                              return (
                                <span
                                  key={path}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                                >
                                  {page?.icon || "📄"} {page?.label || path}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-gray-400">No access</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(subAdmin)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(subAdmin.id)}
                            className="text-red-600 hover:text-red-900 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing{" "}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total
                    )}
                  </span>{" "}
                  of <span className="font-medium">{pagination.total}</span>{" "}
                  results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 bg-opacity-50 px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingSubAdmin ? "Edit Sub Admin" : "Add Sub Admin"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {validationError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-700 rounded">
                  {validationError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password{" "}
                  {!editingSubAdmin && <span className="text-red-500">*</span>}
                  {editingSubAdmin && (
                    <span className="text-gray-500 text-xs ml-1">
                      (Leave empty to keep current)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={formData.pin}
                  onChange={(e) =>
                    setFormData({ ...formData, pin: e.target.value })
                  }
                  required={!editingSubAdmin}
                  placeholder="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Page Access <span className="text-red-500">*</span>
                </label>
                <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {AVAILABLE_PAGES.map((page) => (
                      <label
                        key={page.path}
                        className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.allowedPages.includes(page.path)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                allowedPages: [
                                  ...formData.allowedPages,
                                  page.path,
                                ],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                allowedPages: formData.allowedPages.filter(
                                  (p) => p !== page.path
                                ),
                              });
                            }
                          }}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                        <span className="text-base mr-2">{page.icon}</span>
                        <span className="text-sm font-medium text-gray-700">
                          {page.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Select which pages this sub-admin can access
                </p>
              </div>

              {editingSubAdmin && (
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Active
                    </span>
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingSubAdmin ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubAdmin;
