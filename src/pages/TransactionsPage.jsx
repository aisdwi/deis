import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CalendarDays, CirclePlus, Pencil, PiggyBank, ReceiptText, Trash2, WalletCards } from "lucide-react";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { Button, EmptyState, Modal, Money, Notice, PageHeading, getLocalDateString } from "../ui";

const categories = {
  expense: ["Makanan & Minuman", "Transportasi", "Belanja", "Tagihan", "Rumah Tangga", "Kesehatan", "Pendidikan", "Hiburan", "Perawatan Diri", "Lainnya"],
  income: ["Gaji", "Bonus", "Usaha", "Investasi", "Hadiah", "Pengembalian Dana", "Lainnya"],
};
const wallets = ["Cash", "Bank / ATM", "GoPay", "OVO", "DANA", "ShopeePay", "LinkAja", "Kartu Kredit"];

export function TransactionsPage() {
  const { pocketId } = useParams();
  const { user } = useAuth();
  const [pocket, setPocket] = useState(null);
  const [role, setRole] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [budgetMonth, setBudgetMonth] = useState(getLocalMonthString());
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetError, setBudgetError] = useState("");
  const [budgetLoadError, setBudgetLoadError] = useState("");
  const [budgetForm, setBudgetForm] = useState({ category: categories.expense[0], amount: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyForm());

  const isOwner = pocket?.ownerId === user.uid;
  const canWrite = isOwner || role === "member";

  const loadBudgets = useCallback(async () => {
    setBudgetsLoading(true);
    setBudgets([]);
    setBudgetLoadError("");
    try {
      const budgetQuery = query(collection(db, "budgets"), where("pocketId", "==", pocketId), where("month", "==", budgetMonth));
      const budgetSnap = await getDocs(budgetQuery);
      setBudgets(budgetSnap.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => a.category.localeCompare(b.category, "id")));
    } catch {
      setBudgetLoadError("Anggaran belum bisa dimuat. Publikasikan Rules Firestore terbaru untuk mengaktifkan fitur ini.");
    } finally {
      setBudgetsLoading(false);
    }
  }, [pocketId, budgetMonth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const pocketSnap = await getDoc(doc(db, "pockets", pocketId));
      if (!pocketSnap.exists()) throw new Error("Pocket tidak ditemukan.");
      const pocketData = { id: pocketSnap.id, ...pocketSnap.data() };
      const owner = pocketData.ownerId === user.uid;
      let memberRole = owner ? "owner" : "";
      if (!owner) {
        const memberSnap = await getDoc(doc(db, "pocketMembers", `${pocketId}_${user.uid}`));
        if (memberSnap.exists()) memberRole = memberSnap.data().role;
      }
      if (!owner && !["member", "viewer"].includes(memberRole)) throw new Error("Akun ini tidak punya akses ke pocket.");
      setPocket(pocketData);
      setRole(memberRole);
      const txQuery = query(collection(db, "transactions"), where("pocketId", "==", pocketId));
      const txSnap = await getDocs(txQuery);
      const rows = txSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
      rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setTransactions(rows);
    } catch (caught) {
      setError(caught?.message === "Pocket tidak ditemukan." || caught?.message === "Akun ini tidak punya akses ke pocket."
        ? caught.message
        : "Transaksi belum bisa dimuat. Pastikan Rules Firestore terbaru sudah dipublikasikan.");
    } finally {
      setLoading(false);
    }
  }, [pocketId, user]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (pocket?.id === pocketId) loadBudgets(); }, [loadBudgets, pocket?.id, pocketId]);

  const filtered = useMemo(() => filter === "all" ? transactions : transactions.filter((item) => item.type === filter), [transactions, filter]);
  const totals = useMemo(() => transactions.reduce((sum, item) => {
    if (item.type === "income") sum.income += Number(item.amount) || 0;
    if (item.type === "expense") sum.expense += Number(item.amount) || 0;
    return sum;
  }, { income: 0, expense: 0 }), [transactions]);
  const budgetRows = useMemo(() => budgets.map((budget) => {
    const spent = transactions.reduce((sum, item) => item.type === "expense" && item.category === budget.category && item.date?.startsWith(`${budgetMonth}-`)
      ? sum + (Number(item.amount) || 0)
      : sum, 0);
    return { ...budget, spent, remaining: Number(budget.amount) - spent, progress: Number(budget.amount) > 0 ? spent / Number(budget.amount) * 100 : 0 };
  }), [budgets, transactions, budgetMonth]);
  const budgetSummary = useMemo(() => budgetRows.reduce((sum, item) => ({
    limit: sum.limit + (Number(item.amount) || 0),
    spent: sum.spent + item.spent,
  }), { limit: 0, spent: 0 }), [budgetRows]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setShowForm(true);
  }

  function openEdit(item) {
    if (!isOwner && item.createdBy !== user.uid) return;
    setEditing(item);
    setForm({
      type: item.type || "expense",
      amount: String(item.amount ?? ""),
      category: item.category || "",
      wallet: wallets.includes(item.wallet) ? item.wallet : item.wallet ? "__custom__" : "",
      customWallet: wallets.includes(item.wallet) ? "" : item.wallet || "",
      date: item.date || getLocalDateString(),
      description: item.description || "",
    });
    setFormError("");
    setShowForm(true);
  }

  function changeType(type) {
    setForm((current) => ({ ...current, type, category: categories[type][0] }));
  }

  async function submitTransaction(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    const category = form.category.trim();
    const wallet = form.wallet === "__custom__" ? form.customWallet.trim() : form.wallet;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setFormError("Masukkan jumlah rupiah berupa bilangan bulat positif.");
      return;
    }
    if (!category || !wallet || !form.date) {
      setFormError("Lengkapi kategori, wallet, dan tanggal transaksi.");
      return;
    }
    setSaving(true);
    setFormError("");
    const data = {
      pocketId,
      type: form.type,
      amount,
      category,
      wallet,
      date: form.date,
      description: form.description.trim(),
      updatedAt: serverTimestamp(),
    };
    try {
      if (editing) {
        await updateDoc(doc(db, "transactions", editing.id), data);
      } else {
        await addDoc(collection(db, "transactions"), { ...data, createdBy: user.uid, createdAt: serverTimestamp() });
      }
      setShowForm(false);
      await loadData();
    } catch {
      setFormError("Belum berhasil disimpan. Pastikan Rules Firestore mengizinkan wallet dan transaksi terbaru.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTransaction(item) {
    if (!isOwner && item.createdBy !== user.uid) return;
    if (!window.confirm(`Hapus transaksi “${item.category}” ini?`)) return;
    try {
      await deleteDoc(doc(db, "transactions", item.id));
      await loadData();
    } catch {
      setError("Transaksi belum berhasil dihapus. Periksa izin Rules Firestore.");
    }
  }

  function openBudgetCreate() {
    const availableCategories = categories.expense.filter((category) => !budgets.some((budget) => budget.category === category));
    setEditingBudget(null);
    setBudgetForm({ category: availableCategories[0] || categories.expense[0], amount: "" });
    setBudgetError(availableCategories.length ? "" : "Semua kategori sudah memiliki anggaran untuk bulan ini.");
    setShowBudgetForm(true);
  }

  function openBudgetEdit(budget) {
    if (!canWrite) return;
    setEditingBudget(budget);
    setBudgetForm({ category: budget.category, amount: String(budget.amount) });
    setBudgetError("");
    setShowBudgetForm(true);
  }

  async function submitBudget(event) {
    event.preventDefault();
    const amount = Number(budgetForm.amount);
    const category = budgetForm.category.trim();
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000_000) {
      setBudgetError("Masukkan batas anggaran rupiah berupa bilangan bulat positif.");
      return;
    }
    if (!editingBudget && budgets.some((budget) => budget.category === category)) {
      setBudgetError("Kategori ini sudah memiliki anggaran untuk bulan tersebut.");
      return;
    }
    setBudgetSaving(true);
    setBudgetError("");
    try {
      if (editingBudget) {
        await updateDoc(doc(db, "budgets", editingBudget.id), { amount, updatedAt: serverTimestamp() });
      } else {
        await setDoc(doc(db, "budgets", budgetDocumentId(pocketId, budgetMonth, category)), {
          pocketId,
          month: budgetMonth,
          category,
          amount,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setShowBudgetForm(false);
      await loadBudgets();
    } catch {
      setBudgetError("Anggaran belum berhasil disimpan. Periksa Rules Firestore terbaru dan akses pocket.");
    } finally {
      setBudgetSaving(false);
    }
  }

  async function removeBudget(budget) {
    if (!canWrite || !window.confirm(`Hapus anggaran kategori “${budget.category}” untuk bulan ini?`)) return;
    try {
      await deleteDoc(doc(db, "budgets", budget.id));
      await loadBudgets();
    } catch {
      setError("Anggaran belum berhasil dihapus. Periksa Rules Firestore terbaru.");
    }
  }

  if (loading) return <div className="page-loading"><span className="spinner" /> Memuat catatan…</div>;
  if (!pocket) return <><Link className="back-link" to="/dashboard"><ArrowLeft size={16} /> Dashboard</Link><Notice tone="error">{error || "Pocket tidak ditemukan."}</Notice></>;

  return <>
    <Link className="back-link" to={pocket.type === "family" ? `/family/${encodeURIComponent(pocketId)}` : "/dashboard"}><ArrowLeft size={16} /> {pocket.type === "family" ? "Pocket keluarga" : "Semua pocket"}</Link>
    <PageHeading eyebrow={`${pocket.type === "family" ? "KELUARGA" : "PRIBADI"} · TRANSAKSI`} title={pocket.name} description="Catat setiap arus uang, tanpa kehilangan gambaran besarnya." action={canWrite && <Button onClick={openCreate}><CirclePlus size={17} /> Catat transaksi</Button>} />
    <Notice tone="error">{error}</Notice>
    {!canWrite && <Notice tone="info">Kamu memiliki akses lihat saja pada pocket ini.</Notice>}

    <section className="money-overview">
      <article className="overview-card overview-balance"><span>ARUS BERSIH</span><strong><Money value={totals.income - totals.expense} /></strong><small>Dihitung dari seluruh catatan</small><span className="overview-watermark"><WalletCards size={50} /></span></article>
      <article className="overview-card"><span className="overview-label"><ArrowUpRight size={17} /> PEMASUKAN</span><strong><Money value={totals.income} /></strong><small>{transactions.filter((item) => item.type === "income").length} catatan</small></article>
      <article className="overview-card"><span className="overview-label"><ArrowDownLeft size={17} /> PENGELUARAN</span><strong><Money value={totals.expense} /></strong><small>{transactions.filter((item) => item.type === "expense").length} catatan</small></article>
    </section>

    <section className="panel budget-panel">
      <div className="section-title-row budget-heading">
        <div><div className="eyebrow"><PiggyBank size={14} /> RENCANA BULANAN</div><h2>Anggaran</h2><p>Tetapkan batas per kategori, lalu pantau pengeluaranmu.</p></div>
        <div className="budget-tools"><label className="budget-month"><span className="sr-only">Pilih bulan anggaran</span><input type="month" value={budgetMonth} onChange={(event) => event.target.value && setBudgetMonth(event.target.value)} /></label>
          {canWrite && <Button onClick={openBudgetCreate} disabled={budgetsLoading || Boolean(budgetLoadError) || budgets.length >= categories.expense.length}><CirclePlus size={16} /> Tambah anggaran</Button>}
        </div>
      </div>
      <Notice tone="error">{budgetLoadError}</Notice>
      {budgets.length > 0 && <div className="budget-summary"><div><span>Total batas</span><strong><Money value={budgetSummary.limit} /></strong></div><div><span>Terpakai di kategori beranggaran</span><strong><Money value={budgetSummary.spent} /></strong></div><div><span>Sisa</span><strong className={budgetSummary.spent > budgetSummary.limit ? "budget-over-text" : ""}><Money value={budgetSummary.limit - budgetSummary.spent} /></strong></div></div>}
      {budgetsLoading ? <div className="budget-loading"><span className="spinner" /> Memuat anggaran…</div> : !budgetRows.length ? <EmptyState icon={<PiggyBank size={22} />} title="Belum ada anggaran bulan ini">{canWrite ? "Pilih kategori dan batas bulanan untuk mulai memantau pengeluaran." : "Owner atau member dapat menambahkan anggaran untuk pocket ini."}</EmptyState> : <div className="budget-list">
        {budgetRows.map((item) => {
          const state = item.progress >= 100 ? "budget-over" : item.progress >= 80 ? "budget-near" : "";
          return <article className="budget-row" key={item.id}>
            <div className="budget-row-top"><div><strong>{item.category}</strong><span><Money value={item.spent} /> dari <Money value={item.amount} /></span></div>{canWrite && <div className="row-actions"><button type="button" aria-label={`Ubah anggaran ${item.category}`} onClick={() => openBudgetEdit(item)}><Pencil size={15} /></button><button type="button" aria-label={`Hapus anggaran ${item.category}`} onClick={() => removeBudget(item)}><Trash2 size={15} /></button></div>}</div>
            <div className="budget-track" role="progressbar" aria-label={`Pemakaian anggaran ${item.category}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(100, Math.round(item.progress))}><span className={state} style={{ width: `${Math.min(100, item.progress)}%` }} /></div>
            <div className={`budget-row-foot ${state}`}>{item.remaining >= 0 ? <span>Tersisa <Money value={item.remaining} /></span> : <span>Melebihi <Money value={Math.abs(item.remaining)} /></span>}<span>{Math.round(item.progress)}% terpakai</span></div>
          </article>;
        })}
      </div>}
      {!canWrite && <p className="budget-readonly-note">Anggaran hanya bisa diubah oleh owner atau member pocket.</p>}
    </section>

    <section className="panel transaction-panel">
      <div className="section-title-row transaction-title"><div><div className="eyebrow">AKTIVITAS POCKET</div><h2>Riwayat transaksi</h2></div><div className="filter-tabs" role="group" aria-label="Filter transaksi">
        {[ ["all", "Semua"], ["expense", "Keluar"], ["income", "Masuk"] ].map(([key, label]) => <button key={key} className={filter === key ? "filter-active" : ""} onClick={() => setFilter(key)}>{label}</button>)}
      </div></div>

      {!filtered.length ? <EmptyState icon={<ReceiptText size={22} />} title={filter === "all" ? "Belum ada transaksi" : "Belum ada transaksi di sini"}>{filter === "all" ? "Mulai dengan mencatat pemasukan atau pengeluaran pertamamu." : "Coba filter lainnya atau tambahkan catatan baru."}{canWrite && filter === "all" && <Button onClick={openCreate}><CirclePlus size={16} /> Catat transaksi</Button>}</EmptyState>
        : <div className="table-scroll"><table className="data-table transaction-table"><thead><tr><th>Tanggal</th><th>Catatan</th><th>Kategori · Wallet</th><th>Jumlah</th>{canWrite && <th>Aksi</th>}</tr></thead><tbody>
          {filtered.map((item) => {
            const editable = isOwner || item.createdBy === user.uid;
            return <tr key={item.id}>
              <td data-label="Tanggal"><span className="date-cell"><CalendarDays size={14} /> {formatDate(item.date)}</span></td>
              <td data-label="Catatan"><div className="transaction-description"><strong>{item.description || item.category || "Transaksi"}</strong><small>{item.type === "income" ? "Pemasukan" : "Pengeluaran"}</small></div></td>
              <td data-label="Kategori · Wallet"><span>{item.category || "Lainnya"}</span><small className="table-subline">{item.wallet || "Wallet belum ditentukan"}</small></td>
              <td data-label="Jumlah"><strong className={item.type === "income" ? "amount-income" : "amount-expense"}>{item.type === "income" ? "+" : "−"}<Money value={item.amount} /></strong></td>
              {canWrite && <td data-label="Aksi"><div className="row-actions">{editable ? <><button aria-label="Edit transaksi" onClick={() => openEdit(item)}><Pencil size={15} /></button><button aria-label="Hapus transaksi" onClick={() => removeTransaction(item)}><Trash2 size={15} /></button></> : <span>—</span>}</div></td>}
            </tr>;
          })}
        </tbody></table></div>}
    </section>

    <section className="section-block chart-section"><div className="section-title-row"><div><div className="eyebrow"></div><h2>Bar Keuangan</h2><p>Ringkasan seluruh riwayat berdasarkan kategori dan wallet.</p></div></div>
      <div className="charts-grid"><BreakdownChart title="Pengeluaran · Kategori" items={transactions.filter((item) => item.type === "expense")} groupKey="category" tone="expense" /><BreakdownChart title="Pemasukan · Kategori" items={transactions.filter((item) => item.type === "income")} groupKey="category" tone="income" /><BreakdownChart title="Pengeluaran · Wallet" items={transactions.filter((item) => item.type === "expense")} groupKey="wallet" tone="wallet" /></div>
    </section>

    {showBudgetForm && <Modal title={editingBudget ? "Ubah anggaran" : "Buat anggaran"} description={`Batas pengeluaran untuk ${formatMonth(budgetMonth)}.`} onClose={() => !budgetSaving && setShowBudgetForm(false)}>
      <form className="form-stack" onSubmit={submitBudget}>
        <Notice tone="error">{budgetError}</Notice>
        <label className="field"><span>Kategori pengeluaran</span><select value={budgetForm.category} disabled={Boolean(editingBudget)} onChange={(event) => setBudgetForm({ ...budgetForm, category: event.target.value })}>{categories.expense.filter((category) => editingBudget || !budgets.some((budget) => budget.category === category)).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field"><span>Batas per bulan · Rp</span><input autoFocus type="number" inputMode="numeric" min="1" max="1000000000000" step="1" value={budgetForm.amount} onChange={(event) => setBudgetForm({ ...budgetForm, amount: event.target.value })} placeholder="0" required /></label>
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setShowBudgetForm(false)} disabled={budgetSaving}>Batal</Button><Button type="submit" disabled={budgetSaving}>{budgetSaving ? "Menyimpan…" : editingBudget ? "Simpan perubahan" : "Simpan anggaran"}</Button></div>
      </form>
    </Modal>}

    {showForm && <Modal title={editing ? "Ubah catatan" : "Catat transaksi"} description="Jumlah dalam rupiah. Catatan ini akan terlihat oleh anggota pocket." onClose={() => !saving && setShowForm(false)}>
      <form className="form-stack" onSubmit={submitTransaction}>
        <Notice tone="error">{formError}</Notice>
        <fieldset className="segmented-control"><legend>Jenis transaksi</legend><button type="button" className={form.type === "expense" ? "selected-out" : ""} onClick={() => changeType("expense")}><ArrowDownLeft size={16} /> Pengeluaran</button><button type="button" className={form.type === "income" ? "selected-in" : ""} onClick={() => changeType("income")}><ArrowUpRight size={16} /> Pemasukan</button></fieldset>
        <div className="form-grid">
          <label className="field"><span>Jumlah · Rp</span><input autoFocus type="number" inputMode="numeric" min="1" step="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0" required /></label>
          <label className="field"><span>Tanggal</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label>
          <label className="field"><span>Kategori</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories[form.type].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>Wallet / sumber dana</span><select value={form.wallet} onChange={(event) => setForm({ ...form, wallet: event.target.value })}><option value="">Pilih wallet</option>{wallets.map((item) => <option key={item}>{item}</option>)}<option value="__custom__">Wallet lain…</option></select></label>
          {form.wallet === "__custom__" && <label className="field form-full"><span>Nama wallet</span><input type="text" maxLength={50} value={form.customWallet} onChange={(event) => setForm({ ...form, customWallet: event.target.value })} placeholder="Contoh: Rekening tabungan" required /></label>}
          <label className="field form-full"><span>Catatan <small>· opsional</small></span><input type="text" maxLength={200} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Misalnya: Belanja mingguan" /></label>
        </div>
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>Batal</Button><Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : editing ? "Simpan perubahan" : "Simpan catatan"}</Button></div>
      </form>
    </Modal>}
  </>;
}

function emptyForm() {
  return { type: "expense", amount: "", category: categories.expense[0], wallet: "", customWallet: "", date: getLocalDateString(), description: "" };
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function getLocalMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function budgetDocumentId(pocketId, month, category) {
  return `${pocketId}_${month}_${category}`;
}

function formatMonth(value) {
  const date = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(date);
}

function BreakdownChart({ title, items, groupKey, tone }) {
  const totals = new Map();
  items.forEach((item) => {
    const label = item[groupKey] || (groupKey === "wallet" ? "Belum ditentukan" : "Lainnya");
    totals.set(label, (totals.get(label) || 0) + (Number(item.amount) || 0));
  });
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] || 0;
  const sum = rows.reduce((total, [, value]) => total + value, 0);
  return <article className="breakdown-card"><h3>{title}</h3>{rows.length ? <div className="breakdown-rows">{rows.map(([label, amount]) => <div className="breakdown-row" key={label}><div className="breakdown-label"><span>{label}</span><strong><Money value={amount} /> <small>{sum ? `${Math.round(amount / sum * 100)}%` : "0%"}</small></strong></div><div className={`bar-track bar-${tone}`}><span style={{ width: `${max ? amount / max * 100 : 0}%` }} /></div></div>)}</div> : <p className="chart-empty">Belum ada data.</p>}</article>;
}
