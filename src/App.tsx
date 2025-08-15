// src/App.tsx
import { HashRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import PublicView from './assets/pages/PublicView'
import AdminPage from './assets/pages/AdminPage'
import './styles.css'
import brand from './assets/logo.png'   // ⬅️ Uvoz logotipa iz src/assets

export default function App() {
  return (
    <Router>
      {/* Gornja navigacija sa logoom i linkovima */}
      <div className="app-nav">
        <div className="nav-left">
          {/* Glavni logo levo */}
          <img src={brand} alt="Logo" className="logo" />

          {/* Link sa malim logoom pored teksta */}
          <Link className="app-link with-icon" to="/view">
            <img src={brand} alt="" className="link-icon" />
            <span>Javni prikaz</span>
          </Link>

          {/* Admin link */}
          <Link className="app-link" to="/admin">🛡️ Admin</Link>
        </div>

        {/* Blago vidljiv logo u headeru (desno) */}
        <div
          className="nav-bg-logo"
          aria-hidden="true"
          style={{ backgroundImage: `url(${brand})` }}  // ⬅️ ovde takođe koristimo import
        />
      </div>

      {/* Rute */}
      <Routes>
        <Route path="/view" element={<PublicView />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<Navigate to="/view" replace />} />
        <Route path="*" element={<div className="app-wrap">404 — idi na <Link to="/view">/view</Link></div>} />
      </Routes>

      {/* Footer sa autorom na svakoj stranici */}
      <footer className="page-footer">
        © 2025 Nadir Čelebić. Sva prava zadržana.
      </footer>
    </Router>
  )
}
