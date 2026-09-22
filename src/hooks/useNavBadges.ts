"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useReminderEngine } from "@/components/ReminderEngine";
import { useAuth } from "@/context/AuthContext";
import { useCommunityInbox } from "@/hooks/useCommunity";
import { useStudioChats } from "@/hooks/useStudioCommunity";
import {
  communityHasUnread,
  getNavBadgeScope,
  getServerNavBadgeScope,
  latestActivityAt,
  navBadgeOwnerId,
  publishNavBadgeScope,
  remindersHaveUnread,
  subscribeNavBadges,
  withCommunitySeen,
  withRemindersSeen,
} from "@/lib/nav-badges";

function isSection(pathname: string, href: "/community" | "/reminders"): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function viewSettled(view: string): boolean {
  return view === "ready" || view === "guest" || view === "unavailable";
}

/**
 * Pastel unread dots for Community and Reminders.
 * Guests never get a Community dot. A Reminders dot can show from local
 * reminder state after this device has already snapshotted the list.
 */
export function useNavBadges(): {
  communityUnread: boolean;
  remindersUnread: boolean;
} {
  const pathname = usePathname();
  const { user } = useAuth();
  const inbox = useCommunityInbox();
  const studios = useStudioChats();
  const reminders = useReminderEngine();
  const ownerId = navBadgeOwnerId(user?.id);
  const onCommunity = isSection(pathname, "/community");
  const onReminders = isSection(pathname, "/reminders");

  const getSnapshot = useCallback(
    () => getNavBadgeScope(ownerId),
    [ownerId],
  );
  const scope = useSyncExternalStore(
    subscribeNavBadges,
    getSnapshot,
    getServerNavBadgeScope,
  );

  const latestCommunityAt = useMemo(() => {
    const stamps: Array<string | null> = [];
    if (inbox.view === "ready") {
      for (const conversation of inbox.conversations) {
        stamps.push(conversation.lastMessage?.createdAt ?? null);
      }
    }
    if (studios.view === "ready") {
      for (const chat of studios.chats) stamps.push(chat.lastCreatedAt);
    }
    return latestActivityAt(stamps);
  }, [inbox.view, inbox.conversations, studios.view, studios.chats]);

  const reminderIds = useMemo(
    () => reminders.items.map((item) => item.id),
    [reminders.items],
  );

  const communitySettled =
    Boolean(user) && viewSettled(inbox.view) && viewSettled(studios.view);

  useEffect(() => {
    if (!user || !communitySettled) return;
    const current = getNavBadgeScope(ownerId);
    if (!onCommunity && current.communityBaselined) return;
    publishNavBadgeScope(
      ownerId,
      withCommunitySeen(current, latestCommunityAt, new Date().toISOString()),
    );
  }, [user, ownerId, communitySettled, onCommunity, latestCommunityAt]);

  useEffect(() => {
    if (!user || !onCommunity) return;
    return () => {
      const current = getNavBadgeScope(ownerId);
      publishNavBadgeScope(
        ownerId,
        withCommunitySeen(current, null, new Date().toISOString()),
      );
    };
  }, [user, ownerId, onCommunity]);

  useEffect(() => {
    if (!reminders.ready) return;
    const current = getNavBadgeScope(ownerId);
    if (!onReminders && current.remindersBaselined) return;
    publishNavBadgeScope(ownerId, withRemindersSeen(current, reminderIds));
  }, [reminders.ready, ownerId, onReminders, reminderIds]);

  return {
    communityUnread:
      Boolean(user) &&
      !onCommunity &&
      communityHasUnread(latestCommunityAt, scope),
    remindersUnread:
      reminders.ready &&
      !onReminders &&
      remindersHaveUnread(reminderIds, scope),
  };
}
