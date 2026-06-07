import { LayoutDashboard, Hash, Users, MessageSquare, Settings, Send, LogOut, Activity, Moon, Sun } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, handleBroadcastModal, handleLogout, theme, setTheme, isSidebarOpen, setIsSidebarOpen }) {
  const switchTab = (tab) => {
    setActiveTab(tab);
    if (window.innerWidth <= 768) setIsSidebarOpen(false);
  };

  return (
    <aside className={`sidebar glass-panel ${!isSidebarOpen ? 'mobile-hidden' : ''}`} style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none' }}>
      <div className="brand">
        <Activity className="brand-icon" />
        Fanytel
      </div>
      <nav className="nav-links">
        <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => switchTab('dashboard')}>
          <LayoutDashboard size={20} /> Дашборд
        </div>
        <div className={`nav-item ${activeTab === 'numbers' ? 'active' : ''}`} onClick={() => switchTab('numbers')}>
          <Hash size={20} /> Номера
        </div>
        <div className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => switchTab('users')}>
          <Users size={20} /> Пользователи
        </div>
        <div className={`nav-item ${activeTab === 'sms' ? 'active' : ''}`} onClick={() => switchTab('sms')}>
          <MessageSquare size={20} /> История SMS
        </div>
        <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => switchTab('settings')}>
          <Settings size={20} /> Настройки
        </div>
      </nav>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="nav-item" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />} 
          {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        </div>
        <div className="nav-item" onClick={handleBroadcastModal}>
          <Send size={20} /> Рассылка
        </div>
        <div className="nav-item" onClick={handleLogout}>
          <LogOut size={20} /> Выйти
        </div>
      </div>
    </aside>
  );
}
