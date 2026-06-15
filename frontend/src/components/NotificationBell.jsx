import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import './NotificationBell.css';

export default function NotificationBell({ onClick }) {
  const { unreadCount } = useNotifications();

  return (
    <button 
      className={`notification-bell ${unreadCount > 0 ? 'has-unread' : ''}`} 
      onClick={onClick} 
      title="Notifications"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="bell-svg"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      {unreadCount > 0 && (
        <span className="notification-count">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
