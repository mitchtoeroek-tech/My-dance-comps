"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AccountProfile, AccountRole } from "@/lib/account";
import { loginIdentifierToEmail } from "@/lib/account";
import { friendlyAuthError } from "@/lib/auth-errors";
import { claimFamilyInvites, loadAccountProfile } from "@/lib/family-link";
import { authRedirectTo, getSupabase, isSupabaseConfigured } from "@/lib/supabase";

interface SignUpMeta {
  role?: AccountRole;
  username?: string;
}

interface AuthContextValue {
  configured: boolean;
  ready: boolean;
  /** False while the profile role and family link are loading. */
  accountReady: boolean;
  user: User | null;
  session: Session | null;
  account: AccountProfile | null;
  refreshAccount: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
    meta?: SignUpMeta,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signIn: (
    identifier: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [accountReady, setAccountReady] = useState(!configured);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }

    let cancelled = false;

    const loadAccount = (nextUser: User | null) => {
      if (!nextUser) {
        setAccount(null);
        setAccountReady(true);
        return;
      }
      setAccountReady(false);
      const current = nextUser;
      void (async () => {
        let profile = await loadAccountProfile(current);
        if (cancelled) return;
        if (profile.role === "dancer" && !profile.familyId) {
          const claim = await claimFamilyInvites();
          if (claim.status === "linked") {
            profile = await loadAccountProfile(current);
          }
        }
        if (cancelled) return;
        setAccount(profile);
        setAccountReady(true);
      })();
    };

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setReady(true);
      loadAccount(data.session?.user ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
      loadAccount(nextSession?.user ?? null);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const refreshAccount = useCallback(async () => {
    const current = session?.user;
    if (!current) {
      setAccount(null);
      setAccountReady(true);
      return;
    }
    const profile = await loadAccountProfile(current);
    setAccount(profile);
    setAccountReady(true);
  }, [session?.user]);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      displayName?: string,
      meta?: SignUpMeta,
    ) => {
      const supabase = getSupabase();
      if (!supabase) {
        return {
          error: "Accounts are not connected in this environment yet.",
          needsConfirmation: false,
        };
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: authRedirectTo("/account"),
          data: {
            ...(displayName?.trim()
              ? { display_name: displayName.trim() }
              : {}),
            role: meta?.role === "dancer" ? "dancer" : "parent",
            ...(meta?.username ? { username: meta.username } : {}),
          },
        },
      });
      if (error) {
        return { error: friendlyAuthError(error), needsConfirmation: false };
      }
      return {
        error: null,
        needsConfirmation: !data.session,
      };
    },
    [],
  );

  const signIn = useCallback(async (identifier: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: "Accounts are not connected in this environment yet." };
    }
    const email = loginIdentifierToEmail(identifier);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? friendlyAuthError(error) : null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: "Accounts are not connected in this environment yet." };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectTo("/reset-password"),
    });
    return { error: error ? friendlyAuthError(error) : null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: "Accounts are not connected in this environment yet." };
    }
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? friendlyAuthError(error) : null };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      ready,
      accountReady,
      user: session?.user ?? null,
      session,
      account,
      refreshAccount,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
    }),
    [
      configured,
      ready,
      accountReady,
      session,
      account,
      refreshAccount,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
