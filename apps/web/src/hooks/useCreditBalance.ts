import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchCreditBalance } from "@/services/credits";
import { shouldUseMocks } from "@/lib/env";
import { SHELL_MOCK } from "@/mocks/shell";

export interface CreditBalanceState {
  balance: number | null;
  loading: boolean;
  error: boolean;
  isAuthenticated: boolean;
  isMock: boolean;
}

export function useCreditBalance(): CreditBalanceState {
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token ?? null;
  const useMocks = shouldUseMocks();

  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (useMocks || !token) {
      setBalance(useMocks ? SHELL_MOCK.credits : null);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);
      try {
        const creditBalance = await fetchCreditBalance(token);
        if (cancelled) return;
        if (creditBalance) {
          setBalance(creditBalance.balance);
        } else {
          setBalance(0);
        }
      } catch (err) {
        if (cancelled) return;
        setError(true);
        setBalance(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, token, useMocks]);

  return {
    balance,
    loading: authLoading || loading,
    error,
    isAuthenticated: Boolean(token),
    isMock: useMocks,
  };
}
