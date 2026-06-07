import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BroadcastModal({ onClose }) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

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
    if (!window.confirm('Отправить сообщение ВСЕМ пользователям?')) return;
    
    setIsSending(true);
    const toastId = toast.loading('Выполняем рассылку...');
    try {
      const password = localStorage.getItem('adminPassword');
      const res = await fetch('http://localhost:3000/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${password}` },
        body: JSON.stringify({ message })
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

        <h2 style={{marginTop: 0, marginBottom: 8, fontSize: 20}}>Массовая рассылка</h2>
        <p style={{color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14}}>
          Сообщение будет отправлено всем клиентам бота. Поддерживается Markdown: <strong>**жирный**</strong>, <em>_курсив_</em>, `код`, [текст](ссылка).
        </p>

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
            <Send size={16} style={{marginRight: 8}}/> {isSending ? 'Отправка...' : 'Отправить всем'}
          </button>
        </div>
      </div>
    </div>
  );
}
