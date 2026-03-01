import { create } from "zustand";
import axios from "axios";
import { API_URL } from "../constant";

const useRevenueStore = create((set, get) => ({
  revenues: [],
  loading: false,
  error: null,
  summary: { totalAmount: 0, byReason: {} },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {
    reason: "",
    startDate: "",
    endDate: "",
    search: "",
  },

  fetchRevenues: async (page, limit, filters = {}) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: (page || get().pagination.page).toString(),
        limit: (limit || get().pagination.limit).toString(),
      });

      const currentFilters =
        filters.reason !== undefined ? filters : get().filters;
      if (currentFilters.reason) params.append("reason", currentFilters.reason);
      if (currentFilters.startDate) params.append("startDate", currentFilters.startDate);
      if (currentFilters.endDate) params.append("endDate", currentFilters.endDate);
      if (currentFilters.search) params.append("search", currentFilters.search);

      const response = await axios.get(
        `${API_URL}/api/revenues?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        set({
          revenues: response.data.revenues || [],
          pagination: response.data.pagination,
          summary: response.data.summary || { totalAmount: 0, byReason: {} },
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch (error) {
      console.error("Error fetching revenues:", error);
      set({
        error: error.response?.data?.message || "Failed to load revenues",
        loading: false,
      });
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 },
    }));
  },

  setPagination: (pagination) => {
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    }));
  },

  clearError: () => set({ error: null }),
}));

export default useRevenueStore;


