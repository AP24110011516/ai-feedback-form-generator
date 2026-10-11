import React, { useState } from 'react';
import { Search, Bell, Menu } from 'lucide-react';

export default function Header({ onMenuClick, pageTitle }) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="top-header">
      <div className="header-left">
        <button className="icon-btn" onClick={onMenuClick} style={{ display: 'flex' }}>
          <Menu size={20} />
        </button>
        <h1 className="header-title">{pageTitle || 'Dashboard'}</h1>
      </div>

      <div className="header-right">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search forms, responses..." />
        </div>

        <div style={{ position: 'relative' }}>
          <button
            className="icon-btn"
            title="Notifications"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={18} />
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: '48px',
              right: 0,
              width: '320px',
              background: 'white',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 50,
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>Notifications</span>
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No notifications yet
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="user-profile">
          <div className="avatar">FG</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: '1.2' }}>
              FormGenius AI
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
