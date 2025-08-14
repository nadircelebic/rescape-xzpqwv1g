import { HashRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import AdminPage from './assets/pages/AdminPage'
import PublicView from './assets/pages/PublicView'
import logo from './assets/logo.png'

export default function App() {
  return (
    <Router>
      <div className="app-nav">
        <Link to="/view" className="app-link" style={{display:'flex',alignItems:'center',gap:8}}>
          <img src={logo} alt="logo" style={{width:24,height:24,borderRadius:6}} />
          👁️ Javni prikaz
        </Link>
        <Link className="app-link" to="/admin">🛡️ Admin</Link>
      </div>

      <div className="app-wrap">
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/view" element={<PublicView />} />
          <Route path="/" element={<Navigate to="/view" replace />} />
          <Route path="*" element={<div style={{ padding: 20 }}>404 — idi na <Link to="/view">/view</Link></div>} />
        </Routes>

        <footer style={{textAlign:'center', fontSize:12, opacity:.6, marginTop:40, padding:10, borderTop:'1px solid #1f2937'}}>
          © {new Date().getFullYear()} Vaše ime
        </footer>
      </div>
    </Router>
  )
}
