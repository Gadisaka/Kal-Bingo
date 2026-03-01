import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import { API_URL } from "../constant";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(
    localStorage.getItem("bingo_admin_token")
  );

  const logout = useCallback(() => {
    console.log("Logging out admin user");
    setToken(null);
    setUser(null);
    localStorage.removeItem("bingo_admin_token");
  }, []);

  // Set up axios interceptor for authentication
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => axios.interceptors.request.eject(interceptor);
  }, [token]);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_URL}/api/auth/profile`);
          const userData = response.data.user;

          // Verify admin role
          if (userData.role !== "admin" && userData.role !== "subadmin") {
            console.error("User is not an admin");
            logout();
            return;
          }

          setUser(userData);
        } catch (error) {
          console.error(
            "Auth check failed:",
            error.response?.data || error.message
          );
          if (error.response?.status === 401) {
            logout();
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token, logout]);

  // Admin login - uses the new admin-only endpoint
  const login = async (phoneNumber, pin) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/admin-login`, {
        phoneNumber,
        pin,
      });

      const { token: newToken, user: userData } = response.data;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem("bingo_admin_token", newToken);

      return { success: true };
    } catch (error) {
      console.error("Admin login error:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Login failed";
      throw new Error(errorMessage);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
