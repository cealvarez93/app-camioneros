import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from './api.js';
import { brand } from './brand.js';
import { buildQrPayload } from './qr.js';
import { formatRut, iniciales } from './format.js';
import { ArrowIcon, BoxIcon, HomeIcon, LogoutIcon, BuildingIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon, FlagIcon, IdCardIcon, InfoIcon, MailIcon, MapPinIcon, NavigationIcon, PhoneIcon, QrIcon, RefreshIcon, StackIcon, SwapIcon, TruckIcon, UserCircleIcon, UserIcon, WheelIcon } from './icons.jsx';
import { Button, Card, Field, MenuContext, PasswordField, SectionCard, Shell } from './ui.jsx';
import hero from './assets/bg3.jpg';

const PALLETS = Array.from({ length: 30 }, (_, i) => String(i + 1));
const SESSION = 'logistic.session';
const load = () => { try { return JSON.parse(localStorage.getItem(SESSION)); } catch { return null; } };

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
    <Shell top={false}>
      <div className="badge"><TruckIcon />{brand.appName}</div>
      <Card>
        <form onSubmit={submit} className="stack">
          <Field label="Usuario" icon={UserIcon} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" placeholder="Ingresa tu ID de usuario" required />
          <PasswordField label="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" placeholder="••••••••••••" required />
          {err && <p className="msg msg--error" role="alert">{err}</p>}
          <Button type="submit" icon={ArrowIcon}>Acceso</Button>
        </form>
      </Card>
    </Shell>
  );
}

function Home({ session, go }) {
  const [trip, setTrip] = useState(null);
  const [wait, setWait] = useState(null);
  useEffect(() => {
    api.trip(session.driverId).then(setTrip).catch(() => {});
    api.queue().then((c) => setWait((c?.QuantityTrucks ?? 0) * (c?.Minutesxtruck ?? 0))).catch(() => {});
  }, [session.driverId]);
  return (
    <Shell>
      <section className="hero hero--fill" style={{ '--hero-image': `url(${hero})` }}>
        <div>
          {trip && (
            <div className="status-card">
              <MapPinIcon className="status-card__icon" />
              <span className="status-card__route">{trip.Origin} → {trip.Destination}</span>
              <span className="chip chip--mono">{trip.Truck}</span>
            </div>
          )}
        </div>
        <div className="actions">
          <button className="action action--primary" onClick={() => go('trip')}>
            <TruckIcon className="action__icon" />
            <span className="action__grow"><span className="action__title">{trip ? 'Actualizar viaje' : 'Iniciar viaje'}</span></span>
            <span className="action__go"><ChevronRightIcon /></span>
          </button>
          <button className="action" onClick={() => go('profile')}>
            <span className="action__top"><IdCardIcon className="action__icon" /></span>
            <span className="action__title">Perfil conductor</span>
          </button>
          <button className="action action--ok" onClick={() => go('pass')}>
            <span className="action__top"><QrIcon className="action__icon" />{wait !== null && <span className="chip chip--ok">{wait} min</span>}</span>
            <span className="action__title">Pase de validación</span>
          </button>
        </div>
      </section>
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
      <SectionCard icon={NavigationIcon} title="Ruta de despacho">
        <Field as="select" label="Origen" labelIcon={MapPinIcon} tone="ok" required mark value={f.Origin} onChange={set('Origin')}>
          <option value="">Seleccione origen</option>{options(lists.o, 'Loc_Name')}
        </Field>
        <Field as="select" label="Destino" labelIcon={FlagIcon} tone="brand" required mark value={f.Destination} onChange={set('Destination')}>
          <option value="">Seleccione destino</option>{options(lists.d, 'Loc_Name')}
        </Field>
      </SectionCard>
      <SectionCard icon={TruckIcon} title="Equipo y carga">
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
      <Button large iconStart={CheckCircleIcon} onClick={save}>Confirmar viaje</Button>
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
        {wait === null
          ? <p className="msg">{loading ? 'Calculando…' : 'Sin estimación disponible'}</p>
          : <div className="metric"><span className="metric__value">{wait}</span><span className="metric__unit">minutos</span></div>}
      </SectionCard>
      <SectionCard icon={QrIcon} title="Código QR">
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
            <dl className="facts">{facts.map(([k, v, mono]) => <div key={k}><dt>{k}</dt><dd className={mono ? 'facts__mono' : ''}>{v}</dd></div>)}</dl>
          </>
        )}
      </SectionCard>
      <Button variant="secondary" iconStart={RefreshIcon} onClick={cargar} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</Button>
    </Shell>
  );
}

// La navegación usa el historial del navegador: el botón atrás (de la app, del navegador o de Android) vuelve a la pantalla anterior.
export default function App() {
  const [session, setSession] = useState(load());
  const [screen, setScreen] = useState(() => window.history.state?.screen ?? 'home');
  useEffect(() => {
    window.history.replaceState({ screen }, '');
    const onPop = (e) => setScreen(e.state?.screen ?? 'home');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (s) => { window.history.pushState({ screen: s }, ''); setScreen(s); };
  const back = () => (window.history.state?.screen && window.history.state.screen !== 'home' ? window.history.back() : setScreen('home'));
  const logout = () => { localStorage.removeItem(SESSION); setSession(null); window.history.replaceState({ screen: 'home' }, ''); setScreen('home'); };
  const menu = [
    { label: 'Inicio', icon: HomeIcon, current: screen === 'home', onClick: () => screen !== 'home' && go('home') },
    { label: 'Viaje', icon: TruckIcon, current: screen === 'trip', onClick: () => go('trip') },
    { label: 'Perfil conductor', icon: IdCardIcon, current: screen === 'profile', onClick: () => go('profile') },
    { label: 'Pase de validación', icon: QrIcon, current: screen === 'pass', onClick: () => go('pass') },
    { label: 'Acerca de', icon: InfoIcon, current: screen === 'about', onClick: () => go('about') },
    { label: 'Cerrar sesión', icon: LogoutIcon, danger: true, separated: true, onClick: logout },
  ];
  const view = (() => {
    if (screen === 'about') return <About back={back} />;
    if (!session) return <Login onLogin={setSession} />;
    if (screen === 'profile') return <Profile session={session} back={back} />;
    if (screen === 'trip') return <Trip session={session} back={back} />;
    if (screen === 'pass') return <Pass session={session} go={go} back={back} />;
    return <Home session={session} go={go} />;
  })();
  const publicMenu = menu.filter((it) => it.label === 'Acerca de');
  return <MenuContext.Provider value={session ? menu : publicMenu}>{view}</MenuContext.Provider>;
}
