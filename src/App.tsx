import { HashRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import AdminPage from './assets/pages/AdminPage'
import PublicView from './assets/pages/PublicView'
import brand from './assets/logo.png'   // ⬅️ uvoz logotipa iz src/assets

export default function App() {
  return (
    <Router>
      <div className="app-nav">
        <div className="nav-left">
          {/* glavni logo levo */}
          <img src={brand} alt="Logo" className="logo" />

          {/* link sa malim logom pored teksta */}
          <Link className="app-link with-icon" to="/view">
            <img src={brand} alt="" className="link-icon" />
            <span>Javni prikaz</span>
          </Link>

          <Link className="app-link" to="/admin">🛡️ Admin</Link>
        </div>

        {/* blago vidljiv logo u headeru (koristimo inline background da ubodemo ispravan URL) */}
        <div className="nav-bg-logo" aria-hidden="true" style={{ backgroundImage: `url(${brand})` }} />
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
