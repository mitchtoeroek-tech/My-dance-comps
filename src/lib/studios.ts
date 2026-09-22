import type { User } from "@supabase/supabase-js";
import { DANCE_STYLES, isAuStateCode, type AuStateCode, type DanceStyle } from "./types";
import { getSupabase, getSupabaseUrl } from "./supabase";

export const STUDIO_LOGO_BUCKET = "studio-logos";
export const STUDIO_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const STUDIO_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Built-in admin. Extra addresses can be added with NEXT_PUBLIC_ADMIN_EMAILS. */
export const DEFAULT_ADMIN_EMAILS = ["mitch@greenefficientliving.com.au"] as const;

export type StudioStatus = "pending" | "approved" | "rejected";

export interface StudioDraft {
  name: string;
  about: string;
  styles: DanceStyle[];
  addressLine: string;
  suburb: string;
  state: AuStateCode;
  postcode: string;
  phone: string;
  website: string;
  contactEmail: string;
}

export interface StudioRecord extends StudioDraft {
  id: string;
  ownerId: string;
  slug: string;
  logoPath: string | null;
  status: StudioStatus;
  updatedAt: string;
}

export interface StudioSummary {
  id: string;
  name: string;
  slug: string;
  suburb: string;
  state: AuStateCode;
  styles: DanceStyle[];
}

const STUDIO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseStudioId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return STUDIO_UUID.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function parseStudioStatus(value: unknown): StudioStatus {
  if (value === "approved" || value === "rejected" || value === "pending") {
    return value;
  }
  return "pending";
}

export function isPublicStudio(status: StudioStatus): boolean {
  return status === "approved";
}

export function adminAllowlist(raw?: string): string[] {
  const source =
    raw ??
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ??
    process.env.ADMIN_EMAILS ??
    "";
  const extra = source
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ADMIN_EMAILS, ...extra]));
}

export function isAllowlistedAdmin(
  email: string | null | undefined,
  allowlist: readonly string[] = adminAllowlist(),
): boolean {
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

/** Public URL segment. Mirrors the SQL slugify helper. */
export function slugifyStudioName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "studio";
}

export function formatStudioAddress(studio: Pick<
  StudioDraft,
  "addressLine" | "suburb" | "state" | "postcode"
>): string {
  const locality = [studio.suburb.trim(), studio.state, studio.postcode.trim()]
    .filter(Boolean)
    .join(" ");
  return [studio.addressLine.trim(), locality].filter(Boolean).join(", ");
}

export function normalizeStudioWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function studioLogoPublicUrl(
  logoPath: string | null | undefined,
  version?: string | null,
  supabaseUrl = getSupabaseUrl(),
): string | null {
  if (!logoPath || !supabaseUrl) return null;
  const base = supabaseUrl.replace(/\/$/, "");
  const url = `${base}/storage/v1/object/public/${STUDIO_LOGO_BUCKET}/${logoPath}`;
  if (!version) return url;
  return `${url}?v=${encodeURIComponent(version)}`;
}

export function validateStudioDraft(
  draft: StudioDraft,
): { ok: true; value: StudioDraft } | { ok: false; error: string } {
  const name = draft.name.trim();
  if (name.length < 2) return { ok: false, error: "Add the studio name." };
  if (name.length > 80) {
    return { ok: false, error: "Studio name needs to be 80 characters or fewer." };
  }
  const postcode = draft.postcode.trim();
  if (postcode && !/^\d{4}$/.test(postcode)) {
    return { ok: false, error: "Postcode needs to be 4 digits." };
  }
  const contactEmail = draft.contactEmail.trim();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "Enter a valid contact email, or leave it blank." };
  }
  const website = normalizeStudioWebsite(draft.website);
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) {
    return { ok: false, error: "Enter a valid website, or leave it blank." };
  }
  if (!isAuStateCode(draft.state)) {
    return { ok: false, error: "Choose a state." };
  }
  const styles = DANCE_STYLES.filter((style) => draft.styles.includes(style));
  return {
    ok: true,
    value: {
      name,
      about: draft.about.trim().slice(0, 2000),
      styles,
      addressLine: draft.addressLine.trim().slice(0, 120),
      suburb: draft.suburb.trim().slice(0, 80),
      state: draft.state,
      postcode,
      phone: draft.phone.trim().slice(0, 40),
      website,
      contactEmail,
    },
  };
}

export function friendlyStudioError(
  error: { message?: string } | string | null | undefined,
): string {
  const message = typeof error === "string" ? error : (error?.message ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("not available to link")) {
    return "That studio is not public yet, so it cannot be linked.";
  }
  if (lower.includes("only an admin")) {
    return "Only an admin can approve or reject a studio.";
  }
  if (
    lower.includes("studio-logos") ||
    lower.includes("bucket not found") ||
    lower.includes("bucket")
  ) {
    return "Logo storage is not set up yet. Run the studio accounts SQL in Supabase, then try again.";
  }
  if (
    lower.includes("could not find the function") ||
    lower.includes("schema cache") ||
    lower.includes("does not exist") ||
    lower.includes("relation") && lower.includes("studios")
  ) {
    return "Studio accounts are not in the database yet. Run supabase/migrations/20260922_studio_accounts.sql in the Supabase SQL editor.";
  }
  if (!message) return "Something went wrong. Please try again.";
  return message;
}

export function validateStudioLogo(file: {
  type: string;
  size: number;
}): string | null {
  if (!STUDIO_LOGO_TYPES.includes(file.type as (typeof STUDIO_LOGO_TYPES)[number])) {
    return "Logo needs to be a PNG, JPG or WebP image.";
  }
  if (file.size > STUDIO_LOGO_MAX_BYTES) {
    return "Logo needs to be 2 MB or smaller.";
  }
  if (file.size <= 0) return "That file is empty.";
  return null;
}

function asStyles(value: unknown): DanceStyle[] {
  if (!Array.isArray(value)) return [];
  return DANCE_STYLES.filter((style) => value.includes(style));
}

export function studioFromRow(row: Record<string, unknown>): StudioRecord | null {
  const id = parseStudioId(row.id);
  const ownerId = parseStudioId(row.owner_id);
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !ownerId || !name) return null;
  const state = isAuStateCode(row.state) ? row.state : "SA";
  return {
    id,
    ownerId,
    name,
    slug: typeof row.slug === "string" && row.slug ? row.slug : slugifyStudioName(name),
    about: typeof row.about === "string" ? row.about : "",
    styles: asStyles(row.styles),
    addressLine: typeof row.address_line === "string" ? row.address_line : "",
    suburb: typeof row.suburb === "string" ? row.suburb : "",
    state,
    postcode: typeof row.postcode === "string" ? row.postcode : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    website: typeof row.website === "string" ? row.website : "",
    contactEmail: typeof row.contact_email === "string" ? row.contact_email : "",
    logoPath: typeof row.logo_path === "string" && row.logo_path ? row.logo_path : null,
    status: parseStudioStatus(row.status),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

function summaryFromRow(row: Record<string, unknown>): StudioSummary | null {
  const studio = studioFromRow({ ...row, owner_id: row.owner_id ?? "00000000-0000-4000-8000-000000000000" });
  if (!studio) return null;
  return {
    id: studio.id,
    name: studio.name,
    slug: studio.slug,
    suburb: studio.suburb,
    state: studio.state,
    styles: studio.styles,
  };
}

const STUDIO_COLUMNS =
  "id, owner_id, name, slug, about, styles, address_line, suburb, state, postcode, phone, website, contact_email, logo_path, status, updated_at";

export async function fetchOwnStudio(userId: string): Promise<{
  studio: StudioRecord | null;
  error: string | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { studio: null, error: "Accounts are not connected in this environment yet." };
  const { data, error } = await supabase
    .from("studios")
    .select(STUDIO_COLUMNS)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) return { studio: null, error: friendlyStudioError(error) };
  if (!data) return { studio: null, error: null };
  return { studio: studioFromRow(data as Record<string, unknown>), error: null };
}

export async function ensureOwnStudio(
  user: User,
  studioName: string,
): Promise<{ studio: StudioRecord | null; error: string | null }> {
  const existing = await fetchOwnStudio(user.id);
  if (existing.error || existing.studio) return existing;
  const supabase = getSupabase();
  if (!supabase) return { studio: null, error: "Accounts are not connected in this environment yet." };
  const name = studioName.trim() || "Dance studio";
  const { data, error } = await supabase
    .from("studios")
    .insert({ owner_id: user.id, name })
    .select(STUDIO_COLUMNS)
    .single();
  if (error) {
    const again = await fetchOwnStudio(user.id);
    if (again.studio) return again;
    return { studio: null, error: friendlyStudioError(error) };
  }
  return { studio: studioFromRow(data as Record<string, unknown>), error: null };
}

export async function saveOwnStudio(
  studioId: string,
  draft: StudioDraft,
): Promise<{ studio: StudioRecord | null; error: string | null }> {
  const parsed = validateStudioDraft(draft);
  if (!parsed.ok) return { studio: null, error: parsed.error };
  const supabase = getSupabase();
  if (!supabase) return { studio: null, error: "Accounts are not connected in this environment yet." };
  const value = parsed.value;
  const { data, error } = await supabase
    .from("studios")
    .update({
      name: value.name,
      about: value.about,
      styles: value.styles,
      address_line: value.addressLine,
      suburb: value.suburb,
      state: value.state,
      postcode: value.postcode,
      phone: value.phone,
      website: value.website,
      contact_email: value.contactEmail,
    })
    .eq("id", studioId)
    .select(STUDIO_COLUMNS)
    .single();
  if (error) return { studio: null, error: friendlyStudioError(error) };
  return { studio: studioFromRow(data as Record<string, unknown>), error: null };
}

export async function uploadStudioLogo(
  studioId: string,
  file: File,
): Promise<{ studio: StudioRecord | null; error: string | null }> {
  const invalid = validateStudioLogo(file);
  if (invalid) return { studio: null, error: invalid };
  const supabase = getSupabase();
  if (!supabase) return { studio: null, error: "Accounts are not connected in this environment yet." };
  const path = `${studioId}/logo`;
  const uploaded = await supabase.storage.from(STUDIO_LOGO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (uploaded.error) return { studio: null, error: friendlyStudioError(uploaded.error) };
  const { data, error } = await supabase
    .from("studios")
    .update({ logo_path: path })
    .eq("id", studioId)
    .select(STUDIO_COLUMNS)
    .single();
  if (error) return { studio: null, error: friendlyStudioError(error) };
  return { studio: studioFromRow(data as Record<string, unknown>), error: null };
}

export async function fetchStudioBySlugOrId(
  slugOrId: string,
): Promise<{ studio: StudioRecord | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { studio: null, error: null };
  const id = parseStudioId(slugOrId);
  const query = supabase.from("studios").select(STUDIO_COLUMNS);
  const { data, error } = id
    ? await query.eq("id", id).maybeSingle()
    : await query.eq("slug", slugOrId).maybeSingle();
  if (error) return { studio: null, error: friendlyStudioError(error) };
  if (!data) return { studio: null, error: null };
  return { studio: studioFromRow(data as Record<string, unknown>), error: null };
}

export async function searchApprovedStudios(query: string): Promise<{
  studios: StudioSummary[];
  error: string | null;
}> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { studios: [], error: null };
  const supabase = getSupabase();
  if (!supabase) return { studios: [], error: null };
  const escaped = trimmed.replace(/[%_,]/g, " ");
  const { data, error } = await supabase
    .from("studios")
    .select("id, name, slug, suburb, state, styles, status")
    .eq("status", "approved")
    .ilike("name", `%${escaped}%`)
    .order("name")
    .limit(8);
  if (error) return { studios: [], error: friendlyStudioError(error) };
  const studios = (data ?? []).flatMap((row) => {
    const summary = summaryFromRow(row as Record<string, unknown>);
    return summary ? [summary] : [];
  });
  return { studios, error: null };
}

export async function listApprovedStudios(): Promise<{
  studios: StudioSummary[];
  error: string | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { studios: [], error: null };
  const { data, error } = await supabase
    .from("studios")
    .select("id, name, slug, suburb, state, styles, status")
    .eq("status", "approved")
    .order("name")
    .limit(200);
  if (error) return { studios: [], error: friendlyStudioError(error) };
  const studios = (data ?? []).flatMap((row) => {
    const summary = summaryFromRow(row as Record<string, unknown>);
    return summary ? [summary] : [];
  });
  return { studios, error: null };
}

export async function listStudiosForAdmin(status: StudioStatus): Promise<{
  studios: StudioRecord[];
  error: string | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { studios: [], error: "Accounts are not connected in this environment yet." };
  const { data, error } = await supabase
    .from("studios")
    .select(STUDIO_COLUMNS)
    .eq("status", status)
    .order("created_at", { ascending: true });
  if (error) return { studios: [], error: friendlyStudioError(error) };
  const studios = (data ?? []).flatMap((row) => {
    const studio = studioFromRow(row as Record<string, unknown>);
    return studio ? [studio] : [];
  });
  return { studios, error: null };
}

export async function claimAdminAccess(userId: string): Promise<{
  isAdmin: boolean;
  error: string | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { isAdmin: false, error: "Accounts are not connected in this environment yet." };
  const claimed = await supabase.rpc("claim_admin_from_allowlist");
  if (claimed.error && !claimed.error.message.toLowerCase().includes("could not find")) {
    return { isAdmin: false, error: friendlyStudioError(claimed.error) };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("is_admin") || lower.includes("schema cache") || lower.includes("does not exist")) {
      return { isAdmin: false, error: null };
    }
    return { isAdmin: false, error: friendlyStudioError(error) };
  }
  const row = data as { is_admin?: unknown } | null;
  return { isAdmin: row?.is_admin === true, error: null };
}

export async function setStudioStatus(
  studioId: string,
  status: "approved" | "rejected",
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Accounts are not connected in this environment yet." };
  const { error } = await supabase.rpc("set_studio_status", {
    p_id: studioId,
    p_status: status,
  });
  return { error: error ? friendlyStudioError(error) : null };
}

export function studioPublicPath(studio: { slug: string; id: string }): string {
  return `/studios/${studio.slug || studio.id}`;
}
