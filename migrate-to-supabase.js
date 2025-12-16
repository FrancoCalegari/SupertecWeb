#!/usr/bin/env node

/**
 * Migration Script: Vercel Blob Storage -> Supabase
 *
 * This script reads data from Vercel Blob Storage and migrates it to Supabase.
 *
 * Prerequisites:
 * 1. Run supabase_schema.sql in your Supabase SQL Editor
 * 2. Set environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BLOB_READ_WRITE_TOKEN
 *
 * Usage:
 *   node migrate-to-supabase.js
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { list } = require("@vercel/blob");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_PREFIX = process.env.BLOB_PREFIX || "db/";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
	console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
	process.exit(1);
}

if (!BLOB_TOKEN) {
	console.error("❌ BLOB_READ_WRITE_TOKEN must be set to migrate from blob");
	console.log("ℹ️  If you don't have blob data, you can skip this migration");
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getBlobData(key) {
	const blobPath = `${BLOB_PREFIX}${key}`;
	console.log(`📥 Fetching ${key} from blob storage...`);

	try {
		const { blobs } = await list({ prefix: blobPath, token: BLOB_TOKEN });
		const exact = blobs?.find((b) => b.pathname === blobPath);
		const url = (exact || blobs?.[0])?.url;

		if (!url) {
			console.log(`⚠️  No blob found for ${key}`);
			return null;
		}

		const res = await fetch(url);
		if (!res.ok) {
			console.error(`❌ Failed to fetch ${key}: ${res.status}`);
			return null;
		}

		const data = await res.json();
		console.log(
			`✅ Found ${Array.isArray(data) ? data.length : 0} items in ${key}`
		);
		return data;
	} catch (error) {
		console.error(`❌ Error fetching ${key}:`, error.message);
		return null;
	}
}

async function migrateTable(tableName, data) {
	if (!data || (Array.isArray(data) && data.length === 0)) {
		console.log(`⏭️  Skipping ${tableName} (no data)`);
		return;
	}

	console.log(
		`📤 Migrating ${
			Array.isArray(data) ? data.length : "N/A"
		} items to ${tableName}...`
	);

	try {
		// For horarios, we update by day instead of inserting
		if (tableName === "horarios") {
			for (const h of data) {
				const { error } = await supabase
					.from("horarios")
					.update({ open: h.open, close: h.close, closed: h.closed })
					.eq("day", h.day);

				if (error) throw error;
			}
		} else {
			// For productos, ventas, servicios - insert
			const { error } = await supabase.from(tableName).insert(data);
			if (error) throw error;
		}

		console.log(`✅ Successfully migrated ${tableName}`);
	} catch (error) {
		console.error(`❌ Error migrating ${tableName}:`, error.message);
		throw error;
	}
}

async function verifyMigration(tableName) {
	const { data, error } = await supabase
		.from(tableName)
		.select("id", { count: "exact" });

	if (error) {
		console.error(`❌ Error verifying ${tableName}:`, error.message);
		return;
	}

	console.log(`✅ ${tableName}: ${data?.length || 0} rows`);
}

async function main() {
	console.log("🚀 Starting migration from Vercel Blob to Supabase...\n");

	try {
		// Fetch data from blob
		const productos = await getBlobData("productos.json");
		const ventas = await getBlobData("ventas.json");
		const servicios = await getBlobData("servicios.json");
		const horarios = await getBlobData("horarios.json");

		console.log("\n📊 Migration Summary:");
		console.log("─".repeat(50));

		// Migrate each table
		if (productos && Array.isArray(productos)) {
			await migrateTable("productos", productos);
		}

		if (ventas && Array.isArray(ventas)) {
			await migrateTable("ventas", ventas);
		}

		if (servicios && Array.isArray(servicios)) {
			await migrateTable("servicios", servicios);
		}

		if (horarios && Array.isArray(horarios)) {
			await migrateTable("horarios", horarios);
		}

		console.log("\n🔍 Verifying migration...");
		console.log("─".repeat(50));

		await verifyMigration("productos");
		await verifyMigration("ventas");
		await verifyMigration("servicios");
		await verifyMigration("horarios");

		console.log("\n✅ Migration completed successfully!");
		console.log("\nNext steps:");
		console.log("1. Verify data in Supabase Table Editor");
		console.log("2. Update .env with Supabase credentials");
		console.log("3. Deploy to Vercel with new environment variables");
		console.log("4. (Optional) Keep blob storage as backup for a while");
	} catch (error) {
		console.error("\n❌ Migration failed:", error);
		process.exit(1);
	}
}

main();
