import React, { useState } from 'react';
import { Search, Download, Link as LinkIcon, Printer } from 'lucide-react';
import { filterAndSortData, paginate } from '../utils';
import Pagination from './Pagination';
import UserProfileModal from './UserProfileModal';

export default function UsersTable({
  users,
  searchQuery,
  setSearchQuery,
  currentPage,
  setCurrentPage,
  ITEMS_PER_PAGE,
  exportCSV,
  refreshData
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filterType, setFilterType] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const baseFiltered = users.filter(u => {
    if (filterType === 'admin' && u.role !== 'admin') return false;
    if (filterType === 'client' && u.role !== 'client') return false;
    return true;
  });

  const filtered = filterAndSortData(baseFiltered, ['telegram_id', 'role', 'first_name', 'username'], searchQuery, sortConfig);
  const paginated = paginate(filtered, currentPage, ITEMS_PER_PAGE);

  return (
    <div className="page">
      <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
        <button className="action-btn" style={filterType === 'all' ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: 'white' } : {}} onClick={() => {setFilterType('all'); setCurrentPage(1);}}>Все пользователи</button>
        <button className="action-btn" style={filterType === 'admin' ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: 'white' } : {}} onClick={() => {setFilterType('admin'); setCurrentPage(1);}}>Администраторы</button>
        <button className="action-btn" style={filterType === 'client' ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: 'white' } : {}} onClick={() => {setFilterType('client'); setCurrentPage(1);}}>Клиенты</button>
      </div>
      <div className="table-controls">
        <div style={{position: 'relative'}}>
          <Search size={18} style={{position: 'absolute', left: 12, top: 11, color: 'var(--text-secondary)'}} />
          <input type="text" className="search-input" style={{paddingLeft: 40}} placeholder="Поиск пользователя..." value={searchQuery} onChange={e => {setSearchQuery(e.target.value); setCurrentPage(1);}} />
        </div>
        <div style={{display: 'flex', gap: 8}}>
          <button className="action-btn" onClick={() => window.print()}>
            <Printer size={14} /> Печать / PDF
          </button>
          <button className="action-btn" onClick={exportCSV}>
            <Download size={14} /> Скачать CSV
          </button>
        </div>
      </div>
      
      <div className="glass-panel" style={{ padding: 24 }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('id')} style={{cursor: 'pointer', userSelect: 'none'}}>ID в базе {sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('first_name')} style={{cursor: 'pointer', userSelect: 'none'}}>Пользователь {sortConfig.key === 'first_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th onClick={() => handleSort('telegram_id')} style={{cursor: 'pointer', userSelect: 'none'}}>Telegram ID {sortConfig.key === 'telegram_id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                <th>Назначенные номера</th>
                <th onClick={() => handleSort('role')} style={{cursor: 'pointer', userSelect: 'none'}}>Роль {sortConfig.key === 'role' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((u) => (
                <tr key={u.id} onClick={() => setSelectedUser(u)} style={{cursor: 'pointer'}} title="Кликните для просмотра профиля">
                  <td>{u.id}</td>
                  <td>
                    {u.first_name || u.username ? (
                      <div style={{fontWeight: 500}}>
                        {u.username ? (
                          <a href={`https://t.me/${u.username}`} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent-primary)', textDecoration: 'none'}}>
                            {u.first_name || 'Без имени'} (@{u.username})
                          </a>
                        ) : (
                          <a href={`tg://user?id=${u.telegram_id}`} style={{color: 'var(--text-primary)', textDecoration: 'none'}}>
                            {u.first_name}
                          </a>
                        )}
                      </div>
                    ) : (
                      <span style={{color: 'var(--text-secondary)', fontSize: 13}}>—</span>
                    )}
                  </td>
                  <td>
                    <a href={`tg://user?id=${u.telegram_id}`} className="action-btn" style={{margin: 0}} onClick={(e) => e.stopPropagation()}>
                      <LinkIcon size={14} /> {u.telegram_id}
                    </a>
                    {u.tags && <span className="badge warning" style={{marginLeft: 8, fontSize: 10}}>{u.tags}</span>}
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
        <Pagination 
          totalItems={filtered.length} 
          itemsPerPage={ITEMS_PER_PAGE} 
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage} 
        />
      </div>

      {selectedUser && (
        <UserProfileModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
          refreshData={refreshData}
        />
      )}
    </div>
  );
}
