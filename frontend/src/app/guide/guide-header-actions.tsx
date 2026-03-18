"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

function useAuth() {
  const { isAuthenticated, isLoading, fetchUser } = useAuthStore();
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);
  return { isAuthenticated, isLoading };
}

export function GuideHeaderActions() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (isAuthenticated) {
    return (
      <Link
        href="/dashboard"
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Dashboard
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Sign in
      </Link>
      <Link
        href="/register"
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Get Started
      </Link>
    </>
  );
}

export function GuideCTAActions() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (isAuthenticated) {
    return (
      <Link
        href="/dashboard"
        className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Go to Dashboard
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/register"
        className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Get Started
        <ArrowRight className="h-4 w-4" />
      </Link>
      <Link
        href="/login"
        className="inline-flex h-10 items-center rounded-md border bg-background px-5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Sign in
      </Link>
    </>
  );
}
