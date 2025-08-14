import { useEffect, useMemo, useState } from 'react'
import { db, storage, auth } from '../../firebase'
import {
  collection, addDoc, updateDoc, doc, onSnapshot, orderBy, query, serverTimestamp
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, setPersistence, browserLocalPersistence, signOut
} from 'firebase/auth'

type Status = 'u_izradi' | 'pauza' | 'zavrseno'
type Product = { id: string; name: string; status?: Status; createdAt?: any }
type Task    = { id: string; title: string; order: number; done: boolean; createdAt?: any }
type Update  = { id: string; taskId: string; note: string; images: string[]; createdAt?: any; author?: string }

function fmt(ts?: any) { try { return ts?.toDate ? ts.toDate().toLocaleString() : '' } catch { return '' } }
const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt:'select_account' })

export default function AdminPage() {
  // Auth
  const [user, setUser] = useState<any>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  // Proizvodi
  const [products, setProducts] = useState<Product[]>([])
  const [selId, setSelId] = useState<string>('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<Status>('u_izradi')

  // Taskovi
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskTitle, setTaskTitle] = useState('')

  // Update (opis + slike) za izabrani task
  const [selTaskId, setSelTaskId] = useState<string>('')
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)

  // UI
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Auth lifecycle
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {})
    getRedirectResult(auth).catch(() => {})
    const unsub = onAuthStateChanged(auth, (u) => setUser(u))
    return () => unsub()
  }, [])

  // Učitavanje proizvoda
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const list: Product[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
      setProducts(list)
      if (!selId && list.length) {
        setSelId(list[0].id)
        setStatus((list[0].status as Status) || 'u_izradi')
      }
    })
    return () => unsub()
  }, [selId])

  // Taskovi za izabrani proizvod
  useEffect(() => {
    if (!selId) { setTasks([]); setSelTaskId(''); return }
    const tq = query(collection(db, 'products', selId, 'tasks'), orderBy('order', 'asc'))
    const unsub = onSnapshot(tq, (snap) => {
      const list: Task[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
      setTasks(list)
      if (!selTaskId && list.length) setSelTaskId(list[0].id)
    })
    return () => unsub()
  }, [selId, selTaskId])

  // Progress
  const progress = useMemo(() => {
    if (!tasks.length) return 0
    const done = tasks.filter(t => t.done).length
    return Math.round((done / tasks.length) * 100)
  }, [tasks])

  const selectedProduct = useMemo(
    () => products.find(p => p.id === selId) || null,
    [products, selId]
  )

  // Handleri
  async function login() {
    setAuthError(null)
    try { await signInWithPopup(auth, provider) }
    catch (e:any) {
      try { await signInWithRedirect(auth, provider) }
      catch (err2:any) { setAuthError(`${err2?.code || 'auth/error'}: ${err2?.message || String(err2)}`) }
    }
  }
  async function logout() { await signOut(auth) }

  async function addProduct() {
    setMsg(null); setErr(null)
    if (!name.trim()) { setErr('Unesi naziv proizvoda.'); return }
    await addDoc(collection(db, 'products'), {
      name: name.trim(), status: 'u_izradi' as Status, createdAt: serverTimestamp(),
    })
    setName('')
  }

  async function saveStatus(s: Status) {
    if (!selectedProduct) return
    setStatus(s)
    await updateDoc(doc(db, 'products', selectedProduct.id), { status: s })
  }

  async function addTask() {
    setMsg(null); setErr(null)
    if (!selId) { setErr('Izaberi proizvod.'); return }
    if (!taskTitle.trim()) { setErr('Unesi naziv koraka.'); return }
    const order = tasks.length ? Math.max(...tasks.map(t => t.order)) + 1 : 1
    await addDoc(collection(db, 'products', selId, 'tasks'), {
      title: taskTitle.trim(), order, done: false, createdAt: serverTimestamp(),
    })
    setTaskTitle('')
  }

  async function toggleTask(t: Task) {
    await updateDoc(doc(db, 'products', selId, 'tasks', t.id), { done: !t.done })
  }

  async function addUpdate() {
    setMsg(null); setErr(null)
    if (!selId) { setErr('Izaberi proizvod.'); return }
    if (!selTaskId) { setErr('Izaberi korak (task).'); return }
    if (!note.trim() && !(files && files.length)) { setErr('Dodaj opis ili slike.'); return }

    setBusy(true)
    try {
      const urls: string[] = []
      if (files && files.length) {
        for (const f of Array.from(files)) {
          const r = ref(storage, `uploads/${selId}/${selTaskId}/${Date.now()}_${f.name}`)
          await uploadBytes(r, f)
          const url = await getDownloadURL(r)
          urls.push(url)
        }
      }
      await addDoc(collection(db, 'products', selId, 'updates'), {
        taskId: selTaskId, note: note.trim(), images: urls,
        createdAt: serverTimestamp(), author: user?.email || user?.uid || 'admin',
      })
      setNote(''); setFiles(null)
      const fin = document.getElementById('files') as HTMLInputElement | null
      if (fin) fin.value = ''
      setMsg('Sačuvan update.')
    } catch (e:any) {
      setErr(e?.message || String(e))
    } finally { setBusy(false) }
  }

  // UI
  if (!user) {
    return (
      <div className="app-wrap">
        <div className="card" style={{ marginBottom: 12 }}>
          <h1>🛡️ Admin</h1>
          <p>Prijavi se Google nalogom da bi dodavao proizvode, korake i slike.</p>
          <button className="btn" onClick={login}>Prijava Google</button>
          {authError && <div style={{ marginTop: 10, color: '#ef4444' }}>{authError}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="app-wrap">
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="kv">Prijavljen: <b>{user.email || user.uid}</b></div>
        <button className="btn ghost" onClick={logout}>Odjava</button>
      </div>

      {/* Dodaj proizvod */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>➕ Novi proizvod</h3>
        <div className="stack-sm" style={{ marginTop: 8 }}>
          <input className="input" placeholder="Naziv proizvoda" value={name} onChange={e => setName(e.target.value)} />
          <button className="btn" onClick={addProduct}>Dodaj</button>
        </div>
      </section>

      {/* Izbor proizvoda */}
      <div className="stack-sm" style={{ alignItems: 'center', margin: '12px 0' }}>
        <span className="kv" style={{ minWidth: 90 }}>Proizvod:</span>
        <select className="input" value={selId} onChange={e => setSelId(e.target.value)}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {selectedProduct && (
        <>
          {/* Status + Progress */}
          <section className="card" style={{ marginBottom: 16 }}>
            <div className="stack-sm" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className={`badge dot ${status}`}>
                  {status === 'pauza' ? 'Pauza' : status === 'zavrseno' ? 'Završeno' : 'U izradi'}
                </div>
                <select className="input" value={status} onChange={e => saveStatus(e.target.value as Status)}>
                  <option value="u_izradi">U izradi</option>
                  <option value="pauza">Pauza</option>
                  <option value="zavrseno">Završeno</option>
                </select>
              </div>
              <div className="kv">Kreirano: {fmt(selectedProduct.createdAt)}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="progress"><div style={{ width: `${progress}%` }} /></div>
              <div className="kv" style={{ marginTop: 6 }}>
                Progres: <b>{progress}%</b> ({tasks.filter(t => t.done).length}/{tasks.length})
              </div>
            </div>
          </section>

          {/* Task lista */}
          <section className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>📋 Koraci (To-Do)</h3>
            <div className="stack-sm" style={{ marginBottom: 8 }}>
              <input className="input" placeholder="Naziv koraka" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
              <button className="btn" onClick={addTask}>Dodaj korak</button>
            </div>
            <div className="grid-auto">
              {tasks.map(t => (
                <div key={t.id} className={`task ${t.done ? 'done' : ''}`}>
                  <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} />
                  <div style={{ flex: 1 }}>{t.title}</div>
                  <span className="kv">{fmt(t.createdAt)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Novi update */}
          <section className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>🖊️ Novi korak / update</h3>
            <div className="stack-sm" style={{ margin: '8px 0' }}>
              <select className="input" value={selTaskId} onChange={e => setSelTaskId(e.target.value)}>
                <option value="" disabled>Izaberi korak</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <input className="input" placeholder="Opis šta je urađeno" value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1 }} />
            </div>
            <input id="files" type="file" accept="image/*" multiple onChange={e => setFiles(e.target.files)} />
            <div style={{ marginTop: 10 }}>
              <button className="btn" disabled={busy} onClick={addUpdate}>Sačuvaj update</button>
            </div>
            {msg && <div style={{ marginTop: 10, color: '#22c55e' }}>{msg}</div>}
            {err && <div style={{ marginTop: 10, color: '#ef4444' }}>{err}</div>}
          </section>
        </>
      )}
    </div>
  )
}
