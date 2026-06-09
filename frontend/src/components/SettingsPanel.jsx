import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { format } from 'date-fns';

const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

export default function SettingsPanel({ fanytelStatus, handleChangePassword }) {
  const [sessions, setSessions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const password = localStorage.getItem('adminPassword');
        const res = await fetch(`${API_URL}/settings/sessions`, {
          headers: { 'Authorization': `Bearer ${password}` }
        });
        if (res.ok) {
          setSessions(await res.json());
        }

        const res2 = await fetch(`${API_URL}/audit`, {
          headers: { 'Authorization': `Bearer ${password}` }
        });
        if (res2.ok) {
          setAuditLogs(await res2.json());
        }
      } catch (err) {
        console.error("Failed to fetch sessions or audit", err);
      }
    };
    
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
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

        <div className="glass-panel" style={{ padding: 24, gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: 16 }}>Активные сессии</h3>
          <p style={{fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16}}>
            Устройства, с которых был выполнен вход в панель администратора.
          </p>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Устройство / Браузер</th>
                  <th>IP Адрес</th>
                  <th>Последняя активность</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.ip}>
                    <td>
                      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                        {s.userAgent.toLowerCase().includes('mobile') || s.userAgent.toLowerCase().includes('android') || s.userAgent.toLowerCase().includes('iphone') 
                          ? <Smartphone size={18} color="var(--text-secondary)" /> 
                          : <Monitor size={18} color="var(--text-secondary)" />
                        }
                        <span style={{fontSize: 13, wordBreak: 'break-all'}}>{s.userAgent}</span>
                      </div>
                    </td>
                    <td style={{fontFamily: 'monospace', fontWeight: 600}}>{s.ip.replace('::ffff:', '')}</td>
                    <td>{format(new Date(s.lastSeen), 'dd.MM.yyyy HH:mm:ss')}</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{textAlign: 'center', color: 'var(--text-secondary)'}}>Загрузка...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 24, gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: 16 }}>Журнал действий (Audit Trail)</h3>
          <p style={{fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16}}>
            История действий администраторов системы.
          </p>
          <div className="table-container" style={{maxHeight: 400, overflowY: 'auto'}}>
            <table>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>IP Адрес</th>
                  <th>Действие</th>
                  <th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{whiteSpace: 'nowrap'}}>{format(new Date(log.timestamp), 'dd.MM.yyyy HH:mm:ss')}</td>
                    <td style={{fontFamily: 'monospace', fontWeight: 600}}>{log.ip.replace('::ffff:', '')}</td>
                    <td><span className="badge primary">{log.action}</span></td>
                    <td style={{fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all'}}>{log.details}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{textAlign: 'center', color: 'var(--text-secondary)'}}>Нет записей в журнале</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
