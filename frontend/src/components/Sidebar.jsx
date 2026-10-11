import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Sparkles, 
  BarChart3, 
  Mic, 
  Lightbulb, 
  Crown,
  Layers,
  X
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/create', label: 'AI Form Generator', icon: Sparkles },
    { path: '/analytics', label: 'Feedback Analytics', icon: BarChart3 },
    { path: '/voice', label: 'Voice Feedback', icon: Mic },
    { path: '/insights', label: 'Action Center', icon: Lightbulb },
  ];

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Layers size={22} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="brand-name">FormGenius</span>
            <span className="brand-badge">AI</span>
          </div>
          {isOpen && (
            <button 
              onClick={onClose} 
              style={{ marginLeft: 'auto', background: 'transparent', color: '#94a3b8' }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="pro-banner">
            <div className="pro-banner-title">
              <Crown size={16} color="#8b5cf6" />
              <span>Gemma AI Pro</span>
            </div>
            <p className="pro-banner-text">Unlimited AI questions & Voice sentiment analysis unlocked.</p>
            <button className="pro-btn">Active Workspace</button>
          </div>
        </div>
      </aside>
    </>
  );
}
