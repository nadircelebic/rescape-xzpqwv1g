import { HashRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import AdminPage from './assets/pages/AdminPage'
import PublicView from './assets/pages/PublicView'

export default function App() {
  return (
    <Router>
      {/* NAV */}
      <div className="app-nav">
        <Link className="app-link" to="/view">👁️ Javni prikaz</Link>
        <Link className="app-link" to="/admin">🛡️ Admin</Link>
      </div>

      {/* PAGE WRAPPER */}
      <div className="app-wrap">
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/view" element={<PublicView />} />
          <Route path="/" element={<Navigate to="/view" replace />} />
          <Route path="*" element={<div style={{ padding: 20 }}>404 — idi na <Link to="/view">/view</Link></div>} />
        </Routes>

        {/* FOOTER sa autorom sajta */}
        <footer style={{
          textAlign:'center', fontSize:12, opacity:.6,
          marginTop:40, padding:10, borderTop:'1px solid #1f2937'
        }}>
          © {new Date().getFullYear()} Nadir Čelebić — Sva prava zadržana.
        </footer>
      </div>
    </Router>
  )
}
