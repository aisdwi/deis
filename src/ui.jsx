import { Link } from "react-router-dom";
import { WalletCards } from "lucide-react";

export function Brand({ to = "/dashboard" }) {
  return <Link to={to} className="brand"><span className="brand-mark"><WalletCards size={19} /></span><span>finote</span></Link>;
}

export function Button({ as: Component = "button", variant = "primary", size, className = "", children, ...props }) {
  const classes = ["button", `button-${variant}`, size ? `button-${size}` : "", className].filter(Boolean).join(" ");
  return <Component className={classes} {...props}>{children}</Component>;
}

export function LoadingScreen({ label = "Memuat…" }) {
  return <div className="loading-screen"><span className="loader-mark"><WalletCards size={22} /></span><p>{label}</p></div>;
}

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>;
}

export function EmptyState({ icon, title, children, action }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}

export function Notice({ children, tone = "info" }) {
  if (!children) return null;
  return <div className={`notice notice-${tone}`} role="status">{children}</div>;
}

export function Modal({ title, description, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup">×</button>
      <div className="eyebrow">FINOTE</div><h2 id="modal-title">{title}</h2>{description && <p className="modal-description">{description}</p>}
      {children}
    </section>
  </div>;
}

export function Money({ value, className = "" }) {
  return <span className={className}>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0)}</span>;
}

export function getLocalDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
