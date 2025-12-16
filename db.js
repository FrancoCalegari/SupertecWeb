const fs = require("fs");
const path = require("path");
const { list, put } = require("@vercel/blob");

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_PREFIX = process.env.BLOB_PREFIX || "db/";
const BLOB_KEY = process.env.BLOB_PRODUCTS_KEY || "productos.json";
const BLOB_PATH = `${BLOB_PREFIX}${BLOB_KEY}`;
const useBlob = Boolean(BLOB_TOKEN);

const localStorePath =
	process.env.LOCAL_STORE_PATH ||
	path.join(__dirname, "var", "productos.local.json");
const seedPath = path.join(
	__dirname,
	"public",
	"assets",
	"json",
	"productos.json"
);

// ========== CACHE CONFIGURATION ==========
// Cache TTL in milliseconds (default: 5 minutes)
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 5 * 60 * 1000;

// In-memory cache structure
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
		// Cache expired
		cached.data = null;
		cached.timestamp = 0;
		return null;
	}

	console.log(
		`[CACHE HIT] ${key} - age: ${Math.round((now - cached.timestamp) / 1000)}s`
	);
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

const normalizeProducto = (p) => ({
	id: Number(p.id),
	name: p.name,
	description: p.description || "",
	precio: Number(p.precio) || 0,
	categoria: p.categoria || "",
	stock: Number(p.stock) || 0,
	marca: p.marca || "",
	modelo: p.modelo || "",
	img: p.img || "",
});

async function getBlobUrl() {
	if (!useBlob) return null;
	const { blobs } = await list({ prefix: BLOB_PATH, token: BLOB_TOKEN });
	const exact = blobs?.find((b) => b.pathname === BLOB_PATH);
	return (exact || blobs?.[0])?.url || null;
}

async function readProductos() {
	// Check cache first
	const cached = getCachedData("productos");
	if (cached !== null) return cached;

	// Cache miss - fetch from blob or local
	let data;
	if (useBlob) {
		const url = await getBlobUrl();
		if (!url) return null;
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Blob fetch status ${res.status}`);
		data = await res.json();
	} else if (fs.existsSync(localStorePath)) {
		data = JSON.parse(fs.readFileSync(localStorePath, "utf-8"));
	} else {
		return null;
	}

	// Store in cache
	setCachedData("productos", data);
	return data;
}

async function writeProductos(productos) {
	// Invalidate cache on write
	invalidateCache("productos");

	if (useBlob) {
		await put(BLOB_PATH, JSON.stringify(productos, null, 2), {
			access: "public",
			contentType: "application/json",
			token: BLOB_TOKEN,
			addRandomSuffix: false,
		});
		return;
	}

	fs.mkdirSync(path.dirname(localStorePath), { recursive: true });
	fs.writeFileSync(localStorePath, JSON.stringify(productos, null, 2));
}

async function seedFromFile() {
	if (!fs.existsSync(seedPath)) return [];
	try {
		const seed = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
		console.log(
			`[DB] Sembrando almacenamiento con ${seed.length} productos iniciales`
		);
		await writeProductos(seed);
		return seed;
	} catch (err) {
		console.error("[DB] No se pudo leer seed productos.json", err);
		return [];
	}
}

async function initDb() {
	try {
		const existing = await readProductos();
		if (existing) {
			if (useBlob) {
				console.log(
					`[DB] Conectado a Blob y datos existentes encontrados (${existing.length}) en ${BLOB_PATH}`
				);
			} else {
				console.log(
					`[DB] Con almacenamiento local en ${localStorePath} con ${existing.length} productos`
				);
			}
			return;
		}
		await seedFromFile();
		if (useBlob) {
			console.log(
				`[DB] Conectado a Blob y base inicial creada en ${BLOB_PATH}`
			);
		} else {
			console.log(`[DB] Base local inicial creada en ${localStorePath}`);
		}
	} catch (err) {
		console.error("[DB] Error inicializando almacenamiento", err);
		throw err;
	}
}

async function listProductos() {
	const productos = await readProductos();
	if (!productos) return [];
	return productos;
}

async function upsertProducto(p) {
	const productos = (await readProductos()) || [];
	let nuevo;

	if (p.id) {
		const idx = productos.findIndex((x) => x.id === p.id);
		if (idx >= 0) {
			productos[idx] = { ...productos[idx], ...normalizeProducto(p), id: p.id };
			nuevo = productos[idx];
		} else {
			nuevo = normalizeProducto(p);
			productos.push(nuevo);
		}
	} else {
		const maxId = productos.reduce((max, item) => Math.max(max, item.id), 0);
		nuevo = normalizeProducto({ ...p, id: maxId + 1 });
		productos.push(nuevo);
	}

	await writeProductos(productos);
	return nuevo;
}

async function deleteProductoById(id) {
	let productos = (await readProductos()) || [];
	const initLen = productos.length;
	productos = productos.filter((p) => p.id !== id);

	if (productos.length !== initLen) {
		await writeProductos(productos);
		return true;
	}
	return false;
}

// --- Horarios Logic ---
const BLOB_HORARIOS_KEY = process.env.BLOB_HORARIOS_KEY || "horarios.json";
const BLOB_HORARIOS_PATH = `${BLOB_PREFIX}${BLOB_HORARIOS_KEY}`;
const localHorariosPath = path.join(__dirname, "var", "horarios.json");

const DEFAULT_HORARIOS = [
	{ day: "Lunes", open: "10:00", close: "18:00", closed: false },
	{ day: "Martes", open: "10:00", close: "18:00", closed: false },
	{ day: "Miércoles", open: "10:00", close: "18:00", closed: false },
	{ day: "Jueves", open: "10:00", close: "18:00", closed: false },
	{ day: "Viernes", open: "10:00", close: "18:00", closed: false },
	{ day: "Sábado", open: "", close: "", closed: true },
	{ day: "Domingo", open: "", close: "", closed: true },
];

async function readHorarios() {
	// Check cache first
	const cached = getCachedData("horarios");
	if (cached !== null) return cached;

	// Cache miss - fetch from blob or local
	let data;
	if (useBlob) {
		const { blobs } = await list({
			prefix: BLOB_HORARIOS_PATH,
			token: BLOB_TOKEN,
		});
		const exact = blobs?.find((b) => b.pathname === BLOB_HORARIOS_PATH);
		const url = (exact || blobs?.[0])?.url;

		if (!url) {
			data = DEFAULT_HORARIOS;
		} else {
			const res = await fetch(url);
			data = res.ok ? await res.json() : DEFAULT_HORARIOS;
		}
	} else if (fs.existsSync(localHorariosPath)) {
		data = JSON.parse(fs.readFileSync(localHorariosPath, "utf-8"));
	} else {
		data = DEFAULT_HORARIOS;
	}

	// Store in cache
	setCachedData("horarios", data);
	return data;
}

async function writeHorarios(horarios) {
	// Invalidate cache on write
	invalidateCache("horarios");

	if (useBlob) {
		await put(BLOB_HORARIOS_PATH, JSON.stringify(horarios, null, 2), {
			access: "public",
			contentType: "application/json",
			token: BLOB_TOKEN,
			addRandomSuffix: false,
		});
		return;
	}

	fs.mkdirSync(path.dirname(localHorariosPath), { recursive: true });
	fs.writeFileSync(localHorariosPath, JSON.stringify(horarios, null, 2));
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
};

// --- Ventas Logic ---
const BLOB_VENTAS_KEY = process.env.BLOB_VENTAS_KEY || "ventas.json";
const BLOB_VENTAS_PATH = `${BLOB_PREFIX}${BLOB_VENTAS_KEY}`;
const localVentasPath = path.join(__dirname, "var", "ventas.local.json");

async function readVentas() {
	// Check cache first
	const cached = getCachedData("ventas");
	if (cached !== null) return cached;

	// Cache miss - fetch from blob or local
	let data;
	if (useBlob) {
		const { blobs } = await list({
			prefix: BLOB_VENTAS_PATH,
			token: BLOB_TOKEN,
		});
		const exact = blobs?.find((b) => b.pathname === BLOB_VENTAS_PATH);
		const url = (exact || blobs?.[0])?.url;
		if (!url) {
			data = [];
		} else {
			const res = await fetch(url);
			data = res.ok ? await res.json() : [];
		}
	} else if (fs.existsSync(localVentasPath)) {
		data = JSON.parse(fs.readFileSync(localVentasPath, "utf-8"));
	} else {
		data = [];
	}

	// Store in cache
	setCachedData("ventas", data);
	return data;
}

async function writeVentas(ventas) {
	// Invalidate cache on write
	invalidateCache("ventas");

	if (useBlob) {
		await put(BLOB_VENTAS_PATH, JSON.stringify(ventas, null, 2), {
			access: "public",
			contentType: "application/json",
			token: BLOB_TOKEN,
			addRandomSuffix: false,
		});
		return;
	}
	fs.mkdirSync(path.dirname(localVentasPath), { recursive: true });
	fs.writeFileSync(localVentasPath, JSON.stringify(ventas, null, 2));
}

async function listVentas() {
	return await readVentas();
}

async function upsertVenta(v) {
	const ventas = (await readVentas()) || [];
	let nuevo;

	if (v.id) {
		const idx = ventas.findIndex((x) => x.id === v.id);
		if (idx >= 0) {
			ventas[idx] = { ...ventas[idx], ...normalizeProducto(v), id: v.id };
			nuevo = ventas[idx];
		} else {
			nuevo = normalizeProducto(v);
			ventas.push(nuevo);
		}
	} else {
		const maxId = ventas.reduce((max, item) => Math.max(max, item.id), 0);
		nuevo = normalizeProducto({ ...v, id: maxId + 1 });
		ventas.push(nuevo);
	}

	await writeVentas(ventas);
	return nuevo;
}

async function deleteVentaById(id) {
	let ventas = (await readVentas()) || [];
	const initLen = ventas.length;
	ventas = ventas.filter((p) => p.id !== id);

	if (ventas.length !== initLen) {
		await writeVentas(ventas);
		return true;
	}
	return false;
}

// --- Servicios Logic ---
const BLOB_SERVICIOS_KEY = process.env.BLOB_SERVICIOS_KEY || "servicios.json";
const BLOB_SERVICIOS_PATH = `${BLOB_PREFIX}${BLOB_SERVICIOS_KEY}`;
const localServiciosPath = path.join(__dirname, "var", "servicios.local.json");

async function readServicios() {
	// Check cache first
	const cached = getCachedData("servicios");
	if (cached !== null) return cached;

	// Cache miss - fetch from blob or local
	let data;
	if (useBlob) {
		const { blobs } = await list({
			prefix: BLOB_SERVICIOS_PATH,
			token: BLOB_TOKEN,
		});
		const exact = blobs?.find((b) => b.pathname === BLOB_SERVICIOS_PATH);
		const url = (exact || blobs?.[0])?.url;
		if (!url) {
			data = [];
		} else {
			const res = await fetch(url);
			data = res.ok ? await res.json() : [];
		}
	} else if (fs.existsSync(localServiciosPath)) {
		data = JSON.parse(fs.readFileSync(localServiciosPath, "utf-8"));
	} else {
		data = [];
	}

	// Store in cache
	setCachedData("servicios", data);
	return data;
}

async function writeServicios(servicios) {
	// Invalidate cache on write
	invalidateCache("servicios");

	if (useBlob) {
		await put(BLOB_SERVICIOS_PATH, JSON.stringify(servicios, null, 2), {
			access: "public",
			contentType: "application/json",
			token: BLOB_TOKEN,
			addRandomSuffix: false,
		});
		return;
	}
	fs.mkdirSync(path.dirname(localServiciosPath), { recursive: true });
	fs.writeFileSync(localServiciosPath, JSON.stringify(servicios, null, 2));
}

async function listServicios() {
	return await readServicios();
}

async function upsertServicio(s) {
	const servicios = (await readServicios()) || [];
	let nuevo;

	if (s.id) {
		const idx = servicios.findIndex((x) => x.id === s.id);
		if (idx >= 0) {
			servicios[idx] = { ...servicios[idx], ...normalizeProducto(s), id: s.id };
			nuevo = servicios[idx];
		} else {
			nuevo = normalizeProducto(s);
			servicios.push(nuevo);
		}
	} else {
		const maxId = servicios.reduce((max, item) => Math.max(max, item.id), 0);
		nuevo = normalizeProducto({ ...s, id: maxId + 1 });
		servicios.push(nuevo);
	}

	await writeServicios(servicios);
	return nuevo;
}

async function deleteServicioById(id) {
	let servicios = (await readServicios()) || [];
	const initLen = servicios.length;
	servicios = servicios.filter((p) => p.id !== id);

	if (servicios.length !== initLen) {
		await writeServicios(servicios);
		return true;
	}
	return false;
}

// --- Bulk & Clear Logic ---
async function saveAllProductos(data) {
	await writeProductos(data);
}
async function clearProductos() {
	await writeProductos([]);
}

async function saveAllVentas(data) {
	await writeVentas(data);
}
async function clearVentas() {
	await writeVentas([]);
}

async function saveAllServicios(data) {
	await writeServicios(data);
}
async function clearServicios() {
	await writeServicios([]);
}

async function saveAllHorarios(data) {
	await writeHorarios(data);
}
async function clearHorarios() {
	await writeHorarios(DEFAULT_HORARIOS); // Reset to default instead of empty
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
