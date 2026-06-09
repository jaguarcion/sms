import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

export default function BroadcastModal({ onClose }) {
  const [message, setMessage] = useState('');
  const [targetId, setTargetId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [users, setUsers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        const password = localStorage.getItem('adminPassword');
        const res = await fetch(`${API_URL}/users`, {
          headers: { 'Authorization': `Bearer ${password}` }
        });
        if (res.ok) {
          setUsers(await res.json());
        }
      } catch (e) {
        console.error("Failed to load users", e);
      }
    };
    fetchUsers();
  }, []);

  // Simple Markdown to HTML preview function for basic Telegram Markdown
  const renderPreview = (text) => {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/_(.*?)_/g, '<i>$1</i>')
      .replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px;">$1</code>')
      .replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
        const cleanUrl = url.trim().replace(/^['"]|['"]$/g, '');
        if (/^(javascript|data|vbscript):/i.test(cleanUrl)) {
          return `<a href="#" style="color: var(--accent-primary); text-decoration: underline;">${text} (Заблокировано)</a>`;
        }
        return `<a href="${cleanUrl}" target="_blank" style="color: var(--accent-primary); text-decoration: underline;">${text}</a>`;
      })
      .replace(/\n/g, '<br/>');
    return { __html: html };
  };

  const handleSend = async () => {
    if (!message.trim()) return toast.error('Текст не может быть пустым');
    
    const isTargeted = targetId.trim().length > 0;
    const confirmMessage = isTargeted 
      ? `Отправить сообщение пользователю ${targetId}?` 
      : 'Отправить сообщение ВСЕМ пользователям?';
      
    if (!window.confirm(confirmMessage)) return;
    
    setIsSending(true);
    const toastId = toast.loading('Отправляем...');
    try {
      const password = localStorage.getItem('adminPassword');
      const payload = { message };
      if (isTargeted) payload.targetId = targetId.trim();
      
      const res = await fetch(`${API_URL}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${password}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Отправлено ${data.count} пользователям!`, { id: toastId });
        onClose();
      } else {
        toast.error(`Ошибка: ${data.error}`, { id: toastId });
      }
    } catch (err) {
      toast.error(`Сбой сети: ${err.message}`, { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', 
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div className="glass-panel" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 800, padding: 24, borderRadius: 16,
        position: 'relative', margin: 16, boxSizing: 'border-box'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, background: 'none', 
          border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4,
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <X size={20} />
        </button>

        <h2 style={{marginTop: 0, marginBottom: 8, fontSize: 20}}>Рассылка уведомлений</h2>
        <p style={{color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14}}>
          Сообщение можно отправить <strong>всем клиентам</strong> бота, либо указать <strong>конкретного пользователя</strong>. Поддерживается Markdown: **жирный**, _курсив_, `код`, [текст](ссылка).
        </p>

        <div style={{marginBottom: 20, position: 'relative'}}>
          <div style={{fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8}}>Получатель (Telegram ID или Имя)</div>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Оставьте пустым для отправки ВСЕМ пользователям..." 
            value={targetId} 
            onChange={e => {
              setTargetId(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            style={{width: '100%', boxSizing: 'border-box'}}
          />
          {showDropdown && targetId && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
              background: 'var(--bg-card)', 
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--border-color)',
              borderRadius: '0 0 8px 8px', maxHeight: '250px', overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}>
              {users.filter(u => {
                const search = targetId.toLowerCase();
                return (
                  u.telegram_id?.toString().includes(search) ||
                  u.username?.toLowerCase().includes(search) ||
                  u.first_name?.toLowerCase().includes(search) ||
                  u.notes?.toLowerCase().includes(search)
                );
              }).map(u => (
                <div 
                  key={u.id}
                  onClick={() => {
                    setTargetId(u.telegram_id.toString());
                    setShowDropdown(false);
                  }}
                  style={{
                    padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{fontWeight: 500, fontSize: 14}}>{u.telegram_id}</div>
                  <div style={{fontSize: 12, color: 'var(--text-secondary)'}}>
                    {u.username ? `@${u.username}` : (u.first_name || 'Без имени')}
                    {u.notes ? ` • ${u.notes}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{display: 'flex', gap: 24, flexWrap: 'wrap'}}>
          <div style={{flex: '1 1 300px'}}>
            <div style={{fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8}}>Текст сообщения (Markdown)</div>
            <textarea 
              className="search-input" 
              placeholder="Введите текст рассылки..." 
              value={message} 
              onChange={e => setMessage(e.target.value)}
              style={{width: '100%', height: 250, resize: 'vertical', padding: 12, boxSizing: 'border-box', fontFamily: 'monospace'}}
            />
          </div>
          <div style={{flex: '1 1 300px'}}>
            <div style={{fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8}}>Предпросмотр (как в Telegram)</div>
            <div style={{
              background: 'var(--bg-elevated)', 
              borderRadius: 8, 
              padding: 16, 
              height: 250, 
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              boxSizing: 'border-box'
            }}>
              <div style={{fontWeight: 'bold', marginBottom: 8, color: 'var(--text-primary)'}}>📢 Уведомление</div>
              <div 
                style={{wordBreak: 'break-word', color: 'var(--text-primary)', lineHeight: 1.5}}
                dangerouslySetInnerHTML={renderPreview(message || 'Здесь будет ваше сообщение...')}
              />
            </div>
          </div>
        </div>

        <div style={{display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24}}>
          <button className="copy-btn" onClick={onClose} style={{padding: '8px 16px'}}>Отмена</button>
          <button className="btn" onClick={handleSend} disabled={isSending || !message.trim()} style={{padding: '8px 16px', display: 'flex', alignItems: 'center'}}>
            <Send size={16} style={{marginRight: 8}}/> {isSending ? 'Отправка...' : (targetId.trim() ? 'Отправить пользователю' : 'Отправить всем')}
          </button>
        </div>
      </div>
    </div>
  );
}
