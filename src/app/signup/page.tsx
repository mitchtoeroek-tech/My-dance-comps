"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthCard,
  AuthError,
  AuthField,
  AuthLinks,
  AuthSubmit,
  AuthSwitchLink,
  AuthTextLink,
  AuthUnavailable,
} from "@/components/AuthCard";
import { useAuth } from "@/context/AuthContext";
import { resolveAuthNextPath } from "@/lib/friends";

export default function SignUpPage() {
  const router = useRouter();
  const { configured, signUp } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  if (!configured) return <AuthUnavailable />;

  if (needsConfirmation) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="We sent a confirmation link. After you tap it, you can log in. Until then, guest mode still works on this device."
      >
        <AuthLinks>
          Already confirmed? <AuthSwitchLink baseHref="/login">Log in</AuthSwitchLink>
        </AuthLinks>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create an account"
      subtitle="Optional. You can keep using My Dance Comps as a guest — an account just syncs dancers, saved comps, results and enrolled comps across devices."
    >
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setPending(true);
          const result = await signUp(email, password, displayName);
          setPending(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          if (result.needsConfirmation) {
            setNeedsConfirmation(true);
            return;
          }
          router.push(resolveAuthNextPath());
        }}
      >
        <AuthField
          id="display-name"
          label="Your name (optional)"
          value={displayName}
          onChange={setDisplayName}
          autoComplete="name"
        />
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={6}
        />
        <AuthError message={error} />
        <AuthSubmit pending={pending}>Sign up</AuthSubmit>
      </form>
      <div className="mt-4 space-y-2">
        <AuthLinks>
          Already have an account? <AuthSwitchLink baseHref="/login">Log in</AuthSwitchLink>
        </AuthLinks>
        <AuthLinks>
          <AuthTextLink href="/">Continue as guest</AuthTextLink>
        </AuthLinks>
      </div>
    </AuthCard>
  );
}
