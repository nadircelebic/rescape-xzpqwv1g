import { HashRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import AdminPage from './assets/pages/AdminPage'
import PublicView from './assets/pages/PublicView'

export default function App() {
  return (
    <Router>
      <div className="app-nav">
        <div className="nav-left">
          {/* glavni logo levo */}
          <img src="/logo.png" alt="Logo" className="logo" />
          {/* link sa malim logom pored teksta */}
          <Link className="app-link with-icon" to="/view">
            <img src="/logo.png" alt="" className="link-icon" />
            <span>Javni prikaz</span>
          </Link>
          <Link className="app-link" to="/admin">🛡️ Admin</Link>
        </div>

        {/* blago vidljiv logo u vrhu (watermark u headeru) */}
        <div className="nav-bg-logo" aria-hidden="true" />
      </div>

      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/view" element={<PublicView />} />
        <Route path="/" element={<Navigate to="/view" replace />} />
        <Route path="*" element={<div className="app-wrap">404 — idi na <Link to="/view">/view</Link></div>} />
      </Routes>
    </Router>
  )
}
