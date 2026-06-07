import React, { useState } from 'react';
import { LogOut, Phone, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, isAfter } from 'date-fns';
import SmsText from './SmsText';

export default function Dashboard({ stats, sms }) {
  const [chartPeriod, setChartPeriod] = useState(7);

  const generateChartData = () => {
    if (!sms || sms.length === 0) return [];
    
    const groups = {};
    for (let i = chartPeriod - 1; i >= 0; i--) {
      groups[format(subDays(new Date(), i), 'MMM dd')] = 0;
    }
    
    const cutoff = subDays(new Date(), chartPeriod);
    
    sms.forEach(m => {
      const d = new Date(m.received_at);
      if (isAfter(d, cutoff)) {
        const day = format(d, 'MMM dd');
        if (groups[day] !== undefined) {
          groups[day]++;
        }
      }
    });
    
    return Object.keys(groups).map(date => ({ date, count: groups[date] }));
  };

  return (
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Активность SMS</h3>
            <select 
              className="search-input" 
              style={{ width: 'auto', padding: '4px 12px', boxSizing: 'border-box' }}
              value={chartPeriod}
              onChange={(e) => setChartPeriod(Number(e.target.value))}
            >
              <option value={7}>За 7 дней</option>
              <option value={14}>За 14 дней</option>
              <option value={30}>За 30 дней</option>
            </select>
          </div>
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
                  <SmsText text={msg.message_text} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
