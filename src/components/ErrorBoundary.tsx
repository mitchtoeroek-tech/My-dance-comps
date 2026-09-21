"use client";

import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <p className="rounded-3xl bg-white p-4 text-sm text-[var(--ink-soft)] ring-1 ring-[var(--line)]">
            This item could not be displayed. Try refreshing the page.
          </p>
        )
      );
    }
    return this.props.children;
  }
}
