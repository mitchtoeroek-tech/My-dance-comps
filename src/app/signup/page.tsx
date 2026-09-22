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
import {
  dancerLoginEmail,
  normalizeDancerUsername,
  type AccountRole,
} from "@/lib/account";
import { resolveAuthNextPath } from "@/lib/friends";

export default function SignUpPage() {
  const router = useRouter();
  const { configured, signUp } = useAuth();
  const [role, setRole] = useState<AccountRole>("parent");
  const [loginWithUsername, setLoginWithUsername] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [studioName, setStudioName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const dancer = role === "dancer";
  const studio = role === "studio";
  const usernameLogin = dancer && loginWithUsername;

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
      subtitle={
        studio
          ? "A studio account stays private until My Dance Comps approves it. You can add your logo, styles and address while you wait. Dancers can link to you once you are approved."
          : dancer
            ? "A dancer login is your own. After you join a family with a parent’s code, comps, My Comps, friends and Community are yours. Your parent can still enrol you."
            : "A parent account manages the family, enrolments and younger dancers. You can keep browsing as a guest until you sign up."
      }
    >
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          const trimmedName = displayName.trim();
          let loginEmail = email.trim();
          let dancerUsername: string | undefined;
          if (usernameLogin) {
            const normalized = normalizeDancerUsername(username);
            if (!normalized) {
              setError(
                "Usernames are 3–24 characters and use letters, numbers, dots, underscores or hyphens.",
              );
              return;
            }
            dancerUsername = normalized;
            loginEmail = dancerLoginEmail(normalized);
          }
          if (dancer && !trimmedName) {
            setError("Add your name so your parent can see who joined.");
            return;
          }
          const trimmedStudio = studioName.trim();
          if (studio && trimmedStudio.length < 2) {
            setError("Add your studio name.");
            return;
          }
          setPending(true);
          const result = await signUp(
            loginEmail,
            password,
            studio ? trimmedStudio : trimmedName,
            {
              role,
              username: dancerUsername,
              studioName: studio ? trimmedStudio : undefined,
            },
          );
          setPending(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          if (result.needsConfirmation) {
            setNeedsConfirmation(true);
            return;
          }
          router.push(studio ? "/studio" : resolveAuthNextPath());
        }}
      >
        <fieldset>
          <legend className="text-sm font-bold text-foreground">I am a</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <RoleChoice
              pressed={role === "parent"}
              onClick={() => {
                setRole("parent");
                setLoginWithUsername(false);
              }}
            >
              Parent
            </RoleChoice>
            <RoleChoice
              pressed={role === "dancer"}
              onClick={() => setRole("dancer")}
            >
              Dancer
            </RoleChoice>
            <RoleChoice
              pressed={role === "studio"}
              onClick={() => {
                setRole("studio");
                setLoginWithUsername(false);
              }}
            >
              Studio
            </RoleChoice>
          </div>
        </fieldset>
        {studio ? (
          <AuthField
            id="studio-name"
            label="Studio name"
            value={studioName}
            onChange={setStudioName}
            autoComplete="organization"
            required
          />
        ) : (
          <AuthField
            id="display-name"
            label={dancer ? "Your name" : "Your name (optional)"}
            value={displayName}
            onChange={setDisplayName}
            autoComplete="name"
            required={dancer}
          />
        )}
        {dancer ? (
          <fieldset>
            <legend className="text-sm font-bold text-foreground">Log in with</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <RoleChoice
                pressed={!loginWithUsername}
                onClick={() => setLoginWithUsername(false)}
              >
                Email
              </RoleChoice>
              <RoleChoice
                pressed={loginWithUsername}
                onClick={() => setLoginWithUsername(true)}
              >
                Username
              </RoleChoice>
            </div>
          </fieldset>
        ) : null}
        {usernameLogin ? (
          <AuthField
            id="username"
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="username"
            required
            minLength={3}
          />
        ) : (
          <AuthField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
        )}
        <AuthField
          id="password"
          label={usernameLogin ? "PIN (at least 6 characters)" : "Password"}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={6}
        />
        <AuthError message={error} />
        <AuthSubmit pending={pending}>
          {studio ? "Create studio account" : dancer ? "Create dancer login" : "Sign up"}
        </AuthSubmit>
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

function RoleChoice({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-11 rounded-control px-3 py-2 text-sm font-bold ${
        pressed
          ? "bg-primary text-white"
          : "bg-surface text-foreground ring-1 ring-border"
      }`}
    >
      {children}
    </button>
  );
}
