import React, { useState } from 'react';
import { Search, Download, Copy, Trash2 } from 'lucide-react';
import { filterAndSortData, paginate } from '../utils';
import Pagination from './Pagination';
import { format } from 'date-fns';
import SmsText from './SmsText';
import toast from 'react-hot-toast';

export default function SmsTable({
  sms,
  searchQuery,
  setSearchQuery,
  currentPage,
  setCurrentPage,
  ITEMS_PER_PAGE,
  exportCSV,
  copyToClipboard,
  refreshData
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const filtered = filterAndSortData(sms, ['number', 'sender', 'message_text'], searchQuery, sortConfig);
  const paginated = paginate(filtered, currentPage, ITEMS_PER_PAGE);

  const handleClearHistory = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить ВСЮ историю SMS? Это действие нельзя отменить.')) return;
    
    try {
      const password = localStorage.getItem('adminPassword');
      const res = await fetch('http://localhost:3000/api/sms/clear', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (res.ok) {
        toast.success('История SMS успешно очищена');
        if (refreshData) refreshData();
      } else {
        toast.error('Ошибка очистки');
      }
    } catch (err) {
      toast.error('Ошибка сети: ' + err.message);
    }
  };

  return (
    <div className="page">
      <div className="table-controls">
        <div style={{position: 'relative'}}>
          <Search size={18} style={{position: 'absolute', left: 12, top: 11, color: 'var(--text-secondary)'}} />
          <input type="text" className="search-input" style={{paddingLeft: 40}} placeholder="Поиск по тексту или номеру..." value={searchQuery} onChange={e => {setSearchQuery(e.target.value); setCurrentPage(1);}} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="action-btn danger" onClick={handleClearHistory}>
            <Trash2 size={16} style={{marginRight: 6}}/> Очистить историю
          </button>
          <button className="action-btn" onClick={() => exportCSV(sms, 'sms_export.csv')}>
            <Download size={16} style={{marginRight: 6}}/> Выгрузить CSV
          </button>
        </div>
      </div>
      
      <div className="glass-panel" style={{ padding: 24 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('received_at')} style={{cursor: 'pointer', userSelect: 'none'}}>Время {sortConfig.key === 'received_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('number')} style={{cursor: 'pointer', userSelect: 'none'}}>Получатель (Номер) {sortConfig.key === 'number' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('sender')} style={{cursor: 'pointer', userSelect: 'none'}}>Отправитель {sortConfig.key === 'sender' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
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
                    <SmsText text={msg.message_text} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination 
          totalItems={filtered.length} 
          itemsPerPage={ITEMS_PER_PAGE} 
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage} 
        />
      </div>
    </div>
  );
}
