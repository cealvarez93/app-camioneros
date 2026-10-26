// Componentes de interfaz. Solo clases del tema (src/theme); textos de marca desde brand.js.
import { createContext, useContext, useEffect, useId, useState } from 'react';
import { brand } from './brand.js';
import { ChevronDownIcon, ChevronLeftIcon, EyeIcon, EyeOffIcon, LockIcon } from './icons.jsx';
import logo from './assets/logo3.png';
import partner from './assets/sbi.jpg';

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function OnlineChip() {
  const online = useOnline();
  return <span className={`chip${online ? ' chip--ok' : ''}`}><span className="chip__dot" />{online ? 'En línea' : 'Sin conexión'}</span>;
}

export function AppFooter() {
  return (
    <footer className="app-footer">
      <span className="app-footer__label">{brand.partnerLabel}</span>
      <span className="app-footer__chip"><img src={partner} alt={brand.partnerName} /></span>
    </footer>
  );
}

export const MenuContext = createContext([]);

function MenuButton() {
  const items = useContext(MenuContext);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!items.length) return null;
  return (
    <div className="menu">
      <button className="menu__btn" aria-label="Abrir menú" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span /><span /><span />
      </button>
      {open && (
        <>
          <div className="menu__backdrop" onClick={() => setOpen(false)} />
          <div className="menu__panel" role="menu">
            {items.map((it) => (
              <div key={it.label} className={it.separated ? 'menu__sep' : undefined}>
                <button role="menuitem" className={`menu__item${it.danger ? ' menu__item--danger' : ''}`} aria-current={it.current ? 'page' : undefined} onClick={() => { setOpen(false); it.onClick(); }}>
                  <it.icon />{it.label}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// variant "light": header blanco con logo centrado (login). "dark": header delgado con logo, estado y menú, más barra de pantalla.
export function Shell({ variant = 'dark', title, titleIcon: TitleIcon, onBack, top = true, children }) {
  return (
    <div className={`app${top ? ' app--top' : ''}`}>
      {variant === 'light' ? (
        <header className="app-header"><img src={logo} alt={brand.clientName} /></header>
      ) : (
        <header className="app-header app-header--dark">
          <div className="app-header__row">
            <span className="app-header__logo"><img src={logo} alt={brand.clientName} /></span>
            <div className="app-header__end"><OnlineChip /><MenuButton /></div>
          </div>
          {title && (
            <div className="screen-bar">
              <button className="icon-btn" onClick={onBack} aria-label="Volver"><ChevronLeftIcon /></button>
              <div className="title-badge">{TitleIcon && <TitleIcon />}<h1>{title}</h1></div>
              <span className="screen-bar__spacer" />
            </div>
          )}
        </header>
      )}
      <main className="app__main">{children}</main>
      <AppFooter />
    </div>
  );
}

export const Card = ({ className = '', ...p }) => <section className={`card ${className}`} {...p} />;

export function SectionCard({ icon: Icon, title, children }) {
  return (
    <section className="card card--section">
      <div className="card__head">
        <h2 className="card__title">{Icon && <Icon />}{title}</h2>
      </div>
      {children}
    </section>
  );
}

// icon: ícono dentro del campo (login). labelIcon: ícono junto a la etiqueta (formularios). tone: ok | brand.
export function Field({ label, icon: Icon, labelIcon: LabelIcon, tone, required, mark, mono, as: Control = 'input', action, children, ...props }) {
  const id = useId();
  const cls = ['field__input', Icon ? '' : 'field__input--plain', mono ? 'field__input--mono' : ''].filter(Boolean).join(' ');
  return (
    <div className={`field${action ? ' field--has-action' : ''}`}>
      <label className={`field__label${tone ? ` field__label--${tone}` : ''}`} htmlFor={id}>
        {LabelIcon && <LabelIcon />}{label}{mark && <span className="field__required" aria-hidden="true">*</span>}
      </label>
      <div className="field__control">
        {Icon && <Icon className="field__icon" />}
        <Control id={id} className={cls} required={required} {...props}>{children}</Control>
        {Control === 'select' && <ChevronDownIcon className="field__chevron" />}
        {action}
      </div>
    </div>
  );
}

export function PasswordField(props) {
  const [visible, setVisible] = useState(false);
  return (
    <Field {...props} type={visible ? 'text' : 'password'} icon={LockIcon}
      action={<button type="button" className="field__action" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{visible ? <EyeOffIcon /> : <EyeIcon />}</button>} />
  );
}

export function Button({ icon: Icon, iconStart: IconStart, large, variant, children, ...props }) {
  return <button className={`btn${large ? ' btn--lg' : ''}${variant ? ` btn--${variant}` : ''}`} {...props}>{IconStart && <IconStart />}<span>{children}</span>{Icon && <Icon />}</button>;
}
