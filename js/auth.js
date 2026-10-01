import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    setDoc,
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


// ========================================
// REGISTER
// ========================================

const registerForm =
    document.getElementById("registerForm");

const registerMessage =
    document.getElementById("message");


if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const name =
                document.getElementById("name")
                    .value
                    .trim();

            const email =
                document.getElementById("email")
                    .value
                    .trim();

            const password =
                document.getElementById("password")
                    .value;


            registerMessage.textContent =
                "Membuat akun...";


            try {

                // 1. Buat akun Firebase Authentication

                const userCredential =
                    await createUserWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );

                const user =
                    userCredential.user;


                // 2. Buat profile user

                await setDoc(
                    doc(db, "users", user.uid),
                    {
                        name: name,
                        email: email,
                        createdAt: serverTimestamp()
                    }
                );


                // 3. Buat Personal Pocket

                const pocketRef =
                    await addDoc(
                        collection(db, "pockets"),
                        {
                            name: "Personal Pocket",
                            type: "personal",
                            ownerId: user.uid,
                            createdAt: serverTimestamp()
                        }
                    );


                // 4. Buat membership
                // User menjadi owner Personal Pocket

                await addDoc(
                    collection(db, "pocketMembers"),
                    {
                        pocketId: pocketRef.id,
                        userId: user.uid,
                        role: "owner",
                        joinedAt: serverTimestamp()
                    }
                );


                registerMessage.textContent =
                    "Akun berhasil dibuat! 🎉";



                // Tunggu sebentar lalu ke dashboard

                setTimeout(() => {

                    window.location.href =
                        "dashboard.html";

                }, 1000);


            } catch (error) {

                console.error(error);

                registerMessage.textContent =
                    getFirebaseErrorMessage(
                        error.code
                    );
            }
        }
    );
}


// ========================================
// LOGIN
// ========================================

const loginForm =
    document.getElementById("loginForm");

const loginMessage =
    document.getElementById("message");


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const email =
                document.getElementById("email")
                    .value
                    .trim();

            const password =
                document.getElementById("password")
                    .value;


            loginMessage.textContent =
                "Memeriksa akun...";


            try {

                const userCredential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );


                const user =
                    userCredential.user;



                loginMessage.textContent =
                    "Login berhasil! 🎉";


                setTimeout(() => {

                    window.location.href =
                        "dashboard.html";

                }, 500);


            } catch (error) {

                console.error(error);

                loginMessage.textContent =
                    getFirebaseErrorMessage(
                        error.code
                    );
            }
        }
    );
}


// ========================================
// ERROR MESSAGE
// ========================================

function getFirebaseErrorMessage(code) {

    switch (code) {

        case "auth/email-already-in-use":
            return "Email sudah digunakan.";

        case "auth/invalid-email":
            return "Format email tidak valid.";

        case "auth/weak-password":
            return "Password minimal 6 karakter.";

        case "auth/invalid-credential":
            return "Email atau password salah.";

        case "auth/user-not-found":
            return "Akun tidak ditemukan.";

        case "auth/wrong-password":
            return "Password salah.";

        default:
            return "Terjadi kesalahan. Coba lagi.";
    }
}
