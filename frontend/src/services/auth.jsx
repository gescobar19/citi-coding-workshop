import { createContext, useContext, useMemo } from "react";
import { setAuthUser } from "../api/client.js";

const AuthContext = createContext({ user: null, isAdmin: false, canEdit: false });

export function AuthProvider({ user, onLogout, children }) {
  // Keep the API client in sync so every request carries the role headers.
  setAuthUser(user);

  const value = useMemo(
    () => ({
      user,
      onLogout,
      isAdmin: user?.role === "admin",
      canEdit: user?.role === "admin",
      displayName: user?.email?.split("@")[0]?.replace(/[._]/g, " ") || "User",
      roleLabel: user?.role === "admin" ? "Administrator" : "Executive",
    }),
    [user, onLogout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
