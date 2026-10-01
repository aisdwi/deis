import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { ArrowUpRight, House, LogOut, Mail, WalletCards } from "lucide-react";
import { auth } from "./firebase";
import { useAuth } from "./AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { FamilyPage } from "./pages/FamilyPage";
import { InvitationsPage } from "./pages/InvitationsPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { Brand, Button, LoadingScreen } from "./ui";

function ProtectedLayout() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return <LoadingScreen label="Menyiapkan ruang keuanganmu…" />;
  if (!user) return <Navigate to="/login" replace />;

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Brand />
        <p className="nav-caption">RUANG KERJA</p>
        <nav className="side-nav" aria-label="Navigasi utama">
          <NavLink to="/dashboard"><House size={18} /> Ringkasan</NavLink>
          <NavLink to="/invitations"><Mail size={18} /> Undangan</NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-chip">
            <span className="avatar">{(profile?.name || "S").slice(0, 1).toUpperCase()}</span>
            <span className="profile-copy"><strong>{profile?.name || "Pengguna"}</strong><small>Akun pribadi</small></span>
          </div>
          <button className="logout-link" onClick={handleLogout}><LogOut size={17} /> Keluar</button>
        </div>
      </aside>

      <div className="mobile-header"><Brand /><button className="mobile-logout" onClick={handleLogout} aria-label="Keluar"><LogOut size={19} /></button></div>
      <main className="main-content"><Outlet /></main>
      <nav className="mobile-nav" aria-label="Navigasi mobile">
        <NavLink to="/dashboard"><House size={19} /><span>Ringkasan</span></NavLink>
        <NavLink to="/invitations"><Mail size={19} /><span>Undangan</span></NavLink>
      </nav>
    </div>
  );
}

function LandingPage() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen label="Memuat Finote…" />;
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <main className="landing-page">
      <header><Brand to="/" /><Link className="landing-login" to="/login">Masuk <ArrowUpRight size={16} /></Link></header>
      <section className="landing-content">
        <div className="landing-copy">
          <span className="eyebrow"><WalletCards size={15} /> KEUANGAN PRIBADI, LEBIH TERATUR</span>
          <h1>Uangmu, lebih mudah <em>dipahami.</em></h1>
          <p>Catat pemasukan dan pengeluaran, kelola pocket keluarga, dan lihat kebiasaan belanjamu dengan jelas.</p>
          <div className="landing-actions"><Button as={Link} to="/register" size="large">Buat akun</Button><Link className="text-link" to="/login">Sudah punya akun? Masuk</Link></div>
          <small className="privacy-note">Catatan keuangan hanya dapat diakses sesuai izin akun dan pocket.</small>
        </div>
        <div className="landing-art" aria-hidden="true">
          <div className="art-topline"><span>RINGKASAN BULAN INI</span><span className="art-dot" /></div>
          <div className="art-balance"><small>Arus kas bersih</small><strong>Rp 2.450.000</strong><span>↑ Stabil bulan ini</span></div>
          <div className="art-chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="art-legend"><span><b className="legend-income" /> Pemasukan</span><span><b className="legend-expense" /> Pengeluaran</span></div>
          <div className="art-note">Contoh tampilan · bukan data akunmu</div>
        </div>
      </section>
      <footer>Finote <span>·</span> Keuangan yang terasa lebih ringan.</footer>
    </main>
  );
}

function GuestRoute({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen label="Memuat akun…" />;
  return user && profile ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/invitations" element={<InvitationsPage />} />
        <Route path="/family/:pocketId" element={<FamilyPage />} />
        <Route path="/transactions/:pocketId" element={<TransactionsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
