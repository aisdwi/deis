import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const pocketId = params.get("pocketId");
const pocketName = document.getElementById("pocketName");
const pageMessage = document.getElementById("pageMessage");
const transactionList = document.getElementById("transactionList");
const form = document.getElementById("transactionForm");
const formTitle = document.getElementById("formTitle");
const formMessage = document.getElementById("formMessage");
const addButton = document.getElementById("addTransactionButton");
const cancelButton = document.getElementById("cancelTransactionButton");
const typeInput = document.getElementById("transactionType");
const amountInput = document.getElementById("transactionAmount");
const categoryInput = document.getElementById("transactionCategory");
const walletInput = document.getElementById("transactionWallet");
const customWalletInput = document.getElementById("customWallet");
const dateInput = document.getElementById("transactionDate");
const descriptionInput = document.getElementById("transactionDescription");
const backLink = document.getElementById("backLink");

let currentUser;
let canWrite = false;
let isOwner = false;
let editingId = null;
let transactions = [];

const categories = {
  expense: [
    "Makanan & Minuman",
    "Transportasi",
    "Belanja",
    "Tagihan",
    "Rumah Tangga",
    "Kesehatan",
    "Pendidikan",
    "Hiburan",
    "Perawatan Diri",
    "Lainnya",
  ],
  income: [
    "Gaji",
    "Bonus",
    "Usaha",
    "Investasi",
    "Hadiah",
    "Pengembalian Dana",
    "Lainnya",
  ],
};

populateCategories();
typeInput.addEventListener("change", () => populateCategories());
walletInput.addEventListener("change", () => {
  customWalletInput.hidden = walletInput.value !== "__custom__";
  customWalletInput.required = walletInput.value === "__custom__";
  if (customWalletInput.hidden) customWalletInput.value = "";
});

if (!pocketId) {
  pageMessage.textContent = "Pocket tidak ditemukan.";
  throw new Error("Parameter pocketId tidak ditemukan.");
}

backLink.href = `family.html?pocketId=${encodeURIComponent(pocketId)}`;
dateInput.value = getLocalDateString();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;
  await initializePage();
});

async function initializePage() {
  try {
    const pocketSnapshot = await getDoc(doc(db, "pockets", pocketId));
    if (!pocketSnapshot.exists()) {
      pageMessage.textContent = "Pocket tidak ditemukan.";
      return;
    }

    const pocket = pocketSnapshot.data();
    pocketName.textContent = `Transaksi — ${pocket.name || "Pocket"}`;
    isOwner = pocket.ownerId === currentUser.uid;
    backLink.href = pocket.type === "family"
      ? `family.html?pocketId=${encodeURIComponent(pocketId)}`
      : "dashboard.html";

    let role = isOwner ? "owner" : "";
    if (!isOwner) {
      const memberSnapshot = await getDoc(
        doc(db, "pocketMembers", `${pocketId}_${currentUser.uid}`),
      );
      if (memberSnapshot.exists()) role = memberSnapshot.data().role;
    }

    if (!isOwner && !["member", "viewer"].includes(role)) {
      pageMessage.textContent = "Kamu tidak memiliki akses ke pocket ini.";
      transactionList.textContent = "";
      return;
    }

    canWrite = isOwner || role === "member";
    addButton.hidden = !canWrite;
    pageMessage.textContent = canWrite
      ? "Kamu dapat mengelola transaksi di pocket ini."
      : "Mode lihat saja: role Viewer tidak dapat mengubah transaksi.";

    await loadTransactions();
  } catch (error) {
    console.error("Gagal membuka transaksi:", error);
    pageMessage.textContent = `Gagal membuka pocket: ${error.message}`;
  }
}

async function loadTransactions() {
  try {
    const transactionQuery = query(
      collection(db, "transactions"),
      where("pocketId", "==", pocketId),
    );
    const snapshot = await getDocs(transactionQuery);
    transactions = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    transactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    renderTransactions();
  } catch (error) {
    console.error("Gagal membaca transaksi:", error);
    transactionList.textContent = `Gagal membaca transaksi: ${error.message}`;
  }
}

function renderTransactions() {
  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expense = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  document.getElementById("incomeTotal").textContent = formatRupiah(income);
  document.getElementById("expenseTotal").textContent = formatRupiah(expense);
  document.getElementById("balanceTotal").textContent = formatRupiah(income - expense);
  renderCategoryChart("expenseCategoryChart", "Pengeluaran per Kategori", "expense");
  renderCategoryChart("incomeCategoryChart", "Pemasukan per Kategori", "income");
  renderWalletChart();

  transactionList.replaceChildren();
  if (!transactions.length) {
    transactionList.textContent = "Belum ada transaksi.";
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "member-table-wrap";
  const table = document.createElement("table");
  table.className = "member-table transaction-table";
  const headers = canWrite
    ? ["Tanggal", "Jenis", "Kategori", "Wallet", "Catatan", "Jumlah", "Aksi"]
    : ["Tanggal", "Jenis", "Kategori", "Wallet", "Catatan", "Jumlah"];
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  const tbody = document.createElement("tbody");

  transactions.forEach((item) => {
    const row = document.createElement("tr");
    const values = [
      item.date || "—",
      item.type === "income" ? "Pemasukan" : "Pengeluaran",
      item.category || "—",
      item.wallet || "Belum ditentukan",
      item.description || "—",
      `${item.type === "income" ? "+" : "−"}${formatRupiah(Number(item.amount || 0))}`,
    ];
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    if (canWrite) {
      const actions = document.createElement("td");
      const mayEdit = isOwner || item.createdBy === currentUser.uid;
      if (mayEdit) {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => beginEdit(item));
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Hapus";
        deleteButton.addEventListener("click", () => removeTransaction(item));
        actions.append(editButton, " ", deleteButton);
      } else {
        actions.textContent = "—";
      }
      row.appendChild(actions);
    }
    tbody.appendChild(row);
  });

  table.append(thead, tbody);
  wrapper.appendChild(table);
  transactionList.appendChild(wrapper);
}

function populateCategories(selectedValue = "") {
  const options = [...categories[typeInput.value]];
  if (selectedValue && !options.includes(selectedValue)) options.unshift(selectedValue);
  categoryInput.replaceChildren();
  options.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryInput.appendChild(option);
  });
  if (selectedValue) categoryInput.value = selectedValue;
}

function renderCategoryChart(elementId, title, type) {
  const container = document.getElementById(elementId);
  container.replaceChildren();

  const heading = document.createElement("h3");
  heading.textContent = title;
  container.appendChild(heading);

  const totals = new Map();
  transactions
    .filter((item) => item.type === type)
    .forEach((item) => {
      const category = item.category || "Lainnya";
      totals.set(category, (totals.get(category) || 0) + Number(item.amount || 0));
    });

  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.textContent = "Belum ada data untuk grafik.";
    container.appendChild(empty);
    return;
  }

  const maxAmount = entries[0][1];
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  entries.forEach(([category, amount]) => {
    const row = document.createElement("div");
    row.className = "category-chart-row";
    const labels = document.createElement("div");
    labels.className = "category-chart-labels";
    const name = document.createElement("span");
    name.textContent = category;
    const value = document.createElement("span");
    value.textContent = `${formatRupiah(amount)} · ${Math.round((amount / total) * 100)}%`;
    labels.append(name, value);

    const track = document.createElement("div");
    track.className = `category-chart-track ${type}`;
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${category}: ${formatRupiah(amount)}`);
    const bar = document.createElement("span");
    bar.style.width = `${maxAmount ? (amount / maxAmount) * 100 : 0}%`;
    track.appendChild(bar);
    row.append(labels, track);
    container.appendChild(row);
  });
}

function renderWalletChart() {
  const container = document.getElementById("walletExpenseChart");
  container.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = "Pengeluaran per Wallet";
  container.appendChild(heading);

  const totals = new Map();
  transactions
    .filter((item) => item.type === "expense")
    .forEach((item) => {
      const wallet = item.wallet || "Belum ditentukan";
      totals.set(wallet, (totals.get(wallet) || 0) + Number(item.amount || 0));
    });

  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.textContent = "Belum ada data pengeluaran.";
    container.appendChild(empty);
    return;
  }

  const maxAmount = entries[0][1];
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  entries.forEach(([wallet, amount]) => {
    const row = document.createElement("div");
    row.className = "category-chart-row";
    const labels = document.createElement("div");
    labels.className = "category-chart-labels";
    const name = document.createElement("span");
    name.textContent = wallet;
    const value = document.createElement("span");
    value.textContent = `${formatRupiah(amount)} · ${Math.round((amount / total) * 100)}%`;
    labels.append(name, value);
    const track = document.createElement("div");
    track.className = "category-chart-track wallet";
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${wallet}: ${formatRupiah(amount)}`);
    const bar = document.createElement("span");
    bar.style.width = `${maxAmount ? (amount / maxAmount) * 100 : 0}%`;
    track.appendChild(bar);
    row.append(labels, track);
    container.appendChild(row);
  });
}

function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function openForm(item = null) {
  editingId = item?.id || null;
  formTitle.textContent = editingId ? "Edit Transaksi" : "Tambah Transaksi";
  typeInput.value = item?.type || "expense";
  amountInput.value = item?.amount ?? "";
  populateCategories(item?.category || "");
  const standardWallets = [...walletInput.options]
    .map((option) => option.value)
    .filter((value) => value && value !== "__custom__");
  const savedWallet = item?.wallet || "";
  if (!savedWallet) {
    walletInput.value = "";
    customWalletInput.value = "";
    customWalletInput.hidden = true;
    customWalletInput.required = false;
  } else if (standardWallets.includes(savedWallet)) {
    walletInput.value = savedWallet;
    customWalletInput.value = "";
    customWalletInput.hidden = true;
    customWalletInput.required = false;
  } else {
    walletInput.value = "__custom__";
    customWalletInput.value = savedWallet;
    customWalletInput.hidden = false;
    customWalletInput.required = true;
  }
  dateInput.value = item?.date || getLocalDateString();
  descriptionInput.value = item?.description || "";
  formMessage.textContent = "";
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function beginEdit(item) {
  if (!isOwner && item.createdBy !== currentUser.uid) return;
  openForm(item);
}

function closeForm() {
  form.reset();
  dateInput.value = getLocalDateString();
  customWalletInput.hidden = true;
  customWalletInput.required = false;
  form.hidden = true;
  editingId = null;
}

addButton.addEventListener("click", () => openForm());
cancelButton.addEventListener("click", closeForm);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canWrite) return;
  const amount = Number(amountInput.value);
  const category = categoryInput.value.trim();
  const wallet = walletInput.value === "__custom__"
    ? customWalletInput.value.trim()
    : walletInput.value;
  if (!Number.isSafeInteger(amount) || amount <= 0 || !category) {
    formMessage.textContent = "Jumlah harus bilangan bulat positif dan kategori wajib diisi.";
    return;
  }
  if (!wallet) {
    formMessage.textContent = "Pilih wallet atau isi nama wallet lain.";
    return;
  }

  const data = {
    pocketId,
    type: typeInput.value,
    amount,
    category,
    wallet,
    date: dateInput.value,
    description: descriptionInput.value.trim(),
    updatedAt: serverTimestamp(),
  };

  const saveButton = document.getElementById("saveTransactionButton");
  saveButton.disabled = true;
  formMessage.textContent = "Menyimpan...";
  try {
    if (editingId) {
      const existing = transactions.find((item) => item.id === editingId);
      if (!isOwner && existing?.createdBy !== currentUser.uid) {
        throw new Error("Kamu hanya dapat mengubah transaksi milikmu.");
      }
      await updateDoc(doc(db, "transactions", editingId), data);
    } else {
      await addDoc(collection(db, "transactions"), {
        ...data,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });
    }
    closeForm();
    await loadTransactions();
  } catch (error) {
    console.error("Gagal menyimpan transaksi:", error);
    formMessage.textContent = `Gagal menyimpan: ${error.message}`;
  } finally {
    saveButton.disabled = false;
  }
});

async function removeTransaction(item) {
  if (!isOwner && item.createdBy !== currentUser.uid) return;
  if (!window.confirm(`Hapus transaksi ${item.category} sebesar ${formatRupiah(Number(item.amount))}?`)) return;
  try {
    await deleteDoc(doc(db, "transactions", item.id));
    await loadTransactions();
  } catch (error) {
    console.error("Gagal menghapus transaksi:", error);
    pageMessage.textContent = `Gagal menghapus transaksi: ${error.message}`;
  }
}
