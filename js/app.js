import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  setDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// ========================================
// ELEMENT HTML
// ========================================

const welcome = document.getElementById("welcome");

const pocketList = document.getElementById("pocketList");

const familyList = document.getElementById("familyList");

const logoutButton = document.getElementById("logoutButton");

const createFamilyButton = document.getElementById("createFamilyButton");

const familyModal = document.getElementById("familyModal");

const familyForm = document.getElementById("familyForm");

const closeFamilyModal = document.getElementById("closeFamilyModal");

const familyMessage = document.getElementById("familyMessage");

// ========================================
// CEK LOGIN
// ========================================

onAuthStateChanged(auth, async (user) => {
  // ======================================
  // BELUM LOGIN
  // ======================================

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // ======================================
  // WELCOME
  // ======================================

  welcome.textContent = "Selamat datang kembali!";

  // ======================================
  // LOAD PERSONAL POCKET
  // ======================================

  await loadPersonalPocket(user);

  // ======================================
  // LOAD FAMILY POCKET
  // ======================================

  await loadFamilyPockets(user);
});

// ========================================
// PERSONAL POCKET
// ========================================

async function loadPersonalPocket(user) {
  try {
    const pocketQuery = query(
      collection(db, "pockets"),
      where("ownerId", "==", user.uid),
      where("type", "==", "personal"),
    );

    const snapshot = await getDocs(pocketQuery);

    pocketList.innerHTML = "";

    // Tidak ada Personal Pocket
    if (snapshot.empty) {
      pocketList.innerHTML = `
        <p>Personal Pocket tidak ditemukan.</p>
      `;

      return;
    }

    // Tampilkan Personal Pocket
    snapshot.forEach((documentSnapshot) => {
      const pocket = documentSnapshot.data();

      const card = document.createElement("div");

      const heading = document.createElement("h3");
      heading.textContent = `💜 ${pocket.name || "Personal Pocket"}`;
      const description = document.createElement("p");
      description.textContent = "Pocket pribadi kamu";
      const openButton = document.createElement("button");
      openButton.className = "open-personal-button";
      openButton.type = "button";
      openButton.textContent = "Buka Transaksi";
      card.append(heading, description, openButton, document.createElement("hr"));

      card.querySelector(".open-personal-button").addEventListener("click", () => {
        window.location.href = `transactions.html?pocketId=${documentSnapshot.id}`;
      });

      pocketList.appendChild(card);
    });
  } catch (error) {
    console.error("Error load Personal Pocket:", error);

    pocketList.innerHTML = `
      <p>Gagal mengambil Personal Pocket.</p>
    `;
  }
}

// ========================================
// FAMILY POCKET
// ========================================

async function loadFamilyPockets(user) {
  try {
    const familyQuery = query(
      collection(db, "pockets"),
      where("ownerId", "==", user.uid),
      where("type", "==", "family"),
    );

    const membershipQuery = query(
      collection(db, "pocketMembers"),
      where("userId", "==", user.uid),
    );

    const [ownedSnapshot, membershipSnapshot] = await Promise.all([
      getDocs(familyQuery),
      getDocs(membershipQuery),
    ]);

    const familyPockets = new Map();
    ownedSnapshot.forEach((pocketDoc) => {
      familyPockets.set(pocketDoc.id, pocketDoc);
    });

    // Pocket yang dimiliki orang lain ditemukan melalui membership user.
    await Promise.all(membershipSnapshot.docs.map(async (memberDoc) => {
      const member = memberDoc.data();
      if (!member.pocketId || familyPockets.has(member.pocketId)) return;

      try {
        const pocketDoc = await getDoc(doc(db, "pockets", member.pocketId));
        if (pocketDoc.exists() && pocketDoc.data().type === "family") {
          familyPockets.set(pocketDoc.id, pocketDoc);
        }
      } catch (error) {
        console.warn("Tidak dapat membaca Family Pocket dari membership.", error);
      }
    }));

    familyList.innerHTML = "";

    // Belum ada Family Pocket
    if (familyPockets.size === 0) {
      familyList.innerHTML = `
        <p>Belum ada Family Pocket.</p>
      `;

      return;
    }

    // Tampilkan Family Pocket
    familyPockets.forEach((documentSnapshot) => {
      const pocket = documentSnapshot.data();

      const card = document.createElement("div");

      const heading = document.createElement("h3");
      heading.textContent = `💙 ${pocket.name || "Family Pocket"}`;
      const description = document.createElement("p");
      description.textContent = "Family Pocket";
      const openButton = document.createElement("button");
      openButton.className = "open-family-button";
      openButton.type = "button";
      openButton.textContent = "Buka Family";
      card.append(heading, description, openButton, document.createElement("hr"));

      openButton.addEventListener("click", () => {
        window.location.href = `family.html?pocketId=${documentSnapshot.id}`;
      });

      familyList.appendChild(card);
    });
  } catch (error) {
    console.error("Error load Family Pocket:", error);

    familyList.innerHTML = `
      <p>Gagal mengambil Family Pocket.</p>
    `;
  }
}

// ========================================
// BUKA MODAL FAMILY
// ========================================

if (createFamilyButton) {
  createFamilyButton.addEventListener("click", () => {
    familyModal.style.display = "block";

    familyMessage.textContent = "";
  });
}

// ========================================
// TUTUP MODAL FAMILY
// ========================================

if (closeFamilyModal) {
  closeFamilyModal.addEventListener("click", () => {
    familyModal.style.display = "none";

    familyMessage.textContent = "";
  });
}

// ========================================
// BUAT FAMILY POCKET
// ========================================

if (familyForm) {
  familyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const user = auth.currentUser;

    // ====================================
    // CEK LOGIN
    // ====================================

    if (!user) {
      window.location.href = "login.html";

      return;
    }

    // ====================================
    // AMBIL NAMA FAMILY
    // ====================================

    const familyName = document.getElementById("familyName").value.trim();

    if (!familyName) {
      familyMessage.textContent = "Nama Family wajib diisi.";

      return;
    }

    // ====================================
    // CEGAH DOUBLE CLICK
    // ====================================

    const submitButton = familyForm.querySelector('button[type="submit"]');

    submitButton.disabled = true;

    familyMessage.textContent = "Membuat Family Pocket...";

    try {
      // Nama owner selalu diambil dari profil Firestore miliknya sendiri.
      const profileSnapshot = await getDoc(doc(db, "users", user.uid));
      const displayName = profileSnapshot.exists()
        ? profileSnapshot.data().name?.trim()
        : "";

      if (!displayName) {
        throw new Error(
          "Nama profil tidak ditemukan. Lengkapi field name pada dokumen users sebelum membuat Family Pocket.",
        );
      }

      // ==================================
      // 1. BUAT FAMILY POCKET
      // ==================================

      const pocketRef = await addDoc(collection(db, "pockets"), {
        name: familyName,
        type: "family",
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      });


      // ==================================
      // 2. BUAT MEMBERSHIP OWNER
      // ==================================

      const memberId = `${pocketRef.id}_${user.uid}`;

      await setDoc(doc(db, "pocketMembers", memberId), {
        pocketId: pocketRef.id,
        userId: user.uid,
        displayName,
        role: "owner",
        joinedAt: serverTimestamp(),
      });


      // ==================================
      // BERHASIL
      // ==================================

      familyMessage.textContent = "Family Pocket berhasil dibuat! 🎉";

      document.getElementById("familyName").value = "";

      // ==================================
      // TUTUP MODAL
      // ==================================

      setTimeout(async () => {
        familyModal.style.display = "none";

        familyMessage.textContent = "";

        await loadFamilyPockets(user);
      }, 800);
    } catch (error) {
      console.error("Error membuat Family Pocket:", error);

      familyMessage.textContent = `Gagal membuat Family Pocket: ${error.message}`;
    } finally {
      // ==================================
      // AKTIFKAN KEMBALI BUTTON
      // ==================================

      submitButton.disabled = false;
    }
  });
}

// ========================================
// LOGOUT
// ========================================

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);

      window.location.href = "login.html";
    } catch (error) {
      console.error("Logout error:", error);
    }
  });
}
