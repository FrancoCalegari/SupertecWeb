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

    fetch("./assets/json/productos.json")
        .then(response => {
            if (!response.ok) throw new Error("Error al cargar el JSON");
            return response.json();
        })
        .then(productos => {
            /* ======================
               Render de Productos agrupados por Categoría
            ====================== */
            if (productosContainer) {
                productosContainer.innerHTML = ""; // 🔹 Limpio loader

                // Agrupar por categoría
                const categorias = {};
                productos.forEach(producto => {
                    if (!categorias[producto.categoria]) {
                        categorias[producto.categoria] = [];
                    }
                    categorias[producto.categoria].push(producto);
                });

                // Renderizar secciones
                Object.keys(categorias).forEach(categoria => {
                    const section = document.createElement("section");
                    section.classList.add("categoria-section");

                    const title = document.createElement("h2");
                    title.textContent = categoria;
                    section.appendChild(title);

                    const grid = document.createElement("div");
                    grid.classList.add("productos-grid");

                    categorias[categoria].forEach(producto => {
                        const precioFinal = producto.descuento > 0
                            ? producto.precio - (producto.precio * producto.descuento / 100)
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
                                    <span class="precio-original">$${producto.precio.toLocaleString("es-AR")}</span>
                                    <span class="precio-descuento">$${precioFinal.toLocaleString("es-AR")}</span>
                                    <span class="badge-descuento">-${producto.descuento}%</span>
                                   </p>`
                                : `<p class="precio">$${producto.precio.toLocaleString("es-AR")}</p>`
                            }
                            <button class="btn btn-comprar">Comprar</button>
                        `;

                        // 🔹 Evento botón WhatsApp
                        card.querySelector(".btn-comprar").addEventListener("click", () => {
                            const mensaje = `Buen dia quisiera consultar sobre este producto:\n\n📌 *${producto.name}*\n🏷️ Marca: ${producto.marca}\n🔖 Modelo: ${producto.modelo}\n💰 Precio: $${precioFinal.toLocaleString("es-AR")}`;
                            const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
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
                    .slice(0, 5);

                productosAleatorios.forEach(producto => {
                    const precioFinal = producto.descuento > 0
                        ? producto.precio - (producto.precio * producto.descuento / 100)
                        : producto.precio;

                    const ofertaCard = document.createElement("div");
                    ofertaCard.classList.add("oferta-card");
                    ofertaCard.setAttribute("data-id", producto.id);

                    ofertaCard.innerHTML = `
                        <img src="${producto.img}" alt="${producto.name}">
                        <h3>${producto.name}</h3>
                        <p class="descripcion">${producto.description}</p>
                        ${
                            producto.descuento > 0 
                            ? `<p class="precio">
                                <span class="precio-original">$${producto.precio.toLocaleString("es-AR")}</span>
                                <span class="precio-descuento">$${precioFinal.toLocaleString("es-AR")}</span>
                                <span class="badge-descuento">-${producto.descuento}%</span>
                               </p>`
                            : `<p class="precio">$${producto.precio.toLocaleString("es-AR")}</p>`
                        }
                        <button class="btn btn-comprar">Comprar</button>
                    `;

                    // 🔹 Evento botón WhatsApp
                    ofertaCard.querySelector(".btn-comprar").addEventListener("click", () => {
                        const mensaje = `Quisiera consultar sobre este producto:\n\n📌 *${producto.name}*\n🏷️ Marca: ${producto.marca}\n🔖 Modelo: ${producto.modelo}\n💰 Precio: $${precioFinal.toLocaleString("es-AR")}`;
                        const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
                        window.open(url, "_blank");
                    });

                    ofertasContainer.appendChild(ofertaCard);
                });
            }
        })
        .catch(error => {
            console.error("Error cargando productos:", error);
            if (productosContainer) productosContainer.innerHTML = "<p>Error al cargar los productos.</p>";
            if (ofertasContainer) ofertasContainer.innerHTML = "<p>Error al cargar las ofertas.</p>";
        });
});
