const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

// Configuración de conexión: local file (en /tmp en Vercel) o remoto (Turso/libsql)
const localDir = process.env.VERCEL ? '/tmp/supertec-db' : path.join(__dirname, 'var');
const localDbPath = path.join(localDir, 'data.sqlite');
const dbUrl = process.env.DB_URL || `file:${localDbPath}`;
const dbAuthToken = process.env.DB_AUTH_TOKEN;

if (dbUrl.startsWith('file:')) {
  fs.mkdirSync(path.dirname(localDbPath), { recursive: true });
}

const client = createClient({
  url: dbUrl,
  authToken: dbAuthToken
});

const ready = client.execute(`
  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    precio REAL DEFAULT 0,
    categoria TEXT DEFAULT '',
    stock INTEGER DEFAULT 0,
    marca TEXT DEFAULT '',
    modelo TEXT DEFAULT '',
    img TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function initDb() {
  await ready;
  await seedIfEmpty();
}

const normalizeProducto = (row) => ({
  id: Number(row.id),
  name: row.name,
  description: row.description,
  precio: Number(row.precio) || 0,
  categoria: row.categoria,
  stock: Number(row.stock) || 0,
  marca: row.marca,
  modelo: row.modelo,
  img: row.img || ''
});

async function seedIfEmpty() {
  const countRes = await client.execute('SELECT COUNT(*) AS total FROM productos');
  const total = Number(countRes.rows[0].total);
  if (total > 0) return;

  const seedPath = path.join(__dirname, 'public', 'assets', 'json', 'productos.json');
  if (!fs.existsSync(seedPath)) return;

  try {
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    for (const p of seed) {
      await client.execute({
        sql: `INSERT INTO productos (id, name, description, precio, categoria, stock, marca, modelo, img)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING`,
        args: [
          p.id,
          p.name,
          p.description || '',
          Number(p.precio) || 0,
          p.categoria || '',
          Number(p.stock) || 0,
          p.marca || '',
          p.modelo || '',
          p.img || ''
        ]
      });
    }
  } catch (err) {
    console.error('No se pudo inicializar la DB con productos.json', err);
  }
}

async function listProductos() {
  await ready;
  const { rows } = await client.execute('SELECT * FROM productos ORDER BY id DESC');
  return rows.map(normalizeProducto);
}

async function upsertProducto(producto) {
  await ready;
  if (producto.id) {
    await client.execute({
      sql: `UPDATE productos
            SET name = ?, description = ?, precio = ?, categoria = ?, stock = ?, marca = ?, modelo = ?, img = COALESCE(?, img)
            WHERE id = ?`,
      args: [
        producto.name,
        producto.description || '',
        producto.precio,
        producto.categoria || '',
        producto.stock,
        producto.marca || '',
        producto.modelo || '',
        producto.img ?? null,
        producto.id
      ]
    });
    return { ...producto, id: Number(producto.id) };
  }

  const result = await client.execute({
    sql: `INSERT INTO productos (name, description, precio, categoria, stock, marca, modelo, img)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      producto.name,
      producto.description || '',
      producto.precio,
      producto.categoria || '',
      producto.stock,
      producto.marca || '',
      producto.modelo || '',
      producto.img || ''
    ]
  });

  const newId = Number(result.lastInsertRowid);
  return { ...producto, id: newId };
}

async function deleteProductoById(id) {
  await ready;
  const { rowsAffected } = await client.execute({
    sql: 'DELETE FROM productos WHERE id = ?',
    args: [id]
  });
  return rowsAffected > 0;
}

module.exports = {
  initDb,
  listProductos,
  upsertProducto,
  deleteProductoById
};
