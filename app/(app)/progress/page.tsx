"use client";

import React from "react";
import { BarChart2 } from "lucide-react";
import { AuthErrorBoundary } from "@/components/auth/auth-error-boundary";
import { ProgressHeatmap } from "@/components/progress/progress-heatmap";

function ProgressContent() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-blue-500" />
        <h1 className="text-xl font-bold">Progress</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Chapters you've studied are highlighted. Darker = more activity.
        Confidence ratings appear alongside each chapter you've self-rated.
      </p>
      <ProgressHeatmap />
    </div>
  );
}

export default function ProgressPage() {
  return (
    <AuthErrorBoundary>
      <ProgressContent />
    </AuthErrorBoundary>
  );
}
