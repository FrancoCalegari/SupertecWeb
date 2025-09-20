const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const multer = require('multer');

const app = express();
const productosPath = path.join(__dirname, 'public','assets','json','productos.json');


// Carpeta de uploads
const uploadDir = path.join(__dirname, 'public', 'assets','img','productos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Middleware para recibir JSON y formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'supertec_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Usuarios de ejemplo
const users = [{ username: 'admin', password: 'admin123' }];

// Middleware de autenticación
function isAuthenticated(req, res, next) {
    if (req.session?.user) return next();
    res.redirect('/login');
}

// Rutas CRUD productos
app.get('/api/productos', (req, res) => {
    const data = fs.readFileSync(productosPath, 'utf-8');
    res.json(JSON.parse(data));
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
const upload = multer({ storage });

// Ruta POST con soporte de archivo
app.post('/api/productos', upload.single('imgFile'), (req, res) => {
    const producto = req.body;
    const data = fs.readFileSync(productosPath, 'utf-8');
    let productos = JSON.parse(data);

    // Si vino un archivo, usamos la ruta relativa
    if (req.file) {
        producto.img = '/assets/img/productos/' + req.file.filename;
    }

    if (producto.id) {
        const idx = productos.findIndex(p => p.id === Number(producto.id));
        if (idx !== -1) {
            productos[idx] = { ...productos[idx], ...producto };
        }
    } else {
        producto.id = productos.length ? Math.max(...productos.map(p => p.id)) + 1 : 1;
        productos.push(producto);
    }

    fs.writeFileSync(productosPath, JSON.stringify(productos, null, 2));
    res.json({ ok: true });
});

app.delete('/api/productos/:id', (req, res) => {
    const id = Number(req.params.id); // convertir siempre a número
    const data = fs.readFileSync(productosPath, 'utf-8');
    let productos = JSON.parse(data);

    const inicial = productos.length;
    productos = productos.filter(p => Number(p.id) !== id);

    if (productos.length === inicial) {
        return res.status(404).json({ ok: false, error: 'Producto no encontrado' });
    }

    fs.writeFileSync(productosPath, JSON.stringify(productos, null, 2));
    res.json({ ok: true });
});


// Rutas principales
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/tienda', (req, res) => res.sendFile(path.join(__dirname, 'tienda.html')));
app.get('/admindashboard', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'admindashboard.html')));
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// Login POST
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.user = user.username;
        return res.redirect('/admindashboard');
    }
    res.redirect('/login?error=1');
});

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor iniciado en http://localhost:${PORT}`));
