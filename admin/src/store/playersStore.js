import { create } from "zustand";
import axios from "axios";
import { API_URL } from "../constant";

const usePlayersStore = create((set, get) => ({
  // State
  players: [],
  loading: false,
  saving: false,
  error: null,
  success: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {
    search: "",
    isVerified: "",
  },
  selectedPlayer: null,

  // Actions
  fetchPlayers: async (page, limit, filters = {}) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: (page || get().pagination.page).toString(),
        limit: (limit || get().pagination.limit).toString(),
      });

      const currentFilters =
        filters.search !== undefined ? filters : get().filters;
      if (currentFilters.search) params.append("search", currentFilters.search);
      if (
        currentFilters.isVerified !== undefined &&
        currentFilters.isVerified !== ""
      )
        params.append("isVerified", currentFilters.isVerified);

      const response = await axios.get(
        `${API_URL}/api/users?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      set({
        players: response.data.users,
        pagination: response.data.pagination,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching players:", error);
      set({
        error: error.response?.data?.message || "Failed to load players",
        loading: false,
      });
    }
  },

  updatePlayer: async (id, playerData) => {
    set({ saving: true, error: null, success: null });
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${API_URL}/api/users/${id}`,
        playerData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        set({
          saving: false,
          success: response.data.message || "Player updated successfully",
        });
        // Refresh the list with current pagination and filters
        const state = get();
        await get().fetchPlayers(
          state.pagination.page,
          state.pagination.limit,
          state.filters
        );
        // Clear success message after 3 seconds
        setTimeout(() => set({ success: null }), 3000);
        return { success: true, data: response.data.data };
      }
    } catch (error) {
      console.error("Error updating player:", error);
      set({
        error: error.response?.data?.message || "Failed to update player",
        saving: false,
      });
      return { success: false, error: error.response?.data?.message };
    }
  },

  deletePlayer: async (id) => {
    set({ saving: true, error: null, success: null });
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(`${API_URL}/api/users/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        set({
          saving: false,
          success: response.data.message || "Player deleted successfully",
        });
        // Refresh the list with current pagination and filters
        const state = get();
        await get().fetchPlayers(
          state.pagination.page,
          state.pagination.limit,
          state.filters
        );
        // Clear success message after 3 seconds
        setTimeout(() => set({ success: null }), 3000);
        return { success: true };
      }
    } catch (error) {
      console.error("Error deleting player:", error);
      set({
        error: error.response?.data?.message || "Failed to delete player",
        saving: false,
      });
      return { success: false, error: error.response?.data?.message };
    }
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 }, // Reset to first page on filter change
    }));
  },

  setPagination: (pagination) => {
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    }));
  },

  setSelectedPlayer: (player) => {
    set({ selectedPlayer: player });
  },

  clearSelectedPlayer: () => {
    set({ selectedPlayer: null });
  },

  clearError: () => set({ error: null }),
  clearSuccess: () => set({ success: null }),
}));

export default usePlayersStore;
