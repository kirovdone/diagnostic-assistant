// Origin: the in-house design system, src/helpers/common/sendNotification.ts. Copied unchanged.
import { toast } from "sonner";
import { NotificationType } from "@/types/entities";

export const sendNotification = (
  type: NotificationType,
  message?: string | null,
): void => {
  if (!message) return;
  if (type === "aborted") return;
  if (type === "success") {
    toast.success(message);
  } else {
    toast.error(message);
  }
};
