const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Initialize Supabase client
// Use service role key for admin operations (bypasses RLS)
const supabase = SUPABASE_SERVICE_KEY
	? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
	: SUPABASE_ANON_KEY
	? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
	: null;

if (!supabase) {
	console.error(
		"[DB] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be set"
	);
}

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

// ========== INITIALIZATION ==========
async function initDb() {
	if (!supabase) {
		console.error("[DB] Supabase client not initialized");
		throw new Error("Supabase client not initialized");
	}
	console.log("[DB] Supabase client initialized successfully");
}

// ========== PRODUCTOS ==========
async function readProductos() {
	// Check cache first
	const cached = getCachedData("productos");
	if (cached !== null) return cached;

	// Cache miss - fetch from Supabase
	const { data, error } = await supabase
		.from("productos")
		.select("*")
		.order("id", { ascending: true });

	if (error) {
		console.error("[DB] Error reading productos:", error);
		return [];
	}

	// Store in cache
	setCachedData("productos", data || []);
	return data || [];
}

async function listProductos() {
	return await readProductos();
}

async function upsertProducto(p) {
	invalidateCache("productos");

	const producto = normalizeProducto(p);

	if (p.id) {
		// Update existing
		const { data, error } = await supabase
			.from("productos")
			.update(producto)
			.eq("id", p.id)
			.select()
			.single();

		if (error) {
			console.error("[DB] Error updating producto:", error);
			throw error;
		}
		return data;
	} else {
		// Insert new
		const { data, error } = await supabase
			.from("productos")
			.insert([producto])
			.select()
			.single();

		if (error) {
			console.error("[DB] Error inserting producto:", error);
			throw error;
		}
		return data;
	}
}

async function deleteProductoById(id) {
	invalidateCache("productos");

	const { error } = await supabase.from("productos").delete().eq("id", id);

	if (error) {
		console.error("[DB] Error deleting producto:", error);
		return false;
	}
	return true;
}

// ========== HORARIOS ==========
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

	// Cache miss - fetch from Supabase
	const { data, error } = await supabase
		.from("horarios")
		.select("*")
		.order("id", { ascending: true });

	if (error) {
		console.error("[DB] Error reading horarios:", error);
		return DEFAULT_HORARIOS;
	}

	const result = data && data.length > 0 ? data : DEFAULT_HORARIOS;

	// Store in cache
	setCachedData("horarios", result);
	return result;
}

async function writeHorarios(horarios) {
	invalidateCache("horarios");

	// Update each horario by day
	for (const h of horarios) {
		const { error } = await supabase
			.from("horarios")
			.update({ open: h.open, close: h.close, closed: h.closed })
			.eq("day", h.day);

		if (error) {
			console.error("[DB] Error updating horario:", error);
			throw error;
		}
	}
}

// ========== VENTAS ==========
async function readVentas() {
	// Check cache first
	const cached = getCachedData("ventas");
	if (cached !== null) return cached;

	// Cache miss - fetch from Supabase
	const { data, error } = await supabase
		.from("ventas")
		.select("*")
		.order("id", { ascending: true });

	if (error) {
		console.error("[DB] Error reading ventas:", error);
		return [];
	}

	// Store in cache
	setCachedData("ventas", data || []);
	return data || [];
}

async function listVentas() {
	return await readVentas();
}

async function upsertVenta(v) {
	invalidateCache("ventas");

	const venta = normalizeProducto(v);

	if (v.id) {
		// Update existing
		const { data, error } = await supabase
			.from("ventas")
			.update(venta)
			.eq("id", v.id)
			.select()
			.single();

		if (error) {
			console.error("[DB] Error updating venta:", error);
			throw error;
		}
		return data;
	} else {
		// Insert new
		const { data, error } = await supabase
			.from("ventas")
			.insert([venta])
			.select()
			.single();

		if (error) {
			console.error("[DB] Error inserting venta:", error);
			throw error;
		}
		return data;
	}
}

async function deleteVentaById(id) {
	invalidateCache("ventas");

	const { error } = await supabase.from("ventas").delete().eq("id", id);

	if (error) {
		console.error("[DB] Error deleting venta:", error);
		return false;
	}
	return true;
}

// ========== SERVICIOS ==========
async function readServicios() {
	// Check cache first
	const cached = getCachedData("servicios");
	if (cached !== null) return cached;

	// Cache miss - fetch from Supabase
	const { data, error } = await supabase
		.from("servicios")
		.select("*")
		.order("id", { ascending: true });

	if (error) {
		console.error("[DB] Error reading servicios:", error);
		return [];
	}

	// Store in cache
	setCachedData("servicios", data || []);
	return data || [];
}

async function listServicios() {
	return await readServicios();
}

async function upsertServicio(s) {
	invalidateCache("servicios");

	const servicio = normalizeProducto(s);

	if (s.id) {
		// Update existing
		const { data, error } = await supabase
			.from("servicios")
			.update(servicio)
			.eq("id", s.id)
			.select()
			.single();

		if (error) {
			console.error("[DB] Error updating servicio:", error);
			throw error;
		}
		return data;
	} else {
		// Insert new
		const { data, error } = await supabase
			.from("servicios")
			.insert([servicio])
			.select()
			.single();

		if (error) {
			console.error("[DB] Error inserting servicio:", error);
			throw error;
		}
		return data;
	}
}

async function deleteServicioById(id) {
	invalidateCache("servicios");

	const { error } = await supabase.from("servicios").delete().eq("id", id);

	if (error) {
		console.error("[DB] Error deleting servicio:", error);
		return false;
	}
	return true;
}

// ========== BULK & CLEAR OPERATIONS ==========
async function saveAllProductos(data) {
	invalidateCache("productos");
	// Delete all
	await supabase.from("productos").delete().neq("id", 0);
	// Insert all
	const { error } = await supabase.from("productos").insert(data);
	if (error) throw error;
}

async function clearProductos() {
	invalidateCache("productos");
	const { error } = await supabase.from("productos").delete().neq("id", 0);
	if (error) throw error;
}

async function saveAllVentas(data) {
	invalidateCache("ventas");
	await supabase.from("ventas").delete().neq("id", 0);
	const { error } = await supabase.from("ventas").insert(data);
	if (error) throw error;
}

async function clearVentas() {
	invalidateCache("ventas");
	const { error } = await supabase.from("ventas").delete().neq("id", 0);
	if (error) throw error;
}

async function saveAllServicios(data) {
	invalidateCache("servicios");
	await supabase.from("servicios").delete().neq("id", 0);
	const { error } = await supabase.from("servicios").insert(data);
	if (error) throw error;
}

async function clearServicios() {
	invalidateCache("servicios");
	const { error } = await supabase.from("servicios").delete().neq("id", 0);
	if (error) throw error;
}

async function saveAllHorarios(data) {
	invalidateCache("horarios");
	// Update each by day
	for (const h of data) {
		await supabase
			.from("horarios")
			.update({ open: h.open, close: h.close, closed: h.closed })
			.eq("day", h.day);
	}
}

async function clearHorarios() {
	invalidateCache("horarios");
	// Reset to defaults
	for (const h of DEFAULT_HORARIOS) {
		await supabase
			.from("horarios")
			.update({ open: h.open, close: h.close, closed: h.closed })
			.eq("day", h.day);
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
