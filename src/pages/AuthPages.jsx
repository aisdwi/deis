import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../AuthContext";
import { Brand, Button, Notice } from "../ui";

function AuthFrame({ title, subtitle, children, footer }) {
  return <main className="auth-page">
    <div className="auth-top"><Link to="/" className="back-home"><ArrowLeft size={17} /> Kembali</Link><Brand to="/" /></div>
    <section className="auth-card">
      <div className="auth-heading"><span className="auth-icon"><CheckCircle2 size={22} /></span><h1>{title}</h1><p>{subtitle}</p></div>
      {children}
      <div className="auth-footer">{footer}</div>
    </section>
    <p className="auth-privacy">Data akunmu hanya digunakan untuk menjalankan Finote.</p>
  </main>;
}

function friendlyAuthError(error) {
  switch (error?.code) {
    case "auth/email-already-in-use": return "Email ini sudah terdaftar. Coba masuk.";
    case "auth/invalid-email": return "Format email belum benar.";
    case "auth/weak-password": return "Gunakan password minimal 6 karakter.";
    case "auth/invalid-credential": return "Email atau password belum cocok.";
    case "auth/network-request-failed": return "Koneksi bermasalah. Coba lagi sebentar.";
    default: return "Belum berhasil. Periksa koneksi lalu coba lagi.";
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await signInWithEmailAndPassword(auth, String(form.get("email")).trim(), String(form.get("password")));
      navigate("/dashboard", { replace: true });
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setBusy(false);
    }
  }

  return <AuthFrame title="Senang melihatmu lagi" subtitle="Masuk untuk melanjutkan catatan keuanganmu."
    footer={<>Belum punya akun? <Link to="/register">Buat akun</Link></>}>
    <form className="form-stack" onSubmit={handleSubmit}>
      <Notice tone="error">{error}</Notice>
      <label className="field"><span>Email</span><span className="input-wrap"><Mail size={17} /><input name="email" type="email" autoComplete="email" placeholder="nama@email.com" required /></span></label>
      <label className="field"><span>Password</span><span className="input-wrap"><LockKeyhole size={17} /><input name="password" type="password" autoComplete="current-password" placeholder="Password" required /></span></label>
      <Button type="submit" size="large" disabled={busy}>{busy ? "Sedang masuk…" : "Masuk"}</Button>
    </form>
  </AuthFrame>;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      await setDoc(doc(db, "users", user.uid), { name, email, createdAt: serverTimestamp() });
      const pocket = await addDoc(collection(db, "pockets"), {
        name: "Personal Pocket", type: "personal", ownerId: user.uid, createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "pocketMembers", `${pocket.id}_${user.uid}`), {
        pocketId: pocket.id, userId: user.uid, displayName: name, role: "owner", joinedAt: serverTimestamp(),
      });
      await refreshProfile();
      navigate("/dashboard", { replace: true });
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setBusy(false);
    }
  }

  return <AuthFrame title="Mulai dengan sederhana" subtitle="Buat akun untuk menyimpan catatanmu dengan aman."
    footer={<>Sudah punya akun? <Link to="/login">Masuk</Link></>}>
    <form className="form-stack" onSubmit={handleSubmit}>
      <Notice tone="error">{error}</Notice>
      <label className="field"><span>Nama</span><span className="input-wrap"><UserRound size={17} /><input name="name" type="text" autoComplete="name" maxLength={100} placeholder="Nama panggilanmu" required /></span></label>
      <label className="field"><span>Email</span><span className="input-wrap"><Mail size={17} /><input name="email" type="email" autoComplete="email" autoCapitalize="none" placeholder="nama@email.com" required /></span></label>
      <label className="field"><span>Password</span><span className="input-wrap"><LockKeyhole size={17} /><input name="password" type="password" autoComplete="new-password" minLength={6} placeholder="Sekurangnya 6 karakter" required /></span></label>
      <Button type="submit" size="large" disabled={busy}>{busy ? "Menyiapkan akun…" : "Buat akun"}</Button>
    </form>
  </AuthFrame>;
}
