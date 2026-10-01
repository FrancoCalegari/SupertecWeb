-- ============================================================
-- SupertecWeb v2 — Schema additions
-- Ejecutar en SpiderWebAPI (MariaDB)
-- ============================================================

-- ── 1. Columnas adicionales en productos ──
ALTER TABLE productos ADD COLUMN IF NOT EXISTS descuento INT DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_original DECIMAL(12,2) DEFAULT NULL;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS destacado TINYINT(1) DEFAULT 0;

-- ── 2. Categorías personalizadas ──
CREATE TABLE IF NOT EXISTS categorias (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  icono       VARCHAR(50)  DEFAULT 'fa-tag',
  color       VARCHAR(20)  DEFAULT '#fb383a',
  filtros     TEXT,                          
  activa      TINYINT(1)   DEFAULT 1,
  orden       INT          DEFAULT 0,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── 3. Pedidos ──
CREATE TABLE IF NOT EXISTS pedidos (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  mp_preference_id    VARCHAR(200),
  mp_payment_id       VARCHAR(200),
  mp_status           VARCHAR(50),
  estado              VARCHAR(30)   DEFAULT 'pendiente',
  cliente_nombre      VARCHAR(200)  NOT NULL,
  cliente_email       VARCHAR(200)  NOT NULL,
  cliente_telefono    VARCHAR(50),
  envio_calle         VARCHAR(200),
  envio_ciudad        VARCHAR(100),
  envio_provincia     VARCHAR(100),
  envio_cp            VARCHAR(20),
  envio_notas         TEXT,
  items               TEXT          NOT NULL,
  total               DECIMAL(12,2) NOT NULL DEFAULT 0,
  codigo_seguimiento  VARCHAR(30)   UNIQUE,
  tracking_empresa    VARCHAR(100),
  tracking_numero     VARCHAR(100),
  tracking_url        TEXT,
  notas_admin         TEXT,
  created_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
