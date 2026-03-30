function sanitizeFileName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return `upload-${Date.now()}`;
  return trimmed.replace(/[\\/:*?"<>|]/g, "_");
}

/**
 * Upload a file to the signed-in user's OneDrive under `/me/drive/root`.
 * Requires a delegated Graph access token (authorization code flow).
 */
export async function uploadToMyOneDrive(
  accessToken: string,
  params: {
    fileName: string;
    bytes: ArrayBuffer;
    contentType: string;
  },
) {
  const folder = (process.env.ONEDRIVE_UPLOAD_FOLDER ?? "My App Uploads").trim();
  const safeName = sanitizeFileName(params.fileName);
  const relativePath = `${folder}/${safeName}`;
  const encodedPath = relativePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const uploadRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": params.contentType || "application/octet-stream",
      },
      body: new Blob([params.bytes], {
        type: params.contentType || "application/octet-stream",
      }),
      cache: "no-store",
    },
  );
  console.log("one drive",uploadRes);

  if (!uploadRes.ok) {
    const details = await uploadRes.text();
    throw new Error(`OneDrive upload failed: ${details}`);
  }

  const item = (await uploadRes.json()) as { webUrl?: string; name?: string; id?: string };
  return {
    id: item.id ?? null,
    name: item.name ?? safeName,
    webUrl: item.webUrl ?? null,
  };
}
