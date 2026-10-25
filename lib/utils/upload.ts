import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";
import { validateImageUpload } from "@/lib/utils/image";

/**
 * Upload an image to Convex storage and return its id. The content type sent
 * is the canonical one from `validateImageUpload`; the server re-checks the
 * stored file's type and size before attaching it (convex/files.ts).
 */
export async function uploadImage(
  file: File,
  getUploadUrl: () => Promise<string>
): Promise<Id<"_storage">> {
  const validated = validateImageUpload(file);
  // ConvexError so `errorMessage` shows these user-safe messages as-is.
  if (!validated.ok) throw new ConvexError(validated.error);
  const url = await getUploadUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": validated.value.contentType },
    body: file,
  });
  if (!res.ok) throw new ConvexError("Upload failed — please try again.");
  const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
