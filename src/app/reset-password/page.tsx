"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const { configured, ready, session, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!configured) return <AuthUnavailable />;

  if (!ready) {
    return (
      <AuthCard title="Reset password" subtitle="Opening your reset link…">
        <p className="text-sm text-muted-foreground">Just a moment.</p>
      </AuthCard>
    );
  }

  if (!session) {
    return (
      <AuthCard
        title="Reset link needed"
        subtitle="Use the link from your email, or request a new one. Guest browsing on the home screen still works."
      >
        <AuthLinks>
          <AuthTextLink href="/forgot-password">Send a new reset link</AuthTextLink>
        </AuthLinks>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="This updates the password for your My Dance Comps account."
    >
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          if (password.length < 6) {
            setError("Password needs to be at least 6 characters.");
            return;
          }
          if (password !== confirm) {
            setError("Those passwords do not match.");
            return;
          }
          setPending(true);
          const result = await updatePassword(password);
          setPending(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          router.push("/account");
        }}
      >
        <AuthField
          id="password"
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={6}
        />
        <AuthField
          id="confirm-password"
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
          minLength={6}
        />
        <AuthError message={error} />
        <AuthSubmit pending={pending}>Save password</AuthSubmit>
      </form>
    </AuthCard>
  );
}
