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
	categorias: { data: null, timestamp: 0 },
	pedidos: { data: null, timestamp: 0 },
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
	descuento: Number(p.descuento) || 0,
	precio_original: p.precio_original ? Number(p.precio_original) : null,
	destacado: p.destacado ? 1 : 0,
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
			`UPDATE productos SET name=${esc(prod.name)}, description=${esc(prod.description)}, precio=${prod.precio}, categoria=${esc(prod.categoria)}, stock=${prod.stock}, marca=${esc(prod.marca)}, modelo=${esc(prod.modelo)}, img=${esc(prod.img)}, descuento=${prod.descuento}, destacado=${prod.destacado} WHERE id=${p.id}`
		);
		const rows = await spiderQuery(`SELECT * FROM productos WHERE id=${p.id} LIMIT 1`);
		return normalizeProducto(rows[0]);
	} else {
		const result = await spiderQuery(
			`INSERT INTO productos (name, description, precio, categoria, stock, marca, modelo, img, descuento, destacado) VALUES (${esc(prod.name)}, ${esc(prod.description)}, ${prod.precio}, ${esc(prod.categoria)}, ${prod.stock}, ${esc(prod.marca)}, ${esc(prod.modelo)}, ${esc(prod.img)}, ${prod.descuento}, ${prod.destacado})`
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
			`INSERT INTO productos (name, description, precio, categoria, stock, marca, modelo, img, descuento, destacado) VALUES (${esc(prod.name)}, ${esc(prod.description)}, ${prod.precio}, ${esc(prod.categoria)}, ${prod.stock}, ${esc(prod.marca)}, ${esc(prod.modelo)}, ${esc(prod.img)}, ${prod.descuento}, ${prod.destacado})`
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

// ========== CATEGORIAS ==========
async function listCategorias() {
	const cached = getCachedData("categorias");
	if (cached !== null) return cached;
	try {
		const rows = await spiderQuery("SELECT * FROM categorias ORDER BY orden ASC, id ASC");
		const data = (rows || []).map(c => ({
			id: Number(c.id),
			nombre: c.nombre,
			slug: c.slug,
			descripcion: c.descripcion || "",
			icono: c.icono || "fa-tag",
			color: c.color || "#fb383a",
			filtros: c.filtros ? (typeof c.filtros === 'string' ? JSON.parse(c.filtros) : c.filtros) : {},
			activa: !!c.activa,
			orden: Number(c.orden) || 0,
		}));
		setCachedData("categorias", data);
		return data;
	} catch (err) {
		console.error("[DB] Error listando categorias:", err.message);
		return [];
	}
}

async function upsertCategoria(c) {
	invalidateCache("categorias");
	const filtrosStr = esc(JSON.stringify(c.filtros || {}));
	if (c.id) {
		await spiderQuery(
			`UPDATE categorias SET nombre=${esc(c.nombre)}, slug=${esc(c.slug)}, descripcion=${esc(c.descripcion || '')}, icono=${esc(c.icono || 'fa-tag')}, color=${esc(c.color || '#fb383a')}, filtros=${filtrosStr}, activa=${c.activa ? 1 : 0}, orden=${Number(c.orden) || 0} WHERE id=${c.id}`
		);
		const rows = await spiderQuery(`SELECT * FROM categorias WHERE id=${c.id} LIMIT 1`);
		if (!rows || !rows[0]) throw new Error("Categoria no encontrada post-update");
		return rows[0];
	} else {
		const result = await spiderQuery(
			`INSERT INTO categorias (nombre, slug, descripcion, icono, color, filtros, activa, orden) VALUES (${esc(c.nombre)}, ${esc(c.slug)}, ${esc(c.descripcion || '')}, ${esc(c.icono || 'fa-tag')}, ${esc(c.color || '#fb383a')}, ${filtrosStr}, ${c.activa ? 1 : 0}, ${Number(c.orden) || 0})`
		);
		const newId = result.insertId;
		const rows = await spiderQuery(`SELECT * FROM categorias WHERE id=${newId} LIMIT 1`);
		return rows[0];
	}
}

async function deleteCategoriaById(id) {
	invalidateCache("categorias");
	await spiderQuery(`DELETE FROM categorias WHERE id=${id}`);
	return true;
}

// ========== PEDIDOS ==========
function generateCodigoSeguimiento() {
	const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
	const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
	return `SUP-${fecha}-${rand}`;
}

const normalizePedido = (p) => ({
	id: Number(p.id),
	mp_preference_id: p.mp_preference_id || null,
	mp_payment_id: p.mp_payment_id || null,
	mp_status: p.mp_status || null,
	estado: p.estado || 'pendiente',
	cliente_nombre: p.cliente_nombre || '',
	cliente_email: p.cliente_email || '',
	cliente_telefono: p.cliente_telefono || '',
	envio_calle: p.envio_calle || '',
	envio_ciudad: p.envio_ciudad || '',
	envio_provincia: p.envio_provincia || '',
	envio_cp: p.envio_cp || '',
	envio_notas: p.envio_notas || '',
	items: typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []),
	total: Number(p.total) || 0,
	codigo_seguimiento: p.codigo_seguimiento || null,
	tracking_empresa: p.tracking_empresa || '',
	tracking_numero: p.tracking_numero || '',
	tracking_url: p.tracking_url || '',
	notas_admin: p.notas_admin || '',
	created_at: p.created_at || null,
	updated_at: p.updated_at || null,
});

async function listPedidos(filtroEstado = '') {
	invalidateCache("pedidos"); // siempre fresco para admin
	let sql = "SELECT * FROM pedidos ORDER BY created_at DESC";
	if (filtroEstado) sql = `SELECT * FROM pedidos WHERE estado=${esc(filtroEstado)} ORDER BY created_at DESC`;
	const rows = await spiderQuery(sql);
	return (rows || []).map(normalizePedido);
}

async function getPedidoById(id) {
	const rows = await spiderQuery(`SELECT * FROM pedidos WHERE id=${id} LIMIT 1`);
	if (!rows || !rows[0]) return null;
	return normalizePedido(rows[0]);
}

async function getPedidoByCodigo(codigo) {
	const rows = await spiderQuery(`SELECT * FROM pedidos WHERE codigo_seguimiento=${esc(codigo)} LIMIT 1`);
	if (!rows || !rows[0]) return null;
	return normalizePedido(rows[0]);
}

async function createPedido(p) {
	invalidateCache("pedidos");
	const codigo = generateCodigoSeguimiento();
	const itemsStr = esc(JSON.stringify(p.items || []));
	const result = await spiderQuery(
		`INSERT INTO pedidos (mp_preference_id, mp_status, estado, cliente_nombre, cliente_email, cliente_telefono, envio_calle, envio_ciudad, envio_provincia, envio_cp, envio_notas, items, total, codigo_seguimiento) VALUES (${esc(p.mp_preference_id || null)}, 'pending', 'pendiente', ${esc(p.cliente_nombre)}, ${esc(p.cliente_email)}, ${esc(p.cliente_telefono || '')}, ${esc(p.envio_calle || '')}, ${esc(p.envio_ciudad || '')}, ${esc(p.envio_provincia || '')}, ${esc(p.envio_cp || '')}, ${esc(p.envio_notas || '')}, ${itemsStr}, ${Number(p.total) || 0}, ${esc(codigo)})`
	);
	const newId = result.insertId;
	const rows = await spiderQuery(`SELECT * FROM pedidos WHERE id=${newId} LIMIT 1`);
	return normalizePedido(rows[0]);
}

async function updatePedidoEstado(id, estado, trackingData = {}) {
	invalidateCache("pedidos");
	const { empresa, numero, url, notas, mp_payment_id, mp_status } = trackingData;
	let setParts = [`estado=${esc(estado)}`];
	if (empresa !== undefined) setParts.push(`tracking_empresa=${esc(empresa || '')}`);
	if (numero !== undefined) setParts.push(`tracking_numero=${esc(numero || '')}`);
	if (url !== undefined) setParts.push(`tracking_url=${esc(url || '')}`);
	if (notas !== undefined) setParts.push(`notas_admin=${esc(notas || '')}`);
	if (mp_payment_id) setParts.push(`mp_payment_id=${esc(mp_payment_id)}`);
	if (mp_status) setParts.push(`mp_status=${esc(mp_status)}`);
	await spiderQuery(`UPDATE pedidos SET ${setParts.join(', ')} WHERE id=${id}`);
	return getPedidoById(id);
}

async function updatePedidoMpStatus(preferenceId, paymentId, mpStatus) {
	invalidateCache("pedidos");
	await spiderQuery(
		`UPDATE pedidos SET mp_payment_id=${esc(paymentId)}, mp_status=${esc(mpStatus)}, estado=${esc(mpStatus === 'approved' ? 'confirmado' : mpStatus === 'rejected' ? 'cancelado' : 'pendiente')} WHERE mp_preference_id=${esc(preferenceId)}`
	);
	const rows = await spiderQuery(`SELECT * FROM pedidos WHERE mp_preference_id=${esc(preferenceId)} LIMIT 1`);
	return rows && rows[0] ? normalizePedido(rows[0]) : null;
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
	// Categorias
	listCategorias,
	upsertCategoria,
	deleteCategoriaById,
	// Pedidos
	listPedidos,
	getPedidoById,
	getPedidoByCodigo,
	createPedido,
	updatePedidoEstado,
	updatePedidoMpStatus,
	generateCodigoSeguimiento,
};
