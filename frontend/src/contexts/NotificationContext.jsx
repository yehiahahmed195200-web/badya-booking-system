import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { API_BASE } from '../config/api';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

// Map of notification types to icons
const getTypeIcon = (type) => {
  const icons = {
    BOOKING: '📅',
    ATTENDANCE: '📍',
    SECURITY: '🔒',
    ACCOUNT: '👤',
    REWARD: '🎁',
    ADMIN: '⚙️',
    SYSTEM: 'ℹ️',
  };
  return icons[type] || 'ℹ️';
};

// Play satisfying double synth chime using Web Audio API
const playChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // Low Note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);
    
    // High Note
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.08); // A5
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.13);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.error('Audio playback failed:', e);
  }
};

export function NotificationProvider({ children, token }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  
  // Track notifications we have already seen to avoid duplicate toasts
  const knownNotificationIds = useRef(new Set());
  const isFirstLoad = useRef(true);

  const getUserIdFromToken = () => {
    if (!token || !token.startsWith("demo-token-")) return null;
    return token.replace("demo-token-", "");
  };

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((title, message, type, priority, id) => {
    const toastId = id || Math.random();
    setToasts((prev) => [
      ...prev.filter(t => t.id !== toastId), // prevent duplicates
      { id: toastId, title, message, type, priority }
    ]);

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      removeToast(toastId);
    }, 6000);
  }, [removeToast]);

  const triggerNewNotification = useCallback((n) => {
    // 1. Play chime sound
    playChime();

    // 2. Add floating toast
    showToast(n.title, n.message, n.type, n.priority, n.id);

    // 3. Trigger native browser push alert if tab is out of focus
    if (document.hidden && window.Notification && window.Notification.permission === 'granted') {
      try {
        new window.Notification(n.title, {
          body: n.message,
          icon: '/badya-logo.png',
          tag: n.id,
        });
      } catch (err) {
        console.error('Failed to trigger browser push:', err);
      }
    }
  }, [showToast]);

  const fetchNotifications = useCallback(async (initial = false) => {
    if (!token) return;
    const userId = getUserIdFromToken();
    if (!userId) return;
    try {
      if (initial) setLoading(true);
      const response = await fetch(`${API_BASE}/api/notifications/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const fetchedList = data || [];

        // Check for new unread notifications (not present in our known IDs)
        if (!initial && !isFirstLoad.current) {
          fetchedList.forEach((n) => {
            if (!n.read && !knownNotificationIds.current.has(n.id)) {
              triggerNewNotification(n);
            }
          });
        }

        // Cache all fetched IDs
        fetchedList.forEach((n) => knownNotificationIds.current.add(n.id));
        setNotifications(fetchedList);
        isFirstLoad.current = false;
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
    } finally {
      if (initial) setLoading(false);
    }
  }, [token, triggerNewNotification]);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    const userId = getUserIdFromToken();
    if (!userId) return;
    try {
      const response = await fetch(`${API_BASE}/api/notifications/user/${userId}/unread`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, [token]);

  const markAsRead = useCallback(
    async (notificationId) => {
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notificationId ? { ...n, read: true, readAt: new Date() } : n))
          );
          await fetchUnreadCount();
        }
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    },
    [token, fetchUnreadCount]
  );

  const markAllAsRead = useCallback(async () => {
    if (!token) return;
    const userId = getUserIdFromToken();
    if (!userId) return;
    try {
      const response = await fetch(`${API_BASE}/api/notifications/user/${userId}/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true, readAt: new Date() })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, [token]);

  const archiveNotification = useCallback(
    async (notificationId) => {
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/archive`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
          await fetchUnreadCount();
        }
      } catch (err) {
        console.error('Failed to archive notification:', err);
      }
    },
    [token, fetchUnreadCount]
  );

  // Request browser push permissions on mount
  useEffect(() => {
    if (window.Notification && window.Notification.permission === 'default') {
      window.Notification.requestPermission();
    }
  }, []);

  // Fetch notifications on mount and set up quick polling (every 8 seconds)
  useEffect(() => {
    if (!token) {
      knownNotificationIds.current.clear();
      isFirstLoad.current = true;
      return;
    }

    // Initial load
    fetchNotifications(true);
    fetchUnreadCount();

    const pollInterval = setInterval(() => {
      // Fetch notifications list directly, which also updates local list and unread count
      fetchNotifications(false);
      fetchUnreadCount();
    }, 8000); // Polling every 8 seconds for real-time vibe

    return () => clearInterval(pollInterval);
  }, [token, fetchNotifications, fetchUnreadCount]);

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    showToast,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Real-time Floating Toasts Container */}
      <div className="notification-toast-container">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`notification-toast ${t.priority?.toLowerCase() || 'normal'}`}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-notifications'));
              removeToast(t.id);
            }}
          >
            <div className="toast-icon-wrapper">
              {getTypeIcon(t.type)}
            </div>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              <div className="toast-message">{t.message}</div>
            </div>
            <button
              className="toast-close"
              onClick={(e) => {
                e.stopPropagation();
                removeToast(t.id);
              }}
            >
              ✕
            </button>
            <div className="toast-progress-bar" />
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
