require("dotenv").config();
const { upsertProducto, clearProductos } = require("./db.js");

const productosPrueba = [
  {
    name: "PlayStation 5 Pro - Oferta Especial",
    description: "Consola de última generación con gráficos increíbles. Oferta por tiempo limitado.",
    precio: 1000000,
    categoria: "Consolas",
    stock: 10,
    marca: "Sony",
    modelo: "PS5 Pro",
    img: "https://supertec-web.vercel.app/assets/img/logo.png",
    descuento: 20,
    destacado: true
  },
  {
    name: "Xbox Series X - Destacada",
    description: "La consola más rápida y potente. Ahora como producto destacado.",
    precio: 950000,
    categoria: "Consolas",
    stock: 5,
    marca: "Microsoft",
    modelo: "Series X",
    img: "https://supertec-web.vercel.app/assets/img/logo.png",
    descuento: 0,
    destacado: true
  },
  {
    name: "Nintendo Switch OLED Edición Navidad",
    description: "Regala diversión esta Navidad con la nueva Nintendo Switch OLED.",
    precio: 600000,
    categoria: "Navidad",
    stock: 15,
    marca: "Nintendo",
    modelo: "Switch OLED",
    img: "https://supertec-web.vercel.app/assets/img/logo.png",
    descuento: 10,
    destacado: false
  },
  {
    name: "Auriculares Gaming Navidad",
    description: "Auriculares con sonido envolvente y luces festivas. Especial para las fiestas.",
    precio: 85000,
    categoria: "Navidad",
    stock: 20,
    marca: "HyperX",
    modelo: "Cloud II Christmas",
    img: "https://supertec-web.vercel.app/assets/img/logo.png",
    descuento: 15,
    destacado: true
  },
  {
    name: "Silla Gamer Supertec",
    description: "Silla ergonómica de alta calidad para largas sesiones de juego.",
    precio: 250000,
    categoria: "Accesorios",
    stock: 8,
    marca: "Supertec",
    modelo: "Pro Gamer",
    img: "https://supertec-web.vercel.app/assets/img/logo.png",
    descuento: 5,
    destacado: false
  }
];

async function run() {
  try {
    console.log("Limpiando productos anteriores...");
    await clearProductos();

    console.log("Añadiendo productos de prueba...");
    for (const p of productosPrueba) {
      await upsertProducto(p);
      console.log(`Producto '${p.name}' añadido.`);
    }

    console.log("Todos los productos de prueba añadidos correctamente.");
    process.exit(0);
  } catch (error) {
    console.error("Error añadiendo productos de prueba:", error);
    process.exit(1);
  }
}

run();
