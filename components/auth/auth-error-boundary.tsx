"use client";

import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that catches Convex auth/query errors (401, "Unauthenticated")
 * and redirects to /login instead of crashing.
 */
export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const msg = error.message?.toLowerCase() ?? "";
    const isAuthError =
      msg.includes("unauthenticated") ||
      msg.includes("unauthorized") ||
      msg.includes("401") ||
      msg.includes("not authenticated") ||
      msg.includes("session");

    if (isAuthError && typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message?.toLowerCase() ?? "";
      const isAuthError =
        msg.includes("unauthenticated") ||
        msg.includes("unauthorized") ||
        msg.includes("401") ||
        msg.includes("not authenticated") ||
        msg.includes("session");

      if (isAuthError) {
        // Redirect is in progress via componentDidCatch — show nothing
        return null;
      }

      // Non-auth error — show fallback
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <p className="text-sm text-muted-foreground">
              Something went wrong. Please try refreshing the page.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
