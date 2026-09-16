require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const SPIDER_API_BASE = "https://spiderwebargapi.com.ar/api/v1";
const SPIDER_API_KEY = "c90d1502ce815ea5d1108662186145d3cefe642586466c769d4c7fae63086ac6";
const SPIDER_DB = "sw_Franco Calegari_supertec";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function spiderQuery(sql) {
  const res = await fetch(`${SPIDER_API_BASE}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SPIDER_API_KEY,
    },
    body: JSON.stringify({ database: SPIDER_DB, query: sql }),
  });
  const data = await res.json();
  if (!data.success && !data.result) {
    throw new Error(`Spider query failed: ${JSON.stringify(data)}`);
  }
  return data;
}

function escapeStr(val) {
  if (val === null || val === undefined) return "NULL";
  return `'${String(val).replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
}

async function migrateTable(tableName, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  [SKIP] ${tableName}: sin datos en Supabase`);
    return { inserted: 0, errors: 0 };
  }
  let inserted = 0;
  let errors = 0;
  for (const row of rows) {
    let sql;
    if (tableName === "horarios") {
      sql = `INSERT IGNORE INTO horarios (id, day, \`open\`, \`close\`, closed) VALUES (${row.id}, ${escapeStr(row.day)}, ${escapeStr(row.open)}, ${escapeStr(row.close)}, ${row.closed ? 1 : 0})`;
    } else {
      sql = `INSERT IGNORE INTO ${tableName} (id, name, description, precio, categoria, stock, marca, modelo, img) VALUES (${row.id}, ${escapeStr(row.name)}, ${escapeStr(row.description)}, ${Number(row.precio) || 0}, ${escapeStr(row.categoria)}, ${Number(row.stock) || 0}, ${escapeStr(row.marca)}, ${escapeStr(row.modelo)}, ${escapeStr(row.img)})`;
    }
    try {
      await spiderQuery(sql);
      inserted++;
    } catch (err) {
      console.error(`  [ERROR] ${tableName} id=${row.id}: ${err.message}`);
      errors++;
    }
  }
  return { inserted, errors };
}

async function main() {
  console.log("Iniciando migracion Supabase -> SpiderWebAPI");
  console.log(`Base de datos destino: ${SPIDER_DB}\n`);

  const tables = ["productos", "ventas", "servicios", "horarios"];
  const report = {};

  for (const table of tables) {
    console.log(`Migrando tabla: ${table}...`);
    const { data, error } = await supabase.from(table).select("*").order("id", { ascending: true });

    if (error) {
      console.error(`  [ERROR] No se pudo leer ${table} desde Supabase: ${error.message}`);
      report[table] = { inserted: 0, errors: 1 };
      continue;
    }

    console.log(`  -> ${data.length} registros encontrados en Supabase`);
    const result = await migrateTable(table, data);
    report[table] = result;
    console.log(`  OK: ${result.inserted} insertados, ${result.errors} errores`);
  }

  console.log("\n--- REPORTE FINAL ---");
  for (const [table, stats] of Object.entries(report)) {
    console.log(`${table}: ${stats.inserted} migrados, ${stats.errors} errores`);
  }
  console.log("Migracion completada.");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
