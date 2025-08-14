import { useEffect, useMemo, useState } from 'react'
import { db } from '../../firebase'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'

type Status = 'u_izradi' | 'pauza' | 'zavrseno'
type Product = { id: string; name?: string; note?: string; status?: Status; createdAt?: any }
type Task    = { id: string; title?: string; order: number; done: boolean; createdAt?: any }
type Update  = { id: string; taskId?: string; note?: string; images?: string[]; createdAt?: any; author?: string }

function fmt(ts?: any){
  try { return ts?.toDate ? ts.toDate().toLocaleString() : '' } catch { return '' }
}

export default function PublicView(){
  const [products, setProducts] = useState<Product[]>([])
  const [selId, setSelId] = useState<string>('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [updates, setUpdates] = useState<Update[]>([])

  // Učitaj proizvode (najnoviji prvi)
  useEffect(()=>{
    const q = query(collection(db,'products'), orderBy('createdAt','desc'))
    const unsub = onSnapshot(q, snap=>{
      const list: Product[] = snap.docs.map(d=>({id:d.id, ...(d.data() as any)}))
      setProducts(list)
      if (!selId && list.length) setSelId(list[0].id)
    })
    return ()=>unsub()
  }, [selId])

  // Učitaj taskove i update-e za izabrani proizvod
  useEffect(()=>{
    if (!selId){ setTasks([]); setUpdates([]); return }
    const tq = query(collection(db,'products',selId,'tasks'), orderBy('order','asc'))
    const uq = query(collection(db,'products',selId,'updates'), orderBy('createdAt','desc'))
    const un1 = onSnapshot(tq, s=> setTasks(s.docs.map(d=>({id:d.id, ...(d.data() as any)}))))
    const un2 = onSnapshot(uq, s=> setUpdates(s.docs.map(d=>({id:d.id, ...(d.data() as any)}))))
    return ()=>{ un1(); un2() }
  }, [selId])

  const selected = useMemo(()=> products.find(p=>p.id===selId) || null, [products, selId])

  const progress = useMemo(()=>{
    if (!tasks.length) return 0
    const done = tasks.filter(t=>t.done).length
    return Math.round(done / tasks.length * 100)
  }, [tasks])

  return (
    <div className="app-wrap">
      <h1>👁️ Javni prikaz</h1>

      {/* Izbor proizvoda */}
      <div className="stack-sm" style={{alignItems:'center', margin:'12px 0'}}>
        <span className="kv" style={{minWidth:90}}>Proizvod:</span>
        <select className="input" value={selId} onChange={e=>setSelId(e.target.value)}>
          {products.map(p => <option key={p.id} value={p.id}>{p.name || '(bez naziva)'}</option>)}
        </select>
      </div>

      {!selected ? (
        <div className="empty">Nema proizvoda.</div>
      ) : (
        <>
          {/* Status + Progress */}
          <section className="card" style={{marginBottom:16}}>
            <div className="stack-sm" style={{alignItems:'center', justifyContent:'space-between'}}>
              <div className={`badge dot ${selected.status || 'u_izradi'}`}>
                {selected.status === 'pauza' ? 'Pauza'
                  : selected.status === 'zavrseno' ? 'Završeno' : 'U izradi'}
              </div>
              <div className="kv">Kreirano: {fmt(selected.createdAt)}</div>
            </div>
            <div style={{marginTop:10}}>
              <div className="progress"><div style={{width:`${progress}%`}} /></div>
              <div className="kv" style={{marginTop:6}}>
                Progres: <b>{progress}%</b> ({tasks.filter(t=>t.done).length}/{tasks.length})
              </div>
            </div>

            {/* Napomena o proizvodu (ako postoji) */}
            {!!selected.note && (
              <div className="card" style={{marginTop:12, boxShadow:'none'}}>
                <div className="kv" style={{marginBottom:6}}>Napomena</div>
                <div style={{whiteSpace:'pre-wrap'}}>{selected.note}</div>
              </div>
            )}
          </section>

          {/* To-Do koraci (read-only) */}
          <section className="card" style={{marginBottom:16}}>
            <h3 style={{marginTop:0}}>✅ Koraci (To-Do)</h3>
            {tasks.length===0 && <div className="empty">Još nema definisanih koraka.</div>}
            <div className="grid-auto">
              {tasks.map(t=>(
                <div key={t.id} className={`task ${t.done?'done':''}`}>
                  <input type="checkbox" checked={t.done} readOnly />
                  <div style={{flex:1}}>{t.title || '(bez naziva)'}</div>
                  <span className="kv">{fmt(t.createdAt)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Dnevnik koraka (updates) */}
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
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
