import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Contacts from './pages/Contacts';
import Deals from './pages/Deals';
import Messages from './pages/Messages';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Load user from localStorage (would use actual auth in production)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <p className="eyebrow">Go-first CRM</p>
          <h1>CRM Workspace</h1>
          <p>Manage leads, deals, and customer conversations from one dashboard.</p>
        <button onClick={() => {
          const testUser = { id: 'test-user-123', email: 'test@example.com' };
          localStorage.setItem('user', JSON.stringify(testUser));
          setUser(testUser);
        }}>
          Enter Demo Workspace
        </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        <nav className="sidebar">
          <div className="brand">
            <span className="brand-mark">C</span>
            <div>
              <strong>CRM OS</strong>
              <small>Local Workspace</small>
            </div>
          </div>

          <ul className="nav-group">
            <li><NavLink to="/">Dashboard</NavLink></li>
            <li><NavLink to="/messages">Conversations</NavLink></li>
            <li><NavLink to="/contacts">Contacts</NavLink></li>
            <li><NavLink to="/deals">Opportunities</NavLink></li>
          </ul>

          <p className="nav-label">Coming Next</p>
          <ul className="nav-group muted-nav">
            <li><span>Calendars</span></li>
            <li><span>Automation</span></li>
            <li><span>Marketing</span></li>
            <li><span>Settings</span></li>
          </ul>

          <button className="logout-button" onClick={() => {
            localStorage.removeItem('user');
            setUser(null);
          }}>Logout</button>
        </nav>

        <section className="workspace">
          <header className="topbar">
            <input className="global-search" placeholder="Search contacts, deals, conversations..." />
            <div className="topbar-actions">
              <span>{user.email}</span>
              <button>New</button>
            </div>
          </header>

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/messages" element={<Messages />} />
            </Routes>
          </main>
        </section>
      </div>
    </Router>
  );
}

export default App;
