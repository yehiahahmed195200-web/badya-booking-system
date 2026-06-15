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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchNotifications(false);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const filtered =
    activeFilter === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications;

  const handleMarkRead = (e, notificationId) => {
    e.stopPropagation();
    markAsRead(notificationId);
  };

  const handleArchive = (e, notificationId) => {
    e.stopPropagation();
    archiveNotification(notificationId);
  };

  // Modern crisp inline SVGs for notification types
  const getTypeIcon = (type) => {
    switch (type) {
      case 'BOOKING_CONFIRMED':
      case 'BOOKING':
        return (
          <svg className="type-svg confirmed" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="M12 14l2 2 4-4" />
          </svg>
        );
      case 'BOOKING_CANCELLED':
        return (
          <svg className="type-svg cancelled" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case 'BOOKING_REMINDER':
        return (
          <svg className="type-svg reminder" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case 'POINTS_EARNED':
      case 'REWARD':
        return (
          <svg className="type-svg reward" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="7" />
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
          </svg>
        );
      case 'SYSTEM_ALERT':
      case 'SECURITY':
        return (
          <svg className="type-svg alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      default:
        return (
          <svg className="type-svg info" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  const getPriorityInfo = (n) => {
    let priority = n.priority;
    if (!priority) {
      const t = n.type || '';
      if (t.includes('ALERT') || t.includes('SECURITY') || t.includes('CANCELLED')) {
        priority = 'HIGH';
      } else if (t.includes('CONFIRMED') || t.includes('REMINDER') || t.includes('POINTS')) {
        priority = 'NORMAL';
      } else {
        priority = 'LOW';
      }
    }

    const priorityMap = {
      CRITICAL: { color: '#ef4444', text: 'Critical', bg: 'rgba(239, 68, 68, 0.08)' },
      HIGH: { color: '#f97316', text: 'High', bg: 'rgba(249, 115, 22, 0.08)' },
      NORMAL: { color: '#1cb2bf', text: 'Normal', bg: 'rgba(28, 178, 191, 0.08)' },
      LOW: { color: '#64748b', text: 'Info', bg: 'rgba(100, 116, 139, 0.08)' },
    };
    return priorityMap[priority] || priorityMap.NORMAL;
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
          <div className="header-title-section">
            <h2>Notifications</h2>
            {unreadCount > 0 && <span className="unread-counter-badge">{unreadCount} unread</span>}
          </div>
          <div className="header-actions">
            <button 
              className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`} 
              onClick={handleRefresh} 
              title="Refresh notifications"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
            <button className="close-drawer-btn" onClick={onClose} title="Close Panel">
              ✕
            </button>
          </div>
        </div>

        <div className="notification-filters">
          <div className="filter-pills">
            <button
              className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All <span className="pill-count">{notifications.length}</span>
            </button>
            <button
              className={`filter-pill ${activeFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveFilter('unread')}
            >
              Unread <span className="pill-count">{unreadCount}</span>
            </button>
          </div>
          {unreadCount > 0 && (
            <button className="mark-read-all-action" onClick={markAllAsRead}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="check-all-svg">
                <polyline points="20 6 9 17 4 12" />
                <polyline points="22 10 12 20 9 17" />
              </svg>
              Mark all read
            </button>
          )}
        </div>

        <div className="notifications-list">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-visual">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="empty-bell-svg">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  <circle cx="12" cy="8" r="1" />
                </svg>
                <div className="empty-ring-glow" />
              </div>
              <h3>You're all caught up!</h3>
              <p>No {activeFilter === 'unread' ? 'unread ' : ''}notifications at the moment.</p>
            </div>
          ) : (
            filtered.map((n) => {
              const pInfo = getPriorityInfo(n);
              return (
                <div
                  key={n.id}
                  className={`notification-card ${!n.read ? 'unread' : ''}`}
                  style={{ '--priority-color': pInfo.color }}
                  onClick={(e) => {
                    if (!n.read) markAsRead(n.id);
                  }}
                >
                  <div className="card-indicator" />
                  <div className="card-icon-container">
                    {getTypeIcon(n.type)}
                  </div>
                  <div className="card-details">
                    <div className="card-meta">
                      <span className="priority-tag" style={{ color: pInfo.color, backgroundColor: pInfo.bg }}>
                        <span className="priority-dot" style={{ backgroundColor: pInfo.color }} />
                        {pInfo.text}
                      </span>
                      <span className="time-stamp">
                        <svg className="clock-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {formatTime(n.createdAt)}
                      </span>
                    </div>
                    <h4 className="card-title">{n.title}</h4>
                    <p className="card-desc">{n.message}</p>
                    {n.actionUrl && (
                      <a href={n.actionUrl} className="card-action-btn" onClick={(e) => e.stopPropagation()}>
                        View details
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="arrow-svg">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </a>
                    )}
                  </div>
                  <div className="card-operations">
                    {!n.read && (
                      <button
                        className="operation-btn mark-read"
                        title="Mark as read"
                        onClick={(e) => handleMarkRead(e, n.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    )}
                    <button
                      className="operation-btn delete-archive"
                      title="Archive"
                      onClick={(e) => handleArchive(e, n.id)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
