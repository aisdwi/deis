import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Mail, UsersRound } from "lucide-react";
import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { Button, EmptyState, Notice, PageHeading } from "../ui";

export function InvitationsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const inviteQuery = query(collection(db, "familyInvites"), where("email", "==", user.email), where("status", "==", "pending"));
      const snapshot = await getDocs(inviteQuery);
      setInvites(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch {
      setError("Undangan belum bisa dimuat. Pastikan rules mengizinkan akun ini membaca undangannya.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadInvites(); }, [loadInvites]);

  async function respond(invite, accepted) {
    setBusyId(invite.id);
    setError("");
    setMessage("");
    try {
      const batch = writeBatch(db);
      if (accepted) {
        batch.set(doc(db, "pocketMembers", `${invite.pocketId}_${user.uid}`), {
          pocketId: invite.pocketId,
          userId: user.uid,
          displayName: profile?.name?.trim() || "",
          role: invite.role,
          inviteId: invite.id,
          joinedAt: serverTimestamp(),
        });
      }
      batch.update(doc(db, "familyInvites", invite.id), { status: accepted ? "accepted" : "declined" });
      await batch.commit();
      setMessage(accepted ? "Kamu sudah bergabung ke pocket keluarga." : "Undangan ditolak.");
      if (accepted) navigate(`/family/${encodeURIComponent(invite.pocketId)}`);
      else await loadInvites();
    } catch {
      setError("Respons undangan belum berhasil. Periksa bahwa akunmu memakai email yang diundang dan rules terbaru sudah aktif.");
    } finally {
      setBusyId("");
    }
  }

  return <>
    <PageHeading eyebrow="POCKET BERSAMA" title="Undangan" description="Undangan keluarga hanya bisa digunakan oleh alamat email yang dituju." action={<Link className="subtle-link" to="/dashboard">Dashboard <ArrowRight size={15} /></Link>} />
    <Notice tone="error">{error}</Notice><Notice tone="success">{message}</Notice>
    {loading ? <div className="page-loading"><span className="spinner" /> Memeriksa undangan…</div> : invites.length ? <div className="invite-list">
      {invites.map((invite) => <article className="invite-card" key={invite.id}>
        <div className="invite-symbol"><Mail size={21} /></div>
        <div className="invite-copy"><span className="eyebrow">UNDANGAN POCKET</span><h2>Family Pocket</h2><p>Kamu diundang sebagai <strong>{invite.role === "viewer" ? "viewer" : "member"}</strong>. Setelah bergabung, kamu dapat membuka catatan pocket ini.</p></div>
        <div className="invite-actions"><Button disabled={busyId === invite.id} onClick={() => respond(invite, true)}>{busyId === invite.id ? "Memproses…" : "Terima"}</Button><Button variant="quiet" disabled={busyId === invite.id} onClick={() => respond(invite, false)}>Tolak</Button></div>
      </article>)}
    </div> : <EmptyState icon={<UsersRound size={22} />} title="Belum ada undangan" >Kalau ada undangan baru, undangan itu akan muncul di sini.</EmptyState>}
  </>;
}
