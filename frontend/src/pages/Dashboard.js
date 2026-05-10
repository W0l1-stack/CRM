import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

function Dashboard() {
  const [stats, setStats] = useState({ contacts: 0, deals: 0, messages: 0 });

  const userId = JSON.parse(localStorage.getItem('user')).id;
  const api = useMemo(() => axios.create({
    baseURL: process.env.REACT_APP_API_GO || 'http://localhost:3001',
    headers: { 'X-User-ID': userId }
  }), [userId]);

  const fetchStats = useCallback(async () => {
    try {
      const contacts = await api.get('/api/contacts');
      const deals = await api.get('/api/deals');
      setStats({
        contacts: (contacts.data || []).length,
        deals: (deals.data || []).length,
        messages: 0
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [api]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Command Center</p>
          <h1>Dashboard</h1>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', marginTop: '8px' }}>
        <div style={{ backgroundColor: '#111827', color: 'white', padding: '20px', borderRadius: '8px' }}>
          <h3>Contacts</h3>
          <p style={{ fontSize: '2em', margin: 0 }}>{stats.contacts}</p>
        </div>
        <div style={{ backgroundColor: '#166534', color: 'white', padding: '20px', borderRadius: '8px' }}>
          <h3>Opportunities</h3>
          <p style={{ fontSize: '2em', margin: 0 }}>{stats.deals}</p>
        </div>
        <div style={{ backgroundColor: '#0f766e', color: 'white', padding: '20px', borderRadius: '8px' }}>
          <h3>Conversations</h3>
          <p style={{ fontSize: '2em', margin: 0 }}>{stats.messages}</p>
        </div>
      </div>

      <div style={{ marginTop: '24px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e5eaf0' }}>
        <h2>Workspace Priorities</h2>
        <p>Use this area as the operating home for sales, conversations, and follow-up activity.</p>
        <ul>
          <li><strong>Contacts:</strong> Store and organize customer information</li>
          <li><strong>Opportunities:</strong> Track pipeline value and sales stage</li>
          <li><strong>Conversations:</strong> Manage customer communication from the Go API</li>
        </ul>
      </div>
    </div>
  );
}

export default Dashboard;
