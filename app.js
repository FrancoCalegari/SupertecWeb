const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cookieSession = require("cookie-session");
const { put } = require("@vercel/blob");
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
} = require("./db");

const app = express();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
	cookieSession({
		name: "supertec_session",
		secret: SESSION_SECRET,
		sameSite: "lax",
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		maxAge: 24 * 60 * 60 * 1000,
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
			const ext = path.extname(req.file.originalname) || "";
			const fileName = `productos/${Date.now()}-${Math.round(
				Math.random() * 1e9
			)}${ext}`;
			const mime = req.file.mimetype || "application/octet-stream";

			if (process.env.BLOB_READ_WRITE_TOKEN) {
				const buffer =
					req.file.buffer ||
					(req.file.path ? fs.readFileSync(req.file.path) : null);
				if (!buffer) {
					return res
						.status(400)
						.json({ ok: false, error: "No se pudo leer el archivo subido" });
				}
				console.log(`[Blob] Subiendo ${fileName} (${mime})`);
				const blob = await put(fileName, buffer, {
					access: "public",
					token: process.env.BLOB_READ_WRITE_TOKEN,
					contentType: mime,
				});
				console.log(`[Blob] Subida OK ${blob.url}`);
				imageUrl = blob.url;
			} else if (!process.env.VERCEL) {
				imageUrl = "/assets/img/productos/" + req.file.filename;
				console.log(`[Blob] Uso de ruta local ${imageUrl}`);
			} else {
				return res.status(400).json({
					ok: false,
					error: "Configure BLOB_READ_WRITE_TOKEN o use una URL pública",
				});
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

		let imageUrl = venta.img;
		if (req.file) {
			const ext = path.extname(req.file.originalname) || "";
			const fileName = `ventas/${Date.now()}-${Math.round(
				Math.random() * 1e9
			)}${ext}`;
			const mime = req.file.mimetype || "application/octet-stream";

			if (process.env.BLOB_READ_WRITE_TOKEN) {
				const buffer =
					req.file.buffer ||
					(req.file.path ? fs.readFileSync(req.file.path) : null);
				if (!buffer)
					return res
						.status(400)
						.json({ ok: false, error: "No se pudo leer el archivo" });

				const blob = await put(fileName, buffer, {
					access: "public",
					token: process.env.BLOB_READ_WRITE_TOKEN,
					contentType: mime,
				});
				imageUrl = blob.url;
			} else if (!process.env.VERCEL) {
				imageUrl = "/assets/img/productos/" + req.file.filename; // Reutilizamos carpeta productos localmente
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
		const deleted = await deleteVentaById(id);
		if (!deleted)
			return res.status(404).json({ ok: false, error: "Venta no encontrada" });
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

		let imageUrl = servicio.img;
		if (req.file) {
			const ext = path.extname(req.file.originalname) || "";
			const fileName = `servicios/${Date.now()}-${Math.round(
				Math.random() * 1e9
			)}${ext}`;
			const mime = req.file.mimetype || "application/octet-stream";

			if (process.env.BLOB_READ_WRITE_TOKEN) {
				const buffer =
					req.file.buffer ||
					(req.file.path ? fs.readFileSync(req.file.path) : null);
				if (!buffer)
					return res
						.status(400)
						.json({ ok: false, error: "No se pudo leer el archivo" });

				const blob = await put(fileName, buffer, {
					access: "public",
					token: process.env.BLOB_READ_WRITE_TOKEN,
					contentType: mime,
				});
				imageUrl = blob.url;
			} else if (!process.env.VERCEL) {
				imageUrl = "/assets/img/productos/" + req.file.filename;
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
		const deleted = await deleteServicioById(id);
		if (!deleted)
			return res
				.status(404)
				.json({ ok: false, error: "Servicio no encontrado" });
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
		const deleted = await deleteProductoById(id);
		if (!deleted) {
			return res
				.status(404)
				.json({ ok: false, error: "Producto no encontrado" });
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

// Rutas principales
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/login", (req, res) =>
	res.sendFile(path.join(__dirname, "login.html"))
);
app.get("/tienda", (req, res) =>
	res.sendFile(path.join(__dirname, "tienda.html"))
);
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
