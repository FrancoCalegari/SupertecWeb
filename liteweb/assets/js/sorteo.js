/**
 * sorteo.js — Supertec Sorteo (Raffle) Public Page
 * Uses Spider API / MariaDB (dev: http://192.168.100.164:3006)
 */

// ─── CONFIG (Obfuscated) ───────────────────────────────────────────────────
const SPIDER_PROXY_API = "/api/spider-proxy";

// Simple obfuscator to hide plaintext from casual source code viewers
const _dx = (s) => atob(s.split('').reverse().join(''));

const DB_NAME = _dx("jVGdyVGc1N3XpJXYnVGbhNEIvNmbhJnRfd3c");

// ─── SPIDER API HELPER ─────────────────────────────────────────────────────
// Response shape: { success: true, result: [...rows] } for SELECT
//                 { success: true, result: { affectedRows, ... } } for writes
async function spiderQuery(sql, silent = false) {
    try {
        const res = await fetch(`${SPIDER_PROXY_API}/query`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ database: DB_NAME, query: sql }),
        });
        const data = await res.json();
        if (!data.success) {
            if (!silent) console.error("Spider SQL error:", data.message || data.error, "\nQuery:", sql);
            return null;
        }
        return data; // data.result = array (SELECT) or object (write)
    } catch (err) {
        if (!silent) console.error("Spider fetch error:", err);
        return null;
    }
}

// Convenience: returns rows array for SELECT queries
async function spiderSelect(sql) {
    const data = await spiderQuery(sql);
    if (!data || !Array.isArray(data.result)) return [];
    return data.result;
}

// ─── DB INIT ───────────────────────────────────────────────────────────────
let dbReady = false;
async function initDatabase() {
    if (dbReady) return;
    await spiderQuery(`
    CREATE TABLE IF NOT EXISTS sorteo_config (
      id INT PRIMARY KEY,
      title TEXT,
      description TEXT,
      prizes TEXT,
      deadline TEXT,
      mode VARCHAR(20) DEFAULT 'clientes',
      min_purchase DECIMAL(10,2) DEFAULT 0,
      currency VARCHAR(5) DEFAULT 'ARS',
      active TINYINT DEFAULT 1,
      show_roulette TINYINT DEFAULT 0,
      winners TEXT
    )
  `);
    await spiderQuery(`
    INSERT IGNORE INTO sorteo_config
      (id, title, description, prizes, deadline, mode, min_purchase, currency, active, show_roulette, winners)
    VALUES
      (1, 'Gran Sorteo Supertec', '', '[]', '', 'clientes', 0, 'ARS', 1, 0, '[]')
  `);
    await spiderQuery(`
    CREATE TABLE IF NOT EXISTS sorteo_participantes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      instagram VARCHAR(100) NOT NULL,
      telefono VARCHAR(50) NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      monto_compra DECIMAL(10,2) DEFAULT 0,
      created_at DATETIME DEFAULT NOW()
    )
  `);
    dbReady = true;
}

// ─── LOAD CONFIG ──────────────────────────────────────────────────────────
export async function loadConfig() {
    await initDatabase();
    const rows = await spiderSelect("SELECT * FROM sorteo_config WHERE id = 1");
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return {
        ...row,
        prizes: safeParseJSON(row.prizes, []),
        winners: safeParseJSON(row.winners, []),
        active: Boolean(Number(row.active)),
        show_roulette: Boolean(Number(row.show_roulette)),
    };
}

// ─── REGISTER PARTICIPANT ──────────────────────────────────────────────────
export async function checkDuplicate(instagram) {
    const clean = instagram.replace(/^@/, "").toLowerCase();
    const rows = await spiderSelect(
        `SELECT id FROM sorteo_participantes WHERE LOWER(instagram) = '${esc(clean)}' LIMIT 1`
    );
    return rows.length > 0;
}

// ─── UPLOAD TICKET IMAGE ──────────────────────────────────────────────────
export async function uploadTicket(file) {
    // Returns public URL string or null on failure
    const form = new FormData();
    form.append("files", file);
    try {
        const res = await fetch(`${SPIDER_PROXY_API}/upload`, {
            method: "POST",
            body: form,
        });
        const data = await res.json();
        // Fallbacks based on typical Spider API response formats
        let fileId = null;
        if (data.files && data.files.length && data.files[0].id) fileId = data.files[0].id;
        else if (data.data && data.data.files && data.data.files[0] && data.data.files[0].id) fileId = data.data.files[0].id;
        else if (Array.isArray(data) && data[0] && data[0].id) fileId = data[0].id;
        else if (data.id) fileId = data.id;

        if (!fileId) return null;

        // Utilizamos nuestro propio proxy para evitar Mixed Content al traer la imagen
        return `/api/spider-proxy/file/${fileId}`;
    } catch (err) {
        console.error("uploadTicket error:", err);
        return null;
    }
}

export async function registerParticipant({ instagram, telefono, nombre, ticket_url }) {
    const ig = instagram.startsWith("@") ? instagram : "@" + instagram;
    const data = await spiderQuery(`
    INSERT INTO sorteo_participantes (instagram, telefono, nombre, ticket_url)
    VALUES ('${esc(ig)}', '${esc(telefono)}', '${esc(nombre)}', '${esc(ticket_url || '')}')
  `);
    return data !== null && data.success;
}

export async function getParticipants() {
    return await spiderSelect("SELECT * FROM sorteo_participantes ORDER BY created_at DESC");
}

// ─── HELPERS ──────────────────────────────────────────────────────────────
function safeParseJSON(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
}
function esc(str) { return String(str).replace(/'/g, "''"); }

// ─── COUNTDOWN ────────────────────────────────────────────────────────────
export function startCountdown(deadlineStr, onExpire) {
    const el = document.getElementById("countdown-display");
    if (!el) return;
    function tick() {
        const diff = new Date(deadlineStr) - new Date();
        if (diff <= 0) {
            el.innerHTML = `<span class="countdown-expired">¡Tiempo agotado!</span>`;
            if (onExpire) onExpire();
            return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff / 3600000) % 24);
        const m = Math.floor((diff / 60000) % 60);
        const s = Math.floor((diff / 1000) % 60);
        const pad = n => String(n).padStart(2, "0");
        el.innerHTML = `
      <div class="countdown-unit"><span>${pad(d)}</span><label>Días</label></div>
      <div class="countdown-sep">:</div>
      <div class="countdown-unit"><span>${pad(h)}</span><label>Horas</label></div>
      <div class="countdown-sep">:</div>
      <div class="countdown-unit"><span>${pad(m)}</span><label>Min</label></div>
      <div class="countdown-sep">:</div>
      <div class="countdown-unit"><span>${pad(s)}</span><label>Seg</label></div>
    `;
        setTimeout(tick, 1000);
    }
    tick();
}

// ─── ROULETTE ANIMATION ───────────────────────────────────────────────────
export function initRoulette(participants, winners) {
    const canvas = document.getElementById("roulette-canvas");
    const spinBtn = document.getElementById("spin-btn");
    const winnerDisplay = document.getElementById("winner-display");
    if (!canvas || !spinBtn) return;

    const ctx = canvas.getContext("2d");
    const names = participants.map(p => p.instagram || p.nombre);

    if (names.length === 0) {
        spinBtn.disabled = true;
        spinBtn.textContent = "Sin participantes";
        return;
    }

    const totalSlices = names.length;
    const sliceAngle = (2 * Math.PI) / totalSlices;
    const colors = [
        "#fb383a", "#e74c3c", "#c0392b", "#ff6b6b", "#ff8e53",
        "#ffc107", "#ff9800", "#9b59b6", "#8e44ad", "#3498db",
        "#2980b9", "#1abc9c", "#16a085",
    ];

    let currentAngle = 0, spinning = false;

    function drawWheel(rotation) {
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const radius = Math.min(cx, cy) - 10;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Glow ring
        const grd = ctx.createRadialGradient(cx, cy, radius - 10, cx, cy, radius + 5);
        grd.addColorStop(0, "rgba(251,56,58,0.5)");
        grd.addColorStop(1, "rgba(251,56,58,0)");
        ctx.beginPath(); ctx.arc(cx, cy, radius + 5, 0, 2 * Math.PI);
        ctx.fillStyle = grd; ctx.fill();

        for (let i = 0; i < totalSlices; i++) {
            const start = rotation + i * sliceAngle, end = start + sliceAngle;
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, start, end); ctx.closePath();
            ctx.fillStyle = colors[i % colors.length]; ctx.fill();
            ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1; ctx.stroke();

            ctx.save(); ctx.translate(cx, cy); ctx.rotate(start + sliceAngle / 2);
            ctx.textAlign = "right"; ctx.fillStyle = "#fff";
            ctx.font = `bold ${Math.max(10, Math.min(14, 200 / totalSlices))}px Inter, sans-serif`;
            ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 4;
            const label = names[i].length > 14 ? names[i].slice(0, 13) + "…" : names[i];
            ctx.fillText(label, radius - 10, 5); ctx.restore();
        }

        // Center circle
        ctx.beginPath(); ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
        cg.addColorStop(0, "#444"); cg.addColorStop(1, "#111");
        ctx.fillStyle = cg; ctx.fill();
        ctx.strokeStyle = "#fb383a"; ctx.lineWidth = 3; ctx.stroke();

        // Pointer
        ctx.beginPath(); ctx.moveTo(cx, 2); ctx.lineTo(cx - 14, 30); ctx.lineTo(cx + 14, 30);
        ctx.closePath(); ctx.fillStyle = "#fb383a"; ctx.fill();
        ctx.shadowColor = "rgba(251,56,58,0.8)"; ctx.shadowBlur = 10; ctx.stroke();
        ctx.shadowBlur = 0;
    }

    drawWheel(0);

    if (winners && winners.length > 0 && winnerDisplay) {
        winnerDisplay.innerHTML = `<div class="winner-badge">🏆 Ganador: ${winners.join(", ")}</div>`;
        winnerDisplay.style.display = "block";
    }

    spinBtn.addEventListener("click", () => {
        if (spinning) return;
        spinning = true; spinBtn.disabled = true; spinBtn.textContent = "Girando...";
        if (winnerDisplay) winnerDisplay.style.display = "none";

        // Try to pick the exact winner from the array passed from DB config
        let winnerIndex = 0;
        if (winners && winners.length > 0) {
            const targetWinner = winners[0];
            const foundIndex = names.findIndex(n => n === targetWinner || n.includes(targetWinner) || targetWinner.includes(n));
            if (foundIndex !== -1) winnerIndex = foundIndex;
        } else {
            // Fallback just in case, though HTML should hide the button
            winnerIndex = Math.floor(Math.random() * totalSlices);
        }

        const fullSpins = Math.floor(5 + Math.random() * 5) * 2 * Math.PI;
        const targetAngle = -(winnerIndex * sliceAngle + sliceAngle / 2) - Math.PI / 2;
        const totalRot = fullSpins + ((targetAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

        let start = null;
        function easeOut(t) { return 1 - Math.pow(1 - t, 4); }
        function animate(ts) {
            if (!start) start = ts;
            const progress = Math.min((ts - start) / 5000, 1);
            currentAngle = easeOut(progress) * totalRot;
            drawWheel(currentAngle);
            if (progress < 1) { requestAnimationFrame(animate); return; }
            spinning = false; spinBtn.disabled = false; spinBtn.textContent = "🎰 Girar de Nuevo";
            const winnerName = names[winnerIndex];
            if (winnerDisplay) {
                winnerDisplay.innerHTML = `<div class="winner-badge">🏆 ¡Ganador Confirmado: <strong>${winnerName}</strong>!</div>`;
                winnerDisplay.style.display = "block";
                launchConfetti();
            }
        }
        requestAnimationFrame(animate);
    });
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────
function launchConfetti() {
    for (let i = 0; i < 120; i++) {
        const el = document.createElement("div");
        el.className = "confetti-piece";
        el.style.cssText = `left:${Math.random() * 100}vw;top:-10px;background:hsl(${Math.random() * 360},80%,60%);width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px;animation-delay:${Math.random() * 2}s;animation-duration:${2 + Math.random() * 3}s;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 5000);
    }
}

// (QR Code feature removed by user request)

export function printPoster() { window.print(); }
