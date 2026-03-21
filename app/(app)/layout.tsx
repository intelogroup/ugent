"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppLayout } from "@/components/ui/app-layout";

export default function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Show nothing while auth state is loading or redirecting
  if (isLoading || !isAuthenticated) {
    return null;
  }

  return <AppLayout>{children}</AppLayout>;
}
