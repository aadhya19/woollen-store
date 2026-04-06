"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createSupabase } from "@/lib/supabase";
import { getAuthSession, requireActionRole } from "@/lib/auth";
import { getValidMicrosoftAccessToken } from "@/lib/microsoft-delegated";
import { uploadToMyOneDrive } from "@/lib/onedrive";

export type ActionResult = { error: string | null };

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = value?.toString().trim();
  return s ? s : null;
}

function parseOptionalFloat(
  value: FormDataEntryValue | null,
): { n: number | null; error: string | null } {
  const s = value?.toString().trim();
  if (!s) return { n: null, error: null };
  const n = Number(s);
  if (Number.isNaN(n)) return { n: null, error: "Invalid number value" };
  return { n, error: null };
}

function parseOptionalBigInt(
  value: FormDataEntryValue | null,
): { n: string | null; error: string | null } {
  const s = value?.toString().trim();
  if (!s) return { n: null, error: null };
  if (!/^-?\d+$/.test(s)) return { n: null, error: "Invalid integer value" };
  return { n: s, error: null };
}

const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;

function isImageFile(file: File) {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function isInvoiceDocumentFile(file: File) {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  if (mime === "application/pdf") return true;
  return /\.(png|jpe?g|webp|gif|pdf)$/i.test(file.name);
}

type DocumentUrlsResult = {
  invoice_image_url: string | null;
  product_image: string | null;
  debit_note: string | null;
  error: string | null;
};

async function resolveDocumentUrlsFromForm(
  formData: FormData,
): Promise<DocumentUrlsResult> {
  const cookieStore = await cookies();
  const imageFile = formData.get("invoice_image_file");
  const productImageFile = formData.get("product_image_file");
  const debitNoteFile = formData.get("debit_note_file");
  const uploadImage = imageFile instanceof File && imageFile.size > 0;
  const uploadProductImage =
    productImageFile instanceof File && productImageFile.size > 0;
  const uploadDebitNote =
    debitNoteFile instanceof File && debitNoteFile.size > 0;

  let accessToken: string | null | undefined;
  async function getToken(): Promise<string | null> {
    if (accessToken !== undefined) return accessToken;
    accessToken = await getValidMicrosoftAccessToken(cookieStore);
    return accessToken;
  }

  let invoice_image_url: string | null;
  if (uploadImage) {
    if (!isInvoiceDocumentFile(imageFile)) {
      return {
        invoice_image_url: null,
        product_image: null,
        debit_note: null,
        error: "Invoice file must be an image or PDF file.",
      };
    }
    if (imageFile.size > MAX_UPLOAD_FILE_BYTES) {
      return {
        invoice_image_url: null,
        product_image: null,
        debit_note: null,
        error: "Invoice image is too large. Maximum size is 10 MB.",
      };
    }
    const token = await getToken();
    if (!token) {
      return {
        invoice_image_url: null,
        product_image: null,
        debit_note: null,
        error: "Contact admin and ask him to connect microsoft to upload invoice files.",
      };
    }
    try {
      const buffer = await imageFile.arrayBuffer();
      const uploaded = await uploadToMyOneDrive(token, {
        fileName: imageFile.name,
        bytes: buffer,
        contentType: imageFile.type || "application/octet-stream",
      });
      if (!uploaded.webUrl) {
        return {
          invoice_image_url: null,
          product_image: null,
          debit_note: null,
          error: "OneDrive did not return a link for the invoice image.",
        };
      }
      invoice_image_url = uploaded.webUrl;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invoice image upload failed";
      return {
        invoice_image_url: null,
        product_image: null,
        debit_note: null,
        error: message,
      };
    }
  } else {
    invoice_image_url = emptyToNull(formData.get("invoice_image_url"));
  }

  let product_image: string | null;
  if (uploadProductImage) {
    if (!isImageFile(productImageFile)) {
      return {
        invoice_image_url,
        product_image: null,
        debit_note: null,
        error: "Product image must be an image file (e.g. PNG, JPEG, WebP).",
      };
    }
    if (productImageFile.size > MAX_UPLOAD_FILE_BYTES) {
      return {
        invoice_image_url,
        product_image: null,
        debit_note: null,
        error: "Product image is too large. Maximum size is 10 MB.",
      };
    }
    const token = await getToken();
    if (!token) {
      return {
        invoice_image_url,
        product_image: null,
        debit_note: null,
        error: "Contact admin and ask him to connect microsoft to upload invoice files.",
      };
    }
    try {
      const buffer = await productImageFile.arrayBuffer();
      const uploaded = await uploadToMyOneDrive(token, {
        fileName: productImageFile.name,
        bytes: buffer,
        contentType: productImageFile.type || "application/octet-stream",
      });
      if (!uploaded.webUrl) {
        return {
          invoice_image_url,
          product_image: null,
          debit_note: null,
          error: "OneDrive did not return a link for the product image.",
        };
      }
      product_image = uploaded.webUrl;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Product image upload failed";
      return {
        invoice_image_url,
        product_image: null,
        debit_note: null,
        error: message,
      };
    }
  } else {
    product_image = emptyToNull(formData.get("product_image"));
  }

  let debit_note: string | null;
  if (uploadDebitNote) {
    if (debitNoteFile.size > MAX_UPLOAD_FILE_BYTES) {
      return {
        invoice_image_url,
        product_image,
        debit_note: null,
        error: "Debit note file is too large. Maximum size is 10 MB.",
      };
    }
    const token = await getToken();
    if (!token) {
      return {
        invoice_image_url,
        product_image,
        debit_note: null,
        error: "Contact admin and ask him to connect microsoft to upload invoice files.",
      };
    }
    try {
      const buffer = await debitNoteFile.arrayBuffer();
      const uploaded = await uploadToMyOneDrive(token, {
        fileName: debitNoteFile.name,
        bytes: buffer,
        contentType: debitNoteFile.type || "application/octet-stream",
      });
      if (!uploaded.webUrl) {
        return {
          invoice_image_url,
          product_image,
          debit_note: null,
          error: "OneDrive did not return a link for the debit note file.",
        };
      }
      debit_note = uploaded.webUrl;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Debit note upload failed";
      return {
        invoice_image_url,
        product_image,
        debit_note: null,
        error: message,
      };
    }
  } else {
    debit_note = emptyToNull(formData.get("debit_note"));
  }

  return { invoice_image_url, product_image, debit_note, error: null };
}

function mapSupabaseError(message: string) {
  if (message.includes("row-level security")) {
    return `${message} Enable INSERT/UPDATE/DELETE policies for the anon (or authenticated) role on Inventory.`;
  }
  if (/unique|duplicate key/i.test(message)) {
    return "This inventory number is already in use.";
  }
  return message;
}

type InvRow = Record<string, unknown>;

function invStrEmpty(v: unknown): boolean {
  if (v == null) return true;
  return String(v).trim() === "";
}

function invNumEmpty(v: unknown): boolean {
  return v == null;
}

function invQtyEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

type ParsedInventoryUpdate = {
  inventory_number: string | null;
  company_name: string | null;
  agent_name: string | null;
  transport_name: string | null;
  waybill_number: string | null;
  transport_charges: number | null;
  date_of_entry: string | null;
  loading_charges: number | null;
  staff_name: string | null;
  location: string | null;
  invoice_number: string | null;
  number_of_parcels: string | null;
  billed_quantity: string | null;
  received_quantity: string | null;
  tallying: string | null;
  pricing: string | null;
  stickering: string | null;
  supply: string | null;
  invoice_amount: number | null;
  invoice_date: string | null;
  invoice_image_url: string | null;
  product_image: string | null;
  payment_details: string | null;
  payment_mode: string | null;
  payment_status: string | null;
  debit_note: string | null;
};

function mergeInventoryForRestrictedUser(
  existing: InvRow,
  incoming: ParsedInventoryUpdate,
): ParsedInventoryUpdate {
  return {
    inventory_number: invStrEmpty(existing.inventory_number)
      ? incoming.inventory_number
      : (existing.inventory_number as string | null),
    company_name: invStrEmpty(existing.company_name)
      ? incoming.company_name
      : (existing.company_name as string | null),
    agent_name: invStrEmpty(existing.agent_name)
      ? incoming.agent_name
      : (existing.agent_name as string | null),
    transport_name: invStrEmpty(existing.transport_name)
      ? incoming.transport_name
      : (existing.transport_name as string | null),
    waybill_number: invStrEmpty(existing.waybill_number)
      ? incoming.waybill_number
      : (existing.waybill_number as string | null),
    transport_charges: invNumEmpty(existing.transport_charges)
      ? incoming.transport_charges
      : (existing.transport_charges as number | null),
    date_of_entry: invStrEmpty(existing.date_of_entry)
      ? incoming.date_of_entry
      : (existing.date_of_entry as string | null),
    loading_charges: invNumEmpty(existing.loading_charges)
      ? incoming.loading_charges
      : (existing.loading_charges as number | null),
    staff_name: invStrEmpty(existing.staff_name)
      ? incoming.staff_name
      : (existing.staff_name as string | null),
    location: invStrEmpty(existing.location)
      ? incoming.location
      : (existing.location as string | null),
    invoice_number: invStrEmpty(existing.invoice_number)
      ? incoming.invoice_number
      : (existing.invoice_number as string | null),
    number_of_parcels: invQtyEmpty(existing.number_of_parcels)
      ? incoming.number_of_parcels
      : existing.number_of_parcels != null
        ? String(existing.number_of_parcels)
        : null,
    billed_quantity: invQtyEmpty(existing.billed_quantity)
      ? incoming.billed_quantity
      : existing.billed_quantity != null
        ? String(existing.billed_quantity)
        : null,
    received_quantity: invQtyEmpty(existing.received_quantity)
      ? incoming.received_quantity
      : existing.received_quantity != null
        ? String(existing.received_quantity)
        : null,
    // Allow restricted users to always update these workflow status fields.
    tallying: incoming.tallying,
    pricing: incoming.pricing,
    stickering: incoming.stickering,
    supply: incoming.supply,
    invoice_amount: invNumEmpty(existing.invoice_amount)
      ? incoming.invoice_amount
      : (existing.invoice_amount as number | null),
    invoice_date: invStrEmpty(existing.invoice_date)
      ? incoming.invoice_date
      : (existing.invoice_date as string | null),
    invoice_image_url: invStrEmpty(existing.invoice_image_url)
      ? incoming.invoice_image_url
      : (existing.invoice_image_url as string | null),
    product_image: invStrEmpty(existing.product_image)
      ? incoming.product_image
      : (existing.product_image as string | null),
    payment_details: invStrEmpty(existing.payment_details)
      ? incoming.payment_details
      : (existing.payment_details as string | null),
    payment_mode: invStrEmpty(existing.payment_mode)
      ? incoming.payment_mode
      : (existing.payment_mode as string | null),
    payment_status: invStrEmpty(existing.payment_status)
      ? incoming.payment_status
      : (existing.payment_status as string | null),
    debit_note: invStrEmpty(existing.debit_note)
      ? incoming.debit_note
      : (existing.debit_note as string | null),
  };
}

async function assertInventoryNumberUnique(
  inventory_number: string | null,
  excludeRowId: string | null,
): Promise<ActionResult> {
  if (!inventory_number) return { error: null };

  const supabase = createSupabase();
  const { data, error } = await supabase
    .from("Inventory")
    .select("id")
    .eq("inventory_number", inventory_number)
    .maybeSingle();

  if (error) return { error: mapSupabaseError(error.message) };
  if (!data) return { error: null };
  if (excludeRowId && data.id === excludeRowId) return { error: null };
  return { error: "This inventory number is already in use." };
}

export async function createInventory(
  formData: FormData,
): Promise<ActionResult> {
  const authError = await requireActionRole(["admin", "user"]);
  if (authError) return { error: authError };
  const session = await getAuthSession();
  if (!session) return { error: "Not authenticated. Please log in." };
  const isAdmin = session.role === "admin";

  const inventory_number = emptyToNull(formData.get("inventory_number"));
  const company_name = emptyToNull(formData.get("company_name"));
  const agent_name = emptyToNull(formData.get("agent_name"));
  const transport_name = emptyToNull(formData.get("transport_name"));
  const waybill_number = emptyToNull(formData.get("waybill_number"));

  const { n: transport_charges, error: transportChargesErr } =
    parseOptionalFloat(formData.get("transport_charges"));
  if (transportChargesErr) return { error: transportChargesErr };

  const date_of_entry = emptyToNull(formData.get("date_of_entry"));

  const { n: loading_charges, error: loadingChargesErr } = parseOptionalFloat(
    formData.get("loading_charges"),
  );
  if (loadingChargesErr) return { error: loadingChargesErr };

  const staff_name = emptyToNull(formData.get("staff_name"));
  if (!inventory_number) return { error: "Inventory number is required." };
  const location = emptyToNull(formData.get("location"));
  const invoice_number = emptyToNull(formData.get("invoice_number"));

  const { n: number_of_parcels, error: parcelsErr } = parseOptionalBigInt(
    formData.get("number_of_parcels"),
  );
  if (parcelsErr) return { error: parcelsErr };

  const { n: billed_quantity, error: billedQtyErr } = parseOptionalBigInt(
    formData.get("billed_quantity"),
  );
  if (billedQtyErr) return { error: billedQtyErr };

  const { n: received_quantity, error: receivedQtyErr } =
    parseOptionalBigInt(formData.get("received_quantity"));
  if (receivedQtyErr) return { error: receivedQtyErr };

  const tallying = emptyToNull(formData.get("tallying"));
  const pricing = emptyToNull(formData.get("pricing"));
  const stickering = emptyToNull(formData.get("stickering"));
  const supply = emptyToNull(formData.get("supply"));

  const { n: invoice_amount, error: invoiceAmountErr } = parseOptionalFloat(
    formData.get("invoice_amount"),
  );
  if (invoiceAmountErr) return { error: invoiceAmountErr };

  const invoice_date = emptyToNull(formData.get("invoice_date"));
  const invoiceUrlsCreate = await resolveDocumentUrlsFromForm(formData);
  if (invoiceUrlsCreate.error) return { error: invoiceUrlsCreate.error };
  const invoice_image_url = invoiceUrlsCreate.invoice_image_url;
  const product_image = invoiceUrlsCreate.product_image;
  const debit_note = invoiceUrlsCreate.debit_note;
  const payment_details = isAdmin ? emptyToNull(formData.get("payment_details")) : null;
  const payment_mode = isAdmin ? emptyToNull(formData.get("payment_mode")) : null;
  const payment_status = isAdmin ? emptyToNull(formData.get("payment_status")) : null;

  const uniqErr = await assertInventoryNumberUnique(inventory_number, null);
  if (uniqErr.error) return uniqErr;

  const supabase = createSupabase();
  const { error } = await supabase.from("Inventory").insert({
    inventory_number,
    company_name,
    agent_name,
    transport_name,
    waybill_number,
    transport_charges,
    date_of_entry,
    loading_charges,
    staff_name,
    location,
    invoice_number,
    number_of_parcels,
    billed_quantity,
    received_quantity,
    tallying,
    pricing,
    stickering,
    supply,
    invoice_amount,
    invoice_date,
    invoice_image_url,
    product_image,
    payment_details,
    payment_mode,
    payment_status,
    debit_note,
  });

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/inventory");
  return { error: null };
}

export async function deleteInventory(id: string): Promise<ActionResult> {
  const authError = await requireActionRole(["admin"]);
  if (authError) return { error: authError };
  if (!id) return { error: "Missing inventory id" };

  const supabase = createSupabase();

  const { data: inventory, error: inventoryErr } = await supabase
    .from("Inventory")
    .select("id, inventory_number")
    .eq("id", id)
    .maybeSingle();
  if (inventoryErr) return { error: mapSupabaseError(inventoryErr.message) };
  if (!inventory) return { error: "Inventory row not found." };

  const inventoryNumber = String(inventory.inventory_number ?? "").trim();
  if (!inventoryNumber) {
    return { error: "Inventory number is missing on this row. Cannot safely delete." };
  }

  const { count, error: stockCheckErr } = await supabase
    .from("Stock")
    .select("id", { count: "exact", head: true })
    .eq("inventory_number", inventoryNumber);
  if (stockCheckErr) return { error: mapSupabaseError(stockCheckErr.message) };

  if ((count ?? 0) > 0) {
    return {
      error: `Cannot delete invoice ${inventoryNumber} because ${count} inventory row(s) still reference it. Please delete those inventory entries first in the Inventory tab.`,
    };
  }

  const { error: deleteErr } = await supabase.from("Inventory").delete().eq("id", id);
  if (deleteErr) return { error: mapSupabaseError(deleteErr.message) };

  revalidatePath("/inventory");
  revalidatePath("/stock");
  return { error: null };
}

export async function updateInventory(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Not authenticated. Please log in." };
  if (session.role !== "admin" && session.role !== "user") {
    return { error: "You do not have permission to perform this action." };
  }
  const isAdmin = session.role === "admin";

  const id = formData.get("id")?.toString() ?? "";
  if (!id) return { error: "Missing inventory id" };

  const inventory_number = emptyToNull(formData.get("inventory_number"));
  if (!inventory_number) return { error: "Inventory number is required." };
  const company_name = emptyToNull(formData.get("company_name"));
  const agent_name = emptyToNull(formData.get("agent_name"));
  const transport_name = emptyToNull(formData.get("transport_name"));
  const waybill_number = emptyToNull(formData.get("waybill_number"));

  const { n: transport_charges, error: transportChargesErr } =
    parseOptionalFloat(formData.get("transport_charges"));
  if (transportChargesErr) return { error: transportChargesErr };

  const date_of_entry = emptyToNull(formData.get("date_of_entry"));

  const { n: loading_charges, error: loadingChargesErr } = parseOptionalFloat(
    formData.get("loading_charges"),
  );
  if (loadingChargesErr) return { error: loadingChargesErr };

  const staff_name = emptyToNull(formData.get("staff_name"));
  const location = emptyToNull(formData.get("location"));
  const invoice_number = emptyToNull(formData.get("invoice_number"));

  const { n: number_of_parcels, error: parcelsErr } = parseOptionalBigInt(
    formData.get("number_of_parcels"),
  );
  if (parcelsErr) return { error: parcelsErr };

  const { n: billed_quantity, error: billedQtyErr } = parseOptionalBigInt(
    formData.get("billed_quantity"),
  );
  if (billedQtyErr) return { error: billedQtyErr };

  const { n: received_quantity, error: receivedQtyErr } =
    parseOptionalBigInt(formData.get("received_quantity"));
  if (receivedQtyErr) return { error: receivedQtyErr };

  const tallying = emptyToNull(formData.get("tallying"));
  const pricing = emptyToNull(formData.get("pricing"));
  const stickering = emptyToNull(formData.get("stickering"));
  const supply = emptyToNull(formData.get("supply"));

  const { n: invoice_amount, error: invoiceAmountErr } = parseOptionalFloat(
    formData.get("invoice_amount"),
  );
  if (invoiceAmountErr) return { error: invoiceAmountErr };

  const invoice_date = emptyToNull(formData.get("invoice_date"));
  const invoiceUrls = await resolveDocumentUrlsFromForm(formData);
  if (invoiceUrls.error) return { error: invoiceUrls.error };
  const { invoice_image_url, product_image, debit_note } = invoiceUrls;
  const payment_details = isAdmin ? emptyToNull(formData.get("payment_details")) : null;
  const payment_mode = isAdmin ? emptyToNull(formData.get("payment_mode")) : null;
  const payment_status = isAdmin ? emptyToNull(formData.get("payment_status")) : null;

  const parsed: ParsedInventoryUpdate = {
    inventory_number,
    company_name,
    agent_name,
    transport_name,
    waybill_number,
    transport_charges,
    date_of_entry,
    loading_charges,
    staff_name,
    location,
    invoice_number,
    number_of_parcels,
    billed_quantity,
    received_quantity,
    tallying,
    pricing,
    stickering,
    supply,
    invoice_amount,
    invoice_date,
    invoice_image_url,
    product_image,
    payment_details,
    payment_mode,
    payment_status,
    debit_note,
  };

  const supabase = createSupabase();

  if (isAdmin) {
    const uniqErr = await assertInventoryNumberUnique(inventory_number, id);
    if (uniqErr.error) return uniqErr;

    const { error } = await supabase
      .from("Inventory")
      .update({
        ...parsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return { error: mapSupabaseError(error.message) };
    revalidatePath("/inventory");
    return { error: null };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("Inventory")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { error: mapSupabaseError(fetchErr.message) };
  if (!existing) return { error: "Inventory row not found" };

  const merged = mergeInventoryForRestrictedUser(existing as InvRow, parsed);

  const uniqErr = await assertInventoryNumberUnique(merged.inventory_number, id);
  if (uniqErr.error) return uniqErr;

  const { error } = await supabase
    .from("Inventory")
    .update({
      ...merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: mapSupabaseError(error.message) };
  revalidatePath("/inventory");
  return { error: null };
}

