import { createInvoiceModule } from "./modules/invoices/invoice-module.js";
import {
  fetchSharedState,
  formatSupabaseError,
  getCurrentSession,
  getCurrentUser,
  saveSharedState,
  signInWithPassword,
  signOut,
  onAuthStateChange,
} from "./supabase-service.js";

const INVENTORY_BAY_OPTIONS = Array.from({ length: 6 }, (_, index) => `Bahia ${index + 1}`);
const INVENTORY_ISSUE_REASONS = ["Se rompio", "Se perdio", "Desgaste", "No se encontro", "Otro"];

const adminShell = document.getElementById("admin-shell");
const authShell = document.getElementById("auth-shell");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authStatus = document.getElementById("auth-status");
const incidentForm = document.getElementById("incident-form");
const inventoryForm = document.getElementById("inventory-form");
const tableBody = document.getElementById("incident-table-body");
const requestsTableBody = document.getElementById("requests-table-body");
const inventoryTableBody = document.getElementById("inventory-table-body");
const selector = document.getElementById("incident-selector");
const generateMailButton = document.getElementById("generate-mail");
const saveRequestButton = document.getElementById("save-request");
const copyMailButton = document.getElementById("copy-mail");
const mailOutput = document.getElementById("mail-output");
const storageStatus = document.getElementById("storage-status");
const drawer = document.getElementById("case-drawer");
const drawerBackdrop = document.getElementById("drawer-backdrop");
const drawerTitle = document.getElementById("drawer-title");
const pageHeadActions = document.getElementById("page-head-actions");
const resultsMeta = document.getElementById("results-meta");
const requestsResultsMeta = document.getElementById("requests-results-meta");
const inventoryResultsMeta = document.getElementById("inventory-results-meta");
const paginationInfo = document.getElementById("pagination-info");
const pageIndicator = document.getElementById("page-indicator");
const pageTitle = document.getElementById("page-title");
const pageSubtitle = document.getElementById("page-subtitle");
const navItems = Array.from(document.querySelectorAll(".nav-item"));
const documentView = document.getElementById("document-view");
const requestDocumentView = document.getElementById("request-document-view");
const inventoryDetailTitle = document.getElementById("inventory-detail-title");
const inventoryDetailSubtitle = document.getElementById("inventory-detail-subtitle");
const inventorySummaryMetrics = document.getElementById("inventory-summary-metrics");
const inventoryAllocationTableBody = document.getElementById("inventory-allocation-table-body");
const menuToggle = document.getElementById("menu-toggle");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const inventoryAllocationResultsMeta = document.getElementById("inventory-allocation-results-meta");
const inventoryCollectionPanel = document.getElementById("inventory-collection-panel");
const inventoryHistoryTableBody = document.getElementById("inventory-history-table-body");
const inventoryHistoryResultsMeta = document.getElementById("inventory-history-results-meta");
const inventoryPaginationInfo = document.getElementById("inventory-pagination-info");
const inventoryPageIndicator = document.getElementById("inventory-page-indicator");
const inventoryHistoryPaginationInfo = document.getElementById("inventory-history-pagination-info");
const inventoryHistoryPageIndicator = document.getElementById("inventory-history-page-indicator");
const inventoryReportResultsMeta = document.getElementById("inventory-report-results-meta");
const inventoryReportSummary = document.getElementById("inventory-report-summary");
const inventoryReportTableBody = document.getElementById("inventory-report-table-body");
const invoiceModuleHost = document.getElementById("invoice-module-host");
const currentUserEmail = document.getElementById("current-user-email");
const currentUserChip = document.getElementById("current-user-chip");
const logoutButton = document.getElementById("logout-button");
const syncDataButton = document.getElementById("sync-data");

const incidentsModule = document.getElementById("incidents-module");
const incidentsDetailModule = document.getElementById("incidents-detail-module");
const requestsModule = document.getElementById("requests-module");
const requestsDetailModule = document.getElementById("requests-detail-module");
const inventoryModule = document.getElementById("inventory-module");
const inventoryDetailModule = document.getElementById("inventory-detail-module");

const createCaseButtons = [
  document.getElementById("create-case"),
  document.getElementById("open-new-case"),
];

const fields = {
  id: document.getElementById("incident-id"),
  occurredAt: document.getElementById("occurred-at"),
  recordCreatedAt: document.getElementById("record-created-at"),
  createdAtDisplay: document.getElementById("created-at-display"),
  area: document.getElementById("area"),
  title: document.getElementById("title"),
  priority: document.getElementById("priority"),
  impact: document.getElementById("impact"),
  description: document.getElementById("description"),
  cause: document.getElementById("cause"),
  solution: document.getElementById("solution"),
  status: document.getElementById("status"),
  requestType: document.getElementById("request-type"),
  owner: document.getElementById("owner"),
  notes: document.getElementById("notes"),
  recipient: document.getElementById("recipient"),
  mailGoal: document.getElementById("mail-goal"),
  mailTone: document.getElementById("mail-tone"),
  extraContext: document.getElementById("extra-context"),
  inventoryId: document.getElementById("inventory-id"),
  inventoryName: document.getElementById("inventory-name"),
  inventoryStock: document.getElementById("inventory-stock"),
  inventoryLocation: document.getElementById("inventory-location"),
  inventoryMinStock: document.getElementById("inventory-min-stock"),
  inventoryLastMovement: document.getElementById("inventory-last-movement"),
};

const filters = {
  search: document.getElementById("global-search"),
  status: document.getElementById("status-filter"),
  priority: document.getElementById("priority-filter"),
};

const controls = {
  editSelected: document.getElementById("edit-selected"),
  generateSelectedMail: document.getElementById("generate-selected-mail"),
  closeDrawer: document.getElementById("close-drawer"),
  resetForm: document.getElementById("reset-form"),
  prevPage: document.getElementById("prev-page"),
  nextPage: document.getElementById("next-page"),
  pageSize: document.getElementById("page-size"),
  viewCaseDetail: document.getElementById("view-case-detail"),
  viewMailDetail: document.getElementById("view-mail-detail"),
  downloadPdf: document.getElementById("download-pdf"),
  openInventoryForm: document.getElementById("open-inventory-form"),
  inventoryMoveQty: document.getElementById("inventory-move-qty"),
  inventoryCheckoutBays: document.getElementById("inventory-checkout-bays"),
  inventoryCheckout: document.getElementById("inventory-checkout"),
  inventoryPrevPage: document.getElementById("inventory-prev-page"),
  inventoryNextPage: document.getElementById("inventory-next-page"),
  inventoryPageSize: document.getElementById("inventory-page-size"),
  inventoryHistoryPrevPage: document.getElementById("inventory-history-prev-page"),
  inventoryHistoryNextPage: document.getElementById("inventory-history-next-page"),
  inventoryHistoryPageSize: document.getElementById("inventory-history-page-size"),
  inventoryReportPreset: document.getElementById("inventory-report-preset"),
  inventoryReportStart: document.getElementById("inventory-report-start"),
  inventoryReportEnd: document.getElementById("inventory-report-end"),
  exportIncidentsXlsx: document.getElementById("export-incidents-xlsx"),
  exportRequestsXlsx: document.getElementById("export-requests-xlsx"),
  exportInventoryReportXlsx: document.getElementById("export-inventory-report-xlsx"),
};

const tabButtons = Array.from(document.querySelectorAll(".tab-button"));
const drawerSections = {
  "case-form": document.getElementById("case-form-section"),
  "mail-panel": document.getElementById("mail-panel-section"),
  "inventory-form": document.getElementById("inventory-form-section"),
};

let incidents = [];
let requests = [];
let inventoryItems = [];
let selectedIncidentId = "";
let selectedRequestId = "";
let selectedInventoryId = "";
let currentPage = 1;
let pageSize = Number(controls.pageSize.value);
let inventoryCurrentPage = 1;
let inventoryPageSize = Number(controls.inventoryPageSize.value);
let inventoryHistoryPage = 1;
let inventoryHistoryPageSize = Number(controls.inventoryHistoryPageSize.value);
let currentView = "all";
let currentDetailMode = "case";
let selectedCheckoutBay = INVENTORY_BAY_OPTIONS[0];
let selectedAllocationBay = "";
let inventoryCollectionState = {
  action: "full",
  qty: 1,
  reason: "",
  note: "",
};
let currentUser = null;
let isAppReady = false;
const invoiceModule = invoiceModuleHost
  ? createInvoiceModule({
    host: invoiceModuleHost,
    onStatusChange: updateStorageStatus,
  })
  : null;

setDefaultTimestampsForNewRecord();
applyInventoryReportPreset("7d");
invoiceModule?.mount();
renderSelector();
applyViewMeta();
applyModuleVisibility();
renderAll();

authForm.addEventListener("submit", handleAuthSubmit);
logoutButton.addEventListener("click", handleSignOut);
syncDataButton.addEventListener("click", syncSharedStateFromSupabase);

// Event listeners para menú móvil
menuToggle.addEventListener("click", toggleMobileMenu);
sidebarOverlay.addEventListener("click", closeMobileMenu);

onAuthStateChange(({ session }) => {
  if (session?.user) {
    if (currentUser?.id === session.user.id && isAppReady) return;
    handleAuthenticatedSession(session.user);
    return;
  }
  handleSignedOutState();
});

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    currentView = item.dataset.view || "all";
    navItems.forEach((nav) => nav.classList.toggle("active", nav === item));
    currentPage = 1;
    applyViewMeta();
    applyModuleVisibility();
    renderAll();
  });
});

createCaseButtons.forEach((button) => button.addEventListener("click", openFormForCreate));
controls.editSelected.addEventListener("click", () => {
  const selected = getSelectedIncident();
  if (!selected) return updateStorageStatus("Selecciona un caso para editar.", "error");
  openFormForEdit(selected);
});
controls.generateSelectedMail.addEventListener("click", () => {
  const selected = getSelectedIncident();
  if (!selected) return updateStorageStatus("Selecciona un caso para generar la solicitud.", "error");
  openDrawer("mail-panel");
  selector.value = selected.id;
});
controls.closeDrawer.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);
controls.resetForm.addEventListener("click", resetIncidentForm);
controls.openInventoryForm.addEventListener("click", openInventoryFormForCreate);
controls.viewCaseDetail.addEventListener("click", () => {
  currentDetailMode = "case";
  renderIncidentDetail();
});
controls.viewMailDetail.addEventListener("click", () => {
  currentDetailMode = "mail";
  renderIncidentDetail();
});
controls.downloadPdf.addEventListener("click", handleDownloadPdf);
controls.inventoryCheckout.addEventListener("click", () => registerInventoryMovement("checkout"));
controls.inventoryCheckoutBays.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-checkout-bay]");
  if (!chip) return;
  selectedCheckoutBay = chip.dataset.checkoutBay;
  renderInventoryMovementControls();
});
inventoryCollectionPanel.addEventListener("click", handleInventoryCollectionPanelClick);
inventoryCollectionPanel.addEventListener("change", handleInventoryCollectionPanelChange);
inventoryCollectionPanel.addEventListener("input", handleInventoryCollectionPanelInput);
filters.search.addEventListener("input", rerenderPaged);
filters.status.addEventListener("change", rerenderPaged);
filters.priority.addEventListener("change", rerenderPaged);
controls.inventoryReportPreset.addEventListener("change", () => {
  applyInventoryReportPreset(controls.inventoryReportPreset.value);
  renderAll();
});
controls.inventoryReportStart.addEventListener("change", handleInventoryReportDateChange);
controls.inventoryReportEnd.addEventListener("change", handleInventoryReportDateChange);
controls.exportIncidentsXlsx.addEventListener("click", exportIncidentsXlsx);
controls.exportRequestsXlsx.addEventListener("click", exportRequestsXlsx);
controls.exportInventoryReportXlsx.addEventListener("click", exportInventoryReportXlsx);
controls.pageSize.addEventListener("change", () => {
  pageSize = Number(controls.pageSize.value);
  currentPage = 1;
  renderAll();
});
controls.inventoryPageSize.addEventListener("change", () => {
  inventoryPageSize = Number(controls.inventoryPageSize.value);
  inventoryCurrentPage = 1;
  renderAll();
});
controls.inventoryHistoryPageSize.addEventListener("change", () => {
  inventoryHistoryPageSize = Number(controls.inventoryHistoryPageSize.value);
  inventoryHistoryPage = 1;
  renderAll();
});
controls.prevPage.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderAll();
  }
});
controls.nextPage.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(getFilteredIncidents().length / pageSize));
  if (currentPage < totalPages) {
    currentPage += 1;
    renderAll();
  }
});
controls.inventoryPrevPage.addEventListener("click", () => {
  if (inventoryCurrentPage > 1) {
    inventoryCurrentPage -= 1;
    renderAll();
  }
});
controls.inventoryNextPage.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(getFilteredInventoryItems().length / inventoryPageSize));
  if (inventoryCurrentPage < totalPages) {
    inventoryCurrentPage += 1;
    renderAll();
  }
});
controls.inventoryHistoryPrevPage.addEventListener("click", () => {
  if (inventoryHistoryPage > 1) {
    inventoryHistoryPage -= 1;
    renderAll();
  }
});
controls.inventoryHistoryNextPage.addEventListener("click", () => {
  const item = getSelectedInventoryItem();
  const totalPages = Math.max(1, Math.ceil((item?.movements?.length || 0) / inventoryHistoryPageSize));
  if (inventoryHistoryPage < totalPages) {
    inventoryHistoryPage += 1;
    renderAll();
  }
});
tabButtons.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
incidentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const previousState = snapshotSharedState();
  const actor = getActorMetadata();
  const now = new Date().toISOString();
  const incident = {
    id: fields.id.value || window.crypto?.randomUUID?.() || `incident-${Date.now()}`,
    occurredAt: fields.occurredAt.value,
    area: fields.area.value.trim(),
    title: fields.title.value.trim(),
    priority: fields.priority.value,
    impact: fields.impact.value,
    description: fields.description.value.trim(),
    cause: fields.cause.value.trim(),
    solution: fields.solution.value.trim(),
    status: fields.status.value,
    requestType: fields.requestType.value,
    owner: fields.owner.value.trim(),
    notes: fields.notes.value.trim(),
    createdAt: fields.recordCreatedAt.value || new Date().toISOString(),
    updatedAt: now,
    updatedBy: actor.id,
    updatedByEmail: actor.email,
    ...(fields.id.value ? {} : {
      createdBy: actor.id,
      createdByEmail: actor.email,
    }),
  };

  const index = incidents.findIndex((item) => item.id === incident.id);
  if (index >= 0) {
    incidents[index] = { ...incidents[index], ...incident };
  } else {
    incidents.unshift(incident);
  }

  incidents = normalizeIncidents(incidents);
  selectedIncidentId = incident.id;
  renderSelector(incident.id);
  renderAll();
  closeDrawer();
  await persistSharedState({
    action: index >= 0 ? "update_incident" : "create_incident",
    entityId: incident.id,
    entityType: "incident",
    module: "incidents",
    summary: `${index >= 0 ? "Caso actualizado" : "Caso creado"}: ${incident.title}`,
  }, "Caso guardado correctamente.", previousState);
});

inventoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const previousState = snapshotSharedState();
  const actor = getActorMetadata();
  const updatedAt = new Date().toISOString();
  const item = {
    id: fields.inventoryId.value || window.crypto?.randomUUID?.() || `inventory-${Date.now()}`,
    name: fields.inventoryName.value.trim(),
    stock: Number(fields.inventoryStock.value),
    baseStock: Number(fields.inventoryStock.value),
    location: fields.inventoryLocation.value.trim(),
    minStock: Number(fields.inventoryMinStock.value),
    lastMovement: fields.inventoryLastMovement.value.trim(),
    updatedAt,
    updatedBy: actor.id,
    updatedByEmail: actor.email,
    totalStock: Number(fields.inventoryStock.value),
  };

  const index = inventoryItems.findIndex((entry) => entry.id === item.id);
  if (index >= 0) {
    const current = normalizeInventoryItems([inventoryItems[index]])[0];
    const movements = [...(current.movements || [])];
    if (item.lastMovement) {
      movements.unshift(createInventoryMovement({
        at: updatedAt,
        action: "Actualizacion manual",
        category: "manual",
        bay: current.location || item.location,
        qty: 0,
        reason: "Registro manual",
        note: item.lastMovement,
        availableAfter: current.availableStock,
        totalAfter: item.totalStock,
      }));
    }
    const currentAvailable = Number(current.availableStock ?? current.stock ?? 0);
    const previousTotal = Number(current.totalStock ?? current.stock ?? 0);
    const delta = item.totalStock - previousTotal;
    const allocatedQty = getAllocatedQty(current);
    inventoryItems[index] = {
      ...current,
      ...item,
      baseStock: current.baseStock ?? current.totalStock,
      availableStock: Math.max(0, Math.min(currentAvailable + delta, Math.max(item.totalStock - allocatedQty, 0))),
      movements,
    };
  } else {
    inventoryItems.unshift({
      ...item,
      createdBy: actor.id,
      createdByEmail: actor.email,
      availableStock: item.stock,
      allocated: [],
      movements: item.lastMovement ? [createInventoryMovement({
        at: updatedAt,
        action: "Alta de articulo",
        category: "manual",
        bay: item.location,
        qty: item.stock,
        reason: "Registro inicial",
        note: item.lastMovement,
        availableAfter: item.stock,
        totalAfter: item.totalStock,
      })] : [],
    });
  }

  selectedInventoryId = item.id;
  inventoryCurrentPage = 1;
  inventoryHistoryPage = 1;
  renderAll();
  closeDrawer();
  await persistSharedState({
    action: index >= 0 ? "update_inventory" : "create_inventory",
    entityId: item.id,
    entityType: "inventory_item",
    module: "inventory",
    summary: `${index >= 0 ? "Consumible actualizado" : "Consumible creado"}: ${item.name}`,
  }, "Consumible guardado correctamente.", previousState);
});

generateMailButton.addEventListener("click", () => {
  const incident = incidents.find((item) => item.id === selector.value);
  if (!incident) {
    mailOutput.value = "Selecciona un caso registrado para generar el borrador.";
    return;
  }
  mailOutput.value = buildMailBody(incident, {
    recipient: fields.recipient.value.trim(),
    goal: fields.mailGoal.value,
    tone: fields.mailTone.value,
    extraContext: fields.extraContext.value.trim(),
  });
});

saveRequestButton.addEventListener("click", async () => {
  const incident = incidents.find((item) => item.id === selector.value);
  if (!incident) return updateStorageStatus("Selecciona un caso base antes de guardar la solicitud.", "error");
  const previousState = snapshotSharedState();
  const actor = getActorMetadata();

  const body = mailOutput.value.trim() || buildMailBody(incident, {
    recipient: fields.recipient.value.trim(),
    goal: fields.mailGoal.value,
    tone: fields.mailTone.value,
    extraContext: fields.extraContext.value.trim(),
  });

  const request = {
    id: window.crypto?.randomUUID?.() || `request-${Date.now()}`,
    incidentId: incident.id,
    incidentTitle: incident.title,
    recipient: fields.recipient.value.trim() || "No definido",
    goal: fields.mailGoal.value,
    tone: fields.mailTone.value,
    body,
    status: "Pendiente",
    createdAt: new Date().toISOString(),
    createdBy: actor.id,
    createdByEmail: actor.email,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.id,
    updatedByEmail: actor.email,
  };

  requests.unshift(request);
  selectedRequestId = request.id;
  renderAll();
  await persistSharedState({
    action: "create_request",
    entityId: request.id,
    entityType: "request",
    module: "requests",
    summary: `Solicitud creada para ${request.recipient}`,
  }, "Solicitud guardada correctamente.", previousState);
});

copyMailButton.addEventListener("click", async () => {
  if (!mailOutput.value.trim()) {
    mailOutput.value = "Genera primero un borrador para poder copiarlo.";
    return;
  }
  try {
    await navigator.clipboard.writeText(mailOutput.value);
    copyMailButton.textContent = "Texto copiado";
    setTimeout(() => { copyMailButton.textContent = "Copiar texto"; }, 1800);
  } catch {
    copyMailButton.textContent = "Copia manual";
    setTimeout(() => { copyMailButton.textContent = "Copiar texto"; }, 1800);
  }
});

tableBody.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  const incident = incidents.find((item) => item.id === row.dataset.id);
  if (!incident) return;

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "edit") {
    selectedIncidentId = incident.id;
    return openFormForEdit(incident);
  }
  if (action === "mail") {
    selectedIncidentId = incident.id;
    selector.value = incident.id;
    return openDrawer("mail-panel");
  }
  if (event.target.closest("select, button, option")) return;

  selectedIncidentId = incident.id;
  renderAll();
});

tableBody.addEventListener("change", async (event) => {
  const statusControl = event.target.closest("[data-status-control]");
  if (!statusControl) return;
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  const incident = incidents.find((item) => item.id === row.dataset.id);
  if (!incident) return;
  const previousState = snapshotSharedState();
  const actor = getActorMetadata();

  incident.status = statusControl.value;
  incident.updatedAt = new Date().toISOString();
  incident.updatedBy = actor.id;
  incident.updatedByEmail = actor.email;
  selectedIncidentId = incident.id;
  renderAll();
  await persistSharedState({
    action: "update_incident_status",
    entityId: incident.id,
    entityType: "incident",
    module: "incidents",
    summary: `Estado de incidencia actualizado a ${incident.status}`,
  }, `Estado actualizado a ${incident.status}.`, previousState);
});

requestsTableBody.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  selectedRequestId = row.dataset.id;
  renderAll();
});

requestsTableBody.addEventListener("change", async (event) => {
  const control = event.target.closest("[data-request-status]");
  if (!control) return;
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  const request = requests.find((item) => item.id === row.dataset.id);
  if (!request) return;
  const previousState = snapshotSharedState();
  const actor = getActorMetadata();
  request.status = control.value;
  request.updatedAt = new Date().toISOString();
  request.updatedBy = actor.id;
  request.updatedByEmail = actor.email;
  selectedRequestId = request.id;
  renderAll();
  await persistSharedState({
    action: "update_request_status",
    entityId: request.id,
    entityType: "request",
    module: "requests",
    summary: `Estado de solicitud actualizado a ${request.status}`,
  }, `Solicitud actualizada a ${request.status}.`, previousState);
});

inventoryTableBody.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  const item = inventoryItems.find((entry) => entry.id === row.dataset.id);
  if (!item) return;

  const action = event.target.closest("[data-inventory-action]")?.dataset.inventoryAction;
  if (action === "edit") {
    return openInventoryFormForEdit(item);
  }

  selectedInventoryId = item.id;
  inventoryHistoryPage = 1;
  clearInventoryCollectionSelection();
  renderAll();
});

inventoryAllocationTableBody.addEventListener("click", (event) => {
  const action = event.target.closest("[data-allocation-action]")?.dataset.allocationAction;
  if (action !== "manage") return;
  const row = event.target.closest("tr[data-bay]");
  if (!row) return;
  openInventoryCollection(row.dataset.bay);
});

inventoryHistoryTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-action]");
  if (!button) return;
  if (button.dataset.historyAction !== "delete") return;
  deleteInventoryMovement(button.dataset.movementId);
});

function rerenderPaged() {
  currentPage = 1;
  inventoryCurrentPage = 1;
  invoiceModule?.setSearchTerm(filters.search.value);
  renderAll();
}

function renderAll() {
  ensureSelectedInventoryItem();
  renderIncidentTable();
  renderIncidentDetail();
  renderRequests();
  renderRequestDetail();
  renderInventory();
  renderInventoryDetail();
  renderInventoryMovementControls();
  invoiceModule?.setSearchTerm(filters.search.value);
}

function ensureSelectedInventoryItem() {
  if (inventoryItems.length && !inventoryItems.some((item) => item.id === selectedInventoryId)) {
    selectedInventoryId = inventoryItems[0].id;
  }
}

async function initializeSession() {
  updateStorageStatus("Conectando con Supabase...", "loading");
  try {
    const session = await getCurrentSession();
    if (session?.user) {
      await handleAuthenticatedSession(session.user);
      return;
    }
    handleSignedOutState();
    authStatus.textContent = "Inicia sesion para acceder a la informacion compartida.";
  } catch (error) {
    handleSignedOutState();
    authStatus.textContent = formatSupabaseError(error, "No fue posible validar la sesion.");
    updateStorageStatus(authStatus.textContent, "error");
  }
}

async function handleAuthenticatedSession(user) {
  currentUser = user;
  isAppReady = true;
  authShell.classList.add("hidden");
  adminShell.classList.remove("hidden");
  authPassword.value = "";
  authStatus.textContent = "Sesion activa.";
  currentUserEmail.textContent = user.email || "Usuario interno";
  currentUserChip.textContent = getUserInitials(user.email || "TI");
  await syncSharedStateFromSupabase();
}

function handleSignedOutState() {
  currentUser = null;
  isAppReady = false;
  authShell.classList.remove("hidden");
  adminShell.classList.add("hidden");
  currentUserEmail.textContent = "Sin sesion";
  currentUserChip.textContent = "--";
  incidents = [];
  requests = [];
  inventoryItems = [];
  selectedIncidentId = "";
  selectedRequestId = "";
  selectedInventoryId = "";
  renderSelector();
  renderAll();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  authStatus.textContent = "Validando acceso...";
  try {
    const result = await signInWithPassword({
      email: authEmail.value.trim(),
      password: authPassword.value,
    });
    if (result?.user) {
      await handleAuthenticatedSession(result.user);
    }
  } catch (error) {
    authStatus.textContent = formatSupabaseError(error, "No fue posible iniciar sesion.");
  }
}

async function handleSignOut() {
  try {
    await signOut();
    handleSignedOutState();
    authStatus.textContent = "Sesion cerrada.";
    updateStorageStatus("Sesion cerrada correctamente.", "saved");
  } catch (error) {
    updateStorageStatus(formatSupabaseError(error, "No fue posible cerrar la sesion."), "error");
  }
}

async function syncSharedStateFromSupabase() {
  if (!currentUser) return;
  updateStorageStatus("Sincronizando datos compartidos...", "loading");
  try {
    const sharedState = await fetchSharedState();
    applyLoadedSharedState(sharedState);
    renderSelector(selectedIncidentId);
    renderAll();
    updateStorageStatus(`Datos sincronizados desde Supabase${sharedState.meta?.updatedByEmail ? ` por ${sharedState.meta.updatedByEmail}` : ""}.`, "saved");
    if (currentView === "invoices") {
      await invoiceModule?.refresh?.();
    }
  } catch (error) {
    updateStorageStatus(formatSupabaseError(error, "No fue posible sincronizar los datos compartidos."), "error");
  }
}

async function persistSharedState(auditMeta, successMessage, previousState = null) {
  if (!currentUser) {
    updateStorageStatus("Inicia sesion para guardar cambios compartidos.", "error");
    return false;
  }
  inventoryItems = normalizeInventoryItems(inventoryItems);
  const snapshot = previousState || snapshotSharedState();
  try {
    const sharedState = await saveSharedState({
      incidents,
      requests,
      inventoryItems,
    }, auditMeta);
    applyLoadedSharedState(sharedState);
    renderSelector(selectedIncidentId);
    renderAll();
    updateStorageStatus(successMessage, "saved");
    return true;
  } catch (error) {
    restoreSharedState(snapshot);
    renderSelector(selectedIncidentId);
    renderAll();
    updateStorageStatus(formatSupabaseError(error, "No fue posible guardar en Supabase."), "error");
    return false;
  }
}

function snapshotSharedState() {
  return {
    incidents: JSON.parse(JSON.stringify(incidents)),
    requests: JSON.parse(JSON.stringify(requests)),
    inventoryItems: JSON.parse(JSON.stringify(inventoryItems)),
  };
}

function restoreSharedState(snapshot) {
  incidents = normalizeIncidents(snapshot?.incidents || []);
  requests = normalizeRequests(snapshot?.requests || []);
  inventoryItems = normalizeInventoryItems(snapshot?.inventoryItems || []);
  if (!incidents.length) selectedIncidentId = "";
  if (!requests.length) selectedRequestId = "";
  if (!inventoryItems.length) selectedInventoryId = "";
}

function applyLoadedSharedState(sharedState) {
  incidents = normalizeIncidents(sharedState?.incidents || []);
  requests = normalizeRequests(sharedState?.requests || []);
  inventoryItems = normalizeInventoryItems(sharedState?.inventoryItems || []);
  if (!incidents.length) selectedIncidentId = "";
  if (!requests.length) selectedRequestId = "";
  if (!inventoryItems.length) selectedInventoryId = "";
  if (incidents.length && !incidents.some((item) => item.id === selectedIncidentId)) {
    selectedIncidentId = incidents[0].id;
  }
  if (requests.length && !requests.some((item) => item.id === selectedRequestId)) {
    selectedRequestId = requests[0].id;
  }
  if (inventoryItems.length && !inventoryItems.some((item) => item.id === selectedInventoryId)) {
    selectedInventoryId = inventoryItems[0].id;
  }
}

function normalizeInventoryItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const totalStock = normalizeNumber(item?.totalStock ?? item?.stock, 0);
    const baseStock = normalizeNumber(item?.baseStock, totalStock);
    const allocated = normalizeInventoryAllocations(item?.allocated);
    const allocatedQty = getAllocatedQty({ allocated });
    const availableCandidate = item?.availableStock == null
      ? Math.max(totalStock - allocatedQty, 0)
      : normalizeNumber(item.availableStock, totalStock - allocatedQty);
    const availableStock = Math.max(0, Math.min(availableCandidate, Math.max(totalStock - allocatedQty, 0)));
    const updatedAt = item?.updatedAt || item?.createdAt || new Date().toISOString();
    const movements = normalizeInventoryMovements(item?.movements, item?.lastMovement, updatedAt);
    return {
      id: item?.id || `inventory-${Date.now()}-${index}`,
      name: item?.name || "Articulo sin nombre",
      baseStock,
      stock: totalStock,
      totalStock,
      availableStock,
      location: item?.location || "Sin ubicacion base",
      minStock: normalizeNumber(item?.minStock, 0),
      lastMovement: item?.lastMovement || movements[0]?.summary || "Sin movimientos",
      updatedAt,
      updatedBy: item?.updatedBy || "",
      updatedByEmail: item?.updatedByEmail || "",
      createdBy: item?.createdBy || "",
      createdByEmail: item?.createdByEmail || "",
      allocated,
      movements,
    };
  });
}

function normalizeIncidents(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: item?.id || `incident-${Date.now()}-${index}`,
    occurredAt: normalizeOccurredAt(item),
    area: item?.area || "Servicio no especificado",
    title: item?.title || "Incidencia sin titulo",
    priority: item?.priority || "Media",
    impact: item?.impact || "Afectacion parcial a usuarios",
    description: item?.description || "No se registro una descripcion tecnica del incidente.",
    cause: item?.cause || "No se registro un diagnostico tecnico.",
    solution: item?.solution || "No se registro una accion de remediacion.",
    status: item?.status || "Abierto",
    requestType: item?.requestType || "Ninguna",
    owner: item?.owner || "",
    notes: item?.notes || "",
    createdAt: normalizeCreatedAt(item),
    createdBy: item?.createdBy || "",
    createdByEmail: item?.createdByEmail || "",
    updatedAt: item?.updatedAt || normalizeCreatedAt(item),
    updatedBy: item?.updatedBy || "",
    updatedByEmail: item?.updatedByEmail || "",
  }));
}

function normalizeRequests(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: item?.id || `request-${Date.now()}-${index}`,
    incidentId: item?.incidentId || "",
    incidentTitle: item?.incidentTitle || "Solicitud sin caso base",
    recipient: item?.recipient || "No definido",
    goal: item?.goal || "gestion",
    tone: item?.tone || "corporativo",
    body: item?.body || "",
    status: item?.status || "Pendiente",
    createdAt: item?.createdAt || new Date().toISOString(),
    createdBy: item?.createdBy || "",
    createdByEmail: item?.createdByEmail || "",
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
    updatedBy: item?.updatedBy || "",
    updatedByEmail: item?.updatedByEmail || "",
  }));
}

function renderIncidentTable() {
  const filtered = getFilteredIncidents();
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(startIndex, startIndex + pageSize);
  resultsMeta.textContent = `${filtered.length} registro(s)`;
  paginationInfo.textContent = `Mostrando ${filtered.length ? startIndex + 1 : 0}-${Math.min(startIndex + pageSize, filtered.length)} de ${filtered.length}`;
  pageIndicator.textContent = `Pagina ${currentPage} de ${totalPages}`;

  if (!paginated.length) {
    tableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">No hay resultados para los filtros actuales.</td></tr>';
    return;
  }

  tableBody.innerHTML = paginated.map((incident) => `
    <tr data-id="${incident.id}" class="${incident.id === selectedIncidentId ? "selected" : ""}">
      <td>${incident.id.slice(0, 8)}</td>
      <td>${formatDateTime(incident.occurredAt)}</td>
      <td>${escapeHtml(incident.area)}</td>
      <td>${escapeHtml(incident.title)}</td>
      <td><span class="badge ${priorityClass(incident.priority)}">${escapeHtml(incident.priority)}</span></td>
      <td><span class="badge ${statusClass(incident.status)}">${escapeHtml(incident.status)}</span></td>
      <td>${escapeHtml(incident.owner || "Soporte TI")}</td>
      <td>
        <div class="row-actions">
          <select data-status-control onclick="event.stopPropagation()">${renderStatusOptions(incident.status)}</select>
          <button type="button" class="link-button" data-action="edit">Editar</button>
          <button type="button" class="link-button" data-action="mail">Solicitud</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderRequests() {
  const filtered = getFilteredRequests();
  requestsResultsMeta.textContent = filtered.length === requests.length
    ? `${requests.length} registro(s)`
    : `${filtered.length} de ${requests.length} registro(s)`;
  if (!filtered.length) {
    requestsTableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No hay solicitudes guardadas.</td></tr>';
    return;
  }
  requestsTableBody.innerHTML = filtered.map((request) => `
    <tr data-id="${request.id}" class="${request.id === selectedRequestId ? "selected" : ""}">
      <td>${request.id.slice(0, 8)}</td>
      <td>${formatDateTime(request.createdAt)}</td>
      <td>${escapeHtml(request.incidentTitle)}</td>
      <td>${escapeHtml(request.recipient)}</td>
      <td><select data-request-status onclick="event.stopPropagation()">${renderRequestStatusOptions(request.status)}</select></td>
      <td><button type="button" class="link-button">Ver</button></td>
    </tr>
  `).join("");
}

function renderInventory() {
  const filtered = getFilteredInventoryItems();
  const totalPages = Math.max(1, Math.ceil(filtered.length / inventoryPageSize));
  if (inventoryCurrentPage > totalPages) inventoryCurrentPage = totalPages;

  const startIndex = (inventoryCurrentPage - 1) * inventoryPageSize;
  const paginated = filtered.slice(startIndex, startIndex + inventoryPageSize);
  inventoryResultsMeta.textContent = filtered.length === inventoryItems.length
    ? `${inventoryItems.length} articulo(s)`
    : `${filtered.length} de ${inventoryItems.length} articulo(s)`;
  inventoryPaginationInfo.textContent = `Mostrando ${filtered.length ? startIndex + 1 : 0}-${Math.min(startIndex + inventoryPageSize, filtered.length)} de ${filtered.length}`;
  inventoryPageIndicator.textContent = `Pagina ${inventoryCurrentPage} de ${totalPages}`;

  if (!paginated.length) {
    inventoryTableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">No hay consumibles registrados.</td></tr>';
    return;
  }
  inventoryTableBody.innerHTML = paginated.map((item) => {
    const available = Number(item.availableStock ?? item.stock ?? 0);
    const total = Number(item.totalStock ?? item.stock ?? 0);
    const assigned = getAllocatedQty(item);
    return `
      <tr data-id="${item.id}" class="${item.id === selectedInventoryId ? "selected" : ""}">
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(String(available))}${available <= item.minStock ? ' <span class="badge priority-alta">Bajo</span>' : ""}</td>
        <td>${escapeHtml(String(total))}</td>
        <td>${escapeHtml(String(assigned))}</td>
        <td>${escapeHtml(String(item.minStock))}</td>
        <td>${escapeHtml(item.location)}</td>
        <td>${escapeHtml(formatDateTime(item.updatedAt))}</td>
        <td><button type="button" class="link-button" data-inventory-action="edit">Editar</button></td>
      </tr>
    `;
  }).join("");
}

function renderSelector(selectedId = "") {
  selector.innerHTML = '<option value="">Selecciona un caso registrado</option>';
  incidents.forEach((incident) => {
    const option = document.createElement("option");
    option.value = incident.id;
    option.textContent = `${formatDateTime(incident.occurredAt)} | ${incident.title}`;
    selector.appendChild(option);
  });
  selector.value = selectedId;
}

function getFilteredIncidents() {
  const search = filters.search.value.trim().toLowerCase();
  const status = filters.status.value;
  const priority = filters.priority.value;
  return incidents.filter((incident) => {
    const matchesSearch = !search || [incident.area, incident.title, incident.owner, incident.description]
      .some((value) => (value || "").toLowerCase().includes(search));
    const matchesStatus = !status || incident.status === status;
    const matchesPriority = !priority || incident.priority === priority;
    return matchesSearch && matchesStatus && matchesPriority && matchesCurrentView(incident);
  });
}

function getFilteredRequests() {
  const search = filters.search.value.trim().toLowerCase();
  if (!search) return requests;
  return requests.filter((request) => [request.incidentTitle, request.recipient, request.status, request.body]
    .some((value) => (value || "").toLowerCase().includes(search)));
}

function getFilteredInventoryItems() {
  const search = filters.search.value.trim().toLowerCase();
  if (!search) return inventoryItems;
  return inventoryItems.filter((item) => [item.name, item.location, item.lastMovement]
    .some((value) => (value || "").toLowerCase().includes(search)));
}

function matchesCurrentView(incident) {
  if (currentView === "followup") return ["En analisis", "En seguimiento", "Escalado"].includes(incident.status);
  if (currentView === "resolved") return incident.status === "Resuelto";
  return currentView === "all";
}
function openFormForCreate() {
  resetIncidentForm();
  fields.occurredAt.readOnly = false;
  drawerTitle.textContent = "Nuevo caso";
  openDrawer("case-form");
}

function openFormForEdit(incident) {
  const safe = normalizeIncidents([incident])[0];
  fields.id.value = safe.id;
  fields.occurredAt.value = toDatetimeLocalValue(safe.occurredAt);
  fields.occurredAt.readOnly = true;
  fields.recordCreatedAt.value = safe.createdAt;
  fields.createdAtDisplay.value = formatDateTime(safe.createdAt);
  fields.area.value = safe.area;
  fields.title.value = safe.title;
  fields.priority.value = safe.priority;
  fields.impact.value = safe.impact;
  fields.description.value = safe.description;
  fields.cause.value = safe.cause;
  fields.solution.value = safe.solution;
  fields.status.value = safe.status;
  fields.requestType.value = safe.requestType;
  fields.owner.value = safe.owner;
  fields.notes.value = safe.notes;
  drawerTitle.textContent = "Editar caso";
  openDrawer("case-form");
}

function openInventoryFormForCreate() {
  inventoryForm.reset();
  fields.inventoryId.value = "";
  drawerTitle.textContent = "Nuevo consumible";
  openDrawer("inventory-form");
}

function openInventoryFormForEdit(item) {
  fields.inventoryId.value = item.id;
  fields.inventoryName.value = item.name;
  fields.inventoryStock.value = item.totalStock ?? item.stock;
  fields.inventoryLocation.value = item.location;
  fields.inventoryMinStock.value = item.minStock;
  fields.inventoryLastMovement.value = item.lastMovement || "";
  drawerTitle.textContent = "Editar consumible";
  openDrawer("inventory-form");
}

function resetIncidentForm() {
  incidentForm.reset();
  fields.id.value = "";
  setDefaultTimestampsForNewRecord();
  fields.occurredAt.readOnly = false;
  drawerTitle.textContent = "Nuevo caso";
}

function openDrawer(tab = "case-form") {
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  drawerBackdrop.hidden = false;
  switchTab(tab);
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  drawerBackdrop.hidden = true;
}

function switchTab(tab) {
  tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  Object.entries(drawerSections).forEach(([key, section]) => section.classList.toggle("active", key === tab));
}

function applyViewMeta() {
  const invoiceViewMeta = invoiceModule?.getViewMeta?.() || [
    "Facturacion compartida",
    "Registro pendiente, cierre con OCR, foto en Storage y reporte mensual exportable.",
  ];
  const viewMap = {
    all: ["Incidencias operativas", "Registro centralizado de incidentes, analisis tecnico y solicitudes derivadas."],
    requests: ["Solicitudes registradas", "Seguimiento de solicitudes generadas y su estado de atencion."],
    followup: ["Casos en seguimiento", "Incidencias abiertas, en analisis o escaladas que requieren continuidad."],
    inventory: ["Consumibles y gastables", "Control de stock, salidas y ubicacion por bahia o area."],
    invoices: invoiceViewMeta,
    resolved: ["Casos resueltos", "Incidencias cerradas para consulta historica y control."],
  };
  const [title, subtitle] = viewMap[currentView] || viewMap.all;
  const showIncidentActions = ["all", "followup", "resolved"].includes(currentView);
  pageTitle.textContent = title;
  pageSubtitle.textContent = subtitle;
  pageHeadActions.classList.toggle("hidden", !showIncidentActions);
  createCaseButtons.forEach((button) => button.classList.toggle("hidden", !showIncidentActions));
}

function applyModuleVisibility() {
  const showIncidents = ["all", "followup", "resolved"].includes(currentView);
  const showRequests = currentView === "requests";
  const showInventory = currentView === "inventory";
  const showInvoices = currentView === "invoices";
  incidentsModule.classList.toggle("hidden", !showIncidents);
  incidentsDetailModule.classList.toggle("hidden", !showIncidents);
  requestsModule.classList.toggle("hidden", !showRequests);
  requestsDetailModule.classList.toggle("hidden", !showRequests);
  inventoryModule.classList.toggle("hidden", !showInventory);
  inventoryDetailModule.classList.toggle("hidden", !showInventory);
  invoiceModule?.setVisible(showInvoices);
}

function getSelectedIncident() {
  return incidents.find((item) => item.id === selectedIncidentId);
}

function getSelectedRequest() {
  return requests.find((item) => item.id === selectedRequestId);
}

function getSelectedInventoryItem() {
  return inventoryItems.find((item) => item.id === selectedInventoryId);
}

function renderIncidentDetail() {
  const incident = getSelectedIncident();
  if (!incident) {
    documentView.innerHTML = '<div class="document-empty">Selecciona un caso para ver el detalle completo.</div>';
    return;
  }
  documentView.innerHTML = currentDetailMode === "mail" ? renderMailDocument(incident) : renderCaseDocument(incident);
}

function renderRequestDetail() {
  const request = getSelectedRequest();
  if (!request) {
    requestDocumentView.innerHTML = '<div class="document-empty">Selecciona una solicitud para ver su detalle.</div>';
    return;
  }
  requestDocumentView.innerHTML = renderRequestDocument(request);
}

function renderInventoryDetail() {
  const item = getSelectedInventoryItem();
  if (!item) {
    inventoryDetailTitle.textContent = "Detalle de consumible";
    inventoryDetailSubtitle.textContent = "Selecciona un articulo para revisar asignaciones, perdidas y movimientos.";
    inventorySummaryMetrics.innerHTML = '<div class="inventory-summary-empty">Selecciona un articulo para ver el resumen operativo.</div>';
    inventoryAllocationResultsMeta.textContent = "0 registros";
    inventoryAllocationTableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">Selecciona un articulo para ver las bahias asignadas.</td></tr>';
    inventoryCollectionPanel.classList.remove("open");
    inventoryCollectionPanel.setAttribute("aria-hidden", "true");
    inventoryCollectionPanel.innerHTML = "";
    inventoryHistoryResultsMeta.textContent = "0 registros";
    inventoryHistoryPaginationInfo.textContent = "Mostrando 0-0 de 0";
    inventoryHistoryPageIndicator.textContent = "Pagina 1";
    inventoryHistoryTableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">Selecciona un articulo para ver su historial.</td></tr>';
    inventoryReportResultsMeta.textContent = "0 bahias";
    inventoryReportSummary.innerHTML = '<div class="inventory-summary-empty">Selecciona un articulo para ver el reporte de perdidas.</div>';
    inventoryReportTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">Selecciona un articulo para generar el reporte.</td></tr>';
    return;
  }
  inventoryDetailTitle.textContent = item.name;
  inventoryDetailSubtitle.textContent = `Ubicacion base: ${item.location} | Ultima actualizacion: ${formatDateTime(item.updatedAt)}`;
  inventorySummaryMetrics.innerHTML = renderInventorySummary(item);
  renderInventoryAllocationTable(item);
  renderInventoryCollectionPanel(item);
  renderInventoryHistoryTable(item);
  renderInventoryReport(item);
}

function renderInventoryMovementControls() {
  const item = getSelectedInventoryItem();
  if (!item) {
    controls.inventoryCheckoutBays.innerHTML = '<span class="chip-hint">Selecciona un consumible para habilitar movimientos.</span>';
    controls.inventoryCheckout.disabled = true;
    return;
  }

  const checkoutOptions = getCheckoutBayOptions(item);

  if (!checkoutOptions.some((bay) => sameBayLabel(bay, selectedCheckoutBay))) {
    selectedCheckoutBay = checkoutOptions[0] || "";
  }

  controls.inventoryCheckoutBays.innerHTML = checkoutOptions.map((bay) => `
    <button type="button" class="chip ${sameBayLabel(bay, selectedCheckoutBay) ? "active" : ""}" data-checkout-bay="${escapeHtml(bay)}">
      ${escapeHtml(bay)}
    </button>
  `).join("");

  controls.inventoryCheckout.disabled = !selectedCheckoutBay;
}

function renderInventorySummary(item) {
  const assignedQty = getAllocatedQty(item);
  const issueEvents = (item.movements || []).filter((movement) => movement.category === "issue");
  const issueQty = issueEvents.reduce((total, movement) => total + normalizeNumber(movement.qty, 0), 0);
  const cards = [
    {
      label: "Disponible",
      value: String(item.availableStock),
      meta: "Stock listo para entregar",
    },
    {
      label: "Entregado",
      value: String(assignedQty),
      meta: "Cantidad actualmente en bahias",
    },
    {
      label: "Bajas registradas",
      value: String(issueQty),
      meta: "Unidades perdidas, rotas o descartadas",
    },
    {
      label: "Eventos de no recuperado",
      value: String(issueEvents.length),
      meta: "Veces que una entrega no retorno al stock",
    },
  ];

  return cards.map((card) => `
    <article class="summary-card">
      <span class="summary-card-label">${escapeHtml(card.label)}</span>
      <strong class="summary-card-value">${escapeHtml(card.value)}</strong>
      <span class="summary-card-meta">${escapeHtml(card.meta)}</span>
    </article>
  `).join("");
}

function renderInventoryAllocationTable(item) {
  const allocations = getReturnBayOptions(item);
  inventoryAllocationResultsMeta.textContent = `${allocations.length} registro(s)`;
  if (!allocations.length) {
    selectedAllocationBay = "";
    inventoryAllocationTableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">No hay bahias con material asignado.</td></tr>';
    return;
  }

  if (!allocations.some((entry) => sameBayLabel(entry.bay, selectedAllocationBay))) {
    selectedAllocationBay = "";
    inventoryCollectionState = {
      action: "full",
      qty: 1,
      reason: "",
      note: "",
    };
  }

  inventoryAllocationTableBody.innerHTML = allocations.map((entry) => `
    <tr data-bay="${escapeHtml(entry.bay)}" class="${sameBayLabel(entry.bay, selectedAllocationBay) ? "selected" : ""}">
      <td>${escapeHtml(entry.bay)}</td>
      <td>${escapeHtml(String(entry.qty))}</td>
      <td><span class="badge status-en-seguimiento">Pendiente de recogida</span></td>
      <td><button type="button" class="link-button" data-allocation-action="manage">Gestionar</button></td>
    </tr>
  `).join("");
}

function renderInventoryCollectionPanel(item) {
  const allocation = getSelectedAllocation(item);
  if (!allocation) {
    inventoryCollectionPanel.classList.remove("open");
    inventoryCollectionPanel.setAttribute("aria-hidden", "true");
    inventoryCollectionPanel.innerHTML = "";
    return;
  }

  const pendingQty = allocation.qty;
  const isFull = inventoryCollectionState.action === "full";
  const isIssue = inventoryCollectionState.action === "issue";
  const actionOptions = [
    { value: "full", label: "Recoger todo" },
    { value: "partial", label: "Recoger parcial" },
    { value: "issue", label: "No se pudo recoger" },
  ];
  const effectiveQty = isFull
    ? pendingQty
    : Math.min(Math.max(normalizeNumber(inventoryCollectionState.qty, 1), 1), pendingQty);

  inventoryCollectionPanel.classList.add("open");
  inventoryCollectionPanel.setAttribute("aria-hidden", "false");
  inventoryCollectionPanel.innerHTML = `
    <div class="inventory-collection-dialog" data-collection-dialog>
      <div class="collection-panel-header">
        <div>
          <span class="section-title">Gestion de recogida</span>
          <p class="detail-subtitle">Bahia seleccionada: ${escapeHtml(allocation.bay)} | Pendiente: ${escapeHtml(String(pendingQty))}</p>
        </div>
        <button type="button" class="icon-close" data-collection-cancel>Cerrar</button>
      </div>
      <div class="collection-grid">
        <label class="inventory-movement-field">
          <span>Accion</span>
          <select data-collection-field="action">
            ${actionOptions.map((option) => `<option value="${option.value}" ${option.value === inventoryCollectionState.action ? "selected" : ""}>${option.label}</option>`).join("")}
          </select>
        </label>
        <label class="inventory-movement-field">
          <span>Cantidad</span>
          <input type="number" data-collection-field="qty" min="1" max="${pendingQty}" value="${effectiveQty}" ${isFull ? "readonly" : ""}>
        </label>
        ${isIssue ? `
          <label class="inventory-movement-field inventory-reason-field">
            <span>Motivo</span>
            <select data-collection-field="reason">
              <option value="">Selecciona un motivo</option>
              ${INVENTORY_ISSUE_REASONS.map((reason) => `<option value="${escapeHtml(reason)}" ${reason === inventoryCollectionState.reason ? "selected" : ""}>${escapeHtml(reason)}</option>`).join("")}
            </select>
          </label>
          <label class="inventory-movement-field inventory-note-field full-width">
            <span>Detalle obligatorio</span>
            <input type="text" data-collection-field="note" value="${escapeHtml(inventoryCollectionState.note)}" placeholder="Ej. Tee roto al desmontar la reserva de ${escapeHtml(allocation.bay)}">
          </label>
        ` : ""}
      </div>
      <div class="inventory-collection-actions">
        <button type="button" class="primary" data-collection-submit>Aplicar</button>
        <button type="button" class="secondary" data-collection-cancel>Cancelar</button>
      </div>
    </div>
  `;
}

function renderInventoryHistoryTable(item) {
  const movements = Array.isArray(item.movements) ? item.movements : [];
  const totalPages = Math.max(1, Math.ceil(movements.length / inventoryHistoryPageSize));
  if (inventoryHistoryPage > totalPages) inventoryHistoryPage = totalPages;

  const startIndex = (inventoryHistoryPage - 1) * inventoryHistoryPageSize;
  const paginated = movements.slice(startIndex, startIndex + inventoryHistoryPageSize);
  inventoryHistoryResultsMeta.textContent = `${movements.length} registro(s)`;
  inventoryHistoryPaginationInfo.textContent = `Mostrando ${movements.length ? startIndex + 1 : 0}-${Math.min(startIndex + inventoryHistoryPageSize, movements.length)} de ${movements.length}`;
  inventoryHistoryPageIndicator.textContent = `Pagina ${inventoryHistoryPage} de ${totalPages}`;

  if (!paginated.length) {
    inventoryHistoryTableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">No hay movimientos registrados.</td></tr>';
    return;
  }

  inventoryHistoryTableBody.innerHTML = paginated.map((movement) => `
    <tr>
      <td>${escapeHtml(formatDateTime(movement.at))}</td>
      <td>${escapeHtml(movement.action)}</td>
      <td>${escapeHtml(movement.bay || "-")}</td>
      <td>${escapeHtml(movement.qty ? String(movement.qty) : "-")}</td>
      <td>${escapeHtml(movement.reason || "-")}</td>
      <td>${escapeHtml(movement.note || movement.summary || "-")}</td>
      <td>${escapeHtml(formatInventoryStockSnapshot(movement))}</td>
      <td><button type="button" class="link-button danger-text" data-history-action="delete" data-movement-id="${escapeHtml(movement.id)}">Eliminar</button></td>
    </tr>
  `).join("");
}

function renderInventoryReport(item) {
  const range = getInventoryReportRange();
  const issueMovements = (item.movements || []).filter((movement) => movement.category === "issue" && isWithinInventoryReportRange(movement.at, range));
  const byBay = aggregateInventoryIssuesByBay(issueMovements);
  const totalLostQty = issueMovements.reduce((total, movement) => total + normalizeNumber(movement.qty, 0), 0);

  inventoryReportResultsMeta.textContent = `${byBay.length} bahia(s)`;
  inventoryReportSummary.innerHTML = renderInventoryReportSummaryCards(item, issueMovements.length, totalLostQty, byBay.length, range);

  if (!byBay.length) {
    inventoryReportTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No hay perdidas registradas en el rango seleccionado.</td></tr>';
    return;
  }

  inventoryReportTableBody.innerHTML = byBay.map((entry) => `
    <tr>
      <td>${escapeHtml(entry.bay)}</td>
      <td>${escapeHtml(String(entry.qty))}</td>
      <td>${escapeHtml(String(entry.events))}</td>
      <td>${escapeHtml(entry.reasons.join(", "))}</td>
      <td>${escapeHtml(formatDateTime(entry.lastAt))}</td>
    </tr>
  `).join("");
}

function handleInventoryCollectionPanelClick(event) {
  const item = getSelectedInventoryItem();
  if (!item) return;

  if (event.target === inventoryCollectionPanel) {
    clearInventoryCollectionSelection();
    renderAll();
    return;
  }

  if (event.target.closest("[data-collection-cancel]")) {
    clearInventoryCollectionSelection();
    renderAll();
    return;
  }

  if (event.target.closest("[data-collection-submit]")) {
    applyInventoryCollectionAction(item);
  }
}

function handleInventoryCollectionPanelChange(event) {
  const field = event.target.dataset.collectionField;
  if (!field) return;

  if (field === "action") {
    inventoryCollectionState.action = event.target.value;
    const allocation = getSelectedAllocation(getSelectedInventoryItem());
    if (inventoryCollectionState.action === "full") {
      inventoryCollectionState.qty = allocation?.qty || 1;
    } else {
      inventoryCollectionState.qty = Math.min(Math.max(normalizeNumber(inventoryCollectionState.qty, 1), 1), allocation?.qty || 1);
    }
    if (inventoryCollectionState.action !== "issue") {
      inventoryCollectionState.reason = "";
      inventoryCollectionState.note = "";
    }
    renderInventoryCollectionPanel(getSelectedInventoryItem());
    return;
  }

  if (field === "reason") {
    inventoryCollectionState.reason = event.target.value;
    return;
  }
}

function handleInventoryCollectionPanelInput(event) {
  const field = event.target.dataset.collectionField;
  if (!field) return;

  if (field === "qty") {
    const allocation = getSelectedAllocation(getSelectedInventoryItem());
    const maxQty = allocation?.qty || 1;
    inventoryCollectionState.qty = Math.min(Math.max(normalizeNumber(event.target.value, 1), 1), maxQty);
    return;
  }

  if (field === "note") {
    inventoryCollectionState.note = event.target.value;
  }
}

function openInventoryCollection(bay) {
  const item = getSelectedInventoryItem();
  if (!item) return;
  const allocation = (item.allocated || []).find((entry) => sameBayLabel(entry.bay, bay));
  if (!allocation) return;
  selectedAllocationBay = allocation.bay;
  inventoryCollectionState = {
    action: "full",
    qty: allocation.qty,
    reason: "",
    note: "",
  };
  renderAll();
}

function clearInventoryCollectionSelection() {
  selectedAllocationBay = "";
  inventoryCollectionState = {
    action: "full",
    qty: 1,
    reason: "",
    note: "",
  };
}

function getSelectedAllocation(item) {
  if (!item || !selectedAllocationBay) return null;
  return (item.allocated || []).find((entry) => sameBayLabel(entry.bay, selectedAllocationBay)) || null;
}

function applyInventoryCollectionAction(item) {
  const allocation = getSelectedAllocation(item);
  if (!allocation) {
    return updateStorageStatus("Selecciona una bahia pendiente para gestionar la recogida.", "error");
  }

  const qty = inventoryCollectionState.action === "full"
    ? allocation.qty
    : Math.min(Math.max(normalizeNumber(inventoryCollectionState.qty, 0), 1), allocation.qty);

  if (!qty || qty < 1) {
    return updateStorageStatus("Indica una cantidad valida para la recogida.", "error");
  }

  if (inventoryCollectionState.action === "issue") {
    return registerInventoryMovement("issue", {
      bay: allocation.bay,
      qty,
      reason: inventoryCollectionState.reason,
      note: inventoryCollectionState.note.trim(),
    });
  }

  return registerInventoryMovement("return", {
    bay: allocation.bay,
    qty,
  });
}

async function deleteInventoryMovement(movementId) {
  const item = getSelectedInventoryItem();
  if (!item) return updateStorageStatus("Selecciona un consumible para modificar el historial.", "error");

  const movement = (item.movements || []).find((entry) => entry.id === movementId);
  if (!movement) return updateStorageStatus("No se encontro el registro seleccionado.", "error");
  if (!window.confirm(`Se eliminara el registro "${movement.summary || movement.action}". Deseas continuar?`)) return;
  const previousState = snapshotSharedState();
  const actor = getActorMetadata();

  item.movements = (item.movements || []).filter((entry) => entry.id !== movementId);
  rebuildInventoryState(item);
  item.updatedBy = actor.id;
  item.updatedByEmail = actor.email;
  inventoryHistoryPage = 1;
  clearInventoryCollectionSelection();
  renderAll();
  await persistSharedState({
    action: "delete_inventory_history",
    entityId: movementId,
    entityType: "inventory_movement",
    module: "inventory",
    summary: `Movimiento eliminado en ${item.name}`,
  }, "Registro eliminado y estado del articulo recalculado.", previousState);
}

function rebuildInventoryState(item) {
  const normalizedMovements = normalizeInventoryMovements(item.movements, "", item.updatedAt);
  const replay = replayInventoryMovements(normalizedMovements, inferInventoryBaseStock(item, normalizedMovements));
  item.baseStock = replay.baseStock;
  item.totalStock = replay.totalStock;
  item.stock = replay.totalStock;
  item.availableStock = replay.availableStock;
  item.allocated = replay.allocated;
  item.movements = replay.movements;
  item.updatedAt = replay.updatedAt;
  item.lastMovement = replay.lastMovement;
}

function replayInventoryMovements(movements, baseStock) {
  const ordered = [...movements].sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
  let totalStock = normalizeNumber(baseStock, 0);
  let availableStock = normalizeNumber(baseStock, 0);
  let allocated = [];
  let updatedAt = new Date().toISOString();

  ordered.forEach((movement) => {
    updatedAt = movement.at || updatedAt;

    if (movement.category === "manual") {
      if (Number.isFinite(movement.totalAfter)) totalStock = normalizeNumber(movement.totalAfter, totalStock);
      if (Number.isFinite(movement.availableAfter)) {
        availableStock = normalizeNumber(movement.availableAfter, availableStock);
      }
    }

    if (movement.category === "checkout") {
      allocated = applyAllocationDelta(allocated, movement.bay, movement.qty);
      availableStock -= movement.qty;
    }

    if (movement.category === "return") {
      allocated = applyAllocationDelta(allocated, movement.bay, -movement.qty);
      availableStock += movement.qty;
    }

    if (movement.category === "issue") {
      allocated = applyAllocationDelta(allocated, movement.bay, -movement.qty);
      totalStock -= movement.qty;
    }

    availableStock = clampInventoryAvailable(totalStock, allocated, availableStock);
  });

  const normalizedOrdered = ordered.map((movement) => createInventoryMovement(movement));
  const normalizedDesc = normalizedOrdered.sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  return {
    baseStock: normalizeNumber(baseStock, 0),
    totalStock: Math.max(0, normalizeNumber(totalStock, 0)),
    availableStock: clampInventoryAvailable(totalStock, allocated, availableStock),
    allocated: normalizeInventoryAllocations(allocated),
    movements: normalizedDesc,
    updatedAt,
    lastMovement: normalizedDesc[0]?.summary || "Sin movimientos",
  };
}

function inferInventoryBaseStock(item, movements) {
  if (Number.isFinite(Number(item?.baseStock))) return normalizeNumber(item.baseStock, 0);
  const ordered = [...movements].sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
  const firstSnapshot = ordered.find((movement) => Number.isFinite(movement.totalAfter));
  if (firstSnapshot) return normalizeNumber(firstSnapshot.totalAfter, normalizeNumber(item?.totalStock ?? item?.stock, 0));
  const issueQty = ordered
    .filter((movement) => movement.category === "issue")
    .reduce((total, movement) => total + normalizeNumber(movement.qty, 0), 0);
  return Math.max(normalizeNumber(item?.totalStock ?? item?.stock, 0) + issueQty, 0);
}

function applyAllocationDelta(allocated, bay, delta) {
  const next = normalizeInventoryAllocations(allocated);
  const existing = next.find((entry) => sameBayLabel(entry.bay, bay));
  if (existing) {
    existing.qty = Math.max(0, normalizeNumber(existing.qty, 0) + delta);
  } else if (delta > 0) {
    next.push({ bay, qty: delta });
  }
  return next.filter((entry) => entry.qty > 0);
}

function clampInventoryAvailable(totalStock, allocated, candidate) {
  const maxAvailable = Math.max(normalizeNumber(totalStock, 0) - getAllocatedQty({ allocated }), 0);
  return Math.max(0, Math.min(normalizeNumber(candidate, maxAvailable), maxAvailable));
}

function handleInventoryReportDateChange() {
  controls.inventoryReportPreset.value = "custom";
  renderAll();
}

function applyInventoryReportPreset(preset) {
  const end = new Date();
  let start = new Date(end);
  if (preset === "30d") start.setDate(end.getDate() - 29);
  else if (preset === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);
  else if (preset === "custom") return;
  else start.setDate(end.getDate() - 6);

  controls.inventoryReportStart.value = toDateInputValue(start);
  controls.inventoryReportEnd.value = toDateInputValue(end);
}

function getInventoryReportRange() {
  const endValue = controls.inventoryReportEnd.value || toDateInputValue(new Date());
  const startValue = controls.inventoryReportStart.value || endValue;
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T23:59:59`);
  return {
    start,
    end,
  };
}

function isWithinInventoryReportRange(value, range) {
  const date = safeDate(value);
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

function aggregateInventoryIssuesByBay(movements) {
  const map = new Map();
  movements.forEach((movement) => {
    const key = movement.bay || "Sin bahia";
    if (!map.has(key)) {
      map.set(key, {
        bay: key,
        qty: 0,
        events: 0,
        reasons: new Set(),
        lastAt: movement.at,
      });
    }
    const entry = map.get(key);
    entry.qty += normalizeNumber(movement.qty, 0);
    entry.events += 1;
    if (movement.reason) entry.reasons.add(movement.reason);
    if (!entry.lastAt || new Date(movement.at).getTime() > new Date(entry.lastAt).getTime()) {
      entry.lastAt = movement.at;
    }
  });

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      reasons: Array.from(entry.reasons),
    }))
    .sort((left, right) => right.qty - left.qty || left.bay.localeCompare(right.bay, "es", { numeric: true, sensitivity: "base" }));
}

function renderInventoryReportSummaryCards(item, issueEvents, lostQty, bayCount, range) {
  const rangeLabel = `${toDateDisplayValue(range.start)} al ${toDateDisplayValue(range.end)}`;
  const cards = [
    {
      label: "Existencia actual",
      value: `${item.availableStock} / ${item.totalStock}`,
      meta: "Disponible / total al momento",
    },
    {
      label: "Perdidas en rango",
      value: String(lostQty),
      meta: rangeLabel,
    },
    {
      label: "Eventos con perdida",
      value: String(issueEvents),
      meta: "Registros no recuperados en el rango",
    },
    {
      label: "Bahias afectadas",
      value: String(bayCount),
      meta: "Bahias con perdidas reportadas",
    },
  ];

  return cards.map((card) => `
    <article class="summary-card">
      <span class="summary-card-label">${escapeHtml(card.label)}</span>
      <strong class="summary-card-value">${escapeHtml(card.value)}</strong>
      <span class="summary-card-meta">${escapeHtml(card.meta)}</span>
    </article>
  `).join("");
}

function exportInventoryReportXlsx() {
  const item = getSelectedInventoryItem();
  if (!item) return updateStorageStatus("Selecciona un consumible para exportar el reporte.", "error");
  const range = getInventoryReportRange();
  const issueMovements = (item.movements || []).filter((movement) => movement.category === "issue" && isWithinInventoryReportRange(movement.at, range));
  const reportRows = aggregateInventoryIssuesByBay(issueMovements).map((entry) => ({
    Bahia: entry.bay,
    Unidades_perdidas: entry.qty,
    Eventos: entry.events,
    Motivos: entry.reasons.join(", "),
    Ultimo_registro: formatDateTime(entry.lastAt),
  }));
  const summaryRows = [{
    Articulo: item.name,
    Rango_desde: toDateDisplayValue(range.start),
    Rango_hasta: toDateDisplayValue(range.end),
    Disponible_actual: item.availableStock,
    Total_actual: item.totalStock,
    Perdidas_en_rango: issueMovements.reduce((total, movement) => total + normalizeNumber(movement.qty, 0), 0),
    Eventos_no_recuperados: issueMovements.length,
  }];
  exportWorkbook({
    filename: `reporte_consumibles_${normalizeFilenamePart(item.name)}_${toDateInputValue(new Date())}.xlsx`,
    sheets: [
      { name: "Resumen", rows: summaryRows },
      { name: "Perdidas por bahia", rows: reportRows.length ? reportRows : [{ Estado: "Sin registros en el rango" }] },
    ],
  });
}

function exportIncidentsXlsx() {
  const rows = getFilteredIncidents().map((incident) => ({
    Fecha_hora_incidente: formatDateTime(incident.occurredAt),
    Fecha_hora_registro: formatDateTime(incident.createdAt),
    Servicio: incident.area,
    Incidencia: incident.title,
    Prioridad: incident.priority,
    Estado: incident.status,
    Impacto: incident.impact,
    Responsable: incident.owner,
    Tipo_gestion: incident.requestType,
    Causa: incident.cause,
    Solucion: incident.solution,
    Observaciones: incident.notes,
  }));
  exportWorkbook({
    filename: `incidencias_${toDateInputValue(new Date())}.xlsx`,
    sheets: [
      { name: "Incidencias", rows: rows.length ? rows : [{ Estado: "Sin registros" }] },
    ],
  });
}

function exportRequestsXlsx() {
  const rows = getFilteredRequests().map((request) => ({
    Fecha_hora: formatDateTime(request.createdAt),
    Incidencia_base: request.incidentTitle,
    Destinatario: request.recipient,
    Objetivo: request.goal,
    Tono: request.tone,
    Estado: request.status,
    Cuerpo: request.body,
  }));
  exportWorkbook({
    filename: `solicitudes_${toDateInputValue(new Date())}.xlsx`,
    sheets: [
      { name: "Solicitudes", rows: rows.length ? rows : [{ Estado: "Sin registros" }] },
    ],
  });
}

function exportWorkbook({ filename, sheets }) {
  if (!window.XLSX) {
    return updateStorageStatus("La libreria de exportacion XLSX no esta disponible.", "error");
  }
  const workbook = window.XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const worksheet = window.XLSX.utils.json_to_sheet(sheet.rows);
    window.XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31) || "Hoja");
  });
  window.XLSX.writeFile(workbook, filename);
  updateStorageStatus(`Archivo ${filename} exportado correctamente.`, "saved");
}

function normalizeFilenamePart(value) {
  return String(value || "reporte")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "reporte";
}

function setDefaultTimestampsForNewRecord() {
  const now = new Date().toISOString();
  fields.recordCreatedAt.value = now;
  fields.createdAtDisplay.value = formatDateTime(now);
  fields.occurredAt.value = toDatetimeLocalValue(now);
}

function updateStorageStatus(message, state = "saved") {
  storageStatus.textContent = message;
  storageStatus.dataset.state = state;
}
window.updateStorageStatus = updateStorageStatus;

function getActorMetadata() {
  return {
    id: currentUser?.id || "",
    email: currentUser?.email || "",
  };
}

function getUserInitials(value) {
  const source = String(value || "")
    .split("@")[0]
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  if (!source) return "TI";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function safeDate(value) {
  if (!value) return null;
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = safeDate(value);
  if (!date) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toDatetimeLocalValue(value) {
  const date = safeDate(value) || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDateInputValue(value) {
  const date = safeDate(value) || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateDisplayValue(value) {
  const date = safeDate(value);
  if (!date) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalizeOccurredAt(item) {
  if (item?.occurredAt) return item.occurredAt;
  if (item?.date) return `${item.date}T12:00:00`;
  return new Date().toISOString();
}

function normalizeCreatedAt(item) {
  if (item?.createdAt) return item.createdAt;
  if (item?.date) return `${item.date}T12:05:00`;
  return new Date().toISOString();
}

function priorityClass(priority) {
  return `priority-${normalizeForClass(priority)}`;
}

function statusClass(status) {
  return `status-${normalizeForClass(status)}`;
}
function renderStatusOptions(selected) {
  return ["Abierto", "En analisis", "En seguimiento", "Resuelto", "Escalado"]
    .map((status) => `<option value="${status}" ${status === selected ? "selected" : ""}>${status}</option>`)
    .join("");
}

function renderRequestStatusOptions(selected) {
  return ["Pendiente", "Enviado", "Atendido", "Cerrado"]
    .map((status) => `<option value="${status}" ${status === selected ? "selected" : ""}>${status}</option>`)
    .join("");
}

function normalizeForClass(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCaseDocument(incident) {
  const safe = normalizeIncidents([incident])[0];
  return `
    <div class="doc-page">
      <div class="doc-header">
        <div>
          <h2>${escapeHtml(safe.title)}</h2>
          <div class="doc-meta">${escapeHtml(safe.area)} | Ocurrido: ${escapeHtml(formatDateTime(safe.occurredAt))}</div>
        </div>
        <div class="doc-meta">
          Registro: ${escapeHtml(formatDateTime(safe.createdAt))}<br>
          Prioridad: ${escapeHtml(safe.priority)}<br>
          Estado: ${escapeHtml(safe.status)}<br>
          Ultima modificacion: ${escapeHtml(formatDateTime(safe.updatedAt))} | ${escapeHtml(safe.updatedByEmail || "No disponible")}
        </div>
      </div>
      <div class="doc-section"><h3 class="doc-section-title">Descripcion tecnica</h3><div class="doc-box">${escapeHtml(safe.description)}</div></div>
      <div class="doc-section"><h3 class="doc-section-title">Causa raiz</h3><div class="doc-box">${escapeHtml(safe.cause)}</div></div>
      <div class="doc-section"><h3 class="doc-section-title">Accion ejecutada</h3><div class="doc-box">${escapeHtml(safe.solution)}</div></div>
      <div class="doc-section"><h3 class="doc-section-title">Seguimiento</h3><div class="doc-box">${escapeHtml(safe.notes || "Sin observaciones registradas.")}</div></div>
    </div>
  `;
}

function renderMailDocument(incident) {
  const safe = normalizeIncidents([incident])[0];
  const body = buildMailBody(safe, {
    recipient: fields.recipient.value.trim(),
    goal: fields.mailGoal.value,
    tone: fields.mailTone.value,
    extraContext: fields.extraContext.value.trim(),
  });
  return `
    <div class="doc-page">
      <div class="doc-header">
        <div>
          <h2>Solicitud derivada del caso</h2>
          <div class="doc-meta">${escapeHtml(safe.title)}</div>
        </div>
        <div class="doc-meta">
          Ocurrido: ${escapeHtml(formatDateTime(safe.occurredAt))}<br>
          Registro: ${escapeHtml(formatDateTime(safe.createdAt))}
        </div>
      </div>
      <div class="doc-section"><h3 class="doc-section-title">Documento redactado</h3><div class="doc-box">${escapeHtml(body)}</div></div>
    </div>
  `;
}

function renderRequestDocument(request) {
  return `
    <div class="doc-page">
      <div class="doc-header">
        <div>
          <h2>Solicitud registrada</h2>
          <div class="doc-meta">${escapeHtml(request.incidentTitle)}</div>
        </div>
        <div class="doc-meta">
          Registro: ${escapeHtml(formatDateTime(request.createdAt))}<br>
          Destinatario: ${escapeHtml(request.recipient)}<br>
          Estado: ${escapeHtml(request.status)}<br>
          Ultima modificacion: ${escapeHtml(formatDateTime(request.updatedAt))} | ${escapeHtml(request.updatedByEmail || "No disponible")}
        </div>
      </div>
      <div class="doc-section"><h3 class="doc-section-title">Cuerpo del mensaje</h3><div class="doc-box">${escapeHtml(request.body)}</div></div>
    </div>
  `;
}

function renderInventoryDocument(item) {
  const allocationsText = item.allocated?.length
    ? item.allocated.map((entry) => `${entry.bay}: ${entry.qty}`).join("\n")
    : "Sin material entregado en bahias.";
  const movementText = item.movements?.length
    ? item.movements.map((movement) => {
      const parts = [
        formatDateTime(movement.at),
        movement.action || "Registro",
        movement.bay || "-",
        movement.qty ? `Cant. ${movement.qty}` : "Cant. -",
        movement.reason || "-",
        movement.note || movement.summary || "-",
        formatInventoryStockSnapshot(movement),
      ];
      return parts.join(" | ");
    }).join("\n")
    : "Sin movimientos registrados.";
  return `
    <div class="doc-page">
      <div class="doc-header">
        <div>
          <h2>${escapeHtml(item.name)}</h2>
          <div class="doc-meta">Ubicacion actual: ${escapeHtml(item.location)}</div>
        </div>
        <div class="doc-meta">
          Disponible: ${escapeHtml(String(item.availableStock ?? item.stock))}<br>
          Total: ${escapeHtml(String(item.totalStock ?? item.stock))}<br>
          Nivel minimo: ${escapeHtml(String(item.minStock))}<br>
          Ultima actualizacion: ${escapeHtml(formatDateTime(item.updatedAt))}<br>
          Usuario: ${escapeHtml(item.updatedByEmail || "No disponible")}
        </div>
      </div>
      <div class="doc-section"><h3 class="doc-section-title">Asignado en bahias</h3><div class="doc-box">${escapeHtml(allocationsText)}</div></div>
      <div class="doc-section"><h3 class="doc-section-title">Ultimo movimiento</h3><div class="doc-box">${escapeHtml(item.lastMovement || "Sin movimientos registrados.")}</div></div>
      <div class="doc-section"><h3 class="doc-section-title">Historial de movimientos</h3><div class="doc-box">${escapeHtml(movementText)}</div></div>
    </div>
  `;
}

async function registerInventoryMovement(type, overrides = {}) {
  const item = getSelectedInventoryItem();
  if (!item) return updateStorageStatus("Selecciona un consumible para registrar movimiento.", "error");
  const previousState = snapshotSharedState();
  const actor = getActorMetadata();

  const qty = Number(overrides.qty ?? controls.inventoryMoveQty.value);
  const bay = overrides.bay ?? (type === "checkout" ? selectedCheckoutBay : selectedAllocationBay);
  if (!qty || qty < 1) return updateStorageStatus("Indica una cantidad valida.", "error");
  if (!bay) {
    return updateStorageStatus(
      type === "checkout" ? "Selecciona la bahia a la que vas a entregar." : "Selecciona la bahia desde la cual vas a recoger.",
      "error",
    );
  }

  const reason = (overrides.reason || "").trim();
  const note = (overrides.note || "").trim();
  item.totalStock = Number(item.totalStock ?? item.stock ?? 0);
  item.availableStock = Number(item.availableStock ?? item.stock ?? item.totalStock);
  item.allocated = Array.isArray(item.allocated) ? item.allocated : [];
  item.movements = Array.isArray(item.movements) ? item.movements : [];
  const existing = item.allocated.find((entry) => sameBayLabel(entry.bay, bay));

  if (type === "checkout") {
    if (item.availableStock < qty) {
      return updateStorageStatus("No hay stock disponible suficiente para esa entrega.", "error");
    }
    item.availableStock -= qty;
    if (existing) existing.qty += qty;
    else item.allocated.push({ bay, qty });
  } else if (type === "return") {
    if (!existing || existing.qty < qty) {
      return updateStorageStatus("No existe esa cantidad asignada en la bahia indicada.", "error");
    }
    existing.qty -= qty;
    item.availableStock += qty;
    if (existing.qty === 0) {
      item.allocated = item.allocated.filter((entry) => entry !== existing);
    }
  } else {
    if (!existing || existing.qty < qty) {
      return updateStorageStatus("No existe esa cantidad asignada en la bahia indicada.", "error");
    }
    if (!reason || !INVENTORY_ISSUE_REASONS.includes(reason)) {
      return updateStorageStatus("Selecciona el motivo por el cual no se recupero el articulo.", "error");
    }
    if (!note) {
      return updateStorageStatus("Describe que ocurrio para dejar trazabilidad de la perdida o rotura.", "error");
    }
    existing.qty -= qty;
    item.totalStock = Math.max(0, item.totalStock - qty);
    if (existing.qty === 0) {
      item.allocated = item.allocated.filter((entry) => entry !== existing);
    }
  }

  item.updatedAt = new Date().toISOString();
  item.updatedBy = actor.id;
  item.updatedByEmail = actor.email;
  const movement = createInventoryMovement({
    at: item.updatedAt,
    action: type === "checkout" ? "Entrega" : type === "return" ? "Recogida" : "No recuperado",
    category: type === "checkout" ? "checkout" : type === "return" ? "return" : "issue",
    bay,
    qty,
    reason: type === "issue" ? reason : type === "checkout" ? "Asignacion a bahia" : "Retorno a stock",
    note: type === "issue" ? note : "",
    availableAfter: item.availableStock,
    totalAfter: item.totalStock,
    actorId: actor.id,
    actorEmail: actor.email,
  });
  item.lastMovement = movement.summary;
  item.movements.unshift(movement);
  inventoryHistoryPage = 1;
  if (type !== "checkout") {
    const remaining = item.allocated.find((entry) => sameBayLabel(entry.bay, bay));
    if (remaining) {
      inventoryCollectionState.qty = Math.min(inventoryCollectionState.qty, remaining.qty);
    } else {
      clearInventoryCollectionSelection();
    }
  }
  renderAll();
  await persistSharedState({
    action: type === "issue" ? "register_inventory_issue" : type === "checkout" ? "register_inventory_checkout" : "register_inventory_return",
    entityId: item.id,
    entityType: "inventory_item",
    module: "inventory",
    summary: `${type === "issue" ? "No recuperado" : type === "checkout" ? "Entrega" : "Recogida"} en ${item.name}`,
  }, type === "issue" ? "No recuperado registrado correctamente." : "Movimiento de consumible registrado.", previousState);
}

function getCheckoutBayOptions(item) {
  const extras = new Set();
  inventoryItems.forEach((entry) => {
    if (typeof entry?.location === "string" && entry.location.trim().toLowerCase().startsWith("bahia")) {
      extras.add(entry.location.trim());
    }
    (entry?.allocated || []).forEach((allocation) => {
      if (allocation?.bay) extras.add(allocation.bay.trim());
    });
  });
  if (typeof item?.location === "string" && item.location.trim().toLowerCase().startsWith("bahia")) {
    extras.add(item.location.trim());
  }
  (item?.allocated || []).forEach((entry) => {
    if (entry?.bay) extras.add(entry.bay.trim());
  });

  return INVENTORY_BAY_OPTIONS.concat(
    Array.from(extras)
      .filter((bay) => !INVENTORY_BAY_OPTIONS.some((option) => sameBayLabel(option, bay)))
      .sort((left, right) => left.localeCompare(right, "es", { numeric: true, sensitivity: "base" })),
  );
}

function getReturnBayOptions(item) {
  return (item?.allocated || [])
    .filter((entry) => entry?.bay && Number(entry.qty) > 0)
    .sort((left, right) => left.bay.localeCompare(right.bay, "es", { numeric: true, sensitivity: "base" }));
}

function sameBayLabel(left, right) {
  return (left || "").trim().toLowerCase() === (right || "").trim().toLowerCase();
}

function normalizeInventoryAllocations(allocated) {
  if (!Array.isArray(allocated)) return [];
  return allocated
    .map((entry) => ({
      bay: entry?.bay ? String(entry.bay).trim() : "",
      qty: normalizeNumber(entry?.qty, 0),
    }))
    .filter((entry) => entry.bay && entry.qty > 0)
    .sort((left, right) => left.bay.localeCompare(right.bay, "es", { numeric: true, sensitivity: "base" }));
}

function normalizeInventoryMovements(movements, lastMovement, fallbackAt) {
  const source = Array.isArray(movements) ? movements : [];
  const normalized = source
    .map((movement, index) => normalizeInventoryMovement(movement, fallbackAt, index))
    .filter(Boolean)
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());

  if (!normalized.length && lastMovement) {
    normalized.push(createInventoryMovement({
      at: fallbackAt || new Date().toISOString(),
      action: "Registro",
      category: "manual",
      qty: 0,
      note: lastMovement,
      availableAfter: null,
      totalAfter: null,
    }));
  }

  return normalized;
}

function normalizeInventoryMovement(movement, fallbackAt, index) {
  if (!movement) return null;
  if (typeof movement === "string") {
    return createInventoryMovement({
      at: fallbackAt || new Date().toISOString(),
      action: "Registro",
      category: "manual",
      qty: 0,
      note: movement,
      availableAfter: null,
      totalAfter: null,
      id: `movement-${index}`,
    });
  }

  const parsedLegacy = !movement?.action && movement?.note ? parseLegacyInventoryMovement(movement.note) : {};
  return createInventoryMovement({
    id: movement?.id || `movement-${index}`,
    at: movement?.at || fallbackAt || new Date().toISOString(),
    action: movement?.action || parsedLegacy.action || "Registro",
    category: movement?.category || parsedLegacy.category || "manual",
    bay: movement?.bay || parsedLegacy.bay || "",
    qty: normalizeNumber(movement?.qty ?? parsedLegacy.qty, 0),
    reason: movement?.reason || parsedLegacy.reason || "",
    note: movement?.action ? movement.note || "" : parsedLegacy.note || movement?.note || "",
    availableAfter: Number.isFinite(Number(movement?.availableAfter)) ? Number(movement.availableAfter) : null,
    totalAfter: Number.isFinite(Number(movement?.totalAfter)) ? Number(movement.totalAfter) : null,
    actorId: movement?.actorId || "",
    actorEmail: movement?.actorEmail || "",
  });
}

function parseLegacyInventoryMovement(note) {
  const text = String(note || "").trim();
  let match = text.match(/^Entrega de (\d+) a (.+)$/i);
  if (match) {
    return {
      action: "Entrega",
      category: "checkout",
      qty: Number(match[1]),
      bay: match[2],
      reason: "Asignacion a bahia",
      note: "",
    };
  }

  match = text.match(/^Recogida de (\d+) desde (.+)$/i);
  if (match) {
    return {
      action: "Recogida",
      category: "return",
      qty: Number(match[1]),
      bay: match[2],
      reason: "Retorno a stock",
      note: "",
    };
  }

  return {
    action: "Registro",
    category: "manual",
    note: text,
  };
}

function createInventoryMovement({
  id,
  at,
  action,
  category,
  bay = "",
  qty = 0,
  reason = "",
  note = "",
  availableAfter = null,
  totalAfter = null,
  actorId = "",
  actorEmail = "",
}) {
  const movement = {
    id: id || window.crypto?.randomUUID?.() || `movement-${Date.now()}`,
    at: at || new Date().toISOString(),
    action: action || "Registro",
    category: category || "manual",
    bay: bay || "",
    qty: normalizeNumber(qty, 0),
    reason: reason || "",
    note: note || "",
    availableAfter: availableAfter === null ? null : normalizeNumber(availableAfter, 0),
    totalAfter: totalAfter === null ? null : normalizeNumber(totalAfter, 0),
    actorId: actorId || "",
    actorEmail: actorEmail || "",
  };
  movement.summary = buildInventoryMovementSummary(movement);
  return movement;
}

function buildInventoryMovementSummary(movement) {
  if (movement.category === "checkout") {
    return `Entrega de ${movement.qty} a ${movement.bay}`;
  }
  if (movement.category === "return") {
    return `Recogida de ${movement.qty} desde ${movement.bay}`;
  }
  if (movement.category === "issue") {
    const detail = movement.note ? ` Detalle: ${movement.note}` : "";
    return `No recuperado: ${movement.qty} desde ${movement.bay}. Motivo: ${movement.reason}.${detail}`.trim();
  }
  return movement.note || movement.reason || movement.action;
}

function formatInventoryStockSnapshot(movement) {
  const available = movement?.availableAfter;
  const total = movement?.totalAfter;
  if (!Number.isFinite(available) && !Number.isFinite(total)) return "-";
  if (!Number.isFinite(available)) return `Total ${total}`;
  if (!Number.isFinite(total)) return `Disp. ${available}`;
  return `Disp. ${available} / Total ${total}`;
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getAllocatedQty(item) {
  return (item?.allocated || []).reduce((total, entry) => total + normalizeNumber(entry.qty, 0), 0);
}

function handleDownloadPdf() {
  if (currentView === "requests") {
    const selected = getSelectedRequest();
    if (!selected) return updateStorageStatus("Selecciona una solicitud para descargar el PDF.", "error");
    return printHtmlDocument("Solicitud", renderRequestDocument(selected));
  }
  if (currentView === "inventory") {
    const selected = getSelectedInventoryItem();
    if (!selected) return updateStorageStatus("Selecciona un consumible para descargar el PDF.", "error");
    return printHtmlDocument("Consumible", renderInventoryDocument(selected));
  }
  const selected = getSelectedIncident();
  if (!selected) return updateStorageStatus("Selecciona un caso para descargar el PDF.", "error");
  return printHtmlDocument(currentDetailMode === "mail" ? "Solicitud" : "Detalle de incidencia", currentDetailMode === "mail" ? renderMailDocument(selected) : renderCaseDocument(selected));
}

function printHtmlDocument(title, content) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return updateStorageStatus("El navegador bloqueo la ventana para generar el PDF.", "error");
  printWindow.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#1f2937}.doc-page{max-width:900px;margin:0 auto;line-height:1.7}.doc-header{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #d9dfeb;padding-bottom:16px;margin-bottom:18px}.doc-box{border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;white-space:pre-wrap}.doc-section{margin-bottom:18px}.doc-meta{color:#6b7280;font-size:14px}h2,h3{margin:0 0 8px}</style></head><body>${content}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}
function buildMailBody(incident, options) {
  const safeIncident = normalizeIncidents([incident])[0];
  const recipient = options.recipient || "equipo";
  const audience = detectAudience(recipient);
  const opening = `${audience.isPlural ? "Estimados" : "Estimado"} ${recipient},`;
  const requestBlock = buildRequestBlock(options.goal, safeIncident, options.extraContext);
  const variants = {
    corporativo: `${opening}\n\nPor medio de la presente, se reporta el siguiente incidente ocurrido:\n\n${normalizeSentence(safeIncident.description)}\n\nDe la revision realizada, se identifico como causa asociada ${lowerFirst(safeIncident.cause)}\n\nComo accion ejecutada o plan de remediacion, se tiene definido lo siguiente:\n${normalizeSentence(safeIncident.solution)}\n\nEl caso presenta un nivel de atencion ${safeIncident.priority.toLowerCase()} y un impacto operativo correspondiente a ${safeIncident.impact.toLowerCase()}.\n\nSolicitud:\n${requestBlock}\n\nQuedo atento a cualquier informacion adicional.\n\nAtentamente,\n\n[Tu nombre]\nSoporte Tecnico y Administracion de Sistemas.`,
    ejecutivo: `${opening}\n\nSolicito apoyo para avanzar con ${resolveRequestPhrase(options.goal, safeIncident.requestType)} del caso "${safeIncident.title}" en ${safeIncident.area}.\n\nResumen del incidente: ${normalizeSentence(safeIncident.description)}\n\nDiagnostico tecnico: ${normalizeSentence(safeIncident.cause)}\n\nAccion ejecutada o definida: ${normalizeSentence(safeIncident.solution)}\n\nQuedo pendiente de su validacion para continuar.\n\nSaludos,`,
    cercano: `Hola ${recipient},\n\n${audience.isPlural ? "Les escribo" : "Le escribo"} para solicitar apoyo con ${resolveRequestPhrase(options.goal, safeIncident.requestType)} del caso "${safeIncident.title}" asociado a ${safeIncident.area}.\n\nEn este momento tenemos la siguiente situacion: ${normalizeSentence(safeIncident.description)}\n\nQuedo atento para coordinar el siguiente paso.\n\nSaludos,`,
  };
  return cleanParagraphSpacing(variants[options.tone] || variants.corporativo);
}

function detectAudience(recipient) {
  const value = (recipient || "").trim().toLowerCase();
  if (!value) return { isPlural: true };
  const hints = ["equipo", "area", "area", "compras", "gerencia", "rrhh", "recursos humanos", "sistemas", "operaciones"];
  return { isPlural: value.includes(",") || value.includes(" y ") || hints.some((hint) => value.includes(hint)) };
}

function buildRequestBlock(goal, incident, extraContext) {
  const baseRequest = resolveRequestPhrase(goal, incident.requestType);
  const trimmed = (extraContext || "").trim();
  if (!trimmed) return `Se requiere gestionar ${baseRequest}.\nEsta solicitud se realiza con el fin de asegurar la continuidad y estabilidad de la operacion.`;
  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return `Se requiere gestionar ${baseRequest}, considerando lo siguiente:\n${lines.join("\n")}\nEsta solicitud se realiza con el fin de asegurar la continuidad y estabilidad de la operacion.`;
  return `Se requiere gestionar ${baseRequest}.\n${normalizeSentence(trimmed)}\nEsta solicitud se realiza con el fin de asegurar la continuidad y estabilidad de la operacion.`;
}

function resolveRequestPhrase(goal, requestType) {
  const byGoal = {
    gestion: "la gestion correspondiente",
    aprobacion: "la aprobacion correspondiente",
    compra: "la compra o reposicion necesaria",
    apoyo: "el apoyo de la parte involucrada",
    seguimiento: "el seguimiento del caso",
  };
  if (requestType && requestType !== "Ninguna" && goal === "gestion") {
    const mapped = {
      "Aprobacion interna": "la aprobacion interna requerida",
      "Compra o reposicion": "la compra o reposicion requerida",
      "Habilitacion de acceso": "la habilitacion del acceso solicitado",
      "Intervencion tecnica programada": "la intervencion tecnica programada",
      "Atencion de proveedor": "la coordinacion con el proveedor correspondiente",
    };
    return mapped[requestType] || byGoal[goal];
  }
  return byGoal[goal] || byGoal.gestion;
}

function normalizeSentence(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const firstUpper = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(firstUpper) ? firstUpper : `${firstUpper}.`;
}

function lowerFirst(text) {
  const normalized = normalizeSentence(text);
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
}

function cleanParagraphSpacing(text) {
  return text.split("\n").map((line) => line.trim()).filter((line, index, array) => !(line === "" && array[index - 1] === "")).join("\n");
}

// Funciones para menú móvil
function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuToggle = document.getElementById('menu-toggle');
  
  const isOpen = sidebar.classList.contains('open');
  
  if (isOpen) {
    closeMobileMenu();
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    menuToggle.classList.add('active');
  }
}

function closeMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuToggle = document.getElementById('menu-toggle');
  
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
  menuToggle.classList.remove('active');
}

initializeSession();
