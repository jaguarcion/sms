import React, { useState } from 'react';
import { X } from 'lucide-react';
import { paginate } from '../utils';
import Pagination from './Pagination';
import { format } from 'date-fns';
import SmsText from './SmsText';

export default function NumberSmsModal({ number, allSms, onClose }) {
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter sms by number and sort by received_at DESC
  const numberSms = allSms
    .filter(msg => msg.number === number)
    .sort((a, b) => b.received_at - a.received_at);
  
  const paginated = paginate(numberSms, currentPage, ITEMS_PER_PAGE);

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', 
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div className="glass-panel" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 800, padding: 24, borderRadius: 16,
        position: 'relative', margin: 16, boxSizing: 'border-box',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, background: 'none', 
          border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4,
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <X size={20} />
        </button>

        <h2 style={{marginTop: 0, marginBottom: 16, fontSize: 20}}>
          История сообщений: +{number}
        </h2>

        {numberSms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            Нет сообщений для этого номера
          </div>
        ) : (
          <>
            <div className="table-container" style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Отправитель</th>
                    <th>Текст</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((msg) => (
                    <tr key={msg.id}>
                      <td style={{whiteSpace: 'nowrap'}}>{format(new Date(msg.received_at), 'dd.MM.yyyy HH:mm:ss')}</td>
                      <td><span className="badge warning">{msg.sender}</span></td>
                      <td><SmsText text={msg.message_text} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ flexShrink: 0 }}>
              <Pagination 
                totalItems={numberSms.length} 
                itemsPerPage={ITEMS_PER_PAGE} 
                currentPage={currentPage} 
                setCurrentPage={setCurrentPage} 
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
