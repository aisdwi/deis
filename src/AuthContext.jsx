import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    setProfile(null);
    if (nextUser) {
      try {
        const profileDoc = await getDoc(doc(db, "users", nextUser.uid));
        setProfile(profileDoc.exists() ? profileDoc.data() : null);
      } catch {
        setProfile(null);
      }
    }
    setLoading(false);
  }), []);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    refreshProfile: async () => {
      if (!user) return;
      const profileDoc = await getDoc(doc(db, "users", user.uid));
      setProfile(profileDoc.exists() ? profileDoc.data() : null);
    },
  }), [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth harus digunakan di dalam AuthProvider.");
  return value;
}
