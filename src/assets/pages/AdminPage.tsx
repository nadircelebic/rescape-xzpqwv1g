// src/assets/pages/AdminPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { db, storage, auth } from '../../firebase'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, getDocs, getDoc, where
} from 'firebase/firestore'
import {
  ref, getDownloadURL, deleteObject, listAll, uploadBytesResumable
} from 'firebase/storage'
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, setPersistence, browserLocalPersistence, signOut
} from 'firebase/auth'
import { applyWatermark } from '../../utils/watermark'
import watermarkPng from '../../assets/watermark.png'

type Status = 'u_izradi' | 'pauza' | 'zavrseno'
type Product = { id: string; name?: string; note?: string; status?: Status; createdAt?: any }
type Task    = { id: string; title?: string; order: number; done: boolean; createdAt?: any }
type Update  = { id: string; taskId?: string; note?: string; images?: string[]; createdAt?: any; author?: string }

const ALLOW = ['nadir.celebic1@gmail.com','ljaljakedvin@gmail.com','jasmin.celebic1@gmail.com']
const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt:'select_account' })

const fmt = (ts?: any) => { try { return ts?.toDate ? ts.toDate().toLocaleString() : '' } catch { return '' } }

function errText(e:any){
  if(!e) return 'Nepoznata greška'
  if(typeof e==='string') return e
  if(e.message) return e.message
  try { return JSON.stringify(e) } catch { return String(e) }
}

/** Promise wrap za uploadBytesResumable → vrati downloadURL */
function uploadWithProgress(
  r: ReturnType<typeof ref>,
  data: Blob | File,
  contentType = 'image/jpeg',
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(r, data, { contentType });
    task.on(
      'state_changed',
      snap => {
        if (onProgress && snap.totalBytes > 0) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
        // VAŽNO: NEMA setErr ovde – ovo NIJE greška, samo progress!
      },
      err => reject(err),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

/** Fallback: resize bez watermarka (ako watermark padne) */
async function downscaleOnly(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = fr.result as string
    }
    fr.onerror = rej
    fr.readAsDataURL(file)
  })
  const k = Math.min(max / img.width, max / img.height, 1)
  const W = Math.round(img.width * k), H = Math.round(img.height * k)
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0, W, H)
  return await new Promise<Blob>((r)=> c.toBlob(b=>r(b!), 'image/jpeg', quality))
}

export default function AdminPage(){
  // AUTH
  const [user, setUser] = useState<any>(null)
  const [isAllowed, setIsAllowed] = useState<boolean|null>(null)
  const [authError, setAuthError] = useState<string|null>(null)

  // Proizvodi
  const [products, setProducts] = useState<Product[]>([])
  const [selId, setSelId] = useState<string>('')

  // Meta selektovanog proizvoda (sva polja NEOBAVEZNA)
  const [name, setName] = useState('')
  const [pnote, setPnote] = useState('')
  const [status, setStatus] = useState<Status>('u_izradi')

  // Taskovi
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskTitle, setTaskTitle] = useState('')

  // Update (unos)
  const [selTaskId, setSelTaskId] = useState<string>('')
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)

  // UI
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string|null>(null)
  const [err, setErr] = useState<string|null>(null)

  // AUTH lifecycle
  useEffect(()=>{
    setPersistence(auth, browserLocalPersistence).catch(()=>{})
    getRedirectResult(auth).catch(()=>{})
    const unsub = onAuthStateChanged(auth, async (u)=>{
      setUser(u)
      if (!u){ setIsAllowed(null); return }
      const email = u.email || ''
      if (ALLOW.includes(email)) { setIsAllowed(true); return }
      try {
        const ok = await getDoc(doc(db,'adminEmails', email))
        setIsAllowed(ok.exists())
      } catch { setIsAllowed(false) }
    })
    return ()=>unsub()
  },[])

  // Proizvodi
  useEffect(()=>{
    const q = query(collection(db,'products'), orderBy('createdAt','desc'))
    const unsub = onSnapshot(q, snap=>{
      const list: Product[] = snap.docs.map(d=>({id:d.id, ...(d.data() as any)}))
      setProducts(list)
      if (!selId && list.length) {
        setSelId(list[0].id)
        setName(list[0].name || '')
        setPnote(list[0].note || '')
        setStatus((list[0].status as Status) || 'u_izradi')
      }
    })
    return ()=>unsub()
  }, [selId])

  // Taskovi
  useEffect(()=>{
    if (!selId){ setTasks([]); setSelTaskId(''); return }
    const tq = query(collection(db,'products',selId,'tasks'), orderBy('order','asc'))
    const unsub = onSnapshot(tq, s=>{
      const list: Task[] = s.docs.map(d=>({id:d.id, ...(d.data() as any)}))
      setTasks(list)
      if (!selTaskId && list.length) setSelTaskId(list[0].id)
    })
    return ()=>unsub()
  }, [selId, selTaskId])

  const selectedProduct = useMemo(()=> products.find(p=>p.id===selId) || null, [products, selId])
  const progress = useMemo(()=>{
    if (!tasks.length) return 0
    const done = tasks.filter(t=>t.done).length
    return Math.round(done / tasks.length * 100)
  }, [tasks])

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

  // CRUD — polja NE moraju biti popunjena
  async function addProduct(){
    setMsg(null); setErr(null)
    try{
      if (!user) throw new Error('Nisi prijavljen.')
      await addDoc(collection(db,'products'), {
        name: name || '', note: pnote || '', status: status || 'u_izradi',
        createdAt: serverTimestamp()
      })
      setName(''); setPnote('')
      setMsg('Proizvod dodat.')
    }catch(e:any){ setErr(errText(e)) }
  }
  async function saveProdMeta(){
    setMsg(null); setErr(null)
    try{
      if (!user) throw new Error('Nisi prijavljen.')
      if (!selectedProduct) throw new Error('Nije izabran proizvod.')
      await updateDoc(doc(db,'products',selectedProduct.id), { name, note: pnote || '', status: status || 'u_izradi' })
      setMsg('Proizvod sačuvan.')
    }catch(e:any){ setErr(errText(e)) }
  }
  async function addTask(){
    setMsg(null); setErr(null)
    try{
      if (!user) throw new Error('Nisi prijavljen.')
      if (!selId) throw new Error('Izaberi proizvod.')
      const order = tasks.length ? Math.max(...tasks.map(t=>t.order))+1 : 1
      await addDoc(collection(db,'products',selId,'tasks'), {
        title: taskTitle || '', order, done:false, createdAt: serverTimestamp()
      })
      setTaskTitle('')
      setMsg('Korak dodat.')
    }catch(e:any){ setErr(errText(e)) }
  }
  async function toggleTask(t: Task){
    try { await updateDoc(doc(db,'products',selId,'tasks',t.id), { done: !t.done }) }
    catch(e:any){ setErr(errText(e)) }
  }

  // ⬇️ WATERMARK + RESUMABLE UPLOAD + FIRESTORE UPDATE
  async function addUpdate() {
    setMsg(null); setErr(null); setBusy(true);
    try {
      if (!user) throw new Error('Nisi prijavljen.');
      if (!selId) throw new Error('Izaberi proizvod.'); // jedino obavezno

      const urls: string[] = [];

      if (files && files.length) {
        for (const f of Array.from(files)) {
          try {
            // 1) Watermark sa lokalnim importom (nema CORS) → manji JPEG
            let blob = await applyWatermark(f, watermarkPng, 0.9);

            // 2) Ako je i dalje veliko, dodatno smanji
            if (blob.size > 3 * 1024 * 1024) {
              blob = await downscaleOnly(f, 1600, 0.82);
            }

            // 3) Putanja i resumable upload (uvek šaljemo BLOB, nikad originalni File)
            const safe = f.name.replace(/\s+/g,'_').replace(/[^\w.\-]/g,'');
            const path = `uploads/${selId}/${selTaskId || 'no-task'}/${Date.now()}_${safe}`;
            const r = ref(storage, path);

            const url = await uploadWithProgress(r, blob, 'image/jpeg');
            urls.push(url);

            // console.log('UPLOAD OK', safe, 'origKB=', Math.round(f.size/1024), 'blobKB=', Math.round(blob.size/1024));
          } catch (e) {
            console.warn('Watermark fail → downscale-only fallback', e);

            // 4) Nikad ne šaljemo original: makar smanji pa pošalji
            const blob = await downscaleOnly(f, 1600, 0.82);

            const safe = f.name.replace(/\s+/g,'_').replace(/[^\w.\-]/g,'');
            const path = `uploads/${selId}/${selTaskId || 'no-task'}/${Date.now()}_${safe}`;
            const r = ref(storage, path);

            const url = await uploadWithProgress(r, blob, 'image/jpeg');
            urls.push(url);

            // console.log('UPLOAD Fallback OK', safe, 'blobKB=', Math.round(blob.size/1024));
          }
        }
      }

      await addDoc(collection(db, 'products', selId, 'updates'), {
        taskId: selTaskId || '',
        note: note || '',
        images: urls,
        createdAt: serverTimestamp(),
        author: user?.email || user?.uid || 'admin'
      });

      setNote(''); setFiles(null);
      const fin = document.getElementById('files') as HTMLInputElement | null;
      if (fin) fin.value = '';
      setMsg('Update sačuvan.');
    } catch (e:any) {
      setErr(errText(e));        // lep tekst umesto [object Object]
    } finally {
      setBusy(false);
    }
  }

  // DELETE – update, task (sa njegovim update-ima), proizvod (kaskadno)
  async function deleteUpdate(updateId: string){
    if (!selId) return
    if (!confirm('Obrisati ovaj update?')) return
    const uref = doc(db,'products',selId,'updates', updateId)
    const snap = await getDoc(uref)
    const data = snap.data() as Update | undefined
    if (data?.images?.length){
      for (const url of data.images){
        try { await deleteObject(ref(storage, url)) } catch {}
      }
    }
    await deleteDoc(uref)
  }
  async function deleteTask(taskId: string){
    if (!selId) return
    if (!confirm('Obrisati ovaj korak i sve njegove update-e?')) return
    const uq = query(collection(db,'products',selId,'updates'), where('taskId','==',taskId))
    const us = await getDocs(uq)
    for (const d of us.docs){
      const u = d.data() as Update
      if (u?.images?.length){
        for (const url of u.images){
          try { await deleteObject(ref(storage, url)) } catch {}
        }
      }
      await deleteDoc(d.ref)
    }
    await deleteDoc(doc(db,'products',selId,'tasks', taskId))
    if (selTaskId === taskId) setSelTaskId('')
  }
  async function deleteProductCascade(){
    if (!selId) return
    if (!confirm('Obrisati ceo proizvod, sve korake, updejte i slike?')) return
    const us = await getDocs(collection(db,'products',selId,'updates'))
    for (const d of us.docs){
      const u = d.data() as Update
      if (u?.images?.length){
        for (const url of u.images){
          try { await deleteObject(ref(storage, url)) } catch {}
        }
      }
      await deleteDoc(d.ref)
    }
    const ts = await getDocs(collection(db,'products',selId,'tasks'))
    for (const d of ts.docs) await deleteDoc(d.ref)
    try {
      const root = ref(storage, `uploads/${selId}`)
      const stack = [root]
      while (stack.length){
        const dir = stack.pop()!
        const ls = await listAll(dir)
        for (const f of ls.items) await deleteObject(f)
        for (const p of ls.prefixes) stack.push(p)
      }
    } catch {}
    await deleteDoc(doc(db,'products', selId))
    setSelId('')
  }

  // RENDER (stanje)
  if (!user) {
    return (
      <div className="app-wrap">
        <div className="card" style={{ marginBottom: 12 }}>
          <h1>🛡️ Admin</h1>
          <p>Prijavi se Google nalogom.</p>
          <button type="button" className="btn" onClick={login}>Prijava Google</button>
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
          <button type="button" className="btn ghost" onClick={logout}>Odjava</button>
        </div>
      </div>
    )
  }
  if (isAllowed === null) {
    return <div className="app-wrap"><div className="card">🔄 Provera dozvole…</div></div>
  }

  return (
    <div className="app-wrap">
      <div className="row" style={{ alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div className="kv">Prijavljen: <b>{user.email || user.uid}</b></div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button type="button" className="btn ghost" onClick={logout}>Odjava</button>
        </div>
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
        <div style={{display:'flex',gap:8, marginTop:8, flexWrap:'wrap'}}>
          <button type="button" className="btn" onClick={addProduct}>Dodaj proizvod</button>
          {selectedProduct && <button type="button" className="btn ghost" onClick={saveProdMeta}>Sačuvaj izmene</button>}
          {selectedProduct && <button type="button" className="btn ghost" onClick={deleteProductCascade}>🗑️ Obriši proizvod</button>}
        </div>
      </section>

      {/* Izbor proizvoda */}
      <div className="stack-sm" style={{ alignItems: 'center', margin: '12px 0' }}>
        <span className="kv" style={{ minWidth: 90 }}>Proizvod:</span>
        <select className="input" value={selId} onChange={e=>{
          const id = e.target.value
          setSelId(id)
          const p = products.find(x=>x.id===id)
          setName(p?.name || '')
          setPnote(p?.note || '')
          setStatus((p?.status as Status) || 'u_izradi')
        }}>
          <option value="" disabled>— izaberi —</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name || '(bez naziva)'}</option>)}
        </select>
      </div>

      {selectedProduct && (
        <>
          {/* Status + Progress + Napomena info */}
          <section className="card" style={{ marginBottom: 16 }}>
            <div className="stack-sm" style={{ alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <div className={`badge dot ${status}`}>
                  {status === 'pauza' ? 'Pauza' : status === 'zavrseno' ? 'Završeno' : 'U izradi'}
                </div>
                <select className="input" value={status} onChange={e=>setStatus(e.target.value as Status)}>
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
              <button type="button" className="btn" onClick={addTask}>Dodaj korak</button>
            </div>
            <div className="grid-auto">
              {tasks.map(t => (
                <div key={t.id} className={`task ${t.done ? 'done' : ''}`}>
                  <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} />
                  <div style={{ flex: 1 }}>{t.title || '(bez naziva)'}</div>
                  <span className="kv">{fmt(t.createdAt)}</span>
                  <button type="button" className="btn ghost" onClick={()=>deleteTask(t.id)}>🗑️</button>
                </div>
              ))}
            </div>
          </section>

          {/* Novi update */}
          <section className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>🖊️ Novi korak / update</h3>
            <div className="stack-sm" style={{ margin: '8px 0' }}>
              <select className="input" value={selTaskId} onChange={e=>setSelTaskId(e.target.value)}>
                <option value="">(nevezano za korak)</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.title || '(bez naziva)'}</option>)}
              </select>
              <input className="input" placeholder="Opis / napomena (neobavezno)" value={note} onChange={e=>setNote(e.target.value)} />
            </div>
            <input id="files" type="file" accept="image/*" multiple onChange={e=>setFiles(e.target.files)} />
            <div style={{ marginTop: 10, display:'flex', gap:8, flexWrap:'wrap' }}>
              <button type="button" className="btn" disabled={busy} onClick={addUpdate}>Sačuvaj update</button>
            </div>
            {msg && <div style={{ marginTop: 10, color: '#22c55e' }}>{msg}</div>}
            {err && <div style={{ marginTop: 10, color: '#ef4444' }}>{err}</div>}
          </section>

          {/* Pregled i brisanje update-a */}
          <UpdatesList productId={selId} onDelete={deleteUpdate} />
        </>
      )}
    </div>
  )
}

function UpdatesList({ productId, onDelete }:{productId:string; onDelete:(id:string)=>void}) {
  const [updates, setUpdates] = useState<Update[]>([])
  useEffect(()=>{
    const uq = query(collection(db,'products',productId,'updates'), orderBy('createdAt','desc'))
    const unsub = onSnapshot(uq, s=> setUpdates(s.docs.map(d=>({id:d.id, ...(d.data() as any)}))))
    return ()=>unsub()
  }, [productId])

  return (
    <section className="card">
      <h3 style={{marginTop:0}}>🧱 Dnevnik koraka</h3>
      {updates.length===0 && <div className="empty">Još nema unosa.</div>}
      <div style={{display:'grid', gap:12}}>
        {updates.map(u=>(
          <article key={u.id} className="card" style={{boxShadow:'none'}}>
            <div style={{whiteSpace:'pre-wrap'}}>{u.note || '(bez opisa)'}</div>
            {!!u.images?.length && (
              <div className="gallery" style={{marginTop:8}}>
                {u.images!.map((url,i)=>(
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img className="img" src={url} alt={`img-${i}`} />
                  </a>
                ))}
              </div>
            )}
            <div style={{
              display:'flex',justifyContent:'space-between',alignItems:'center',
              marginTop:10,paddingTop:8,borderTop:'1px solid #1f2937',fontSize:12,opacity:.8
            }}>
              <span>Autor: {u.author || '—'}</span>
              <span>Postavljeno: {fmt(u.createdAt)}</span>
            </div>
            <div style={{marginTop:8}}>
              <button type="button" className="btn ghost" onClick={()=>onDelete(u.id)}>🗑️ Obriši update</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}