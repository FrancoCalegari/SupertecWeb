import { apiFetch, API_BASE_URL } from "./api.js";
import { initSorteoTab } from "./sorteo-admin.js";

let productos = [];
let ventas = [];
let servicios = [];
let horarios = [];
let currentType = "productos"; // 'productos', 'ventas', 'servicios'

document.addEventListener("DOMContentLoaded", async () => {
	// 1. Check Auth (by trying to access a protected route, e.g. export)
	// If we fail here, redirect to login
	try {
		const check = await apiFetch("/api/admin/export/productos");
		if (
			check.url.includes("login") ||
			check.status === 401 ||
			check.status === 403
		) {
			window.location.href = "login.html";
			return;
		}
	} catch (e) {
		// If error is network, well... user will see empty stuff
	}

	// Bind Listeners
	document.getElementById("logoutBtn").addEventListener("click", async () => {
		await apiFetch("/logout");
		window.location.href = "index.html";
	});

	// Valid buttons mapping
	document.getElementById("btn-tab-productos").onclick = () =>
		openTab("tab-productos", "productos");
	document.getElementById("btn-tab-ventas").onclick = () =>
		openTab("tab-ventas", "ventas");
	document.getElementById("btn-tab-servicios").onclick = () =>
		openTab("tab-servicios", "servicios");
	document.getElementById("btn-tab-horarios").onclick = () =>
		openTab("tab-horarios", "horarios");
	document.getElementById("btn-tab-config").onclick = () =>
		openTab("tab-config", "config");
	document.getElementById("btn-tab-sorteo").onclick = () =>
		openTab("tab-sorteo", "sorteo");

	document.getElementById("btnAddProductos").onclick = () =>
		showForm("productos");
	document.getElementById("btnAddVentas").onclick = () => showForm("ventas");
	document.getElementById("btnAddServicios").onclick = () =>
		showForm("servicios");

	document.getElementById("productForm").onsubmit = saveProduct;
	document.getElementById("modalCancelBtn").onclick = hideForm;
	document.getElementById("horariosForm").onsubmit = saveHorarios;

	// Config buttons
	document.querySelectorAll(".btn-export").forEach((btn) => {
		btn.onclick = () => exportData(btn.dataset.type);
	});
	document.querySelectorAll(".btn-import").forEach((btn) => {
		btn.onclick = () => importData(btn.dataset.type);
	});
	document.querySelectorAll(".btn-clear").forEach((btn) => {
		btn.onclick = () => clearData(btn.dataset.type);
	});

	// Close modal on outside click
	window.onclick = function (event) {
		const modal = document.getElementById("productModal");
		if (event.target == modal) hideForm();
	};

	// Initial Load
	loadProductos();
});

// --- Tabs Logic ---
function openTab(tabId, type) {
	document
		.querySelectorAll(".tab-content")
		.forEach((t) => t.classList.remove("active"));
	document
		.querySelectorAll(".tab-btn")
		.forEach((b) => b.classList.remove("active"));

	document.getElementById(tabId).classList.add("active");

	// Set active button
	const btnIds = {
		productos: "btn-tab-productos",
		ventas: "btn-tab-ventas",
		servicios: "btn-tab-servicios",
		horarios: "btn-tab-horarios",
		config: "btn-tab-config",
		sorteo: "btn-tab-sorteo",
	};
	if (btnIds[type])
		document.getElementById(btnIds[type]).classList.add("active");

	if (type !== "config" && type !== "sorteo") currentType = type;

	if (type === "horarios") loadHorarios();
	if (type === "ventas") loadVentas();
	if (type === "servicios") loadServicios();
	if (type === "productos") loadProductos();
	if (type === "sorteo") initSorteoTab();
}

// --- Loading Data ---
async function loadProductos() {
	const tbody = document.getElementById("productsTable");
	tbody.innerHTML =
		'<tr><td colspan="10" style="text-align:center; padding: 2rem;">Cargando productos...</td></tr>';

	try {
		const res = await apiFetch("/api/productos");
		productos = await res.json();
		renderTable("productos", productos, "productsTable");
	} catch (err) {
		tbody.innerHTML =
			'<tr><td colspan="10" style="text-align:center; color: red;">Error al cargar productos</td></tr>';
		console.error(err);
	}
}

async function loadVentas() {
	const tbody = document.getElementById("ventasTable");
	tbody.innerHTML =
		'<tr><td colspan="10" style="text-align:center; padding: 2rem;">Cargando ventas...</td></tr>';
	try {
		const res = await apiFetch("/api/ventas");
		ventas = await res.json();
		renderTable("ventas", ventas, "ventasTable");
	} catch (err) {
		tbody.innerHTML =
			'<tr><td colspan="10" style="text-align:center; color: red;">Error al cargar ventas</td></tr>';
	}
}

async function loadServicios() {
	const tbody = document.getElementById("serviciosTable");
	tbody.innerHTML =
		'<tr><td colspan="10" style="text-align:center; padding: 2rem;">Cargando servicios...</td></tr>';
	try {
		const res = await apiFetch("/api/servicios");
		servicios = await res.json();
		renderTable("servicios", servicios, "serviciosTable");
	} catch (err) {
		tbody.innerHTML =
			'<tr><td colspan="10" style="text-align:center; color: red;">Error al cargar servicios</td></tr>';
	}
}

async function loadHorarios() {
	try {
		const res = await apiFetch("/api/horarios");
		horarios = await res.json();
		renderHorariosForm();
	} catch (err) {
		alert("Error cargando horarios");
	}
}

function renderTable(type, data, tableId) {
	const tbody = document.getElementById(tableId);
	tbody.innerHTML = "";
	data.forEach((p) => {
		const tr = document.createElement("tr");
		tr.innerHTML = `
            <td data-label="ID">${p.id}</td>
            <td data-label="Imagen"><img src="${p.img}" alt="${p.name}"></td>
            <td data-label="Nombre">${p.name}</td>
            <td>${p.description}</td>
            <td data-label="Precio">$${p.precio}</td>
            <td>${p.categoria}</td>
            <td>${p.stock}</td>
            <td>${p.marca}</td>
            <td>${p.modelo}</td>
            <td data-label="Acciones" class="actions">
                <button class="edit-btn" data-action="edit" data-type="${type}" data-id="${p.id}">Editar</button>
                <button class="delete-btn" data-action="delete" data-type="${type}" data-id="${p.id}">Eliminar</button>
            </td>
        `;
		tbody.appendChild(tr);
	});

	// Bind buttons in table
	tbody.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
		btn.onclick = () => editItem(btn.dataset.type, Number(btn.dataset.id));
	});
	tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
		btn.onclick = () => deleteItem(btn.dataset.type, Number(btn.dataset.id));
	});
}

// --- Modal & Forms ---
function showForm(type, edit = false) {
	currentType = type;
	document.getElementById("productModal").style.display = "flex";
	document.getElementById("modalTitle").textContent = edit
		? `Editar ${type}`
		: `Agregar ${type}`;
	if (!edit) document.getElementById("productForm").reset();

	// Toggle fields based on type
	const isService = type === "servicios";
	const fieldsToToggle = ["categoria", "stock", "marca", "modelo"];

	fieldsToToggle.forEach((id) => {
		const el = document.getElementById(id);
		if (el) {
			el.style.display = isService ? "none" : "block";
			el.required = !isService;
		}
	});

	// Price is optional for services
	const priceEl = document.getElementById("precio");
	if (priceEl) {
		priceEl.required = !isService;
		priceEl.placeholder = isService ? "Precio (Opcional)" : "Precio";
	}
}

function hideForm() {
	document.getElementById("productModal").style.display = "none";
}

function editItem(type, id) {
	let item;
	if (type === "productos") item = productos.find((p) => p.id === id);
	if (type === "ventas") item = ventas.find((p) => p.id === id);
	if (type === "servicios") item = servicios.find((p) => p.id === id);

	if (!item) return;
	showForm(type, true);
	document.getElementById("productId").value = item.id;
	document.getElementById("name").value = item.name;
	document.getElementById("img").value = item.img;
	document.getElementById("description").value = item.description;
	document.getElementById("precio").value = item.precio;
	document.getElementById("categoria").value = item.categoria;
	document.getElementById("stock").value = item.stock;
	document.getElementById("marca").value = item.marca;
	document.getElementById("modelo").value = item.modelo;
}

// --- CRUD Operations ---

async function saveProduct(event) {
	event.preventDefault();

	const formData = new FormData();
	formData.append("id", document.getElementById("productId").value || "");
	formData.append("name", document.getElementById("name").value);
	formData.append("description", document.getElementById("description").value);

	const priceVal = document.getElementById("precio").value;
	formData.append("precio", priceVal ? priceVal : "0");

	if (currentType !== "servicios") {
		formData.append("categoria", document.getElementById("categoria").value);
		formData.append("stock", document.getElementById("stock").value);
		formData.append("marca", document.getElementById("marca").value);
		formData.append("modelo", document.getElementById("modelo").value);
	}

	const fileInput = document.getElementById("imgFile");
	if (fileInput.files.length > 0) {
		formData.append("imgFile", fileInput.files[0]);
	} else {
		formData.append("img", document.getElementById("img").value);
	}

	const endpoint = `/api/${currentType}`;

	try {
		await apiFetch(endpoint, {
			method: "POST",
			body: formData, // fetch will set multipart headers automatically
			// Do NOT set Content-Type header manually for FormData!
		});
		hideForm();
		if (currentType === "productos") loadProductos();
		if (currentType === "ventas") loadVentas();
		if (currentType === "servicios") loadServicios();
	} catch (err) {
		alert("Error al guardar");
	}
}

function showConfirmModal(message, onConfirm) {
	const modal = document.getElementById("confirmModal");
	const msgEl = document.getElementById("confirmMessage");
	const yesBtn = document.getElementById("confirmYes");
	const noBtn = document.getElementById("confirmNo");

	msgEl.textContent = message;
	modal.style.display = "flex";

	yesBtn.onclick = () => {
		modal.style.display = "none";
		onConfirm();
	};

	noBtn.onclick = () => {
		modal.style.display = "none";
	};
}

function deleteItem(type, id) {
	showConfirmModal(
		`¿Seguro que deseas eliminar este item de ${type}?`,
		async () => {
			try {
				const res = await apiFetch(`/api/${type}/${id}`, { method: "DELETE" });

				if (!res.ok) {
					const errorData = await res.json();
					alert("Error: " + (errorData.error || "No se pudo eliminar"));
					return;
				}

				if (type === "productos") await loadProductos();
				if (type === "ventas") await loadVentas();
				if (type === "servicios") await loadServicios();
			} catch (err) {
				console.error("Error en deleteItem:", err);
				alert("Error al eliminar");
			}
		}
	);
}

// --- Horarios ---
function renderHorariosForm() {
	const container = document.getElementById("horariosList");
	container.innerHTML = "";

	horarios.forEach((h, index) => {
		const div = document.createElement("div");
		div.style.display = "flex";
		div.style.alignItems = "center";
		div.style.gap = "0.5rem";
		div.style.padding = "0.5rem";
		div.style.background = "#f9f9f9";
		div.style.borderRadius = "4px";

		div.innerHTML = `
            <span style="width: 80px; font-weight: bold;">${h.day}</span>
            <label style="display: flex; align-items: center; gap: 0.3rem; margin: 0;">
                <input type="checkbox" data-index="${index}" class="closed-chk" ${h.closed ? "checked" : ""
			}> Cerrado
            </label>
            <input type="time" value="${h.open}" ${h.closed ? "disabled" : ""
			} id="open-${index}" style="width: auto;">
            <span>a</span>
            <input type="time" value="${h.close}" ${h.closed ? "disabled" : ""
			} id="close-${index}" style="width: auto;">
        `;
		container.appendChild(div);
	});

	// Re-bind change events for checkboxes
	container.querySelectorAll(".closed-chk").forEach((chk) => {
		chk.onchange = (e) =>
			toggleClosed(Number(e.target.dataset.index), e.target.checked);
	});
}

function toggleClosed(index, isClosed) {
	const openInput = document.getElementById(`open-${index}`);
	const closeInput = document.getElementById(`close-${index}`);
	openInput.disabled = isClosed;
	closeInput.disabled = isClosed;
	horarios[index].closed = isClosed;
}

async function saveHorarios(e) {
	e.preventDefault();
	horarios.forEach((h, index) => {
		if (!h.closed) {
			h.open = document.getElementById(`open-${index}`).value;
			h.close = document.getElementById(`close-${index}`).value;
		}
	});

	try {
		const res = await apiFetch("/api/horarios", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(horarios),
		});

		if (res.ok) {
			alert("Horarios guardados correctamente");
		} else {
			alert("Error al guardar");
		}
	} catch (err) {
		console.error(err);
		alert("Error de conexión");
	}
}

// --- Config ---
function exportData(type) {
	// We direct the browser to the URL.
	// If it requires auth, the cookie should handle it if SameSite=None is set.
	// However, window.location.href won't easily attach Bearer tokens if we used them (we don't).
	// It relies on cookies.
	window.location.href = `${API_BASE_URL}/admin/export/${type}`;
}

async function importData(type) {
	const fileInput = document.getElementById(`import-${type}`);
	if (!fileInput.files.length) {
		alert("Selecciona un archivo JSON primero");
		return;
	}

	const formData = new FormData();
	formData.append("file", fileInput.files[0]);

	try {
		const res = await apiFetch(`/api/admin/import/${type}`, {
			method: "POST",
			body: formData,
		});
		const data = await res.json();
		if (data.ok) {
			alert(`Importación exitosa. ${data.count} items procesados.`);
			fileInput.value = "";
			// Reload if current tab matches
			if (type === "productos") loadProductos();
			if (type === "ventas") loadVentas();
			if (type === "servicios") loadServicios();
			if (type === "horarios") loadHorarios();
		} else {
			alert("Error: " + data.error);
		}
	} catch (err) {
		alert("Error al importar");
	}
}

function clearData(type) {
	showConfirmModal(
		`¿ESTÁS SEGURO? Esto borrará TODOS los datos de ${type}. Esta acción no se puede deshacer.`,
		async () => {
			try {
				const res = await apiFetch(`/api/admin/clear/${type}`, {
					method: "DELETE",
				});
				if (res.ok) {
					alert(`Datos de ${type} eliminados/restaurados.`);
					if (type === "productos") loadProductos();
					if (type === "ventas") loadVentas();
					if (type === "servicios") loadServicios();
					if (type === "horarios") loadHorarios();
				} else {
					alert("Error al limpiar datos");
				}
			} catch (err) {
				alert("Error de conexión");
			}
		}
	);
}
