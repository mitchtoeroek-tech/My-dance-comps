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

export default function LogInPage() {
  const router = useRouter();
  const { configured, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!configured) return <AuthUnavailable />;

  return (
    <AuthCard
      title="Log in"
      subtitle="Parents use their email. Dancers can use email or the username they signed up with. Guest browsing stays on the home screen."
    >
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setPending(true);
          const result = await signIn(email, password);
          setPending(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          const next = resolveAuthNextPath();
          if (next.startsWith("/family/join")) {
            window.location.assign(next);
            return;
          }
          router.push(next);
        }}
      >
        <AuthField
          id="email"
          label="Email or dancer username"
          value={email}
          onChange={setEmail}
          autoComplete="username"
          required
        />
        <AuthField
          id="password"
          label="Password or PIN"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        <AuthError message={error} />
        <AuthSubmit pending={pending}>Log in</AuthSubmit>
      </form>
      <div className="mt-4 space-y-2">
        <AuthLinks>
          <AuthTextLink href="/forgot-password">Forgot password?</AuthTextLink>
        </AuthLinks>
        <AuthLinks>
          Need an account? <AuthSwitchLink baseHref="/signup">Sign up</AuthSwitchLink>
        </AuthLinks>
        <AuthLinks>
          <AuthTextLink href="/">Continue as guest</AuthTextLink>
        </AuthLinks>
      </div>
    </AuthCard>
  );
}
