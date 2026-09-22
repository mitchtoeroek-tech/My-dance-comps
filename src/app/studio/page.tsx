"use client";

import { StudioProfileEditor } from "@/components/StudioProfileEditor";
import { AuthUnavailable } from "@/components/AuthCard";
import { useAuth } from "@/context/AuthContext";

export default function StudioEditorPage() {
  const { configured } = useAuth();
  if (!configured) return <AuthUnavailable />;
  return <StudioProfileEditor />;
}
