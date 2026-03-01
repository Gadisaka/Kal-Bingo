import React, { useState, useEffect } from "react";
import {
  ArrowUpCircle,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Phone,
  User,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";

const formatDate = (dateStr) => {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return "0";
  return amount.toLocaleString();
};

const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [counts, setCounts] = useState({
    pending: 0,
    processing: 0,
    completed: 0,
    rejected: 0,
  });
  const [filterStatus, setFilterStatus] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: null, // 'approve' or 'reject'
    withdrawal: null,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [adminTransactionRef, setAdminTransactionRef] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchWithdrawals = async (page = 1, status = "") => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (status) {
        params.append("status", status);
      }

      const response = await axios.get(
        `${API_URL}/api/admin/withdrawals?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setWithdrawals(response.data.withdrawals);
        setPagination(response.data.pagination);
        setCounts(response.data.counts);
      }
    } catch (err) {
      console.error("Error fetching withdrawals:", err);
      setError(err.response?.data?.message || "Failed to load withdrawals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals(1, filterStatus);
  }, [filterStatus]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchWithdrawals(newPage, filterStatus);
    }
  };

  const handleApprove = async () => {
    if (!actionModal.withdrawal) return;

    setActionLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/api/admin/withdrawals/${actionModal.withdrawal.id}/approve`,
        {
          adminTransactionRef,
          adminNotes,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setSuccess("Withdrawal approved successfully!");
      setTimeout(() => setSuccess(""), 3000);
      closeActionModal();
      fetchWithdrawals(pagination.page, filterStatus);
    } catch (err) {
      console.error("Error approving withdrawal:", err);
      setError(err.response?.data?.message || "Failed to approve withdrawal");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!actionModal.withdrawal) return;

    if (!rejectionReason.trim()) {
      setError("Please provide a rejection reason");
      return;
    }

    setActionLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/api/admin/withdrawals/${actionModal.withdrawal.id}/reject`,
        {
          rejectionReason,
          adminNotes,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setSuccess("Withdrawal rejected and funds refunded to user");
      setTimeout(() => setSuccess(""), 3000);
      closeActionModal();
      fetchWithdrawals(pagination.page, filterStatus);
    } catch (err) {
      console.error("Error rejecting withdrawal:", err);
      setError(err.response?.data?.message || "Failed to reject withdrawal");
    } finally {
      setActionLoading(false);
    }
  };

  const openActionModal = (type, withdrawal) => {
    setActionModal({ isOpen: true, type, withdrawal });
    setAdminTransactionRef("");
    setAdminNotes("");
    setRejectionReason("");
    setError("");
  };

  const closeActionModal = () => {
    setActionModal({ isOpen: false, type: null, withdrawal: null });
    setAdminTransactionRef("");
    setAdminNotes("");
    setRejectionReason("");
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case "processing":
        return (
          <span className="flex items-center gap-1 text-blue-700 bg-blue-100 px-2 py-1 rounded-full text-xs font-medium">
            <Loader2 className="w-3 h-3" /> Processing
          </span>
        );
      case "completed":
        return (
          <span className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" /> Completed
          </span>
        );
      case "rejected":
        return (
          <span className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const filteredWithdrawals = searchQuery
    ? withdrawals.filter(
        (w) =>
          w.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.user?.phoneNumber?.includes(searchQuery) ||
          w.telebirrAccount?.phoneNumber?.includes(searchQuery)
      )
    : withdrawals;

  const statusFilters = [
    { value: "pending", label: "Pending", count: counts.pending },
    { value: "processing", label: "Processing", count: counts.processing },
    { value: "completed", label: "Completed", count: counts.completed },
    { value: "rejected", label: "Rejected", count: counts.rejected },
    { value: "", label: "All", count: Object.values(counts).reduce((a, b) => a + b, 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Withdrawals</h2>
          <p className="text-gray-500">Manage withdrawal requests</p>
        </div>
        <button
          onClick={() => fetchWithdrawals(pagination.page, filterStatus)}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-700 hover:text-red-900">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 text-green-700 rounded flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-green-700 hover:text-green-900">
            ×
          </button>
        </div>
      )}

      {/* Status Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                filterStatus === filter.value
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {filter.label}
              {filter.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs ${
                    filterStatus === filter.value
                      ? "bg-white/20 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {filter.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading && withdrawals.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Loading withdrawals...
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="text-center py-12">
            <ArrowUpCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No withdrawals found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Telebirr Account
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredWithdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {w.user ? (
                          <div>
                            <p className="font-medium text-gray-900">
                              {w.user.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {w.user.phoneNumber}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">Unknown</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-lg text-gray-900">
                          {formatCurrency(w.amount)} Birr
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {w.telebirrAccount && (
                          <div className="bg-gray-50 rounded-lg p-2 text-sm">
                            <div className="flex items-center gap-1 text-gray-600">
                              <User className="w-3 h-3" />
                              {w.telebirrAccount.accountName}
                            </div>
                            <div className="flex items-center gap-1 text-gray-800 font-mono font-medium">
                              <Phone className="w-3 h-3" />
                              {w.telebirrAccount.phoneNumber}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(w.status)}
                        {w.rejectionReason && (
                          <p className="text-xs text-red-600 mt-1 max-w-[200px] truncate">
                            {w.rejectionReason}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{formatDate(w.createdAt)}</div>
                        {w.processedAt && (
                          <div className="text-xs text-gray-400">
                            Processed: {formatDate(w.processedAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(w.status === "pending" || w.status === "processing") && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openActionModal("approve", w)}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => openActionModal("reject", w)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-1"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </button>
                          </div>
                        )}
                        {w.status === "completed" && w.processedBy && (
                          <span className="text-sm text-gray-500">
                            By: {w.processedBy}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} withdrawals
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="px-4 py-2 text-sm font-medium text-gray-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Modal */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeActionModal}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {actionModal.type === "approve"
                ? "Approve Withdrawal"
                : "Reject Withdrawal"}
            </h3>

            {/* Withdrawal Details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Amount:</span>
                <span className="font-bold">
                  {formatCurrency(actionModal.withdrawal?.amount)} Birr
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">User:</span>
                <span>{actionModal.withdrawal?.user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Telebirr:</span>
                <span className="font-mono">
                  {actionModal.withdrawal?.telebirrAccount?.phoneNumber}
                </span>
              </div>
            </div>

            {actionModal.type === "approve" ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Telebirr Transaction Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={adminTransactionRef}
                    onChange={(e) => setAdminTransactionRef(e.target.value)}
                    placeholder="Transaction ID from your Telebirr"
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Any notes about this transaction"
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-yellow-800 text-sm">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Make sure you have sent{" "}
                    <strong>{formatCurrency(actionModal.withdrawal?.amount)} Birr</strong> to{" "}
                    <strong>{actionModal.withdrawal?.telebirrAccount?.phoneNumber}</strong> via
                    Telebirr before approving.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why you're rejecting this withdrawal"
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-blue-800 text-sm">
                    The withdrawal amount will be refunded back to the user's
                    wallet automatically.
                  </p>
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={closeActionModal}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={actionModal.type === "approve" ? handleApprove : handleReject}
                disabled={actionLoading}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
                  actionModal.type === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : actionModal.type === "approve" ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Reject
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

export default Withdrawals;

