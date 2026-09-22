"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFamily } from "@/context/FamilyContext";
import { displayFamilyCode } from "@/lib/account";
import {
  applyDancerFamilyInvite,
  joinFamily,
  type DancerInviteApplyResult,
  type FamilyPreviewDancer,
} from "@/lib/family-link";
import { CoparentJoin } from "@/components/CoparentJoin";
import { dancerInvitePath, familyJoinPath, readCoparentInvite, readDancerInvite } from "@/lib/family-invite";
import { loginPathWithNext } from "@/lib/friends";

export default function FamilyJoinPage() {
  return (
    <Suspense
      fallback={
        <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
          Loading invite…
        </p>
      }
    >
      <FamilyJoinInner />
    </Suspense>
  );
}

function FamilyJoinInner() {
  const searchParams = useSearchParams();
  const coparent = useMemo(
    () => readCoparentInvite(searchParams.toString()),
    [searchParams],
  );
  if (coparent) return <CoparentJoin code={coparent.code} />;
  return <DancerFamilyJoin />;
}

function DancerFamilyJoin() {
  const searchParams = useSearchParams();
  const invite = useMemo(
    () => readDancerInvite(searchParams.toString()),
    [searchParams],
  );
  const { configured, ready, user, account, accountReady, refreshAccount } =
    useAuth();
  const { refreshCloud } = useFamily();
  const [phase, setPhase] = useState<"idle" | DancerInviteApplyResult["status"]>(
    "idle",
  );
  const [apply, setApply] = useState<DancerInviteApplyResult | null>(null);
  const [joinedId, setJoinedId] = useState("");
  const [chooseError, setChooseError] = useState("");
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const family = invite?.family ?? "";
  const childId = invite?.childId ?? "";
  const inFamily = Boolean(account?.familyId);
  const canApply =
    configured &&
    ready &&
    accountReady &&
    Boolean(user) &&
    account?.role === "dancer" &&
    !inFamily &&
    Boolean(family);

  useEffect(() => {
    if (!canApply || phase !== "idle") return;
    let active = true;
    void applyDancerFamilyInvite(family, childId).then(async (result) => {
      if (!active) return;
      if (result.status === "joined") {
        setJoinedId(result.childId);
        await refreshAccount();
        refreshCloud();
      } else if (result.status === "already") {
        await refreshAccount();
        refreshCloud();
      }
      if (!active) return;
      setApply(result);
      setPhase(result.status);
    });
    return () => {
      active = false;
    };
  }, [
    canApply,
    phase,
    family,
    childId,
    attempt,
    refreshAccount,
    refreshCloud,
  ]);

  if (!family) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Join your family</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Ask your parent for an invite link from your dancer page. It includes
          their family code.
        </p>
        <Link
          href="/account"
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary-ink underline"
        >
          Back to Account
        </Link>
      </div>
    );
  }

  if (!ready || (user && !accountReady)) {
    return (
      <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
        Loading invite…
      </p>
    );
  }

  const profileId =
    account?.linkedChildId ||
    joinedId ||
    (apply?.status === "joined" ? apply.childId : "");

  if (!user) {
    const signupHref = dancerInvitePath(family, childId);
    const loginHref = loginPathWithNext(familyJoinPath(family, childId));
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Join your family</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Create a dancer login with this invite. You join the family and, when
          the profile is still free, land on the one your parent chose. They can
          still enrol you.
        </p>
        <p className="rounded-card bg-surface p-4 text-center text-2xl font-bold tracking-wide shadow-card ring-1 ring-border">
          {displayFamilyCode(family)}
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={signupHref}
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Create dancer login
          </Link>
          <Link
            href={loginHref}
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-surface px-4 py-2 text-sm font-bold text-primary-ink ring-1 ring-primary"
          >
            I already have a login
          </Link>
        </div>
      </div>
    );
  }

  if (account?.role !== "dancer") {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">This invite is for a dancer</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {account?.role === "studio"
            ? "A studio login cannot join a family. The dancer opens this link and signs up as themselves."
            : "You are signed in as a parent. The dancer opens this link on their phone and creates their own login. You can still enrol them."}
        </p>
        <Link
          href="/kids"
          className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Back to My Dancers
        </Link>
      </div>
    );
  }

  if (inFamily || phase === "joined" || phase === "already") {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">You are in the family</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          This login uses your dancer profile. A parent can still enrol you.
        </p>
        <Link
          href={profileId ? `/kids/${profileId}` : "/kids"}
          className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Open my profile
        </Link>
      </div>
    );
  }

  if (phase === "choose" && apply?.status === "choose") {
    return (
      <ChooseDancer
        familyName={apply.familyName}
        dancers={apply.dancers}
        namedChildId={childId}
        pending={pending}
        error={chooseError}
        onJoin={async (nextChildId) => {
          setPending(true);
          setChooseError("");
          const result = await joinFamily(family, nextChildId);
          setPending(false);
          if (result.error || !result.ok) {
            setChooseError(result.error ?? "Could not join that family.");
            return;
          }
          setJoinedId(result.childId || nextChildId || "");
          await refreshAccount();
          refreshCloud();
          setPhase("joined");
        }}
      />
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Join your family</h1>
        <p
          className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink"
          role="alert"
        >
          {apply?.status === "error"
            ? apply.error
            : "Could not join that family."}
        </p>
        <button
          type="button"
          onClick={() => {
            setChooseError("");
            setApply(null);
            setPhase("idle");
            setAttempt((value) => value + 1);
          }}
          className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <p className="py-8 text-center text-sm font-semibold text-muted-foreground">
      Joining the family…
    </p>
  );
}

function ChooseDancer({
  familyName,
  dancers,
  namedChildId,
  pending,
  error,
  onJoin,
}: {
  familyName: string;
  dancers: FamilyPreviewDancer[];
  namedChildId: string;
  pending: boolean;
  error: string;
  onJoin: (childId: string | null) => Promise<void>;
}) {
  const named = dancers.find((dancer) => dancer.id === namedChildId);
  const open = dancers.filter((dancer) => !dancer.linked);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Which dancer are you?</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        {familyName}&apos;s family.
        {named?.linked
          ? " That profile already has a login. Pick another dancer, or add yourself."
          : " Pick your name to use that profile."}
      </p>
      {error ? (
        <p
          className="rounded-control bg-status-closed px-3 py-2 text-sm font-semibold text-status-closed-ink"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <ul className="space-y-2">
        {open.map((dancer) => (
          <li key={dancer.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => void onJoin(dancer.id)}
              className="inline-flex min-h-11 w-full items-center rounded-control bg-surface px-3 py-2 text-left text-sm font-bold text-primary-ink ring-1 ring-primary disabled:opacity-60"
            >
              I&apos;m {dancer.name}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={pending}
        onClick={() => void onJoin(null)}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "Please wait…" : "I am not on the list — add me"}
      </button>
    </div>
  );
}
