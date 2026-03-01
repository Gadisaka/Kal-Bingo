import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell,
  Send,
  Image as ImageIcon,
  X,
  Loader2,
  Users,
  UserCheck,
  Search,
  CheckCircle2,
  XCircle,
  Smile,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
  CornerDownLeft,
} from "lucide-react";
import { API_URL } from "../constant";

// Popular emojis for quick selection
const EMOJI_CATEGORIES = {
  "Smileys & People": [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "🤣",
    "😂",
    "🙂",
    "🙃",
    "😉",
    "😊",
    "😇",
    "🥰",
    "😍",
    "🤩",
    "😘",
    "😗",
    "😚",
    "😙",
    "😋",
    "😛",
    "😜",
    "🤪",
    "😝",
    "🤑",
    "🤗",
    "🤭",
    "🤫",
    "🤯",
    "🤠",
    "🤔",
    "🤕",
    "🤒",
    "🤓",
    "🤖",
    "🤗",
  ],
  Gestures: [
    "👋",
    "🤚",
    "🖐",
    "✋",
    "🖖",
    "👌",
    "🤏",
    "✌️",
    "🤞",
    "🤟",
    "🤘",
    "🤙",
    "👈",
    "👉",
    "👆",
    "🖕",
    "👇",
    "☝️",
    "👍",
    "👎",
    "✊",
    "👊",
    "🤛",
    "🤜",
    "👏",
    "🙌",
    "👐",
    "🤲",
    "🤝",
    "🙏",
  ],
  Objects: [
    "⌚",
    "📱",
    "📲",
    "💻",
    "⌨️",
    "🖥",
    "🖨",
    "🖱",
    "🖲",
    "🕹",
    "🗜",
    "💾",
    "💿",
    "📀",
    "📼",
    "📷",
    "📸",
    "📹",
    "🎥",
    "📽",
    "🎞",
    "📞",
    "☎️",
    "📟",
    "📠",
    "📺",
    "📻",
    "🎙",
    "🎚",
    "🎛",
    "🔥",
    "🥇",
    "🔧",
    "🎯",
    "🇪🇹",
  ],
  Symbols: [
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🖤",
    "🤍",
    "🤎",
    "💔",
    "❣️",
    "💕",
    "💞",
    "💓",
    "💗",
    "💖",
    "💘",
    "💝",
    "💟",
    "☮️",
    "✝️",
    "☪️",
    "🕉",
    "☸️",
    "✡️",
    "🔯",
    "🕎",
    "☯️",
    "☦️",
    "🛐",
  ],
  Activities: [
    "⚽",
    "🏀",
    "🏈",
    "⚾",
    "🎾",
    "🏐",
    "🏉",
    "🎱",
    "🏓",
    "🏸",
    "🥅",
    "🏒",
    "🏑",
    "🏏",
    "⛳",
    "🏹",
    "🎣",
    "🥊",
    "🥋",
    "🎽",
    "🛹",
    "🛷",
    "⛸",
    "🥌",
    "🎿",
    "⛷",
    "🏂",
    "🏋️",
    "🤼",
    "🤸",
    "🤺",
    "🤼‍♂️",
    "🤼‍♀️",
    "🤼‍♂️",
  ],
};

const Notifications = () => {
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [includeMiniAppButton, setIncludeMiniAppButton] = useState(false);
  const [miniAppButtonText, setMiniAppButtonText] = useState("Open Mini App");
  const [recipientType, setRecipientType] = useState("all");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeTab, setActiveTab] = useState("compose");
  const emojiPickerRef = useRef(null);
  const userSelectorRef = useRef(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("bingo_admin_token");
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-dismiss notifications
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Fetch users for selection
  const fetchUsers = useCallback(async (search = "") => {
    setLoadingUsers(true);
    try {
      const res = await fetch(
        `${API_URL}/api/notifications/users/list?search=${encodeURIComponent(
          search
        )}&limit=100`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch notification history
  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications?limit=20`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchNotifications();
    }
    if (recipientType === "selected") {
      fetchUsers();
    }
  }, [activeTab, recipientType, fetchNotifications, fetchUsers]);

  // Handle image file selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Image size should be less than 10MB");
        return;
      }
      setImageFile(file);
      setImageUrl("");
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove image
  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl("");
  };

  // Add emoji to message
  const insertEmoji = (emoji) => {
    const textarea = document.getElementById("message-input");
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = message;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setMessage(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setMessage(message + emoji);
    }
  };

  // Apply formatting to selected text
  const applyFormatting = (tag, placeholder = "") => {
    const textarea = document.getElementById("message-input");
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    const text = message;

    let newText;
    let newCursorPos;

    if (tag === "link") {
      const url = prompt("Enter URL:", "https://");
      if (!url) return;
      const linkText = selectedText || placeholder || "link";
      newText =
        text.substring(0, start) +
        `<a href="${url}">${linkText}</a>` +
        text.substring(end);
      newCursorPos = start + `<a href="${url}">${linkText}</a>`.length;
    } else {
      const openTag = `<${tag}>`;
      const closeTag = `</${tag}>`;
      const formattedText = selectedText || placeholder;

      newText =
        text.substring(0, start) +
        openTag +
        formattedText +
        closeTag +
        text.substring(end);
      newCursorPos =
        start + openTag.length + formattedText.length + closeTag.length;
    }

    setMessage(newText);
    setTimeout(() => {
      textarea.focus();
      if (tag === "link") {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      } else {
        const newStart = start + `<${tag}>`.length;
        const newEnd = newStart + (selectedText || placeholder).length;
        textarea.setSelectionRange(newStart, newEnd);
      }
    }, 0);
  };

  // Insert new line (line break)
  const insertNewLine = () => {
    const textarea = document.getElementById("message-input");
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = message;

    // Insert <br> tag for HTML line break
    const newText = text.substring(0, start) + "<br>" + text.substring(end);

    setMessage(newText);
    setTimeout(() => {
      textarea.focus();
      // Position cursor after the <br> tag
      textarea.setSelectionRange(start + 4, start + 4);
    }, 0);
  };

  // Toggle user selection
  const toggleUserSelection = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  // Select all users
  const selectAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map((u) => u._id));
    }
  };

  // Send notification
  const handleSend = async () => {
    if (!message.trim()) {
      setError("Message is required");
      return;
    }

    if (recipientType === "selected" && selectedUsers.length === 0) {
      setError("Please select at least one user");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("message", message);
      if (imageFile) {
        formData.append("image", imageFile);
      } else if (imageUrl) {
        formData.append("imageUrl", imageUrl);
      }
      formData.append("recipientType", recipientType);
      if (recipientType === "selected") {
        formData.append("recipientIds", JSON.stringify(selectedUsers));
      }
      if (includeMiniAppButton && miniAppButtonText.trim()) {
        formData.append("includeMiniAppButton", "true");
        formData.append("miniAppButtonText", miniAppButtonText.trim());
      }

      const headers = getAuthHeaders();
      const res = await fetch(`${API_URL}/api/notifications/send`, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(
          `Notification sent successfully! Sent: ${data.notification.sentCount}, Failed: ${data.notification.failedCount}`
        );
        // Reset form
        setMessage("");
        setImageFile(null);
        setImagePreview(null);
        setImageUrl("");
        setIncludeMiniAppButton(false);
        setMiniAppButtonText("Open Mini App");
        setSelectedUsers([]);
        setRecipientType("all");
        // Refresh history
        if (activeTab === "history") {
          fetchNotifications();
        }
      } else {
        setError(data.message || "Failed to send notification");
      }
    } catch (err) {
      console.error("Error sending notification:", err);
      setError("Failed to send notification");
    } finally {
      setSending(false);
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
          <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
          <p className="text-gray-500">
            Send and manage notifications via Telegram bot
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("compose")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "compose"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Compose
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            History
          </button>
        </nav>
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

      {/* Compose Tab */}
      {activeTab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Message Input */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Message *
                </label>
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 w-80 max-h-96 overflow-y-auto">
                      {Object.entries(EMOJI_CATEGORIES).map(
                        ([category, emojis]) => (
                          <div key={category} className="mb-4">
                            <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                              {category}
                            </h4>
                            <div className="grid grid-cols-8 gap-1">
                              {emojis.map((emoji, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    insertEmoji(emoji);
                                    setShowEmojiPicker(false);
                                  }}
                                  className="p-2 text-xl hover:bg-gray-100 rounded-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Formatting Toolbar */}
              <div className="flex items-center gap-1 p-2 border border-gray-300 rounded-t-lg bg-gray-50">
                <button
                  type="button"
                  onClick={() => applyFormatting("b", "bold text")}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                  title="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("i", "italic text")}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                  title="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("u", "underlined text")}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                  title="Underline"
                >
                  <Underline className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("s", "strikethrough text")}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                  title="Strikethrough"
                >
                  <Strikethrough className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("code", "code")}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                  title="Code"
                >
                  <Code className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => applyFormatting("link", "link text")}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                  title="Link"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                  type="button"
                  onClick={insertNewLine}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                  title="New Line"
                >
                  <CornerDownLeft className="w-4 h-4" />
                </button>
                <div className="flex-1" />
                <div className="text-xs text-gray-500 px-2">
                  Select text and click a button to format
                </div>
              </div>

              <textarea
                id="message-input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here... Select text and use the formatting buttons above to style it."
                className="w-full px-4 py-3 border-l border-r border-b border-gray-300 rounded-b-lg focus:ring-2 focus:ring-primary focus:border-transparent min-h-[150px] resize-y"
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-2">
                {message.length} characters • Use formatting buttons to style
                your text
              </p>
            </div>

            {/* Image Upload */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Image (Optional)
              </label>
              {imagePreview || imageUrl ? (
                <div className="relative">
                  <img
                    src={imagePreview || imageUrl}
                    alt="Preview"
                    className="w-full max-h-64 object-contain rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <label className="cursor-pointer">
                    <span className="text-primary hover:text-primary/80">
                      Click to upload image
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    PNG, JPG up to 10MB
                  </p>
                  <div className="mt-4">
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Or paste image URL"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Mini App Button */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Mini App Button (Optional)
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMiniAppButton}
                    onChange={(e) => setIncludeMiniAppButton(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Include Button</span>
                </label>
              </div>
              {includeMiniAppButton && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={miniAppButtonText}
                    onChange={(e) => setMiniAppButtonText(e.target.value)}
                    placeholder="Button text (e.g., 'Open Mini App', 'Play Now', etc.)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500">
                    This button will open the Telegram Mini App when clicked
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Recipients & Preview */}
          <div className="space-y-6">
            {/* Recipients */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Recipients
              </label>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="all"
                    checked={recipientType === "all"}
                    onChange={(e) => setRecipientType(e.target.value)}
                    className="mr-2"
                  />
                  <Users className="w-4 h-4 mr-2" />
                  Send to All Users
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="selected"
                    checked={recipientType === "selected"}
                    onChange={(e) => {
                      setRecipientType(e.target.value);
                      if (e.target.value === "selected") {
                        fetchUsers();
                      }
                    }}
                    className="mr-2"
                  />
                  <UserCheck className="w-4 h-4 mr-2" />
                  Select Users
                </label>
              </div>

              {recipientType === "selected" && (
                <div className="mt-4 space-y-3" ref={userSelectorRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        fetchUsers(e.target.value);
                      }}
                      placeholder="Search users..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    {loadingUsers ? (
                      <div className="p-4 text-center text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading users...
                      </div>
                    ) : users.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No users found
                      </div>
                    ) : (
                      <>
                        <div className="p-2 border-b border-gray-200">
                          <button
                            type="button"
                            onClick={selectAllUsers}
                            className="text-xs text-primary hover:underline"
                          >
                            {selectedUsers.length === users.length
                              ? "Deselect All"
                              : "Select All"}
                          </button>
                        </div>
                        {users.map((user) => (
                          <label
                            key={user._id}
                            className="flex items-center p-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(user._id)}
                              onChange={() => toggleUserSelection(user._id)}
                              className="mr-2"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {user.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {user.phoneNumber}
                              </div>
                            </div>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                  {selectedUsers.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      {selectedUsers.length} user(s) selected
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                Preview
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                {imagePreview || imageUrl ? (
                  <div className="mb-3">
                    <img
                      src={imagePreview || imageUrl}
                      alt="Preview"
                      className="w-full rounded-lg"
                    />
                  </div>
                ) : null}
                {message ? (
                  <div
                    className="text-sm text-gray-800 mb-3"
                    dangerouslySetInnerHTML={{ __html: message }}
                  />
                ) : (
                  <p className="text-sm text-gray-400 italic">No message</p>
                )}
                {includeMiniAppButton && miniAppButtonText.trim() && (
                  <div className="mt-3">
                    <button
                      className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
                      disabled
                    >
                      {miniAppButtonText.trim() || "Open Mini App"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={
                sending ||
                !message.trim() ||
                (recipientType === "selected" && selectedUsers.length === 0)
              }
              className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Notification
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="bg-white rounded-xl shadow-sm">
          {loadingNotifications ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-gray-500">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                No Notifications
              </h3>
              <p className="text-gray-500 mt-2">
                No notifications have been sent yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <div key={notification._id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            notification.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : notification.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : notification.status === "sending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {notification.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                      {notification.imageUrl && (
                        <img
                          src={notification.imageUrl}
                          alt="Notification"
                          className="w-full max-w-md rounded-lg mb-3"
                        />
                      )}
                      <div
                        className="text-gray-800 mb-3"
                        dangerouslySetInnerHTML={{
                          __html: notification.message,
                        }}
                      />
                      {notification.buttons &&
                        notification.buttons.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {notification.buttons.map((btn, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm"
                              >
                                {btn.text}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Sent: {notification.sentCount}
                    </span>
                    {notification.failedCount > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-4 h-4" />
                        Failed: {notification.failedCount}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {notification.recipientType === "all"
                        ? "All Users"
                        : `${notification.recipients?.length || 0} Selected`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
