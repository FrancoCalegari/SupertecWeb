// db.js - SpiderWebAPI backend (MariaDB via REST)
const SPIDER_API_BASE = process.env.SPIDERWEB_API_BASE || "https://spiderwebargapi.com.ar/api/v1";
const SPIDER_API_KEY = process.env.SPIDERWEB_API_KEY || "c90d1502ce815ea5d1108662186145d3cefe642586466c769d4c7fae63086ac6";
const SPIDER_DB = process.env.SPIDERWEB_DB_NAME || "sw_Franco Calegari_supertec";

if (!SPIDER_API_KEY) {
	console.error("[DB] SPIDERWEB_API_KEY must be set");
}

// ========== CACHE CONFIGURATION ==========
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 5 * 60 * 1000;

const cache = {
	productos: { data: null, timestamp: 0 },
	ventas: { data: null, timestamp: 0 },
	servicios: { data: null, timestamp: 0 },
	horarios: { data: null, timestamp: 0 },
};

function getCachedData(key) {
	const cached = cache[key];
	if (!cached.data) return null;
	const now = Date.now();
	if (now - cached.timestamp > CACHE_TTL) {
		cached.data = null;
		cached.timestamp = 0;
		return null;
	}
	console.log(`[CACHE HIT] ${key} - age: ${Math.round((now - cached.timestamp) / 1000)}s`);
	return cached.data;
}

function setCachedData(key, data) {
	cache[key].data = data;
	cache[key].timestamp = Date.now();
	console.log(`[CACHE SET] ${key}`);
}

function invalidateCache(key) {
	cache[key].data = null;
	cache[key].timestamp = 0;
	console.log(`[CACHE INVALIDATE] ${key}`);
}
// ========== END CACHE CONFIGURATION ==========

// Core SQL helper - centralizes all API calls
async function spiderQuery(sql) {
	const res = await fetch(`${SPIDER_API_BASE}/query`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-API-KEY": SPIDER_API_KEY,
		},
		body: JSON.stringify({ database: SPIDER_DB, query: sql }),
	});
	const data = await res.json();
	if (data.error) {
		throw new Error(`[SpiderDB] ${data.error}: ${data.message || ""}`);
	}
	return data.result;
}

// Escapes a value safely for SQL string insertion
function esc(val) {
	if (val === null || val === undefined) return "NULL";
	return `'${String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

const normalizeProducto = (p) => ({
	...(p.id ? { id: Number(p.id) } : {}),
	name: p.name,
	description: p.description || "",
	precio: Number(p.precio) || 0,
	categoria: p.categoria || "",
	stock: Number(p.stock) || 0,
	marca: p.marca || "",
	modelo: p.modelo || "",
	img: p.img || "",
});

// ========== INITIALIZATION ==========
async function initDb() {
	try {
		await spiderQuery("SELECT 1");
		console.log("[DB] SpiderWebAPI connection OK");
	} catch (err) {
		console.error("[DB] SpiderWebAPI connection failed:", err.message);
		throw err;
	}
}

// ========== PRODUCTOS ==========
async function readProductos() {
	const cached = getCachedData("productos");
	if (cached !== null) return cached;

	const rows = await spiderQuery("SELECT * FROM productos ORDER BY id ASC");
	const data = (rows || []).map(normalizeProducto);
	setCachedData("productos", data);
	return data;
}

async function listProductos() {
	return await readProductos();
}

async function upsertProducto(p) {
	invalidateCache("productos");
	const prod = normalizeProducto(p);

	if (p.id) {
		await spiderQuery(
			`UPDATE productos SET name=${esc(prod.name)}, description=${esc(prod.description)}, precio=${prod.precio}, categoria=${esc(prod.categoria)}, stock=${prod.stock}, marca=${esc(prod.marca)}, modelo=${esc(prod.modelo)}, img=${esc(prod.img)} WHERE id=${p.id}`
		);
		const rows = await spiderQuery(`SELECT * FROM productos WHERE id=${p.id} LIMIT 1`);
		return normalizeProducto(rows[0]);
	} else {
		const result = await spiderQuery(
			`INSERT INTO productos (name, description, precio, categoria, stock, marca, modelo, img) VALUES (${esc(prod.name)}, ${esc(prod.description)}, ${prod.precio}, ${esc(prod.categoria)}, ${prod.stock}, ${esc(prod.marca)}, ${esc(prod.modelo)}, ${esc(prod.img)})`
		);
		const newId = result.insertId;
		const rows = await spiderQuery(`SELECT * FROM productos WHERE id=${newId} LIMIT 1`);
		return normalizeProducto(rows[0]);
	}
}

async function deleteProductoById(id) {
	invalidateCache("productos");
	await spiderQuery(`DELETE FROM productos WHERE id=${id}`);
	return true;
}

// ========== HORARIOS ==========
const DEFAULT_HORARIOS = [
	{ id: 1, day: "Lunes", open: "10:00", close: "18:00", closed: false },
	{ id: 2, day: "Martes", open: "10:00", close: "18:00", closed: false },
	{ id: 3, day: "Miércoles", open: "10:00", close: "18:00", closed: false },
	{ id: 4, day: "Jueves", open: "10:00", close: "18:00", closed: false },
	{ id: 5, day: "Viernes", open: "10:00", close: "18:00", closed: false },
	{ id: 6, day: "Sábado", open: "", close: "", closed: true },
	{ id: 7, day: "Domingo", open: "", close: "", closed: true },
];

async function readHorarios() {
	const cached = getCachedData("horarios");
	if (cached !== null) return cached;

	const rows = await spiderQuery("SELECT * FROM horarios ORDER BY id ASC");
	const data = rows && rows.length > 0
		? rows.map((h) => ({ ...h, closed: !!h.closed }))
		: DEFAULT_HORARIOS;
	setCachedData("horarios", data);
	return data;
}

async function writeHorarios(horarios) {
	invalidateCache("horarios");
	for (const h of horarios) {
		await spiderQuery(
			`UPDATE horarios SET \`open\`=${esc(h.open)}, \`close\`=${esc(h.close)}, closed=${h.closed ? 1 : 0} WHERE day=${esc(h.day)}`
		);
	}
}

// ========== VENTAS ==========
async function readVentas() {
	const cached = getCachedData("ventas");
	if (cached !== null) return cached;

	const rows = await spiderQuery("SELECT * FROM ventas ORDER BY id ASC");
	const data = (rows || []).map(normalizeProducto);
	setCachedData("ventas", data);
	return data;
}

async function listVentas() {
	return await readVentas();
}

async function upsertVenta(v) {
	invalidateCache("ventas");
	const venta = normalizeProducto(v);

	if (v.id) {
		await spiderQuery(
			`UPDATE ventas SET name=${esc(venta.name)}, description=${esc(venta.description)}, precio=${venta.precio}, categoria=${esc(venta.categoria)}, stock=${venta.stock}, marca=${esc(venta.marca)}, modelo=${esc(venta.modelo)}, img=${esc(venta.img)} WHERE id=${v.id}`
		);
		const rows = await spiderQuery(`SELECT * FROM ventas WHERE id=${v.id} LIMIT 1`);
		return normalizeProducto(rows[0]);
	} else {
		const result = await spiderQuery(
			`INSERT INTO ventas (name, description, precio, categoria, stock, marca, modelo, img) VALUES (${esc(venta.name)}, ${esc(venta.description)}, ${venta.precio}, ${esc(venta.categoria)}, ${venta.stock}, ${esc(venta.marca)}, ${esc(venta.modelo)}, ${esc(venta.img)})`
		);
		const newId = result.insertId;
		const rows = await spiderQuery(`SELECT * FROM ventas WHERE id=${newId} LIMIT 1`);
		return normalizeProducto(rows[0]);
	}
}

async function deleteVentaById(id) {
	invalidateCache("ventas");
	await spiderQuery(`DELETE FROM ventas WHERE id=${id}`);
	return true;
}

// ========== SERVICIOS ==========
async function readServicios() {
	const cached = getCachedData("servicios");
	if (cached !== null) return cached;

	const rows = await spiderQuery("SELECT * FROM servicios ORDER BY id ASC");
	const data = (rows || []).map(normalizeProducto);
	setCachedData("servicios", data);
	return data;
}

async function listServicios() {
	return await readServicios();
}

async function upsertServicio(s) {
	invalidateCache("servicios");
	const servicio = normalizeProducto(s);

	if (s.id) {
		await spiderQuery(
			`UPDATE servicios SET name=${esc(servicio.name)}, description=${esc(servicio.description)}, precio=${servicio.precio}, categoria=${esc(servicio.categoria)}, stock=${servicio.stock}, marca=${esc(servicio.marca)}, modelo=${esc(servicio.modelo)}, img=${esc(servicio.img)} WHERE id=${s.id}`
		);
		const rows = await spiderQuery(`SELECT * FROM servicios WHERE id=${s.id} LIMIT 1`);
		return normalizeProducto(rows[0]);
	} else {
		const result = await spiderQuery(
			`INSERT INTO servicios (name, description, precio, categoria, stock, marca, modelo, img) VALUES (${esc(servicio.name)}, ${esc(servicio.description)}, ${servicio.precio}, ${esc(servicio.categoria)}, ${servicio.stock}, ${esc(servicio.marca)}, ${esc(servicio.modelo)}, ${esc(servicio.img)})`
		);
		const newId = result.insertId;
		const rows = await spiderQuery(`SELECT * FROM servicios WHERE id=${newId} LIMIT 1`);
		return normalizeProducto(rows[0]);
	}
}

async function deleteServicioById(id) {
	invalidateCache("servicios");
	await spiderQuery(`DELETE FROM servicios WHERE id=${id}`);
	return true;
}

// ========== BULK & CLEAR OPERATIONS ==========
async function saveAllProductos(data) {
	invalidateCache("productos");
	await spiderQuery("DELETE FROM productos WHERE id > 0");
	for (const p of data) {
		const prod = normalizeProducto(p);
		await spiderQuery(
			`INSERT INTO productos (name, description, precio, categoria, stock, marca, modelo, img) VALUES (${esc(prod.name)}, ${esc(prod.description)}, ${prod.precio}, ${esc(prod.categoria)}, ${prod.stock}, ${esc(prod.marca)}, ${esc(prod.modelo)}, ${esc(prod.img)})`
		);
	}
}

async function clearProductos() {
	invalidateCache("productos");
	await spiderQuery("DELETE FROM productos WHERE id > 0");
}

async function saveAllVentas(data) {
	invalidateCache("ventas");
	await spiderQuery("DELETE FROM ventas WHERE id > 0");
	for (const v of data) {
		const venta = normalizeProducto(v);
		await spiderQuery(
			`INSERT INTO ventas (name, description, precio, categoria, stock, marca, modelo, img) VALUES (${esc(venta.name)}, ${esc(venta.description)}, ${venta.precio}, ${esc(venta.categoria)}, ${venta.stock}, ${esc(venta.marca)}, ${esc(venta.modelo)}, ${esc(venta.img)})`
		);
	}
}

async function clearVentas() {
	invalidateCache("ventas");
	await spiderQuery("DELETE FROM ventas WHERE id > 0");
}

async function saveAllServicios(data) {
	invalidateCache("servicios");
	await spiderQuery("DELETE FROM servicios WHERE id > 0");
	for (const s of data) {
		const serv = normalizeProducto(s);
		await spiderQuery(
			`INSERT INTO servicios (name, description, precio, categoria, stock, marca, modelo, img) VALUES (${esc(serv.name)}, ${esc(serv.description)}, ${serv.precio}, ${esc(serv.categoria)}, ${serv.stock}, ${esc(serv.marca)}, ${esc(serv.modelo)}, ${esc(serv.img)})`
		);
	}
}

async function clearServicios() {
	invalidateCache("servicios");
	await spiderQuery("DELETE FROM servicios WHERE id > 0");
}

async function saveAllHorarios(data) {
	invalidateCache("horarios");
	for (const h of data) {
		await spiderQuery(
			`UPDATE horarios SET \`open\`=${esc(h.open)}, \`close\`=${esc(h.close)}, closed=${h.closed ? 1 : 0} WHERE day=${esc(h.day)}`
		);
	}
}

async function clearHorarios() {
	invalidateCache("horarios");
	for (const h of DEFAULT_HORARIOS) {
		await spiderQuery(
			`UPDATE horarios SET \`open\`=${esc(h.open)}, \`close\`=${esc(h.close)}, closed=${h.closed ? 1 : 0} WHERE day=${esc(h.day)}`
		);
	}
}

module.exports = {
	initDb,
	listProductos,
	upsertProducto,
	deleteProductoById,
	readHorarios,
	writeHorarios,
	// Ventas
	listVentas,
	upsertVenta,
	deleteVentaById,
	// Servicios
	listServicios,
	upsertServicio,
	deleteServicioById,
	// Bulk & Clear
	saveAllProductos,
	clearProductos,
	saveAllVentas,
	clearVentas,
	saveAllServicios,
	clearServicios,
	saveAllHorarios,
	clearHorarios,
};
