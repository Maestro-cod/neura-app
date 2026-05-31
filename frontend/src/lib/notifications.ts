import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/**
 * Local task-reminder notifications.
 *
 * Web has no usable local-notification API here, so every function no-ops on
 * web. Remote push is intentionally not used — these are on-device scheduled
 * reminders, which work in Expo Go (unlike remote push in SDK 53+).
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const MAX_SCHEDULED = 30;

export type ReminderTask = {
  title: string;
  due_date: string | null;
};

/** Request OS permission. Returns true only when notifications are allowed. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted) {
    const asked = await Notifications.requestPermissionsAsync();
    granted = asked.granted;
  }
  if (granted && Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Task reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return granted;
}

/** Date-only due dates fire at 9am local; timestamped ones fire at their time. */
function reminderTime(dueIso: string): number | null {
  const d = new Date(dueIso);
  if (isNaN(d.getTime())) return null;
  if (dueIso.length <= 10) d.setHours(9, 0, 0, 0);
  return d.getTime();
}

/**
 * Replace all scheduled reminders with one per upcoming task that has a due
 * date. Called whenever the task list changes so reminders stay in sync.
 */
export async function syncTaskReminders(tasks: ReminderTask[]): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  let scheduled = 0;
  for (const t of tasks) {
    if (scheduled >= MAX_SCHEDULED) break;
    if (!t.due_date) continue;
    const at = reminderTime(t.due_date);
    if (at === null || at <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: "NEURA reminder", body: `"${t.title}" is due.` },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(at),
      },
    });
    scheduled += 1;
  }

  // Weekly digest nudge — Sunday 6pm. The summary itself is computed in-app
  // when NEURA AI opens; this just brings the user back for it.
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Your NEURA week",
      body: "Open NEURA for your weekly review and what's ahead.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,
      hour: 18,
      minute: 0,
    },
  });
}

/** Cancel every scheduled reminder (used when the user turns reminders off). */
export async function clearAllReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
