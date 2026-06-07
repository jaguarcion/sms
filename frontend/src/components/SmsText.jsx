import React from 'react';
import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SmsText({ text }) {
  const copyToClipboard = (str) => {
    navigator.clipboard.writeText(str);
    toast.success('Код скопирован!');
  };

  if (!text) return null;

  // Умный поиск кодов (4-8 цифр или G-XXXXXX)
  const codeRegex = /((?<!\d)\d{4,8}(?!\d)|G-\d{6})/g;
  const parts = text.split(codeRegex);

  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px' }}>
      {parts.map((part, i) => {
        if (part && part.match(codeRegex)) {
          return (
            <span key={i} style={{ 
              fontWeight: 700, 
              color: 'var(--accent-primary)', 
              background: 'rgba(99, 102, 241, 0.15)',
              padding: '2px 6px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }} onClick={(e) => { e.stopPropagation(); copyToClipboard(part); }} title="Скопировать код">
              {part} <Copy size={12} />
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
