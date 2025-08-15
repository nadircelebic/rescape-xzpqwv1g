import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PublicView from './assets/pages/PublicView';
import AdminPage from './assets/pages/AdminPage';
import './styles.css';

function App() {
  return (
    <Router>
      <div className="app-container">

        {/* Logo u vrhu */}
        <header className="app-header">
          <img src="/logo.png" alt="Logo" className="site-logo" />
        </header>

        {/* Rute */}
        <main className="app-main">
          <Routes>
            <Route path="/" element={<PublicView />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>

        {/* Footer autor */}
        <footer className="page-footer">
          © 2025 Nadir Čelebić. Sva prava zadržana.
        </footer>
      </div>
    </Router>
  );
}

export default App;
