const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cookieSession = require('cookie-session');
const { put } = require('@vercel/blob');
const {
  listProductos,
  upsertProducto,
  deleteProductoById,
  initDb
} = require('./db');

const app = express();

// Carpeta de uploads
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'assets', 'img', 'productos');
if (!process.env.VERCEL && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'supertec_secret_key';

// Middleware para recibir JSON y formularios
app.set('trust proxy', 1); // necesario para que secure cookies funcionen detrás de proxy/https
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'supertec_session',
  secret: SESSION_SECRET,
  sameSite: 'lax',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000
}));

// Inicializar DB (Blob o local)
initDb()
  .then(() => console.log('[DB] Almacenamiento listo (Blob o local)'))
  .catch((err) => {
    console.error('No se pudo inicializar la base de datos', err);
    process.exit(1);
  });

// Estado del blob store
if (process.env.BLOB_READ_WRITE_TOKEN) {
  console.log('[Blob] Token configurado, se intentarán subidas a Vercel Blob');
} else {
  console.warn('[Blob] Sin token BLOB_READ_WRITE_TOKEN, se usará almacenamiento local en var/productos.local.json');
}

// Usuarios de ejemplo (ahora por env)
const users = [{ username: ADMIN_USER, password: ADMIN_PASS }];

// Middleware de autenticación
function isAuthenticated(req, res, next) {
    if (req.session?.user) return next();
    res.redirect('/login');
}

// Rutas CRUD productos
app.get('/api/productos', async (req, res) => {
    try {
        console.log('[API] GET /api/productos');
        const productos = await listProductos();
        console.log(`[API] Productos cargados: ${productos.length}`);
        res.json(productos);
    } catch (err) {
        console.error('Error listando productos', err);
        res.status(500).json({ ok: false, error: 'No se pudieron obtener los productos' });
    }
});

// Configuración de multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
        cb(null, uniqueName);
    }
});
const uploadConfig = process.env.VERCEL
    ? { storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }
    : { storage, limits: { fileSize: 5 * 1024 * 1024 } };
const upload = multer(uploadConfig);

// Ruta POST con soporte de archivo
app.post('/api/productos', upload.single('imgFile'), async (req, res) => {
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
            img: body.img || null
        };

        if (!producto.name || !producto.description || !producto.categoria) {
            return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios (nombre, descripción o categoría)' });
        }

        // Manejo de imagen
        let imageUrl = producto.img;
        if (req.file) {
            const ext = path.extname(req.file.originalname) || '';
            const fileName = `productos/${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
            const mime = req.file.mimetype || 'application/octet-stream';

            if (process.env.BLOB_READ_WRITE_TOKEN) {
                const buffer = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
                if (!buffer) {
                    return res.status(400).json({ ok: false, error: 'No se pudo leer el archivo subido' });
                }
                console.log(`[Blob] Subiendo ${fileName} (${mime})`);
                const blob = await put(fileName, buffer, {
                    access: 'public',
                    token: process.env.BLOB_READ_WRITE_TOKEN,
                    contentType: mime
                });
                console.log(`[Blob] Subida OK ${blob.url}`);
                imageUrl = blob.url;
            } else if (!process.env.VERCEL) {
                imageUrl = '/assets/img/productos/' + req.file.filename;
                console.log(`[Blob] Uso de ruta local ${imageUrl}`);
            } else {
                return res.status(400).json({ ok: false, error: 'Configure BLOB_READ_WRITE_TOKEN o use una URL pública' });
            }
        }
        producto.img = imageUrl;

        const saved = await upsertProducto(producto);
        console.log(`[API] Producto ${saved.id} guardado/actualizado`);
        res.json({ ok: true, producto: saved });
    } catch (err) {
        console.error('Error guardando producto', err);
        res.status(500).json({ ok: false, error: 'No se pudo guardar el producto' });
    }
});

app.delete('/api/productos/:id', async (req, res) => {
    const id = Number(req.params.id); // convertir siempre a número

    try {
        const deleted = await deleteProductoById(id);
        if (!deleted) {
            return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
        }
        console.log(`[API] Producto ${id} eliminado`);
        res.json({ ok: true });
    } catch (err) {
        console.error('Error eliminando producto', err);
        res.status(500).json({ ok: false, error: 'No se pudo eliminar el producto' });
    }
});


// Rutas principales
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/tienda', (req, res) => res.sendFile(path.join(__dirname, 'tienda.html')));
app.get('/admindashboard', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'admindashboard.html')));
app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

// Login POST
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = user.username;
        console.log(`[Auth] Login OK para ${user.username}`);
        return res.redirect('/admindashboard');
    }
    console.warn(`[Auth] Login fallido para ${username}`);
    res.redirect('/login?error=1');
});

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Iniciar servidor cuando se ejecuta directamente
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Servidor Express iniciado en http://localhost:${PORT}`));
}

module.exports = app;
