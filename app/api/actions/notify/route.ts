import { getFacility } from "@/lib/server/data";
import { priorityForFacility } from "@/lib/notifications/report";
import { createNotificationService } from "@/lib/notifications/service";
import { validateNotifyRequest } from "@/lib/notifications/validation";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ success: false, error: "Request body must be valid JSON" }, { status: 400 });
  }
  const validation = validateNotifyRequest(payload);
  if (!validation.ok) return Response.json({ success: false, error: validation.error }, { status: validation.status });
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    return Response.json({ success: false, error: "Notification delivery requires Firebase server credentials" }, { status: 503 });
  }
  let facility;
  try {
    facility = await getFacility(validation.value.facilityId);
  } catch {
    return Response.json({ success: false, error: "Facility data could not be loaded" }, { status: 500 });
  }
  if (!facility) return Response.json({ success: false, error: "facility not found" }, { status: 404 });

  try {
    const result = await createNotificationService().dispatch({
      facility,
      report: validation.value.report,
      channels: validation.value.channels,
      priority: priorityForFacility(facility),
      createdBy: "district-admin-demo",
    });
    return Response.json({ success: result.status !== "failed", ...result });
  } catch {
    return Response.json({ success: false, error: "Notification could not be persisted" }, { status: 500 });
  }
}
