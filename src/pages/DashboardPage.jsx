import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Trash2, UsersRound, Wallet } from "lucide-react";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { Button, EmptyState, Modal, Notice, PageHeading } from "../ui";

export function DashboardPage() {
  const { user, profile } = useAuth();
  const [personal, setPersonal] = useState([]);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [createError, setCreateError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const loadPockets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setPageError("");
    try {
      const personalQuery = query(collection(db, "pockets"), where("ownerId", "==", user.uid), where("type", "==", "personal"));
      const ownedFamiliesQuery = query(collection(db, "pockets"), where("ownerId", "==", user.uid), where("type", "==", "family"));
      const membershipQuery = query(collection(db, "pocketMembers"), where("userId", "==", user.uid));
      const [personalSnap, ownedSnap, memberSnap] = await Promise.all([
        getDocs(personalQuery), getDocs(ownedFamiliesQuery), getDocs(membershipQuery),
      ]);

      const familyMap = new Map(ownedSnap.docs.map((item) => [item.id, { id: item.id, ...item.data() }]));
      const linkedPocketIds = [...new Set(memberSnap.docs.map((item) => item.data().pocketId).filter(Boolean))];
      await Promise.all(linkedPocketIds.map(async (pocketId) => {
        if (familyMap.has(pocketId)) return;
        try {
          const pocketSnap = await getDoc(doc(db, "pockets", pocketId));
          if (pocketSnap.exists() && pocketSnap.data().type === "family") {
            familyMap.set(pocketId, { id: pocketId, ...pocketSnap.data() });
          }
        } catch {
          // A stale or inaccessible membership should not hide other pockets.
        }
      }));
      setPersonal(personalSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
      setFamilies([...familyMap.values()]);
    } catch {
      setPageError("Pocket belum bisa dimuat. Coba muat ulang halaman.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadPockets(); }, [loadPockets]);

  async function createFamily(event) {
    event.preventDefault();
    if (!familyName.trim()) return;
    if (!profile?.name?.trim()) {
      setCreateError("Nama profilmu belum tersedia. Lengkapi profil sebelum membuat pocket.");
      return;
    }
    setSaving(true);
    setCreateError("");
    try {
      const pocketRef = await addDoc(collection(db, "pockets"), {
        name: familyName.trim(), type: "family", ownerId: user.uid, createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "pocketMembers", `${pocketRef.id}_${user.uid}`), {
        pocketId: pocketRef.id, userId: user.uid, displayName: profile.name.trim(), role: "owner", joinedAt: serverTimestamp(),
      });
      setFamilyName("");
      setShowCreate(false);
      await loadPockets();
    } catch {
      setCreateError("Pocket belum berhasil dibuat. Pastikan rules Firestore terbaru sudah dipublikasikan.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFamilyPocket(pocket) {
    if (pocket.ownerId !== user.uid || deletingId) return;
    const confirmed = window.confirm(
      `Hapus pocket “${pocket.name}” beserta seluruh transaksi, anggota, dan undangannya? Tindakan ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;

    setDeletingId(pocket.id);
    setPageError("");
    try {
      // Remove memberships and invites first to stop other members from adding
      // transactions while the remaining records are being cleaned up.
      const relatedCollections = ["pocketMembers", "familyInvites", "transactions", "budgets"];
      const snapshots = await Promise.all(relatedCollections.map((name) =>
        getDocs(query(collection(db, name), where("pocketId", "==", pocket.id)))
      ));
      const documentRefs = snapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.ref));

      // Keep each batch below Firestore's 500-write limit.
      for (let start = 0; start < documentRefs.length; start += 450) {
        const batch = writeBatch(db);
        documentRefs.slice(start, start + 450).forEach((documentRef) => batch.delete(documentRef));
        await batch.commit();
      }

      await deleteDoc(doc(db, "pockets", pocket.id));
      await loadPockets();
    } catch {
      setPageError("Pocket belum berhasil dihapus seluruhnya. Coba lagi untuk melanjutkan pembersihan.");
    } finally {
      setDeletingId("");
    }
  }

  return <>
    <PageHeading
      eyebrow="RUANG KEUANGANMU"
      title={`Pagi${profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}.`}
      description="Pilih pocket untuk melihat dan mencatat arus uang."
    />
    <Notice tone="error">{pageError}</Notice>

    <section className="section-block">
      <div className="section-title-row"><div><h2>Pocket pribadi</h2><p>Ruang untuk catatan keuanganmu sendiri.</p></div></div>
      {loading ? <div className="skeleton-grid"><div className="skeleton-card" /><div className="skeleton-card" /></div> : personal.length ? <div className="pocket-grid">
        {personal.map((pocket) => <PocketCard key={pocket.id} pocket={pocket} tone="personal" />)}
      </div> : <EmptyState icon={<Wallet size={22} />} title="Belum ada pocket pribadi">Pocket pribadimu belum tersedia.</EmptyState>}
    </section>

    <section className="section-block">
      <div className="section-title-row"><div><h2>Pocket keluarga</h2><p>Kelola catatan bersama orang yang kamu undang.</p></div>{<Button onClick={() => { setCreateError(""); setShowCreate(true); }}><Plus size={17} /></Button>}</div>
      {loading ? <div className="skeleton-grid"><div className="skeleton-card" /></div> : families.length ? <div className="pocket-grid">
        {families.map((pocket) => <PocketCard
          key={pocket.id}
          pocket={pocket}
          tone="family"
          canDelete={pocket.ownerId === user.uid}
          deleting={deletingId === pocket.id}
          onDelete={() => deleteFamilyPocket(pocket)}
        />)}
      </div> : <EmptyState icon={<UsersRound size={22} />} title="Belum ada pocket keluarga">Buat pocket baru atau terima undangan untuk mulai mencatat bersama.
        <Button variant="secondary" onClick={() => { setCreateError(""); setShowCreate(true); }}><Plus size={16} /> Buat pocket keluarga</Button>
      </EmptyState>}
    </section>

    {showCreate && <Modal title="Buat pocket keluarga" description="Beri nama yang mudah dikenali semua anggota." onClose={() => !saving && setShowCreate(false)}>
      <form className="form-stack" onSubmit={createFamily}>
        <Notice tone="error">{createError}</Notice>
        <label className="field"><span>Nama pocket</span><input autoFocus type="text" maxLength={80} value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="Contoh: Rumah kita" required /></label>
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setShowCreate(false)} disabled={saving}>Batal</Button><Button type="submit" disabled={saving}>{saving ? "Membuat…" : "Buat pocket"}</Button></div>
      </form>
    </Modal>}
  </>;
}

function PocketCard({ pocket, tone, canDelete = false, deleting = false, onDelete }) {
  const isFamily = tone === "family";
  const to = isFamily ? `/family/${encodeURIComponent(pocket.id)}` : `/transactions/${encodeURIComponent(pocket.id)}`;
  return <article className={`pocket-card pocket-${tone}`}>
    <div className="pocket-card-top"><span className="pocket-icon">{isFamily ? <UsersRound size={20} /> : <Wallet size={20} />}</span><span className="pocket-type">{isFamily ? "BERSAMA" : "PRIBADI"}</span></div>
    <h3>{pocket.name}</h3>
    <p>{isFamily ? "Catat dan pantau keuangan bersama." : "Catatan yang hanya kamu kelola."}</p>
    <Link to={to} className="pocket-open">{isFamily ? "Buka pocket" : "Lihat transaksi"}<ArrowRight size={16} /></Link>
    {canDelete && <button type="button" className="pocket-delete" onClick={onDelete} disabled={deleting}>
      <Trash2 size={14} /> {deleting ? "Menghapus…" : "Hapus pocket"}
    </button>}
  </article>;
}
