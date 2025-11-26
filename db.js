const fs = require('fs');
const path = require('path');
const { list, put } = require('@vercel/blob');

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_PREFIX = process.env.BLOB_PREFIX || 'db/';
const BLOB_KEY = process.env.BLOB_PRODUCTS_KEY || 'productos.json';
const BLOB_PATH = `${BLOB_PREFIX}${BLOB_KEY}`;
const useBlob = Boolean(BLOB_TOKEN);

const localStorePath = process.env.LOCAL_STORE_PATH || path.join(__dirname, 'var', 'productos.local.json');
const seedPath = path.join(__dirname, 'public', 'assets', 'json', 'productos.json');

const normalizeProducto = (p) => ({
  id: Number(p.id),
  name: p.name,
  description: p.description || '',
  precio: Number(p.precio) || 0,
  categoria: p.categoria || '',
  stock: Number(p.stock) || 0,
  marca: p.marca || '',
  modelo: p.modelo || '',
  img: p.img || ''
});

async function getBlobUrl() {
  if (!useBlob) return null;
  const { blobs } = await list({ prefix: BLOB_PATH, token: BLOB_TOKEN });
  const exact = blobs?.find(b => b.pathname === BLOB_PATH);
  return (exact || blobs?.[0])?.url || null;
}

async function readProductos() {
  if (useBlob) {
    const url = await getBlobUrl();
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Blob fetch status ${res.status}`);
    return res.json();
  }

  if (fs.existsSync(localStorePath)) {
    return JSON.parse(fs.readFileSync(localStorePath, 'utf-8'));
  }
  return null;
}

async function writeProductos(productos) {
  if (useBlob) {
    await put(BLOB_PATH, JSON.stringify(productos, null, 2), {
      access: 'public',
      contentType: 'application/json',
      token: BLOB_TOKEN,
      addRandomSuffix: false
    });
    return;
  }

  fs.mkdirSync(path.dirname(localStorePath), { recursive: true });
  fs.writeFileSync(localStorePath, JSON.stringify(productos, null, 2));
}

async function seedFromFile() {
  if (!fs.existsSync(seedPath)) return [];
  try {
    const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    console.log(`[DB] Sembrando almacenamiento con ${seed.length} productos iniciales`);
    await writeProductos(seed);
    return seed;
  } catch (err) {
    console.error('[DB] No se pudo leer seed productos.json', err);
    return [];
  }
}

async function initDb() {
  try {
    const existing = await readProductos();
    if (existing) {
      if (useBlob) {
        console.log(`[DB] Conectado a Blob y datos existentes encontrados (${existing.length}) en ${BLOB_PATH}`);
      } else {
        console.log(`[DB] Con almacenamiento local en ${localStorePath} con ${existing.length} productos`);
      }
      return;
    }
    await seedFromFile();
    if (useBlob) {
      console.log(`[DB] Conectado a Blob y base inicial creada en ${BLOB_PATH}`);
    } else {
      console.log(`[DB] Base local inicial creada en ${localStorePath}`);
    }
  } catch (err) {
    console.error('[DB] Error inicializando almacenamiento', err);
    throw err;
  }
}

async function listProductos() {
  const productos = await readProductos();
  if (!productos) return [];
  return productos.map(normalizeProducto);
}

async function upsertProducto(producto) {
  let productos = await readProductos();
  if (!productos) productos = await seedFromFile();

  if (producto.id) {
    const idx = productos.findIndex(p => Number(p.id) === Number(producto.id));
    if (idx !== -1) {
      productos[idx] = normalizeProducto({ ...productos[idx], ...producto });
    } else {
      productos.push(normalizeProducto(producto));
    }
  } else {
    const nextId = productos.length ? Math.max(...productos.map(p => Number(p.id))) + 1 : 1;
    productos.push(normalizeProducto({ ...producto, id: nextId }));
    producto.id = nextId;
  }

  await writeProductos(productos);
  return normalizeProducto(producto);
}

async function deleteProductoById(id) {
  let productos = await readProductos();
  if (!productos) productos = [];
  const before = productos.length;
  productos = productos.filter(p => Number(p.id) !== Number(id));
  if (productos.length === before) return false;
  await writeProductos(productos);
  return true;
}

module.exports = {
  initDb,
  listProductos,
  upsertProducto,
  deleteProductoById
};
