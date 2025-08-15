import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PublicView from './assets/pages/PublicView';
import AdminPage from './assets/pages/AdminPage';
import './styles.css';

export default function App() {
  return (
    <Router>
      <div className="app-container">

        {/* Logo u vrhu (iz public/logo.png) */}
        <header className="app-header">
          <img src="/logo.png" alt="Logo" className="site-logo" />
        </header>

        {/* Rute */}
        <main className="app-main">
          <Routes>
            <Route path="/view" element={<PublicView />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/" element={<Navigate to="/view" replace />} />
            <Route path="*" element={<div className="app-wrap">404 — idi na /#/view</div>} />
          </Routes>
        </main>

        {/* Footer autor – prikazuje se na svakoj stranici */}
        <footer className="page-footer">
          © 2025 Nadir Čelebić. Sva prava zadržana.
        </footer>
      </div>
    </Router>
  );
}
