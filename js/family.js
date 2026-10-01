import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


// ========================================
// ELEMENT
// ========================================

const familyName =
    document.getElementById("familyName");

const familyDescription =
    document.getElementById("familyDescription");

const memberList =
    document.getElementById("memberList");

const inviteButton =
    document.getElementById("inviteButton");

const inviteModal =
    document.getElementById("inviteModal");

const inviteForm =
    document.getElementById("inviteForm");

const closeInviteButton =
    document.getElementById("closeInviteButton");

const inviteMessage =
    document.getElementById("inviteMessage");

const openTransactionsButton =
    document.getElementById("openTransactionsButton");


// ========================================
// AMBIL POCKET ID DARI URL
// ========================================

const urlParams =
    new URLSearchParams(window.location.search);

const pocketId =
    urlParams.get("pocketId");

if (openTransactionsButton && pocketId) {
    openTransactionsButton.addEventListener("click", () => {
        window.location.href = `transactions.html?pocketId=${encodeURIComponent(pocketId)}`;
    });
}


// ========================================
// CEK POCKET ID
// ========================================

if (!pocketId) {

    familyDescription.textContent =
        "Family Pocket tidak ditemukan.";

    throw new Error(
        "Pocket ID tidak ditemukan."
    );
}


// ========================================
// CEK LOGIN
// ========================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href =
            "login.html";

        return;
    }

    await loadFamily(user);

});


// ========================================
// LOAD FAMILY
// ========================================

async function loadFamily(user) {

    try {

        // ==================================
        // AMBIL SATU DOKUMEN POCKET
        // ==================================

        const pocketRef =
            doc(
                db,
                "pockets",
                pocketId
            );

        const pocketSnapshot =
            await getDoc(pocketRef);


        // ==================================
        // CEK ADA / TIDAK
        // ==================================

        if (!pocketSnapshot.exists()) {

            familyName.textContent =
                "Family Pocket";

            familyDescription.textContent =
                "Family Pocket tidak ditemukan.";

            return;
        }


        // ==================================
        // DATA POCKET
        // ==================================

        const pocket =
            pocketSnapshot.data();


        // ==================================
        // PASTIKAN FAMILY
        // ==================================

        if (pocket.type !== "family") {

            familyName.textContent =
                "Pocket";

            familyDescription.textContent =
                "Pocket ini bukan Family Pocket.";

            return;
        }


        // ==================================
        // TAMPILKAN
        // ==================================

        familyName.textContent =
            pocket.name;

        familyDescription.textContent =
            "Family Pocket";



        // ==================================
        // LOAD MEMBERS
        // ==================================

        await loadMembers();


    } catch (error) {

        console.error(
            "ERROR LOAD FAMILY:",
            error
        );

        familyDescription.textContent =
            `Gagal memuat Family Pocket: ${error.message}`;
    }
}


// ========================================
// LOAD MEMBERS
// ========================================

async function loadMembers() {

    try {

        const memberQuery = query(
            collection(db, "pocketMembers"),
            where("pocketId", "==", pocketId)
        );

        const snapshot =
            await getDocs(memberQuery);

        memberList.innerHTML = "";


        if (snapshot.empty) {

            memberList.textContent =
                "Belum ada anggota.";

            return;
        }

        const currentUser = auth.currentUser;
        let currentUserName = "";
        if (currentUser) {
            const profileSnapshot = await getDoc(doc(db, "users", currentUser.uid));
            if (profileSnapshot.exists()) {
                currentUserName = profileSnapshot.data().name || "";
            }
        }

        const wrapper = document.createElement("div");
        wrapper.className = "member-table-wrap";
        const table = document.createElement("table");
        table.className = "member-table";
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        for (const label of ["Nama", "Peran"]) {
            const th = document.createElement("th");
            th.scope = "col";
            th.textContent = label;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        const tbody = document.createElement("tbody");

        snapshot.forEach((memberDoc) => {
            const member = memberDoc.data();
            const row = document.createElement("tr");
            const nameCell = document.createElement("td");
            const roleCell = document.createElement("td");
            const name = member.displayName ||
                (member.userId === currentUser?.uid ? currentUserName : "") ||
                "Nama belum tersedia";
            nameCell.textContent = name;
            roleCell.textContent = member.role === "owner"
                ? "👑 Owner"
                : member.role === "viewer" ? "👁 Viewer" : "👤 Member";
            row.append(nameCell, roleCell);
            tbody.appendChild(row);
        });

        table.append(thead, tbody);
        wrapper.appendChild(table);
        memberList.appendChild(wrapper);

    } catch (error) {

        console.error(
            "ERROR LOAD MEMBERS:",
            error
        );

        memberList.textContent =
            `Gagal mengambil anggota: ${error.message}`;
    }
}


// ========================================
// BUKA INVITE MODAL
// ========================================

if (inviteButton) {

    inviteButton.addEventListener(
        "click",
        () => {

            inviteModal.style.display =
                "block";

            inviteMessage.textContent = "";
        }
    );
}


// ========================================
// TUTUP INVITE MODAL
// ========================================

if (closeInviteButton) {

    closeInviteButton.addEventListener(
        "click",
        () => {

            inviteModal.style.display =
                "none";

            inviteMessage.textContent = "";
        }
    );
}


// ========================================
// KIRIM INVITATION
// ========================================

if (inviteForm) {

    inviteForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const user =
                auth.currentUser;


            if (!user) {

                window.location.href =
                    "login.html";

                return;
            }


            // ==================================
            // EMAIL
            // ==================================

            const email =
                document
                    .getElementById("inviteEmail")
                    .value
                    .trim()
                    .toLowerCase();


            // ==================================
            // ROLE
            // ==================================

            const role =
                document
                    .getElementById("inviteRole")
                    .value;


            if (!email) {

                inviteMessage.textContent =
                    "Email wajib diisi.";

                return;
            }


            inviteMessage.textContent =
                "Mengirim invitation...";


            try {

                // ==================================
                // CEK FAMILY DULU
                // ==================================

                const pocketRef =
                    doc(
                        db,
                        "pockets",
                        pocketId
                    );

                const pocketSnapshot =
                    await getDoc(pocketRef);


                if (!pocketSnapshot.exists()) {

                    throw new Error(
                        "Family Pocket tidak ditemukan."
                    );
                }


                const pocket =
                    pocketSnapshot.data();


                if (pocket.ownerId !== user.uid) {

                    throw new Error(
                        "Hanya owner yang dapat mengundang member."
                    );
                }


                if (pocket.type !== "family") {

                    throw new Error(
                        "Pocket ini bukan Family Pocket."
                    );
                }


                // ==================================
                // BUAT INVITATION
                // ==================================

                const inviteRef =
                    await addDoc(
                        collection(
                            db,
                            "familyInvites"
                        ),
                        {
                            pocketId: pocketId,

                            email: email,

                            invitedBy: user.uid,

                            role: role,

                            status: "pending",

                            createdAt:
                                serverTimestamp()
                        }
                    );



                // ==================================
                // BERHASIL
                // ==================================

                inviteMessage.textContent =
                    "Invitation berhasil dikirim! 🎉";


                document.getElementById(
                    "inviteEmail"
                ).value = "";


            } catch (error) {

                console.error(
                    "ERROR INVITE:",
                    error
                );

                inviteMessage.textContent =
                    `Gagal: ${error.message}`;
            }

        }
    );
}
