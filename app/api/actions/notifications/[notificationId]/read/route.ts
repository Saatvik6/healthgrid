import { FirestoreNotificationRepository } from "@/lib/notifications/repository";

function validId(value: string): boolean {
  return value.length > 0 && value.length <= 200 && !value.includes("/");
}

export async function POST(_request: Request, context: { params: Promise<{ notificationId: string }> }) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    return Response.json({ success: false, error: "Notification updates require Firebase server credentials" }, { status: 503 });
  }
  const { notificationId } = await context.params;
  if (!validId(notificationId)) return Response.json({ success: false, error: "invalid notification id" }, { status: 400 });
  try {
    const state = await new FirestoreNotificationRepository().markRead(notificationId);
    if (!state) return Response.json({ success: false, error: "notification not found" }, { status: 404 });
    return Response.json({ success: true, ...state });
  } catch {
    return Response.json({ success: false, error: "Notification could not be marked read" }, { status: 500 });
  }
}
