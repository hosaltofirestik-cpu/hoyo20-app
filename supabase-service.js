import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_APP_SCOPE,
  SUPABASE_INVOICE_BUCKET,
  SUPABASE_TABLES,
  SUPABASE_URL,
} from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

const DEFAULT_SHARED_STATE = Object.freeze({
  incidents: [],
  requests: [],
  inventoryItems: [],
});

const DEFAULT_INVOICE_SETTINGS = Object.freeze({
  storageFolder: "facturas",
  cropX: 58,
  cropY: 7,
  cropWidth: 30,
  cropHeight: 12,
});

export function getSupabaseClient() {
  return supabase;
}

export function getDefaultSharedState() {
  return cloneJson(DEFAULT_SHARED_STATE);
}

export function getDefaultInvoiceSettings() {
  return cloneJson(DEFAULT_INVOICE_SETTINGS);
}

export async function signInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || "").trim(),
    password: String(password || ""),
  });
  if (error) throw error;
  if (data.user) {
    await ensureProfile(data.user);
  }
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user || null;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback({ event, session }));
}

export async function ensureProfile(user) {
  if (!user?.id) return null;
  const payload = {
    id: user.id,
    email: user.email || "",
    display_name: deriveDisplayName(user.email),
  };
  const { error } = await supabase.from(SUPABASE_TABLES.profiles).upsert(payload, { onConflict: "id" });
  if (error) throw error;
  return payload;
}

export async function fetchSharedState() {
  const user = await requireUser();
  await ensureProfile(user);
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.appState)
    .select("scope, incidents, requests, inventory_items, updated_at, updated_by, updated_by_email")
    .eq("scope", SUPABASE_APP_SCOPE)
    .maybeSingle();

  if (error) throw error;
  if (data) return mapSharedStateRow(data);

  const insertPayload = {
    scope: SUPABASE_APP_SCOPE,
    incidents: [],
    requests: [],
    inventory_items: [],
    updated_at: new Date().toISOString(),
    updated_by: user.id,
    updated_by_email: user.email || "",
  };

  const { data: inserted, error: insertError } = await supabase
    .from(SUPABASE_TABLES.appState)
    .insert(insertPayload)
    .select("scope, incidents, requests, inventory_items, updated_at, updated_by, updated_by_email")
    .single();

  if (insertError) throw insertError;
  return mapSharedStateRow(inserted);
}

export async function saveSharedState(nextState, auditMeta = {}) {
  const user = await requireUser();
  const now = new Date().toISOString();
  const payload = {
    scope: SUPABASE_APP_SCOPE,
    incidents: Array.isArray(nextState?.incidents) ? nextState.incidents : [],
    requests: Array.isArray(nextState?.requests) ? nextState.requests : [],
    inventory_items: Array.isArray(nextState?.inventoryItems) ? nextState.inventoryItems : [],
    updated_at: now,
    updated_by: user.id,
    updated_by_email: user.email || "",
  };

  const { data, error } = await supabase
    .from(SUPABASE_TABLES.appState)
    .upsert(payload, { onConflict: "scope" })
    .select("scope, incidents, requests, inventory_items, updated_at, updated_by, updated_by_email")
    .single();

  if (error) throw error;

  if (auditMeta?.action) {
    await insertAuditLog({
      action: auditMeta.action,
      entityId: auditMeta.entityId || SUPABASE_APP_SCOPE,
      entityType: auditMeta.entityType || "shared_state",
      module: auditMeta.module || "app",
      summary: auditMeta.summary || auditMeta.action,
      payload: auditMeta.payload || null,
      user,
      occurredAt: now,
    });
  }

  return mapSharedStateRow(data);
}

export async function fetchInvoiceSettings() {
  const user = await requireUser();
  await ensureProfile(user);
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.invoiceSettings)
    .select("*")
    .eq("scope", SUPABASE_APP_SCOPE)
    .maybeSingle();

  if (error) throw error;
  if (data) return normalizeInvoiceSettingsRow(data);

  const insertPayload = {
    scope: SUPABASE_APP_SCOPE,
    storage_folder: DEFAULT_INVOICE_SETTINGS.storageFolder,
    crop_x: DEFAULT_INVOICE_SETTINGS.cropX,
    crop_y: DEFAULT_INVOICE_SETTINGS.cropY,
    crop_width: DEFAULT_INVOICE_SETTINGS.cropWidth,
    crop_height: DEFAULT_INVOICE_SETTINGS.cropHeight,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
    updated_by_email: user.email || "",
  };

  const { data: inserted, error: insertError } = await supabase
    .from(SUPABASE_TABLES.invoiceSettings)
    .insert(insertPayload)
    .select("*")
    .single();

  if (insertError) throw insertError;
  return normalizeInvoiceSettingsRow(inserted);
}

export async function saveInvoiceSettings(settings) {
  const user = await requireUser();
  const now = new Date().toISOString();
  const payload = {
    scope: SUPABASE_APP_SCOPE,
    storage_folder: sanitizeStorageSegment(settings?.storageFolder || DEFAULT_INVOICE_SETTINGS.storageFolder) || DEFAULT_INVOICE_SETTINGS.storageFolder,
    crop_x: normalizeNumber(settings?.cropX, DEFAULT_INVOICE_SETTINGS.cropX),
    crop_y: normalizeNumber(settings?.cropY, DEFAULT_INVOICE_SETTINGS.cropY),
    crop_width: normalizeNumber(settings?.cropWidth, DEFAULT_INVOICE_SETTINGS.cropWidth),
    crop_height: normalizeNumber(settings?.cropHeight, DEFAULT_INVOICE_SETTINGS.cropHeight),
    updated_at: now,
    updated_by: user.id,
    updated_by_email: user.email || "",
  };

  const { data, error } = await supabase
    .from(SUPABASE_TABLES.invoiceSettings)
    .upsert(payload, { onConflict: "scope" })
    .select("*")
    .single();

  if (error) throw error;

  await insertAuditLog({
    action: "update_settings",
    entityId: SUPABASE_APP_SCOPE,
    entityType: "invoice_settings",
    module: "invoices",
    summary: "Configuracion de facturas actualizada",
    payload: {
      storageFolder: payload.storage_folder,
      cropX: payload.crop_x,
      cropY: payload.crop_y,
      cropWidth: payload.crop_width,
      cropHeight: payload.crop_height,
    },
    user,
    occurredAt: now,
  });

  return normalizeInvoiceSettingsRow(data);
}

export async function listInvoiceEntries({
  searchTerm = "",
  status = "",
  dateStart = "",
  dateEnd = "",
  page = 1,
  pageSize = 10,
} = {}) {
  await requireUser();
  let query = supabase
    .from(SUPABASE_TABLES.invoiceEntries)
    .select("*", { count: "exact" })
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }
  if (dateStart) {
    query = query.gte("service_date", dateStart);
  }
  if (dateEnd) {
    query = query.lte("service_date", dateEnd);
  }
  if (searchTerm) {
    const escaped = escapeFilterValue(searchTerm);
    query = query.or([
      `person_name.ilike.%${escaped}%`,
      `invoice_number.ilike.%${escaped}%`,
      `comment.ilike.%${escaped}%`,
      `updated_by_email.ilike.%${escaped}%`,
    ].join(","));
  }

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 10);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    rows: Array.isArray(data) ? data.map(normalizeInvoiceEntryRow) : [],
    count: count || 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function listInvoiceEntriesByRange({ dateStart = "", dateEnd = "", status = "" } = {}) {
  await requireUser();
  let query = supabase
    .from(SUPABASE_TABLES.invoiceEntries)
    .select("*")
    .order("service_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }
  if (dateStart) {
    query = query.gte("service_date", dateStart);
  }
  if (dateEnd) {
    query = query.lte("service_date", dateEnd);
  }

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data.map(normalizeInvoiceEntryRow) : [];
}

export async function createInvoiceEntry(payload) {
  const user = await requireUser();
  const now = new Date().toISOString();
  if (payload.status === "listo" && !normalizeText(payload.invoiceNumber)) {
    throw new Error("El numero de factura es obligatorio cuando el estado es listo.");
  }
  const row = {
    service_date: payload.serviceDate,
    invoice_number: payload.invoiceNumber || null,
    person_name: normalizeText(payload.personName),
    hours_amount: normalizeCurrencyValue(payload.hoursAmount),
    status: payload.status === "listo" ? "listo" : "pendiente",
    comment: normalizeText(payload.comment),
    photo_path: payload.photoPath || null,
    photo_file_name: payload.photoFileName || null,
    created_at: now,
    updated_at: now,
    created_by: user.id,
    created_by_email: user.email || "",
    updated_by: user.id,
    updated_by_email: user.email || "",
  };

  const { data, error } = await supabase
    .from(SUPABASE_TABLES.invoiceEntries)
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;

  await insertAuditLog({
    action: "create",
    entityId: data.id,
    entityType: "invoice_entry",
    module: "invoices",
    summary: `Factura pendiente creada para ${row.person_name}`,
    payload: {
      status: row.status,
      invoiceNumber: row.invoice_number,
    },
    user,
    occurredAt: now,
  });

  return normalizeInvoiceEntryRow(data);
}

export async function createInvoiceEntriesBatch(entries = [], meta = {}) {
  const user = await requireUser();
  const now = new Date().toISOString();
  const normalizedEntries = Array.isArray(entries)
    ? entries
      .map((entry) => ({
        service_date: normalizeText(entry?.serviceDate),
        invoice_number: normalizeText(entry?.invoiceNumber) || null,
        person_name: normalizeText(entry?.personName),
        hours_amount: normalizeCurrencyValue(entry?.hoursAmount),
        status: entry?.status === "listo" ? "listo" : "pendiente",
        comment: normalizeText(entry?.comment),
        photo_path: entry?.photoPath || null,
        photo_file_name: entry?.photoFileName || null,
        created_at: now,
        updated_at: now,
        created_by: user.id,
        created_by_email: user.email || "",
        updated_by: user.id,
        updated_by_email: user.email || "",
      }))
      .filter((entry) => entry.service_date && entry.person_name)
    : [];

  if (!normalizedEntries.length) {
    throw new Error("No hay registros validos para importar.");
  }

  const invalidReadyEntry = normalizedEntries.find((entry) => entry.status === "listo" && !entry.invoice_number);
  if (invalidReadyEntry) {
    throw new Error("Toda factura en estado listo necesita un numero de factura.");
  }

  const { data, error } = await supabase
    .from(SUPABASE_TABLES.invoiceEntries)
    .insert(normalizedEntries)
    .select("*");

  if (error) throw error;

  await insertAuditLog({
    action: "import_xlsx",
    entityId: meta.fileName || `import-${now}`,
    entityType: "invoice_entry_import",
    module: "invoices",
    summary: `Importacion XLSX de ${normalizedEntries.length} registro(s)`,
    payload: {
      fileName: meta.fileName || "",
      sheetName: meta.sheetName || "",
      count: normalizedEntries.length,
      names: normalizedEntries.slice(0, 25).map((entry) => entry.person_name),
    },
    user,
    occurredAt: now,
  });

  return Array.isArray(data) ? data.map(normalizeInvoiceEntryRow) : [];
}

export async function updateInvoiceEntry(id, payload) {
  const user = await requireUser();
  const now = new Date().toISOString();
  if (payload.status === "listo" && !normalizeText(payload.invoiceNumber)) {
    throw new Error("El numero de factura es obligatorio cuando el estado es listo.");
  }
  const row = {
    service_date: payload.serviceDate,
    invoice_number: payload.invoiceNumber || null,
    person_name: normalizeText(payload.personName),
    hours_amount: normalizeCurrencyValue(payload.hoursAmount),
    status: payload.status === "listo" ? "listo" : "pendiente",
    comment: normalizeText(payload.comment),
    photo_path: payload.photoPath || null,
    photo_file_name: payload.photoFileName || null,
    updated_at: now,
    updated_by: user.id,
    updated_by_email: user.email || "",
  };

  const { data, error } = await supabase
    .from(SUPABASE_TABLES.invoiceEntries)
    .update(row)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  await insertAuditLog({
    action: "update",
    entityId: id,
    entityType: "invoice_entry",
    module: "invoices",
    summary: `Factura actualizada para ${row.person_name}`,
    payload: {
      status: row.status,
      invoiceNumber: row.invoice_number,
    },
    user,
    occurredAt: now,
  });

  return normalizeInvoiceEntryRow(data);
}

export async function deleteInvoiceEntry(id) {
  const user = await requireUser();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from(SUPABASE_TABLES.invoiceEntries)
    .delete()
    .eq("id", id);

  if (error) throw error;

  await insertAuditLog({
    action: "delete",
    entityId: id,
    entityType: "invoice_entry",
    module: "invoices",
    summary: "Registro de factura eliminado",
    payload: null,
    user,
    occurredAt: now,
  });
}

export async function assignInvoiceToEntries({
  entryIds = [],
  invoiceNumber,
  file = null,
  comment = "",
  serviceDate = "",
  storageFolder = DEFAULT_INVOICE_SETTINGS.storageFolder,
} = {}) {
  const user = await requireUser();
  const ids = Array.from(new Set((entryIds || []).filter(Boolean)));
  if (!ids.length) {
    throw new Error("Selecciona por lo menos un registro pendiente.");
  }

  const normalizedInvoiceNumber = normalizeText(invoiceNumber);
  if (!normalizedInvoiceNumber) {
    throw new Error("El numero de factura es obligatorio.");
  }

  let photoPath = null;
  let photoFileName = null;
  if (file) {
    const upload = await uploadInvoicePhoto({
      file,
      invoiceNumber: normalizedInvoiceNumber,
      serviceDate,
      storageFolder,
    });
    photoPath = upload.path;
    photoFileName = upload.fileName;
  }

  const now = new Date().toISOString();
  const updatePayload = {
    invoice_number: normalizedInvoiceNumber,
    status: "listo",
    updated_at: now,
    updated_by: user.id,
    updated_by_email: user.email || "",
  };

  if (photoPath) {
    updatePayload.photo_path = photoPath;
    updatePayload.photo_file_name = photoFileName;
  }
  if (comment) {
    updatePayload.comment = normalizeText(comment);
  }

  const { data, error } = await supabase
    .from(SUPABASE_TABLES.invoiceEntries)
    .update(updatePayload)
    .in("id", ids)
    .select("*");

  if (error) throw error;

  await insertAuditLog({
    action: "mark_ready",
    entityId: normalizedInvoiceNumber,
    entityType: "invoice_entry_batch",
    module: "invoices",
    summary: `Factura ${normalizedInvoiceNumber} aplicada a ${ids.length} registro(s)`,
    payload: {
      entryIds: ids,
      photoPath,
      photoFileName,
    },
    user,
    occurredAt: now,
  });

  return Array.isArray(data) ? data.map(normalizeInvoiceEntryRow) : [];
}

export async function uploadInvoicePhoto({ file, invoiceNumber, serviceDate, storageFolder }) {
  await requireUser();
  if (!(file instanceof File)) {
    throw new Error("Debes seleccionar una imagen para subir.");
  }
  const monthKey = toMonthKey(serviceDate || new Date().toISOString());
  const extension = getFileExtension(file.name) || "jpg";
  const safeFolder = sanitizeStorageSegment(storageFolder || DEFAULT_INVOICE_SETTINGS.storageFolder) || DEFAULT_INVOICE_SETTINGS.storageFolder;
  const safeInvoiceNumber = sanitizeFileName(invoiceNumber) || `factura-${Date.now()}`;
  const fileName = `${safeInvoiceNumber}.${extension}`;
  const path = `${safeFolder}/${monthKey}/${fileName}`;

  const { error } = await supabase.storage
    .from(SUPABASE_INVOICE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (error) throw error;

  return {
    path,
    fileName,
    monthKey,
  };
}

export async function downloadInvoicePhoto(path) {
  await requireUser();
  const { data, error } = await supabase.storage
    .from(SUPABASE_INVOICE_BUCKET)
    .download(path);

  if (error) throw error;
  return data;
}

export async function createInvoicePhotoUrl(path, expiresIn = 3600) {
  await requireUser();
  if (!path) return "";
  const { data, error } = await supabase.storage
    .from(SUPABASE_INVOICE_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data?.signedUrl || "";
}

export async function insertAuditLog({
  module = "app",
  entityType = "record",
  entityId = "",
  action = "update",
  summary = "",
  payload = null,
  user = null,
  occurredAt = new Date().toISOString(),
} = {}) {
  const actor = user || await requireUser();
  const row = {
    module,
    entity_type: entityType,
    entity_id: String(entityId || ""),
    action,
    summary,
    payload,
    changed_by: actor.id,
    changed_by_email: actor.email || "",
    changed_at: occurredAt,
  };

  const { error } = await supabase.from(SUPABASE_TABLES.auditLog).insert(row);
  if (error) throw error;
}

export function formatSupabaseError(error, fallback = "No fue posible completar la operacion en Supabase.") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return parts.join(" | ") || fallback;
}

export function normalizeCurrencyValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  // Remover símbolos de moneda comunes incluyendo RD$
  const cleaned = raw
    .replace(/RD\$/gi, "")
    .replace(/\$/g, "")
    .replace(/[^0-9.,-]/g, "");

  if (!cleaned) return 0;

  // Manejar formato con coma como separador decimal (ej: 1.234,56)
  const normalized = cleaned.includes(",") && cleaned.includes(".")
    ? cleaned.replace(/,/g, "")  // Si tiene ambos, asumir que la coma es separador de miles
    : cleaned.replace(",", "."); // Si solo tiene coma, asumir que es decimal

  const number = Number(normalized);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalizeCurrencyValue(value)).replace("US$", "$");
}

function mapSharedStateRow(row) {
  return {
    incidents: Array.isArray(row?.incidents) ? row.incidents : [],
    requests: Array.isArray(row?.requests) ? row.requests : [],
    inventoryItems: Array.isArray(row?.inventory_items) ? row.inventory_items : [],
    meta: {
      updatedAt: row?.updated_at || "",
      updatedBy: row?.updated_by || "",
      updatedByEmail: row?.updated_by_email || "",
    },
  };
}

function normalizeInvoiceEntryRow(row) {
  return {
    id: row?.id || "",
    serviceDate: row?.service_date || "",
    invoiceNumber: row?.invoice_number || "",
    personName: row?.person_name || "",
    hoursAmount: normalizeCurrencyValue(row?.hours_amount),
    status: row?.status === "listo" ? "listo" : "pendiente",
    comment: row?.comment || "",
    photoPath: row?.photo_path || "",
    photoFileName: row?.photo_file_name || "",
    createdAt: row?.created_at || "",
    createdBy: row?.created_by || "",
    createdByEmail: row?.created_by_email || "",
    updatedAt: row?.updated_at || "",
    updatedBy: row?.updated_by || "",
    updatedByEmail: row?.updated_by_email || "",
  };
}

function normalizeInvoiceSettingsRow(row) {
  return {
    scope: row?.scope || SUPABASE_APP_SCOPE,
    storageFolder: row?.storage_folder || DEFAULT_INVOICE_SETTINGS.storageFolder,
    cropX: normalizeNumber(row?.crop_x, DEFAULT_INVOICE_SETTINGS.cropX),
    cropY: normalizeNumber(row?.crop_y, DEFAULT_INVOICE_SETTINGS.cropY),
    cropWidth: normalizeNumber(row?.crop_width, DEFAULT_INVOICE_SETTINGS.cropWidth),
    cropHeight: normalizeNumber(row?.crop_height, DEFAULT_INVOICE_SETTINGS.cropHeight),
    updatedAt: row?.updated_at || "",
    updatedBy: row?.updated_by || "",
    updatedByEmail: row?.updated_by_email || "",
  };
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("La sesion ha expirado. Inicia sesion nuevamente.");
  }
  return user;
}

function deriveDisplayName(email) {
  const local = String(email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!local) return "Usuario interno";
  return local
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toMonthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 7);
  }
  return date.toISOString().slice(0, 7);
}

function getFileExtension(fileName) {
  const parts = String(fileName || "").trim().split(".");
  return parts.length > 1 ? sanitizeFileName(parts.pop()).toLowerCase() : "";
}

function sanitizeStorageSegment(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => sanitizeFileName(segment))
    .filter(Boolean)
    .join("/");
}

function sanitizeFileName(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeFilterValue(value) {
  return String(value || "")
    .trim()
    .replace(/[%(),]/g, " ")
    .replace(/\s+/g, " ");
}
