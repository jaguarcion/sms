import React, { useState } from 'react';
import { X, Save, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../utils';

export default function UserProfileModal({ user, onClose, refreshData }) {
  const [notes, setNotes] = useState(user.notes || '');
  const [tags, setTags] = useState(user.tags || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const password = localStorage.getItem('adminPassword');
      const res = await fetch(`${API_URL}/users/${user.telegram_id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${password}` },
        body: JSON.stringify({ notes, tags })
      });
      if (res.ok) {
        toast.success('Профиль клиента обновлен');
        if (refreshData) refreshData();
        onClose();
      } else {
        toast.error('Ошибка сохранения');
      }
    } catch (err) {
      toast.error('Сбой сети: ' + err.message);
    } finally {
      setIsSaving(false);
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
        width: '100%', maxWidth: 500, padding: 24, borderRadius: 16,
        position: 'relative',
        boxSizing: 'border-box',
        margin: '16px'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, background: 'none', 
          border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
          padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%'
        }}>
          <X size={20} />
        </button>

        <h2 style={{marginTop: 0, marginBottom: 24, fontSize: 20}}>Профиль клиента</h2>

        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <div style={{display: 'flex', gap: 32}}>
            <div>
              <div style={{fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4}}>Telegram ID</div>
              <div style={{fontWeight: 600, fontSize: 16, color: 'var(--text-primary)'}}>{user.telegram_id}</div>
            </div>
            
            <div>
              <div style={{fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4}}>Роль</div>
              <span className={`badge ${user.role === 'admin' ? 'danger' : 'primary'}`}>
                {user.role}
              </span>
            </div>
          </div>

          <div>
            <div style={{fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4}}>Выданные номера ({user.assigned_numbers?.length || 0})</div>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              {user.assigned_numbers?.length > 0 ? (
                user.assigned_numbers.map(n => (
                  <span key={n} className="badge warning">+{n}</span>
                ))
              ) : (
                <span style={{color: 'var(--text-secondary)', fontSize: 14}}>Нет номеров</span>
              )}
            </div>
          </div>

          <div>
            <div style={{fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center'}}><Tag size={12} style={{marginRight: 4}}/>Теги (через запятую)</div>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Например: VIP, оптовик, должник..." 
              value={tags} 
              onChange={e => setTags(e.target.value)} 
              style={{width: '100%', boxSizing: 'border-box'}}
            />
          </div>

          <div>
            <div style={{fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4}}>Внутренние заметки</div>
            <textarea 
              className="search-input" 
              placeholder="Любая важная информация о клиенте..." 
              value={notes} 
              onChange={e => setNotes(e.target.value)}
              style={{width: '100%', height: 100, resize: 'vertical', padding: 12, boxSizing: 'border-box', fontFamily: 'inherit'}}
            />
          </div>
        </div>

        <div style={{display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24}}>
          <button className="copy-btn" onClick={onClose} style={{padding: '8px 16px'}}>Отмена</button>
          <button className="btn" onClick={handleSave} disabled={isSaving} style={{padding: '8px 16px', display: 'flex', alignItems: 'center'}}>
            <Save size={16} style={{marginRight: 8}}/> {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
