document.addEventListener("DOMContentLoaded", () => {
	const productosContainer = document.getElementById("productos-container");
	const ofertasContainer = document.getElementById("ofertas-container");

	// 🔹 Número de WhatsApp (cámbialo por el tuyo con código de país, sin + ni 00)
	const whatsappNumber = "5492617735869";

	// Loader HTML
	const loaderHTML = `
        <div class="loader">
            <div class="spinner"></div>
            <p>Cargando...</p>
        </div>
    `;

	if (productosContainer) productosContainer.innerHTML = loaderHTML;
	if (ofertasContainer) ofertasContainer.innerHTML = loaderHTML;

	fetch("/api/productos")
		.then((response) => {
			if (!response.ok) throw new Error("Error al cargar el JSON");
			return response.json();
		})
		.then((productos) => {
			/* ======================
               Render de Productos agrupados por Categoría
            ====================== */
			if (productosContainer) {
				productosContainer.innerHTML = ""; // 🔹 Limpio loader

				// Agrupar por categoría
				const categorias = {};
				productos.forEach((producto) => {
					if (!categorias[producto.categoria]) {
						categorias[producto.categoria] = [];
					}
					categorias[producto.categoria].push(producto);
				});

				// Renderizar secciones
				Object.keys(categorias).forEach((categoria) => {
					const section = document.createElement("section");
					section.classList.add("categoria-section");

					const title = document.createElement("h2");
					title.textContent = categoria;
					section.appendChild(title);

					const grid = document.createElement("div");
					grid.classList.add("productos-grid");

					categorias[categoria].forEach((producto) => {
						const precioFinal =
							producto.descuento > 0
								? producto.precio - (producto.precio * producto.descuento) / 100
								: producto.precio;

						const card = document.createElement("div");
						card.classList.add("producto-card");
						card.setAttribute("data-id", producto.id);

						card.innerHTML = `
                            <img src="${producto.img}" alt="${producto.name}">
                            <h3>${producto.name}</h3>
                            <p class="descripcion">${producto.description}</p>
                            ${
															producto.descuento > 0
																? `<p class="precio">
                                    <span class="precio-original">$${producto.precio.toLocaleString(
																			"es-AR"
																		)}</span>
                                    <span class="precio-descuento">$${precioFinal.toLocaleString(
																			"es-AR"
																		)}</span>
                                    <span class="badge-descuento">-${
																			producto.descuento
																		}%</span>
                                   </p>`
																: `<p class="precio">$${producto.precio.toLocaleString(
																		"es-AR"
																  )}</p>`
														}
                            <button class="btn btn-comprar">Consultar</button>
                        `;

						// 🔹 Evento botón WhatsApp
						card.querySelector(".btn-comprar").addEventListener("click", () => {
							const mensaje = `Buen dia quisiera consultar sobre este producto:\n\n📌 *${
								producto.name
							}*\n🏷️ Marca: ${producto.marca}\n🔖 Modelo: ${
								producto.modelo
							}\n💰 Precio: $${precioFinal.toLocaleString("es-AR")}`;
							const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
								mensaje
							)}`;
							window.open(url, "_blank");
						});

						grid.appendChild(card);
					});

					section.appendChild(grid);
					productosContainer.appendChild(section);
				});
			}

			/* ======================
               Render de Ofertas (Random con descuento)
            ====================== */
			if (ofertasContainer) {
				ofertasContainer.innerHTML = ""; // 🔹 Limpio loader

				const productosAleatorios = [...productos]
					.sort(() => 0.5 - Math.random())
					.slice(0, 4);

				productosAleatorios.forEach((producto) => {
					const precioFinal =
						producto.descuento > 0
							? producto.precio - (producto.precio * producto.descuento) / 100
							: producto.precio;

					const ofertaCard = document.createElement("div");
					ofertaCard.classList.add("oferta-card");
					ofertaCard.setAttribute("data-id", producto.id);

					ofertaCard.innerHTML = `
                        <img src="${producto.img}" alt="${producto.name}">
                        <h3>${producto.name}</h3>
                        <p class="descripcion">${producto.description}</p>
                    `;

					ofertasContainer.appendChild(ofertaCard);
				});
			}
		})
		.catch((error) => {
			console.error("Error cargando productos:", error);
			if (ofertasContainer)
				ofertasContainer.innerHTML = "<p>Error al cargar las ofertas.</p>";
		});

	// Fetch Ventas
	const ventasContainer = document.getElementById("ventas-container");
	if (ventasContainer) {
		ventasContainer.innerHTML = loaderHTML;
		fetch("/api/ventas")
			.then((res) => res.json())
			.then((ventas) => {
				ventasContainer.innerHTML = "";
				ventas.forEach((venta) => {
					const card = document.createElement("div");
					card.classList.add("oferta-card"); // Reutilizamos estilo de oferta-card
					card.innerHTML = `
                        <img src="${venta.img}" alt="${venta.name}">
                        <h3>${venta.name}</h3>
                        <p class="descripcion">${venta.description}</p>
                        <p class="precio">$${venta.precio.toLocaleString(
													"es-AR"
												)}</p>
                        <button class="btn btn-comprar">Consultar</button>
                    `;
					// 🔹 Evento botón WhatsApp
					card.querySelector(".btn-comprar").addEventListener("click", () => {
						const mensaje = `Quisiera consultar sobre este producto del local:\n\n📌 *${
							venta.name
						}*\n🏷️ Marca: ${venta.marca}\n🔖 Modelo: ${
							venta.modelo
						}\n💰 Precio: $${venta.precio.toLocaleString("es-AR")}`;
						const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
							mensaje
						)}`;
						window.open(url, "_blank");
					});
					ventasContainer.appendChild(card);
				});
			})
			.catch((err) => {
				console.error("Error loading ventas", err);
				ventasContainer.innerHTML = "<p>Error al cargar ventas.</p>";
			});
	}

	// Fetch Servicios
	const serviciosContainer = document.getElementById(
		"servicios-ventas-container"
	);
	if (serviciosContainer) {
		serviciosContainer.innerHTML = loaderHTML;
		fetch("/api/servicios")
			.then((res) => res.json())
			.then((servicios) => {
				serviciosContainer.innerHTML = "";
				servicios.forEach((servicio) => {
					const card = document.createElement("div");
					card.classList.add("oferta-card"); // Reutilizamos estilo

					let priceHtml = "";
					if (servicio.precio && servicio.precio > 0) {
						priceHtml = `<p class="precio">$${servicio.precio.toLocaleString(
							"es-AR"
						)}</p>`;
					}

					card.innerHTML = `
                        <img src="${servicio.img}" alt="${servicio.name}">
                        <h3>${servicio.name}</h3>
                        <p class="descripcion">${servicio.description}</p>
                        ${priceHtml}
                        <button class="btn btn-comprar">Consultar</button>
                    `;
					// 🔹 Evento botón WhatsApp
					card.querySelector(".btn-comprar").addEventListener("click", () => {
						let mensaje = `Quisiera Consultar por el servicio de: ${servicio.name}`;
						if (servicio.precio && servicio.precio > 0) {
							mensaje += ` $${servicio.precio.toLocaleString("es-AR")}`;
						}
						const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
							mensaje
						)}`;
						window.open(url, "_blank");
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
