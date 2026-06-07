import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isApiModeEnabled } from "@/lib/env";

/** Development-only helper for local API integration testing. */
export function DevAuthPanel() {
  const { user, signIn, signOut, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!import.meta.env.DEV || !isApiModeEnabled() || !isConfigured) {
    return null;
  }

  const handleSignIn = async () => {
    setError(null);
    const result = await signIn(email.trim(), password);
    if (result.error) setError(result.error);
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 max-w-xs rounded-lg border border-border bg-surface p-3 text-xs shadow-md">
      <button
        type="button"
        className="font-label-sm text-label-sm text-primary"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Tutup Dev Auth" : "Dev Auth"}
      </button>

      {open ? (
        <div className="mt-2 space-y-2">
          {user ? (
            <>
              <p className="text-muted-text">Masuk: {user.email}</p>
              <button
                type="button"
                className="rounded border border-border px-2 py-1"
                onClick={() => void signOut()}
              >
                Keluar
              </button>
            </>
          ) : (
            <>
              <input
                type="email"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-border px-2 py-1"
              />
              <input
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-border px-2 py-1"
              />
              <button
                type="button"
                className="rounded bg-primary px-2 py-1 text-on-primary"
                onClick={() => void handleSignIn()}
              >
                Masuk
              </button>
            </>
          )}
          {error ? <p className="text-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}