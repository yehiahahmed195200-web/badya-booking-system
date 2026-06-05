import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import './NotificationBell.css';

export default function NotificationBell({ onClick }) {
  const { unreadCount } = useNotifications();

  return (
    <button className="notification-bell" onClick={onClick} title="Notifications">
      🔔
      {unreadCount > 0 && (
        <span className="notification-count">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
