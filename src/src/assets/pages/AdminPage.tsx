import { useEffect, useMemo, useState } from 'react'
import { db, storage, auth } from '../../firebase'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, getDocs
} from 'firebase/firestore'
import {
  ref, uploadBytes, getDownloadURL, deleteObject, listAll
} from 'firebase/storage'
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, setPersistence, browserLocalPersistence, signOut
} from 'firebase/auth'

type Status = 'u_izradi' | 'pauza' | 'zavrseno'
type Product = { id: string; name?: string; note?: string; status?: Status; createdAt?: any }
type Task    = { id: string; title?: string; order: number; done: boolean; createdAt?: any }
type Update  = { id: string; taskId?: string; note?: string; images?: string[]; createdAt?: any; author?: string }

const ALLOW = ['nadir.celebic1@gmail.com','ljaljakedvin@gmail.com','jasmin.celebic1@gmail.com']
const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt:'select_account' })
const fmt = (ts?: any) => { try { return ts?.toDate ? ts.toDate().toLocaleString() : '' } catch { return '' } }

/** Watermark: vrati Blob slikе sa utisnutim watermark.png (donji desni ugao) */
async function applyWatermark(file: File, logoUrl = '/watermark.png', opacity = 0.7): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file)
  })
  const logo = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = logoUrl
  })
  const maxW = 2600 // po želji ograniči max veličinu (radi manjih fajlova)
  const scale = img.width > maxW ? maxW / img.width : 1
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const lw = Math.round(w * 0.18) // logo ~18% širine
  const lh = Math.round(logo.height * (lw / logo.width))
  const pad = Math.round(Math.min(w, h) * 0.02)
  ctx.globalAlpha = opacity
  ctx.drawImage(logo, w - lw - pad, h - lh - pad, lw, lh)
  return await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/jpeg', 0.9))
}

export default function AdminPage(){
  // AUTH
  const [user, setUser] = useState<any>(null)
  const [isAllowed, setIsAllowed] = useState<boolean|null>(null)
  const [authError, setAuthError] = useState<string|null>(null)

  // Proizvodi
  const [products, setProducts] = useState<Product[]>([])
  const [selId, setSelId] = useState<string>('')
  const [name, setName] = useState('')            // neobavezno
  const [pnote, setPnote] = useState('')          // napomena za proizvod
  const [status, setStatus] = useState<Status>('u_izradi')

  // Taskovi
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskTitle, setTaskTitle] = useState('')  // neobavezno

  // Update
  const [selTaskId, setSelTaskId] = useState<string>('')
  const [note, setNote] = useState('')            // neobavezno
  const [files, setFiles] = useState<FileList | null>(null)

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string|null>(null)
  const [err, setErr] = useState<string|null>(null)

  useEffect(()=>{
    setPersistence(auth, browserLocalPersistence).catch(()=>{})
    getRedirectResult(auth).catch(()=>{})
    const unsub = onAuthStateChanged(auth, async (u)=>{
      setUser(u)
      if (!u){ setIsAllowed(null); return }
      const email = u.email || ''
      if (ALLOW.includes(email)) { setIsAllowed(true); return }
      // opciono: fallback na Firestore kolekciju adminEmails/<email>
      try {
        const { getDoc } = await import('firebase/firestore')
        const ok = await getDoc(doc(db,'adminEmails', email))
        setIsAllowed(ok.exists())
      } catch { setIsAllowed(false) }
    })
    return ()=>unsub()
  },[])

  // proizvodi
  useEffect(()=>{
    const q = query(collection(db,'products'), orderBy('createdAt','desc'))
    const unsub = onSnapshot(q, snap=>{
      const list: Product[] = snap.docs.map(d=>({id:d.id, ...(d.data() as any)}))
      setProducts(list)
      if (!selId && list.length){
        setSelId(list[0].id)
        setStatus((list[0].status as Status) || 'u_izradi')
        setPnote(list[0].note || '')
      }
    })
    return ()=>unsub()
  },[selId])

  // taskovi
  useEffect(()=>{
    if (!selId){ setTasks([]); setSelTaskId(''); return }
    const tq = query(collection(db,'products',selId,'tasks'), orderBy('order','asc'))
    const unsub = onSnapshot(tq, s=>{
      const list: Task[] = s.docs.map(d=>({id:d.id, ...(d.data() as any)}))
      setTasks(list)
      if (!selTaskId && list.length) setSelTaskId(list[0].id)
    })
    return ()=>unsub()
  },[selId, selTaskId])

  const progress = useMemo(()=>{
    if (!tasks.length) return 0
    const done = tasks.filter(t=>t.done).length
    return Math.round((done / tasks.length) * 100)
  },[tasks])

  const selectedProduct = useMemo(()=> products.find(p=>p.id===selId) || null, [products, selId])

  // AUTH handlers
  async function login(){
    setAuthError(null)
    try { await signInWithPopup(auth, provider) }
    catch(e:any){
      try { await signInWithRedirect(auth, provider) }
      catch(err2:any){ setAuthError(`${err2?.code || 'auth/error'}: ${err2?.message || String(err2)}`) }
    }
  }
  async function logout(){ await signOut(auth) }

  // CRUD – polja NE moraju biti popunjena
  async function addProduct(){
    setMsg(null); setErr(null)
    await addDoc(collection(db,'products'), {
      name: name || '', note: pnote || '', status: status || 'u_izradi',
      createdAt: serverTimestamp()
    })
    setName(''); setPnote('')
  }

  async function saveProdMeta(){
    if (!selectedProduct) return
    await updateDoc(doc(db,'products',selectedProduct.id), {
      name: name, note: pnote, status
    })
    setMsg('Proizvod sačuvan.')
  }

  async function addTask(){
    setMsg(null); setErr(null)
    const order = tasks.length ? Math.max(...tasks.map(t=>t.order))+1 : 1
    await addDoc(collection(db,'products',selId,'tasks'), {
      title: taskTitle || '', order, done:false, createdAt: serverTimestamp()
    })
    setTaskTitle('')
  }

  async function toggleTask(t: Task){
    await updateDoc(doc(db,'products',selId,'tasks',t.id), { done: !t.done })
  }

  async function addUpdate(){
    setMsg(null); setErr(null)
    setBusy(true)
    try{
      const urls: string[] = []
      if (files && files.length){
        for (const f of Array.from(files)){
          // watermark → blob
          let toUpload: Blob = f
          try { toUpload = await applyWatermark(f, '/watermark.png', 0.7) } catch {}
          const path = `uploads/${selId}/${selTaskId || 'no-task'}/${Date.now()}_${f.name.replace(/\s+/g,'_')}`
          const r = ref(storage, path)
          await uploadBytes(r, toUpload)
          urls.push(await getDownloadURL(r))
        }
      }
      await addDoc(collection(db,'products',selId,'updates'), {
        taskId: selTaskId || '', note: note || '', images: urls,
        createdAt: serverTimestamp(), author: user?.email || user?.uid || 'admin'
      })
      setNote(''); setFiles(null)
      const fin = document.getElementById('files') as HTMLInputElement | null
      if (fin) fin.value = ''
      setMsg('Update sačuvan.')
    }catch(e:any){ setErr(e?.message || String(e)) }
    finally{ setBusy(false) }
  }

  // DELETE – update, task, product (kaskadno)
  async function deleteUpdate(u: Update){
    if (!confirm('Obrisati ovaj update?')) return
    // obriši slike iz Storage (ako postoje)
    try {
      for (const url of u.images || []){
        const rf = ref(storage, url) // ref od https URL-a
        await deleteObject(rf)
      }
    } catch {}
    // obriši doc
    await deleteDoc(doc(db,'products',selId,'updates', u.id))
  }

  async function deleteTask(t: Task){
    if (!confirm('Obrisati ovaj korak?')) return
    // obriši sve update-e koji referenciraju ovaj task
    const uq = query(collection(db,'products',selId,'updates'))
    const us = await getDocs(uq)
    for (const d of us.docs){
      const u = d.data() as any
      if (u.taskId === t.id){
        try {
          for (const url of u.images || []){
            const rf = ref(storage, url)
            await deleteObject(rf)
          }
        } catch {}
        await deleteDoc(d.ref)
      }
    }
    await deleteDoc(doc(db,'products',selId,'tasks', t.id))
  }

  async function deleteProductCascade(){
    if (!selectedProduct) return
    if (!confirm('Obrisati ceo proizvod, sve korake i slike?')) return

    // 1) obriši sve updates (+ slike)
    const upRef = collection(db,'products',selectedProduct.id,'updates')
    const upSnap = await getDocs(upRef)
    for (const d of upSnap.docs){
      const u = d.data() as any
      try {
        for (const url of u.images || []){
          const rf = ref(storage, url)
          await deleteObject(rf)
        }
      } catch {}
      await deleteDoc(d.ref)
    }

    // 2) obriši sve tasks
    const tkRef = collection(db,'products',selectedProduct.id,'tasks')
    const tkSnap = await getDocs(tkRef)
    for (const d of tkSnap.docs) await deleteDoc(d.ref)

    // 3) obriši cele foldere u storage-u (best-effort): uploads/<prodId>/**
    try {
      const root = ref(storage, `uploads/${selectedProduct.id}`)
      const stack = [root]
      while (stack.length){
        const dir = stack.pop()!
        const ls = await listAll(dir)
        for (const f of ls.items) await deleteObject(f)
        for (const p of ls.prefixes) stack.push(p)
      }
    } catch {}

    // 4) obriši dokument proizvoda
    await deleteDoc(doc(db,'products', selectedProduct.id))
    setSelId('')
  }

  // RENDER
  if (!user) {
    return (
      <div className="app-wrap">
        <div className="card" style={{ marginBottom: 12 }}>
          <h1>🛡️ Admin</h1>
          <p>Prijavi se Google nalogom.</p>
          <button className="btn" onClick={login}>Prijava Google</button>
          {authError && <div style={{ marginTop: 10, color: '#ef4444' }}>{authError}</div>}
        </div>
      </div>
    )
  }
  if (isAllowed === false) {
    return (
      <div className="app-wrap">
        <div className="card">
          <h2>🚫 Zabranjen pristup</h2>
          <p>{user.email} nije na listi administratora.</p>
          <button className="btn ghost" onClick={logout}>Odjava</button>
        </div>
      </div>
    )
  }
  if (isAllowed === null) {
    return <div className="app-wrap"><div className="card">🔄 Provera dozvole…</div></div>
  }

  return (
    <div className="app-wrap">
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="kv">Prijavljen: <b>{user.email || user.uid}</b></div>
        <button className="btn ghost" onClick={logout}>Odjava</button>
      </div>

      {/* Novi proizvod */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>➕ Novi proizvod</h3>
        <div className="stack-sm" style={{ marginTop: 8 }}>
          <input className="input" placeholder="Naziv (neobavezno)" value={name} onChange={e=>setName(e.target.value)} />
          <select className="input" value={status} onChange={e=>setStatus(e.target.value as Status)}>
            <option value="u_izradi">U izradi</option>
            <option value="pauza">Pauza</option>
            <option value="zavrseno">Završeno</option>
          </select>
        </div>
        <textarea className="input" placeholder="Napomena (neobavezno)" value={pnote} onChange={e=>setPnote(e.target.value)} />
        <div style={{display:'flex',gap:8, marginTop:8}}>
          <button className="btn" onClick={addProduct}>Dodaj proizvod</button>
          {selectedProduct && <button className="btn ghost" onClick={saveProdMeta}>Sačuvaj izmene</button>}
          {selectedProduct && <button className="btn ghost" onClick={deleteProductCascade}>🗑️ Obriši proizvod</button>}
        </div>
      </section>

      {/* Izbor proizvoda */}
      <div className="stack-sm" style={{ alignItems: 'center', margin: '12px 0' }}>
        <span className="kv" style={{ minWidth: 90 }}>Proizvod:</span>
        <select className="input" value={selId} onChange={e=>{
          setSelId(e.target.value)
          const p = products.find(x=>x.id===e.target.value)
          setStatus((p?.status as Status) || 'u_izradi')
          setName(p?.name || '')
          setPnote(p?.note || '')
        }}>
          <option value="" disabled>— izaberi —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name || '(bez naziva)'}</option>)}
        </select>
      </div>

      {selectedProduct && (
        <>
          {/* Status + Progress + Napomena info */}
          <section className="card" style={{ marginBottom: 16 }}>
            <div className="stack-sm" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className={`badge dot ${status}`}>
                  {status === 'pauza' ? 'Pauza' : status === 'zavrseno' ? 'Završeno' : 'U izradi'}
                </div>
                <select className="input" value={status} onChange={e => setStatus(e.target.value as Status)}>
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

            {!!selectedProduct.note && (
              <div className="card" style={{marginTop:12, boxShadow:'none'}}>
                <div className="kv" style={{marginBottom:6}}>Napomena</div>
                <div style={{whiteSpace:'pre-wrap'}}>{selectedProduct.note}</div>
              </div>
            )}
          </section>

          {/* Taskovi */}
          <section className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>📋 Koraci (To-Do)</h3>
            <div className="stack-sm" style={{ marginBottom: 8 }}>
              <input className="input" placeholder="Naziv koraka (neobavezno)" value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} />
              <button className="btn" onClick={addTask}>Dodaj korak</button>
            </div>
            <div className="grid-auto">
              {tasks.map(t => (
                <div key={t.id} className={`task ${t.done ? 'done' : ''}`}>
                  <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} />
                  <div style={{ flex: 1 }}>{t.title || '(bez naziva)'}</div>
                  <span className="kv">{fmt(t.createdAt)}</span>
                  <button className="btn ghost" onClick={()=>deleteTask(t)}>🗑️</button>
                </div>
              ))}
            </div>
          </section>

          {/* Update */}
          <section className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>🖊️ Novi korak / update</h3>
            <div className="stack-sm" style={{ margin: '8px 0' }}>
              <select className="input" value={selTaskId} onChange={e=>setSelTaskId(e.target.value)}>
                <option value="">(nevezano za korak)</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.title || '(bez naziva)'}</option>)}
              </select>
              <input className="input" placeholder="Opis šta je urađeno (neobavezno)" value={note} onChange={e=>setNote(e.target.value)} />
            </div>
            <input id="files" type="file" accept="image/*" multiple onChange={e=>setFiles(e.target.files)} />
            <div style={{ marginTop: 10, display:'flex', gap:8, flexWrap:'wrap' }}>
              <button className="btn" disabled={busy} onClick={addUpdate}>Sačuvaj update</button>
            </div>
            {msg && <div style={{ marginTop: 10, color: '#22c55e' }}>{msg}</div>}
            {err && <div style={{ marginTop: 10, color: '#ef4444' }}>{err}</div>}
          </section>

          {/* (Opciona) lista update-a sa brisanjem – ako želiš i ovde pregled */}
          {/* 
          <section className="card">
            <h3>🧱 Dnevnik koraka</h3>
            { ... onSnapshot za updates kao u PublicView, pa dugme deleteUpdate(u) ... }
          </section>
          */}
        </>
      )}
    </div>
  )
}
