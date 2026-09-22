"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { parentSignupName } from "@/lib/chat-label";
import {
  coparentJoinPath,
  familyJoinPath,
  readCoparentInvite,
  readDancerInvite,
} from "@/lib/family-invite";
import { loginPathWithNext, resolveAuthNextPath } from "@/lib/friends";

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
          Loading…
        </p>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invite = useMemo(
    () => readDancerInvite(searchParams.toString()),
    [searchParams],
  );
  const coparent = useMemo(
    () => readCoparentInvite(searchParams.toString()),
    [searchParams],
  );
  const { configured, signUp } = useAuth();
  const [roleChoice, setRoleChoice] = useState<AccountRole | null>(null);
  const role = roleChoice ?? (coparent ? "parent" : invite?.role ?? "parent");
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
  const loginHref =
    coparent && role === "parent"
      ? loginPathWithNext(coparentJoinPath(coparent.code))
      : invite
        ? loginPathWithNext(familyJoinPath(invite.family, invite.childId))
        : null;

  if (!configured) return <AuthUnavailable />;

  if (needsConfirmation) {
    return (
      <AuthCard
        title="Check your email"
        subtitle={
          invite
            ? "We sent a confirmation link. After you confirm, log in and we will finish joining the family. Until then, guest mode still works on this device."
            : "We sent a confirmation link. After you tap it, you can log in. Until then, guest mode still works on this device."
        }
      >
        <AuthLinks>
          Already confirmed?{" "}
          {loginHref ? (
            <AuthTextLink href={loginHref}>Log in</AuthTextLink>
          ) : (
            <AuthSwitchLink baseHref="/login">Log in</AuthSwitchLink>
          )}
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
            : "A parent account manages the family, enrolments and younger dancers. Your name is shown in studio chat. You can keep browsing as a guest until you sign up."
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
          let parentName = trimmedName;
          if (!dancer && !studio) {
            const named = parentSignupName(displayName);
            if (!named.ok) {
              setError(named.error);
              return;
            }
            parentName = named.name;
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
            studio ? trimmedStudio : dancer ? trimmedName : parentName,
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
          if (dancer && invite) {
            window.location.assign(familyJoinPath(invite.family, invite.childId));
            return;
          }
          if (coparent && role === "parent") {
            window.location.assign(coparentJoinPath(coparent.code));
            return;
          }
          if (studio) {
            router.push("/studio");
            return;
          }
          const next = resolveAuthNextPath();
          if (next.startsWith("/family/join") && !next.includes("coparent=")) {
            router.push("/account");
            return;
          }
          router.push(next);
        }}
      >
        {invite && dancer ? (
          <p className="rounded-control bg-primary-soft px-3 py-2 text-sm leading-6 text-primary-ink">
            This link is for a dancer login. After you create the account, you
            join the family on the profile your parent chose, if it is still
            free.
          </p>
        ) : null}
        {coparent && role === "parent" ? (
          <p className="rounded-control bg-primary-soft px-3 py-2 text-sm leading-6 text-primary-ink">
            This link is for a parent login. After you create the account, you
            accept the invite and share that family’s dancers, enrolments and
            results.
          </p>
        ) : null}
        <fieldset>
          <legend className="text-sm font-bold text-foreground">I am a</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <RoleChoice
              pressed={role === "parent"}
              onClick={() => {
                setRoleChoice("parent");
                setLoginWithUsername(false);
              }}
            >
              Parent
            </RoleChoice>
            <RoleChoice
              pressed={role === "dancer"}
              onClick={() => setRoleChoice("dancer")}
            >
              Dancer
            </RoleChoice>
            <RoleChoice
              pressed={role === "studio"}
              onClick={() => {
                setRoleChoice("studio");
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
          <>
            <AuthField
              id="display-name"
              label={dancer ? "Your name" : "Your name (shown in chat)"}
              value={displayName}
              onChange={setDisplayName}
              autoComplete="name"
              required
            />
            {dancer ? null : (
              <p className="text-sm leading-6 text-muted-foreground">
                Required. Studio chat uses your first name with your dancers, for
                example Sarah, parent of Evie and Harriet. A first name is enough.
                You can change it later on Account.
              </p>
            )}
          </>
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
          Already have an account?{" "}
          {loginHref ? (
            <AuthTextLink href={loginHref}>Log in</AuthTextLink>
          ) : (
            <AuthSwitchLink baseHref="/login">Log in</AuthSwitchLink>
          )}
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
