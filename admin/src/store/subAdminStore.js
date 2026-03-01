import { create } from "zustand";
import axios from "axios";
import { API_URL } from "../constant";

const useSubAdminStore = create((set, get) => ({
  // State
  subAdmins: [],
  loading: false,
  saving: false,
  error: null,
  success: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  },
  filters: {
    search: "",
    isActive: "",
  },

  // Actions
  fetchSubAdmins: async (page, limit, filters = {}) => {
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
        currentFilters.isActive !== undefined &&
        currentFilters.isActive !== ""
      )
        params.append("isActive", currentFilters.isActive);

      const response = await axios.get(
        `${API_URL}/api/sub-admins?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        set({
          subAdmins: response.data.subAdmins,
          pagination: response.data.pagination,
          loading: false,
        });
      }
    } catch (error) {
      console.error("Error fetching sub-admins:", error);
      set({
        error: error.response?.data?.message || "Failed to load sub-admins",
        loading: false,
      });
    }
  },

  createSubAdmin: async (subAdminData) => {
    set({ saving: true, error: null, success: null });
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_URL}/api/sub-admins`,
        subAdminData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        set({
          saving: false,
          success: response.data.message || "Sub-admin created successfully",
        });
        // Refresh the list
        await get().fetchSubAdmins();
        // Clear success message after 3 seconds
        setTimeout(() => set({ success: null }), 3000);
        return { success: true, data: response.data.data };
      } else {
        // Handle case where response doesn't have success: true
        set({
          saving: false,
          error: response.data.message || "Failed to create sub-admin",
        });
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      console.error("Error creating sub-admin:", error);
      set({
        error: error.response?.data?.message || "Failed to create sub-admin",
        saving: false,
      });
      return { success: false, error: error.response?.data?.message };
    }
  },

  updateSubAdmin: async (id, subAdminData) => {
    set({ saving: true, error: null, success: null });
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${API_URL}/api/sub-admins/${id}`,
        subAdminData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        set({
          saving: false,
          success: response.data.message || "Sub-admin updated successfully",
        });
        // Refresh the list
        await get().fetchSubAdmins();
        // Clear success message after 3 seconds
        setTimeout(() => set({ success: null }), 3000);
        return { success: true, data: response.data.data };
      } else {
        // Handle case where response doesn't have success: true
        set({
          saving: false,
          error: response.data.message || "Failed to update sub-admin",
        });
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      console.error("Error updating sub-admin:", error);
      set({
        error: error.response?.data?.message || "Failed to update sub-admin",
        saving: false,
      });
      return { success: false, error: error.response?.data?.message };
    }
  },

  deleteSubAdmin: async (id) => {
    set({ saving: true, error: null, success: null });
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(`${API_URL}/api/sub-admins/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        set({
          saving: false,
          success: response.data.message || "Sub-admin deleted successfully",
        });
        // Refresh the list
        await get().fetchSubAdmins();
        // Clear success message after 3 seconds
        setTimeout(() => set({ success: null }), 3000);
        return { success: true };
      } else {
        // Handle case where response doesn't have success: true
        set({
          saving: false,
          error: response.data.message || "Failed to delete sub-admin",
        });
        return { success: false, error: response.data.message };
      }
    } catch (error) {
      console.error("Error deleting sub-admin:", error);
      set({
        error: error.response?.data?.message || "Failed to delete sub-admin",
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

  clearError: () => set({ error: null }),
  clearSuccess: () => set({ success: null }),
}));

export default useSubAdminStore;
