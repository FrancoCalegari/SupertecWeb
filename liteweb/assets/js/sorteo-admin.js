/**
 * sorteo-admin.js — Sorteo Admin Panel
 * Spider API / MariaDB: response shape { success, result: [...] or {...} }
 */

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SPIDER_PROXY_API = "/api/spider-proxy";
const DB_NAME = "sw_Franco Calegari_supertec";

// ─── SPIDER HELPERS ────────────────────────────────────────────────────────
async function spiderQuery(sql) {
  const res = await fetch(`${SPIDER_PROXY_API}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ database: DB_NAME, query: sql }),
  });
  const data = await res.json();
  if (!data.success) {
    console.error("Spider SQL error:", data.message, "\nQuery:", sql);
    throw new Error(data.message || data.error || "SQL error");
  }
  return data; // .result is array (SELECT) or write-result object
}

async function spiderSelect(sql) {
  const data = await spiderQuery(sql);
  return Array.isArray(data.result) ? data.result : [];
}

// ─── DB INIT ───────────────────────────────────────────────────────────────
let dbReady = false;
async function ensureTablesExist() {
  if (dbReady) return;
  await spiderQuery(`
    CREATE TABLE IF NOT EXISTS sorteo_config (
      id INT PRIMARY KEY,
      title TEXT, description TEXT, prizes TEXT,
      deadline TEXT, mode VARCHAR(20) DEFAULT 'clientes',
      min_purchase DECIMAL(10,2) DEFAULT 0, currency VARCHAR(5) DEFAULT 'ARS',
      active TINYINT DEFAULT 1, show_roulette TINYINT DEFAULT 0, winners TEXT
    )
  `);
  await spiderQuery(`
    INSERT IGNORE INTO sorteo_config
      (id,title,description,prizes,deadline,mode,min_purchase,currency,active,show_roulette,winners)
    VALUES (1,'Gran Sorteo Supertec','','[]','','clientes',0,'ARS',1,0,'[]')
  `);
  await spiderQuery(`
    CREATE TABLE IF NOT EXISTS sorteo_participantes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      instagram VARCHAR(100) NOT NULL, telefono VARCHAR(50) NOT NULL,
      nombre VARCHAR(150) NOT NULL, monto_compra DECIMAL(10,2) DEFAULT 0,
      created_at DATETIME DEFAULT NOW()
    )
  `);
  dbReady = true;
}

// ─── CONFIG CRUD ───────────────────────────────────────────────────────────
async function loadSorteoConfig() {
  await ensureTablesExist();
  const rows = await spiderSelect("SELECT * FROM sorteo_config WHERE id = 1");
  if (!rows.length) return null;
  const row = rows[0];
  return {
    ...row,
    prizes: safeJSON(row.prizes, []),
    winners: safeJSON(row.winners, []),
    active: Boolean(Number(row.active)),
    show_roulette: Boolean(Number(row.show_roulette)),
  };
}

async function saveSorteoConfig(cfg) {
  const priz = esc(JSON.stringify(cfg.prizes || []));
  const wins = esc(JSON.stringify(cfg.winners || []));
  await spiderQuery(`
    UPDATE sorteo_config SET
      title='${esc(cfg.title)}', description='${esc(cfg.description)}',
      prizes='${priz}', deadline='${esc(cfg.deadline)}',
      mode='${esc(cfg.mode)}', min_purchase=${parseFloat(cfg.min_purchase) || 0},
      currency='${esc(cfg.currency)}',
      active=${cfg.active ? 1 : 0}, show_roulette=${cfg.show_roulette ? 1 : 0},
      winners='${wins}'
    WHERE id=1
  `);
}

// ─── PARTICIPANTS CRUD ─────────────────────────────────────────────────────
async function loadParticipantes() {
  return await spiderSelect("SELECT * FROM sorteo_participantes ORDER BY created_at DESC");
}
async function deleteParticipante(id) {
  await spiderQuery(`DELETE FROM sorteo_participantes WHERE id=${parseInt(id)}`);
}
function exportCSV(rows) {
  const h = "ID,Instagram,Telefono,Nombre,Ticket Comprobante,Fecha\n";
  const b = rows.map(r =>
    [r.id, r.instagram, r.telefono, r.nombre, r.ticket_url, r.created_at]
      .map(v => `"${String(v || "").replace(/"/g, '""')}"`)
      .join(",")
  ).join("\n");
  const url = URL.createObjectURL(new Blob([h + b], { type: "text/csv;charset=utf-8;" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "participantes.csv" });
  a.click(); URL.revokeObjectURL(url);
}

// ─── PRIZES CRUD (in-memory, saved with config) ────────────────────────────
// prizesList is managed here and persisted inside sorteo_config.prizes (JSON array)

// ─── SORTEO DRAW ───────────────────────────────────────────────────────────
async function realizarSorteo(parts, cfg, n) {
  if (!parts.length) return null;
  const sel = [...parts].sort(() => Math.random() - .5).slice(0, n).map(p => p.instagram);
  cfg.winners = sel;
  await saveSorteoConfig(cfg);
  return sel;
}
async function resetSorteo(cfg, deleteAll) {
  cfg.winners = [];
  await saveSorteoConfig(cfg);
  if (deleteAll) await spiderQuery("DELETE FROM sorteo_participantes");
}

// ═══ UI STATE ═══════════════════════════════════════════════════════════════
let sorteoConfig = null;
let participantes = [];
let prizesList = [];
let filterQ = "";
// Track which prize is being edited (null = adding new)
let editingPrizeIndex = null;

// ═══ MAIN INIT ══════════════════════════════════════════════════════════════
export async function initSorteoTab() {
  const inner = document.getElementById("tab-sorteo-inner");
  if (!inner) return;
  inner.innerHTML = `<p style="text-align:center;color:#888;padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando…</p>`;
  try {
    [sorteoConfig, participantes] = await Promise.all([loadSorteoConfig(), loadParticipantes()]);
    prizesList = [...(sorteoConfig?.prizes || [])];
  } catch (err) {
    inner.innerHTML = `<p style="color:red;text-align:center;padding:2rem;">Error API: ${err.message}</p>`;
    return;
  }
  setupTicketModal();
  renderSorteoTab(inner);
  bindEvents();
}

function setupTicketModal() {
  if (document.getElementById("s-ticket-modal")) return;
  const div = document.createElement("div");
  div.id = "s-ticket-modal";
  div.style.cssText = "display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:999999; align-items:center; justify-content:center; padding:2rem;";
  div.innerHTML = `
    <div style="background:#fff; border-radius:12px; max-width:600px; width:100%; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 10px 40px rgba(0,0,0,0.5);">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem 1.5rem; background:#f8f9fa; border-bottom:1px solid #eee;">
        <h4 style="margin:0; font-weight:700; color:#333;"><i class="fa-solid fa-receipt"></i> Comprobante de Compra</h4>
        <button onclick="document.getElementById('s-ticket-modal').style.display='none'" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#666;">&times;</button>
      </div>
      <div style="padding:1.5rem; text-align:center; background:#eee; min-height:200px; display:flex; align-items:center; justify-content:center;">
        <img id="s-ticket-img" src="" alt="Ticket" style="max-width:100%; max-height:60vh; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1);" />
      </div>
      <div style="padding:1rem 1.5rem; display:flex; justify-content:flex-end;">
        <a id="s-ticket-download" href="#" target="_blank" download class="s-btn s-btn-blue"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir en otra pestaña</a>
      </div>
    </div>
  `;
  document.body.appendChild(div);
}

// ═══ RENDER ═════════════════════════════════════════════════════════════════
function renderSorteoTab(container) {
  container.innerHTML = `

    <!-- ── CONFIG CARD ── -->
    <div class="sorteo-card">
      <div class="sorteo-card-header">
        <h4><i class="fa-solid fa-gear"></i> Configuración del Sorteo</h4>
        <button id="s-save-btn" class="s-btn s-btn-green s-btn-sm">
          <i class="fa-solid fa-floppy-disk"></i> Guardar
        </button>
      </div>
      <div class="sorteo-grid">

        <div class="s-form-group s-full">
          <label>Título del Sorteo</label>
          <input id="s-title" class="s-input" type="text"
            value="${escHtml(sorteoConfig?.title || '')}" placeholder="Gran Sorteo Supertec" />
        </div>

        <div class="s-form-group s-full">
          <label>Descripción</label>
          <textarea id="s-desc" class="s-input" rows="2"
            placeholder="Descripción breve…">${escHtml(sorteoConfig?.description || '')}</textarea>
        </div>

        <div class="s-form-group">
          <label>Fecha Límite</label>
          <input id="s-deadline" class="s-input" type="datetime-local"
            value="${sorteoConfig?.deadline ? toLocalInput(sorteoConfig.deadline) : ''}" />
        </div>

        <div class="s-form-group">
          <label>Objetivo</label>
          <select id="s-mode" class="s-input">
            <option value="clientes" ${sorteoConfig?.mode === 'clientes' ? 'selected' : ''}>👥 Buscar Clientes</option>
            <option value="ventas"   ${sorteoConfig?.mode === 'ventas' ? 'selected' : ''}>🛍️ Generar Ventas (requiere compra)</option>
          </select>
        </div>

        <div class="s-form-group" id="s-purchase-row"
          style="display:${sorteoConfig?.mode === 'ventas' ? 'flex' : 'none'}">
          <label>Monto Mínimo de Compra</label>
          <div style="display:flex;gap:.5rem;">
            <select id="s-currency" class="s-input" style="max-width:90px;">
              <option value="ARS" ${sorteoConfig?.currency === 'ARS' ? 'selected' : ''}>ARS $</option>
              <option value="USD" ${sorteoConfig?.currency === 'USD' ? 'selected' : ''}>USD $</option>
            </select>
            <input id="s-min-purchase" class="s-input" type="number" min="0" step="1"
              value="${sorteoConfig?.min_purchase || 0}" />
          </div>
        </div>

        <div class="s-form-group s-full">
          <div class="s-switches">
            <label class="s-switch-label">
              <div class="s-switch"><input type="checkbox" id="s-active" ${sorteoConfig?.active ? 'checked' : ''}><span class="s-slider"></span></div>
              <span>Inscripciones abiertas</span>
            </label>
            <label class="s-switch-label">
              <div class="s-switch"><input type="checkbox" id="s-show-roulette" ${sorteoConfig?.show_roulette ? 'checked' : ''}><span class="s-slider"></span></div>
              <span>Mostrar ruleta en sorteo.html</span>
            </label>
          </div>
        </div>

        <!-- ── PRIZES CRUD ── -->
        <div class="s-form-group s-full">
          <label style="font-size:.9rem; font-weight:700; margin-bottom:.5rem; display:block;">
            🏆 Premios <span style="color:#888;font-weight:400;">(${prizesList.length})</span>
          </label>

          <!-- Prize List Table -->
          <div id="s-prizes-table-wrap" style="overflow-x:auto; margin-bottom:.7rem;">
            ${renderPrizesTable()}
          </div>

          <!-- Add/Edit Prize Form -->
          <div class="s-prize-form" id="s-prize-form">
            <input id="s-prize-input" class="s-input" type="text"
              placeholder="Ej: Audífonos Gaming HyperX…" style="flex:1;" />
            <button id="s-prize-save-btn" class="s-btn s-btn-blue s-btn-sm">
              <i class="fa-solid fa-plus" id="s-prize-save-icon"></i>
              <span id="s-prize-save-label">Agregar Premio</span>
            </button>
            <button id="s-prize-cancel-btn" class="s-btn s-btn-sm"
              style="background:#888;color:#fff;display:none;">
              Cancelar
            </button>
          </div>
        </div>

      </div>
      <div id="s-save-msg" style="display:none;margin:0 1.5rem 1rem;padding:.6rem 1rem;border-radius:8px;font-weight:600;font-size:.9rem;"></div>
    </div>

    <!-- ── PARTICIPANTS CARD ── -->
    <div class="sorteo-card">
      <div class="sorteo-card-header">
        <h4><i class="fa-solid fa-users"></i> Participantes
          <span id="s-count-badge" class="s-badge">${participantes.length}</span>
        </h4>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
          <input id="s-search" class="s-input s-input-sm" type="text"
            placeholder="Buscar…" style="max-width:180px;" />
          <button id="s-export-csv" class="s-btn s-btn-blue s-btn-sm">
            <i class="fa-solid fa-download"></i> CSV
          </button>
          <button id="s-refresh" class="s-btn s-btn-sm" style="background:#444;color:#fff;">
            <i class="fa-solid fa-rotate"></i>
          </button>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table class="s-table">
          <thead><tr>
            <th>ID</th><th>Instagram</th><th>Teléfono</th>
            <th>Nombre</th><th>Comprobante</th><th>Fecha</th><th>Acción</th>
          </tr></thead>
          <tbody id="s-participants-body">${renderParticipantRows(participantes)}</tbody>
        </table>
      </div>
    </div>

    <!-- ── ACCIONES CARD ── -->
    <div class="sorteo-card">
      <div class="sorteo-card-header">
        <h4><i class="fa-solid fa-dice"></i> Acciones del Sorteo</h4>
      </div>
      <div class="s-actions-row">
        <div class="s-action-box">
          <p style="color:#666;font-size:.9rem;margin-bottom:.8rem;">
            Elegí cuántos ganadores y presioná el botón para realizar el sorteo aleatorio.
          </p>
          <div style="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin-bottom:.8rem;">
            <label style="font-size:.9rem;color:#666;">N° ganadores:</label>
            <input id="s-num-winners" class="s-input" type="number" min="1" max="20"
              value="1" style="max-width:70px;" />
          </div>
          <button id="s-realizar-sorteo" class="s-btn s-btn-red">
            <i class="fa-solid fa-dice-d6"></i> Realizar Sorteo
          </button>
        </div>

        <div class="s-action-box" id="s-winner-box"
          style="display:${(sorteoConfig?.winners?.length > 0) ? 'block' : 'none'}">
          <p style="font-weight:700;margin-bottom:.5rem;">
            <i class="fa-solid fa-trophy" style="color:#ffd700;"></i> Ganador(es):
          </p>
          <div id="s-current-winners">
            ${(sorteoConfig?.winners || []).map(w => `<span class="s-winner-chip">${escHtml(w)}</span>`).join('')}
          </div>
        </div>
      </div>

      <div style="margin:0 1.5rem 1.5rem;padding-top:1rem;border-top:1px solid #eee;
                  display:flex;gap:.7rem;flex-wrap:wrap;align-items:center;">
        <button id="s-reset-winners" class="s-btn s-btn-sm" style="background:#444;color:#fff;">
          <i class="fa-solid fa-xmark"></i> Limpiar Ganadores
        </button>
        <button id="s-reset-all" class="s-btn s-btn-sm" style="background:#c0392b;color:#fff;">
          <i class="fa-solid fa-trash-can"></i> Reiniciar Completo
        </button>
        <a href="sorteo.html" target="_blank"
          class="s-btn s-btn-sm" style="background:#2980b9;color:#fff;text-decoration:none;">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Página Pública
        </a>
      </div>
    </div>
  `;
}

// ─── PRIZES TABLE ─────────────────────────────────────────────────────────
function renderPrizesTable() {
  if (!prizesList.length) {
    return `<p style="color:#888;font-size:.88rem;padding:.3rem 0;">
      Sin premios aún. Agregá uno abajo.</p>`;
  }
  const ranks = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  const rows = prizesList.map((p, i) => `
    <tr>
      <td style="width:40px;text-align:center;">${ranks[i] || "🎁"}</td>
      <td>${escHtml(p)}</td>
      <td style="width:90px;white-space:nowrap;">
        <button onclick="window.__sorteo_prize_edit(${i})"
          class="edit-btn" style="font-size:.8rem;padding:.2rem .6rem;">✏️ Editar</button>
        <button onclick="window.__sorteo_prize_delete(${i})"
          class="delete-btn" style="font-size:.8rem;padding:.2rem .6rem;">✕</button>
      </td>
    </tr>
  `).join("");
  return `<table class="s-table">
    <thead><tr><th>#</th><th>Premio</th><th>Acciones</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ─── PARTICIPANTS TABLE ────────────────────────────────────────────────────
function renderParticipantRows(rows) {
  const q = filterQ.toLowerCase();
  const filtered = q ? rows.filter(r =>
    (r.instagram || "").toLowerCase().includes(q) ||
    (r.nombre || "").toLowerCase().includes(q) ||
    (r.telefono || "").toLowerCase().includes(q)
  ) : rows;

  if (!filtered.length) {
    return `<tr><td colspan="7" style="text-align:center;color:#888;padding:1.5rem;">
      Sin participantes${q ? ' para "' + escHtml(q) + '"' : ''}
    </td></tr>`;
  }
  return filtered.map(r => `
    <tr>
      <td data-label="ID">${r.id}</td>
      <td data-label="Instagram"><strong>${escHtml(r.instagram)}</strong></td>
      <td data-label="Teléfono">${escHtml(r.telefono)}</td>
      <td data-label="Nombre">${escHtml(r.nombre)}</td>
      <td data-label="Comprobante">
        ${r.ticket_url ? `<button onclick="window.__sorteo_view_ticket('${escHtml(r.ticket_url)}?api_key=${SPIDER_KEY}')" class="s-btn s-btn-sm" style="background:#f0f0f0;color:#007bff;border:1px solid #ddd;"><i class="fa-solid fa-image"></i> Ver Ticket</button>` : '—'}
      </td>
      <td data-label="Fecha">${(r.created_at || '').toString().split('T')[0]}</td>
      <td class="actions">
        <button onclick="window.__sorteo_del_part(${r.id})" class="delete-btn">Eliminar</button>
      </td>
    </tr>
  `).join("");
}

// ═══ EVENT BINDING ══════════════════════════════════════════════════════════
function bindEvents() {

  // Ticket Viewer Modal
  window.__sorteo_view_ticket = async (url) => {
    const modal = document.getElementById("s-ticket-modal");
    const img = document.getElementById("s-ticket-img");
    const dl = document.getElementById("s-ticket-download");
    const cleanUrl = url.split("?")[0]; // Remove query params if any

    // Reset modal state
    img.src = "";
    img.style.opacity = "0.5";
    dl.href = "#";
    modal.style.display = "flex";

    try {
      // Fetch as blob to bypass NotSameOrigin / CORS direct embedding issues
      // Ahora usamos nuestro proxy interno, no requiere X-API-KEY
      const res = await fetch(cleanUrl);
      if (!res.ok) throw new Error("No se pudo cargar la imagen");

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      img.src = objectUrl;
      img.style.opacity = "1";
      dl.href = objectUrl;
      dl.download = "comprobante_sorteo.jpg";
    } catch (err) {
      console.error(err);
      alert("Error al intentar cargar el ticket: " + err.message);
      modal.style.display = "none";
    }
  };

  // Mode toggle shows/hides purchase row
  document.getElementById("s-mode")?.addEventListener("change", e => {
    document.getElementById("s-purchase-row").style.display =
      e.target.value === "ventas" ? "flex" : "none";
  });

  // ── PRIZES CRUD ──
  window.__sorteo_prize_edit = (i) => {
    editingPrizeIndex = i;
    const input = document.getElementById("s-prize-input");
    if (input) input.value = prizesList[i];
    document.getElementById("s-prize-save-label").textContent = "Guardar Cambio";
    document.getElementById("s-prize-save-icon").className = "fa-solid fa-floppy-disk";
    document.getElementById("s-prize-cancel-btn").style.display = "inline-flex";
    input?.focus();
  };

  window.__sorteo_prize_delete = (i) => {
    if (!confirm(`¿Eliminar el premio "${prizesList[i]}"?`)) return;
    prizesList.splice(i, 1);
    editingPrizeIndex = null;
    refreshPrizesUI();
  };

  document.getElementById("s-prize-save-btn")?.addEventListener("click", () => {
    const input = document.getElementById("s-prize-input");
    const val = input?.value.trim();
    if (!val) return;

    if (editingPrizeIndex !== null) {
      prizesList[editingPrizeIndex] = val;
      editingPrizeIndex = null;
    } else {
      prizesList.push(val);
    }
    input.value = "";
    document.getElementById("s-prize-save-label").textContent = "Agregar Premio";
    document.getElementById("s-prize-save-icon").className = "fa-solid fa-plus";
    document.getElementById("s-prize-cancel-btn").style.display = "none";
    refreshPrizesUI();
  });

  document.getElementById("s-prize-cancel-btn")?.addEventListener("click", () => {
    editingPrizeIndex = null;
    document.getElementById("s-prize-input").value = "";
    document.getElementById("s-prize-save-label").textContent = "Agregar Premio";
    document.getElementById("s-prize-save-icon").className = "fa-solid fa-plus";
    document.getElementById("s-prize-cancel-btn").style.display = "none";
  });

  // ── SAVE CONFIG ──
  document.getElementById("s-save-btn")?.addEventListener("click", async () => {
    const btn = document.getElementById("s-save-btn");
    const msg = document.getElementById("s-save-msg");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando…`;

    try {
      const newCfg = {
        ...(sorteoConfig || {}),
        title: document.getElementById("s-title")?.value || "",
        description: document.getElementById("s-desc")?.value || "",
        deadline: document.getElementById("s-deadline")?.value || "",
        mode: document.getElementById("s-mode")?.value || "clientes",
        min_purchase: parseFloat(document.getElementById("s-min-purchase")?.value) || 0,
        currency: document.getElementById("s-currency")?.value || "ARS",
        active: document.getElementById("s-active")?.checked,
        show_roulette: document.getElementById("s-show-roulette")?.checked,
        prizes: prizesList,
        winners: sorteoConfig?.winners || [],
      };
      await saveSorteoConfig(newCfg);
      sorteoConfig = newCfg;
      showMsg(msg, "success", "✅ Configuración guardada.");
    } catch (err) {
      showMsg(msg, "error", "❌ Error al guardar: " + err.message);
    }
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar`;
  });

  // ── SEARCH ──
  document.getElementById("s-search")?.addEventListener("input", e => {
    filterQ = e.target.value;
    document.getElementById("s-participants-body").innerHTML =
      renderParticipantRows(participantes);
  });

  // ── REFRESH ──
  document.getElementById("s-refresh")?.addEventListener("click", async () => {
    participantes = await loadParticipantes();
    document.getElementById("s-participants-body").innerHTML =
      renderParticipantRows(participantes);
    document.getElementById("s-count-badge").textContent = participantes.length;
  });

  // ── EXPORT CSV ──
  document.getElementById("s-export-csv")?.addEventListener("click", () =>
    exportCSV(participantes));

  // ── DELETE PARTICIPANT ──
  window.__sorteo_del_part = async (id) => {
    if (!confirm("¿Eliminar este participante?")) return;
    await deleteParticipante(id);
    participantes = participantes.filter(p => p.id !== id);
    document.getElementById("s-participants-body").innerHTML =
      renderParticipantRows(participantes);
    document.getElementById("s-count-badge").textContent = participantes.length;
  };

  // ── REALIZAR SORTEO ──
  document.getElementById("s-realizar-sorteo")?.addEventListener("click", async () => {
    const n = parseInt(document.getElementById("s-num-winners")?.value) || 1;
    if (!participantes.length) { alert("No hay participantes registrados."); return; }
    if (!confirm(`¿Realizar sorteo con ${n} ganador(es)?`)) return;
    const winners = await realizarSorteo(participantes, sorteoConfig, n);
    if (winners) {
      sorteoConfig.winners = winners;
      document.getElementById("s-current-winners").innerHTML =
        winners.map(w => `<span class="s-winner-chip">${escHtml(w)}</span>`).join("");
      document.getElementById("s-winner-box").style.display = "block";
    }
  });

  // ── RESET WINNERS ──
  document.getElementById("s-reset-winners")?.addEventListener("click", async () => {
    if (!confirm("¿Limpiar los ganadores?")) return;
    await resetSorteo(sorteoConfig, false);
    sorteoConfig.winners = [];
    document.getElementById("s-winner-box").style.display = "none";
  });

  // ── RESET ALL ──
  document.getElementById("s-reset-all")?.addEventListener("click", async () => {
    if (!confirm("⚠️ Esto borrará TODOS los participantes y ganadores. ¿Continuar?")) return;
    await resetSorteo(sorteoConfig, true);
    sorteoConfig.winners = []; participantes = [];
    document.getElementById("s-winner-box").style.display = "none";
    document.getElementById("s-participants-body").innerHTML = renderParticipantRows([]);
    document.getElementById("s-count-badge").textContent = "0";
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────
function refreshPrizesUI() {
  document.getElementById("s-prizes-table-wrap").innerHTML = renderPrizesTable();
}

function showMsg(el, type, text) {
  const ok = type === "success";
  el.style.cssText = `display:block;background:${ok ? "rgba(46,204,113,.15)" : "rgba(255,77,77,.12)"};border:1px solid ${ok ? "#2ecc71" : "#ff4d4d"};color:${ok ? "#2ecc71" : "#ff6b6b"};`;
  el.textContent = text;
  setTimeout(() => { el.style.display = "none"; }, 4000);
}

function safeJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}
function esc(str) { return String(str || "").replace(/'/g, "''"); }
function escHtml(str) { const d = document.createElement("div"); d.textContent = String(str || ""); return d.innerHTML; }
function toLocalInput(str) {
  // Convert any date string to local datetime-local format YYYY-MM-DDTHH:mm
  try { return new Date(str).toISOString().slice(0, 16); } catch { return str || ""; }
}
