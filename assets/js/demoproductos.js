document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("productos-container");

    fetch("./assets/json/productos.json")
        .then(response => {
            if (!response.ok) throw new Error("Error al cargar el JSON");
            return response.json();
        })
        .then(productos => {
            container.innerHTML = ""; // Limpia contenido

            productos.forEach(producto => {
                const card = document.createElement("div");
                card.classList.add("producto-card");
                card.setAttribute("data-id", producto.id);

                card.innerHTML = `
                    <img src="${producto.img}" alt="${producto.name}">
                    <h3>${producto.name}</h3>
                    <p class="descripcion">${producto.description}</p>
                    <p class="precio">$${producto.precio.toLocaleString("es-AR")}</p>
                    <button class="btn">Comprar</button>
                `;

                container.appendChild(card);
            });
        })
        .catch(error => {
            console.error("Error cargando productos:", error);
            container.innerHTML = "<p>Error al cargar los productos.</p>";
        });

// Scroll horizontal con la rueda del mouse (más fuerza y suavidad)
container.addEventListener("wheel", (evt) => {
    evt.preventDefault();
    container.scrollBy({
        left: evt.deltaY * 4, // multiplica para dar más fuerza
    });
});

});
