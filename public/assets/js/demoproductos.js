document.addEventListener("DOMContentLoaded", () => {
	const WHATSAPP = "5492617735869";
	const FALLBACK = "assets/img/logo.png";

	// Skeleton card HTML for use as placeholder
	const skeletonCard = () => `
		<div class="skeleton-oferta-card">
			<div class="sk-img"></div>
			<div class="sk-body">
				<div class="sk-line sk-title"></div>
				<div class="sk-line sk-short"></div>
			</div>
		</div>`;

	// Add skeleton styles if not already present
	if (!document.getElementById("skeleton-styles")) {
		const style = document.createElement("style");
		style.id = "skeleton-styles";
		style.textContent = `
			.skeleton-oferta-card {
				background: rgba(255,255,255,0.04);
				border-radius: 12px;
				overflow: hidden;
				min-width: 200px;
			}
			.sk-img {
				height: 160px;
				background: rgba(255,255,255,0.05);
				position: relative;
				overflow: hidden;
			}
			.sk-body { padding: 0.9rem; display: flex; flex-direction: column; gap: 0.5rem; }
			.sk-line {
				height: 11px;
				border-radius: 5px;
				background: rgba(255,255,255,0.06);
				position: relative;
				overflow: hidden;
			}
			.sk-title { height: 16px; }
			.sk-short { width: 60%; }
			.sk-img::after, .sk-line::after {
				content: '';
				position: absolute;
				inset: 0;
				background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
				animation: sk-shimmer 1.5s infinite;
			}
			@keyframes sk-shimmer {
				0% { transform: translateX(-100%); }
				100% { transform: translateX(100%); }
			}`;
		document.head.appendChild(style);
	}

	function buildSkeletons(container, count = 4) {
		container.innerHTML = Array(count).fill(skeletonCard()).join("");
	}

	// ─── Productos (Tienda section) ───
	const productosContainer = document.getElementById("productos-container");
	const ofertasContainer = document.getElementById("ofertas-container");

	if (productosContainer) buildSkeletons(productosContainer, 6);
	if (ofertasContainer) buildSkeletons(ofertasContainer, 4);

	fetch("/api/productos")
		.then((r) => { if (!r.ok) throw new Error("API error"); return r.json(); })
		.then((productos) => {
			/* ── Productos agrupados por categoría ── */
			if (productosContainer) {
				productosContainer.innerHTML = "";
				if (productos.length === 0) {
					productosContainer.innerHTML = "<p style='color:rgba(255,255,255,0.4)'>Sin productos disponibles.</p>";
				} else {
					const categorias = {};
					productos.forEach((p) => {
						(categorias[p.categoria] = categorias[p.categoria] || []).push(p);
					});
					Object.keys(categorias).forEach((cat) => {
						const section = document.createElement("section");
						section.className = "categoria-section";
						const title = document.createElement("h2");
						title.textContent = cat;
						section.appendChild(title);
						const grid = document.createElement("div");
						grid.className = "productos-grid";
						categorias[cat].forEach((p) => {
							const precioFinal = p.descuento > 0
								? p.precio - (p.precio * p.descuento) / 100
								: p.precio;
							const card = document.createElement("div");
							card.className = "producto-card";
							card.dataset.id = p.id;
							card.innerHTML = `
								<img src="${p.img || FALLBACK}" alt="${p.name}" loading="lazy" onerror="this.src='${FALLBACK}'">
								<h3>${p.name}</h3>
								<p class="descripcion">${p.description}</p>
								${p.descuento > 0
									? `<p class="precio"><span class="precio-original">$${p.precio.toLocaleString("es-AR")}</span><span class="precio-descuento">$${precioFinal.toLocaleString("es-AR")}</span><span class="badge-descuento">-${p.descuento}%</span></p>`
									: `<p class="precio">$${p.precio.toLocaleString("es-AR")}</p>`}
								<button class="btn btn-comprar">Consultar</button>`;
							card.querySelector(".btn-comprar").addEventListener("click", () => {
								const msg = `Buen dia quisiera consultar sobre este producto:\n\n📌 *${p.name}*\n🏷️ Marca: ${p.marca}\n🔖 Modelo: ${p.modelo}\n💰 Precio: $${precioFinal.toLocaleString("es-AR")}`;
								window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank");
							});
							grid.appendChild(card);
						});
						section.appendChild(grid);
						productosContainer.appendChild(section);
					});
				}
			}

			/* ── Ofertas (random) ── */
			if (ofertasContainer) {
				ofertasContainer.innerHTML = "";
				const aleatorios = [...productos].sort(() => 0.5 - Math.random()).slice(0, 4);
				aleatorios.forEach((p) => {
					const card = document.createElement("div");
					card.className = "oferta-card";
					card.dataset.id = p.id;
					card.innerHTML = `
						<img src="${p.img || FALLBACK}" alt="${p.name}" loading="lazy" onerror="this.src='${FALLBACK}'">
						<h3>${p.name}</h3>
						<p class="descripcion">${p.description}</p>`;
					ofertasContainer.appendChild(card);
				});
			}
		})
		.catch((err) => {
			console.error("Error cargando productos:", err);
			if (ofertasContainer) ofertasContainer.innerHTML = "<p>Error al cargar las ofertas.</p>";
			if (productosContainer) productosContainer.innerHTML = "<p>Error al cargar productos.</p>";
		});

	// ─── Ventas ───
	const ventasContainer = document.getElementById("ventas-container");
	if (ventasContainer) {
		buildSkeletons(ventasContainer, 5);
		fetch("/api/ventas")
			.then((r) => r.json())
			.then((ventas) => {
				ventasContainer.innerHTML = "";
				ventas.forEach((v) => {
					const card = document.createElement("div");
					card.className = "oferta-card";
					card.innerHTML = `
						<img src="${v.img || FALLBACK}" alt="${v.name}" loading="lazy" onerror="this.src='${FALLBACK}'">
						<h3>${v.name}</h3>
						<p class="descripcion">${v.description}</p>
						<p class="precio">$${v.precio.toLocaleString("es-AR")}</p>
						<button class="btn btn-comprar">Consultar</button>`;
					card.querySelector(".btn-comprar").addEventListener("click", () => {
						const msg = `Quisiera consultar sobre este producto del local:\n\n📌 *${v.name}*\n🏷️ Marca: ${v.marca}\n🔖 Modelo: ${v.modelo}\n💰 Precio: $${v.precio.toLocaleString("es-AR")}`;
						window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank");
					});
					ventasContainer.appendChild(card);
				});
			})
			.catch((err) => {
				console.error("Error loading ventas", err);
				ventasContainer.innerHTML = "<p>Error al cargar ventas.</p>";
			});
	}

	// ─── Servicios ───
	const serviciosContainer = document.getElementById("servicios-ventas-container");
	if (serviciosContainer) {
		buildSkeletons(serviciosContainer, 4);
		fetch("/api/servicios")
			.then((r) => r.json())
			.then((servicios) => {
				serviciosContainer.innerHTML = "";
				servicios.forEach((s) => {
					const card = document.createElement("div");
					card.className = "oferta-card";
					const priceHtml = s.precio > 0
						? `<p class="precio">$${s.precio.toLocaleString("es-AR")}</p>`
						: "";
					card.innerHTML = `
						<img src="${s.img || FALLBACK}" alt="${s.name}" loading="lazy" onerror="this.src='${FALLBACK}'">
						<h3>${s.name}</h3>
						<p class="descripcion">${s.description}</p>
						${priceHtml}
						<button class="btn btn-comprar">Consultar</button>`;
					card.querySelector(".btn-comprar").addEventListener("click", () => {
						let msg = `Quisiera Consultar por el servicio de: ${s.name}`;
						if (s.precio > 0) msg += ` $${s.precio.toLocaleString("es-AR")}`;
						window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank");
					});
					serviciosContainer.appendChild(card);
				});
			})
			.catch((err) => {
				console.error("Error loading servicios", err);
				serviciosContainer.innerHTML = "<p>Error al cargar servicios.</p>";
			});
	}
});
