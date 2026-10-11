import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import CreateForm from './pages/CreateForm';
import Analytics from './pages/Analytics';
import VoiceFeedback from './pages/VoiceFeedback';
import ActionCenter from './pages/ActionCenter';
import PublicForm from './pages/PublicForm';
import './index.css';

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard Overview';
      case '/create': return 'AI Form Generator';
      case '/analytics': return 'Feedback Analytics';
      case '/voice': return 'Voice Feedback Recorder';
      case '/insights': return 'Action Center & Insights';
      default: return 'FormGenius AI';
    }
  };

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="main-content">
        <Header 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
          pageTitle={getPageTitle()}
        />

        <main style={{ flex: 1, paddingBottom: '3rem' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateForm />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/voice" element={<VoiceFeedback />} />
            <Route path="/insights" element={<ActionCenter />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/form/:formId" element={<PublicForm />} />
        <Route path="/*" element={<MainLayout />} />
      </Routes>
    </Router>
  );
}
