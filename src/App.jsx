import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from './api.js';
import { buildQrPayload } from './qr.js';
import logo from './assets/logo3.png';
import sbi from './assets/sbi.jpg';
import bg from './assets/bg3.jpg';
import iProfile from './assets/profile2.jpg';
import iTruck from './assets/truck3.jpg';
import iQr from './assets/qr1.jpg';
import iClock from './assets/clock1.jpg';

const PALLETS = Array.from({ length: 30 }, (_, i) => i + 1);
const SESSION = 'logistic.session';
const load = () => { try { return JSON.parse(localStorage.getItem(SESSION)); } catch { return null; } };

function Shell({ title, children, onBack }) {
  return (
    <div className="screen">
      <header className="logo"><img src={logo} alt="Coca-Cola Envases Central" /></header>
      {title && <h1 className="pill">{title}</h1>}
      <main>{children}</main>
      <footer>
        <span>Una solución desarrollada por</span>
        <img src={sbi} alt="SBI" />
      </footer>
      {onBack && <button className="back" onClick={onBack} aria-label="Volver">‹</button>}
    </div>
  );
}

function Login({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const d = await api.login(user.trim(), pass);
      if (!d?.Drv_Id) throw new Error('credenciales');
      const s = { driverId: d.Drv_Id, userId: d.Drv_UserId };
      localStorage.setItem(SESSION, JSON.stringify(s));
      onLogin(s);
    } catch {
      setErr('Usuario o contraseña incorrectos');
    }
  };
  return (
    <Shell title="LOGISTIC TRACKING - 1.2">
      <form onSubmit={submit} className="form">
        <label>Usuario<input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" /></label>
        <label>Contraseña<input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="red" type="submit">Acceso</button>
      </form>
    </Shell>
  );
}

function Home({ go, logout }) {
  return (
    <div className="home" style={{ backgroundImage: `url(${bg})` }}>
      <header className="logo"><img src={logo} alt="Coca-Cola Envases Central" /></header>
      <button className="round" style={{ left: '2%', top: '29%' }} onClick={() => go('profile')} aria-label="Perfil conductor"><img src={iProfile} alt="" /></button>
      <button className="round" style={{ left: '42%', top: '22%' }} onClick={() => go('trip')} aria-label="Inicio de viaje"><img src={iTruck} alt="" /></button>
      <button className="round" style={{ left: '14%', top: '41%' }} onClick={() => go('queue')} aria-label="Tiempo de espera"><img src={iClock} alt="" /></button>
      <button className="round" style={{ right: '1%', top: '38%' }} onClick={() => go('qr')} aria-label="Código QR"><img src={iQr} alt="" /></button>
      <footer className="homefoot"><span>Una solución desarrollada por</span><img src={sbi} alt="SBI" /></footer>
      <button className="logout" onClick={logout}>Salir</button>
    </div>
  );
}

function Profile({ session, back }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.profile(session.driverId).then(setP).catch(() => setErr('No se pudo cargar el perfil')); }, [session.driverId]);
  const rows = p ? [['Nombre', p.Drv_Name], ['Empresa', p.Drv_Company], ['RUT', p.Drv_UserId], ['Teléfono', p.Drv_Phone], ['Correo', p.Drv_Mail]] : [];
  return (
    <Shell title="Perfil Conductor" onBack={back}>
      {err && <p className="err">{err}</p>}
      <dl className="profile">{rows.map(([k, v]) => <div key={k}><dd>{v}</dd><dt>{k}</dt></div>)}</dl>
    </Shell>
  );
}

function Trip({ session, back }) {
  const [lists, setLists] = useState({ o: [], d: [], op: [] });
  const [f, setF] = useState({ Origin: '', Destination: '', Truck: localStorage.getItem('logistic.truck') || '', Trailer: localStorage.getItem('logistic.trailer') || '', Pallet: '', OperaPon: '' });
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    Promise.all([api.origenes(), api.destinos(), api.operaciones()]).then(([o, d, op]) => setLists({ o, d, op })).catch(() => setMsg({ err: true, text: 'No se pudieron cargar los listados' }));
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (Object.values(f).some((v) => !v)) return setMsg({ err: true, text: 'Completa todos los campos' });
    try {
      await api.saveTrip({ ...f, Drv_Id: session.driverId });
      localStorage.setItem('logistic.truck', f.Truck);
      localStorage.setItem('logistic.trailer', f.Trailer);
      setMsg({ text: '¡Los detalles del viaje se guardaron correctamente!' });
    } catch {
      setMsg({ err: true, text: 'No se pudieron guardar los detalles del viaje.' });
    }
  };
  const sel = (k, items, name) => (
    <select value={f[k]} onChange={set(k)}><option value="">Seleccione</option>{items.map((i) => <option key={i[name]}>{i[name]}</option>)}</select>
  );
  return (
    <Shell title="Inicio de Viaje" onBack={back}>
      <div className="form grid">
        <label>Origen :{sel('Origin', lists.o, 'Loc_Name')}</label>
        <label>Destino :{sel('Destination', lists.d, 'Loc_Name')}</label>
        <label>Tracto :<input value={f.Truck} onChange={(e) => setF({ ...f, Truck: e.target.value.toUpperCase() })} /></label>
        <label>Remolque :<input value={f.Trailer} onChange={(e) => setF({ ...f, Trailer: e.target.value.toUpperCase() })} /></label>
        <label>Pallet :<select value={f.Pallet} onChange={set('Pallet')}><option value="">Select a number</option>{PALLETS.map((n) => <option key={n}>{n}</option>)}</select></label>
        <label>Operación :{sel('OperaPon', lists.op, 'Op_Name')}</label>
        {msg && <p className={msg.err ? 'err' : 'ok'} role="status">{msg.text}</p>}
        <button className="red" onClick={save}>CONFIRMAR</button>
      </div>
    </Shell>
  );
}

function Queue({ back }) {
  const [min, setMin] = useState(null);
  useEffect(() => { api.queue().then((c) => setMin((c?.QuantityTrucks ?? 0) * (c?.Minutesxtruck ?? 0))).catch(() => setMin(-1)); }, []);
  const text = min === null ? 'Calculando…' : min < 0 ? 'No se pudo obtener el tiempo de espera' : `Su tiempo de espera aproximado es de ${min} minutos`;
  return <Shell title="Tiempo de espera" onBack={back}><p className="queue">{text}</p></Shell>;
}

function Qr({ session, back }) {
  const [img, setImg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const trip = await api.trip(session.driverId);
        if (!trip) return setErr('Primero registra tu viaje');
        setImg(await QRCode.toDataURL(buildQrPayload(session.userId, trip), { width: 480, margin: 2 }));
      } catch { setErr('No se pudo generar el QR'); }
    })();
  }, [session]);
  return (
    <Shell title="Cree codigo QR" onBack={back}>
      {err ? <p className="err">{err}</p> : img && <img className="qr" src={img} alt="Código QR del viaje" />}
    </Shell>
  );
}

export default function App() {
  const [session, setSession] = useState(load());
  const [screen, setScreen] = useState('home');
  const back = () => setScreen('home');
  if (!session) return <Login onLogin={setSession} />;
  const logout = () => { localStorage.removeItem(SESSION); setSession(null); setScreen('home'); };
  if (screen === 'profile') return <Profile session={session} back={back} />;
  if (screen === 'trip') return <Trip session={session} back={back} />;
  if (screen === 'queue') return <Queue back={back} />;
  if (screen === 'qr') return <Qr session={session} back={back} />;
  return <Home go={setScreen} logout={logout} />;
}
