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
import { friendlyAuthError } from "@/lib/auth-errors";
import { authRedirectTo, getSupabase, isSupabaseConfigured } from "@/lib/supabase";

interface AuthContextValue {
  configured: boolean;
  ready: boolean;
  user: User | null;
  session: Session | null;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }

    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
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
          data: displayName?.trim()
            ? { display_name: displayName.trim() }
            : undefined,
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

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: "Accounts are not connected in this environment yet." };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
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
      user: session?.user ?? null,
      session,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
    }),
    [
      configured,
      ready,
      session,
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
