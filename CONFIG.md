# Configuración y despliegue (Vercel + SQLite)

## Variables de entorno
- `SESSION_SECRET`: secreto para la cookie de sesión.
- `ADMIN_USER` / `ADMIN_PASS`: credenciales del dashboard.
- `DB_URL`: URL SQLite/libsql. Local por defecto: `file:./var/data.sqlite`. Para remoto (recomendado en Vercel) usa un endpoint LibSQL/Turso, ej. `libsql://<tu-db>.turso.io`.
- `DB_AUTH_TOKEN`: token para la base remota (si aplica).
- `BLOB_READ_WRITE_TOKEN`: token de Vercel Blob para subir imágenes desde el dashboard.
- `UPLOAD_DIR` (opcional): carpeta de subidas en local. En Vercel el filesystem es efímero; las imágenes se suben a Blob si `BLOB_READ_WRITE_TOKEN` está configurado.

## Uso local
1) `npm install`
2) Crear `.env` con las variables (o exportarlas).
3) Ejecutar `npm start` y acceder a `http://localhost:3000`.

## Despliegue en Vercel
- El handler serverless está en `api/index.js` y todos los paths se reescriben ahí (`vercel.json`). Express sigue sirviendo HTML y `/assets` desde `public`.
- Sesiones: se guardan en cookie (no en memoria), aptas para serverless.
- Imágenes: el filesystem de Vercel es efímero; con `BLOB_READ_WRITE_TOKEN` las subidas del dashboard se envían a Vercel Blob y se guarda la URL pública. También puedes pegar una URL externa manualmente.

### Conectar una base SQLite remota (Turso/libsql)
1) Instala CLI Turso: `curl -sSf https://get.tur.so/install.sh | bash`
2) Crea DB y token:
   ```bash
   turso db create supertec
   turso db tokens create supertec --expiry 8760h
   turso db show supertec  # para obtener la URL libsql://...
   ```
3) En tu proyecto Vercel agrega variables:
   - `DB_URL` = la URL libsql obtenida.
   - `DB_AUTH_TOKEN` = el token generado.
   - `SESSION_SECRET`, `ADMIN_USER`, `ADMIN_PASS` con tus valores.
   Usa `vercel env add <VAR>` o el panel web.
4) Deploy: `vercel --prod`.

### Conectar Vercel Blob
1) Crea un Blob store en el panel de Vercel.
2) Copia el token de RW y guárdalo como `BLOB_READ_WRITE_TOKEN` en Vercel y en tu `.env.local` si pruebas en dev.
3) Las imágenes se suben a `productos/<timestamp>-<id>.ext` y el campo `img` de cada producto queda con la URL pública retornada por Blob.

> Si prefieres otra base gestionada (p. ej. Neon/Postgres), adapta `db.js` para usar el cliente correspondiente; la reescritura serverless se mantiene igual.
