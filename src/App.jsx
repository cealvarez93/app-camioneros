import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from './api.js';
import { brand } from './brand.js';
import { buildQrPayload } from './qr.js';
import { formatRut, iniciales } from './format.js';
import { ArrowIcon, BoxIcon, BuildingIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon, FlagIcon, IdCardIcon, InfoIcon, MailIcon, MapPinIcon, NavigationIcon, PhoneIcon, QrIcon, RefreshIcon, StackIcon, SwapIcon, TruckIcon, UserCircleIcon, UserIcon, WheelIcon } from './icons.jsx';
import { Button, Card, Field, PasswordField, SectionCard, Shell } from './ui.jsx';
import hero from './assets/bg3.jpg';

const PALLETS = Array.from({ length: 30 }, (_, i) => String(i + 1));
const SESSION = 'logistic.session';
const load = () => { try { return JSON.parse(localStorage.getItem(SESSION)); } catch { return null; } };

function Login({ onLogin, onAbout }) {
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
    <Shell variant="light" top={false}>
      <div className="badge"><TruckIcon />{brand.appName}</div>
      <p className="tagline">{brand.tagline}</p>
      <Card>
        <form onSubmit={submit} className="stack">
          <Field label="Usuario" icon={UserIcon} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" placeholder="Ingresa tu ID de usuario" required />
          <PasswordField label="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" placeholder="••••••••••••" required />
          {err && <p className="msg msg--error" role="alert">{err}</p>}
          <Button type="submit" icon={ArrowIcon}>Acceso</Button>
        </form>
      </Card>
      <button className="link-btn" onClick={onAbout}>Acerca de</button>
    </Shell>
  );
}

function Home({ session, go, logout }) {
  const [trip, setTrip] = useState(null);
  const [wait, setWait] = useState(null);
  useEffect(() => {
    api.trip(session.driverId).then(setTrip).catch(() => {});
    api.queue().then((c) => setWait((c?.QuantityTrucks ?? 0) * (c?.Minutesxtruck ?? 0))).catch(() => {});
  }, [session.driverId]);
  return (
    <Shell onLogout={logout}>
      <section className="hero" style={{ '--hero-image': `url(${hero})` }}>
        <div className="hero__top">
          {trip && <span className="chip chip--ok"><span className="chip__dot" />Viaje registrado</span>}
          {trip && <span className="chip chip--mono">{trip.Truck}</span>}
        </div>
        <div>
          <p className="hero__label">{trip ? 'Ruta asignada' : 'Viaje'}</p>
          <h2 className="hero__route">{trip ? `${trip.Origin} → ${trip.Destination}` : 'Registra tu viaje para generar el QR'}</h2>
          {trip && <div className="hero__meta"><span>Remolque {trip.Trailer}</span><span>{trip.Pallet} pallets</span><span>{trip.OperaPon}</span></div>}
        </div>
      </section>
      <div className="section-head"><h2>Operaciones rápidas</h2></div>
      <div className="actions">
        <button className="action action--primary" onClick={() => go('trip')}>
          <TruckIcon className="action__icon" />
          <span className="action__grow"><span className="action__title">{trip ? 'Actualizar viaje' : 'Iniciar viaje'}</span><span className="action__hint">Origen, destino y carga</span></span>
          <ChevronRightIcon className="action__go" />
        </button>
        <button className="action" onClick={() => go('profile')}>
          <IdCardIcon className="action__icon" />
          <span><span className="action__title">Perfil conductor</span><span className="action__hint">Tus datos y tu empresa</span></span>
        </button>
        <button className="action action--ok" onClick={() => go('pass')}>
          <QrIcon className="action__icon" />
          <span><span className="action__title">Pase de validación</span><span className="action__hint">{wait === null ? 'Espera y código QR' : `Espera aprox. ${wait} min`}</span></span>
        </button>
      </div>
      <button className="link-btn" onClick={() => go('about')}>Acerca de</button>
    </Shell>
  );
}

function About({ back }) {
  const rows = [
    ['Aplicación', brand.appName, TruckIcon],
    ['Versión', brand.version.replace(/^v/, ''), InfoIcon],
    ['Cliente', brand.clientName, BuildingIcon],
    ['Desarrollado por', brand.partnerName, UserCircleIcon],
  ];
  return (
    <Shell title="Acerca de" titleIcon={InfoIcon} onBack={back}>
      <ul className="list">
        {rows.map(([label, value, Icon]) => (
          <li className="list__row" key={label}>
            <Icon className="list__icon" />
            <div className="list__text"><p className="list__label">{label}</p><p className="list__value">{value}</p></div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function Profile({ session, back }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.profile(session.driverId).then(setP).catch(() => setErr('No se pudo cargar el perfil')); }, [session.driverId]);
  const rows = p ? [
    ['Nombre', p.Drv_Name, UserCircleIcon],
    ['Empresa', p.Drv_Company, BuildingIcon],
    ['RUT', formatRut(p.Drv_UserId), IdCardIcon, true],
    ['Teléfono', p.Drv_Phone, PhoneIcon, true],
    ['Correo electrónico', p.Drv_Mail, MailIcon],
  ] : [];
  return (
    <Shell title="Perfil conductor" titleIcon={IdCardIcon} onBack={back}>
      {err && <p className="msg msg--error">{err}</p>}
      {p && (
        <>
          <section className="identity">
            <div className="avatar" aria-hidden="true">{iniciales(p.Drv_Name)}</div>
            <div>
              <h2 className="identity__name">{p.Drv_Name}</h2>
              <p className="identity__company">{p.Drv_Company}</p>
            </div>
          </section>
          <ul className="list">
            {rows.map(([label, value, Icon, mono]) => (
              <li className="list__row" key={label}>
                <Icon className="list__icon" />
                <div className="list__text">
                  <p className="list__label">{label}</p>
                  <p className={`list__value${mono ? ' list__value--mono' : ''}${value ? '' : ' list__value--empty'}`}>{value || 'Sin registrar'}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
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
  const plate = (k) => (e) => setF({ ...f, [k]: e.target.value.toUpperCase() });
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
  const options = (items, name) => items.map((i) => <option key={i[name]}>{i[name]}</option>);
  return (
    <Shell title="Inicio de viaje" titleIcon={TruckIcon} onBack={back}>
      <SectionCard icon={NavigationIcon} title="Ruta de despacho" hint="Origen y destino">
        <Field as="select" label="Origen" labelIcon={MapPinIcon} tone="ok" required mark value={f.Origin} onChange={set('Origin')}>
          <option value="">Seleccione origen</option>{options(lists.o, 'Loc_Name')}
        </Field>
        <Field as="select" label="Destino" labelIcon={FlagIcon} tone="brand" required mark value={f.Destination} onChange={set('Destination')}>
          <option value="">Seleccione destino</option>{options(lists.d, 'Loc_Name')}
        </Field>
      </SectionCard>
      <SectionCard icon={TruckIcon} title="Equipo y carga" hint="Identificación">
        <div className="grid-2">
          <Field label="Tracto" labelIcon={WheelIcon} mono required mark mark value={f.Truck} onChange={plate('Truck')} placeholder="Ej: ABCD12" autoCapitalize="characters" />
          <Field label="Remolque" labelIcon={BoxIcon} mono required mark mark value={f.Trailer} onChange={plate('Trailer')} placeholder="Ej: ABCD12" autoCapitalize="characters" />
        </div>
        <Field as="select" label="Cantidad de pallets" labelIcon={StackIcon} required mark value={f.Pallet} onChange={set('Pallet')}>
          <option value="">Seleccione cantidad</option>{PALLETS.map((n) => <option key={n}>{n}</option>)}
        </Field>
        <Field as="select" label="Tipo de operación" labelIcon={SwapIcon} required mark value={f.OperaPon} onChange={set('OperaPon')}>
          <option value="">Seleccione operación</option>{options(lists.op, 'Op_Name')}
        </Field>
      </SectionCard>
      {msg && <p className={`msg ${msg.err ? 'msg--error' : 'msg--ok'}`} role="status">{msg.text}</p>}
      <div>
        <Button large iconStart={CheckCircleIcon} onClick={save}>Confirmar viaje</Button>
        <p className="note">Al confirmar, tu QR queda listo para mostrarlo al portero.</p>
      </div>
    </Shell>
  );
}

function Pass({ session, go, back }) {
  const [st, setSt] = useState({ loading: true });
  const cargar = useCallback(async () => {
    setSt((s) => ({ ...s, loading: true }));
    const [trip, queue] = await Promise.allSettled([api.trip(session.driverId), api.queue()]);
    if (trip.status === 'rejected') return setSt({ error: 'No se pudo actualizar el pase' });
    const t = trip.value;
    const q = queue.status === 'fulfilled' ? queue.value : null;
    const qr = t ? await QRCode.toDataURL(buildQrPayload(session.userId, t), { width: 480, margin: 1 }) : '';
    setSt({ trip: t, qr, trucks: q?.QuantityTrucks ?? null, perTruck: q?.Minutesxtruck ?? null });
  }, [session]);
  useEffect(() => { cargar(); }, [cargar]);
  const { trip, qr, trucks, perTruck, error, loading } = st;
  const wait = trucks === null || trucks === undefined ? null : trucks * perTruck;
  const facts = trip ? [['Tracto', trip.Truck, true], ['Remolque', trip.Trailer, true], ['Destino', trip.Destination], ['Carga', `${trip.Pallet} pallets · ${trip.OperaPon}`]] : [];
  return (
    <Shell title="Pase de validación" titleIcon={QrIcon} onBack={back}>
      <SectionCard icon={ClockIcon} title="Tiempo de espera estimado">
        {wait === null ? <p className="msg">{loading ? 'Calculando…' : 'Sin estimación disponible'}</p> : (
          <>
            <div className="metric"><span className="metric__value">{wait}</span><span className="metric__unit">minutos</span></div>
            <p className="note">{trucks} camiones en cola · {perTruck} min por camión</p>
          </>
        )}
      </SectionCard>
      <SectionCard icon={QrIcon} title="Código QR" hint="Válido hoy">
        {error && <p className="msg msg--error">{error}</p>}
        {!error && !loading && !trip && (
          <>
            <p className="msg">Primero registra tu viaje para generar el QR.</p>
            <Button large iconStart={TruckIcon} onClick={() => go('trip')}>Iniciar viaje</Button>
          </>
        )}
        {trip && qr && (
          <>
            <div className="qr-frame"><img src={qr} alt="Código QR del viaje" /><i /><i /><i /><i /></div>
            <p className="qr-caption">Muestra este código al portero.</p>
            <dl className="facts">{facts.map(([k, v, mono]) => <div key={k}><dt>{k}</dt><dd className={mono ? 'facts__mono' : ''}>{v}</dd></div>)}</dl>
          </>
        )}
      </SectionCard>
      <Button variant="secondary" iconStart={RefreshIcon} onClick={cargar} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</Button>
    </Shell>
  );
}

export default function App() {
  const [session, setSession] = useState(load());
  const [screen, setScreen] = useState('home');
  const back = () => setScreen('home');
  if (screen === 'about') return <About back={back} />;
  if (!session) return <Login onLogin={setSession} onAbout={() => setScreen('about')} />;
  const logout = () => { localStorage.removeItem(SESSION); setSession(null); setScreen('home'); };
  if (screen === 'profile') return <Profile session={session} back={back} />;
  if (screen === 'trip') return <Trip session={session} back={back} />;
  if (screen === 'pass') return <Pass session={session} go={setScreen} back={back} />;
  return <Home session={session} go={setScreen} logout={logout} />;
}
