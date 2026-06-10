import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ROUTES } from "@/routes/paths";

type AuthMode = "signin" | "signup";

export function LoginPage() {
  const { session, loading, signIn, signUp, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate(ROUTES.dashboard, { replace: true });
    }
  }, [loading, session, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === "signin"
          ? await signIn(email.trim(), password)
          : await signUp(email.trim(), password);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (mode === "signup") {
        setError(null);
        setMode("signin");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConfigured || !isSupabaseConfigured) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-lg">
        <Card padding="md" className="rounded-2xl border border-warning/30 bg-warning-soft/30">
          <h1 className="font-display text-display-sm text-on-surface">Masuk ke Narraza</h1>
          <p className="mt-2 font-body-md text-body-md text-muted-text">
            Autentikasi belum dikonfigurasi di build ini. Hubungi operator.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-lg">
      <div className="text-center">
        <p className="font-label-sm text-label-sm uppercase tracking-wider text-muted-text">
          Narraza
        </p>
        <h1 className="mt-2 font-display text-display-lg text-on-surface">
          {mode === "signin" ? "Masuk" : "Daftar"}
        </h1>
        <p className="mt-2 font-body-md text-body-md text-muted-text">
          Private beta — akun Anda terhubung ke workspace produksi.
        </p>
      </div>

      <Card padding="md" className="rounded-2xl border border-border bg-surface">
        <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-muted-text">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-[44px] rounded-xl border border-border bg-surface px-3 font-body-md text-body-md"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-muted-text">Password</span>
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-[44px] rounded-xl border border-border bg-surface px-3 font-body-md text-body-md"
            />
          </label>
          {error ? (
            <p className="rounded-xl border border-warning/30 bg-warning-soft/40 px-3 py-2 font-body-sm text-body-sm text-on-surface">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Memproses…" : mode === "signin" ? "Masuk" : "Buat akun"}
          </Button>
        </form>

        <p className="mt-4 text-center font-body-sm text-body-sm text-muted-text">
          {mode === "signin" ? (
            <>
              Belum punya akun?{" "}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
              >
                Daftar
              </button>
            </>
          ) : (
            <>
              Sudah punya akun?{" "}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
              >
                Masuk
              </button>
            </>
          )}
        </p>
      </Card>

      <p className="text-center font-body-sm text-body-sm text-muted-text">
        <Link to={ROUTES.dashboard} className="text-primary underline-offset-2 hover:underline">
          Lanjut ke dashboard
        </Link>
        {" · "}
        <a
          href="https://narraza.web.id"
          className="text-primary underline-offset-2 hover:underline"
        >
          Kembali ke beranda
        </a>
      </p>
    </div>
  );
}