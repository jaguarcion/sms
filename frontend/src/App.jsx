import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Hash, Users, MessageSquare, LogOut, Phone, Activity, 
  ShieldCheck, Clock, CheckCircle2, X, Link as LinkIcon, Search, Copy, Download, 
  PlusCircle, Send, PlayCircle, PauseCircle, Settings
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [password, setPassword] = useState(() => localStorage.getItem('adminPassword') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Data State
  const [stats, setStats] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [users, setUsers] = useState([]);
  const [sms, setSms] = useState([]);
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
        setSms(m); // Full for charts, we'll slice for table
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
    const targetId = prompt(`Введите Telegram ID клиента для назначения номера +${number}:`);
    if (!targetId) return;
    
    const toastId = toast.loading('Назначаем номер...');
    try {
      await fetchWithAuth('/numbers/assign', {
        method: 'POST', body: JSON.stringify({ number, telegram_id: targetId })
      });
      toast.success('Успешно назначено!', { id: toastId });
      loadData();
    } catch (err) {
      toast.error(`Ошибка: ${err.message}`, { id: toastId });
    }
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

  const handleBroadcastModal = () => {
    let msgText = '';
    setModalTitle(`Рассылка уведомлений`);
    setModalContent(
      <div>
        <p style={{marginBottom: 16, color: 'var(--text-secondary)'}}>Это сообщение будет отправлено всем зарегистрированным пользователям.</p>
        <textarea 
          className="form-input" 
          rows="5" 
          placeholder="Текст рассылки..." 
          onChange={(e) => msgText = e.target.value}
        ></textarea>
        <div style={{marginTop: 16, textAlign: 'right'}}>
          <button className="btn" onClick={() => sendBroadcast(msgText)}>Отправить всем</button>
        </div>
      </div>
    );
    setModalOpen(true);
  };

  const sendBroadcast = async (message) => {
    if (!message) return toast.error('Текст не может быть пустым');
    const toastId = toast.loading('Выполняем рассылку...');
    setModalOpen(false);
    try {
      const res = await fetchWithAuth('/broadcast', { method: 'POST', body: JSON.stringify({ message }) });
      toast.success(`Отправлено ${res.count} пользователям!`, { id: toastId });
    } catch (err) {
      toast.error(`Ошибка рассылки: ${err.message}`, { id: toastId });
    }
  };

  const handleViewSms = async (number) => {
    setModalTitle(`SMS История: +${number}`);
    setModalContent(<div className="loading-spinner"><Activity className="spin" /></div>);
    setModalOpen(true);
    
    try {
      const msgs = await fetchWithAuth(`/sms/${number}`);
      setModalContent(
        msgs.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Сообщений пока нет</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Отправитель</th>
                  <th>Текст</th>
                </tr>
              </thead>
              <tbody>
                {msgs.map(m => (
                  <tr key={m.id}>
                    <td>{format(new Date(m.received_at), 'dd.MM HH:mm:ss')}</td>
                    <td><span className="badge warning">{m.sender}</span></td>
                    <td>{m.message_text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      );
    } catch (err) {
      setModalContent(<p style={{ color: 'var(--accent-danger)' }}>Ошибка загрузки: {err.message}</p>);
    }
  };

  // -- Pagination & Filtering logic --
  const filterData = (data, keys) => {
    if (!searchQuery) return data;
    const lowerQ = searchQuery.toLowerCase();
    return data.filter(item => keys.some(key => String(item[key]).toLowerCase().includes(lowerQ)));
  };

  const paginate = (data) => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return data.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  const renderPagination = (totalItems) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;
    return (
      <div className="pagination">
        <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Назад</button>
        <span style={{color: 'var(--text-secondary)'}}>Страница {currentPage} из {totalPages}</span>
        <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Вперед</button>
      </div>
    );
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

  // -- Chart Data Generator --
  const generateChartData = () => {
    if (!sms || sms.length === 0) return [];
    // Group SMS by day for the chart
    const groups = {};
    sms.forEach(m => {
      const day = format(new Date(m.received_at), 'MMM dd');
      groups[day] = (groups[day] || 0) + 1;
    });
    return Object.keys(groups).reverse().map(date => ({ date, count: groups[date] })).slice(-7);
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
          <h1>Fanytel Admin</h1>
          <p>Введите пароль для доступа к панели</p>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Пароль доступа</label>
              <input 
                type="password" 
                className="form-input" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="admin123"
              />
            </div>
            <button type="submit" className="btn" style={{width: '100%'}} disabled={loading}>
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
      <aside className="sidebar glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none' }}>
        <div className="brand">
          <Activity className="brand-icon" />
          Fanytel
        </div>
        <nav className="nav-links">
          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard size={20} /> Дашборд
          </div>
          <div className={`nav-item ${activeTab === 'numbers' ? 'active' : ''}`} onClick={() => setActiveTab('numbers')}>
            <Hash size={20} /> Номера
          </div>
          <div className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
            <Users size={20} /> Пользователи
          </div>
          <div className={`nav-item ${activeTab === 'sms' ? 'active' : ''}`} onClick={() => setActiveTab('sms')}>
            <MessageSquare size={20} /> История SMS
          </div>
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings size={20} /> Настройки
          </div>
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="nav-item" onClick={handleBroadcastModal}>
            <Send size={20} /> Рассылка
          </div>
          <div className="nav-item" onClick={handleLogout}>
            <LogOut size={20} /> Выйти
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="page-header">
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
              <div className="page">
                <div className="stats-grid">
                  <div className="stat-card glass-panel">
                    <div className="stat-info">
                      <span className="stat-label">Баланс Fanytel</span>
                      <span className="stat-value">${stats?.balance || '0.00'}</span>
                    </div>
                    <div className="stat-icon primary"><LogOut size={24} style={{transform: 'rotate(90deg)'}}/></div>
                  </div>
                  <div className="stat-card glass-panel">
                    <div className="stat-info">
                      <span className="stat-label">Куплено номеров</span>
                      <span className="stat-value">{stats?.totalNumbers || 0}</span>
                    </div>
                    <div className="stat-icon success"><Phone size={24} /></div>
                  </div>
                  <div className="stat-card glass-panel">
                    <div className="stat-info">
                      <span className="stat-label">Выдано клиентам</span>
                      <span className="stat-value">{stats?.assignedNumbers || 0}</span>
                    </div>
                    <div className="stat-icon warning"><Users size={24} /></div>
                  </div>
                </div>

                <div style={{display: 'flex', gap: 24, flexWrap: 'wrap'}}>
                  <div className="glass-panel" style={{ padding: 24, flex: 2, minWidth: 400 }}>
                    <h3 style={{ marginBottom: 16 }}>Активность SMS (последние 7 дней)</h3>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={generateChartData()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                          <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)'}} />
                          <YAxis stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)'}} allowDecimals={false} />
                          <Tooltip contentStyle={{backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8}} />
                          <Line type="monotone" dataKey="count" name="Сообщений" stroke="var(--accent-primary)" strokeWidth={3} dot={{r: 4, fill: 'var(--accent-primary)'}} activeDot={{r: 6}} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: 24, flex: 1, minWidth: 300 }}>
                    <h3 style={{ marginBottom: 16 }}>Свежие сообщения</h3>
                    <div className="nav-links">
                      {sms.slice(0, 6).map((msg) => (
                        <div key={msg.id} style={{padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                            <span className="badge warning">{msg.sender}</span>
                            <span style={{color: 'var(--text-secondary)', fontSize: 12}}>{format(new Date(msg.received_at), 'HH:mm')}</span>
                          </div>
                          <div style={{fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                            {msg.message_text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'numbers' && (() => {
              const filtered = filterData(numbers, ['number', 'telegram_id', 'renewaldate']);
              const paginated = paginate(filtered);
              return (
              <div className="page">
                <div className="table-controls">
                  <div style={{position: 'relative'}}>
                    <Search size={18} style={{position: 'absolute', left: 12, top: 11, color: 'var(--text-secondary)'}} />
                    <input type="text" className="search-input" style={{paddingLeft: 40}} placeholder="Поиск по номеру или ID..." value={searchQuery} onChange={e => {setSearchQuery(e.target.value); setCurrentPage(1);}} />
                  </div>
                  <div>
                    <button className="btn" onClick={handleBuyNumberModal}><PlusCircle size={16} style={{marginRight: 6, verticalAlign: 'text-bottom'}}/> Купить номер</button>
                  </div>
                </div>
                
                <div className="glass-panel" style={{ padding: 24 }}>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Номер телефона</th>
                          <th>Telegram ID</th>
                          <th>Статус</th>
                          <th>Действует до</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((n) => (
                          <tr key={n.id}>
                            <td style={{ fontWeight: 600 }}>
                              +{n.number} 
                              <button className="copy-btn" onClick={() => copyToClipboard(n.number)}><Copy size={12}/></button>
                            </td>
                            <td>
                              {n.telegram_id ? (
                                <span>
                                  <a href={`tg://user?id=${n.telegram_id}`} style={{color: 'var(--text-primary)', textDecoration: 'none'}}>{n.telegram_id}</a>
                                  <button className="copy-btn" onClick={() => copyToClipboard(n.telegram_id)}><Copy size={12}/></button>
                                </span>
                              ) : (
                                <span style={{color: 'var(--text-secondary)'}}>Не назначен</span>
                              )}
                            </td>
                            <td>
                              {n.telegram_id ? (
                                <span className="badge success"><CheckCircle2 size={12}/> Выдан</span>
                              ) : (
                                <span className="badge primary"><CheckCircle2 size={12}/> Свободен</span>
                              )}
                            </td>
                            <td className={getExpirationClass(n.renewaldate)}>
                              {n.renewaldate ? n.renewaldate : '—'}
                            </td>
                            <td>
                              {n.telegram_id ? (
                                <button className="action-btn danger" onClick={() => handleUnassign(n.number)}>Открепить</button>
                              ) : (
                                <button className="action-btn" onClick={() => handleAssign(n.number)}>Назначить</button>
                              )}
                              <button className="action-btn" onClick={() => handleViewSms(n.number)}>
                                <MessageSquare size={14}/> SMS
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderPagination(filtered.length)}
                </div>
              </div>
            )})()}

            {activeTab === 'users' && (() => {
              const filtered = filterData(users, ['telegram_id', 'role']);
              const paginated = paginate(filtered);
              return (
              <div className="page">
                <div className="table-controls">
                  <div style={{position: 'relative'}}>
                    <Search size={18} style={{position: 'absolute', left: 12, top: 11, color: 'var(--text-secondary)'}} />
                    <input type="text" className="search-input" style={{paddingLeft: 40}} placeholder="Поиск пользователя..." value={searchQuery} onChange={e => {setSearchQuery(e.target.value); setCurrentPage(1);}} />
                  </div>
                  <button className="action-btn" onClick={() => exportCSV(users, 'users_export.csv')}>
                    <Download size={16} style={{marginRight: 6}}/> Выгрузить CSV
                  </button>
                </div>
                
                <div className="glass-panel" style={{ padding: 24 }}>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>ID в базе</th>
                          <th>Telegram ID</th>
                          <th>Назначенные номера</th>
                          <th>Роль</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((u) => (
                          <tr key={u.id}>
                            <td>{u.id}</td>
                            <td>
                              <a href={`tg://user?id=${u.telegram_id}`} className="action-btn" style={{margin: 0}}>
                                <LinkIcon size={14} /> {u.telegram_id}
                              </a>
                            </td>
                            <td>
                              {u.assigned_numbers && u.assigned_numbers.length > 0 ? (
                                <div style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
                                  {u.assigned_numbers.map(num => (
                                    <span key={num} className="badge primary">+{num}</span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{color: 'var(--text-secondary)'}}>Нет номеров</span>
                              )}
                            </td>
                            <td>
                              {u.role === 'admin' ? (
                                <span className="badge danger">Администратор</span>
                              ) : (
                                <span className="badge success">Клиент</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderPagination(filtered.length)}
                </div>
              </div>
            )})()}

            {activeTab === 'sms' && (() => {
              const filtered = filterData(sms, ['number', 'sender', 'message_text']);
              const paginated = paginate(filtered);
              return (
              <div className="page">
                <div className="table-controls">
                  <div style={{position: 'relative'}}>
                    <Search size={18} style={{position: 'absolute', left: 12, top: 11, color: 'var(--text-secondary)'}} />
                    <input type="text" className="search-input" style={{paddingLeft: 40}} placeholder="Поиск по тексту или номеру..." value={searchQuery} onChange={e => {setSearchQuery(e.target.value); setCurrentPage(1);}} />
                  </div>
                  <button className="action-btn" onClick={() => exportCSV(sms, 'sms_export.csv')}>
                    <Download size={16} style={{marginRight: 6}}/> Выгрузить CSV
                  </button>
                </div>
                
                <div className="glass-panel" style={{ padding: 24 }}>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Время</th>
                          <th>Получатель (Номер)</th>
                          <th>Отправитель</th>
                          <th>Текст</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((msg) => (
                          <tr key={msg.id}>
                            <td style={{whiteSpace: 'nowrap'}}>{format(new Date(msg.received_at), 'dd.MM.yyyy HH:mm:ss')}</td>
                            <td style={{ fontWeight: 600 }}>+{msg.number}</td>
                            <td><span className="badge warning">{msg.sender}</span></td>
                            <td>
                              {msg.message_text}
                              <button className="copy-btn" style={{marginLeft: 8}} onClick={() => copyToClipboard(msg.message_text)}><Copy size={12}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {renderPagination(filtered.length)}
                </div>
              </div>
            )})()}

            {activeTab === 'settings' && (
              <div className="page">
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24}}>
                  <div className="glass-panel" style={{ padding: 24 }}>
                    <h3 style={{ marginBottom: 16 }}>Статус подключения</h3>
                    <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)'}}>
                        <span style={{color: 'var(--text-secondary)'}}>API Провайдер:</span>
                        <span style={{fontWeight: 600}}>Fanytel</span>
                      </div>
                      <div style={{display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)'}}>
                        <span style={{color: 'var(--text-secondary)'}}>Статус соединения:</span>
                        {fanytelStatus?.status === 'Online' ? (
                          <span className="badge success">🟢 Online</span>
                        ) : (
                          <span className="badge danger">🔴 Offline / Ошибка</span>
                        )}
                      </div>
                      <div style={{display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)'}}>
                        <span style={{color: 'var(--text-secondary)'}}>Текущий баланс API:</span>
                        <span style={{fontWeight: 600}}>{fanytelStatus ? `$${fanytelStatus.balance}` : 'Загрузка...'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: 24 }}>
                    <h3 style={{ marginBottom: 16 }}>Безопасность</h3>
                    <form onSubmit={handleChangePassword}>
                      <div className="input-group">
                        <label>Новый пароль администратора</label>
                        <input 
                          type="password" 
                          name="newPassword"
                          className="form-input" 
                          placeholder="Минимум 5 символов"
                        />
                      </div>
                      <button type="submit" className="btn">Сменить пароль</button>
                    </form>
                    <p style={{marginTop: 16, fontSize: 13, color: 'var(--text-secondary)'}}>
                      После смены пароля вас разлогинит на всех устройствах, и нужно будет войти заново.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
