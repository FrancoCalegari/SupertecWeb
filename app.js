const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

const app = express();
const productosPath = path.join(__dirname, 'public','assets','json','productos.json');

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

app.post('/api/productos', (req, res) => {
    const producto = req.body;
    const data = fs.readFileSync(productosPath, 'utf-8');
    let productos = JSON.parse(data);

    if (producto.id) {
        const idx = productos.findIndex(p => p.id === Number(producto.id));
        if (idx !== -1) productos[idx] = producto;
    } else {
        producto.id = productos.length ? Math.max(...productos.map(p => p.id)) + 1 : 1;
        productos.push(producto);
    }

    fs.writeFileSync(productosPath, JSON.stringify(productos, null, 2));
    res.json({ ok: true });
});

app.delete('/api/productos/:id', (req, res) => {
    const id = Number(req.params.id);
    const data = fs.readFileSync(productosPath, 'utf-8');
    let productos = JSON.parse(data);
    productos = productos.filter(p => p.id !== id);
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
