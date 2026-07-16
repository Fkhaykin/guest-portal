// Prefetch cache for the /admin/messages landing load.
//
// The page fetches its whole conversation list on mount, so the click always
// paid a full round-trip. Routing that load through this shared prefetcher lets
// the sidebar warm it on hover (via `prefetchMessages`) so the page reads an
// already-resolved value and paints instantly.

import { createPrefetcher } from "@/lib/prefetch-cache";
import type { ConversationThread } from "@/lib/lodgify/messages";

// The exact landing fetch the page used to run inline. Mirrors its silent error
// behavior: a non-ok response, a parse error, or a thrown fetch all resolve to
// an empty list rather than surfacing an error (the page left state unchanged
// in those cases, and initial state is []).
async function fetchConversations(): Promise<ConversationThread[]> {
  try {
    const res = await fetch("/api/admin/messages");
    if (!res.ok) return [];
    const data = await res.json();
    return data.conversations ?? [];
  } catch {
    return [];
  }
}

export const messagesNav = createPrefetcher(() => "conversations", fetchConversations);

export const prefetchMessages = () => messagesNav.prefetch();
