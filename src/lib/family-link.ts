import type { AccountProfile } from "./account";
import { resolveAccountRole } from "./account";
import { friendlyAuthError } from "./auth-errors";
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

export async function leaveFamily(): Promise<FamilyActionResult> {
  const { data, error } = await rpc<unknown>("leave_family");
  if (error) return { ok: false, error };
  const row = asRecord(data) ?? {};
  return { ok: row.ok !== false, status: asString(row.status) || "left" };
}
