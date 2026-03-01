import React, { useState, useEffect, useCallback } from "react";
import {
  Megaphone,
  Plus,
  Upload,
  Edit,
  Trash2,
  X,
  Loader2,
  Image as ImageIcon,
  Link as LinkIcon,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { API_URL } from "../constant";

const Ads = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [formData, setFormData] = useState({
    image: null,
    title: "",
    link: "",
    order: 0,
    isActive: true,
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem("bingo_admin_token");
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  // Auto-dismiss notifications
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Fetch all ads
  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ads/`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setAds(data.ads || []);
      } else {
        setError("Failed to fetch ads");
      }
    } catch (err) {
      console.error("Error fetching ads:", err);
      setError("Failed to fetch ads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        setError("Image size should be less than 5MB");
        return;
      }
      setFormData({ ...formData, image: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Open create modal
  const openCreateModal = () => {
    setEditingAd(null);
    setFormData({
      image: null,
      title: "",
      link: "",
      order: ads.length,
      isActive: true,
    });
    setPreviewImage(null);
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = (ad) => {
    setEditingAd(ad);
    setFormData({
      image: null,
      title: ad.title || "",
      link: ad.link || "",
      order: ad.order || 0,
      isActive: ad.isActive !== undefined ? ad.isActive : true,
    });
    setPreviewImage(ad.imageUrl);
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEditingAd(null);
    setFormData({
      image: null,
      title: "",
      link: "",
      order: 0,
      isActive: true,
    });
    setPreviewImage(null);
  };

  // Create ad
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.image && !editingAd) {
      setError("Please select an image");
      return;
    }

    setUploading(true);
    try {
      const formDataToSend = new FormData();
      if (formData.image) {
        formDataToSend.append("image", formData.image);
      }
      formDataToSend.append("title", formData.title);
      formDataToSend.append("link", formData.link);
      formDataToSend.append("order", formData.order.toString());
      formDataToSend.append("isActive", formData.isActive.toString());

      const headers = getAuthHeaders();
      // Don't set Content-Type for FormData, browser will set it with boundary

      const res = await fetch(`${API_URL}/api/ads/`, {
        method: "POST",
        headers,
        body: formDataToSend,
      });

      if (res.ok) {
        setSuccess("Ad created successfully");
        closeModal();
        fetchAds();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to create ad");
      }
    } catch (err) {
      console.error("Error creating ad:", err);
      setError("Failed to create ad");
    } finally {
      setUploading(false);
    }
  };

  // Update ad
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingAd) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/ads/${editingAd._id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          link: formData.link,
          order: parseInt(formData.order),
          isActive: formData.isActive,
        }),
      });

      if (res.ok) {
        setSuccess("Ad updated successfully");
        closeModal();
        fetchAds();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to update ad");
      }
    } catch (err) {
      console.error("Error updating ad:", err);
      setError("Failed to update ad");
    } finally {
      setSaving(false);
    }
  };

  // Delete ad
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this ad?")) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/ads/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        setSuccess("Ad deleted successfully");
        fetchAds();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to delete ad");
      }
    } catch (err) {
      console.error("Error deleting ad:", err);
      setError("Failed to delete ad");
    }
  };

  // Toggle active status
  const toggleActive = async (ad) => {
    try {
      const res = await fetch(`${API_URL}/api/ads/${ad._id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: !ad.isActive,
        }),
      });

      if (res.ok) {
        setSuccess(
          `Ad ${!ad.isActive ? "activated" : "deactivated"} successfully`
        );
        fetchAds();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to update ad");
      }
    } catch (err) {
      console.error("Error toggling ad:", err);
      setError("Failed to update ad");
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ads Management</h2>
          <p className="text-gray-500">Manage advertisements and banners</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Ad
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Ads Grid */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-500">Loading ads...</p>
        </div>
      ) : ads.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No Ads Yet</h3>
          <p className="text-gray-500 mt-2">
            Create your first ad to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ads.map((ad) => (
            <div
              key={ad._id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Image */}
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={ad.imageUrl}
                  alt={ad.title || "Ad"}
                  className="w-full h-full object-cover"
                />
                {!ad.isActive && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <EyeOff className="w-8 h-8 text-white" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      ad.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {ad.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {ad.title || "Untitled Ad"}
                    </h3>
                    {ad.link && (
                      <a
                        href={ad.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
                      >
                        <LinkIcon className="w-3 h-3" />
                        {ad.link.length > 30
                          ? `${ad.link.substring(0, 30)}...`
                          : ad.link}
                      </a>
                    )}
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  Order: {ad.order} • Created: {formatDate(ad.createdAt)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => toggleActive(ad)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      ad.isActive
                        ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    {ad.isActive ? (
                      <>
                        <EyeOff className="w-3 h-3 inline mr-1" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3 inline mr-1" />
                        Activate
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => openEditModal(ad)}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(ad._id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingAd ? "Edit Ad" : "Create New Ad"}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form
                onSubmit={editingAd ? handleUpdate : handleCreate}
                className="space-y-4"
              >
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image {!editingAd && "*"}
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
                    {previewImage ? (
                      <div className="relative">
                        <img
                          src={previewImage}
                          alt="Preview"
                          className="max-h-64 mx-auto rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewImage(null);
                            setFormData({ ...formData, image: null });
                          }}
                          className="mt-2 text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <label className="cursor-pointer">
                          <span className="text-primary hover:text-primary/80">
                            Click to upload
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                        <p className="text-xs text-gray-500 mt-2">
                          PNG, JPG up to 5MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Ad title (optional)"
                  />
                </div>

                {/* Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link URL
                  </label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) =>
                      setFormData({ ...formData, link: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="https://example.com (optional)"
                  />
                </div>

                {/* Order */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        order: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lower numbers appear first
                  </p>
                </div>

                {/* Active Status */}
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Active Status
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, isActive: !formData.isActive })
                    }
                    className="flex items-center gap-2"
                  >
                    {formData.isActive ? (
                      <ToggleRight className="w-10 h-6 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-10 h-6 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-700">
                      {formData.isActive ? "Active" : "Inactive"}
                    </span>
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      uploading || saving || (!formData.image && !editingAd)
                    }
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {(uploading || saving) && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {editingAd ? "Update Ad" : "Create Ad"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ads;
