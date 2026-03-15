import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email:'', password:'' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  if (user) { navigate('/'); return null; }

  const handle = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(form.email, form.password);
      toast.success(`Welcome back, ${u.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.error || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#1e1228 0%,#3a1a40 100%)',padding:20}}>
      <div style={{width:'100%',maxWidth:420}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:52,marginBottom:10}}>🩰</div>
          <h1 style={{fontFamily:'var(--font-d)',fontSize:30,color:'#f0e8f8',marginBottom:6}}>StudioFlow</h1>
          <p style={{color:'#9a8aaa',fontSize:14}}>Dance School Management</p>
        </div>
        <div style={{background:'#fff',borderRadius:20,padding:28,boxShadow:'0 24px 60px rgba(0,0,0,0.4)'}}>
          <h2 style={{fontFamily:'var(--font-d)',fontSize:20,marginBottom:20,color:'var(--text)'}}>Sign In</h2>
          <form onSubmit={handle}>
            <div style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:'var(--muted)',marginBottom:5}}>Email</label>
              <input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" style={{width:'100%',background:'#faf8fc',border:'1.5px solid var(--border)',borderRadius:9,padding:'9px 13px',fontSize:14,color:'var(--text)'}} />
            </div>
            <div style={{marginBottom:20}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:'var(--muted)',marginBottom:5}}>Password</label>
              <div style={{position:'relative'}}>
                <input type={showPw ? 'text' : 'password'} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} style={{width:'100%',background:'#faf8fc',border:'1.5px solid var(--border)',borderRadius:9,padding:'9px 40px 9px 13px',fontSize:14,color:'var(--text)',boxSizing:'border-box'}} />
                <button type="button" onClick={()=>setShowPw(p=>!p)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:0,color:'var(--muted)',display:'flex',alignItems:'center'}}>
                  {showPw
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{width:'100%',padding:'11px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer',opacity:loading?.6:1}}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>
          <div style={{marginTop:20,padding:14,background:'#f8f4f9',borderRadius:10,fontSize:12,color:'var(--muted)'}}>
            <div style={{fontWeight:700,marginBottom:6}}>Demo accounts:</div>
            <div>admin@studioflow.app / ChangeMe123!</div>
            <div>sv@gmail.com / School123!</div>
            <div>parent@rhythmgrace.com / Parent123!</div>
          </div>
        </div>
      </div>
    </div>
  );
}