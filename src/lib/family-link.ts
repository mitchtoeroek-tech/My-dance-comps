import type { AccountProfile } from "./account";
import { normalizeFamilyCode, resolveAccountRole } from "./account";
import { friendlyAuthError } from "./auth-errors";
import { normalizeChatDisplayName } from "./chat-label";
import { pickUnlinkedInviteChild } from "./family-invite";
import { getSupabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

export interface FamilyCodeResult {
  ok: boolean;
  familyId?: string;
  inviteCode?: string;
  error?: string;
}

export interface FamilyPreviewDancer {
  id: string;
  name: string;
  linked: boolean;
}

export interface FamilyPreview {
  ok: boolean;
  familyName: string;
  dancers: FamilyPreviewDancer[];
  error?: string;
}

export interface FamilyActionResult {
  ok: boolean;
  status?: string;
  childId?: string;
  error?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function friendlyFamilyError(
  error: { message?: string } | string | null | undefined,
): string {
  const message = typeof error === "string" ? error : (error?.message ?? "");
  const lower = message.toLowerCase();
  if (
    lower.includes("could not find the function") &&
    (lower.includes("coparent") ||
      lower.includes("household") ||
      lower.includes("leave_parent"))
  ) {
    return "Co-parent invites are not set up on this project yet. Run the co-parent family SQL in Supabase, then try again.";
  }
  if (
    lower.includes("could not find the function") ||
    lower.includes("schema cache") ||
    lower.includes("does not exist") ||
    (lower.includes("column") && lower.includes("role"))
  ) {
    return "Family logins are not set up on this project yet. Run the dancer accounts SQL in Supabase, then try again.";
  }
  if (lower.includes("not authenticated")) return "Sign in to manage your family.";
  if (lower.includes("not recognised") || lower.includes("not recognized")) {
    return "That family code was not recognised. Check it with your parent and try again.";
  }
  if (lower.includes("already in a family")) {
    return "That dancer is already in a family.";
  }
  if (lower.includes("not available to link")) {
    return "That dancer profile already has a login, or it is not in this family.";
  }
  if (lower.includes("parent account")) {
    return "That email is a parent account. Dancers need their own sign-up.";
  }
  if (lower.includes("parents create")) {
    return "Family codes are created from a parent account.";
  }
  if (lower.includes("only a dancer")) {
    return "Join a family from a dancer account.";
  }
  if (lower.includes("username logins")) {
    return "That dancer uses a username. Ask them to enter your family code.";
  }
  if (lower.includes("enter the dancer")) {
    return "Enter the dancer’s email address.";
  }
  if (lower.includes("does not have their own login")) {
    return "That dancer does not have their own login yet.";
  }
  if (lower.includes("not in a family")) {
    return "You are not in a family yet.";
  }
  if (lower.includes("co-parent invites are for parent")) {
    return "Co-parent invites are for a parent account. Dancers use the dancer family code.";
  }
  if (lower.includes("co-parent invite was not recognised")) {
    return "That co-parent invite was not recognised. Check it with the other parent and try again.";
  }
  if (lower.includes("already in this family")) {
    return "That parent is already in this family.";
  }
  if (
    lower.includes("already in another family") ||
    lower.includes("leave your current family")
  ) {
    return "Leave your current family before joining another.";
  }
  if (lower.includes("dancer account")) {
    return "That email is a dancer account. Co-parents need a parent login.";
  }
  if (lower.includes("studio account")) {
    return "That email is a studio account. Co-parents need a parent login.";
  }
  if (lower.includes("own email")) {
    return "That is your own email.";
  }
  if (lower.includes("enter the parent")) {
    return "Enter the parent’s email address.";
  }
  if (lower.includes("dancer still has their own login")) {
    return "A dancer still has their own login in this family. Invite another parent, or remove those logins, before you leave.";
  }
  if (!message) return "Something went wrong. Please try again.";
  return friendlyAuthError(message);
}

async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ data: T | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      data: null,
      error: "Accounts are not connected in this environment yet.",
    };
  }
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { data: null, error: friendlyFamilyError(error) };
  return { data: (data as T) ?? null, error: null };
}

/** Saves the parent name shown in studio chat. Blank is allowed. */
export async function saveChatDisplayName(
  raw: string,
): Promise<{ error: string | null }> {
  const name = normalizeChatDisplayName(raw);
  if (name === null) {
    return { error: "Use your name. Email addresses are hidden in chat." };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { error: "Accounts are not connected in this environment yet." };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      error: userError ? friendlyAuthError(userError) : "Sign in to save your name.",
    };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", userData.user.id);
  if (error) return { error: friendlyAuthError(error) };
  // Profile is what chat reads. Metadata only covers a missing profile row.
  await supabase.auth.updateUser({ data: { display_name: name } });
  return { error: null };
}

export async function loadAccountProfile(user: User): Promise<AccountProfile> {
  const metadataRole = asRecord(user.user_metadata)?.role;
  const fallback: AccountProfile = {
    role: resolveAccountRole(undefined, metadataRole),
    familyId: null,
    linkedChildId: null,
    displayName:
      typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : null,
    username: null,
  };
  const supabase = getSupabase();
  if (!supabase) return fallback;
  const { data, error } = await supabase
    .from("profiles")
    .select("role, family_id, linked_child_id, display_name, username")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return fallback;
  const row = data as {
    role?: unknown;
    family_id?: unknown;
    linked_child_id?: unknown;
    display_name?: unknown;
    username?: unknown;
  };
  return {
    role: resolveAccountRole(row.role, metadataRole),
    familyId: asString(row.family_id) || null,
    linkedChildId: asString(row.linked_child_id) || null,
    displayName: asString(row.display_name) || fallback.displayName,
    username: asString(row.username) || null,
  };
}

export async function claimFamilyInvites(): Promise<FamilyActionResult> {
  const { data, error } = await rpc<unknown>("claim_family_invites");
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return {
    ok: row.ok !== false,
    status: asString(row.status) || undefined,
    childId: asString(row.child_id) || undefined,
  };
}

export async function ensureFamily(): Promise<FamilyCodeResult> {
  const { data, error } = await rpc<unknown>("ensure_family");
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  const inviteCode = asString(row.invite_code);
  if (!inviteCode) return { ok: false, error: "Could not create a family code." };
  return {
    ok: true,
    familyId: asString(row.family_id) || undefined,
    inviteCode,
  };
}

export async function previewFamilyCode(code: string): Promise<FamilyPreview> {
  const { data, error } = await rpc<unknown>("preview_family_code", {
    p_code: code,
  });
  if (error) return { ok: false, familyName: "", dancers: [], error };
  const row = asRecord(data) ?? {};
  if (row.ok !== true) {
    return {
      ok: false,
      familyName: "",
      dancers: [],
      error: "That family code was not recognised. Check it with your parent and try again.",
    };
  }
  const dancers = Array.isArray(row.dancers)
    ? row.dancers.flatMap((item) => {
        const dancer = asRecord(item);
        const id = asString(dancer?.id);
        const name = asString(dancer?.name);
        if (!id || !name) return [];
        return [{ id, name, linked: dancer?.linked === true }];
      })
    : [];
  return {
    ok: true,
    familyName: asString(row.family_name) || "Your parent",
    dancers,
  };
}

export async function joinFamily(
  code: string,
  childId: string | null,
): Promise<FamilyActionResult> {
  const { data, error } = await rpc<unknown>("join_family", {
    p_code: code,
    p_child_id: childId ?? "",
  });
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return {
    ok: row.ok !== false,
    childId: asString(row.child_id) || undefined,
    status: "joined",
  };
}

export async function inviteDancerByEmail(
  email: string,
  childId: string | null,
): Promise<FamilyActionResult> {
  const { data, error } = await rpc<unknown>("invite_dancer_by_email", {
    p_email: email.trim(),
    p_child_id: childId ?? "",
  });
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return {
    ok: row.ok !== false,
    status: asString(row.status) || "pending",
    childId: asString(row.child_id) || undefined,
  };
}

export async function unlinkDancer(childId: string): Promise<FamilyActionResult> {
  const { data, error } = await rpc<unknown>("unlink_dancer", {
    p_child_id: childId,
  });
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return { ok: row.ok !== false, status: asString(row.status) || "unlinked" };
}

export type DancerInviteApplyResult =
  | { status: "joined"; childId: string }
  | { status: "choose"; familyName: string; dancers: FamilyPreviewDancer[] }
  | { status: "already" }
  | { status: "error"; error: string };

const inviteApplyInflight = new Map<string, Promise<DancerInviteApplyResult>>();

function alreadyInFamilyMessage(error: string | undefined): boolean {
  return (error ?? "").toLowerCase().includes("already in a family");
}

async function applyDancerFamilyInviteOnce(
  code: string,
  childId: string,
): Promise<DancerInviteApplyResult> {
  const family = normalizeFamilyCode(code);
  if (!family) {
    return {
      status: "error",
      error:
        "That family code was not recognised. Check it with your parent and try again.",
    };
  }
  const preview = await previewFamilyCode(family);
  if (!preview.ok) {
    return {
      status: "error",
      error:
        preview.error ??
        "That family code was not recognised. Check it with your parent and try again.",
    };
  }
  const target = pickUnlinkedInviteChild(preview.dancers, childId);
  if (!target) {
    return {
      status: "choose",
      familyName: preview.familyName,
      dancers: preview.dancers,
    };
  }
  const joined = await joinFamily(family, target);
  if (alreadyInFamilyMessage(joined.error)) {
    return { status: "already" };
  }
  if (joined.error || !joined.ok) {
    return {
      status: "error",
      error: joined.error ?? "Could not join that family.",
    };
  }
  return { status: "joined", childId: joined.childId || target };
}

/** Preview the family, then join the named profile when it is still unlinked. */
export function applyDancerFamilyInvite(
  code: string,
  childId: string,
): Promise<DancerInviteApplyResult> {
  const key = `${normalizeFamilyCode(code)}:${childId.trim()}`;
  const existing = inviteApplyInflight.get(key);
  if (existing) return existing;
  const promise = applyDancerFamilyInviteOnce(code, childId).finally(() => {
    inviteApplyInflight.delete(key);
  });
  inviteApplyInflight.set(key, promise);
  return promise;
}

export async function leaveFamily(): Promise<FamilyActionResult> {
  const { data, error } = await rpc<unknown>("leave_family");
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return { ok: row.ok !== false, status: asString(row.status) || "left" };
}

export interface FamilyParent {
  displayName: string;
  isOwner: boolean;
  isYou: boolean;
}

export interface CoparentInvitePreview {
  ok: boolean;
  familyName: string;
  parents: string[];
  error?: string;
}

export interface MyCoparentInvite {
  familyName: string;
  inviterName: string;
  code: string;
}

export async function ensureCoparentInvite(): Promise<FamilyCodeResult> {
  const { data, error } = await rpc<unknown>("ensure_coparent_invite");
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  const inviteCode = asString(row.coparent_code);
  if (!inviteCode) return { ok: false, error: "Could not create a co-parent invite." };
  return {
    ok: true,
    familyId: asString(row.family_id) || undefined,
    inviteCode,
  };
}

export async function listFamilyParents(): Promise<{
  parents: FamilyParent[];
  error?: string;
}> {
  const { data, error } = await rpc<unknown>("list_family_parents");
  if (error) return { parents: [], error };
  const rows = Array.isArray(data) ? data : [];
  const parents = rows.flatMap((item) => {
    const row = asRecord(item);
    const displayName = asString(row?.display_name).trim();
    if (!displayName) return [];
    return [
      {
        displayName,
        isOwner: row?.is_owner === true,
        isYou: row?.is_you === true,
      },
    ];
  });
  return { parents };
}

export async function inviteCoparentByEmail(
  email: string,
): Promise<FamilyActionResult> {
  const { data, error } = await rpc<unknown>("invite_coparent_by_email", {
    p_email: email.trim(),
  });
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return { ok: row.ok !== false, status: asString(row.status) || "pending" };
}

export async function previewCoparentInvite(
  code: string,
): Promise<CoparentInvitePreview> {
  const { data, error } = await rpc<unknown>("preview_coparent_invite", {
    p_code: code,
  });
  if (error) return { ok: false, familyName: "", parents: [], error };
  const row = asRecord(data) ?? {};
  if (row.ok !== true) {
    return {
      ok: false,
      familyName: "",
      parents: [],
      error:
        "That co-parent invite was not recognised. Check it with the other parent and try again.",
    };
  }
  const parents = Array.isArray(row.parents)
    ? row.parents.filter((name): name is string => typeof name === "string" && name.trim() !== "")
    : [];
  return {
    ok: true,
    familyName: asString(row.family_name) || "A parent",
    parents,
  };
}

export async function listMyCoparentInvites(): Promise<{
  invites: MyCoparentInvite[];
  error?: string;
}> {
  const { data, error } = await rpc<unknown>("list_my_coparent_invites");
  if (error) return { invites: [], error };
  const rows = Array.isArray(data) ? data : [];
  const invites = rows.flatMap((item) => {
    const row = asRecord(item);
    const code = asString(row?.code);
    if (!code) return [];
    return [
      {
        code,
        familyName: asString(row?.family_name) || "A parent",
        inviterName: asString(row?.inviter_name) || "A parent",
      },
    ];
  });
  return { invites };
}

export async function acceptCoparentInvite(
  code: string,
): Promise<FamilyActionResult> {
  const { data, error } = await rpc<unknown>("accept_coparent_invite", {
    p_code: code,
  });
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return {
    ok: row.ok !== false,
    status: asString(row.status) || "joined",
  };
}

export async function leaveParentFamily(): Promise<FamilyActionResult> {
  const { data, error } = await rpc<unknown>("leave_parent_family");
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return { ok: row.ok !== false, status: asString(row.status) || "left" };
}
