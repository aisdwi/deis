import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


const inviteStatus = document.getElementById("inviteStatus");
const inviteList = document.getElementById("inviteList");


onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  await loadInvitations(user);
});


async function loadInvitations(user) {

  try {

    // Gunakan email yang sama persis dengan Firebase Auth
    const email = user.email;


    const inviteQuery = query(
      collection(db, "familyInvites"),
      where("email", "==", email),
      where("status", "==", "pending")
    );


    const snapshot = await getDocs(inviteQuery);



    inviteList.innerHTML = "";


    if (snapshot.empty) {

      inviteStatus.textContent =
        "Tidak ada invitation.";

      return;
    }


    inviteStatus.textContent =
      "Kamu memiliki invitation:";


    for (const inviteDoc of snapshot.docs) {

      const invite = inviteDoc.data();


      const card =
        document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = `💙 ${invite.pocketName || "Family Pocket"}`;

      const description = document.createElement("p");
      description.textContent = "Kamu diundang ke Family Pocket ini.";

      const roleLine = document.createElement("p");
      roleLine.append("Role: ");
      const role = document.createElement("strong");
      role.textContent = invite.role || "member";
      roleLine.appendChild(role);

      const acceptButton = document.createElement("button");
      acceptButton.className = "accept-button";
      acceptButton.textContent = "Terima";

      const declineButton = document.createElement("button");
      declineButton.className = "decline-button";
      declineButton.textContent = "Tolak";

      card.append(
        title,
        description,
        roleLine,
        acceptButton,
        declineButton,
        document.createElement("hr")
      );


      inviteList.appendChild(card);


      // Tombol Terima
      acceptButton.addEventListener(
        "click",
        async () => {

          await acceptInvitation(
            inviteDoc.id,
            invite,
            user
          );

        }
      );


      // Tombol Tolak
      declineButton.addEventListener(
        "click",
        async () => {

          await declineInvitation(
            inviteDoc.id
          );

        }
      );

    }

  } catch (error) {

    console.error(
      "ERROR LOAD INVITATIONS:",
      error
    );

    inviteStatus.textContent =
      `Gagal mengambil invitation: ${error.message}`;
  }
}



async function acceptInvitation(
  inviteId,
  invite,
  user
) {

  try {

    inviteStatus.textContent =
      "Menerima invitation...";


    const memberId =
      `${invite.pocketId}_${user.uid}`;


    const memberRef =
      doc(
        db,
        "pocketMembers",
        memberId
      );

    const profileSnapshot = await getDoc(doc(db, "users", user.uid));
    const displayName = profileSnapshot.exists()
      ? profileSnapshot.data().name || user.displayName || ""
      : user.displayName || "";


    const inviteRef =
      doc(
        db,
        "familyInvites",
        inviteId
      );


    /*
      ==========================================
      BATCH
      ==========================================

      1. Membuat membership
      2. Mengubah invitation menjadi accepted

      Keduanya dijalankan sebagai SATU operasi.
    */


    const batch = writeBatch(db);


    // Buat membership user
    batch.set(memberRef, {

      pocketId: invite.pocketId,

      userId: user.uid,

      displayName,

      role: invite.role,

      inviteId: inviteId,

      joinedAt: serverTimestamp()

    });


    // Ubah invitation
    batch.update(inviteRef, {

      status: "accepted"

    });


    // Jalankan
    await batch.commit();



    alert(
      "Berhasil bergabung ke Family Pocket! 🎉"
    );


    window.location.href =
      `family.html?pocketId=${invite.pocketId}`;


  } catch (error) {

    console.error(
      "ERROR ACCEPT INVITATION:",
      error
    );


    inviteStatus.textContent =
      `Gagal menerima invitation: ${error.message}`;
  }
}



async function declineInvitation(inviteId) {

  try {

    const inviteRef =
      doc(
        db,
        "familyInvites",
        inviteId
      );


    const batch = writeBatch(db);


    batch.update(
      inviteRef,
      {
        status: "declined"
      }
    );


    await batch.commit();


    alert(
      "Invitation ditolak."
    );


    window.location.reload();


  } catch (error) {

    console.error(
      "ERROR DECLINE:",
      error
    );


    inviteStatus.textContent =
      `Gagal menolak invitation: ${error.message}`;
  }
}
