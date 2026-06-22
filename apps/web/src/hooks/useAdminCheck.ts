import { useEffect, useState } from "react";
import { USER_ROLES } from "@vibenovel/shared";
import { useAuth } from "@/context/AuthContext";
import { shouldUseMocks } from "@/lib/env";
import { fetchMe } from "@/services/me";

const ADMIN_ROLE_RANK: Record<string, number> = {
  [USER_ROLES.admin]: 1,
  [USER_ROLES.super_admin]: 2,
};

let cachedAdminCheck: {
  userId: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
} | null = null;

export interface AdminCheckState {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
}

export function useAdminCheck(): AdminCheckState {
  const { session, user, loading: authLoading } = useAuth();
  const useMocks = shouldUseMocks();
  const [state, setState] = useState<AdminCheckState>(() => {
    if (user && cachedAdminCheck?.userId === user.id) {
      return {
        isAdmin: cachedAdminCheck.isAdmin,
        isSuperAdmin: cachedAdminCheck.isSuperAdmin,
        loading: false,
      };
    }
    return { isAdmin: false, isSuperAdmin: false, loading: true };
  });

  useEffect(() => {
    if (useMocks) {
      setState({ isAdmin: false, isSuperAdmin: false, loading: false });
      return;
    }

    if (authLoading) {
      setState((prev) => ({ ...prev, loading: true }));
      return;
    }

    if (!session || !user) {
      cachedAdminCheck = null;
      setState({ isAdmin: false, isSuperAdmin: false, loading: false });
      return;
    }

    if (cachedAdminCheck?.userId === user.id) {
      setState({
        isAdmin: cachedAdminCheck.isAdmin,
        isSuperAdmin: cachedAdminCheck.isSuperAdmin,
        loading: false,
      });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const me = await fetchMe(session.access_token);
        const role = me.profile.role ?? USER_ROLES.writer;
        const isSuperAdmin = role === USER_ROLES.super_admin;
        const isAdmin = (ADMIN_ROLE_RANK[role] ?? 0) >= 1;
        cachedAdminCheck = { userId: user.id, isAdmin, isSuperAdmin };
        if (!cancelled) {
          setState({ isAdmin, isSuperAdmin, loading: false });
        }
      } catch {
        cachedAdminCheck = { userId: user.id, isAdmin: false, isSuperAdmin: false };
        if (!cancelled) {
          setState({ isAdmin: false, isSuperAdmin: false, loading: false });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, session, user, useMocks]);

  return state;
}