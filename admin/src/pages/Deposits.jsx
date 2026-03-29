import React, { useState, useEffect } from "react";
import {
  ArrowDownCircle,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
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

const providerLabel = (provider) => {
  if (provider === "cbebirr") return "CBE Birr";
  if (provider === "telebirr") return "Telebirr";
  return provider || "—";
};

const Deposits = () => {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [counts, setCounts] = useState({
    pending: 0,
    verified: 0,
    failed: 0,
    expired: 0,
  });
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDeposits = async (page = 1, status = filterStatus) => {
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
        `${API_URL}/api/admin/deposits?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setDeposits(response.data.deposits);
        setPagination(response.data.pagination);
        if (response.data.counts) {
          setCounts(response.data.counts);
        }
      }
    } catch (err) {
      console.error("Error fetching deposits:", err);
      setError(err.response?.data?.message || "Failed to load deposits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeposits(1, filterStatus);
  }, [filterStatus]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchDeposits(newPage, filterStatus);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full text-xs font-medium w-fit">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case "verified":
        return (
          <span className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-full text-xs font-medium w-fit">
            <CheckCircle className="w-3 h-3" /> Verified
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded-full text-xs font-medium w-fit">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      case "expired":
        return (
          <span className="flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-1 rounded-full text-xs font-medium w-fit">
            <AlertTriangle className="w-3 h-3" /> Expired
          </span>
        );
      default:
        return null;
    }
  };

  const filteredDeposits = searchQuery
    ? deposits.filter(
        (d) =>
          d.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.user?.phoneNumber?.includes(searchQuery) ||
          d.transactionId?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : deposits;

  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const statusFilters = [
    { value: "", label: "All", count: allCount },
    { value: "pending", label: "Pending", count: counts.pending },
    { value: "verified", label: "Verified", count: counts.verified },
    { value: "failed", label: "Failed", count: counts.failed },
    { value: "expired", label: "Expired", count: counts.expired },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Deposits</h2>
          <p className="text-gray-500">Review deposit activity and verification status</p>
        </div>
        <button
          onClick={() => fetchDeposits(pagination.page, filterStatus)}
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

      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value === "" ? "all" : filter.value}
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

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or transaction ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading && deposits.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Loading deposits...</div>
        ) : filteredDeposits.length === 0 ? (
          <div className="text-center py-12">
            <ArrowDownCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No deposits found</p>
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
                      Verified
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDeposits.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {d.user ? (
                          <div>
                            <p className="font-medium text-gray-900">{d.user.name}</p>
                            <p className="text-sm text-gray-500">{d.user.phoneNumber}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">Unknown</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-lg text-gray-900">
                          {formatCurrency(d.amount)} Birr
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {d.verifiedAmount != null ? `${formatCurrency(d.verifiedAmount)} Birr` : "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {providerLabel(d.provider)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-gray-800 break-all max-w-[200px] inline-block">
                          {d.transactionId}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(d.status)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{formatDate(d.createdAt)}</div>
                        {d.verifiedAt && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            Verified: {formatDate(d.verifiedAt)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{" "}
                deposits
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
                  Page {pagination.page} of {pagination.totalPages || 1}
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
    </div>
  );
};

export default Deposits;
