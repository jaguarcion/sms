import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Hash, Users, MessageSquare, LogOut, Phone, Activity, 
  ShieldCheck, Clock, CheckCircle2, X, Link as LinkIcon, Search, Copy, Download, 
  PlusCircle, Send, PlayCircle, PauseCircle, Settings, Menu
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SettingsPanel from './components/SettingsPanel';
import NumbersTable from './components/NumbersTable';
import UsersTable from './components/UsersTable';
import SmsTable from './components/SmsTable';
import SmsText from './components/SmsText';
import BroadcastModal from './components/BroadcastModal';
import NumberSmsModal from './components/NumberSmsModal';

function App() {
  const [password, setPassword] = useState(() => localStorage.getItem('adminPassword') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [previousSmsIds, setPreviousSmsIds] = useState(new Set());
  
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
    
    // Update document title dynamically
    const tabTitles = {
      dashboard: 'Дашборд',
      numbers: 'Номера',
      users: 'Пользователи',
      sms: 'История SMS',
      settings: 'Настройки'
    };
    document.title = `${tabTitles[activeTab] || 'Панель'} | Fanytel Admin`;
  }, [activeTab]);

  // Data State
  const [stats, setStats] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [users, setUsers] = useState([]);
  const [sms, setSms] = useState([]);

  useEffect(() => {
    if (sms.length > 0) {
      const currentIds = new Set(sms.map(s => s.id));
      if (previousSmsIds.size > 0) {
        const newSms = sms.filter(s => !previousSmsIds.has(s.id));
        newSms.forEach(msg => {
          toast((t) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontWeight: 600 }}>Новое SMS от {msg.sender}</div>
              <div style={{ fontSize: 14 }}><SmsText text={msg.message_text} /></div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button className="action-btn" onClick={() => { setActiveTab('sms'); toast.dismiss(t.id); }}>
                  Открыть историю
                </button>
                <button className="copy-btn" onClick={() => toast.dismiss(t.id)}>
                  Закрыть
                </button>
              </div>
            </div>
          ), { duration: 8000, icon: '📩', style: { minWidth: '300px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' } });
        });
      }
      setPreviousSmsIds(currentIds);
    }
  }, [sms]);

  // Server-Sent Events (SSE) Listener for instant updates
  useEffect(() => {
    if (!password) return;
    
    const eventSource = new EventSource(`http://localhost:3000/api/events?token=${encodeURIComponent(password)}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_sms') {
          setSms(prev => [data.payload, ...prev]);
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };
    
    return () => eventSource.close();
  }, [password]);

  const [fanytelStatus, setFanytelStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [viewSmsNumber, setViewSmsNumber] = useState(null);

  const fetchWithAuth = async (endpoint, options = {}) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { 
        'Authorization': `Bearer ${password}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unauthorized');
    return data;
  };

  // -- Initialization & Auth --
  useEffect(() => {
    const initSession = async () => {
      const savedPassword = localStorage.getItem('adminPassword');
      if (!savedPassword) {
        setIsInitializing(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/stats`, {
          headers: { 'Authorization': `Bearer ${savedPassword}`, 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
          setIsAuthenticated(true);
          setPassword(savedPassword);
        } else {
          localStorage.removeItem('adminPassword');
          setPassword('');
        }
      } catch (err) {
        localStorage.removeItem('adminPassword');
        setPassword('');
      } finally {
        setIsInitializing(false);
      }
    };
    initSession();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const data = await fetchWithAuth('/stats');
      setStats(data);
      setIsAuthenticated(true);
      localStorage.setItem('adminPassword', password);
      setError('');
      toast.success('Успешный вход!');
    } catch (err) {
      setError('Неверный пароль или сервер недоступен');
      localStorage.removeItem('adminPassword');
      toast.error('Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    localStorage.removeItem('adminPassword');
    toast('Вы вышли из системы', { icon: '👋' });
  };

  // -- Data Loading --
  const loadData = async () => {
    try {
      if (activeTab === 'dashboard') {
        const [s, m] = await Promise.all([fetchWithAuth('/stats'), fetchWithAuth('/sms')]);
        setStats(s);
        setSms(m);
      } else if (activeTab === 'numbers') {
        setNumbers(await fetchWithAuth('/numbers'));
      } else if (activeTab === 'users') {
        setUsers(await fetchWithAuth('/users'));
      } else if (activeTab === 'sms') {
        setSms(await fetchWithAuth('/sms'));
      } else if (activeTab === 'settings') {
        setFanytelStatus(await fetchWithAuth('/settings/status'));
      }
    } catch (err) {
      if (err.message === 'Unauthorized') handleLogout();
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    setSearchQuery('');
    setCurrentPage(1);
    
    setLoading(true);
    loadData().finally(() => setLoading(false));
    
    if (autoRefresh) {
      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isAuthenticated, autoRefresh]);

  // -- Utility Functions --
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано!');
  };

  const exportCSV = (data, filename) => {
    if (!data || !data.length) return toast.error('Нет данных для выгрузки');
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(','));
    const csvString = [headers, ...rows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    toast.success(`Файл ${filename} скачан`);
  };

  const getExpirationClass = (dateStr) => {
    if (!dateStr) return '';
    try {
      const days = differenceInDays(parseISO(dateStr), new Date());
      if (days < 0) return 'expire-danger';
      if (days <= 3) return 'expire-warning';
      if (days > 10) return 'expire-good';
      return '';
    } catch(e) { return ''; }
  };

  // -- Actions --
  const handleAssign = async (number) => {
    setModalTitle(`Назначение номера +${number}`);
    setModalContent(
      <div style={{ textAlign: 'center' }}>
        <Activity className="spin" size={32} color="var(--accent-primary)" style={{margin: '20px auto'}}/>
        <p>Загрузка списка пользователей...</p>
      </div>
    );
    setModalOpen(true);

    try {
      const usersList = await fetchWithAuth('/users');
      
      setModalContent(
        (() => {
          const assignNumberToUser = async (targetId) => {
            setModalContent(
              <div style={{ textAlign: 'center' }}>
                <Activity className="spin" size={32} color="var(--accent-primary)" style={{margin: '20px auto'}}/>
                <p>Назначаем номер...</p>
              </div>
            );

            try {
              await fetchWithAuth('/numbers/assign', {
                method: 'POST', body: JSON.stringify({ number, telegram_id: targetId })
              });
              toast.success('Успешно назначено!');
              setModalOpen(false);
              loadData();
            } catch (err) {
              toast.error(`Ошибка: ${err.message}`);
              setModalOpen(false);
            }
          };

          return (
            <div>
              <p style={{marginBottom: '16px', color: 'var(--text-secondary)'}}>Выберите клиента из списка или введите Telegram ID вручную:</p>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const manualId = e.target.telegramIdManual.value;
                if (!manualId) return toast.error('Укажите ID пользователя');
                assignNumberToUser(manualId);
              }}>
                <div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
                  <input name="telegramIdManual" type="text" className="search-input" placeholder="Ввести ID вручную (Например: 123456789)" style={{flex: 1}} />
                  <button type="submit" className="btn">Назначить</button>
                </div>
              </form>

              <p style={{marginBottom: '12px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 600}}>ИЛИ ВЫБЕРИТЕ ИЗ ДОСТУПНЫХ</p>
              
              <div style={{maxHeight: '300px', overflowY: 'auto', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {usersList.map(u => (
                  <div key={u.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)'}}>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                      <div style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'}}>
                        {u.telegram_id} {u.role === 'admin' ? <span className="badge warning">Админ</span> : ''}
                      </div>
                      <div style={{fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px'}}>
                        {u.username ? (
                          <a href={`https://t.me/${u.username}`} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent-primary)', textDecoration: 'none'}}>
                            @{u.username}
                          </a>
                        ) : u.first_name ? (
                          <span>{u.first_name}</span>
                        ) : (
                          <span>Без имени</span>
                        )}
                        <span>•</span>
                        <span>
                          {u.assigned_numbers && u.assigned_numbers.length > 0 ? (
                            <span style={{color: 'var(--accent-success)'}}>✅ У номера ({u.assigned_numbers.length})</span>
                          ) : (
                            <span style={{color: 'var(--accent-warning)'}}>❌ Нет номеров</span>
                          )}
                        </span>
                      </div>
                      {u.notes && <div style={{fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic'}}>{u.notes}</div>}
                    </div>
                    <button className="action-btn success" style={{margin: 0}} onClick={() => assignNumberToUser(u.telegram_id)}>
                      Выбрать
                    </button>
                  </div>
                ))}
                {usersList.length === 0 && <p style={{textAlign: 'center', padding: '12px', color: 'var(--text-secondary)'}}>Нет доступных пользователей</p>}
              </div>
              
              <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '16px'}}>
                <button type="button" className="copy-btn" onClick={() => setModalOpen(false)} style={{padding: '8px 16px'}}>Отмена</button>
              </div>
            </div>
          );
        })()
      );
    } catch (err) {
      setModalContent(<p style={{color: 'var(--accent-danger)'}}>Ошибка загрузки пользователей: {err.message}</p>);
    }
  };

  const handleViewSms = (number) => {
    setViewSmsNumber(number);
  };

  const handleUnassign = async (number) => {
    if (!window.confirm(`Вы уверены, что хотите открепить клиента от номера +${number}?`)) return;
    const toastId = toast.loading('Открепляем...');
    try {
      await fetchWithAuth('/numbers/unassign', {
        method: 'POST', body: JSON.stringify({ number })
      });
      toast.success('Пользователь откреплен!', { id: toastId });
      loadData();
    } catch (err) {
      toast.error(`Ошибка: ${err.message}`, { id: toastId });
    }
  };

  const handleBuyNumberModal = async () => {
    setModalTitle(`Покупка нового номера`);
    setModalContent(
      <div style={{ textAlign: 'center' }}>
        <Activity className="spin" size={32} color="var(--accent-primary)" style={{margin: '20px auto'}}/>
        <p>Ищем свободные номера Fanytel...</p>
      </div>
    );
    setModalOpen(true);
    
    try {
      const available = await fetchWithAuth('/available-numbers');
      setModalContent(
        available.length === 0 ? (
          <p>К сожалению, свободных номеров сейчас нет.</p>
        ) : (
          <div>
            <p style={{marginBottom: 16}}>Доступные номера ($0.99):</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {available.map(n => (
                <div key={n.number} className="glass-panel" style={{padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{fontWeight: 600}}>+{n.number}</span>
                  <button className="action-btn success" style={{margin: 0}} onClick={() => purchaseNumber(n.number)}>Купить</button>
                </div>
              ))}
            </div>
          </div>
        )
      );
    } catch(err) {
      setModalContent(<p style={{color: 'var(--accent-danger)'}}>Ошибка: {err.message}</p>);
    }
  };

  const purchaseNumber = async (number) => {
    const toastId = toast.loading(`Покупаем +${number}...`);
    try {
      await fetchWithAuth('/numbers/purchase', { method: 'POST', body: JSON.stringify({ number }) });
      toast.success(`Номер +${number} успешно куплен!`, { id: toastId });
      setModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(`Ошибка покупки: ${err.message}`, { id: toastId });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const newPwd = e.target.newPassword.value;
    if (!newPwd || newPwd.length < 5) return toast.error('Пароль слишком короткий (минимум 5 символов)');
    
    const toastId = toast.loading('Меняем пароль...');
    try {
      await fetchWithAuth('/settings/password', { method: 'POST', body: JSON.stringify({ newPassword: newPwd }) });
      toast.success('Пароль успешно изменен! Выполните вход снова.', { id: toastId });
      setTimeout(() => handleLogout(), 1500);
    } catch (err) {
      toast.error(`Ошибка: ${err.message}`, { id: toastId });
    }
  };

  // -- Renders --
  if (isInitializing) {
    return (
      <div className="login-screen" style={{ flexDirection: 'column', gap: '20px' }}>
        <Activity size={48} color="var(--accent-primary)" className="spin" />
        <h2 style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Fanytel Admin</h2>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }}/>
        <div className="glass-panel login-card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <ShieldCheck size={48} color="var(--accent-primary)" />
          </div>
          <h1 style={{ marginBottom: 8, fontSize: '2rem' }}>Fanytel Admin</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Введите пароль для доступа к панели</p>
          <form onSubmit={handleLogin}>
            <div className="input-group" style={{ marginBottom: 24 }}>
              <label style={{ marginBottom: 8, display: 'block', fontSize: 14 }}>Пароль доступа</label>
              <input 
                type="password" 
                className="form-input" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль..."
              />
            </div>
            <button type="submit" className="btn" style={{ width: '100%', padding: '12px', fontSize: 16 }} disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Toaster position="top-center" toastOptions={{ style: { background: 'var(--bg-card)', color: '#fff', border: '1px solid var(--border-color)', backdropFilter: 'blur(10px)' } }}/>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalTitle}</h3>
              <button className="close-btn" onClick={() => setModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {modalContent}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        handleBroadcastModal={() => setShowBroadcastModal(true)} 
        handleLogout={handleLogout} 
        theme={theme}
        setTheme={setTheme}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      {/* Main Content */}
      <main className="main-content">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button className="mobile-menu-btn action-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ margin: 0, padding: 8 }}>
              <Menu size={24} />
            </button>
            <div>
              <h2 className="page-title">
                {activeTab === 'dashboard' && 'Обзор системы'}
                {activeTab === 'numbers' && 'Управление номерами'}
                {activeTab === 'users' && 'Пользователи'}
                {activeTab === 'sms' && 'История сообщений'}
                {activeTab === 'settings' && 'Настройки системы'}
              </h2>
              <p className="page-subtitle">В реальном времени</p>
            </div>
          </div>
          <div className="page-actions">
            <button className="action-btn" onClick={() => setAutoRefresh(!autoRefresh)} title="Автообновление каждые 10 сек">
              {autoRefresh ? <PauseCircle size={18} color="var(--accent-warning)"/> : <PlayCircle size={18} color="var(--text-secondary)"/>} 
              {autoRefresh ? 'Пауза' : 'Синхронизация'}
            </button>
          </div>
        </div>

        {loading && (!stats && activeTab === 'dashboard' || !numbers.length && activeTab === 'numbers' || !users.length && activeTab === 'users') ? (
          <div>
            <div className="skeleton skeleton-title"></div>
            <div className="skeleton skeleton-text" style={{height: 120}}></div>
            <div className="skeleton skeleton-text" style={{height: 40}}></div>
            <div className="skeleton skeleton-text" style={{height: 40}}></div>
            <div className="skeleton skeleton-text" style={{height: 40}}></div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard stats={stats} sms={sms} />
            )}

            {activeTab === 'numbers' && (
              <NumbersTable 
                numbers={numbers}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                ITEMS_PER_PAGE={ITEMS_PER_PAGE}
                handleBuyNumberModal={handleBuyNumberModal}
                copyToClipboard={copyToClipboard}
                handleUnassign={handleUnassign}
                handleAssign={handleAssign}
                handleViewSms={handleViewSms}
                getExpirationClass={getExpirationClass}
                refreshData={loadData}
              />
            )}

            {activeTab === 'users' && (
              <UsersTable 
                users={users}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                ITEMS_PER_PAGE={ITEMS_PER_PAGE}
                exportCSV={exportCSV}
                refreshData={loadData}
              />
            )}

            {activeTab === 'sms' && (
              <SmsTable 
                sms={sms}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                ITEMS_PER_PAGE={ITEMS_PER_PAGE}
                exportCSV={exportCSV}
                copyToClipboard={copyToClipboard}
                refreshData={loadData}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPanel 
                fanytelStatus={fanytelStatus} 
                handleChangePassword={handleChangePassword} 
              />
            )}
          </>
        )}
      </main>
      {showBroadcastModal && <BroadcastModal onClose={() => setShowBroadcastModal(false)} />}
      {viewSmsNumber && <NumberSmsModal number={viewSmsNumber} allSms={sms} onClose={() => setViewSmsNumber(null)} />}
    </div>
  );
}

export default App;
