import React, { useState } from 'react';
import { Search, PlusCircle, Copy, CheckCircle2, MessageSquare, Printer, Download } from 'lucide-react';
import { API_URL, filterAndSortData, paginate } from '../utils';
import Pagination from './Pagination';

export default function NumbersTable({
  numbers,
  searchQuery,
  setSearchQuery,
  currentPage,
  setCurrentPage,
  ITEMS_PER_PAGE,
  handleBuyNumberModal,
  copyToClipboard,
  handleUnassign,
  handleAssign,
  handleViewSms,
  getExpirationClass,
  refreshData
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filterType, setFilterType] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const baseFiltered = numbers.filter(n => {
    if (filterType === 'free' && n.telegram_id) return false;
    if (filterType === 'assigned' && !n.telegram_id) return false;
    return true;
  });

  const filtered = filterAndSortData(baseFiltered, ['number', 'telegram_id', 'renewaldate'], searchQuery, sortConfig);
  const paginated = paginate(filtered, currentPage, ITEMS_PER_PAGE);

  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length && paginated.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map(n => n.number)));
    }
  };

  const handleBulkUnassign = async () => {
    if (!window.confirm(`Открепить ${selectedIds.size} выбранных номеров?`)) return;
    
    try {
      const password = localStorage.getItem('adminPassword');
      await Promise.all(Array.from(selectedIds).map(num => 
        fetch(`${API_URL}/numbers/unassign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${password}` },
          body: JSON.stringify({ number: num })
        })
      ));
      if (refreshData) refreshData();
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page">
      <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
        <button className="action-btn" style={filterType === 'all' ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: 'white' } : {}} onClick={() => {setFilterType('all'); setCurrentPage(1);}}>Все номера</button>
        <button className="action-btn" style={filterType === 'free' ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: 'white' } : {}} onClick={() => {setFilterType('free'); setCurrentPage(1);}}>Свободные</button>
        <button className="action-btn" style={filterType === 'assigned' ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: 'white' } : {}} onClick={() => {setFilterType('assigned'); setCurrentPage(1);}}>Выданные</button>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ background: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, border: '1px solid var(--accent-primary)' }}>
          <span style={{fontWeight: 500}}>Выбрано номеров: <strong style={{color: 'var(--accent-primary)'}}>{selectedIds.size}</strong></span>
          <div style={{display: 'flex', gap: 8}}>
            <button className="action-btn danger" onClick={handleBulkUnassign}>Открепить выбранные</button>
            <button className="action-btn" onClick={() => setSelectedIds(new Set())}>Сбросить</button>
          </div>
        </div>
      )}

      <div className="table-controls">
        <div style={{position: 'relative'}}>
          <Search size={18} style={{position: 'absolute', left: 12, top: 11, color: 'var(--text-secondary)'}} />
          <input type="text" className="search-input" style={{paddingLeft: 40}} placeholder="Поиск по номеру или ID..." value={searchQuery} onChange={e => {setSearchQuery(e.target.value); setCurrentPage(1);}} />
        </div>
        <div style={{display: 'flex', gap: 8}}>
          <button className="action-btn" onClick={() => window.print()}>
            <Printer size={14} /> Печать
          </button>
          <button className="btn" onClick={handleBuyNumberModal}><PlusCircle size={16} style={{marginRight: 6, verticalAlign: 'text-bottom'}}/> Купить номер</button>
        </div>
      </div>
      
      <div className="glass-panel" style={{ padding: 24 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{width: 40}}>
                  <input type="checkbox" checked={selectedIds.size === paginated.length && paginated.length > 0} onChange={toggleSelectAll} />
                </th>
                <th onClick={() => handleSort('number')} style={{cursor: 'pointer', userSelect: 'none'}}>Номер телефона {sortConfig.key === 'number' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('telegram_id')} style={{cursor: 'pointer', userSelect: 'none'}}>Telegram ID {sortConfig.key === 'telegram_id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th>Статус</th>
                <th onClick={() => handleSort('renewaldate')} style={{cursor: 'pointer', userSelect: 'none'}}>Действует до {sortConfig.key === 'renewaldate' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(n => (
                <tr key={n.number} className={selectedIds.has(n.number) ? 'selected-row' : ''}>
                  <td>
                    <input type="checkbox" checked={selectedIds.has(n.number)} onChange={() => toggleSelect(n.number)} />
                  </td>
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
