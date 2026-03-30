"use server";

import { cookies } from "next/headers";
import { requireActionRole } from "@/lib/auth";
import { getValidMicrosoftAccessToken } from "@/lib/microsoft-delegated";
import { uploadToMyOneDrive } from "@/lib/onedrive";

export type UploadDocumentResult = {
  error: string | null;
  success: string | null;
  fileUrl: string | null;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isAllowedFile(file: File) {
  const mime = (file.type || "").toLowerCase();
  if (mime === "application/pdf" || mime.startsWith("image/")) return true;

  const lowerName = file.name.toLowerCase();
  return (
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp") ||
    lowerName.endsWith(".gif")
  );
}

export async function uploadDocument(
  formData: FormData,
): Promise<UploadDocumentResult> {
  const authError = await requireActionRole(["admin", "user"]);
  if (authError) return { error: authError, success: null, fileUrl: null };

  const fileValue = formData.get("document");
  if (!(fileValue instanceof File) || !fileValue.size) {
    return { error: "Please choose a PDF or image file.", success: null, fileUrl: null };
  }

  if (!isAllowedFile(fileValue)) {
    return {
      error: "Only PDF or image files are allowed.",
      success: null,
      fileUrl: null,
    };
  }

  if (fileValue.size > MAX_FILE_SIZE_BYTES) {
    return {
      error: "File too large. Maximum size is 10 MB.",
      success: null,
      fileUrl: null,
    };
  }

  try {
    const cookieStore = await cookies();
    const accessToken = await getValidMicrosoftAccessToken(cookieStore);
    if (!accessToken) {
      return {
        error:
          "Sign in with Microsoft first — use Connect Microsoft OneDrive on the Documents page.",
        success: null,
        fileUrl: null,
      };
    }

    const buffer = await fileValue.arrayBuffer();
    const uploaded = await uploadToMyOneDrive(accessToken, {
      fileName: fileValue.name,
      bytes: buffer,
      contentType: fileValue.type || "application/octet-stream",
    });

    return {
      error: null,
      success: `Uploaded "${uploaded.name}" to OneDrive.`,
      fileUrl: uploaded.webUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return { error: message, success: null, fileUrl: null };
  }
}
