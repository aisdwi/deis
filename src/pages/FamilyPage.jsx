import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Crown, MailPlus, UsersRound } from "lucide-react";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { Button, EmptyState, Modal, Notice, PageHeading } from "../ui";

export function FamilyPage() {
  const { pocketId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [pocket, setPocket] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [sending, setSending] = useState(false);

  const loadFamily = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const pocketSnap = await getDoc(doc(db, "pockets", pocketId));
      if (!pocketSnap.exists() || pocketSnap.data().type !== "family") {
        setError("Pocket keluarga ini tidak ditemukan.");
        setPocket(null);
        return;
      }
      const pocketData = { id: pocketSnap.id, ...pocketSnap.data() };
      setPocket(pocketData);
      const memberQuery = query(collection(db, "pocketMembers"), where("pocketId", "==", pocketId));
      const memberSnap = await getDocs(memberQuery);
      setMembers(memberSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch {
      setError("Pocket keluarga belum bisa dimuat. Periksa izin akses lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [pocketId]);

  useEffect(() => { loadFamily(); }, [loadFamily]);

  const isOwner = pocket?.ownerId === user.uid;
  async function sendInvite(event) {
    event.preventDefault();
    setSending(true);
    setInviteError("");
    setInviteMessage("");
    try {
      await addDoc(collection(db, "familyInvites"), {
        pocketId,
        email: inviteEmail.trim().toLowerCase(),
        invitedBy: user.uid,
        role: inviteRole,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setInviteMessage("Undangan sudah dikirim. Penerima bisa melihatnya setelah masuk ke akun Finote.");
      setInviteEmail("");
    } catch {
      setInviteError("Undangan belum berhasil dikirim. Pastikan kamu pemilik pocket dan rules terbaru sudah dipublikasikan.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="page-loading"><span className="spinner" /> Menyiapkan pocket keluarga…</div>;
  if (!pocket) return <><Link className="back-link" to="/dashboard"><ArrowLeft size={16} /> Dashboard</Link><Notice tone="error">{error}</Notice></>;

  return <>
    <Link className="back-link" to="/dashboard"><ArrowLeft size={16} /> Semua pocket</Link>
    <PageHeading
      eyebrow="POCKET KELUARGA"
      title={pocket.name}
      description="Catatan bersama, dengan akses untuk tiap anggota."
      action={<Button onClick={() => navigate(`/transactions/${encodeURIComponent(pocketId)}`)}><span>Lihat transaksi</span><ArrowRight size={16} /></Button>}
    />
    <Notice tone="error">{error}</Notice>

    <section className="panel member-panel">
      <div className="section-title-row member-title"><div><div className="eyebrow">RUANG BERSAMA</div><h2>Anggota <span className="count-pill">{members.length}</span></h2><p>Hanya anggota pocket yang dapat melihat catatan di sini.</p></div>
        {isOwner && <Button variant="secondary" onClick={() => { setInviteError(""); setInviteMessage(""); setShowInvite(true); }}><MailPlus size={17} /> Undang anggota</Button>}
      </div>
      {!members.length ? <EmptyState icon={<UsersRound size={22} />} title="Belum ada anggota" /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Nama</th><th>Peran</th><th>Status</th></tr></thead><tbody>
        {members.map((member) => {
          const name = member.displayName || (member.userId === user.uid ? profile?.name : "") || "Nama belum tersedia";
          const owner = member.userId === pocket.ownerId || member.role === "owner";
          return <tr key={member.id}><td data-label="Nama"><div className="member-identity"><span className={`avatar ${owner ? "avatar-owner" : ""}`}>{name.slice(0, 1).toUpperCase()}</span><span><strong>{name}</strong>{member.userId === user.uid && <small>Kamu</small>}</span></div></td><td data-label="Peran"><span className={`role-label ${owner ? "role-owner" : ""}`}>{owner ? <><Crown size={14} /> Owner</> : member.role === "viewer" ? "Viewer" : "Member"}</span></td><td data-label="Status"><span className="status-dot">Aktif</span></td></tr>;
        })}
      </tbody></table></div>}
    </section>

    {showInvite && <Modal title="Undang ke pocket" description="Undangan hanya bisa diterima oleh akun dengan email yang sama." onClose={() => !sending && setShowInvite(false)}>
      <form className="form-stack" onSubmit={sendInvite}>
        <Notice tone="error">{inviteError}</Notice><Notice tone="success">{inviteMessage}</Notice>
        <label className="field"><span>Email penerima</span><input type="email" autoComplete="email" autoCapitalize="none" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="nama@email.com" required /></label>
        <label className="field"><span>Hak akses</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="member">Member · bisa mencatat</option><option value="viewer">Viewer · hanya melihat</option></select></label>
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setShowInvite(false)} disabled={sending}>Tutup</Button><Button type="submit" disabled={sending}>{sending ? "Mengirim…" : "Kirim undangan"}</Button></div>
      </form>
    </Modal>}
  </>;
}
