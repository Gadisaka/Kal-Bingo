import React, { useState, useEffect } from "react";
import {
  ArrowRightLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  Gift,
  CreditCard,
  Trophy,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";

// Transaction type config (matches frontend WalletModal)
const txTypeConfig = {
  GAME_STAKE: {
    title: "Game Entry",
    icon: CreditCard,
    colorClass: "bg-red-100 text-red-600",
    badgeClass: "bg-red-100 text-red-600",
  },
  GAME_WIN: {
    title: "Game Won",
    icon: Trophy,
    colorClass: "bg-emerald-100 text-emerald-600",
    badgeClass: "bg-emerald-100 text-emerald-600",
  },
  SPIN_BONUS: {
    title: "Spin Bonus",
    icon: Gift,
    colorClass: "bg-purple-100 text-purple-600",
    badgeClass: "bg-purple-100 text-purple-600",
  },
  DEPOSIT: {
    title: "Deposit",
    icon: ArrowDownCircle,
    colorClass: "bg-emerald-100 text-emerald-600",
    badgeClass: "bg-emerald-100 text-emerald-600",
  },
  WITHDRAWAL: {
    title: "Withdrawal",
    icon: ArrowUpCircle,
    colorClass: "bg-gray-100 text-gray-600",
    badgeClass: "bg-gray-100 text-gray-600",
  },
  REFUND: {
    title: "Refund",
    icon: RotateCcw,
    colorClass: "bg-blue-100 text-blue-600",
    badgeClass: "bg-blue-100 text-blue-600",
  },
  ADMIN_ADJUST: {
    title: "Adjustment",
    icon: CreditCard,
    colorClass: "bg-gray-100 text-gray-600",
    badgeClass: "bg-gray-100 text-gray-600",
  },
  BONUS_REDEEM: {
    title: "Bonus Redeemed",
    icon: Gift,
    colorClass: "bg-orange-100 text-orange-600",
    badgeClass: "bg-orange-100 text-orange-600",
  },
  TRANSFER_OUT: {
    title: "Transfer Sent",
    icon: ArrowRightLeft,
    colorClass: "bg-sky-100 text-sky-600",
    badgeClass: "bg-sky-100 text-sky-600",
  },
  TRANSFER_IN: {
    title: "Transfer Received",
    icon: ArrowRightLeft,
    colorClass: "bg-emerald-100 text-emerald-600",
    badgeClass: "bg-emerald-100 text-emerald-600",
  },
};

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

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filterType, setFilterType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTransactions = async (page = 1, type = "") => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (type) {
        params.append("type", type);
      }

      const response = await axios.get(
        `${API_URL}/api/admin/transactions?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setTransactions(response.data.transactions);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError(err.response?.data?.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(1, filterType);
  }, [filterType]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchTransactions(newPage, filterType);
    }
  };

  const filteredTransactions = searchQuery
    ? transactions.filter(
        (tx) =>
          tx.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.user?.phoneNumber?.includes(searchQuery) ||
          tx.id?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transactions;

  const transactionTypes = [
    { value: "", label: "All Types" },
    { value: "DEPOSIT", label: "Deposits" },
    { value: "WITHDRAWAL", label: "Withdrawals" },
    { value: "GAME_STAKE", label: "Game Stakes" },
    { value: "GAME_WIN", label: "Game Wins" },
    { value: "TRANSFER_IN", label: "Transfers In" },
    { value: "TRANSFER_OUT", label: "Transfers Out" },
    { value: "SPIN_BONUS", label: "Spin Bonuses" },
    { value: "REFUND", label: "Refunds" },
    { value: "ADMIN_ADJUST", label: "Admin Adjustments" },
    { value: "BONUS_REDEEM", label: "Bonus Redeemed" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
          <p className="text-gray-500">View all financial records</p>
        </div>
        <button
          onClick={() => fetchTransactions(pagination.page, filterType)}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary appearance-none bg-white cursor-pointer"
            >
              {transactionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading && transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Loading transactions...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-12">
            <ArrowRightLeft className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No transactions found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance After
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTransactions.map((tx) => {
                    const config =
                      txTypeConfig[tx.type] || txTypeConfig.ADMIN_ADJUST;
                    const IconComponent = config.icon;
                    const isPositive = tx.amount > 0;

                    return (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.colorClass}`}
                            >
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {config.title}
                              </p>
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badgeClass}`}
                              >
                                {tx.type}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {tx.user ? (
                            <div>
                              <p className="font-medium text-gray-900">
                                {tx.user.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {tx.user.phoneNumber}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400">Unknown</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`font-bold text-lg ${
                              isPositive ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {formatCurrency(tx.amount)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-600">
                            {tx.balanceAfter !== undefined
                              ? formatCurrency(tx.balanceAfter)
                              : "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            {tx.type === "DEPOSIT" && tx.meta?.transactionId && (
                              <p className="text-sm text-gray-600 truncate">
                                TX ID: {tx.meta.transactionId}
                              </p>
                            )}
                            {tx.type === "TRANSFER_OUT" && (
                              <p className="text-sm text-gray-600 truncate">
                                To: {tx.meta?.toName || tx.meta?.toPhoneNumber}
                              </p>
                            )}
                            {tx.type === "TRANSFER_IN" && (
                              <p className="text-sm text-gray-600 truncate">
                                From:{" "}
                                {tx.meta?.fromName || tx.meta?.fromPhoneNumber}
                              </p>
                            )}
                            {tx.type === "GAME_STAKE" && tx.meta?.gameId && (
                              <p className="text-sm text-gray-600 truncate">
                                Game: {tx.meta.gameId}
                              </p>
                            )}
                            {tx.type === "GAME_WIN" && tx.meta?.gameId && (
                              <p className="text-sm text-gray-600 truncate">
                                Game: {tx.meta.gameId}
                              </p>
                            )}
                            {tx.meta?.note && (
                              <p className="text-sm text-gray-500 italic truncate">
                                {tx.meta.note}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(tx.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} transactions
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
    </div>
  );
};

export default Transactions;
