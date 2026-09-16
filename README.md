# SupertecWeb 🛒

Sitio web de **Supertec** — tienda de tecnología y gaming en Mendoza, Argentina.  
Stack: **Node.js + Express** · **SpiderWebAPI** (MariaDB + Cloud Storage) · HTML/CSS/JS vanilla.

---

## 🚀 Levantar el proyecto localmente

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar el archivo de entorno y completar con tus credenciales
cp .env.model .env

# 3. Iniciar el servidor de desarrollo
npm start
# → Servidor disponible en http://localhost:3000
```

---

## 🌐 Rutas Públicas (sin login)

| URL | Descripción |
|-----|-------------|
| `http://localhost:3000/` | Página principal (hero, servicios, horarios, FAQs, contacto) |
| `http://localhost:3000/tienda` | Tienda online con búsqueda, filtros y catálogo de productos |
| `http://localhost:3000/login` | Formulario de inicio de sesión del administrador |

---

## 🔐 Acceso al Panel de Administración

### Paso 1 — Ir al login

Navegar a:
```
http://localhost:3000/login
```

> En producción (Vercel):
> ```
> https://supertec-web.vercel.app/login
> ```

### Paso 2 — Ingresar credenciales

Las credenciales se leen desde el archivo `.env`:

```env
ADMIN_USER=admin
ADMIN_PASS=admin123
```

> [!WARNING]
> Cambiar estas credenciales antes de ir a producción. El valor por defecto es solo para desarrollo local.

### Paso 3 — Dashboard

Luego del login exitoso, se redirige automáticamente a:
```
http://localhost:3000/admindashboard
```

> ⚠️ Esta ruta requiere sesión activa. Acceder directamente sin login redirige a `/login`.

---

## 🛠️ Panel de Administración (`/admindashboard`)

El dashboard tiene **5 tabs**:

| Tab | Descripción |
|-----|-------------|
| **Productos** | Gestionar el catálogo de productos de la tienda |
| **Ventas Local** | Artículos disponibles en el local físico para la venta |
| **Servicios** | Servicios ofrecidos (reparación, etc.) |
| **Horarios** | Editar los horarios de atención de lunes a domingo |
| **Configuración** | Exportar/Importar datos en JSON y limpiar tablas |

### Acciones disponibles en Productos / Ventas / Servicios:
- ➕ **Agregar** nuevo registro con imagen (URL o subida de archivo)
- ✏️ **Editar** un registro existente (incluye preview de imagen)
- 🗑️ **Eliminar** con confirmación modal
- ✅ Feedback via **toast notifications** (no más alertas del navegador)

---

## 📡 API Endpoints

### Endpoints Públicos (sin autenticación)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/productos` | Lista todos los productos del catálogo |
| `GET` | `/api/ventas` | Lista todos los artículos de venta local |
| `GET` | `/api/servicios` | Lista todos los servicios |
| `GET` | `/api/horarios` | Obtiene los horarios de atención |

### Endpoints de Escritura (sin autenticación requerida actualmente — solo desde el dashboard)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/productos` | Crear o actualizar producto (multipart/form-data) |
| `POST` | `/api/ventas` | Crear o actualizar venta |
| `POST` | `/api/servicios` | Crear o actualizar servicio |
| `POST` | `/api/horarios` | Actualizar horarios (JSON body) |
| `DELETE` | `/api/productos/:id` | Eliminar producto por ID |
| `DELETE` | `/api/ventas/:id` | Eliminar venta por ID |
| `DELETE` | `/api/servicios/:id` | Eliminar servicio por ID |

### Endpoints de Administración (requieren sesión)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/admin/export/:type` | Exportar datos de `productos`, `ventas`, `servicios` u `horarios` como JSON |
| `POST` | `/api/admin/import/:type` | Importar datos desde un archivo JSON |
| `DELETE` | `/api/admin/clear/:type` | Eliminar todos los datos de una tabla |

### Proxy Spider API (para uso interno)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/spider-proxy/query` | Ejecutar SQL en SpiderWebAPI |
| `POST` | `/api/spider-proxy/upload` | Subir archivo a Spider Cloud Storage |
| `GET` | `/api/spider-proxy/file/:id` | Descargar/redirigir a un archivo por ID |

---

## ⚙️ Variables de Entorno

Copiar `.env.model` a `.env` y completar los valores:

```env
# Credenciales del panel admin
ADMIN_USER=admin
ADMIN_PASS=tu_contraseña_segura
SESSION_SECRET=una_cadena_aleatoria_larga

# SpiderWebAPI (base de datos y storage)
SPIDERWEB_API_BASE=https://spiderwebargapi.com.ar/api/v1
SPIDERWEB_API_KEY=tu-api-key
SPIDERWEB_DB_NAME=sw_TuUsuario_supertec
SPIDERWEB_CLOUD_STORAGE_ID=1

# (Opcional) Cache TTL en ms — default: 5 minutos
# CACHE_TTL=300000

# (Opcional) Carpeta de imágenes local para dev sin Spider API
UPLOAD_DIR=./public/assets/img/productos
```

---

## 📁 Estructura del Proyecto

```
SupertecWeb/
├── app.js                    # Servidor Express — rutas y lógica principal
├── db.js                     # Capa de acceso a datos (SpiderWebAPI)
├── api/
│   └── index.js              # Entry point para Vercel (serverless)
├── vercel.json               # Configuración de despliegue en Vercel
├── .env                      # Variables de entorno (NO commitear)
├── .env.model                # Plantilla de variables de entorno
├── index.html                # Página principal
├── tienda.html               # Tienda online
├── login.html                # Login del administrador
├── admindashboard.html       # Panel de administración
└── public/
    └── assets/
        ├── css/
        │   ├── styles.css    # Estilos globales
        │   └── responsive.css
        ├── js/
        │   ├── demoproductos.js   # Carga dinámica de productos/ventas/servicios
        │   ├── hours.js           # Renderizado de horarios en el frontend
        │   ├── background.js      # Fondo dinámico
        │   └── version_control.js
        └── img/              # Imágenes estáticas (logo, fondos, etc.)
```

---

## 🚀 Despliegue en Vercel

1. Conectar el repositorio en [vercel.com](https://vercel.com).
2. Agregar las variables de entorno en **Settings → Environment Variables**.
3. Vercel detecta automáticamente `vercel.json` y enruta todo a `api/index.js`.

```json
// vercel.json
{
  "version": 2,
  "rewrites": [{ "source": "/(.*)", "destination": "/api/index.js" }]
}
```

> URL de producción: `https://supertec-web.vercel.app`

---

## 🔑 Flujo de Sesión

```
Usuario → GET /login
       → POST /login (username + password)
       → Si OK → cookie-session activa → redirect /admindashboard
       → Si ERROR → redirect /login?error=1
       → GET /logout → destruye sesión → redirect /login
```

La sesión se gestiona con `cookie-session` firmada con `SESSION_SECRET`.
