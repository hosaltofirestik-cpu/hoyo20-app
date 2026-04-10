import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";
import {
  assignInvoiceToEntries,
  createInvoiceEntry,
  createInvoiceEntriesBatch,
  createInvoicePhotoUrl,
  deleteInvoiceEntry,
  downloadInvoicePhoto,
  fetchInvoiceSettings,
  formatCurrency,
  formatSupabaseError,
  listInvoiceEntries,
  listInvoiceEntriesByRange,
  normalizeCurrencyValue,
  saveInvoiceSettings,
  updateInvoiceEntry,
} from "../../supabase-service.js";

const OCR_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const STATUS_OPTIONS = ["pendiente", "listo"];

let tesseractPromise = null;

export function createInvoiceModule({ host, onStatusChange }) {
  if (!host) {
    throw new Error("El modulo de facturas requiere un host.");
  }

  const state = {
    mounted: false,
    visible: false,
    loading: false,
    rows: [],
    totalRows: 0,
    page: 1,
    pageSize: 10,
    searchTerm: "",
    statusFilter: "",
    monthFilter: new Date().toISOString().slice(0, 7),
    selectedRowId: "",
    selectedIds: new Set(),
    settings: null,
    activeModal: "",
    ocrStatus: "Carga una imagen para leer el numero de factura.",
    ocrConfidence: 0,
    previewUrl: "",
    photoUrl: "",
    importDraft: createEmptyImportDraft(),
  };

  const refs = {};

  function mount() {
    if (state.mounted) return;
    host.innerHTML = buildMarkup();
    cacheRefs();
    bindEvents();
    state.mounted = true;
  }

  async function bootstrap() {
    if (!state.mounted) mount();
    state.loading = true;
    renderTableState();
    try {
      state.settings = await fetchInvoiceSettings();
      applySettingsToInputs();
      await refresh();
      updateStatus("Modulo de facturas listo en Supabase.", "saved");
    } catch (error) {
      updateStatus(formatSupabaseError(error, "No fue posible cargar el modulo de facturas."), "error");
      refs.tableBody.innerHTML = '<tr><td colspan="9" class="empty-cell">No fue posible cargar las facturas desde Supabase.</td></tr>';
      renderDetail();
    } finally {
      state.loading = false;
      renderSummary();
    }
  }

  function cacheRefs() {
    refs.resultsMeta = host.querySelector("[data-role='results-meta']");
    refs.statusBadge = host.querySelector("[data-role='status-badge']");
    refs.tableBody = host.querySelector("[data-role='table-body']");
    refs.paginationInfo = host.querySelector("[data-role='pagination-info']");
    refs.pageIndicator = host.querySelector("[data-role='page-indicator']");
    refs.prevPage = host.querySelector("[data-role='prev-page']");
    refs.nextPage = host.querySelector("[data-role='next-page']");
    refs.pageSize = host.querySelector("[data-role='page-size']");
    refs.statusFilter = host.querySelector("[data-role='status-filter']");
    refs.monthFilter = host.querySelector("[data-role='month-filter']");
    refs.openCreate = host.querySelector("[data-role='open-create']");
    refs.openImport = host.querySelector("[data-role='open-import']");
    refs.openBatch = host.querySelector("[data-role='open-batch']");
    refs.exportMonthly = host.querySelector("[data-role='export-monthly']");
    refs.openSettings = host.querySelector("[data-role='open-settings']");
    refs.tableToolbar = host.querySelector(".table-toolbar");
    refs.selectionSummary = host.querySelector("[data-role='selection-summary']");
    refs.detail = host.querySelector("[data-role='detail']");
    refs.modal = host.querySelector("[data-role='modal']");
    refs.modalContent = host.querySelector("[data-role='modal-content']");
    refs.modalTitle = host.querySelector("[data-role='modal-title']");
    refs.modalClose = host.querySelector("[data-role='modal-close']");
  }

  function bindEvents() {
    refs.pageSize.addEventListener("change", async () => {
      state.pageSize = Number(refs.pageSize.value) || 10;
      state.page = 1;
      await refresh();
    });
    refs.prevPage.addEventListener("click", async () => {
      if (state.page <= 1) return;
      state.page -= 1;
      await refresh();
    });
    refs.nextPage.addEventListener("click", async () => {
      const totalPages = Math.max(1, Math.ceil(state.totalRows / state.pageSize));
      if (state.page >= totalPages) return;
      state.page += 1;
      await refresh();
    });
    refs.statusFilter.addEventListener("change", async () => {
      state.statusFilter = refs.statusFilter.value;
      state.page = 1;
      await refresh();
    });
    refs.monthFilter.addEventListener("change", async () => {
      state.monthFilter = refs.monthFilter.value || new Date().toISOString().slice(0, 7);
      state.page = 1;
      await refresh();
    });
    refs.openCreate.addEventListener("click", () => openEntryModal());
    refs.openImport.addEventListener("click", () => openImportModal());
    refs.openBatch.addEventListener("click", () => openBatchModal());
    refs.exportMonthly.addEventListener("click", exportMonthlyZip);
    refs.openSettings.addEventListener("click", openSettingsModal);
    if (refs.tableToolbar) {
      refs.tableToolbar.addEventListener("click", handleToolbarClick);
    }
    refs.modalClose.addEventListener("click", closeModal);
    refs.modal.addEventListener("click", (event) => {
      if (event.target === refs.modal) closeModal();
    });
    refs.modalContent.addEventListener("submit", handleModalSubmit);
    refs.modalContent.addEventListener("click", handleModalClick);
    refs.modalContent.addEventListener("change", handleModalChange);
    refs.modalContent.addEventListener("input", handleModalInput);
    refs.tableBody.addEventListener("click", handleTableClick);
    refs.tableBody.addEventListener("change", handleTableChange);
  }

  function setVisible(visible) {
    state.visible = Boolean(visible);
    host.classList.toggle("hidden", !state.visible);
    if (state.visible) {
      bootstrap();
    }
  }

  function setSearchTerm(term) {
    state.searchTerm = String(term || "").trim().toLowerCase();
    state.page = 1;
    if (state.visible) refresh();
  }

  function getViewMeta() {
    return [
      "Facturacion compartida",
      "Registro pendiente, cierre de factura con OCR, foto en Storage y exportacion mensual ZIP + XLSX.",
    ];
  }

  async function refresh() {
    if (!state.mounted) return;
    state.loading = true;
    renderTableState();
    try {
      const monthRange = getMonthRange(state.monthFilter);
      const { rows, count } = await listInvoiceEntries({
        searchTerm: state.searchTerm,
        status: state.statusFilter,
        dateStart: monthRange.start,
        dateEnd: monthRange.end,
        page: state.page,
        pageSize: state.pageSize,
      });
      state.rows = rows;
      state.totalRows = count;
      state.selectedIds = new Set(Array.from(state.selectedIds).filter((id) => state.rows.some((row) => row.id === id)));
      if (state.rows.length && !state.rows.some((row) => row.id === state.selectedRowId)) {
        state.selectedRowId = state.rows[0].id;
      }
      if (!state.rows.length) {
        state.selectedRowId = "";
      }
      renderTable();
      await renderDetail();
    } catch (error) {
      refs.tableBody.innerHTML = `<tr><td colspan="9" class="empty-cell">${escapeHtml(formatSupabaseError(error, "No fue posible consultar las facturas."))}</td></tr>`;
      state.rows = [];
      state.totalRows = 0;
      renderSummary();
      renderDetail();
    } finally {
      state.loading = false;
      renderSummary();
    }
  }

  async function renderDetail() {
    const row = getSelectedRow();
    if (!row) {
      refs.detail.innerHTML = '<div class="invoice-card-empty">Selecciona un registro para ver su detalle.</div>';
      releasePhotoUrl();
      return;
    }

    let photoMarkup = '<div class="invoice-card-empty">No hay foto vinculada para este registro.</div>';
    if (row.photoPath) {
      try {
        releasePhotoUrl();
        state.photoUrl = await createInvoicePhotoUrl(row.photoPath);
        photoMarkup = `
          <div class="invoice-photo-wrap">
            <img src="${escapeHtml(state.photoUrl)}" alt="Factura ${escapeHtml(row.invoiceNumber || row.id)}">
          </div>
          <div class="invoice-detail-note">Archivo: ${escapeHtml(row.photoFileName || row.photoPath)}</div>
        `;
      } catch (error) {
        photoMarkup = `<div class="invoice-card-empty">${escapeHtml(formatSupabaseError(error, "No fue posible abrir la foto."))}</div>`;
      }
    }

    refs.detail.innerHTML = `
      <article class="document-view invoice-detail-card">
        <div class="doc-header">
          <div>
            <h2>${escapeHtml(row.personName || "Registro sin nombre")}</h2>
            <div class="doc-meta">Fecha: ${escapeHtml(formatDate(row.serviceDate))} | Factura: ${escapeHtml(row.invoiceNumber || "Pendiente")}</div>
          </div>
          <div class="doc-meta">
            Estado: ${escapeHtml(capitalize(row.status))}<br>
            Actualizado: ${escapeHtml(formatDateTime(row.updatedAt))}<br>
            Usuario: ${escapeHtml(row.updatedByEmail || "No disponible")}
          </div>
        </div>
        <div class="doc-section">
          <h3 class="doc-section-title">Resumen</h3>
          <div class="doc-box">
            Fecha: ${escapeHtml(formatDate(row.serviceDate))}<br>
            No. Factura: ${escapeHtml(row.invoiceNumber || "Pendiente")}<br>
            Nombre: ${escapeHtml(row.personName)}<br>
            Horas: ${escapeHtml(formatCurrency(row.hoursAmount))}<br>
            Estado: ${escapeHtml(capitalize(row.status))}<br>
            comentario: ${escapeHtml(row.comment || "-")}
          </div>
        </div>
        <div class="doc-section">
          <h3 class="doc-section-title">Foto de factura</h3>
          ${photoMarkup}
        </div>
      </article>
    `;
  }

  function renderSummary() {
    refs.resultsMeta.textContent = state.totalRows === 1 ? "1 registro" : `${state.totalRows} registros`;
    refs.statusBadge.textContent = state.loading ? "Sincronizando..." : "Supabase sincronizado";
    refs.statusBadge.dataset.state = state.loading ? "pending" : "success";
    refs.pageIndicator.textContent = `Pagina ${state.page} de ${Math.max(1, Math.ceil(state.totalRows / state.pageSize))}`;
    const start = state.totalRows ? ((state.page - 1) * state.pageSize) + 1 : 0;
    const end = Math.min(state.page * state.pageSize, state.totalRows);
    refs.paginationInfo.textContent = `Mostrando ${start}-${end} de ${state.totalRows}`;
    if (refs.selectionSummary) {
      refs.selectionSummary.textContent = `${state.selectedIds.size} seleccionado(s) · ${formatCurrency(getSelectedInvoiceAmount())}`;
    }
    refs.openBatch.disabled = !Array.from(state.selectedIds).some((id) => {
      const row = state.rows.find((entry) => entry.id === id);
      return row?.status === "pendiente";
    });
  }

  function renderTableState() {
    refs.tableBody.innerHTML = '<tr><td colspan="9" class="empty-cell">Cargando facturas desde Supabase...</td></tr>';
    renderSummary();
  }

  function getSelectedInvoiceAmount() {
    return Array.from(state.selectedIds).reduce((total, id) => {
      const row = state.rows.find((item) => item.id === id);
      const amount = Number(normalizeCurrencyValue(row?.hoursAmount || ""));
      return total + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  function setInvoiceSelectionByFilter(filterFn) {
    state.selectedIds = new Set(state.rows.filter(filterFn).map((row) => row.id));
    renderTable();
  }

  function clearInvoiceSelection() {
    state.selectedIds = new Set();
    renderTable();
  }

  function handleToolbarClick(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "select-all-rows") {
      setInvoiceSelectionByFilter(() => true);
      return;
    }
    if (action === "select-pending-rows") {
      setInvoiceSelectionByFilter((row) => row.status === "pendiente");
      return;
    }
    if (action === "select-ready-rows") {
      setInvoiceSelectionByFilter((row) => row.status === "listo");
      return;
    }
    if (action === "clear-selection") {
      clearInvoiceSelection();
      return;
    }
  }

  function renderTable() {
    if (!state.rows.length) {
      refs.tableBody.innerHTML = '<tr><td colspan="9" class="empty-cell">No hay facturas para los filtros seleccionados.</td></tr>';
      renderSummary();
      return;
    }

    refs.tableBody.innerHTML = state.rows.map((row) => `
      <tr data-row-id="${escapeHtml(row.id)}" class="${row.id === state.selectedRowId ? "selected" : ""}">
        <td><input type="checkbox" data-action="select-row" ${state.selectedIds.has(row.id) ? "checked" : ""}></td>
        <td>${escapeHtml(formatDate(row.serviceDate))}</td>
        <td>${escapeHtml(row.invoiceNumber || "Pendiente")}</td>
        <td>${escapeHtml(row.personName)}</td>
        <td>${escapeHtml(formatCurrency(row.hoursAmount))}</td>
        <td>${renderStatusBadge(row.status)}</td>
        <td>${escapeHtml(row.comment || "-")}</td>
        <td>${escapeHtml(row.updatedByEmail || "-")}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="link-button" data-action="edit">Editar</button>
            <button type="button" class="link-button" data-action="ready">${row.status === "pendiente" ? "Facturar" : "Reasignar"}</button>
            <button type="button" class="link-button danger-link" data-action="delete">Borrar</button>
          </div>
        </td>
      </tr>
    `).join("");

    renderSummary();
  }

  function openEntryModal(row = null) {
    state.activeModal = row ? "edit-entry" : "create-entry";
    refs.modalTitle.textContent = row ? "Editar registro de factura" : "Nuevo registro pendiente";
    refs.modalContent.innerHTML = `
      <form class="invoice-modal-grid" data-form="entry">
        <input type="hidden" name="entry-id" value="${escapeHtml(row?.id || "")}">
        <input type="hidden" name="photo-path" value="${escapeHtml(row?.photoPath || "")}">
        <input type="hidden" name="photo-file-name" value="${escapeHtml(row?.photoFileName || "")}">
        <label>
          Fecha
          <input type="date" name="service-date" value="${escapeHtml(row?.serviceDate || toDateInputValue(new Date()))}" required>
        </label>
        <label>
          No. factura
          <input type="text" name="invoice-number" value="${escapeHtml(row?.invoiceNumber || "")}" placeholder="Solo cuando ya este lista">
        </label>
        <label>
          Nombre
          <input type="text" name="person-name" value="${escapeHtml(row?.personName || "")}" placeholder="Ej. Gabriel Garcia Socias" required>
        </label>
        <label>
          Horas
          <input type="text" name="hours-amount" value="${escapeHtml(row ? String(row.hoursAmount.toFixed(2)) : "")}" placeholder="3300.00" required>
        </label>
        <label>
          Estado
          <select name="status">
            ${STATUS_OPTIONS.map((status) => `<option value="${status}" ${status === (row?.status || "pendiente") ? "selected" : ""}>${capitalize(status)}</option>`).join("")}
          </select>
        </label>
        <label class="full">
          comentario
          <textarea name="comment" rows="4" placeholder="Notas internas o referencia de facturacion">${escapeHtml(row?.comment || "")}</textarea>
        </label>
        <div class="drawer-actions full">
          <button type="submit" class="primary">${row ? "Guardar cambios" : "Guardar pendiente"}</button>
          <button type="button" class="secondary" data-action="close-modal">Cancelar</button>
        </div>
      </form>
    `;
    refs.modal.classList.add("open");
  }

  function openImportModal() {
    state.activeModal = "import-xlsx";
    state.importDraft = createEmptyImportDraft();
    refs.modalTitle.textContent = "Importar pendientes desde Excel";
    renderImportModal();
    refs.modal.classList.add("open");
  }

  function renderImportModal() {
    const draft = state.importDraft || createEmptyImportDraft();
    const selectedRows = draft.rows.filter((row) => row.selected);
    const skippedRows = draft.rows.filter((row) => !row.selected);
    const fileStatus = draft.fileName 
      ? `✓ ${draft.fileName}` 
      : "Aun no has cargado un archivo.";
    
    refs.modalContent.innerHTML = `
      <form class="invoice-modal-grid" data-form="import-xlsx">
        <div class="invoice-batch-summary full">
          <strong>Carga el Excel de origen</strong>
          <span>Se tomaran solo <strong>Fecha de creación</strong>, <strong>Referencia</strong>, <strong>Nombre completo Cliente</strong> y <strong>Total</strong>. La seleccion inicial depende del campo <strong>Éxito</strong>: 1 se marca, 0 queda fuera. El formato de fecha esperado es DD/MM/YYYY HH:MM y el monto puede incluir RD$.</span>
        </div>
        <label class="full">
          Archivo Excel
          <input type="file" name="import-file" accept=".xlsx,.xls,.csv">
        </label>
        <div class="invoice-import-summary full">
          <div>
            <strong>Archivo:</strong>
            <span>${escapeHtml(fileStatus)}</span>
          </div>
          <div>
            <strong>Hoja:</strong>
            <span>${escapeHtml(draft.sheetName || "-")}</span>
          </div>
          <div>
            <strong>Listos para registrar:</strong>
            <span>${selectedRows.length}</span>
          </div>
          <div>
            <strong>Total seleccionado:</strong>
            <span>${escapeHtml(formatCurrency(getImportSelectedAmount(selectedRows)))}</span>
          </div>
          <div>
            <strong>No seleccionados:</strong>
            <span>${skippedRows.length}</span>
          </div>
        </div>
        ${draft.columnSummary.length ? `
          <div class="invoice-detail-note full">
            Columnas detectadas: ${escapeHtml(draft.columnSummary.join(" | "))}
          </div>
        ` : ""}
        <div class="invoice-inline-actions full">
          <button type="button" class="secondary" data-action="download-import-template">Descargar ejemplo</button>
          <button type="button" class="secondary" data-action="select-ready-import">Seleccionar listos</button>
          <button type="button" class="secondary" data-action="select-pending-import">Seleccionar pendientes</button>
          <button type="button" class="secondary" data-action="select-all-import">Seleccionar todos</button>
          <button type="button" class="secondary" data-action="clear-import-selection">Quitar todos</button>
        </div>
        <div class="invoice-import-section full">
          <div class="invoice-import-head">
            <div>
              <h3>Lista de espera</h3>
              <p class="invoice-detail-note">Estos registros se crearan en facturas como pendientes cuando confirmes.</p>
            </div>
            <span class="invoice-auto-badge" data-state="${selectedRows.length ? "success" : "pending"}">${selectedRows.length} seleccionado(s) · Total: ${escapeHtml(formatCurrency(getImportSelectedAmount(selectedRows)))}</span>
          </div>
          ${renderImportTable(selectedRows, "No hay registros seleccionados para registrar.")}
        </div>
        <div class="invoice-import-section full">
          <div class="invoice-import-head">
            <div>
              <h3>No seleccionados</h3>
              <p class="invoice-detail-note">Aqui quedan los que vienen con Exito = 0 o los que quitaste manualmente.</p>
            </div>
            <span class="invoice-auto-badge" data-state="${skippedRows.length ? "pending" : "success"}">${skippedRows.length} fuera de espera</span>
          </div>
          ${renderImportTable(skippedRows, "No hay registros fuera de la lista de espera.")}
        </div>
        <div class="drawer-actions full">
          <button type="submit" class="primary" ${selectedRows.length ? "" : "disabled"}>Registrar seleccionados</button>
          <button type="button" class="secondary" data-action="close-modal">Cancelar</button>
        </div>
      </form>
    `;
  }

  function openBatchModal(row = null) {
    const selectedPending = row
      ? [row.id]
      : Array.from(state.selectedIds).filter((id) => {
        const entry = state.rows.find((item) => item.id === id);
        return entry?.status === "pendiente";
      });

    if (!selectedPending.length) {
      updateStatus("Selecciona registros pendientes para asignar la factura.", "error");
      return;
    }

    const selectedRows = selectedPending
      .map((id) => state.rows.find((rowItem) => rowItem.id === id))
      .filter(Boolean);

    state.activeModal = "batch-ready";
    state.ocrStatus = "Carga una imagen para leer el numero de factura.";
    state.ocrConfidence = 0;
    releasePreviewUrl();
    refs.modalTitle.textContent = selectedRows.length > 1
      ? `Aplicar una factura a ${selectedRows.length} registros`
      : "Completar factura";
    refs.modalContent.innerHTML = `
      <form class="invoice-modal-grid" data-form="batch">
        <input type="hidden" name="entry-ids" value="${escapeHtml(selectedPending.join(","))}">
        <div class="invoice-batch-summary full">
          <strong>Registros seleccionados:</strong>
          <span>${escapeHtml(selectedRows.map((entry) => entry.personName).join(", "))}</span>
        </div>
        <label>
          Numero de factura
          <input type="text" name="invoice-number" placeholder="Ej. 41620" required>
        </label>
        <label>
          Carpeta en Storage
          <input type="text" name="storage-folder" value="${escapeHtml(state.settings?.storageFolder || "facturas")}" required>
        </label>
        <label class="full">
          Imagen de factura
          <input type="file" name="invoice-file" accept="image/*">
        </label>
        <div class="invoice-preview-pane full" data-role="ocr-preview">
          <div class="invoice-preview-stage">
            <img data-role="preview-image" alt="Vista previa de la factura" hidden>
            <div class="invoice-card-empty" data-role="preview-empty">Aun no has cargado una imagen.</div>
          </div>
          <div class="invoice-preview-meta">
            <div class="invoice-auto-badge" data-role="ocr-status-badge" data-state="pending">${escapeHtml(state.ocrStatus)}</div>
            <div class="invoice-detail-note" data-role="ocr-confidence">Confianza OCR: 0%</div>
            <div class="invoice-inline-actions">
              <button type="button" class="secondary" data-action="run-ocr">Leer numero</button>
            </div>
            <p class="invoice-detail-note">El OCR analiza la imagen completa y prioriza la linea donde aparece "Trans:" para nombrar la factura.</p>
          </div>
        </div>
        <label class="full">
          comentario
          <textarea name="comment" rows="3" placeholder="Comentario comun para los registros seleccionados"></textarea>
        </label>
        <div class="drawer-actions full">
          <button type="submit" class="primary">Guardar factura</button>
          <button type="button" class="secondary" data-action="close-modal">Cancelar</button>
        </div>
      </form>
    `;
    refs.modal.classList.add("open");
  }

  function openSettingsModal() {
    state.activeModal = "settings";
    refs.modalTitle.textContent = "Configuracion de facturas";
    refs.modalContent.innerHTML = `
      <form class="invoice-modal-grid" data-form="settings">
        <label>
          Carpeta base en Storage
          <input type="text" name="storage-folder" value="${escapeHtml(state.settings?.storageFolder || "facturas")}" required>
        </label>
        <div class="invoice-detail-note full">El OCR ahora usa la imagen completa y busca el numero en la linea "Trans:". Esta configuracion queda compartida para los usuarios que entren al modulo.</div>
        <div class="drawer-actions full">
          <button type="submit" class="primary">Guardar configuracion</button>
          <button type="button" class="secondary" data-action="close-modal">Cancelar</button>
        </div>
      </form>
    `;
    refs.modal.classList.add("open");
  }

  function closeModal() {
    state.activeModal = "";
    state.importDraft = createEmptyImportDraft();
    releasePreviewUrl();
    refs.modal.classList.remove("open");
    refs.modalContent.innerHTML = "";
  }

  async function handleModalSubmit(event) {
    event.preventDefault();
    const form = event.target.closest("form");
    if (!form) return;

    if (form.dataset.form === "entry") {
      await handleEntrySubmit(form);
      return;
    }
    if (form.dataset.form === "batch") {
      await handleBatchSubmit(form);
      return;
    }
    if (form.dataset.form === "import-xlsx") {
      await handleImportSubmit();
      return;
    }
    if (form.dataset.form === "settings") {
      await handleSettingsSubmit(form);
    }
  }

  async function handleEntrySubmit(form) {
    const formData = new FormData(form);
    const payload = {
      serviceDate: String(formData.get("service-date") || ""),
      invoiceNumber: String(formData.get("invoice-number") || "").trim(),
      personName: String(formData.get("person-name") || "").trim(),
      hoursAmount: String(formData.get("hours-amount") || "").trim(),
      status: String(formData.get("status") || "pendiente"),
      comment: String(formData.get("comment") || "").trim(),
      photoPath: String(formData.get("photo-path") || ""),
      photoFileName: String(formData.get("photo-file-name") || ""),
    };

    if (payload.status === "listo" && !payload.invoiceNumber) {
      updateStatus("Indica el numero de factura antes de marcar el registro como listo.", "error");
      return;
    }

    try {
      if (formData.get("entry-id")) {
        await updateInvoiceEntry(String(formData.get("entry-id")), payload);
        updateStatus("Registro de factura actualizado.", "saved");
      } else {
        await createInvoiceEntry(payload);
        updateStatus("Registro pendiente creado.", "saved");
      }
      closeModal();
      await refresh();
    } catch (error) {
      updateStatus(formatSupabaseError(error, "No fue posible guardar el registro."), "error");
    }
  }

  async function handleBatchSubmit(form) {
    const formData = new FormData(form);
    const entryIds = String(formData.get("entry-ids") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const file = formData.get("invoice-file");
    const firstRow = state.rows.find((rowItem) => rowItem.id === entryIds[0]);

    try {
      await assignInvoiceToEntries({
        entryIds,
        invoiceNumber: String(formData.get("invoice-number") || "").trim(),
        file: file instanceof File && file.size ? file : null,
        comment: String(formData.get("comment") || "").trim(),
        serviceDate: firstRow?.serviceDate || toDateInputValue(new Date()),
        storageFolder: String(formData.get("storage-folder") || "").trim(),
      });
      state.selectedIds = new Set();
      closeModal();
      await refresh();
      updateStatus("Factura aplicada correctamente.", "saved");
    } catch (error) {
      updateStatus(formatSupabaseError(error, "No fue posible completar la factura."), "error");
    }
  }

  async function handleSettingsSubmit(form) {
    const formData = new FormData(form);
    try {
      state.settings = await saveInvoiceSettings({
        storageFolder: String(formData.get("storage-folder") || "").trim(),
      });
      applySettingsToInputs();
      closeModal();
      updateStatus("Configuracion de facturas guardada.", "saved");
    } catch (error) {
      updateStatus(formatSupabaseError(error, "No fue posible guardar la configuracion."), "error");
    }
  }

  async function handleImportSubmit() {
    const draft = state.importDraft || createEmptyImportDraft();
    const selectedRows = draft.rows.filter((row) => row.selected);
    if (!selectedRows.length) {
      updateStatus("No hay registros seleccionados para importar.", "error");
      return;
    }

    const invalidRows = selectedRows.filter((row) => getImportRowIssues(row).length);
    if (invalidRows.length) {
      const firstInvalid = invalidRows[0];
      updateStatus(
        `Revisa la fila ${firstInvalid.sourceRowNumber}: ${getImportRowIssues(firstInvalid).join(", ")}.`,
        "error",
      );
      return;
    }

    try {
      await createInvoiceEntriesBatch(
        selectedRows.map((row) => ({
          serviceDate: row.serviceDate,
          personName: row.personName,
          hoursAmount: row.hoursAmount,
          invoiceNumber: row.reference || null,
          status: "pendiente",
          comment: row.comment || "",
        })),
        {
          fileName: draft.fileName,
          sheetName: draft.sheetName,
        },
      );
      closeModal();
      await refresh();
      updateStatus(`${selectedRows.length} registro(s) importados a facturas pendientes.`, "saved");
    } catch (error) {
      updateStatus(formatSupabaseError(error, "No fue posible importar el archivo Excel."), "error");
    }
  }

  async function handleModalClick(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "close-modal") {
      closeModal();
      return;
    }
    if (action === "download-import-template") {
      downloadImportTemplate();
      return;
    }
    if (action === "restore-import-default") {
      restoreImportSelectionBySuccess();
      renderImportModal();
      return;
    }
    if (action === "select-ready-import") {
      restoreImportSelectionBySuccess();
      renderImportModal();
      return;
    }
    if (action === "select-pending-import") {
      selectPendingImportRows();
      renderImportModal();
      return;
    }
    if (action === "select-all-import") {
      setImportSelectionForAll(true);
      renderImportModal();
      return;
    }
    if (action === "clear-import-selection") {
      setImportSelectionForAll(false);
      renderImportModal();
      return;
    }
    if (action === "run-ocr") {
      const fileInput = refs.modalContent.querySelector("input[name='invoice-file']");
      const file = fileInput?.files?.[0];
      if (!file) {
        updateModalOcrStatus("Carga una imagen antes de ejecutar OCR.", 0, "error");
        return;
      }
      await runOcrForFile(file);
    }
  }

  async function handleModalChange(event) {
    const importFileInput = event.target.closest("input[name='import-file']");
    if (importFileInput) {
      const file = importFileInput.files?.[0];
      if (!file) {
        state.importDraft = createEmptyImportDraft();
        renderImportModal();
        return;
      }
      
      // Guardar nombre del archivo antes de hacer cambios
      const fileName = file.name;
      await loadImportDraftFromFile(file);
      
      // Limpiar el input file después de cargar exitosamente
      if (state.importDraft?.fileName === fileName) {
        importFileInput.value = "";
      }
      return;
    }

    const selectionInput = event.target.closest("[data-role='import-select-row']");
    if (selectionInput) {
      setImportRowSelection(selectionInput.dataset.rowId, selectionInput.checked);
      renderImportModal();
      return;
    }

    const importField = event.target.closest("[data-role='import-field']");
    if (importField) {
      updateImportRowField(importField.dataset.rowId, importField.dataset.field, importField.value);
      renderImportModal();
      return;
    }

    const fileInput = event.target.closest("input[name='invoice-file']");
    if (!fileInput) return;
    const file = fileInput.files?.[0];
    if (!file) {
      releasePreviewUrl();
      updatePreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    releasePreviewUrl();
    state.previewUrl = previewUrl;
    updatePreview(previewUrl);
    await runOcrForFile(file);
  }

  function handleModalInput(event) {
    const importField = event.target.closest("[data-role='import-field']");
    if (!importField) return;
    updateImportRowField(importField.dataset.rowId, importField.dataset.field, importField.value);
  }

  async function handleTableClick(event) {
    const rowElement = event.target.closest("tr[data-row-id]");
    if (!rowElement) return;
    const row = state.rows.find((item) => item.id === rowElement.dataset.rowId);
    if (!row) return;

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) {
      state.selectedRowId = row.id;
      await renderDetail();
      return;
    }

    if (action === "edit") {
      state.selectedRowId = row.id;
      openEntryModal(row);
      return;
    }
    if (action === "ready") {
      state.selectedRowId = row.id;
      openBatchModal(row);
      return;
    }
    if (action === "delete") {
      const confirmed = window.confirm(`Se eliminara el registro de ${row.personName}. Deseas continuar?`);
      if (!confirmed) return;
      try {
        await deleteInvoiceEntry(row.id);
        state.selectedIds.delete(row.id);
        if (state.selectedRowId === row.id) {
          state.selectedRowId = "";
        }
        await refresh();
        updateStatus("Registro de factura eliminado.", "saved");
      } catch (error) {
        updateStatus(formatSupabaseError(error, "No fue posible borrar el registro."), "error");
      }
    }
  }

  async function handleTableChange(event) {
    const rowElement = event.target.closest("tr[data-row-id]");
    if (!rowElement) return;
    const row = state.rows.find((item) => item.id === rowElement.dataset.rowId);
    if (!row) return;

    const checkbox = event.target.closest("[data-action='select-row']");
    if (checkbox) {
      if (checkbox.checked) {
        state.selectedIds.add(row.id);
      } else {
        state.selectedIds.delete(row.id);
      }
      renderSummary();
    }
  }

  async function exportMonthlyZip() {
    try {
      updateStatus("Generando reporte mensual ZIP...", "loading");
      const monthRange = getMonthRange(state.monthFilter);
      const rows = await listInvoiceEntriesByRange({
        dateStart: monthRange.start,
        dateEnd: monthRange.end,
      });

      if (!rows.length) {
        updateStatus("No hay facturas en el mes seleccionado.", "error");
        return;
      }

      const workbook = window.XLSX.utils.book_new();
      const tableRows = rows.map((row) => ({
        Fecha: row.serviceDate,
        "No. Factura": row.invoiceNumber || "",
        Nombre: row.personName,
        Horas: row.hoursAmount,  // Exportar valor numérico sin formato
        Estado: capitalize(row.status),
        comentario: row.comment || "",
      }));
      const worksheet = window.XLSX.utils.json_to_sheet(tableRows);
      window.XLSX.utils.book_append_sheet(workbook, worksheet, "Facturas");
      const workbookBuffer = window.XLSX.write(workbook, {
        type: "array",
        bookType: "xlsx",
      });

      const zip = new JSZip();
      zip.file(`reporte_facturas_${state.monthFilter}.xlsx`, workbookBuffer);
      const photosFolder = zip.folder(`fotos_facturas_${state.monthFilter}`);
      const uniquePhotos = Array.from(new Set(rows.map((row) => row.photoPath).filter(Boolean)));

      for (const path of uniquePhotos) {
        const blob = await downloadInvoicePhoto(path);
        const fileName = path.split("/").pop() || `factura-${Date.now()}.jpg`;
        const bytes = await blob.arrayBuffer();
        photosFolder.file(fileName, bytes);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      triggerBlobDownload(zipBlob, `reporte_facturas_${state.monthFilter}.zip`);
      updateStatus("Reporte mensual ZIP generado.", "saved");
    } catch (error) {
      updateStatus(formatSupabaseError(error, "No fue posible exportar el reporte mensual."), "error");
    }
  }

  async function runOcrForFile(file) {
    try {
      updateModalOcrStatus('Leyendo la imagen completa y buscando la linea "Trans:"...', 0, "pending");
      const Tesseract = await loadTesseract();
      const imageDataUrl = await prepareImageForOcr(file);
      const result = await Tesseract.recognize(imageDataUrl, "eng");
      const rawText = String(result?.data?.text || "");
      const detection = extractInvoiceNumberFromText(rawText);
      const invoiceNumber = detection.value;
      const confidence = Math.round(Number(result?.data?.confidence) || 0);
      const invoiceInput = refs.modalContent.querySelector("input[name='invoice-number']");
      if (invoiceInput && invoiceNumber) {
        invoiceInput.value = invoiceNumber;
      }
      updateModalOcrStatus(
        invoiceNumber
          ? `Numero detectado desde ${detection.source}: ${invoiceNumber}`
          : 'OCR ejecutado, pero no se detecto un numero claro en la linea "Trans:".',
        confidence,
        invoiceNumber ? "success" : "error",
      );
    } catch (error) {
      updateModalOcrStatus(formatSupabaseError(error, "No fue posible ejecutar OCR."), 0, "error");
    }
  }

  function applySettingsToInputs() {
    refs.pageSize.value = String(state.pageSize);
    refs.statusFilter.value = state.statusFilter;
    refs.monthFilter.value = state.monthFilter;
  }

  function updateStatus(message, stateName = "saved") {
    if (typeof onStatusChange === "function") {
      onStatusChange(message, stateName);
    }
  }

  function updateModalOcrStatus(message, confidence, stateName) {
    state.ocrStatus = message;
    state.ocrConfidence = confidence;
    const badge = refs.modalContent.querySelector("[data-role='ocr-status-badge']");
    const confidenceNode = refs.modalContent.querySelector("[data-role='ocr-confidence']");
    if (badge) {
      badge.textContent = message;
      badge.dataset.state = stateName;
    }
    if (confidenceNode) {
      confidenceNode.textContent = `Confianza OCR: ${confidence}%`;
    }
  }

  function updatePreview(previewUrl) {
    const image = refs.modalContent.querySelector("[data-role='preview-image']");
    const empty = refs.modalContent.querySelector("[data-role='preview-empty']");
    if (!image || !empty) return;

    if (!previewUrl) {
      image.hidden = true;
      image.removeAttribute("src");
      empty.hidden = false;
      return;
    }

    image.src = previewUrl;
    image.hidden = false;
    empty.hidden = true;
  }

  function getSelectedRow() {
    return state.rows.find((row) => row.id === state.selectedRowId) || null;
  }

  function releasePreviewUrl() {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = "";
    }
  }

  function releasePhotoUrl() {
    state.photoUrl = "";
  }

  async function loadImportDraftFromFile(file) {
    try {
      updateStatus(`Leyendo ${file.name}...`, "loading");
      console.log("📁 Iniciando lectura del archivo:", file.name, file.type, file.size);
      state.importDraft = await parseInvoiceImportFile(file);
      renderImportModal();
      updateStatus(`Excel cargado: ${state.importDraft.rows.length} fila(s) detectadas.`, "saved");
    } catch (error) {
      console.error("❌ Error al cargar archivo:", error);
      state.importDraft = createEmptyImportDraft();
      renderImportModal();
      updateStatus(formatSupabaseError(error, "No fue posible leer el archivo Excel."), "error");
    }
  }

  function downloadImportTemplate() {
    if (!window.XLSX) {
      updateStatus("XLSX no esta disponible. Intenta recargar la pagina.", "error");
      return;
    }

    const sampleData = [
      {
        "Referencia": "295",
        "Cliente": "1459",
        "Nombre completo Cliente": "Juan Perez",
        "Total": "RD$ 2200",
        "Tipo": "0",
        "Descripción Tipo": "0",
        "Borrador": "0",
        "data": "data",
        "Éxito": "1",
        "Error": "",
        "orderId": "ZVW44254W7H8E5XWKVUP",
        "transactionId": "CCKHHY",
        "result": "Error",
        "errorResult": "",
        "Devuelta": "0",
        "fkModel": "1175",
        "fkId": "1483",
        "Fecha de creación": "29/11/2025 18:07",
        "Creado por": "",
        "Nombre Creado por": "",
        "Fecha de actualización": "29/11/2025 18:07",
        "Actualizado por": "",
        "Nombre Actualizado por": "",
      },
      {
        "Referencia": "296",
        "Cliente": "1460",
        "Nombre completo Cliente": "Maria Garcia",
        "Total": "RD$ 1500",
        "Tipo": "0",
        "Descripción Tipo": "0",
        "Borrador": "0",
        "data": "data",
        "Éxito": "1",
        "Error": "",
        "orderId": "ABC123DEF456GHI789",
        "transactionId": "XYZ789",
        "result": "Success",
        "errorResult": "",
        "Devuelta": "0",
        "fkModel": "1176",
        "fkId": "1484",
        "Fecha de creación": "30/11/2025 14:30",
        "Creado por": "",
        "Nombre Creado por": "",
        "Fecha de actualización": "30/11/2025 14:30",
        "Actualizado por": "",
        "Nombre Actualizado por": "",
      },
      {
        "Referencia": "297",
        "Cliente": "1461",
        "Nombre completo Cliente": "Carlos Lopez",
        "Total": "RD$ 0",
        "Tipo": "0",
        "Descripción Tipo": "0",
        "Borrador": "0",
        "data": "data",
        "Éxito": "0",
        "Error": "Cancelado",
        "orderId": "DEF789GHI012JKL345",
        "transactionId": "UVW456",
        "result": "Error",
        "errorResult": "Cancelado",
        "Devuelta": "0",
        "fkModel": "1177",
        "fkId": "1485",
        "Fecha de creación": "01/12/2025 09:15",
        "Creado por": "",
        "Nombre Creado por": "",
        "Fecha de actualización": "01/12/2025 09:15",
        "Actualizado por": "",
        "Nombre Actualizado por": "",
      },
    ];

    try {
      const workbook = window.XLSX.utils.book_new();
      const worksheet = window.XLSX.utils.json_to_sheet(sampleData);
      window.XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
      window.XLSX.writeFile(workbook, "plantilla-facturas-ejemplo.xlsx");
      updateStatus("Plantilla descargada correctamente.", "saved");
    } catch (error) {
      console.error("❌ Error al generar plantilla:", error);
      updateStatus("No fue posible generar la plantilla.", "error");
    }
  }

  function restoreImportSelectionBySuccess() {
    state.importDraft.rows = state.importDraft.rows.map((row) => ({
      ...row,
      selected: row.sourceSuccess === 1 && !getImportRowIssues(row).length,
    }));
  }

  function selectPendingImportRows() {
    state.importDraft.rows = state.importDraft.rows.map((row) => ({
      ...row,
      selected: row.sourceSuccess === 0 && !getImportRowIssues(row).length,
    }));
  }

  function getImportSelectedAmount(rows) {
    return rows.reduce((total, row) => {
      const amount = Number(normalizeCurrencyValue(row.hoursAmount));
      return total + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  function setImportSelectionForAll(selected) {
    state.importDraft.rows = state.importDraft.rows.map((row) => ({
      ...row,
      selected: Boolean(selected) ? !getImportRowIssues(row).length : false,
    }));
  }

  function setImportRowSelection(rowId, selected) {
    state.importDraft.rows = state.importDraft.rows.map((row) => (
      row.id === rowId
        ? {
          ...row,
          selected: Boolean(selected),
        }
        : row
    ));
  }

  function updateImportRowField(rowId, field, value) {
    state.importDraft.rows = state.importDraft.rows.map((row) => {
      if (row.id !== rowId) return row;
      if (field === "serviceDate") {
        return { ...row, serviceDate: normalizeImportedDate(value) };
      }
      if (field === "personName") {
        return { ...row, personName: String(value || "").trim() };
      }
      if (field === "hoursAmount") {
        return { ...row, hoursAmount: normalizeImportedAmount(value) };
      }
      return row;
    });
  }

  return {
    mount,
    refresh,
    setSearchTerm,
    setVisible,
    getViewMeta,
  };
}

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  if (!tesseractPromise) {
    tesseractPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = OCR_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => reject(new Error("No fue posible cargar Tesseract."));
      document.head.appendChild(script);
    });
  }
  return tesseractPromise;
}

async function prepareImageForOcr(file) {
  const imageBitmap = await createImageBitmap(file);
  const maxDimension = 2200;
  const scale = Math.min(1, maxDimension / Math.max(imageBitmap.width, imageBitmap.height));
  const width = Math.max(1, Math.round(imageBitmap.width * scale));
  const height = Math.max(1, Math.round(imageBitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(imageBitmap, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const average = Math.round((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3);
    const boosted = average < 170 ? 0 : 255;
    pixels[index] = boosted;
    pixels[index + 1] = boosted;
    pixels[index + 2] = boosted;
  }
  context.putImageData(imageData, 0, 0);
  imageBitmap.close();
  return canvas.toDataURL("image/png");
}

function extractInvoiceNumberFromText(rawText) {
  const normalized = String(rawText || "")
    .replace(/\r/g, "\n")
    .replace(/[|;]/g, ":")
    .replace(/[Oo](?=\d)/g, "0");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index];
    const transMatch = currentLine.match(/trans\s*[:#.\-]?\s*([a-z0-9-]{3,})/i);
    if (transMatch) {
      const transValue = normalizeInvoiceNumberCandidate(transMatch[1]);
      if (transValue) {
        return { value: transValue, source: 'la linea "Trans:"' };
      }
    }

    if (/trans\s*[:#.\-]?\s*$/i.test(currentLine) && lines[index + 1]) {
      const nextValue = normalizeInvoiceNumberCandidate(lines[index + 1]);
      if (nextValue) {
        return { value: nextValue, source: 'la linea "Trans:"' };
      }
    }
  }

  for (const line of lines) {
    const fallbackValue = normalizeInvoiceNumberCandidate(line);
    if (fallbackValue) {
      return { value: fallbackValue, source: "OCR general" };
    }
  }

  return { value: "", source: "" };
}

function normalizeInvoiceNumberCandidate(value) {
  const cleaned = String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^0-9-]/g, "");
  const digits = cleaned.replace(/\D+/g, "");
  return digits.length >= 4 ? digits : "";
}

function createEmptyImportDraft() {
  return {
    fileName: "",
    sheetName: "",
    rows: [],
    columnSummary: [],
  };
}

async function parseInvoiceImportFile(file) {
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const checkInterval = setInterval(() => {
        if (window.XLSX) {
          clearInterval(checkInterval);
          resolve();
        } else if (attempts++ > 50) {
          clearInterval(checkInterval);
          reject(new Error("La libreria de Excel (XLSX) no pudo ser cargada. Intenta recargar la pagina."));
        }
      }, 100);
    });
  }

  const buffer = await file.arrayBuffer();
  console.log("✅ Buffer leído, tamaño:", buffer.byteLength);
  
  const workbook = window.XLSX.read(buffer, {
    type: "array",
    cellDates: true,
  });
  console.log("✅ Workbook parseado, hojas:", workbook.SheetNames);
  
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    throw new Error("El archivo no contiene hojas para importar.");
  }

  const sheet = workbook.Sheets[sheetName];
  const records = window.XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });
  
  console.log("✅ Registros leídos:", records.length, "primeras columnas:", Object.keys(records[0] || {}));

  if (!records.length) {
    throw new Error("El archivo no trae filas con datos.");
  }

  const columnMap = resolveImportColumnMap(Object.keys(records[0] || {}));
  console.log("✅ Columnas detectadas:", columnMap);
  
  const missingColumns = [
    !columnMap.serviceDate ? "Fecha" : "",
    !columnMap.personName ? "Nombre" : "",
    !columnMap.hoursAmount ? "Total/Horas" : "",
    !columnMap.success ? "Exito" : "",
  ].filter(Boolean);

  if (missingColumns.length) {
    console.warn("⚠️ Columnas faltantes:", missingColumns);
    throw new Error(`No pude detectar estas columnas: ${missingColumns.join(", ")}. Columnas encontradas: ${Object.keys(records[0] || {}).join(", ")}`);
  }

  const batchId = `import-${Date.now()}`;
  const rows = records
    .map((record, index) => buildImportDraftRow(record, index, columnMap, batchId))
    .filter((row) => row.hasData)
    .map(({ hasData, ...row }) => row);

  const referenceCounts = rows.reduce((acc, row) => {
    const reference = String(row.reference || "").trim();
    if (!reference) return acc;
    acc[reference] = (acc[reference] || 0) + 1;
    return acc;
  }, {});

  const rowsWithDuplicateFlags = rows.map((row) => ({
    ...row,
    duplicateReference: Boolean(row.reference && referenceCounts[String(row.reference).trim()] > 1),
  }));

  const rowsWithSelection = rowsWithDuplicateFlags.map((row) => ({
    ...row,
    selected: row.sourceSuccess === 1 && !getImportRowIssues(row).length,
  }));

  console.log("✅ Filas procesadas:", rowsWithSelection.length);

  if (!rowsWithSelection.length) {
    throw new Error("No se encontraron filas utiles para importar.");
  }

  return {
    fileName: file.name,
    sheetName,
    rows: rowsWithSelection,
    columnSummary: [
      `Fecha -> ${columnMap.serviceDate}`,
      `Cliente -> ${columnMap.personName}`,
      `Total -> ${columnMap.hoursAmount}`,
      `Éxito -> ${columnMap.success}`,
      ...(columnMap.reference ? [`Referencia -> ${columnMap.reference}`] : []),
    ],
  };
}

function buildImportDraftRow(record, index, columnMap, batchId) {
  const serviceDate = normalizeImportedDate(record[columnMap.serviceDate]);
  const personName = String(record[columnMap.personName] || "").trim();
  const hoursAmount = normalizeImportedAmount(record[columnMap.hoursAmount]);
  const sourceSuccess = parseImportSuccess(record[columnMap.success]);
  const reference = String(record[columnMap.reference] || "").trim();
  const sourceRowNumber = index + 2;
  const hasData = Boolean(
    serviceDate
      || personName
      || hoursAmount
      || String(record[columnMap.success] || "").trim()
      || reference
  );

  const row = {
    id: `${batchId}-${index}`,
    sourceRowNumber,
    serviceDate,
    personName,
    hoursAmount,
    sourceSuccess,
    sourceSuccessRaw: String(record[columnMap.success] ?? "").trim(),
    reference,
    comment: reference ? `Referencia: ${reference}` : "",
    selected: false,
    hasData,
  };

  row.selected = row.sourceSuccess === 1 && !getImportRowIssues(row).length;
  return row;
}

function renderImportTable(rows, emptyMessage) {
  if (!rows.length) {
    return `<div class="invoice-card-empty">${escapeHtml(emptyMessage)}</div>`;
  }

  return `
    <div class="table-wrap invoice-import-table-wrap">
      <table class="data-table invoice-import-table">
        <thead>
          <tr>
            <th></th>
            <th>Fila</th>
            <th>Referencia</th>
            <th>Fecha</th>
            <th>Nombre</th>
            <th>Total</th>
            <th>Exito</th>
            <th>Estado de importacion</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => renderImportTableRow(row)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderImportTableRow(row) {
  const issues = getImportRowIssues(row);
  const stateName = issues.length ? "error" : row.selected ? "success" : "pending";
  return `
    <tr data-import-row-id="${escapeHtml(row.id)}">
      <td>
        <input type="checkbox" data-role="import-select-row" data-row-id="${escapeHtml(row.id)}" ${row.selected ? "checked" : ""}>
      </td>
      <td>${escapeHtml(String(row.sourceRowNumber))}</td>
      <td>
        ${escapeHtml(row.reference || "-")}
        ${row.duplicateReference ? `<span class="invoice-auto-badge" data-state="error">Duplicado</span>` : ""}
      </td>
      <td>
        <input
          type="date"
          class="table-input"
          data-role="import-field"
          data-row-id="${escapeHtml(row.id)}"
          data-field="serviceDate"
          value="${escapeHtml(row.serviceDate)}"
        >
      </td>
      <td>
        <input
          type="text"
          class="table-input"
          data-role="import-field"
          data-row-id="${escapeHtml(row.id)}"
          data-field="personName"
          value="${escapeHtml(row.personName)}"
          placeholder="Nombre"
        >
      </td>
      <td>
        <input
          type="text"
          class="table-input"
          data-role="import-field"
          data-row-id="${escapeHtml(row.id)}"
          data-field="hoursAmount"
          value="${escapeHtml(row.hoursAmount)}"
          placeholder="0.00"
        >
      </td>
      <td>
        <span class="invoice-auto-badge" data-state="${row.sourceSuccess === 1 ? "success" : "pending"}">
          ${row.sourceSuccess === 1 ? "Exito 1" : "Exito 0"}
        </span>
      </td>
      <td>
        <span class="invoice-auto-badge" data-state="${stateName}">
          ${escapeHtml(getImportRowStatusText(row))}
        </span>
      </td>
    </tr>
  `;
}

function resolveImportColumnMap(headers) {
  const entries = headers.map((header) => ({
    original: header,
    normalized: normalizeHeaderToken(header),
  }));

  return {
    serviceDate: pickImportHeader(entries, [
      (value) => value === "fecha de creacion",
      (value) => value === "fecha de creación",
      (value) => value.includes("fecha de cre"),
      (value) => value === "fecha",
      (value) => value.startsWith("fecha de c"),
      (value) => value.includes("fecha de cre"),
      (value) => value.includes("fecha servicio"),
      (value) => value.startsWith("fecha") && !value.includes("actualizado"),
      (value) => value === "date",
      (value) => value.startsWith("date"),
      (value) => value === "data",
    ]),
    reference: pickImportHeader(entries, [
      (value) => value === "referencia",
      (value) => value === "reference",
      (value) => value === "ref",
      (value) => value === "id",
      (value) => value.includes("referencia"),
      (value) => value.includes("reference"),
    ]),
    personName: pickImportHeader(entries, [
      (value) => value === "nombre completo cliente",
      (value) => value === "nombre completo",
      (value) => value.startsWith("nombre co"),
      (value) => value === "nombre",
      (value) => value.includes("nombre") && !value.includes("creado") && !value.includes("actualizado"),
      (value) => value === "cliente",
      (value) => value === "name",
      (value) => value === "persona",
      (value) => value === "worker",
    ]),
    hoursAmount: pickImportHeader(entries, [
      (value) => value === "total",
      (value) => value === "amount",
      (value) => value === "monto",
      (value) => value === "horas",
      (value) => value === "hours",
      (value) => value.includes("total"),
      (value) => value.includes("amount"),
      (value) => value.includes("monto"),
      (value) => value.includes("horas") || value.includes("hours"),
    ]),
    success: pickImportHeader(entries, [
      (value) => value === "exito",
      (value) => value === "éxito",
      (value) => value.includes("exito"),
      (value) => value.includes("éxito"),
      (value) => value === "success",
      (value) => value === "completado",
      (value) => value === "status" && !value.includes("estado"),
      (value) => value === "result",
    ]),
  };
}

function pickImportHeader(entries, matchers) {
  for (const matcher of matchers) {
    const found = entries.find((entry) => matcher(entry.normalized));
    if (found) return found.original;
  }
  return "";
}

function normalizeHeaderToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeImportedDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateInputValue(value);
  }

  if (typeof value === "number" && Number.isFinite(value) && window.XLSX?.SSF?.parse_date_code) {
    const parsed = window.XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = String(value || "").trim();
  if (!text) return "";

  // Formato específico: "29/11/2025 18:07" -> "2025-11-29"
  const dateTimeMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+\d{1,2}:\d{2}$/);
  if (dateTimeMatch) {
    const [, day, month, year] = dateTimeMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  const latinMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (latinMatch) {
    const year = latinMatch[3].length === 2 ? `20${latinMatch[3]}` : latinMatch[3];
    return `${year}-${latinMatch[2].padStart(2, "0")}-${latinMatch[1].padStart(2, "0")}`;
  }

  const parsedDate = new Date(text);
  if (!Number.isNaN(parsedDate.getTime())) {
    return toDateInputValue(parsedDate);
  }

  return "";
}

function normalizeImportedAmount(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const normalized = formatAmountForInput(value);
  return normalized;
}

function formatAmountForInput(value) {
  const raw = String(value ?? "").trim();
  const amount = normalizeCurrencyValue(raw);
  if (!amount && !/[0-9]/.test(raw)) {
    return "";
  }
  return amount.toFixed(2);
}

function parseImportSuccess(value) {
  const numericValue = Number(String(value ?? "").trim().replace(",", "."));
  if (Number.isFinite(numericValue) && numericValue === 1) {
    return 1;
  }
  const normalized = normalizeHeaderToken(value);
  if (normalized === "1" || normalized === "si" || normalized === "true" || normalized === "yes") {
    return 1;
  }
  return 0;
}

function getImportRowIssues(row) {
  const issues = [];
  if (!row.serviceDate) {
    issues.push("Falta fecha");
  }
  if (!String(row.personName || "").trim()) {
    issues.push("Falta nombre");
  }
  if (normalizeCurrencyValue(row.hoursAmount) <= 0) {
    issues.push("Horas invalidas");
  }
  if (row.duplicateReference) {
    issues.push("Referencia duplicada");
  }
  return issues;
}

function getImportRowStatusText(row) {
  const issues = getImportRowIssues(row);
  if (issues.length) {
    return issues.join(", ");
  }
  if (row.sourceSuccess === 0) {
    return "Exito = 0";
  }
  return "Listo para importar";
}

function buildMarkup() {
  return `
    <section class="panel table-panel invoice-module-shell">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <span class="section-title">Facturas del mes</span>
          <span class="results-meta" data-role="results-meta">0 registros</span>
        </div>
        <div class="toolbar-right">
          <span class="invoice-auto-badge" data-role="status-badge" data-state="pending">Sincronizando...</span>
          <button type="button" class="secondary small" data-action="select-all-rows">Seleccionar todos</button>
          <button type="button" class="secondary small" data-action="select-pending-rows">Solo pendientes</button>
          <button type="button" class="secondary small" data-action="select-ready-rows">Solo listos</button>
          <button type="button" class="secondary small" data-action="clear-selection">Limpiar selección</button>
          <span class="invoice-auto-badge" data-role="selection-summary">0 seleccionado(s) · RD$ 0.00</span>
          <button type="button" class="primary" data-role="open-create">Nuevo pendiente</button>
          <button type="button" class="secondary" data-role="open-import">Importar XLSX</button>
          <button type="button" class="secondary" data-role="open-batch">Facturar seleccionados</button>
          <button type="button" class="secondary" data-role="export-monthly">Exportar mes ZIP</button>
          <button type="button" class="secondary" data-role="open-settings">Configuracion</button>
          <select data-role="status-filter">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="listo">Listo</option>
          </select>
          <input type="month" data-role="month-filter">
        </div>
      </div>
      <div class="invoice-module-grid">
        <div class="invoice-module-stack">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Fecha</th>
                  <th>No. Factura</th>
                  <th>Nombre</th>
                  <th>Horas</th>
                  <th>Estado</th>
                  <th>comentario</th>
                  <th>Ultima modificacion</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody data-role="table-body">
                <tr>
                  <td colspan="9" class="empty-cell">Cargando facturas desde Supabase...</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pagination-bar">
            <div class="pagination-info" data-role="pagination-info">Mostrando 0-0 de 0</div>
            <div class="pagination-controls">
              <button type="button" class="secondary small" data-role="prev-page">Anterior</button>
              <span data-role="page-indicator">Pagina 1</span>
              <button type="button" class="secondary small" data-role="next-page">Siguiente</button>
              <select data-role="page-size">
                <option value="10" selected>10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
        </div>
        <aside class="panel detail-panel" data-role="detail">
          <div class="invoice-card-empty">Selecciona un registro para ver su detalle.</div>
        </aside>
      </div>
    </section>

    <div class="invoice-modal" data-role="modal">
      <div class="invoice-modal-dialog">
        <div class="drawer-header">
          <div>
            <p class="drawer-kicker">Facturas</p>
            <h2 data-role="modal-title">Nuevo registro</h2>
          </div>
          <button type="button" class="icon-close" data-role="modal-close">Cerrar</button>
        </div>
        <div class="invoice-modal-body" data-role="modal-content"></div>
      </div>
    </div>
  `;
}

function renderStatusBadge(status) {
  return `<span class="badge ${status === "listo" ? "status-resuelto" : "status-en-seguimiento"}">${escapeHtml(capitalize(status))}</span>`;
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function getMonthRange(monthValue) {
  const normalized = String(monthValue || new Date().toISOString().slice(0, 7));
  const [year, month] = normalized.split("-").map((part) => Number(part));
  const startDate = new Date(Date.UTC(year, (month || 1) - 1, 1));
  const endDate = new Date(Date.UTC(year, month || 1, 0));
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return date.toLocaleDateString("es-DO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return date.toLocaleString("es-DO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
