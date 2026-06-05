import React, { useState } from 'react';
import './NotificationCenter.css';
import { useNotifications } from '../contexts/NotificationContext';

export default function NotificationCenter({ isOpen, onClose }) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    fetchNotifications,
  } = useNotifications();
  const [activeFilter, setActiveFilter] = useState('all');

  const filtered =
    activeFilter === 'unread'
      ? notifications.filter((n) => !n.read)
      : activeFilter === 'archive'
      ? notifications.filter((n) => n.status === 'ARCHIVED')
      : notifications;

  const handleMarkRead = (e, notificationId) => {
    e.stopPropagation();
    markAsRead(notificationId);
  };

  const handleArchive = (e, notificationId) => {
    e.stopPropagation();
    archiveNotification(notificationId);
  };

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

  const getPriorityColor = (priority) => {
    const colors = {
      CRITICAL: '#dc2626',
      HIGH: '#ea580c',
      NORMAL: '#2563eb',
      LOW: '#64748b',
    };
    return colors[priority] || '#2563eb';
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <>
      {isOpen && <div className="notification-overlay" onClick={onClose} />}
      <div className={`notification-drawer ${isOpen ? 'open' : ''}`}>
        <div className="notification-header">
          <div>
            <h2>Notifications</h2>
            {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
          </div>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="notification-filters">
          <button
            className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All ({notifications.length})
          </button>
          <button
            className={`filter-btn ${activeFilter === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveFilter('unread')}
          >
            Unread ({unreadCount})
          </button>
          {unreadCount > 0 && (
            <button className="mark-all-read-btn" onClick={markAllAsRead}>
              Mark all read
            </button>
          )}
        </div>

        <div className="notifications-list">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>No {activeFilter === 'unread' ? 'unread ' : ''} notifications</p>
              <small>You're all caught up!</small>
            </div>
          ) : (
            filtered.map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${!notification.read ? 'unread' : ''}`}
                style={{
                  borderLeftColor: getPriorityColor(notification.priority),
                }}
              >
                <div className="notification-type-icon">
                  {getTypeIcon(notification.type)}
                </div>
                <div className="notification-content">
                  <div className="notification-title-row">
                    <h4>{notification.title}</h4>
                    <span className="notification-time">
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="notification-message">{notification.message}</p>
                  {notification.actionUrl && (
                    <a href={notification.actionUrl} className="notification-action">
                      View →
                    </a>
                  )}
                </div>
                <div className="notification-actions">
                  {!notification.read && (
                    <button
                      className="action-btn"
                      title="Mark as read"
                      onClick={(e) => handleMarkRead(e, notification.id)}
                    >
                      ✓
                    </button>
                  )}
                  <button
                    className="action-btn delete"
                    title="Archive"
                    onClick={(e) => handleArchive(e, notification.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
