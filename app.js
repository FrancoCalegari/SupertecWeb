require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cookieSession = require("cookie-session");
const nodemailer = require("nodemailer");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const {
	listProductos,
	upsertProducto,
	deleteProductoById,
	initDb,
	readHorarios,
	writeHorarios,
	listVentas,
	upsertVenta,
	deleteVentaById,
	listServicios,
	upsertServicio,
	deleteServicioById,
	// Nuevos
	listCategorias,
	upsertCategoria,
	deleteCategoriaById,
	listPedidos,
	getPedidoById,
	getPedidoByCodigo,
	createPedido,
	updatePedidoEstado,
	updatePedidoMpStatus,
} = require("./db");


const app = express();

const SPIDER_API_KEY = process.env.SPIDERWEB_API_KEY || process.env.SPIDER_API_KEY || 'c90d1502ce815ea5d1108662186145d3cefe642586466c769d4c7fae63086ac6';
const SPIDER_API_BASE = process.env.SPIDERWEB_API_BASE || 'https://spiderwebargapi.com.ar/api/v1';
const SPIDER_STORAGE_PROJECT_ID = parseInt(process.env.SPIDERWEB_CLOUD_STORAGE_ID) || 1;
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://supertec-web.vercel.app';

// ── Mercado Pago config ──
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
let mpClient = null;
if (MP_ACCESS_TOKEN) {
	mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
	console.log('[MP] MercadoPago configurado OK');
} else {
	console.warn('[MP] MP_ACCESS_TOKEN no configurado, pagos deshabilitados');
}

// ── Email transporter (nodemailer) ──
function createEmailTransport() {
	if (process.env.EMAIL_HOST) {
		return nodemailer.createTransport({
			host: process.env.EMAIL_HOST,
			port: Number(process.env.EMAIL_PORT) || 587,
			secure: process.env.EMAIL_SECURE === 'true',
			auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
		});
	}
	return null;
}

async function sendConfirmationEmail(pedido) {
	const transporter = createEmailTransport();
	if (!transporter) {
		console.warn('[Email] Transporter no configurado, email no enviado');
		return;
	}
	const itemsHtml = (pedido.items || []).map(item => `
		<tr>
			<td style="padding:8px;border-bottom:1px solid #eee;">
				${item.img ? `<img src="${item.img}" style="width:48px;height:48px;object-fit:contain;border-radius:6px;" alt="">` : ''}
				${item.name}
			</td>
			<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.cantidad}</td>
			<td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${Number(item.precio).toLocaleString('es-AR')}</td>
		</tr>`).join('');

	const html = `
	<!DOCTYPE html>
	<html lang="es">
	<head><meta charset="UTF-8"><title>Confirmación de compra - Supertec</title></head>
	<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;margin:0;">
		<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
			<div style="background:linear-gradient(135deg,#fb383a,#c02020);padding:30px;text-align:center;">
				<h1 style="color:#fff;margin:0;font-size:1.6rem;">¡Compra confirmada! 🎉</h1>
				<p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">Gracias por tu compra en Supertec</p>
			</div>
			<div style="padding:30px;">
				<p style="color:#333;">Hola <strong>${pedido.cliente_nombre}</strong>,</p>
				<p style="color:#555;">Tu pedido fue confirmado exitosamente. Acá podés ver el resumen:</p>

				<div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:20px 0;">
					<p style="margin:0 0 8px;"><strong>Código de seguimiento:</strong></p>
					<p style="font-size:1.4rem;font-weight:bold;color:#fb383a;margin:0;letter-spacing:1px;">${pedido.codigo_seguimiento}</p>
				</div>

				<table width="100%" style="border-collapse:collapse;margin:20px 0;">
					<thead>
						<tr style="background:#f0f0f0;">
							<th style="padding:10px;text-align:left;">Producto</th>
							<th style="padding:10px;text-align:center;">Cant.</th>
							<th style="padding:10px;text-align:right;">Precio</th>
						</tr>
					</thead>
					<tbody>${itemsHtml}</tbody>
				</table>
				<p style="text-align:right;font-size:1.1rem;"><strong>Total: $${Number(pedido.total).toLocaleString('es-AR')}</strong></p>

				<div style="border-top:1px solid #eee;margin-top:20px;padding-top:20px;">
					<h3 style="color:#333;margin-top:0;">Datos de envío</h3>
					<p style="color:#555;margin:4px 0;">${pedido.envio_calle}, ${pedido.envio_ciudad}, ${pedido.envio_provincia} ${pedido.envio_cp}</p>
				</div>

				<div style="text-align:center;margin-top:28px;">
					<a href="${APP_BASE_URL}/seguimiento?codigo=${pedido.codigo_seguimiento}" 
					   style="background:#fb383a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Seguir mi pedido</a>
				</div>

				<p style="color:#999;font-size:0.85rem;margin-top:28px;">Si tenés preguntas, escribinos al WhatsApp: +54 9 261 503-1101 o al mail info@supertec.com.ar</p>
			</div>
		</div>
	</body>
	</html>`;

	try {
		await transporter.sendMail({
			from: `"Supertec" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
			to: pedido.cliente_email,
			subject: `✅ Pedido confirmado - ${pedido.codigo_seguimiento} | Supertec`,
			html,
		});
		console.log(`[Email] Confirmación enviada a ${pedido.cliente_email}`);
	} catch (err) {
		console.error('[Email] Error enviando email:', err.message);
	}
}

async function sendStatusUpdateEmail(pedido) {
	const transporter = createEmailTransport();
	if (!transporter) return;
	const estadoLabel = {
		pendiente: 'Pendiente',
		confirmado: 'Confirmado ✅',
		preparando: 'Preparando tu pedido 📦',
		enviado: 'Enviado 🚚',
		entregado: 'Entregado ✅',
		cancelado: 'Cancelado ❌',
	}[pedido.estado] || pedido.estado;

	const trackingInfo = pedido.tracking_empresa ? `
		<div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:20px 0;">
			<h3 style="margin:0 0 10px;">Información de envío</h3>
			<p style="margin:4px 0;"><strong>Empresa:</strong> ${pedido.tracking_empresa}</p>
			${pedido.tracking_numero ? `<p style="margin:4px 0;"><strong>N° de tracking:</strong> ${pedido.tracking_numero}</p>` : ''}
			${pedido.tracking_url ? `<p style="margin:4px 0;"><a href="${pedido.tracking_url}" style="color:#fb383a;">Ver tracking del courier</a></p>` : ''}
		</div>` : '';

	const html = `
	<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
	<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
		<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
			<div style="background:linear-gradient(135deg,#fb383a,#c02020);padding:24px;text-align:center;">
				<h1 style="color:#fff;margin:0;font-size:1.4rem;">Actualización de tu pedido</h1>
			</div>
			<div style="padding:28px;">
				<p>Hola <strong>${pedido.cliente_nombre}</strong>,</p>
				<p>El estado de tu pedido <strong>${pedido.codigo_seguimiento}</strong> fue actualizado a:</p>
				<div style="font-size:1.3rem;font-weight:bold;color:#fb383a;background:#fff5f5;border-radius:8px;padding:14px;text-align:center;margin:16px 0;">${estadoLabel}</div>
				${trackingInfo}
				<div style="text-align:center;margin-top:24px;">
					<a href="${APP_BASE_URL}/seguimiento?codigo=${pedido.codigo_seguimiento}" style="background:#fb383a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Seguir mi pedido</a>
				</div>
			</div>
		</div>
	</body></html>`;

	try {
		await transporter.sendMail({
			from: `"Supertec" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
			to: pedido.cliente_email,
			subject: `Actualización de pedido ${pedido.codigo_seguimiento} - ${estadoLabel} | Supertec`,
			html,
		});
		console.log(`[Email] Actualización enviada a ${pedido.cliente_email}`);
	} catch (err) {
		console.error('[Email] Error enviando email de estado:', err.message);
	}
}


let spiderProjectId = null;

async function getSpiderProjectId() {
	if (spiderProjectId) return spiderProjectId;
	try {
		const res = await fetch(`${SPIDER_API_BASE}/storage/projects`, {
			headers: { 'X-API-KEY': SPIDER_API_KEY }
		});
		if (res.ok) {
			const data = await res.json();
			const projects = Array.isArray(data) ? data : (data.data || data.projects || []);
			const proj = projects.find(p => p.name === 'SuperTecStorage' || p.nombre === 'SuperTecStorage');
			if (proj && (proj.id || proj._id)) {
					spiderProjectId = proj.id || proj._id;
					console.log(`[Spider API] Found project ID for 'SuperTecStorage': ${spiderProjectId}`);
					return spiderProjectId;
				}
		}
	} catch (e) {
		console.error("[Spider API] Error fetching projects:", e);
	}
	console.warn(`[Spider API] Project 'SuperTecStorage' not found, falling back to ID ${SPIDER_STORAGE_PROJECT_ID}`);
	return SPIDER_STORAGE_PROJECT_ID;
}

async function uploadToSpiderAPI(buffer, originalname) {
	const projectId = await getSpiderProjectId();
	const formData = new FormData();
	const blob = new Blob([buffer]);
	formData.append('files', blob, originalname);

	const startUpload = Date.now();
	const res = await fetch(`${SPIDER_API_BASE}/storage/projects/${projectId}/files`, {
		method: 'POST',
		headers: { 'X-API-KEY': SPIDER_API_KEY },
		body: formData
	});
	const uploadTime = Date.now() - startUpload;

	if (!res.ok) {
		throw new Error(`Spider API error: ${res.status} ${res.statusText} (Time: ${uploadTime}ms)`);
	}
	const data = await res.json();
	console.log(`[Spider API] Upload response in ${uploadTime}ms:`, data);

	let spiderUrl = "";
	if (data.url) spiderUrl = data.url;
	else if (data[0] && data[0].url) spiderUrl = data[0].url;
	else if (data.data && data.data.url) spiderUrl = data.data.url;
	else if (data.file && data.file.url) spiderUrl = data.file.url;
	else if (data.files && data.files[0] && data.files[0].url) spiderUrl = data.files[0].url;
	else if (data.id) spiderUrl = `${SPIDER_API_BASE}/storage/files/${data.id}`;
	else if (data[0] && data[0].id) spiderUrl = `${SPIDER_API_BASE}/storage/files/${data[0].id}`;
	else if (data.files && data.files[0] && data.files[0].id) spiderUrl = `${SPIDER_API_BASE}/storage/files/${data.files[0].id}`;
	else if (data.files && data.files[0] && data.files[0].fileId) spiderUrl = `${SPIDER_API_BASE}/storage/files/${data.files[0].fileId}`;
	else throw new Error("Could not extract URL from Spider API response.");

	return spiderUrl;
}

async function deleteFromSpiderAPI(url) {
	if (!url || (!url.includes('190.220.229.45:7256') && !url.includes('spiderwebargapi.com.ar'))) return;
	const urlParts = url.split('/');
	const id = urlParts[urlParts.length - 1];
	if (!id) return;

	try {
		console.log(`[Spider API] Deleting file ID: ${id}`);
		const res = await fetch(`${SPIDER_API_BASE}/storage/files/${id}`, {
			method: 'DELETE',
			headers: { 'X-API-KEY': SPIDER_API_KEY }
		});
		if (!res.ok) {
			console.error(`Error deleting from Spider API: ${res.status} ${res.statusText}`);
		} else {
			console.log(`[Spider API] Deleted file ID: ${id}`);
		}
	} catch (err) {
		console.error("[Spider API] Fetch error deleting:", err);
	}
}

// Carpeta de uploads
const uploadDir =
	process.env.UPLOAD_DIR ||
	path.join(__dirname, "public", "assets", "img", "productos");
if (!process.env.VERCEL && !fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir, { recursive: true });
}

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "supertec_secret_key";

// Middleware para recibir JSON y formularios
app.set("trust proxy", 1); // necesario para que secure cookies funcionen detrás de proxy/https

// CORS Middleware
app.use((req, res, next) => {
	const origin = req.headers.origin;
	// Allow any origin for now (or restrict to specific domains if needed)
	if (origin) {
		res.setHeader("Access-Control-Allow-Origin", origin);
	}
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET, POST, OPTIONS, PUT, PATCH, DELETE"
	);
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-Requested-With, Content-Type, Accept, Authorization"
	);
	res.setHeader("Access-Control-Allow-Credentials", true);

	if (req.method === "OPTIONS") {
		return res.status(200).end();
	}
	next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
	cookieSession({
		name: "session",
		keys: [SESSION_SECRET],
		maxAge: 24 * 60 * 60 * 1000,
		// Allow cross-site but disable 'secure' requirement if not on Vercel (local dev)
		sameSite: process.env.VERCEL ? "none" : "lax",
		secure: !!process.env.VERCEL,
		httpOnly: true,
	})
);

// Inicializar DB (Blob o local)
initDb()
	.then(() => console.log("[DB] Almacenamiento listo (Blob o local)"))
	.catch((err) => {
		console.error("No se pudo inicializar la base de datos", err);
		process.exit(1);
	});

// Estado del blob store
if (process.env.BLOB_READ_WRITE_TOKEN) {
	console.log("[Blob] Token configurado, se intentarán subidas a Vercel Blob");
} else {
	console.warn(
		"[Blob] Sin token BLOB_READ_WRITE_TOKEN, se usará almacenamiento local en var/productos.local.json"
	);
}

// Usuarios de ejemplo (ahora por env)
const users = [{ username: ADMIN_USER, password: ADMIN_PASS }];

// Middleware de autenticación
function isAuthenticated(req, res, next) {
	if (req.session?.user) return next();
	res.redirect("/login");
}

// Rutas CRUD productos
app.get("/api/productos", async (req, res) => {
	try {
		console.log("[API] GET /api/productos");
		const productos = await listProductos();
		console.log(`[API] Productos cargados: ${productos.length}`);
		res.json(productos);
	} catch (err) {
		console.error("Error listando productos", err);
	}
});

// Rutas Horarios

// GET Horarios
app.get("/api/horarios", async (req, res) => {
	try {
		const horarios = await readHorarios();
		res.json(horarios);
	} catch (err) {
		console.error("Error leyendo horarios", err);
		res.status(500).json({ error: "Error interno" });
	}
});

// POST Horarios (Protegido)
app.post("/api/horarios", isAuthenticated, async (req, res) => {
	try {
		const newHorarios = req.body; // Array de objetos
		if (!Array.isArray(newHorarios)) {
			return res.status(400).json({ error: "Formato inválido" });
		}
		await writeHorarios(newHorarios);
		res.json({ ok: true });
	} catch (err) {
		console.error("Error guardando horarios", err);
		res.status(500).json({ error: "Error interno" });
	}
});

// Configuración de multer
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, uploadDir),
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname);
		const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
		cb(null, uniqueName);
	},
});
const uploadConfig = process.env.VERCEL
	? { storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }
	: { storage, limits: { fileSize: 5 * 1024 * 1024 } };
const upload = multer(uploadConfig);

// Ruta POST con soporte de archivo
app.post("/api/productos", upload.single("imgFile"), async (req, res) => {
	try {
		const body = req.body;
		const producto = {
			id: body.id ? Number(body.id) : undefined,
			name: body.name,
			description: body.description,
			precio: Number(body.precio) || 0,
			categoria: body.categoria,
			stock: Number(body.stock) || 0,
			marca: body.marca,
			modelo: body.modelo,
			img: body.img || null,
			descuento: Number(body.descuento) || 0,
			precio_original: body.precio_original ? Number(body.precio_original) : null,
			destacado: body.destacado === '1' || body.destacado === 'true' ? 1 : 0,
		};


		if (!producto.name || !producto.description || !producto.categoria) {
			return res.status(400).json({
				ok: false,
				error: "Faltan campos obligatorios (nombre, descripción o categoría)",
			});
		}

		// Manejo de imagen
		let imageUrl = producto.img;
		if (req.file) {
			const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
			if (!buffer) {
				return res.status(400).json({ ok: false, error: "No se pudo leer el archivo" });
			}
			try {
				imageUrl = await uploadToSpiderAPI(buffer, req.file.originalname);
				console.log(`[Storage] Subida OK: ${imageUrl}`);
			} catch (err) {
				console.error("[Storage] Error subiendo imagen:", err);
				return res.status(500).json({ ok: false, error: "Error subiendo imagen" });
			}
		}
		producto.img = imageUrl;

		const saved = await upsertProducto(producto);
		console.log(`[API] Producto ${saved.id} guardado/actualizado`);
		res.json({ ok: true, producto: saved });
	} catch (err) {
		console.error("Error guardando producto", err);
		res
			.status(500)
			.json({ ok: false, error: "No se pudo guardar el producto" });
	}
});

// --- Rutas Ventas ---
app.get("/api/ventas", async (req, res) => {
	try {
		const ventas = await listVentas();
		res.json(ventas);
	} catch (err) {
		console.error("Error listando ventas", err);
		res.status(500).json({ error: "Error interno" });
	}
});

app.post("/api/ventas", upload.single("imgFile"), async (req, res) => {
	try {
		const body = req.body;
		const venta = {
			id: body.id ? Number(body.id) : undefined,
			name: body.name,
			description: body.description,
			precio: Number(body.precio) || 0,
			categoria: body.categoria,
			stock: Number(body.stock) || 0,
			marca: body.marca,
			modelo: body.modelo,
			img: body.img || null,
		};

		if (!venta.name || !venta.description) {
			return res
				.status(400)
				.json({ ok: false, error: "Faltan campos obligatorios" });
		}

		// Límite de 60 productos del local (ventas)
		if (!venta.id) {
			const ventasActuales = await listVentas();
			if (ventasActuales.length >= 60) {
				return res.status(400).json({ ok: false, error: "Límite de 60 productos del local alcanzado." });
			}
		}

		// Manejo de imagen
		let imageUrl = venta.img;
		if (req.file) {
			const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
			if (!buffer) {
				return res.status(400).json({ ok: false, error: "No se pudo leer el archivo" });
			}
			try {
				imageUrl = await uploadToSpiderAPI(buffer, req.file.originalname);
				console.log(`[Storage] Subida OK: ${imageUrl}`);
			} catch (err) {
				console.error("[Storage] Error subiendo imagen:", err);
				return res.status(500).json({ ok: false, error: "Error subiendo imagen" });
			}
		}
		venta.img = imageUrl;

		const saved = await upsertVenta(venta);
		res.json({ ok: true, venta: saved });
	} catch (err) {
		console.error("Error guardando venta", err);
		res.status(500).json({ ok: false, error: "No se pudo guardar la venta" });
	}
});

app.delete("/api/ventas/:id", async (req, res) => {
	const id = Number(req.params.id);
	try {
		const ventas = await listVentas();
		const venta = ventas.find(v => v.id === id);

		const deleted = await deleteVentaById(id);
		if (!deleted)
			return res.status(404).json({ ok: false, error: "Venta no encontrada" });

		if (venta && venta.img) {
			await deleteFromSpiderAPI(venta.img);
		}

		res.json({ ok: true });
	} catch (err) {
		console.error("Error eliminando venta", err);
		res.status(500).json({ ok: false, error: "No se pudo eliminar" });
	}
});

// --- Rutas Servicios ---
app.get("/api/servicios", async (req, res) => {
	try {
		const servicios = await listServicios();
		res.json(servicios);
	} catch (err) {
		console.error("Error listando servicios", err);
		res.status(500).json({ error: "Error interno" });
	}
});

app.post("/api/servicios", upload.single("imgFile"), async (req, res) => {
	try {
		const body = req.body;
		const servicio = {
			id: body.id ? Number(body.id) : undefined,
			name: body.name,
			description: body.description,
			precio: Number(body.precio) || 0,
			categoria: body.categoria,
			stock: Number(body.stock) || 0,
			marca: body.marca,
			modelo: body.modelo,
			img: body.img || null,
		};

		if (!servicio.name || !servicio.description) {
			return res
				.status(400)
				.json({ ok: false, error: "Faltan campos obligatorios" });
		}

		// Manejo de imagen
		let imageUrl = servicio.img;
		if (req.file) {
			const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
			if (!buffer) {
				return res.status(400).json({ ok: false, error: "No se pudo leer el archivo" });
			}
			try {
				imageUrl = await uploadToSpiderAPI(buffer, req.file.originalname);
				console.log(`[Storage] Subida OK: ${imageUrl}`);
			} catch (err) {
				console.error("[Storage] Error subiendo imagen:", err);
				return res.status(500).json({ ok: false, error: "Error subiendo imagen" });
			}
		}
		servicio.img = imageUrl;

		const saved = await upsertServicio(servicio);
		res.json({ ok: true, servicio: saved });
	} catch (err) {
		console.error("Error guardando servicio", err);
		res
			.status(500)
			.json({ ok: false, error: "No se pudo guardar el servicio" });
	}
});

app.delete("/api/servicios/:id", async (req, res) => {
	const id = Number(req.params.id);
	try {
		const servicios = await listServicios();
		const servicio = servicios.find(s => s.id === id);

		const deleted = await deleteServicioById(id);
		if (!deleted)
			return res
				.status(404)
				.json({ ok: false, error: "Servicio no encontrado" });

		if (servicio && servicio.img) {
			await deleteFromSpiderAPI(servicio.img);
		}

		res.json({ ok: true });
	} catch (err) {
		console.error("Error eliminando servicio", err);
		res.status(500).json({ ok: false, error: "No se pudo eliminar" });
	}
});

// --- Admin Config Routes ---
const {
	saveAllProductos,
	clearProductos,
	saveAllVentas,
	clearVentas,
	saveAllServicios,
	clearServicios,
	saveAllHorarios,
	clearHorarios,
} = require("./db");

// Export Data
app.get("/api/admin/export/:type", isAuthenticated, async (req, res) => {
	const { type } = req.params;
	try {
		let data;
		if (type === "productos") data = await listProductos();
		else if (type === "ventas") data = await listVentas();
		else if (type === "servicios") data = await listServicios();
		else if (type === "horarios") data = await readHorarios();
		else return res.status(400).json({ error: "Tipo inválido" });

		res.setHeader("Content-Disposition", `attachment; filename=${type}.json`);
		res.setHeader("Content-Type", "application/json");
		res.send(JSON.stringify(data, null, 2));
	} catch (err) {
		console.error("Error exportando", err);
		res.status(500).json({ error: "Error exportando datos" });
	}
});

// Import Data
app.post(
	"/api/admin/import/:type",
	isAuthenticated,
	upload.single("file"),
	async (req, res) => {
		const { type } = req.params;
		if (!req.file)
			return res.status(400).json({ error: "No se subió archivo" });

		try {
			const content = req.file.buffer
				? req.file.buffer.toString()
				: fs.readFileSync(req.file.path, "utf-8");
			const data = JSON.parse(content);

			if (!Array.isArray(data))
				return res.status(400).json({ error: "El JSON debe ser un array" });

			if (type === "productos") await saveAllProductos(data);
			else if (type === "ventas") await saveAllVentas(data);
			else if (type === "servicios") await saveAllServicios(data);
			else if (type === "horarios") await saveAllHorarios(data);
			else return res.status(400).json({ error: "Tipo inválido" });

			res.json({ ok: true, count: data.length });
		} catch (err) {
			console.error("Error importando", err);
			res.status(500).json({ error: "Error procesando archivo importado" });
		}
	}
);

// Clear Data
app.delete("/api/admin/clear/:type", isAuthenticated, async (req, res) => {
	const { type } = req.params;
	try {
		if (type === "productos") await clearProductos();
		else if (type === "ventas") await clearVentas();
		else if (type === "servicios") await clearServicios();
		else if (type === "horarios") await clearHorarios();
		else return res.status(400).json({ error: "Tipo inválido" });

		res.json({ ok: true });
	} catch (err) {
		console.error("Error limpiando datos", err);
		res.status(500).json({ error: "Error limpiando datos" });
	}
});

app.delete("/api/productos/:id", async (req, res) => {
	const id = Number(req.params.id); // convertir siempre a número

	try {
		// Encontrar producto para borrar imagen de Spider API
		const productos = await listProductos();
		const prod = productos.find(p => p.id === id);

		const deleted = await deleteProductoById(id);
		if (!deleted) {
			return res
				.status(404)
				.json({ ok: false, error: "Producto no encontrado" });
		}

		if (prod && prod.img) {
			await deleteFromSpiderAPI(prod.img);
		}

		console.log(`[API] Producto ${id} eliminado`);
		res.json({ ok: true });
	} catch (err) {
		console.error("Error eliminando producto", err);
		res
			.status(500)
			.json({ ok: false, error: "No se pudo eliminar el producto" });
	}
});

// --- Spider Proxy Routes (Sorteo) ---
app.post("/api/spider-proxy/query", async (req, res) => {
	try {
		const response = await fetch(`${SPIDER_API_BASE}/query`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": SPIDER_API_KEY,
			},
			body: JSON.stringify(req.body),
		});
		const data = await response.json();
		return res.json(data);
	} catch (err) {
		console.error("[Spider Proxy Query Error]", err);
		return res.status(500).json({ success: false, error: "Proxy Query Error" });
	}
});

app.post("/api/spider-proxy/upload", upload.single("files"), async (req, res) => {
	try {
		if (!req.file) return res.status(400).json({ success: false, error: "No file provided" });
		const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
		if (!buffer) return res.status(400).json({ success: false, error: "Empty file" });

		const projectId = await getSpiderProjectId();
		const formData = new FormData();
		const blob = new Blob([buffer]);
		formData.append("files", blob, req.file.originalname);

		const response = await fetch(`${SPIDER_API_BASE}/storage/projects/${projectId}/files`, {
			method: "POST",
			headers: { "X-API-KEY": SPIDER_API_KEY },
			body: formData,
		});
		const data = await response.json();
		return res.json(data);
	} catch (err) {
		console.error("[Spider Proxy Upload Error]", err);
		return res.status(500).json({ success: false, error: "Proxy Upload Error" });
	}
});

app.get("/api/proxy-image", async (req, res) => {
	try {
		const imageUrl = req.query.url;
		if (!imageUrl) return res.status(400).send("No se proveyó URL");

		const response = await fetch(imageUrl);
		if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
		res.set('Cross-Origin-Resource-Policy', 'cross-origin'); 
		res.set('Access-Control-Allow-Origin', '*');
		res.set('Cache-Control', 'public, max-age=86400');

		res.send(buffer);
	} catch (error) {
		console.error('[Proxy] Error descargando imagen:', error.message);
		res.status(500).send('Error');
	}
});

app.get("/api/spider-proxy/file/:id", async (req, res) => {
	try {
		const response = await fetch(`${SPIDER_API_BASE}/storage/files/${req.params.id}`, {
			headers: { "X-API-KEY": SPIDER_API_KEY },
		});
		if (!response.ok) return res.status(response.status).end();
		const arrayBuffer = await response.arrayBuffer();
		res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");
		// Agregar headers de caché para que el navegador del cliente no solicite la misma imagen repetidamente
		res.setHeader("Cache-Control", "public, max-age=86400, immutable"); 
		return res.send(Buffer.from(arrayBuffer));
	} catch (err) {
		console.error("[Spider Proxy File Error]", err);
		return res.status(500).json({ success: false, error: "Proxy File Error" });
	}
});

// ── Rutas Categorias (públicas GET, admin POST/DELETE) ──
app.get("/api/categorias", async (req, res) => {
	try {
		const cats = await listCategorias();
		res.json(cats);
	} catch (err) {
		console.error("Error listando categorias", err);
		res.status(500).json({ error: "Error interno" });
	}
});

app.post("/api/categorias", isAuthenticated, async (req, res) => {
	try {
		const c = req.body;
		if (!c.nombre) return res.status(400).json({ ok: false, error: "Nombre requerido" });
		if (!c.slug) c.slug = c.nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
		const saved = await upsertCategoria(c);
		res.json({ ok: true, categoria: saved });
	} catch (err) {
		console.error("Error guardando categoria", err);
		res.status(500).json({ ok: false, error: err.message });
	}
});

app.delete("/api/categorias/:id", isAuthenticated, async (req, res) => {
	try {
		await deleteCategoriaById(Number(req.params.id));
		res.json({ ok: true });
	} catch (err) {
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ── Rutas Pedidos (admin protegidas) ──
app.get("/api/pedidos", isAuthenticated, async (req, res) => {
	try {
		const estado = req.query.estado || '';
		const pedidos = await listPedidos(estado);
		res.json(pedidos);
	} catch (err) {
		res.status(500).json({ error: "Error interno" });
	}
});

app.get("/api/pedidos/:id", isAuthenticated, async (req, res) => {
	try {
		const pedido = await getPedidoById(Number(req.params.id));
		if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });
		res.json(pedido);
	} catch (err) {
		res.status(500).json({ error: "Error interno" });
	}
});

app.post("/api/pedidos/:id/estado", isAuthenticated, async (req, res) => {
	try {
		const id = Number(req.params.id);
		const { estado, empresa, numero, url, notas, notificar } = req.body;
		if (!estado) return res.status(400).json({ ok: false, error: "Estado requerido" });
		const pedido = await updatePedidoEstado(id, estado, { empresa, numero, url, notas });
		if (notificar && pedido) {
			await sendStatusUpdateEmail(pedido);
		}
		res.json({ ok: true, pedido });
	} catch (err) {
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ── Seguimiento público ──
app.get("/api/seguimiento/:codigo", async (req, res) => {
	try {
		const pedido = await getPedidoByCodigo(req.params.codigo);
		if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });
		// Ocultar datos sensibles del cliente al público
		res.json({
			codigo_seguimiento: pedido.codigo_seguimiento,
			estado: pedido.estado,
			cliente_nombre: pedido.cliente_nombre,
			items: pedido.items,
			total: pedido.total,
			envio_ciudad: pedido.envio_ciudad,
			envio_provincia: pedido.envio_provincia,
			tracking_empresa: pedido.tracking_empresa,
			tracking_numero: pedido.tracking_numero,
			tracking_url: pedido.tracking_url,
			created_at: pedido.created_at,
			updated_at: pedido.updated_at,
		});
	} catch (err) {
		res.status(500).json({ error: "Error interno" });
	}
});

// ── Mercado Pago: Crear preferencia ──
app.post("/api/mp/preference", async (req, res) => {
	try {
		if (!mpClient) return res.status(503).json({ ok: false, error: "Mercado Pago no configurado" });
		const { items, cliente, envio } = req.body;
		if (!items || !items.length || !cliente || !cliente.email) {
			return res.status(400).json({ ok: false, error: "Faltan datos requeridos" });
		}

		const mpItems = items.map(item => ({
			title: item.name,
			quantity: Number(item.cantidad) || 1,
			unit_price: Number(item.precio) || 0,
			currency_id: "ARS",
			picture_url: item.img || undefined,
		}));

		const preference = new Preference(mpClient);
		const total = items.reduce((s, i) => s + (Number(i.precio) * (Number(i.cantidad) || 1)), 0);

		// Crear pedido en DB antes de ir a MP
		const pedidoData = {
			cliente_nombre: cliente.nombre,
			cliente_email: cliente.email,
			cliente_telefono: cliente.telefono || '',
			envio_calle: envio?.calle || '',
			envio_ciudad: envio?.ciudad || '',
			envio_provincia: envio?.provincia || '',
			envio_cp: envio?.cp || '',
			envio_notas: envio?.notas || '',
			items,
			total,
		};

		const prefResponse = await preference.create({
			body: {
				items: mpItems,
				payer: { name: cliente.nombre, email: cliente.email },
				back_urls: {
					success: `${APP_BASE_URL}/checkout?status=approved`,
					failure: `${APP_BASE_URL}/checkout?status=failure`,
					pending: `${APP_BASE_URL}/checkout?status=pending`,
				},
				auto_return: "approved",
				notification_url: `${APP_BASE_URL}/api/mp/webhook`,
				external_reference: '',
			},
		});

		pedidoData.mp_preference_id = prefResponse.id;
		const pedido = await createPedido(pedidoData);

		res.json({
			ok: true,
			init_point: prefResponse.init_point,
			preference_id: prefResponse.id,
			codigo_seguimiento: pedido.codigo_seguimiento,
		});
	} catch (err) {
		console.error('[MP] Error creando preferencia:', err);
		res.status(500).json({ ok: false, error: err.message });
	}
});

// ── Mercado Pago: Webhook ──
app.post("/api/mp/webhook", async (req, res) => {
	try {
		const { type, data } = req.body;
		console.log('[MP Webhook]', type, data);
		if (type === 'payment' && data && data.id && mpClient) {
			const paymentApi = new Payment(mpClient);
			const payment = await paymentApi.get({ id: data.id });
			const { status, external_reference, preference_id } = payment;
			const pedido = await updatePedidoMpStatus(preference_id || external_reference, String(data.id), status);
			if (pedido && status === 'approved') {
				await sendConfirmationEmail(pedido);
			}
		}
		res.sendStatus(200);
	} catch (err) {
		console.error('[MP Webhook] Error:', err);
		res.sendStatus(200); // siempre 200 a MP
	}
});

// ==========================================
// SPIDER IA CHAT ENDPOINT
// ==========================================
app.post("/api/ia/chat", async (req, res) => {
	try {
		const { message } = req.body;
		if (!message) return res.status(400).json({ error: "Mensaje vacío" });

		// 1. Obtener modelos
		const modelsRes = await fetch(`${SPIDER_API_BASE}/ia/models`, {
			headers: { 'X-API-KEY': SPIDER_API_KEY }
		});
		const modelsData = await modelsRes.json();
		if (!modelsData.models || modelsData.models.length === 0) {
			return res.status(500).json({ error: "No hay modelos de IA disponibles" });
		}
		const modelId = modelsData.models[0].id;

		// 2. Enviar consulta
		const replyRes = await fetch(`${SPIDER_API_BASE}/ia/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-API-KEY': SPIDER_API_KEY },
			body: JSON.stringify({
				model_id: modelId,
				messages: [
					{ role: 'system', content: 'Eres el asistente virtual de ventas de SuperTec. Tu objetivo es ayudar a los clientes a encontrar productos, informar sobre tecnología, horarios y envíos. Responde de manera amigable, concisa y útil.' },
					{ role: 'user', content: message }
				]
			})
		});
		const replyData = await replyRes.json();
		if (replyData.error) {
			return res.status(500).json({ error: replyData.error });
		}
		res.json({ success: true, reply: replyData.message.content });
	} catch (error) {
		console.error("[SpiderIA] Error en chat:", error);
		res.status(500).json({ error: "Error interno del servidor IA" });
	}
});

// Rutas principales
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/tienda", (req, res) => res.sendFile(path.join(__dirname, "tienda.html")));
app.get("/checkout", (req, res) => res.sendFile(path.join(__dirname, "checkout.html")));
app.get("/seguimiento", (req, res) => res.sendFile(path.join(__dirname, "seguimiento.html")));
app.get("/admindashboard", isAuthenticated, (req, res) =>
	res.sendFile(path.join(__dirname, "admindashboard.html"))
);
app.get("/logout", (req, res) => {
	req.session = null;
	res.redirect("/");
});


// Login POST
app.post("/login", (req, res) => {
	const { username, password } = req.body;
	const user = users.find(
		(u) => u.username === username && u.password === password
	);
	if (user) {
		req.session.user = user.username;
		console.log(`[Auth] Login OK para ${user.username}`);
		return res.redirect("/admindashboard");
	}
	console.warn(`[Auth] Login fallido para ${username}`);
	res.redirect("/login?error=1");
});

// Archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// Iniciar servidor cuando se ejecuta directamente
if (require.main === module) {
	const PORT = process.env.PORT || 3000;
	app.listen(PORT, () =>
		console.log(`Servidor Express iniciado en http://localhost:${PORT}`)
	);
}

module.exports = app;
