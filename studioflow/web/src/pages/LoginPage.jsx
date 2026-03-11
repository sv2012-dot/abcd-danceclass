import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../api';
import { Btn, Input, Field } from '../components/UI';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      signIn(res.data.token, res.data.user);
      navigate(res.data.user.role === 'parent' ? '/parent' : '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const DEMO = [
    { label: 'Super Admin', email: 'admin@studioflow.app', pw: 'Admin123!' },
    { label: 'School Admin', email: 'priya@rhythmgrace.com', pw: 'School123!' },
    { label: 'Teacher', email: 'teacher@rhythmgrace.com', pw: 'Teacher123!' },
    { label: 'Parent', email: 'parent@rhythmgrace.com', pw: 'Parent123!' },
  ];

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'linear-gradient(135deg,#1e1228 0%,#3a1a40 100%)',padding:20}}>
      <div style={{maxWidth:420,width:'100%'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:52,marginBottom:10}}>🩰</div>
          <h1 style={{fontFamily:'var(--font-d)',fontSize:32,color:'#f0e8f8',marginBottom:8}}>StudioFlow</h1>
          <p style={{color:'#9a8aaa',fontSize:14}}>Dance School Management Platform</p>
        </div>

        <div style={{background:'#fff',borderRadius:20,padding:28,boxShadow:'0 24px 60px rgba(0,0,0,0.4)'}}>
          <form onSubmit={handleLogin}>
            <Field label="Email">
              <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
            </Field>
            {error && <p style={{color:'var(--danger)',fontSize:13,marginBottom:14,padding:'9px 13px',background:'#ffeef0',borderRadius:8}}>{error}</p>}
            <Btn type="submit" full disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</Btn>
          </form>

          {/* Demo accounts */}
          <div style={{marginTop:20,paddingTop:18,borderTop:'1px solid var(--border)'}}>
            <p style={{fontSize:11,color:'var(--muted)',fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:10}}>Demo Accounts</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {DEMO.map(d => (
                <button key={d.label} onClick={() => { setEmail(d.email); setPassword(d.pw); }}
                  style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 10px',
                    fontSize:12,cursor:'pointer',color:'var(--text)',fontFamily:'var(--font-b)',textAlign:'left'}}>
                  <div style={{fontWeight:600}}>{d.label}</div>
                  <div style={{color:'var(--muted)',fontSize:11}}>{d.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
