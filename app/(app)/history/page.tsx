"use client";

import { useRouter } from "next/navigation";
import { ChatHistory } from "@/components/history/chat-history";
import type { Id } from "@/convex/_generated/dataModel";

export default function HistoryPage() {
  const router = useRouter();

  const handleSelectThread = (threadId: Id<"threads">) => {
    router.push(`/chat?thread=${threadId}`);
  };

  const handleBack = () => {
    router.push("/dashboard");
  };

  return (
    <ChatHistory onSelectThread={handleSelectThread} onBack={handleBack} />
  );
}
