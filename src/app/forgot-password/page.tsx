"use client";

import { useState } from "react";
import {
  AuthCard,
  AuthError,
  AuthField,
  AuthLinks,
  AuthSubmit,
  AuthTextLink,
  AuthUnavailable,
} from "@/components/AuthCard";
import { useAuth } from "@/context/AuthContext";

export default function ForgotPasswordPage() {
  const { configured, sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!configured) return <AuthUnavailable />;

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="If that address has an account, we sent a reset link. It opens the My Dance Comps reset page — not a generic Supabase screen."
      >
        <AuthLinks>
          <AuthTextLink href="/login">Back to log in</AuthTextLink>
        </AuthLinks>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot password"
      subtitle="We’ll email a reset link. You can keep using the app as a guest in the meantime."
    >
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setPending(true);
          const result = await sendPasswordReset(email);
          setPending(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSent(true);
        }}
      >
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <AuthError message={error} />
        <AuthSubmit pending={pending}>Send reset link</AuthSubmit>
      </form>
      <div className="mt-4">
        <AuthLinks>
          Remembered it? <AuthTextLink href="/login">Log in</AuthTextLink>
        </AuthLinks>
      </div>
    </AuthCard>
  );
}
