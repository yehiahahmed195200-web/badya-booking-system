import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API_BASE } from '../config/api';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export function NotificationProvider({ children, token }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getUserIdFromToken = () => {
    if (!token || !token.startsWith("demo-token-")) return null;
    return token.replace("demo-token-", "");
  };

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    const userId = getUserIdFromToken();
    if (!userId) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/notifications/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [token]);

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

  // Fetch notifications on mount and set up polling
  useEffect(() => {
    if (!token) return;

    fetchNotifications();
    fetchUnreadCount();

    const pollInterval = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // Poll unread count every 30 seconds

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
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
