// Seed & storage helpers (multi-tenant namespace)
const storage = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(namespacedKey(key))) ?? fallback; } catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(namespacedKey(key), JSON.stringify(value)); },
};

function namespacedKey(key) {
  const ns = getCompanyNamespace();
  return `${ns}:${key}`;
}

function getCompanyNamespace() {
  return localStorage.getItem("tenant") || "TeLlevo";
}

function setCompanyNamespace(ns) {
  localStorage.setItem("tenant", ns);
}

const SEED = {
  users: [
    { id: 1, role: "cliente", nombre: "Juan Pérez", cedula: "1234567890", email: "cliente@demo.com", password: "123456", direccion: "Av. Siempre Viva 123", foto: null },
    { id: 2, role: "conductor", nombre: "Carlos Ruiz", cedula: "0987654321", email: "conductor@demo.com", password: "123456", direccion: "Calle 10 #20", foto: null },
    { id: 3, role: "admin", nombre: "Administrador", cedula: "0000000000", email: "admin@demo.com", password: "123456", direccion: "Oficina Central", foto: null },
  ],
  rutas: [
    { id: 1, origen: "Quito", destino: "Tena", horario: "08:00", precio: 10, asientos: 3 },
    { id: 2, origen: "Quito", destino: "Puyo", horario: "12:00", precio: 12, asientos: 5 },
  ],
  flota: [
    { id: 1, placa: "ABC-123", conductor: "Carlos Ruiz", capacidad: 5 },
  ],
  reservas: [],
  promos: [
    { type: "cupon", code: "CUPON10", discountPct: 10 },
    { type: "voucher", code: "VOC-001", balance: 100 },
  ],
  mockClients: [
    { id: 10001, nombre: "María González", cedula: "1102233445", email: "maria@example.com", telefono: "+593987654321" },
    { id: 10002, nombre: "Luis Andrade", cedula: "1719988776", email: "luis@example.com", telefono: "+593987650000" },
    { id: 10003, nombre: "Ana Torres", cedula: "0911122233", email: "ana@example.com", telefono: "+593999111222" },
  ],
};

function seedIfEmpty() {
  const key = namespacedKey("users");
  if (!localStorage.getItem(key)) {
    storage.set("users", SEED.users);
  } else {
    // migrate existing users to include email/password if missing (avoid breaking login)
    try {
      const current = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(current)) {
        const migrated = current.map((u, idx) => {
          let email = u.email;
          if (!email) {
            if (u.role === 'cliente' && u.cedula === '1234567890') email = 'cliente@demo.com';
            else if (u.role === 'conductor' && u.cedula === '0987654321') email = 'conductor@demo.com';
            else if (u.role === 'admin' && u.cedula === '0000000000') email = 'admin@demo.com';
            else email = (u.role ? `${u.role}${idx}@demo.com` : `user${idx}@demo.com`);
          }
          return {
            ...u,
            email,
            password: u.password || '123456',
            direccion: u.direccion || '',
          };
        });
        localStorage.setItem(key, JSON.stringify(migrated));
      }
    } catch {}
  }
  if (!localStorage.getItem(namespacedKey('mockClients'))) storage.set('mockClients', SEED.mockClients);
  if (!localStorage.getItem(namespacedKey("rutas"))) storage.set("rutas", SEED.rutas);
  if (!localStorage.getItem(namespacedKey("flota"))) storage.set("flota", SEED.flota);
  if (!localStorage.getItem(namespacedKey("reservas"))) storage.set("reservas", SEED.reservas);
  if (!localStorage.getItem(namespacedKey("promos"))) storage.set("promos", SEED.promos);
  if (!localStorage.getItem(namespacedKey("tracking"))) storage.set("tracking", []);
  if (!localStorage.getItem(namespacedKey("invoices"))) storage.set("invoices", []);
}

// Session
function getSession() { return storage.get("session", null); }
function setSession(session) { storage.set("session", session); }
function clearSession() { try { localStorage.removeItem(namespacedKey("session")); } catch {} }

// Router
const views = {
  auth: document.getElementById("view-auth"),
  cliente: document.getElementById("view-cliente"),
  conductor: document.getElementById("view-conductor"),
  admin: document.getElementById("view-admin"),
  'admin-user-new': document.getElementById('view-admin-user-new'),
  'admin-vehicle-new': document.getElementById('view-admin-vehicle-new'),
  payment: document.getElementById('view-payment'),
  register: document.getElementById('view-register'),
};

function showAuthScreen(which) {
  const loginPanel = document.getElementById('auth-login');
  const registerPanel = document.getElementById('auth-register');
  if (!loginPanel || !registerPanel) return;
  const showRegister = which === 'register';
  registerPanel.hidden = !showRegister;
  loginPanel.hidden = showRegister;
}

function showView(name) {
  Object.entries(views).forEach(([key, v]) => {
    v.classList.remove("active");
    v.hidden = true;
  });
  if (views[name]) {
    views[name].classList.add("active");
    views[name].hidden = false;
  }
  if (name === 'auth') showAuthScreen('login');
  highlightActiveNav(name);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function updateSessionUi() {
  const sessionSpan = document.getElementById("sessionUser");
  const session = getSession();
  if (session) {
    sessionSpan.textContent = `${session.nombre} (${session.role})`;
  } else {
    sessionSpan.textContent = "Sin sesión";
  }
  const sel = document.getElementById("companySelect");
  if (sel) sel.value = getCompanyNamespace();
}

// Auth logic
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const users = storage.get("users", []);
  const user = users.find(u => (u.email?.toLowerCase() === email) && u.password === password);
  const msg = document.getElementById("loginMsg");
  if (!user) { msg.textContent = "Credenciales inválidas"; return; }
  setSession(user);
  msg.textContent = `Bienvenido, ${user.nombre}`;
  updateSessionUi();
  navigateByRole(user.role);
  toast(`Sesión iniciada como ${user.role}`);
}

function handleRegister(e) {
  e.preventDefault();
  const nombres = document.getElementById("regNombres").value.trim();
  const apellidos = document.getElementById("regApellidos").value.trim();
  const nombre = `${nombres} ${apellidos}`.trim();
  const cedula = document.getElementById("regCedula").value.trim();
  const role = document.getElementById("regRole").value;
  const fotoFile = document.getElementById("regFoto")?.files?.[0] || null;
  const direccion = document.getElementById("pickedAddress")?.textContent?.replace(/^Dirección:\s*/, '')?.trim() || '';
  const lat = Number(document.getElementById('regLat')?.value || 0);
  const lng = Number(document.getElementById('regLng')?.value || 0);
  const telefono = document.getElementById('regTelefono')?.value?.trim() || '';
  const referencia = document.getElementById('regReferencia')?.value?.trim() || '';
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const users = storage.get("users", []);
  if (users.some(u => u.cedula === cedula)) {
    document.getElementById("registerMsg").textContent = "Ya existe un usuario con esa cédula";
    return;
  }
  if (users.some(u => u.email?.toLowerCase() === email.toLowerCase())) {
    document.getElementById("registerMsg").textContent = "Ya existe un usuario con ese correo";
    return;
  }
  const finalize = (photoDataUrl) => {
    const newUser = { id: Date.now(), role, nombre, cedula, direccion, lat, lng, telefono, referencia, email, password, foto: photoDataUrl || null };
    users.push(newUser);
    storage.set("users", users);
    document.getElementById("registerMsg").textContent = "Registro exitoso. Ahora inicie sesión.";
    toast("Registro completado");
    (document.getElementById("registerForm")).reset();
  };
  if (fotoFile) {
    const reader = new FileReader();
    reader.onload = () => finalize(String(reader.result));
    reader.readAsDataURL(fotoFile);
  } else {
    finalize(null);
  }
}

function navigateByRole(role) {
  if (role === "cliente") { renderCliente(); showView("cliente"); }
  else if (role === "conductor") { renderConductor(); showView("conductor"); }
  else if (role === "admin") { renderAdmin(); showView("admin"); }
  else { showView("auth"); }
}

// Cliente
let selectedRutaId = null;
let selectedCustomService = null; // for privado/transfer/encomienda personalizados
function renderCliente() {
  const rutas = storage.get("rutas", []);
  const cont = document.getElementById("rutasList");
  cont.innerHTML = "";
  rutas.forEach(r => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h4>${r.origen} → ${r.destino}</h4>
      <div class="row"><span class="badge">${r.horario}</span><span class="price">$${r.precio}</span></div>
      <div class="row"><span>Asientos disp.: ${r.asientos}</span><button ${r.asientos<=0?"disabled":""} data-id="${r.id}" class="reserveBtn">Reservar</button></div>
    `;
    cont.appendChild(card);
  });
  cont.querySelectorAll(".reserveBtn").forEach(btn => btn.addEventListener("click", () => openReserva(Number(btn.dataset.id))));
  renderHistorial();
  renderTrackingForCliente();
  // preparar opciones de origen
  populateOrigenOptions();
  wireOrigenPicker();
}

function openReserva(rutaId) {
  selectedRutaId = rutaId;
  selectedCustomService = null;
  const rutas = storage.get("rutas", []);
  const ruta = rutas.find(r => r.id === rutaId);
  // abrir modal compartido en lugar de panel
  const modal = document.getElementById('clientSharedModal');
  const sum = document.getElementById('clientSharedSummary');
  if (sum && ruta) {
    sum.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class=\"row\"><strong>${ruta.origen} → ${ruta.destino}</strong><span class=\"badge\">${ruta.horario}</span></div>
      <div><strong>Precio por asiento:</strong> $${ruta.precio}</div>
    `;
    sum.appendChild(item);
  }
  if (modal) { modal.hidden = false; modal.style.display = 'grid'; }
}

(function wireClientSharedModal(){
  const close = () => { const m = document.getElementById('clientSharedModal'); if (m) { m.hidden = true; m.style.display = 'none'; } };
  document.getElementById('clientSharedClose')?.addEventListener('click', close);
  // usar mapa para dirección
  const mapBtn = document.getElementById('sharedMapBtn');
  mapBtn?.addEventListener('click', () => {
    window.__pickerTarget = 'shared';
    openPicker();
  });
  // Nota: el submit se maneja en overrideClientSharedToPayment() para navegar a pago y evitar duplicados
})();

// Integrar picker con modal compartido
// (el manejo se realiza en el listener principal de saveMapPicker dentro del módulo del mapa)

function handleReserva(e) {
  e.preventDefault();
  const session = getSession();
  if (!session || session.role !== "cliente") { alert("Inicie sesión como cliente"); return; }
  const tipo = document.getElementById("tipoReserva").value;
  const direccion = document.getElementById("direccion").value.trim();
  const metodoPago = document.getElementById("metodoPago").value;
  const codigoPromo = document.getElementById("codigoPromo").value.trim();
  const promos = storage.get("promos", []);
  let promoApplied = null;
  if (codigoPromo) {
    promoApplied = promos.find(p => p.code.toLowerCase() === codigoPromo.toLowerCase());
  }
  let rutas = storage.get("rutas", []);
  let ruta = selectedCustomService ?? rutas.find(r => r.id === selectedRutaId);
  if (!ruta) return;
  if (tipo === "asiento" && !selectedCustomService && ruta.asientos <= 0) { document.getElementById("reservaMsg").textContent = "Sin asientos disponibles"; return; }

  const reservas = storage.get("reservas", []);
  const nuevaReserva = {
    id: Date.now(), rutaId: ruta.id, clienteId: session.id,
    tipo, direccion, horario: ruta.horario, origen: ruta.origen, destino: ruta.destino, precio: ruta.precio,
    estado: "pendiente", recogido: false,
    servicio: getServicioTipo(), metodoPago, promo: promoApplied?.code ?? null,
    conductorId: null, vehiculo: null,
    servicioDetalles: selectedCustomService?.details || null,
  };
  reservas.push(nuevaReserva);
  storage.set("reservas", reservas);

  if (tipo === "asiento" && !selectedCustomService) {
    rutas = rutas.map(r => r.id === ruta.id ? { ...r, asientos: r.asientos - 1 } : r);
    storage.set("rutas", rutas);
  }

  document.getElementById("reservaMsg").textContent = "Reserva confirmada";
  (document.getElementById("reservaForm")).reset();
  document.getElementById("reservaPanel").hidden = true;
  renderCliente();
  toast("Reserva confirmada");
}

function renderHistorial() {
  const session = getSession();
  const cont = document.getElementById("historialList");
  cont.innerHTML = "";
  
  if (!session) { 
    cont.innerHTML = "<div class='text-muted'>Inicie sesión para ver su historial</div>"; 
    return; 
  }
  
  const reservas = storage.get("reservas", [])
    .filter(r => r.clienteId === session.id)
    .sort((a, b) => b.id - a.id); // Más recientes primero
  
  if (reservas.length === 0) { 
    cont.innerHTML = "<div class='text-muted'>No tienes reservas aún</div>"; 
    return; 
  }
  
  reservas.forEach(res => {
    const div = document.createElement("div");
    div.className = "list-item";
    
    const estadoTexto = res.estado === 'recogido' ? 'Completado' :
                       res.estado === 'en-curso' ? 'En curso' :
                       'Pendiente';
    
    const estadoBadge = res.estado === 'recogido' ? 'success' :
                        res.estado === 'en-curso' ? 'warn' : '';
    
    const fechaCreacion = new Date(res.id).toLocaleDateString('es-ES');
    const ratingText = res.rating ? ` • ★ ${res.rating}` : '';
    
    div.innerHTML = `
      <div class="row">
        <strong>${res.origen} → ${res.destino}</strong>
        <span class="badge ${estadoBadge}">${estadoTexto}</span>
      </div>
      <div>Fecha: ${fechaCreacion} • Horario: ${res.horario} • Tipo: ${res.tipo}</div>
      <div>Dirección: ${res.direccion}</div>
      <div>Pago: ${res.metodoPago}${res.promo ? ` • Promoción: ${res.promo}` : ''}${ratingText}</div>
      ${res.estado === 'recogido' && !res.rating ? '<div class="text-muted" style="margin-top: 8px;">💡 Puedes calificar este viaje en la sección de calificaciones</div>' : ''}
    `;
    cont.appendChild(div);
  });
  
  // populate rating select with delivered trips without rating
  const ratingSelect = document.getElementById('ratingReserva');
  if (ratingSelect) {
    ratingSelect.innerHTML = '<option value="">Selecciona una reserva...</option>';
    const completadasSinRating = reservas.filter(r => r.estado === 'recogido' && typeof r.rating !== 'number');
    
    if (completadasSinRating.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No hay viajes pendientes de calificar';
      opt.disabled = true;
      ratingSelect.appendChild(opt);
    } else {
      completadasSinRating.forEach(r => {
      const opt = document.createElement('option');
      opt.value = String(r.id);
        opt.textContent = `${r.origen} → ${r.destino} (${new Date(r.id).toLocaleDateString('es-ES')})`;
      ratingSelect.appendChild(opt);
    });
    }
  }
}

// Mis Viajes (Cliente)
function renderMisViajes() {
  const session = getSession();
  
  if (!session || session.role !== "cliente") {
    document.getElementById("viajesPendientesList").innerHTML = "<div class='text-muted'>Inicie sesión para ver sus viajes</div>";
    document.getElementById("viajesEnCursoList").innerHTML = "<div class='text-muted'>Inicie sesión para ver sus viajes</div>";
    return;
  }

  const reservas = storage.get("reservas", [])
    .filter(r => r.clienteId === session.id)
    .sort((a, b) => b.id - a.id);

  // Viajes pendientes (confirmados pero no iniciados)
  const pendientes = reservas.filter(r => r.estado === "pendiente" && !r.recogido);
  renderViajesEnContenedor("viajesPendientesList", pendientes, "pendiente");

  // Viajes en curso (iniciados pero no completados)
  const enCurso = reservas.filter(r => r.estado === "en-curso" || (r.estado === "pendiente" && r.enCurso));
  renderViajesEnContenedor("viajesEnCursoList", enCurso, "en-curso");

  // Tracking en tiempo real
  renderTrackingCliente();
}

function renderViajesEnContenedor(containerId, reservas, tipo) {
  const cont = document.getElementById(containerId);
  cont.innerHTML = "";
  
  if (reservas.length === 0) {
    const mensaje = tipo === "pendiente" ? "No tienes viajes pendientes" : "No tienes viajes en curso";
    cont.innerHTML = `<div class='text-muted'>${mensaje}</div>`;
    return;
  }
  
  reservas.forEach(res => {
    const div = document.createElement("div");
    div.className = "list-item";
    
    const fechaCreacion = new Date(res.id).toLocaleDateString('es-ES');
    const estadoTexto = tipo === "en-curso" ? "En curso" : "Confirmado";
    const estadoBadge = tipo === "en-curso" ? "warn" : "success";
    
    let actionButtons = "";
    if (tipo === "pendiente") {
      actionButtons = `
        <div class="row" style="gap: 8px;">
          <button class="btn secondary detailViajeBtn" data-id="${res.id}">Ver detalles</button>
          <button class="btn danger cancelViajeBtn" data-id="${res.id}">Cancelar</button>
        </div>
      `;
    } else if (tipo === "en-curso") {
      actionButtons = `
        <div class="row" style="gap: 8px;">
          <button class="btn secondary detailViajeBtn" data-id="${res.id}">Ver detalles</button>
          <button class="btn primary trackViajeBtn" data-id="${res.id}">Ver tracking</button>
        </div>
      `;
    }
    
    div.innerHTML = `
      <div class="row">
        <strong>${res.origen} → ${res.destino}</strong>
        <span class="badge ${estadoBadge}">${estadoTexto}</span>
      </div>
      <div>Fecha reserva: ${fechaCreacion} • Horario: ${res.horario}</div>
      <div>Tipo: ${res.tipo} • Dirección: ${res.direccion}</div>
      <div>Conductor: ${getUserName(res.conductorId) || 'Por asignar'} • Vehículo: ${res.vehiculo || 'Por asignar'}</div>
      <div style="margin-top: 12px;">
        ${actionButtons}
      </div>
    `;
    cont.appendChild(div);
  });
  
  // Event listeners
  cont.querySelectorAll(".detailViajeBtn").forEach(btn => 
    btn.addEventListener("click", () => verDetallesViaje(Number(btn.dataset.id)))
  );
  cont.querySelectorAll(".cancelViajeBtn").forEach(btn => 
    btn.addEventListener("click", () => cancelarViaje(Number(btn.dataset.id)))
  );
  cont.querySelectorAll(".trackViajeBtn").forEach(btn => 
    btn.addEventListener("click", () => verTrackingViaje(Number(btn.dataset.id)))
  );
}

function verDetallesViaje(reservaId) {
  // Reutilizar la función de detalles de asignación
  verDetallesAsignacion(reservaId);
}

function cancelarViaje(reservaId) {
  if (!confirm("¿Estás seguro de que deseas cancelar este viaje?")) return;
  
  const reservas = storage.get("reservas", []);
  const nuevas = reservas.filter(r => r.id !== reservaId);
  storage.set("reservas", nuevas);
  
  renderMisViajes();
  toast("Viaje cancelado exitosamente");
}

function verTrackingViaje(reservaId) {
  // Scroll hacia la sección de tracking
  const trackingPanel = document.getElementById("trackingClientePanel");
  if (trackingPanel) {
    trackingPanel.scrollIntoView({ behavior: 'smooth' });
    toast("Revisa la sección de Tracking en Tiempo Real");
  }
}

function renderTrackingCliente() {
  const session = getSession();
  const panel = document.getElementById("trackingClienteInfo");
  if (!panel) return;
  
  if (!session || session.role !== "cliente") {
    panel.innerHTML = "<div class='text-muted'>Inicie sesión para ver el tracking</div>";
    return;
  }

  const myActive = storage.get("reservas", []).filter(r => 
    r.clienteId === session.id && 
    (r.estado === "en-curso" || (r.estado === "pendiente" && r.enCurso))
  );
  
  if (myActive.length === 0) {
    panel.innerHTML = "<div class='text-muted'>No hay viajes activos para rastrear</div>";
    return;
  }

  const tracking = storage.get("tracking", []);
  panel.innerHTML = "";
  
  myActive.forEach(r => {
    const t = tracking.find(t => t.reservaId === r.id);
    const div = document.createElement("div");
    div.className = "list-item";
    
    if (t) {
      div.innerHTML = `
        <div class="row">
          <strong>${r.origen} → ${r.destino}</strong>
          <span class="badge success">🟢 En línea</span>
        </div>
        <div>Conductor: ${getUserName(r.conductorId)} • Vehículo: ${r.vehiculo}</div>
        <div>📍 Posición actual: ${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}</div>
        <div class="text-muted">Última actualización: hace unos segundos</div>
      `;
    } else {
      div.innerHTML = `
        <div class="row">
          <strong>${r.origen} → ${r.destino}</strong>
          <span class="badge">⏳ Esperando</span>
        </div>
        <div>Conductor: ${getUserName(r.conductorId)} • Vehículo: ${r.vehiculo}</div>
        <div class="text-muted">🚗 El conductor aún no ha iniciado el seguimiento GPS</div>
      `;
    }
    panel.appendChild(div);
  });
}

// Conductor
function renderConductor() {
  const session = getSession();
  if (!session || session.role !== "conductor") {
    document.getElementById("viajesAsignados").textContent = "Inicie sesión como conductor";
    return;
  }

  const reservas = storage.get("reservas", []);
  const asignadas = reservas.filter(r => r.conductorId === session.id);

  // Actualizar KPIs del dashboard
  updateConductorKPIs(asignadas);
  
  // Renderizar próximos viajes en dashboard
  renderProximosViajes(asignadas);
  
  // Renderizar asignaciones por estado
  renderAsignacionesPorEstado(asignadas);
}

function updateConductorKPIs(asignadas) {
  const total = asignadas.length;
  const pendientes = asignadas.filter(r => r.estado === "pendiente").length;
  const enCurso = asignadas.filter(r => r.estado === "en-curso" || (r.estado === "pendiente" && !r.recogido)).length;
  const completadas = asignadas.filter(r => r.estado === "recogido" || r.recogido).length;

  document.getElementById("conductorTotalAsignaciones").textContent = total;
  document.getElementById("conductorPendientes").textContent = pendientes;
  document.getElementById("conductorEnCurso").textContent = enCurso;
  document.getElementById("conductorCompletadas").textContent = completadas;
}

function renderProximosViajes(asignadas) {
  const cont = document.getElementById("proximosViajes");
  cont.innerHTML = "";
  
  const proximos = asignadas.filter(r => !r.recogido).slice(0, 3);
  
  if (proximos.length === 0) { 
    cont.innerHTML = "<div class='text-muted'>No hay viajes próximos</div>"; 
    return; 
  }
  
  proximos.forEach(res => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="row"><strong>${res.origen} → ${res.destino}</strong><span class="badge">${res.horario}</span></div>
      <div>Cliente: ${getUserName(res.clienteId)} • ${res.direccion}</div>
    `;
    cont.appendChild(div);
  });
}

function renderAsignacionesPorEstado(asignadas) {
  // Asignado (pendientes)
  const asignados = asignadas.filter(r => r.estado === "pendiente" && !r.recogido);
  renderAsignacionesEnContenedor("viajesAsignados", asignados, "asignado");
  
  // En curso (iniciados pero no completados)
  const enCurso = asignadas.filter(r => r.estado === "en-curso" || (r.estado === "pendiente" && r.enCurso));
  renderAsignacionesEnContenedor("viajesEnCurso", enCurso, "en-curso");
  
  // Finalizados
  const finalizados = asignadas.filter(r => r.estado === "recogido" || r.recogido);
  renderAsignacionesEnContenedor("viajesFinalizados", finalizados, "finalizado");
}

function renderAsignacionesEnContenedor(containerId, reservas, tipo) {
  const cont = document.getElementById(containerId);
  cont.innerHTML = "";
  
  if (reservas.length === 0) { 
    cont.innerHTML = `<div class='text-muted'>No hay viajes ${tipo}s</div>`; 
    return; 
  }
  
  reservas.forEach(res => {
    const div = document.createElement("div");
    div.className = "list-item";
    
    let actionButtons = "";
    if (tipo === "asignado") {
      actionButtons = `
        <button class="btn secondary detailBtn" data-id="${res.id}">Ver detalles</button>
        <button class="btn primary startBtn" data-id="${res.id}">Cambiar a En Curso</button>
      `;
    } else if (tipo === "en-curso") {
      actionButtons = `
        <button class="btn secondary detailBtn" data-id="${res.id}">Ver detalles</button>
        <button class="btn accent pickupBtn" data-id="${res.id}">Cambiar a Finalizado</button>
      `;
    } else if (tipo === "finalizado") {
      actionButtons = `
        <button class="btn secondary detailBtn" data-id="${res.id}">Ver detalles</button>
      `;
    }
    
    const estado = tipo === "finalizado" ? "Completado" : 
                  tipo === "en-curso" ? "En curso" : "Asignado";
    
    div.innerHTML = `
      <div class="row"><strong>${res.origen} → ${res.destino}</strong><span class="badge">${res.horario}</span></div>
      <div>Cliente: ${getUserName(res.clienteId)} • Tipo: ${res.tipo}</div>
      <div>Dirección: ${res.direccion}</div>
      <div class="row" style="justify-content: space-between;">
        <span>Estado: ${estado}</span>
        <div class="row" style="gap: 8px;">
          ${actionButtons}
        </div>
      </div>
    `;
    cont.appendChild(div);
  });
  
  // Event listeners para botones
  cont.querySelectorAll(".detailBtn").forEach(btn => 
    btn.addEventListener("click", () => verDetallesAsignacion(Number(btn.dataset.id)))
  );
  cont.querySelectorAll(".startBtn").forEach(btn => 
    btn.addEventListener("click", () => iniciarViaje(Number(btn.dataset.id)))
  );
  cont.querySelectorAll(".pickupBtn").forEach(btn => 
    btn.addEventListener("click", () => confirmarRecogida(Number(btn.dataset.id)))
  );
}

// Geocodificación directa por dirección (Nominatim)
async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
    }
    return null;
  } catch { return null; }
}

let driverDetailLeaflet = null;
let driverDetailMarker = null;

function verDetallesAsignacion(reservaId) {
  const reservas = storage.get('reservas', []);
  const users = storage.get('users', []);
  const r = reservas.find(x => x.id === reservaId);
  if (!r) return;
  const cliente = users.find(u => u.id === r.clienteId)?.nombre || 'Cliente';
  const body = document.getElementById('driverDetailBody');
  if (body) {
    body.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div class=\"row\" style=\"gap:10px; align-items:center; margin-bottom:8px\"><strong>Ruta</strong><span class=\"badge\">${r.origen} → ${r.destino}</span><span class=\"badge\">${r.horario}</span></div>
      <div class=\"detail-grid\">
        <div class=\"detail-section\">
          <div class=\"label\">Origen</div>
          <div class=\"value\">${r.origen}</div>
          <div class=\"label\">Destino</div>
          <div class=\"value\">${r.destino}</div>
          <div class=\"label\">Punto de recogida</div>
          <div class=\"value\" id=\"driverDetailAddress\">${r.direccion}</div>
          <div class=\"label\">Cliente</div>
          <div class=\"value\">${cliente}</div>
          <div class=\"label\">Servicio</div>
          <div class=\"value\">${r.servicio} • ${r.tipo}</div>
          ${r.promo ? `<div class=\"label\">Cupón</div><div class=\"value\">${r.promo}</div>` : ''}
          ${typeof r.precio !== 'undefined' ? `<div class=\"label\">Precio</div><div class=\"value\">$${r.precio}</div>` : ''}
        </div>
        <div class=\"detail-section\">
          <div class=\"label\">Mapa de recogida</div>
          <div id=\"driverDetailMap\" style=\"height: 260px; border:1px solid var(--border); border-radius: 10px; margin-top:6px; overflow:hidden\"></div>
          <div class=\"row\" style=\"gap:8px; margin-top:8px;\">
            <a id=\"driverMapGoogle\" class=\"btn secondary\" href=\"#\" target=\"_blank\" rel=\"noopener\">Abrir en Google Maps</a>
            <a id=\"driverMapWaze\" class=\"btn secondary\" href=\"#\" target=\"_blank\" rel=\"noopener\">Abrir en Waze</a>
          </div>
        </div>
      </div>
    `;
    body.appendChild(div);
  }
  const modal = document.getElementById('driverDetailModal');
  if (modal) { modal.hidden = false; modal.style.display = 'grid'; }

  // Inicializar mapa y ubicar dirección
  setTimeout(async () => {
    const address = r.direccion;
    // Si ya existe un mapa previo ligado a otro contenedor, eliminarlo y recrear
    if (driverDetailLeaflet) {
      try { driverDetailLeaflet.remove(); } catch {}
      driverDetailLeaflet = null;
      driverDetailMarker = null;
    }
    // Crear nuevo mapa sobre el contenedor actual
    driverDetailLeaflet = L.map('driverDetailMap').setView([-0.1807, -78.4678], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(driverDetailLeaflet);
    driverDetailLeaflet.invalidateSize();
    const geo = address ? await geocodeAddress(address) : null;
    if (geo) {
      driverDetailMarker = L.marker([geo.lat, geo.lng]).addTo(driverDetailLeaflet);
      driverDetailLeaflet.setView([geo.lat, geo.lng], 14);
      const g = document.getElementById('driverMapGoogle');
      const w = document.getElementById('driverMapWaze');
      if (g) g.href = `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`;
      if (w) w.href = `https://waze.com/ul?ll=${geo.lat},${geo.lng}&navigate=yes`;
    }
  }, 60);
}

// Wire botones del modal conductor
(function wireDriverDetailModal(){
  const close = () => { const m = document.getElementById('driverDetailModal'); if (m) { m.hidden = true; m.style.display = 'none'; } };
  document.getElementById('driverDetailClose')?.addEventListener('click', close);
  document.getElementById('driverDetailOk')?.addEventListener('click', close);
})();

// Ajustar wiring en listas del conductor
function renderAsignacionesEnContenedor(containerId, reservas, tipo) {
  const cont = document.getElementById(containerId);
  cont.innerHTML = "";
  if (reservas.length === 0) { 
    cont.innerHTML = `<div class='text-muted'>No hay viajes ${tipo}s</div>`; 
    return; 
  }
  reservas.forEach(res => {
    const div = document.createElement("div");
    div.className = "list-item";
    let actionButtons = "";
    if (tipo === "asignado") {
      actionButtons = `
        <button class=\"btn secondary detailBtn\" data-id=\"${res.id}\">Ver detalles</button>
        <button class=\"btn primary startBtn\" data-id=\"${res.id}\">Cambiar a En Curso</button>
      `;
    } else if (tipo === "en-curso") {
      actionButtons = `
        <button class=\"btn secondary detailBtn\" data-id=\"${res.id}\">Ver detalles</button>
        <button class="btn accent pickupBtn" data-id=\"${res.id}\">Cambiar a Finalizado</button>
      `;
    } else if (tipo === "finalizado") {
      actionButtons = `
        <button class=\"btn secondary detailBtn\" data-id=\"${res.id}\">Ver detalles</button>
      `;
    }
    const estado = tipo === "finalizado" ? "Completado" : 
                  tipo === "en-curso" ? "En curso" : "Asignado";
    div.innerHTML = `
      <div class=\"row\"><strong>${res.origen} → ${res.destino}</strong><span class=\"badge\">${res.horario}</span></div>
      <div>Cliente: ${getUserName(res.clienteId)} • Tipo: ${res.tipo}</div>
      <div>Dirección: ${res.direccion}</div>
      <div class=\"row\" style=\"justify-content: space-between;\">
        <span>Estado: ${estado}</span>
        <div class=\"row\" style=\"gap: 8px;\">
          ${actionButtons}
        </div>
      </div>
    `;
    cont.appendChild(div);
  });
  cont.querySelectorAll('.detailBtn').forEach(btn => btn.addEventListener('click', () => verDetallesAsignacion(Number(btn.dataset.id))))
  if (tipo === 'asignado') cont.querySelectorAll('.startBtn').forEach(btn => btn.addEventListener('click', () => iniciarViaje(Number(btn.dataset.id))))
  if (tipo === 'en-curso') cont.querySelectorAll('.pickupBtn').forEach(btn => btn.addEventListener('click', () => confirmarRecogida(Number(btn.dataset.id))))
}

function iniciarViaje(reservaId) {
  const reservas = storage.get("reservas", []);
  const nuevas = reservas.map(r => r.id === reservaId ? { ...r, estado: "en-curso", enCurso: true } : r);
  storage.set("reservas", nuevas);
  // activar tracking para el conductor actual
  const session = getSession();
  if (session && session.role === 'conductor') {
    const tracking = storage.get('tracking', []);
    // geocodificar dirección inicial de la reserva para primera posición
    const res = nuevas.find(r => r.id === reservaId);
    if (res?.direccion) {
      geocodeAddress(res.direccion).then(geo => {
        const base = geo ? { lat: geo.lat, lng: geo.lng } : { lat: -0.1807, lng: -78.4678 };
        const entry = { conductorId: session.id, reservaId, lat: base.lat, lng: base.lng, updatedAt: Date.now() };
        const others = tracking.filter(t => !(t.conductorId === session.id && t.reservaId === reservaId));
        storage.set('tracking', [...others, entry]);
      });
    }
  }
  renderConductor();
  toast("Viaje cambiado a En Curso");
}

// Simulación de actualización de GPS (ligera deriva) cada 7s cuando hay viajes en curso
setInterval(() => {
  const session = getSession();
  if (!session || session.role !== 'conductor') return;
  const reservas = storage.get('reservas', []);
  const activa = reservas.find(r => r.conductorId === session.id && (r.estado === 'en-curso'));
  if (!activa) return;
  const tracking = storage.get('tracking', []);
  const idx = tracking.findIndex(t => t.conductorId === session.id && t.reservaId === activa.id);
  if (idx >= 0) {
    const jitter = () => (Math.random() - 0.5) * 0.0008;
    const curr = tracking[idx];
    tracking[idx] = { ...curr, lat: (curr.lat||-0.1807) + jitter(), lng: (curr.lng||-78.4678) + jitter(), updatedAt: Date.now() };
    storage.set('tracking', tracking);
  }
}, 7000);

function getUserName(id) {
  const users = storage.get("users", []);
  return users.find(u => u.id === id)?.nombre ?? "";
}

function confirmarRecogida(reservaId) {
  const reservas = storage.get("reservas", []);
  const nuevas = reservas.map(r => r.id === reservaId ? { ...r, recogido: true, estado: "recogido" } : r);
  storage.set("reservas", nuevas);
  // create invoice mock when marked as recogido
  const res = nuevas.find(r => r.id === reservaId);
  if (res) {
    const invoices = storage.get("invoices", []);
    invoices.push({ id: Date.now(), reservaId, cliente: getUserName(res.clienteId), monto: res.precio, metodo: res.metodoPago });
    storage.set("invoices", invoices);
  }
  // limpiar tracking de esta reserva
  const tracking = storage.get('tracking', []);
  const cleaned = tracking.filter(t => t.reservaId !== reservaId);
  storage.set('tracking', cleaned);
  renderConductor();
  // refresh rating choices for client if open
  if (views.cliente.classList.contains('active')) renderHistorial();
  // si admin GPS está visible, refrescar
  if (views.admin.classList.contains('active')) {
    const activeTab = document.querySelector('#view-admin .tab-btn.active')?.getAttribute('data-tab');
    if (activeTab === 'gps') renderAdminGps(document.getElementById('gpsFilter')?.value?.trim()||'');
  }
  toast("Viaje cambiado a Finalizado");
}

// Admin
function renderAdmin() {
  const reservas = storage.get("reservas", []);
  const rutas = storage.get("rutas", []);
  const flota = storage.get("flota", []);
  const users = storage.get("users", []);
  
  // Datos visuales adicionales (no persistidos)
  const mockDrivers = [
    { id: 9001, role: 'conductor', nombre: 'Conductor Demo 1', cedula: '000000001', email: 'conductor1@demo.com' },
    { id: 9002, role: 'conductor', nombre: 'Conductor Demo 2', cedula: '000000002', email: 'conductor2@demo.com' },
    { id: 9003, role: 'conductor', nombre: 'Conductor Demo 3', cedula: '000000003', email: 'conductor3@demo.com' },
  ];
  const mockFlota = [
    { id: 801, placa: 'XYZ-101', conductor: 'Conductor Demo 1', capacidad: 5 },
    { id: 802, placa: 'XYZ-102', conductor: 'Conductor Demo 2', capacidad: 7 },
    { id: 803, placa: 'XYZ-103', conductor: 'Conductor Demo 3', capacidad: 4 },
    { id: 804, placa: 'XYZ-104', conductor: 'Carlos Ruiz', capacidad: 5 },
  ];

  // Actualizar KPIs principales
  document.getElementById("kpiReservas").textContent = reservas.length;
  document.getElementById("kpiFlota").textContent = flota.length;
  const revenue = reservas.reduce((sum, r) => sum + (Number(r.precio)||0), 0);
  const kpiRevenue = document.getElementById('kpiRevenue');
  if (kpiRevenue) kpiRevenue.textContent = `$${revenue.toLocaleString()}`;

  // Actualizar datos operacionales
  const pendientes = reservas.filter(r => !r.conductorId).length;
  const enCurso = reservas.filter(r => r.estado === 'en-curso').length;
  
  // Completados hoy (simulado)
  const hoy = new Date().toDateString();
  const completadosHoy = reservas.filter(r => 
    r.estado === 'recogido' && 
    new Date(r.id).toDateString() === hoy
  ).length;

  document.getElementById("opPendientes").textContent = pendientes;
  document.getElementById("opEnCurso").textContent = enCurso;
  document.getElementById("opCompletadosHoy").textContent = completadosHoy;

  const rutasCont = document.getElementById("adminRutas");
  rutasCont.innerHTML = "";
  rutas.forEach(r => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.textContent = `${r.origen} → ${r.destino} • ${r.horario} • $${r.precio} • Asientos: ${r.asientos}`;
    rutasCont.appendChild(div);
  });

  // Flota - Rediseñado
  const flotaCont = document.getElementById("adminFlota");
  flotaCont.innerHTML = "";
  const displayFlota = [...flota, ...mockFlota];
  
  if (displayFlota.length === 0) {
    flotaCont.innerHTML = '<div class="empty-state">🚗 No hay vehículos registrados</div>';
  } else {
  displayFlota.forEach(v => {
      const viajesAsignados = reservas.filter(r => r.vehiculo === v.placa && r.estado !== 'recogido').length;
      const viajesCompletados = reservas.filter(r => r.vehiculo === v.placa && r.estado === 'recogido').length;
      const ingresosTotales = reservas.filter(r => r.vehiculo === v.placa).reduce((sum, r) => sum + (Number(r.precio) || 0), 0);
      
    const div = document.createElement("div");
      div.className = "admin-list-item";
      
      // Determinar el estado del vehículo
      let estadoVehiculo = '';
      let estadoClass = '';
      if (viajesAsignados > 0) {
        estadoVehiculo = '🚛 En Servicio';
        estadoClass = 'status-busy';
      } else {
        estadoVehiculo = '🅿️ Disponible';
        estadoClass = 'status-available';
      }
      
      // Icono del tipo de vehículo
      const tipoIconos = {
        'sedan': '🚗',
        'suv': '🚙',
        'van': '🚐',
        'camioneta': '🛻',
        'bus': '🚌'
      };
      const tipoIcon = tipoIconos[v.tipo?.toLowerCase()] || '🚗';
      
      div.innerHTML = `
        <div class="admin-item-header">
          <div class="admin-item-main">
            <div class="admin-item-avatar">
              <span class="avatar-icon">${tipoIcon}</span>
            </div>
            <div class="admin-item-details">
              <div class="admin-item-name">${v.placa}</div>
              <div class="admin-item-meta">${v.marca || ''} ${v.modelo || ''} ${v.año || ''}</div>
              <div class="admin-item-contact">Conductor: ${v.conductor || 'Sin asignar'}</div>
            </div>
          </div>
          <div class="admin-item-badge">
            <span class="vehicle-status-badge ${estadoClass}">${estadoVehiculo}</span>
          </div>
        </div>
        
        <div class="admin-item-stats">
          <div class="stat-item">
            <span class="stat-icon">👥</span>
            <span class="stat-label">Capacidad:</span>
            <span class="stat-value">${v.capacidad || 'N/A'} personas</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🚗</span>
            <span class="stat-label">Tipo:</span>
            <span class="stat-value">${v.tipo || 'No especificado'}</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">🎨</span>
            <span class="stat-label">Color:</span>
            <span class="stat-value">${v.color || 'N/A'}</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">📋</span>
            <span class="stat-label">Viajes Activos:</span>
            <span class="stat-value">${viajesAsignados}</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">✅</span>
            <span class="stat-label">Completados:</span>
            <span class="stat-value">${viajesCompletados}</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">💰</span>
            <span class="stat-label">Ingresos:</span>
            <span class="stat-value">$${ingresosTotales}</span>
          </div>
        </div>
        
        <div class="admin-item-actions">
          <button class="btn secondary" onclick="verVehiculo('${v.placa}')">
            <span>👁️</span> Ver
          </button>
          <button class="btn secondary" onclick="editarVehiculo('${v.placa}')">
            <span>✏️</span> Editar
          </button>
          <button class="btn danger" onclick="deleteFlota('${v.placa}')">
            <span>🗑️</span> Eliminar
          </button>
        </div>
      `;
    flotaCont.appendChild(div);
  });
  }

  // usuarios (conductor y admin) - Rediseñado
  const usuariosCont = document.getElementById('adminUsuarios');
  if (usuariosCont) {
    usuariosCont.innerHTML = '';
    const realStaff = users.filter(u => u.role !== 'cliente');
    const displayStaff = [...realStaff, ...mockDrivers];
    
    if (displayStaff.length === 0) {
      usuariosCont.innerHTML = '<div class="empty-state">👥 No hay usuarios registrados</div>';
    } else {
    displayStaff.forEach(u => {
        const vehiculo = displayFlota.find(f => f.conductor === u.nombre)?.placa ?? null;
      const resAsignadas = reservas.filter(r => r.conductorId === u.id).length;
        const resCompletadas = reservas.filter(r => r.conductorId === u.id && r.estado === 'recogido').length;
        
      const div = document.createElement('div');
        div.className = 'admin-list-item';
        
        const roleInfo = {
          'conductor': { icon: '🚗', class: 'role-conductor', text: 'Conductor' },
          'admin': { icon: '👨‍💼', class: 'role-admin', text: 'Administrador' }
        };
        
        const roleData = roleInfo[u.role] || { icon: '👤', class: 'role-user', text: u.role };
        
        div.innerHTML = `
          <div class="admin-item-header">
            <div class="admin-item-main">
              <div class="admin-item-avatar">
                <span class="avatar-icon">${roleData.icon}</span>
              </div>
              <div class="admin-item-details">
                <div class="admin-item-name">${u.nombre}</div>
                <div class="admin-item-meta">CI: ${u.cedula} • ${u.email || 'Sin email'}</div>
              </div>
            </div>
            <div class="admin-item-badge">
              <span class="role-badge ${roleData.class}">${roleData.text}</span>
            </div>
          </div>
          
          <div class="admin-item-stats">
            <div class="stat-item">
              <span class="stat-icon">🚛</span>
              <span class="stat-label">Vehículo:</span>
              <span class="stat-value">${vehiculo || 'Sin asignar'}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">📋</span>
              <span class="stat-label">Asignadas:</span>
              <span class="stat-value">${resAsignadas}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">✅</span>
              <span class="stat-label">Completadas:</span>
              <span class="stat-value">${resCompletadas}</span>
            </div>
          </div>
          
          <div class="admin-item-actions">
            <button class="btn secondary" onclick="verUsuario(${u.id})">
              <span>👁️</span> Ver
            </button>
            <button class="btn secondary" onclick="editarUsuario(${u.id})">
              <span>✏️</span> Editar
            </button>
            <button class="btn danger" onclick="deleteUsuario(${u.id})">
              <span>🗑️</span> Eliminar
            </button>
          </div>
        `;
      usuariosCont.appendChild(div);
    });
    }
  }

  // Actividad reciente mejorada
  const recentCont = document.getElementById('adminRecent');
  if (recentCont) {
    recentCont.innerHTML = '';
    const recientes = [...reservas].sort((a,b)=>b.id-a.id).slice(0,5);
    
    if (recientes.length === 0) {
      recentCont.innerHTML = '<div class="empty-state">📋 No hay actividad reciente</div>';
    } else {
      recientes.forEach(r => {
      const div = document.createElement('div');
        div.className = 'analysis-list-item';
        
        const fecha = new Date(r.id).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const estadoInfo = {
          'recogido': { icon: '✅', text: 'Completado', class: 'status-success' },
          'en-curso': { icon: '🚗', text: 'En Curso', class: 'status-warning' },
          'asignado': { icon: '📋', text: 'Asignado', class: 'status-info' },
          'pendiente': { icon: '⏳', text: 'Pendiente', class: 'status-pending' }
        };
        
        const estado = r.estado === 'recogido' ? 'recogido' : 
                      r.estado === 'en-curso' ? 'en-curso' : 
                      r.conductorId ? 'asignado' : 'pendiente';
        
        const statusInfo = estadoInfo[estado];
        
        div.innerHTML = `
          <div class="item-header">
            <div class="item-main">
              <span class="item-icon">🚗</span>
              <div class="item-details">
                <div class="item-title">${r.origen} → ${r.destino}</div>
                <div class="item-meta">Cliente: ${getUserName(r.clienteId)} • ${r.tipo}</div>
              </div>
            </div>
            <div class="item-status">
              <span class="status-badge ${statusInfo.class}">
                ${statusInfo.icon} ${statusInfo.text}
              </span>
            </div>
          </div>
          <div class="item-footer">
            <span class="item-time">🕒 ${fecha}</span>
            <span class="item-price">💰 $${r.precio}</span>
            <span class="item-horario">⏰ ${r.horario}</span>
          </div>
        `;
      recentCont.appendChild(div);
    });
    }
  }

  // Top rutas más populares mejoradas
  const topRutas = document.getElementById('adminTopRutas');
  if (topRutas) {
    topRutas.innerHTML = '';
    const countByRuta = reservas.reduce((acc, r) => { 
      const k = `${r.origen}→${r.destino}`; 
      acc[k] = (acc[k]||0)+1; 
      return acc; 
    }, {});
    
    const rutasOrdenadas = Object.entries(countByRuta).sort((a,b)=>b[1]-a[1]).slice(0,5);
    
    if (rutasOrdenadas.length === 0) {
      topRutas.innerHTML = '<div class="empty-state">🗺️ No hay datos de rutas</div>';
    } else {
      rutasOrdenadas.forEach(([ruta, count], index) => {
      const div = document.createElement('div');
        div.className = 'analysis-list-item';
        
        const rankIcons = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const rankIcon = rankIcons[index] || '📍';
        
        // Calcular porcentaje del total
        const totalViajes = reservas.length;
        const porcentaje = totalViajes > 0 ? Math.round((count / totalViajes) * 100) : 0;
        
        div.innerHTML = `
          <div class="item-header">
            <div class="item-main">
              <span class="item-icon">${rankIcon}</span>
              <div class="item-details">
                <div class="item-title">${ruta}</div>
                <div class="item-meta">Ruta más solicitada</div>
              </div>
            </div>
            <div class="item-status">
              <span class="count-badge">${count}</span>
            </div>
          </div>
          <div class="item-footer">
            <span class="item-percentage">📊 ${porcentaje}% del total</span>
            <span class="item-frequency">🔄 ${count} viajes</span>
          </div>
        `;
      topRutas.appendChild(div);
    });
    }
  }

  // Utilización de flota mejorada
  const fleetStats = document.getElementById('adminFleetStats');
  if (fleetStats) {
    fleetStats.innerHTML = '';
    
    const totalFlota = flota.length + mockFlota.length;
    const vehiculosConReservas = reservas.filter(r => r.vehiculo && r.estado !== 'recogido').length;
    const vehiculosActivos = reservas.filter(r => r.vehiculo).length;
    const utilizacion = totalFlota > 0 ? Math.round((vehiculosActivos / totalFlota) * 100) : 0;
    
    // Estadísticas generales de flota
    const statsGenerales = [
      {
        icon: '🚗',
        title: 'Vehículos Totales',
        value: totalFlota,
        meta: 'Flota completa',
        type: 'info'
      },
      {
        icon: '🚛',
        title: 'En Servicio Activo',
        value: vehiculosConReservas,
        meta: 'Asignados actualmente',
        type: 'warning'
      },
      {
        icon: '🅿️',
        title: 'Disponibles',
        value: totalFlota - vehiculosConReservas,
        meta: 'Listos para asignar',
        type: 'success'
      },
      {
        icon: '📊',
        title: 'Tasa de Utilización',
        value: utilizacion + '%',
        meta: 'Eficiencia operativa',
        type: 'primary'
      }
    ];
    
    if (totalFlota === 0) {
      fleetStats.innerHTML = '<div class="empty-state">🚗 No hay vehículos registrados</div>';
    } else {
      statsGenerales.forEach(stat => {
      const div = document.createElement('div');
        div.className = 'analysis-list-item compact';
        
        const typeClasses = {
          'info': 'status-info',
          'warning': 'status-warning', 
          'success': 'status-success',
          'primary': 'status-primary'
        };
        
        div.innerHTML = `
          <div class="item-header">
            <div class="item-main">
              <span class="item-icon">${stat.icon}</span>
              <div class="item-details">
                <div class="item-title">${stat.title}</div>
                <div class="item-meta">${stat.meta}</div>
              </div>
            </div>
            <div class="item-status">
              <span class="metric-badge ${typeClasses[stat.type]}">${stat.value}</span>
            </div>
          </div>
        `;
      fleetStats.appendChild(div);
    });
    }
  }

  // Estadísticas de promociones mejoradas
  const promoStats = document.getElementById('adminPromoStats');
  if (promoStats) {
    promoStats.innerHTML = '';
    
    const promociones = storage.get("promos", []);
    const reservasConPromo = reservas.filter(r => r.promo);
    const totalDescuentos = reservasConPromo.length * 5; // Estimado $5 por promo
    const tasaUso = reservas.length > 0 ? Math.round((reservasConPromo.length / reservas.length) * 100) : 0;
    
    // Estadísticas generales de promociones
    const promoStatsData = [
      {
        icon: '🎟️',
        title: 'Promociones Activas',
        value: promociones.length,
        meta: 'Cupones disponibles',
        type: 'info'
      },
      {
        icon: '🎯',
        title: 'Uso Total',
        value: reservasConPromo.length,
        meta: 'Reservas con descuento',
        type: 'warning'
      },
      {
        icon: '💸',
        title: 'Descuento Otorgado',
        value: '$' + totalDescuentos,
        meta: 'Ahorro para clientes',
        type: 'success'
      },
      {
        icon: '📈',
        title: 'Tasa de Adopción',
        value: tasaUso + '%',
        meta: 'Efectividad promocional',
        type: 'primary'
      }
    ];
    
    if (promociones.length === 0 && reservasConPromo.length === 0) {
      promoStats.innerHTML = '<div class="empty-state">🎟️ No hay promociones activas</div>';
    } else {
      promoStatsData.forEach(stat => {
      const div = document.createElement('div');
        div.className = 'analysis-list-item compact';
        
        const typeClasses = {
          'info': 'status-info',
          'warning': 'status-warning', 
          'success': 'status-success',
          'primary': 'status-primary'
        };
        
        div.innerHTML = `
          <div class="item-header">
            <div class="item-main">
              <span class="item-icon">${stat.icon}</span>
              <div class="item-details">
                <div class="item-title">${stat.title}</div>
                <div class="item-meta">${stat.meta}</div>
              </div>
            </div>
            <div class="item-status">
              <span class="metric-badge ${typeClasses[stat.type]}">${stat.value}</span>
            </div>
          </div>
        `;
      promoStats.appendChild(div);
    });
  }
  }
  // Clientes - Rediseñado
  const clientesCont = document.getElementById('adminClientes');
  if (clientesCont) {
    clientesCont.innerHTML = '';
    const mockClients = storage.get('mockClients', []);
    const clientesAll = [
      ...users.filter(u => u.role === 'cliente'),
      ...mockClients.map(m => ({ ...m, role: 'cliente' })),
    ];
    
    if (clientesAll.length === 0) {
      clientesCont.innerHTML = '<div class="empty-state">👥 No hay clientes registrados</div>';
    } else {
    clientesAll.forEach(u => {
      const mias = reservas.filter(r => r.clienteId === u.id);
      const entregadas = mias.filter(r => r.estado === 'recogido');
        const pendientes = mias.filter(r => !r.conductorId).length;
      const rated = mias.filter(r => typeof r.rating === 'number');
        const avg = rated.length ? (rated.reduce((a,b)=>a+b.rating,0)/rated.length).toFixed(1) : null;
        const gastoTotal = mias.reduce((sum, r) => sum + (Number(r.precio) || 0), 0);
        
      const div = document.createElement('div');
        div.className = 'admin-list-item';
        
        // Determinar el nivel del cliente basado en reservas
        let clientLevel = '';
        let levelClass = '';
        if (mias.length === 0) {
          clientLevel = '🆕 Nuevo';
          levelClass = 'level-new';
        } else if (mias.length >= 10) {
          clientLevel = '⭐ VIP';
          levelClass = 'level-vip';
        } else if (mias.length >= 5) {
          clientLevel = '💎 Premium';
          levelClass = 'level-premium';
        } else {
          clientLevel = '👤 Regular';
          levelClass = 'level-regular';
        }
        
        div.innerHTML = `
          <div class="admin-item-header">
            <div class="admin-item-main">
              <div class="admin-item-avatar">
                <span class="avatar-icon">👤</span>
              </div>
              <div class="admin-item-details">
                <div class="admin-item-name">${u.nombre}</div>
                <div class="admin-item-meta">CI: ${u.cedula} • ${u.email || 'Sin email'}</div>
                <div class="admin-item-contact">📞 ${u.telefono || 'Sin teléfono'}</div>
              </div>
            </div>
            <div class="admin-item-badge">
              <span class="client-level-badge ${levelClass}">${clientLevel}</span>
            </div>
          </div>
          
          <div class="admin-item-stats">
            <div class="stat-item">
              <span class="stat-icon">📋</span>
              <span class="stat-label">Total Reservas:</span>
              <span class="stat-value">${mias.length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">✅</span>
              <span class="stat-label">Completadas:</span>
              <span class="stat-value">${entregadas.length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">⏳</span>
              <span class="stat-label">Pendientes:</span>
              <span class="stat-value">${pendientes}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">💰</span>
              <span class="stat-label">Gasto Total:</span>
              <span class="stat-value">$${gastoTotal}</span>
            </div>
            ${avg ? `
            <div class="stat-item">
              <span class="stat-icon">⭐</span>
              <span class="stat-label">Calificación:</span>
              <span class="stat-value">${avg}/5</span>
            </div>
            ` : ''}
          </div>
          
          <div class="admin-item-actions">
            <button class="btn secondary" onclick="verCliente(${u.id})">
              <span>👁️</span> Ver
            </button>
            <button class="btn secondary" onclick="editarCliente(${u.id})">
              <span>✏️</span> Editar
            </button>
            <button class="btn danger" onclick="deleteCliente(${u.id})">
              <span>🗑️</span> Eliminar
            </button>
          </div>
        `;
      clientesCont.appendChild(div);
    });
    }
  }

  // Renderizar todas las reservas con estadísticas
  // renderTodasReservas();

  // invoices mock
  const invCont = document.getElementById("adminInvoices");
  if (invCont) {
    invCont.innerHTML = "";
    const invoices = storage.get("invoices", []);
    invoices.forEach(i => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.textContent = `#${i.id} • ${i.cliente} • $${i.monto} • ${i.metodo}`;
      invCont.appendChild(div);
    });
  }

  // promos
  const promos = storage.get("promos", []);
  const promoCont = document.getElementById("adminPromos");
  if (promoCont) {
    promoCont.innerHTML = "";
    promos.forEach(p => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.textContent = `${p.type.toUpperCase()} • ${p.code}${p.discountPct?` • ${p.discountPct}%`:p.balance?` • $${p.balance}`:""}`;
      promoCont.appendChild(div);
    });
  }

  // ratings KPI
  const ratingEl = document.getElementById("kpiRating");
  if (ratingEl) {
    const rated = reservas.filter(r => typeof r.rating === 'number');
    const avg = rated.length ? (rated.reduce((a,b)=>a+b.rating,0)/rated.length).toFixed(2) : '-';
    ratingEl.textContent = String(avg);
  }

  renderAdminReservas();

  // dentro de renderAdmin(), después de KPIs y otros renders, añadimos:
  const resFilterBtns = document.querySelectorAll('.res-filter-btn');
  resFilterBtns.forEach(b => b.classList.remove('active'));
  const first = document.querySelector('.res-filter-btn[data-filter="pendiente"]');
  first?.classList.add('active');
  renderAdminReservas('pendiente');
}

function renderTodasReservas() {
  const reservas = storage.get("reservas", []).sort((a, b) => b.id - a.id);
  
  // Actualizar estadísticas
  const total = reservas.length;
  const pendientes = reservas.filter(r => !r.conductorId).length;
  const asignadas = reservas.filter(r => r.conductorId && r.estado !== "recogido").length;
  const completadas = reservas.filter(r => r.estado === "recogido").length;
  
  document.getElementById("statTotalReservas").textContent = total;
  document.getElementById("statPendientes").textContent = pendientes;
  document.getElementById("statAsignadas").textContent = asignadas;
  document.getElementById("statCompletadas").textContent = completadas;
  
  // Renderizar reservas por pestañas
  renderReservasPorEstado();
}

function renderReservasPorEstado() {
  const reservas = storage.get("reservas", []).sort((a, b) => b.id - a.id);
  
  // Filtrar por estado
  const pendientes = reservas.filter(r => !r.conductorId);
  const asignadas = reservas.filter(r => r.conductorId && r.estado !== "recogido");
  const completadas = reservas.filter(r => r.estado === "recogido");
  
  // Renderizar cada pestaña
  renderReservasEnContenedor("reservasPendientesList", pendientes, "pendientes");
  renderReservasEnContenedor("reservasAsignadasList", asignadas, "asignadas");
  renderReservasEnContenedor("reservasCompletadasList", completadas, "completadas");
}

function renderReservasEnContenedor(containerId, reservas, tipo) {
  const cont = document.getElementById(containerId);
  cont.innerHTML = "";
  
  if (reservas.length === 0) {
    const mensaje = tipo === "pendientes" ? "No hay reservas pendientes de asignar" :
                    tipo === "asignadas" ? "No hay reservas asignadas" :
                    "No hay reservas completadas";
    cont.innerHTML = `<div class='text-muted'>${mensaje}</div>`;
    return;
  }
  
  reservas.forEach(res => {
    const div = document.createElement("div");
    div.className = "list-item";
    
    const fechaCreacion = new Date(res.id).toLocaleDateString('es-ES');
    const cliente = getUserName(res.clienteId);
    const conductor = res.conductorId ? getUserName(res.conductorId) : 'Sin asignar';
    
    const estadoTexto = res.estado === 'recogido' ? 'Completada' :
                       res.estado === 'en-curso' ? 'En curso' :
                       res.conductorId ? 'Asignada' : 'Pendiente';
    
    const estadoBadge = res.estado === 'recogido' ? 'success' :
                        res.estado === 'en-curso' ? 'warn' :
                        res.conductorId ? 'badge' : '';
    
    const ratingText = res.rating ? ` • ★ ${res.rating}` : '';
    
    let actionButtons = `
      <button class="btn secondary verReservaBtn" data-id="${res.id}">Ver</button>
    `;
    
    if (tipo === "pendientes") {
      actionButtons += `<button class="btn primary asignarReservaBtn" data-id="${res.id}">Asignar</button>`;
    }
    
    if (tipo !== "completadas") {
      actionButtons += `<button class="btn secondary editarReservaBtn" data-id="${res.id}">Editar</button>`;
    }
    
    div.innerHTML = `
      <div class="row">
        <strong>${res.origen} → ${res.destino}</strong>
        <span class="badge ${estadoBadge}">${estadoTexto}</span>
      </div>
      <div>Cliente: ${cliente} • Fecha: ${fechaCreacion} • Horario: ${res.horario}</div>
      <div>Tipo: ${res.tipo} • Dirección: ${res.direccion}</div>
      <div>Conductor: ${conductor} • Vehículo: ${res.vehiculo || 'Sin asignar'}</div>
      <div>Pago: ${res.metodoPago} • Precio: $${res.precio}${res.promo ? ` • ${res.promo}` : ''}${ratingText}</div>
      <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 12px;">
        ${actionButtons}
      </div>
    `;
    
    cont.appendChild(div);
  });
  
  // Event listeners
  cont.querySelectorAll(".verReservaBtn").forEach(btn => 
    btn.addEventListener("click", () => verReservaCompleta(Number(btn.dataset.id)))
  );
  cont.querySelectorAll(".asignarReservaBtn").forEach(btn => 
    btn.addEventListener("click", () => abrirModalAsignar(Number(btn.dataset.id)))
  );
  cont.querySelectorAll(".editarReservaBtn").forEach(btn => 
    btn.addEventListener("click", () => abrirModalEditar(Number(btn.dataset.id)))
  );
}

function verReservaCompleta(reservaId) {
  const reservas = storage.get("reservas", []);
  const reserva = reservas.find(r => r.id === reservaId);
  
  if (!reserva) {
    toast("No se encontró la reserva");
    return;
  }

  const cliente = getUserName(reserva.clienteId);
    const users = storage.get("users", []);
  const clienteCompleto = users.find(u => u.id === reserva.clienteId);
  const conductor = reserva.conductorId ? getUserName(reserva.conductorId) : 'Sin asignar';
  
  const estadoTexto = reserva.estado === 'recogido' ? 'Completada' :
                     reserva.estado === 'en-curso' ? 'En curso' :
                     reserva.conductorId ? 'Asignada' : 'Pendiente';
  
  const fechaCreacion = new Date(reserva.id).toLocaleDateString('es-ES');
  
  const detallesHTML = `
    <div class="detalle-section">
      <h4>📋 Información General</h4>
      <div class="detalle-item">
        <span class="detalle-label">ID de Reserva:</span>
        <span class="detalle-value">#${reserva.id}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Fecha de creación:</span>
        <span class="detalle-value">${fechaCreacion}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Estado:</span>
        <span class="detalle-value"><span class="badge">${estadoTexto}</span></span>
      </div>
    </div>

    <div class="detalle-section">
      <h4>🚗 Detalles del Viaje</h4>
      <div class="detalle-item">
        <span class="detalle-label">Ruta:</span>
        <span class="detalle-value">${reserva.origen} → ${reserva.destino}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Horario:</span>
        <span class="detalle-value">${reserva.horario}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Tipo de servicio:</span>
        <span class="detalle-value">${reserva.tipo}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Dirección de recogida:</span>
        <span class="detalle-value">${reserva.direccion}</span>
      </div>
    </div>

    <div class="detalle-section">
      <h4>👤 Cliente</h4>
      <div class="detalle-item">
        <span class="detalle-label">Nombre:</span>
        <span class="detalle-value">${cliente}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Teléfono:</span>
        <span class="detalle-value">${clienteCompleto?.telefono || 'No disponible'}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Email:</span>
        <span class="detalle-value">${clienteCompleto?.email || 'No disponible'}</span>
      </div>
    </div>

    <div class="detalle-section">
      <h4>🚙 Asignación</h4>
      <div class="detalle-item">
        <span class="detalle-label">Conductor:</span>
        <span class="detalle-value">${conductor}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Vehículo:</span>
        <span class="detalle-value">${reserva.vehiculo || 'Sin asignar'}</span>
      </div>
    </div>

    <div class="detalle-section">
      <h4>💰 Pago</h4>
      <div class="detalle-item">
        <span class="detalle-label">Precio:</span>
        <span class="detalle-value">$${reserva.precio}</span>
      </div>
      <div class="detalle-item">
        <span class="detalle-label">Método de pago:</span>
        <span class="detalle-value">${reserva.metodoPago}</span>
      </div>
      ${reserva.promo ? `
      <div class="detalle-item">
        <span class="detalle-label">Promoción:</span>
        <span class="detalle-value">${reserva.promo}</span>
      </div>
      ` : ''}
      ${reserva.rating ? `
      <div class="detalle-item">
        <span class="detalle-label">Calificación:</span>
        <span class="detalle-value">★ ${reserva.rating}/5</span>
      </div>
      ` : ''}
    </div>
  `;
  
  document.getElementById('verReservaContent').innerHTML = detallesHTML;
  document.getElementById('verReservaModal').hidden = false;
}

function abrirModalAsignar(reservaId) {
  const reservas = storage.get("reservas", []);
  const reserva = reservas.find(r => r.id === reservaId);
  
  if (!reserva) {
    toast("No se encontró la reserva");
    return;
  }
  
  // Mostrar información de la reserva
  const infoHTML = `
    <strong>Reserva #${reserva.id}</strong> - ${reserva.origen} → ${reserva.destino}<br>
    Cliente: ${getUserName(reserva.clienteId)} • Horario: ${reserva.horario} • Tipo: ${reserva.tipo}
  `;
  document.getElementById('asignarReservaInfo').innerHTML = infoHTML;
  
  // Llenar conductores disponibles
  const conductorSelect = document.getElementById('asignarConductor');
  conductorSelect.innerHTML = '<option value="">Seleccionar conductor...</option>';
  const users = storage.get('users', []);
  users.filter(u => u.role === 'conductor').forEach(conductor => {
    const option = document.createElement('option');
    option.value = String(conductor.id);
    option.textContent = conductor.nombre;
    conductorSelect.appendChild(option);
  });
  
  // Llenar vehículos disponibles
  const vehiculoSelect = document.getElementById('asignarVehiculo');
  vehiculoSelect.innerHTML = '<option value="">Seleccionar vehículo...</option>';
  const flota = storage.get('flota', []);
  flota.filter(v => v.estado === 'activo').forEach(vehiculo => {
    const option = document.createElement('option');
    option.value = vehiculo.placa;
    option.textContent = `${vehiculo.placa} - ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.capacidad} asientos)`;
    vehiculoSelect.appendChild(option);
  });
  
  // Prellenar datos
  document.getElementById('asignarPrecio').value = reserva.precio || '';
  document.getElementById('asignarHoraRecogida').value = reserva.horario || '';
  
  // Guardar ID de reserva para el submit
  document.getElementById('asignarReservaForm').dataset.reservaId = reservaId;
  
  document.getElementById('asignarReservaModal').hidden = false;
}

function abrirModalEditar(reservaId) {
  const reservas = storage.get("reservas", []);
  const reserva = reservas.find(r => r.id === reservaId);
  
  if (!reserva) {
    toast("No se encontró la reserva");
    return;
  }
  
  // Prellenar formulario
  document.getElementById('editarEstado').value = reserva.estado || 'pendiente';
  document.getElementById('editarMetodoPago').value = reserva.metodoPago || 'efectivo';
  document.getElementById('editarPrecio').value = reserva.precio || '';
  document.getElementById('editarPromo').value = reserva.promo || '';
  document.getElementById('editarDireccion').value = reserva.direccion || '';
  document.getElementById('editarNotas').value = reserva.notas || '';
  
  // Guardar ID de reserva para el submit
  document.getElementById('editarReservaForm').dataset.reservaId = reservaId;
  
  document.getElementById('editarReservaModal').hidden = false;
}

// Forms & Nav wiring
function wireEvents() {
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("registerForm").addEventListener("submit", handleRegister);
  document.getElementById("reservaForm").addEventListener("submit", handleReserva);
  document.getElementById("rutaForm").addEventListener("submit", handleAddRuta);
  document.getElementById("logoutBtn").addEventListener("click", () => { clearSession(); updateSessionUi(); showView("auth"); });
  const companySelect = document.getElementById("companySelect");
  companySelect?.addEventListener("change", (e) => {
    setCompanyNamespace(e.target.value);
    seedIfEmpty();
    const session = getSession();
    updateSessionUi();
    if (session) navigateByRole(session.role); else showView("auth");
  });

  // theme toggle (removed button; keep applying saved or default theme)
    applySavedTheme();

  // admin tabs
  document.querySelectorAll('#view-admin .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      document.querySelectorAll('#view-admin .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#view-admin .tab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.add('active');
    });
  });

  // conductor tabs
  document.querySelectorAll('#view-conductor .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      document.querySelectorAll('#view-conductor .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#view-conductor .tab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`conductor-tab-${tab}`);
      if (panel) panel.classList.add('active');
    });
  });

  // asignaciones sub-tabs
  document.querySelectorAll('.asig-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-status');
      document.querySelectorAll('.asig-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.asig-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`asig-${status}`);
      if (panel) panel.classList.add('active');
    });
  });

  // cliente tabs
  document.querySelectorAll('#view-cliente .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      document.querySelectorAll('#view-cliente .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#view-cliente .tab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`cliente-tab-${tab}`);
      if (panel) panel.classList.add('active');
      
      // Actualizar contenido según la pestaña
      if (tab === 'historial') {
        renderHistorial();
      } else if (tab === 'mis-viajes') {
        renderMisViajes();
      }
    });
  });

  // auth toggles (login -> register separado)
  const goToRegister = document.getElementById('goToRegister');
  const goToLogin = document.getElementById('goToLogin');
  goToRegister?.addEventListener('click', (e) => { e.preventDefault(); showView('register'); });
  goToLogin?.addEventListener('click', (e) => { e.preventDefault(); showView('auth'); });

  document.getElementById('goToLoginFromRegister')?.addEventListener('click', (e) => { e.preventDefault(); showView('auth'); });

  // pretty uploader
  const regFotoBtn = document.getElementById('regFotoBtn');
  const regFotoInput = document.getElementById('regFoto');
  const regFotoPreview = document.getElementById('regFotoPreview');
  regFotoBtn?.addEventListener('click', () => regFotoInput?.click());
  regFotoInput?.addEventListener('change', () => {
    const file = regFotoInput.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('La imagen supera 2MB'); regFotoInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (regFotoPreview) {
        regFotoPreview.src = String(reader.result);
        regFotoPreview.hidden = false;
      }
    };
    reader.readAsDataURL(file);
  });

  // map picker
  const openMapPickerBtns = Array.from(document.querySelectorAll('#openMapPicker'));
  const mapModal = document.getElementById('mapModal');
  const closeMapPicker = document.getElementById('closeMapPicker');
  const saveMapPicker = document.getElementById('saveMapPicker');
  const mapCoords = document.getElementById('mapCoords');
  const mapAddress = document.getElementById('mapAddress');
  const regLatInputs = Array.from(document.querySelectorAll('[id="regLat"]'));
  const regLngInputs = Array.from(document.querySelectorAll('[id="regLng"]'));
  const pickedAddressEls = Array.from(document.querySelectorAll('[id="pickedAddress"]'));

  let leafletMap = null;
  let leafletMarker = null;

  function openPicker() {
    if (!mapModal) return;
    mapModal.style.display = 'grid';
    mapModal.hidden = false;
    setTimeout(() => {
      if (!leafletMap) {
        leafletMap = L.map('map').setView([-0.1807, -78.4678], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(leafletMap);
        leafletMap.on('click', onMapClick);
      }
      leafletMap.invalidateSize();
    }, 50);
  }
  
  function closePicker() {
    if (!mapModal) return;
    mapModal.hidden = true;
    mapModal.style.display = 'none';
  }
  
  // Exponer para uso global (p.ej., desde el selector de origen)
  window.openPicker = openPicker;
  window.closePicker = closePicker;

  function onMapClick(e) {
    const { lat, lng } = e.latlng;
    if (leafletMarker) leafletMap.removeLayer(leafletMarker);
    leafletMarker = L.marker([lat, lng]).addTo(leafletMap);
    mapCoords.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    reverseGeocode(lat, lng).then(addr => { mapAddress.textContent = addr || ''; });
  }

  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      return data.display_name || '';
    } catch { return ''; }
  }

  openMapPickerBtns.forEach(btn => btn.addEventListener('click', openPicker));
  closeMapPicker?.addEventListener('click', closePicker);
  saveMapPicker?.addEventListener('click', async () => {
    if (!leafletMarker) { toast('Seleccione una ubicación en el mapa'); return; }
    const { lat, lng } = leafletMarker.getLatLng();
    regLatInputs.forEach(i => { if (i) i.value = String(lat); });
    regLngInputs.forEach(i => { if (i) i.value = String(lng); });
    const addr = mapAddress.textContent || await reverseGeocode(lat, lng);
    pickedAddressEls.forEach(el => { if (el) el.textContent = addr ? `Dirección: ${addr}` : `${lat.toFixed(5)}, ${lng.toFixed(5)}`; });
    // Si el picker fue invocado para origen en servicio
    if (window.__pickerTarget === 'origin') {
      const origenInput = document.getElementById('csOrigen');
      const address = addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (origenInput) origenInput.value = address;
      // Guardar como favorita
      const session = getSession();
      const users = storage.get('users', []);
      const idx = users.findIndex(u => u.id === session?.id);
      if (idx >= 0) {
        const favoritas = Array.isArray(users[idx].favoritasDirecciones) ? users[idx].favoritasDirecciones : [];
        if (!favoritas.includes(address)) favoritas.push(address);
        users[idx] = { ...users[idx], favoritasDirecciones: favoritas };
        storage.set('users', users);
      }
      // refrescar selector de origen y seleccionar la nueva favorita
      populateOrigenOptions();
      const sel = document.getElementById('csOrigenSelect');
      if (sel) sel.value = `fav:${address}`;
      window.__pickerTarget = null;
    } else if (window.__pickerTarget === 'shared') {
      const input = document.getElementById('sharedDireccion');
      const address = addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (input) input.value = address;
      window.__pickerTarget = null;
    }
    closePicker();
  });

  // removed top nav buttons

  // servicio selector
  const servicioTipo = document.getElementById("servicioTipo");
  if (servicioTipo) servicioTipo.addEventListener("change", onServicioChange);
  // Inicializar descripción por defecto
  updateServicioDescripcion("compartido");
  onServicioChange();

  // custom service form
  const csForm = document.getElementById("customServiceForm");
  if (csForm) csForm.addEventListener("submit", handleCustomServiceSubmit);

  // gps controls
  const gpsStart = document.getElementById("gpsStart");
  const gpsStop = document.getElementById("gpsStop");
  gpsStart?.addEventListener("click", startGpsMock);
  gpsStop?.addEventListener("click", stopGpsMock);

  // promo form
  const promoForm = document.getElementById("promoForm");
  promoForm?.addEventListener("submit", handleAddPromo);

  // assign form
  const assignForm = document.getElementById("assignForm");
  assignForm?.addEventListener("submit", handleAssignReserva);

  // ratings form
  const ratingForm = document.getElementById("ratingForm");
  ratingForm?.addEventListener("submit", handleAddRating);

  // admin CRUD buttons
  document.getElementById('addUsuarioBtn')?.addEventListener('click', () => {
    showView('admin-user-new');
  });
  document.getElementById('addFlotaBtn')?.addEventListener('click', () => {
    showView('admin-vehicle-new');
  });

  // admin create user form
  const auForm = document.getElementById('adminCreateUserForm');
  if (auForm) {
    document.getElementById('auCancelar')?.addEventListener('click', () => {
      showView('admin');
      renderAdmin();
    });
    const fotoInput = document.getElementById('auFoto');
    const fotoBtn = document.getElementById('auFotoBtn');
    const fotoPreview = document.getElementById('auFotoPreview');
    fotoBtn?.addEventListener('click', () => fotoInput?.click());
    fotoInput?.addEventListener('change', () => {
      const f = fotoInput.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        if (fotoPreview) {
          fotoPreview.src = r.result;
          fotoPreview.hidden = false;
        }
      };
      r.readAsDataURL(f);
    });
    auForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = document.getElementById('auNombre').value.trim();
      const cedula = document.getElementById('auCedula').value.trim();
      const role = document.getElementById('auRole').value;
      const telefono = document.getElementById('auTelefono').value.trim();
      const email = document.getElementById('auEmail').value.trim();
      const password = document.getElementById('auPassword').value;
      const direccion = document.getElementById('auDireccion').value.trim();
      const foto = fotoPreview && !fotoPreview.hidden ? fotoPreview.src : null;
      const users = storage.get('users', []);
      if (users.some(u => u.cedula === cedula)) { document.getElementById('auMsg').textContent = 'CI ya registrada'; return; }
      if (users.some(u => (u.email||'').toLowerCase() === email.toLowerCase())) { document.getElementById('auMsg').textContent = 'Correo ya registrado'; return; }
      const nuevo = { id: Date.now(), role, nombre, cedula, telefono, email, password, direccion, foto };
      users.push(nuevo);
      storage.set('users', users);
      toast('Usuario creado');
      showView('admin');
      renderAdmin();
    });
  }

  // admin create vehicle form
  const avForm = document.getElementById('adminCreateVehicleForm');
  if (avForm) {
    document.getElementById('avCancelar')?.addEventListener('click', () => {
      showView('admin');
      renderAdmin();
    });
    
    avForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const placa = document.getElementById('avPlaca').value.trim().toUpperCase();
      const tipo = document.getElementById('avTipo').value;
      const marca = document.getElementById('avMarca').value.trim();
      const modelo = document.getElementById('avModelo').value.trim();
      const año = Number(document.getElementById('avAño').value);
      const capacidad = Number(document.getElementById('avCapacidad').value);
      const color = document.getElementById('avColor').value.trim();
      const estado = document.getElementById('avEstado').value;
      const soat = document.getElementById('avSoat').value.trim();
      const observaciones = document.getElementById('avObservaciones').value.trim();
      
      // Validaciones
      if (!placa || !tipo || !marca || !modelo || !año || !capacidad) {
        document.getElementById('avMsg').textContent = 'Complete todos los campos obligatorios';
        return;
      }
      
      const flota = storage.get('flota', []);
      if (flota.some(v => v.placa.toUpperCase() === placa)) {
        document.getElementById('avMsg').textContent = 'Ya existe un vehículo con esa placa';
        return;
      }
      
      const nuevoVehiculo = {
        id: Date.now(),
        placa,
        tipo,
        marca,
        modelo,
        año,
        capacidad,
        color,
        conductor: '', // Sin conductor asignado al crear
        conductorId: null,
        estado,
        soat,
        observaciones,
        fechaRegistro: new Date().toISOString()
      };
      
      flota.push(nuevoVehiculo);
      storage.set('flota', flota);
      
      toast('Vehículo agregado exitosamente');
      showView('admin');
      renderAdmin();
    });
  }

  // Modal de detalles
  const closeDetallesModal = document.getElementById('closeDetallesModal');
  const closeDetallesModalBtn = document.getElementById('closeDetallesModalBtn');
  const detallesModal = document.getElementById('detallesModal');
  
  const cerrarDetallesModal = () => {
    detallesModal.hidden = true;
  };
  
  closeDetallesModal?.addEventListener('click', cerrarDetallesModal);
  closeDetallesModalBtn?.addEventListener('click', cerrarDetallesModal);
  
  // Cerrar modal al hacer click en el backdrop
  detallesModal?.addEventListener('click', (e) => {
    if (e.target === detallesModal) {
      cerrarDetallesModal();
    }
  });

  // viajes sub-tabs
  document.querySelectorAll('.viajes-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-status');
      document.querySelectorAll('.viajes-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.viajes-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`viajes-${status}`);
      if (panel) panel.classList.add('active');
      
      // Actualizar contenido
      renderMisViajes();
    });
  });

  // Modales de reservas - Ver
  const closeVerReservaModal = document.getElementById('closeVerReservaModal');
  const closeVerReservaModalBtn = document.getElementById('closeVerReservaModalBtn');
  const verReservaModal = document.getElementById('verReservaModal');
  
  const cerrarVerReservaModal = () => {
    verReservaModal.hidden = true;
  };
  
  closeVerReservaModal?.addEventListener('click', cerrarVerReservaModal);
  closeVerReservaModalBtn?.addEventListener('click', cerrarVerReservaModal);
  verReservaModal?.addEventListener('click', (e) => {
    if (e.target === verReservaModal) cerrarVerReservaModal();
  });

  // Modales de reservas - Asignar
  const closeAsignarReservaModal = document.getElementById('closeAsignarReservaModal');
  const cancelarAsignarReserva = document.getElementById('cancelarAsignarReserva');
  const confirmarAsignarReserva = document.getElementById('confirmarAsignarReserva');
  const asignarReservaModal = document.getElementById('asignarReservaModal');
  
  const cerrarAsignarReservaModal = () => {
    asignarReservaModal.hidden = true;
  };
  
  closeAsignarReservaModal?.addEventListener('click', cerrarAsignarReservaModal);
  cancelarAsignarReserva?.addEventListener('click', cerrarAsignarReservaModal);
  asignarReservaModal?.addEventListener('click', (e) => {
    if (e.target === asignarReservaModal) cerrarAsignarReservaModal();
  });

  confirmarAsignarReserva?.addEventListener('click', () => {
    const form = document.getElementById('asignarReservaForm');
    const reservaId = Number(form.dataset.reservaId);
    const conductorId = Number(document.getElementById('asignarConductor').value);
    const vehiculo = document.getElementById('asignarVehiculo').value;
    const horaRecogida = document.getElementById('asignarHoraRecogida').value;
    const duracion = Number(document.getElementById('asignarDuracion').value);
    const observaciones = document.getElementById('asignarObservaciones').value.trim();
    const precio = Number(document.getElementById('asignarPrecio').value);
    const prioridad = document.getElementById('asignarPrioridad').value;
    
    if (!conductorId || !vehiculo || !horaRecogida || !duracion || !precio) {
      document.getElementById('asignarReservaMsg').textContent = 'Complete todos los campos obligatorios';
      return;
    }
    
    const reservas = storage.get('reservas', []);
    const users = storage.get('users', []);
    const conductor = users.find(u => u.id === conductorId);
    
    const nuevasReservas = reservas.map(r => {
      if (r.id === reservaId) {
        return {
          ...r,
          conductorId,
          vehiculo,
          horaRecogida,
          duracion,
          observaciones,
          precio,
          prioridad,
          estado: 'confirmada',
          fechaAsignacion: new Date().toISOString()
        };
      }
      return r;
    });
    
    storage.set('reservas', nuevasReservas);
    cerrarAsignarReservaModal();
    renderAdmin();
    toast('Reserva asignada exitosamente');
  });

  // Modales de reservas - Editar
  const closeEditarReservaModal = document.getElementById('closeEditarReservaModal');
  const cancelarEditarReserva = document.getElementById('cancelarEditarReserva');
  const confirmarEditarReserva = document.getElementById('confirmarEditarReserva');
  const editarReservaModal = document.getElementById('editarReservaModal');
  
  const cerrarEditarReservaModal = () => {
    editarReservaModal.hidden = true;
  };
  
  closeEditarReservaModal?.addEventListener('click', cerrarEditarReservaModal);
  cancelarEditarReserva?.addEventListener('click', cerrarEditarReservaModal);
  editarReservaModal?.addEventListener('click', (e) => {
    if (e.target === editarReservaModal) cerrarEditarReservaModal();
  });

  confirmarEditarReserva?.addEventListener('click', () => {
    const form = document.getElementById('editarReservaForm');
    const reservaId = Number(form.dataset.reservaId);
    const estado = document.getElementById('editarEstado').value;
    const metodoPago = document.getElementById('editarMetodoPago').value;
    const precio = Number(document.getElementById('editarPrecio').value);
    const promo = document.getElementById('editarPromo').value.trim();
    const direccion = document.getElementById('editarDireccion').value.trim();
    const notas = document.getElementById('editarNotas').value.trim();
    
    if (!estado || !metodoPago || !precio || !direccion) {
      document.getElementById('editarReservaMsg').textContent = 'Complete todos los campos obligatorios';
      return;
    }
    
    const reservas = storage.get('reservas', []);
    const nuevasReservas = reservas.map(r => {
      if (r.id === reservaId) {
        return {
          ...r,
          estado,
          metodoPago,
          precio,
          promo: promo || null,
          direccion,
          notas,
          fechaEdicion: new Date().toISOString()
        };
      }
      return r;
    });
    
    storage.set('reservas', nuevasReservas);
    cerrarEditarReservaModal();
    renderAdmin();
    toast('Reserva actualizada exitosamente');
  });

  // reservas sub-tabs
  document.querySelectorAll('.reservas-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-status');
      document.querySelectorAll('.reservas-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.reservas-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`reservas-${status}`);
      if (panel) panel.classList.add('active');
      
      // Actualizar contenido
      renderReservasPorEstado();
    });
  });

  // Event listeners para modales de usuarios
  const confirmarEditarUsuarioBtn = document.getElementById('confirmarEditarUsuario');
  if (confirmarEditarUsuarioBtn) {
    confirmarEditarUsuarioBtn.addEventListener('click', () => {
      confirmarEditarUsuario();
    });
  }

  // Event listeners para modales de clientes
  const confirmarEditarClienteBtn = document.getElementById('confirmarEditarCliente');
  if (confirmarEditarClienteBtn) {
    confirmarEditarClienteBtn.addEventListener('click', () => {
      confirmarEditarCliente();
    });
  }

  // Event listeners para modales de vehículos
  const confirmarEditarVehiculoBtn = document.getElementById('confirmarEditarVehiculo');
  if (confirmarEditarVehiculoBtn) {
    confirmarEditarVehiculoBtn.addEventListener('click', () => {
      confirmarEditarVehiculo();
    });
  }

  // Event listeners para cerrar modales al hacer clic fuera
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });

  // Asegurar que todos los modales estén cerrados al inicializar
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
  });

  // filtros de reservas
  document.querySelectorAll('.res-filter-btn')?.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.res-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.getAttribute('data-filter');
      renderAdminReservas(f);
    });
  });
  // modal asignación
  document.getElementById('assignClose')?.addEventListener('click', closeAssignModal);
  document.getElementById('assignSave')?.addEventListener('click', saveAssignModal);

  // set inicial
  renderAdminReservas('pendiente');
}

// Funciones para modales de usuarios
function verUsuario(userId) {
  const users = storage.get("users", []);
  const mockDrivers = [
    { id: 9001, role: 'conductor', nombre: 'Conductor Demo 1', cedula: '000000001', email: 'conductor1@demo.com' },
    { id: 9002, role: 'conductor', nombre: 'Conductor Demo 2', cedula: '000000002', email: 'conductor2@demo.com' },
    { id: 9003, role: 'conductor', nombre: 'Conductor Demo 3', cedula: '000000003', email: 'conductor3@demo.com' },
  ];
  const allUsers = [...users, ...mockDrivers];
  const usuario = allUsers.find(u => u.id === userId);
  
  if (!usuario) {
    toast('Usuario no encontrado');
    return;
  }

  const reservas = storage.get("reservas", []);
  const resAsignadas = reservas.filter(r => r.conductorId === userId);
  const resCompletadas = resAsignadas.filter(r => r.estado === 'recogido');
  const flota = storage.get("flota", []);
  const mockFlota = [
    { id: 801, placa: 'XYZ-101', conductor: 'Conductor Demo 1', capacidad: 5 },
    { id: 802, placa: 'XYZ-102', conductor: 'Conductor Demo 2', capacidad: 7 },
    { id: 803, placa: 'XYZ-103', conductor: 'Conductor Demo 3', capacidad: 4 },
    { id: 804, placa: 'XYZ-104', conductor: 'Carlos Ruiz', capacidad: 5 },
  ];
  const allFlota = [...flota, ...mockFlota];
  const vehiculo = allFlota.find(v => v.conductor === usuario.nombre);

  const content = document.getElementById('verUsuarioContent');
  content.innerHTML = `
    <div class="view-section">
      <div class="view-section-title">👤 Información Personal</div>
      <div class="view-detail-grid">
        <div class="view-detail-item">
          <div class="view-detail-label">Nombre Completo</div>
          <div class="view-detail-value">${usuario.nombre}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Cédula</div>
          <div class="view-detail-value">${usuario.cedula}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Email</div>
          <div class="view-detail-value ${!usuario.email ? 'empty' : ''}">${usuario.email || 'No registrado'}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Teléfono</div>
          <div class="view-detail-value ${!usuario.telefono ? 'empty' : ''}">${usuario.telefono || 'No registrado'}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Rol</div>
          <div class="view-detail-value">${usuario.role === 'conductor' ? 'Conductor' : 'Administrador'}</div>
        </div>
      </div>
    </div>

    <div class="view-section">
      <div class="view-section-title">🚗 Información de Trabajo</div>
      <div class="view-detail-grid">
        <div class="view-detail-item">
          <div class="view-detail-label">Vehículo Asignado</div>
          <div class="view-detail-value ${!vehiculo ? 'empty' : ''}">${vehiculo ? vehiculo.placa : 'Sin asignar'}</div>
        </div>
        ${vehiculo ? `
        <div class="view-detail-item">
          <div class="view-detail-label">Tipo de Vehículo</div>
          <div class="view-detail-value">${vehiculo.tipo || 'No especificado'}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Capacidad</div>
          <div class="view-detail-value">${vehiculo.capacidad} personas</div>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="view-section">
      <div class="view-section-title">📊 Estadísticas de Rendimiento</div>
      <div class="view-stats-grid">
        <div class="view-stat-card">
          <div class="view-stat-number">${resAsignadas.length}</div>
          <div class="view-stat-label">Total Asignadas</div>
        </div>
        <div class="view-stat-card">
          <div class="view-stat-number">${resCompletadas.length}</div>
          <div class="view-stat-label">Completadas</div>
        </div>
        <div class="view-stat-card">
          <div class="view-stat-number">${resAsignadas.length - resCompletadas.length}</div>
          <div class="view-stat-label">En Proceso</div>
        </div>
        <div class="view-stat-card">
          <div class="view-stat-number">${resCompletadas.length > 0 ? Math.round((resCompletadas.length/resAsignadas.length)*100) : 0}%</div>
          <div class="view-stat-label">Tasa Éxito</div>
        </div>
      </div>
    </div>

    ${resAsignadas.length > 0 ? `
    <div class="view-section">
      <div class="view-section-title">📋 Reservas Recientes</div>
      <div class="view-reservas-list">
        ${resAsignadas.slice(0, 5).map(r => {
          const estado = r.estado === 'recogido' ? 'completado' : 
                        r.estado === 'en-curso' ? 'en-curso' : 
                        'asignado';
          return `
            <div class="view-reserva-item">
              <div class="view-reserva-header">
                <div class="view-reserva-route">${r.origen} → ${r.destino}</div>
                <div class="view-reserva-status ${estado}">${estado}</div>
              </div>
              <div class="view-reserva-details">
                ${new Date(r.id).toLocaleDateString('es-ES')} • ${r.horario} • $${r.precio}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}
  `;

  document.getElementById('verUsuarioModal').style.display = 'block';
}

function editarUsuario(userId) {
  const users = storage.get("users", []);
  const mockDrivers = [
    { id: 9001, role: 'conductor', nombre: 'Conductor Demo 1', cedula: '000000001', email: 'conductor1@demo.com' },
    { id: 9002, role: 'conductor', nombre: 'Conductor Demo 2', cedula: '000000002', email: 'conductor2@demo.com' },
    { id: 9003, role: 'conductor', nombre: 'Conductor Demo 3', cedula: '000000003', email: 'conductor3@demo.com' },
  ];
  const allUsers = [...users, ...mockDrivers];
  const usuario = allUsers.find(u => u.id === userId);
  
  if (!usuario) {
    toast('Usuario no encontrado');
    return;
  }

  // Pre-llenar el formulario
  document.getElementById('euNombre').value = usuario.nombre || '';
  document.getElementById('euCedula').value = usuario.cedula || '';
  document.getElementById('euEmail').value = usuario.email || '';
  document.getElementById('euTelefono').value = usuario.telefono || '';
  document.getElementById('euRole').value = usuario.role || 'conductor';

  // Guardar el ID para usar en confirmar
  document.getElementById('editarUsuarioForm').dataset.userId = userId;

  document.getElementById('editarUsuarioModal').style.display = 'block';
}

function confirmarEditarUsuario() {
  const form = document.getElementById('editarUsuarioForm');
  const userId = Number(form.dataset.userId);
  
  const datosActualizados = {
    nombre: document.getElementById('euNombre').value,
    cedula: document.getElementById('euCedula').value,
    email: document.getElementById('euEmail').value,
    telefono: document.getElementById('euTelefono').value,
    role: document.getElementById('euRole').value
  };

  const users = storage.get("users", []);
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex !== -1) {
    users[userIndex] = { ...users[userIndex], ...datosActualizados };
    storage.set("users", users);
    cerrarEditarUsuarioModal();
    renderAdmin();
    toast('Usuario actualizado exitosamente');
  } else {
    toast('Error: Usuario no encontrado en la base de datos real');
  }
}

function cerrarVerUsuarioModal() {
  document.getElementById('verUsuarioModal').style.display = 'none';
}

function cerrarEditarUsuarioModal() {
  document.getElementById('editarUsuarioModal').style.display = 'none';
  document.getElementById('editarUsuarioForm').reset();
}

// Funciones para modales de clientes
function verCliente(clienteId) {
  const users = storage.get("users", []);
  const mockClients = storage.get('mockClients', []);
  const allClientes = [
    ...users.filter(u => u.role === 'cliente'),
    ...mockClients.map(m => ({ ...m, role: 'cliente' }))
  ];
  const cliente = allClientes.find(c => c.id === clienteId);
  
  if (!cliente) {
    toast('Cliente no encontrado');
    return;
  }

  const reservas = storage.get("reservas", []);
  const misReservas = reservas.filter(r => r.clienteId === clienteId);
  const completadas = misReservas.filter(r => r.estado === 'recogido');
  const pendientes = misReservas.filter(r => !r.conductorId);
  const gastoTotal = misReservas.reduce((sum, r) => sum + (Number(r.precio) || 0), 0);
  const rated = misReservas.filter(r => typeof r.rating === 'number');
  const avgRating = rated.length ? (rated.reduce((a,b)=>a+b.rating,0)/rated.length).toFixed(1) : null;

  // Determinar nivel del cliente
  let clientLevel = '';
  let levelClass = '';
  if (misReservas.length === 0) {
    clientLevel = '🆕 Nuevo';
    levelClass = 'level-new';
  } else if (misReservas.length >= 10) {
    clientLevel = '⭐ VIP';
    levelClass = 'level-vip';
  } else if (misReservas.length >= 5) {
    clientLevel = '💎 Premium';
    levelClass = 'level-premium';
  } else {
    clientLevel = '👤 Regular';
    levelClass = 'level-regular';
  }

  const content = document.getElementById('verClienteContent');
  content.innerHTML = `
    <div class="view-section">
      <div class="view-section-title">👤 Información Personal</div>
      <div class="view-detail-grid">
        <div class="view-detail-item">
          <div class="view-detail-label">Nombre Completo</div>
          <div class="view-detail-value">${cliente.nombre}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Cédula</div>
          <div class="view-detail-value">${cliente.cedula}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Email</div>
          <div class="view-detail-value ${!cliente.email ? 'empty' : ''}">${cliente.email || 'No registrado'}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Teléfono</div>
          <div class="view-detail-value ${!cliente.telefono ? 'empty' : ''}">${cliente.telefono || 'No registrado'}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Nivel de Cliente</div>
          <div class="view-detail-value">
            <span class="client-level-badge ${levelClass}">${clientLevel}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="view-section">
      <div class="view-section-title">📊 Estadísticas de Uso</div>
      <div class="view-stats-grid">
        <div class="view-stat-card">
          <div class="view-stat-number">${misReservas.length}</div>
          <div class="view-stat-label">Total Reservas</div>
        </div>
        <div class="view-stat-card">
          <div class="view-stat-number">${completadas.length}</div>
          <div class="view-stat-label">Completadas</div>
        </div>
        <div class="view-stat-card">
          <div class="view-stat-number">${pendientes}</div>
          <div class="view-stat-label">Pendientes</div>
        </div>
        <div class="view-stat-card">
          <div class="view-stat-number">$${gastoTotal}</div>
          <div class="view-stat-label">Gasto Total</div>
        </div>
        ${avgRating ? `
        <div class="view-stat-card">
          <div class="view-stat-number">${avgRating}/5</div>
          <div class="view-stat-label">Calificación</div>
        </div>
        ` : ''}
      </div>
    </div>

    ${misReservas.length > 0 ? `
    <div class="view-section">
      <div class="view-section-title">📋 Historial de Reservas</div>
      <div class="view-reservas-list">
        ${misReservas.slice(0, 5).map(r => {
          const estado = r.estado === 'recogido' ? 'completado' : 
                        r.estado === 'en-curso' ? 'en-curso' : 
                        r.conductorId ? 'asignado' : 'pendiente';
          return `
            <div class="view-reserva-item">
              <div class="view-reserva-header">
                <div class="view-reserva-route">${r.origen} → ${r.destino}</div>
                <div class="view-reserva-status ${estado}">${estado}</div>
              </div>
              <div class="view-reserva-details">
                ${new Date(r.id).toLocaleDateString('es-ES')} • ${r.horario} • $${r.precio}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}
  `;

  document.getElementById('verClienteModal').style.display = 'block';
}

function editarCliente(clienteId) {
  const users = storage.get("users", []);
  const mockClients = storage.get('mockClients', []);
  const allClientes = [
    ...users.filter(u => u.role === 'cliente'),
    ...mockClients.map(m => ({ ...m, role: 'cliente' }))
  ];
  const cliente = allClientes.find(c => c.id === clienteId);
  
  if (!cliente) {
    toast('Cliente no encontrado');
    return;
  }

  // Pre-llenar el formulario
  document.getElementById('ecNombre').value = cliente.nombre || '';
  document.getElementById('ecCedula').value = cliente.cedula || '';
  document.getElementById('ecEmail').value = cliente.email || '';
  document.getElementById('ecTelefono').value = cliente.telefono || '';
  document.getElementById('ecDireccion').value = cliente.direccion || '';

  // Guardar el ID para usar en confirmar
  document.getElementById('editarClienteForm').dataset.clienteId = clienteId;

  document.getElementById('editarClienteModal').style.display = 'block';
}

function confirmarEditarCliente() {
  const form = document.getElementById('editarClienteForm');
  const clienteId = Number(form.dataset.clienteId);
  
  const datosActualizados = {
    nombre: document.getElementById('ecNombre').value,
    cedula: document.getElementById('ecCedula').value,
    email: document.getElementById('ecEmail').value,
    telefono: document.getElementById('ecTelefono').value,
    direccion: document.getElementById('ecDireccion').value
  };

  const users = storage.get("users", []);
  const mockClients = storage.get('mockClients', []);
  
  // Intentar actualizar en users
  const userIndex = users.findIndex(u => u.id === clienteId);
  if (userIndex !== -1) {
    users[userIndex] = { ...users[userIndex], ...datosActualizados };
    storage.set("users", users);
  } else {
    // Intentar actualizar en mockClients
    const clientIndex = mockClients.findIndex(c => c.id === clienteId);
    if (clientIndex !== -1) {
      mockClients[clientIndex] = { ...mockClients[clientIndex], ...datosActualizados };
      storage.set("mockClients", mockClients);
    }
  }
  
  cerrarEditarClienteModal();
  renderAdmin();
  toast('Cliente actualizado exitosamente');
}

function cerrarVerClienteModal() {
  document.getElementById('verClienteModal').style.display = 'none';
}

function cerrarEditarClienteModal() {
  document.getElementById('editarClienteModal').style.display = 'none';
  document.getElementById('editarClienteForm').reset();
}

// Funciones para modales de vehículos
function verVehiculo(placa) {
  const flota = storage.get("flota", []);
  const mockFlota = [
    { id: 801, placa: 'XYZ-101', conductor: 'Conductor Demo 1', capacidad: 5, tipo: 'sedan', marca: 'Toyota', modelo: 'Corolla', año: 2020, color: 'Blanco' },
    { id: 802, placa: 'XYZ-102', conductor: 'Conductor Demo 2', capacidad: 7, tipo: 'suv', marca: 'Honda', modelo: 'CR-V', año: 2021, color: 'Negro' },
    { id: 803, placa: 'XYZ-103', conductor: 'Conductor Demo 3', capacidad: 4, tipo: 'sedan', marca: 'Nissan', modelo: 'Sentra', año: 2019, color: 'Gris' },
    { id: 804, placa: 'XYZ-104', conductor: 'Carlos Ruiz', capacidad: 5, tipo: 'sedan', marca: 'Chevrolet', modelo: 'Cruze', año: 2022, color: 'Azul' },
  ];
  const allFlota = [...flota, ...mockFlota];
  const vehiculo = allFlota.find(v => v.placa === placa);
  
  if (!vehiculo) {
    toast('Vehículo no encontrado');
    return;
  }

  const reservas = storage.get("reservas", []);
  const viajesVehiculo = reservas.filter(r => r.vehiculo === placa);
  const viajesCompletados = viajesVehiculo.filter(r => r.estado === 'recogido');
  const viajesActivos = viajesVehiculo.filter(r => r.estado !== 'recogido');
  const ingresosTotales = viajesVehiculo.reduce((sum, r) => sum + (Number(r.precio) || 0), 0);

  // Iconos por tipo
  const tipoIconos = {
    'sedan': '🚗',
    'suv': '🚙',
    'van': '🚐',
    'camioneta': '🛻',
    'bus': '🚌'
  };
  const tipoIcon = tipoIconos[vehiculo.tipo?.toLowerCase()] || '🚗';

  // Estado del vehículo
  const estado = viajesActivos.length > 0 ? 'En Servicio' : 'Disponible';
  const estadoClass = viajesActivos.length > 0 ? 'status-busy' : 'status-available';

  const content = document.getElementById('verVehiculoContent');
  content.innerHTML = `
    <div class="view-section">
      <div class="view-section-title">${tipoIcon} Información del Vehículo</div>
      <div class="view-detail-grid">
        <div class="view-detail-item">
          <div class="view-detail-label">Placa</div>
          <div class="view-detail-value">${vehiculo.placa}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Tipo</div>
          <div class="view-detail-value">${vehiculo.tipo || 'No especificado'}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Marca</div>
          <div class="view-detail-value">${vehiculo.marca || 'No especificado'}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Modelo</div>
          <div class="view-detail-value">${vehiculo.modelo || 'No especificado'}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Año</div>
          <div class="view-detail-value">${vehiculo.año || 'No especificado'}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Color</div>
          <div class="view-detail-value">${vehiculo.color || 'No especificado'}</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Capacidad</div>
          <div class="view-detail-value">${vehiculo.capacidad || 'N/A'} personas</div>
        </div>
        <div class="view-detail-item">
          <div class="view-detail-label">Estado</div>
          <div class="view-detail-value">
            <span class="vehicle-status-badge ${estadoClass}">${estado}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="view-section">
      <div class="view-section-title">👤 Asignación</div>
      <div class="view-detail-grid">
        <div class="view-detail-item">
          <div class="view-detail-label">Conductor Asignado</div>
          <div class="view-detail-value ${!vehiculo.conductor ? 'empty' : ''}">${vehiculo.conductor || 'Sin asignar'}</div>
        </div>
        ${vehiculo.observaciones ? `
        <div class="view-detail-item">
          <div class="view-detail-label">Observaciones</div>
          <div class="view-detail-value">${vehiculo.observaciones}</div>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="view-section">
      <div class="view-section-title">📊 Estadísticas Operacionales</div>
      <div class="view-stats-grid">
        <div class="view-stat-card">
          <div class="view-stat-number">${viajesVehiculo.length}</div>
          <div class="view-stat-label">Total Viajes</div>
        </div>
        <div class="view-stat-card">
          <div class="view-stat-number">${viajesCompletados.length}</div>
          <div class="view-stat-label">Completados</div>
        </div>
        <div class="view-stat-card">
          <div class="view-stat-number">${viajesActivos.length}</div>
          <div class="view-stat-label">Activos</div>
        </div>
        <div class="view-stat-card">
          <div class="view-stat-number">$${ingresosTotales}</div>
          <div class="view-stat-label">Ingresos</div>
        </div>
      </div>
    </div>

    ${viajesVehiculo.length > 0 ? `
    <div class="view-section">
      <div class="view-section-title">📋 Historial de Servicios</div>
      <div class="view-reservas-list">
        ${viajesVehiculo.slice(0, 5).map(r => {
          const estado = r.estado === 'recogido' ? 'completado' : 
                        r.estado === 'en-curso' ? 'en-curso' : 
                        'asignado';
          return `
            <div class="view-reserva-item">
              <div class="view-reserva-header">
                <div class="view-reserva-route">${r.origen} → ${r.destino}</div>
                <div class="view-reserva-status ${estado}">${estado}</div>
              </div>
              <div class="view-reserva-details">
                ${new Date(r.id).toLocaleDateString('es-ES')} • ${r.horario} • $${r.precio}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}
  `;

  document.getElementById('verVehiculoModal').style.display = 'block';
}

function editarVehiculo(placa) {
  const flota = storage.get("flota", []);
  const mockFlota = [
    { id: 801, placa: 'XYZ-101', conductor: 'Conductor Demo 1', capacidad: 5, tipo: 'sedan', marca: 'Toyota', modelo: 'Corolla', año: 2020, color: 'Blanco' },
    { id: 802, placa: 'XYZ-102', conductor: 'Conductor Demo 2', capacidad: 7, tipo: 'suv', marca: 'Honda', modelo: 'CR-V', año: 2021, color: 'Negro' },
    { id: 803, placa: 'XYZ-103', conductor: 'Conductor Demo 3', capacidad: 4, tipo: 'sedan', marca: 'Nissan', modelo: 'Sentra', año: 2019, color: 'Gris' },
    { id: 804, placa: 'XYZ-104', conductor: 'Carlos Ruiz', capacidad: 5, tipo: 'sedan', marca: 'Chevrolet', modelo: 'Cruze', año: 2022, color: 'Azul' },
  ];
  const allFlota = [...flota, ...mockFlota];
  const vehiculo = allFlota.find(v => v.placa === placa);
  
  if (!vehiculo) {
    toast('Vehículo no encontrado');
    return;
  }

  // Pre-llenar el formulario
  document.getElementById('evPlaca').value = vehiculo.placa || '';
  document.getElementById('evTipo').value = vehiculo.tipo || 'sedan';
  document.getElementById('evMarca').value = vehiculo.marca || '';
  document.getElementById('evModelo').value = vehiculo.modelo || '';
  document.getElementById('evAño').value = vehiculo.año || '';
  document.getElementById('evCapacidad').value = vehiculo.capacidad || '';
  document.getElementById('evColor').value = vehiculo.color || '';
  document.getElementById('evObservaciones').value = vehiculo.observaciones || '';

  // Poblar select de conductores
  populateEditConductorSelect();
  document.getElementById('evConductor').value = vehiculo.conductor || '';

  // Guardar la placa para usar en confirmar
  document.getElementById('editarVehiculoForm').dataset.placa = placa;

  document.getElementById('editarVehiculoModal').style.display = 'block';
}

function populateEditConductorSelect() {
  const select = document.getElementById('evConductor');
  if (!select) return;
  
  const users = storage.get("users", []);
  const mockDrivers = [
    { id: 9001, role: 'conductor', nombre: 'Conductor Demo 1' },
    { id: 9002, role: 'conductor', nombre: 'Conductor Demo 2' },
    { id: 9003, role: 'conductor', nombre: 'Conductor Demo 3' },
  ];
  
  const conductores = [...users.filter(u => u.role === 'conductor'), ...mockDrivers];
  
  // Limpiar opciones existentes excepto la primera
  select.innerHTML = '<option value="">Sin asignar</option>';
  
  conductores.forEach(conductor => {
    const option = document.createElement('option');
    option.value = conductor.nombre;
    option.textContent = conductor.nombre;
    select.appendChild(option);
  });
}

function confirmarEditarVehiculo() {
  const form = document.getElementById('editarVehiculoForm');
  const placa = form.dataset.placa;
  
  const datosActualizados = {
    placa: document.getElementById('evPlaca').value,
    tipo: document.getElementById('evTipo').value,
    marca: document.getElementById('evMarca').value,
    modelo: document.getElementById('evModelo').value,
    año: document.getElementById('evAño').value,
    capacidad: document.getElementById('evCapacidad').value,
    color: document.getElementById('evColor').value,
    conductor: document.getElementById('evConductor').value,
    observaciones: document.getElementById('evObservaciones').value
  };

  const flota = storage.get("flota", []);
  const vehiculoIndex = flota.findIndex(v => v.placa === placa);
  
  if (vehiculoIndex !== -1) {
    flota[vehiculoIndex] = { ...flota[vehiculoIndex], ...datosActualizados };
    storage.set("flota", flota);
    cerrarEditarVehiculoModal();
    renderAdmin();
    toast('Vehículo actualizado exitosamente');
  } else {
    toast('Error: Vehículo no encontrado en la base de datos real');
  }
}

function cerrarVerVehiculoModal() {
  document.getElementById('verVehiculoModal').style.display = 'none';
}

function cerrarEditarVehiculoModal() {
  document.getElementById('editarVehiculoModal').style.display = 'none';
  document.getElementById('editarVehiculoForm').reset();
}

function populateConductorSelect() {
  const select = document.getElementById('avConductor');
  if (!select) return;
  
  // Limpiar opciones existentes excepto la primera
  select.innerHTML = '<option value="">Sin asignar</option>';
  
  const users = storage.get('users', []);
  const conductores = users.filter(u => u.role === 'conductor');
  
  conductores.forEach(conductor => {
    const option = document.createElement('option');
    option.value = String(conductor.id);
    option.textContent = conductor.nombre;
    select.appendChild(option);
  });
}

// Admin CRUD functions
function viewUsuario(id) {
  const users = storage.get("users", []);
  const user = users.find(u => u.id === id);
  if (user) {
    alert(`Usuario: ${user.nombre}\nCI: ${user.cedula}\nEmail: ${user.email}\nRol: ${user.role}`);
  }
}

function editUsuario(id) {
  toast('Función de editar usuario en desarrollo');
}

function deleteUsuario(id) {
  if (confirm('¿Eliminar este usuario?')) {
    const users = storage.get("users", []);
    const filtered = users.filter(u => u.id !== id);
    storage.set("users", filtered);
    renderAdmin();
    toast('Usuario eliminado');
  }
}

function viewCliente(id) {
  const users = storage.get("users", []);
  const mockClients = storage.get('mockClients', []);
  const allClients = [...users.filter(u => u.role === 'cliente'), ...mockClients.map(m => ({ ...m, role: 'cliente' }))];
  const cliente = allClients.find(u => u.id === id);
  if (cliente) {
    alert(`Cliente: ${cliente.nombre}\nCI: ${cliente.cedula}\nEmail: ${cliente.email}\nTel: ${cliente.telefono || 'N/A'}`);
  }
}

function editCliente(id) {
  toast('Función de editar cliente en desarrollo');
}

function deleteCliente(id) {
  if (confirm('¿Eliminar este cliente?')) {
    const users = storage.get("users", []);
    const mockClients = storage.get('mockClients', []);
    const filteredUsers = users.filter(u => u.id !== id);
    const filteredMock = mockClients.filter(u => u.id !== id);
    storage.set("users", filteredUsers);
    storage.set("mockClients", filteredMock);
    renderAdmin();
    toast('Cliente eliminado');
  }
}

// Flota CRUD functions
function viewFlota(placa) {
  const flota = storage.get("flota", []);
  const mockFlota = storage.get('mockFlota', []);
  const allFlota = [...flota, ...mockFlota];
  const vehiculo = allFlota.find(v => v.placa === placa);
  if (vehiculo) {
    alert(`Vehículo: ${vehiculo.placa}\nConductor: ${vehiculo.conductor}\nCapacidad: ${vehiculo.capacidad}\nModelo: ${vehiculo.modelo || 'N/A'}\nAño: ${vehiculo.año || 'N/A'}`);
  }
}

function editFlota(placa) {
  toast('Función de editar vehículo en desarrollo');
}

function deleteFlota(placa) {
  if (confirm('¿Eliminar este vehículo?')) {
    const flota = storage.get("flota", []);
    const mockFlota = storage.get('mockFlota', []);
    const filteredFlota = flota.filter(v => v.placa !== placa);
    const filteredMock = mockFlota.filter(v => v.placa !== placa);
    storage.set("flota", filteredFlota);
    storage.set("mockFlota", filteredMock);
    renderAdmin();
    toast('Vehículo eliminado');
  }
}

// Admin: add route
function handleAddRuta(e) {
  e.preventDefault();
  const origen = document.getElementById("rutaOrigen").value.trim();
  const destino = document.getElementById("rutaDestino").value.trim();
  const horario = document.getElementById("rutaHorario").value.trim();
  const precio = Number(document.getElementById("rutaPrecio").value);
  const asientos = Number(document.getElementById("rutaAsientos").value);
  if (!origen || !destino || !horario || !precio || !asientos) { document.getElementById("rutaMsg").textContent = "Complete todos los campos"; return; }
  const rutas = storage.get("rutas", []);
  const nueva = { id: Date.now(), origen, destino, horario, precio, asientos };
  rutas.push(nueva);
  storage.set("rutas", rutas);
  document.getElementById("rutaMsg").textContent = "Ruta añadida";
  (document.getElementById("rutaForm")).reset();
  renderAdmin();
  // actualizar vista cliente si está abierta
  renderCliente();
  toast("Ruta añadida");
}

// Admin: add promo
function handleAddPromo(e) {
  e.preventDefault();
  const tipo = document.getElementById("promoTipo").value;
  const code = document.getElementById("promoCodigo").value.trim();
  const promos = storage.get("promos", []);
  if (!code) { document.getElementById("promoMsg").textContent = "Ingrese un código"; return; }
  if (promos.some(p => p.code.toLowerCase() === code.toLowerCase())) { document.getElementById("promoMsg").textContent = "Código existente"; return; }
  const nuevo = tipo === "cupon" ? { type: "cupon", code, discountPct: 10 } : { type: "voucher", code, balance: 100 };
  promos.push(nuevo);
  storage.set("promos", promos);
  document.getElementById("promoMsg").textContent = "Código agregado";
  (document.getElementById("promoForm")).reset();
  renderAdmin();
  toast("Código agregado");
}

// Admin: assign reserva to conductor
function handleAssignReserva(e) {
  e.preventDefault();
  const resId = Number(document.getElementById("assignReserva").value);
  const conductorId = Number(document.getElementById("assignConductor").value);
  const reservas = storage.get("reservas", []);
  const users = storage.get("users", []);
  const flota = storage.get("flota", []);
  const conductorNombre = users.find(u => u.id === conductorId)?.nombre;
  const vehiculo = flota.find(f => f.conductor === conductorNombre)?.placa ?? flota[0]?.placa ?? "";
  const nuevas = reservas.map(r => r.id === resId ? { ...r, conductorId, vehiculo } : r);
  storage.set("reservas", nuevas);
  const msg = document.getElementById("assignMsg");
  msg.textContent = "Reserva asignada";
  renderAdmin();
  toast("Viaje asignado");
}

// Ratings
function handleAddRating(e) {
  e.preventDefault();
  const resId = Number(document.getElementById('ratingReserva').value);
  const val = Number(document.getElementById('ratingValor').value);
  const comment = document.getElementById('ratingComentario').value.trim();
  if (!resId || !(val >= 1 && val <= 5)) { document.getElementById('ratingMsg').textContent = 'Seleccione reserva y puntaje 1-5'; return; }
  const reservas = storage.get('reservas', []);
  const nuevas = reservas.map(r => r.id === resId ? { ...r, rating: val, ratingComment: comment } : r);
  storage.set('reservas', nuevas);
  document.getElementById('ratingMsg').textContent = 'Gracias por tu calificación';
  toast('Calificación enviada');
  renderHistorial();
  if (views.admin.classList.contains('active')) renderAdmin();
}

// Servicio selection logic
function getServicioTipo() {
  return document.getElementById("servicioTipo")?.value ?? "compartido";
}

function onServicioChange() {
  const tipo = getServicioTipo();
  const compartido = document.getElementById("compartidoPanel");
  const customPanel = document.getElementById("customServicePanel");
  const servicioPrivadoFields = document.getElementById("servicioPrivadoFields");
  const servicioEncomiendaFields = document.getElementById("servicioEncomiendaFields");
  const descripcionDiv = document.getElementById("servicioDescripcion");
  const destinoWrapper = document.getElementById('csDestinoWrapper');
  const destinoInput = document.getElementById('csDestino');
  const rutaWrapper = document.getElementById('csRutaWrapper');
  const rutaSelect = document.getElementById('csRutaSelect');
  
  // Actualizar descripción del servicio
  updateServicioDescripcion(tipo);
  
  if (!compartido || !customPanel) return;
  if (tipo === "compartido") {
    compartido.hidden = false;
    customPanel.hidden = true;
  } else {
    compartido.hidden = true;
    customPanel.hidden = false;
  }

  // Alternar destino según tipo
  if (tipo === 'privado') {
    if (destinoWrapper) destinoWrapper.style.display = 'none';
    if (destinoInput) destinoInput.required = false;
    if (rutaWrapper) rutaWrapper.style.display = '';
    if (rutaSelect) rutaSelect.required = true;
    // llenar rutas preestablecidas desde storage.rutas
    const rutas = storage.get('rutas', []);
    if (rutaSelect) {
      rutaSelect.innerHTML = '';
      rutas.forEach(r => {
        const opt = document.createElement('option');
        opt.value = String(r.id);
        opt.textContent = `${r.origen} → ${r.destino} • ${r.horario}`;
        rutaSelect.appendChild(opt);
      });
    }
    if (servicioPrivadoFields) servicioPrivadoFields.style.display = '';
    if (servicioEncomiendaFields) servicioEncomiendaFields.style.display = 'none';
  } else if (tipo === 'encomienda') {
    if (destinoWrapper) destinoWrapper.style.display = '';
    if (destinoInput) destinoInput.required = true;
    if (rutaWrapper) rutaWrapper.style.display = 'none';
    if (rutaSelect) rutaSelect.required = false;
    if (servicioPrivadoFields) servicioPrivadoFields.style.display = 'none';
    if (servicioEncomiendaFields) servicioEncomiendaFields.style.display = '';
  } else {
    if (destinoWrapper) destinoWrapper.style.display = '';
    if (destinoInput) destinoInput.required = true;
    if (rutaWrapper) rutaWrapper.style.display = 'none';
    if (rutaSelect) rutaSelect.required = false;
    if (servicioPrivadoFields) servicioPrivadoFields.style.display = 'none';
    if (servicioEncomiendaFields) servicioEncomiendaFields.style.display = 'none';
  }
}

function updateServicioDescripcion(tipo) {
  const descripcionDiv = document.getElementById("servicioDescripcion");
  if (!descripcionDiv) return;
  
  // Remover clases anteriores
  descripcionDiv.className = "servicio-descripcion";
  
  let descripcion = "";
  
  switch(tipo) {
    case "compartido":
      descripcion = "🚐 <strong>Servicio Compartido:</strong> Viaja con otros pasajeros en rutas fijas establecidas. Reserva tu asiento y disfruta de tarifas económicas en horarios programados.";
      descripcionDiv.classList.add("compartido");
      break;
    case "privado":
      descripcion = "🚗 <strong>Servicio Privado:</strong> Vehículo exclusivo para ti y tu grupo. Define tu origen, destino y horario. Ideal para mayor comodidad y privacidad.";
      descripcionDiv.classList.add("privado");
      break;
    case "encomienda":
      descripcion = "📦 <strong>Encomienda Express:</strong> Envío rápido y seguro de paquetes y documentos. Servicio puerta a puerta con seguimiento en tiempo real.";
      descripcionDiv.classList.add("encomienda");
      break;
    default:
      descripcion = "Selecciona un tipo de servicio para ver su descripción";
  }
  
  descripcionDiv.innerHTML = `<p>${descripcion}</p>`;
}

function handleCustomServiceSubmit(e) {
  e.preventDefault();
  const tipo = getServicioTipo();
  const origen = document.getElementById("csOrigen").value.trim();
  let destino = '';
  let horario = '';

  if (!origen) { toast("Por favor selecciona el origen"); return; }

  if (tipo === 'privado') {
    const rutaSelect = document.getElementById('csRutaSelect');
    const rutas = storage.get('rutas', []);
    const sel = rutas.find(r => String(r.id) === String(rutaSelect.value));
    if (!sel) { toast('Seleccione un destino preestablecido'); return; }
    destino = sel.destino;
    horario = sel.horario;
  } else {
    destino = document.getElementById("csDestino").value.trim();
    if (!destino) { toast('Ingrese destino'); return; }
    horario = 'A coordinar';
  }
  
  let servicioDetalles = { tipo, origen, destino, horario };
  if (tipo === "privado") {
    const personas = document.getElementById("csPersonas").value;
    const tipoVehiculo = document.getElementById("csTipoVehiculo").value;
    const comentarios = document.getElementById("csComentarios").value.trim();
    if (!personas) { toast("Por favor indica el número de pasajeros"); return; }
    servicioDetalles = { ...servicioDetalles, personas: Number(personas), tipoVehiculo, comentarios };
  } else if (tipo === "encomienda") {
    const tamanoPaquete = document.getElementById("csTamanoPaquete").value;
    const tipoContenido = document.getElementById("csTipoContenido").value;
    const descripcionPaquete = document.getElementById("csDescripcionPaquete").value.trim();
    servicioDetalles = { ...servicioDetalles, tamanoPaquete, tipoContenido, descripcionPaquete };
  }

  selectedCustomService = {
    id: Date.now(),
    origen: servicioDetalles.origen,
    destino: servicioDetalles.destino,
    horario: servicioDetalles.horario,
    precio: tipo === 'privado' ? 25 : 15,
    details: servicioDetalles,
  };

  // Mostrar modal de confirmación en vez de panel lateral
  const modal = document.getElementById('clientConfirmModal');
  const det = document.getElementById('clientConfirmDetails');
  if (det) {
    det.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class=\"row\"><strong>${selectedCustomService.origen} → ${selectedCustomService.destino}</strong><span class=\"badge\">${selectedCustomService.horario}</span></div>
      <div><strong>Servicio:</strong> ${tipo}</div>
      ${tipo==='privado' ? `<div><strong>Pasajeros:</strong> ${servicioDetalles.personas} • <strong>Vehículo:</strong> ${servicioDetalles.tipoVehiculo}</div>` : ''}
      ${tipo==='encomienda' ? `<div><strong>Tamaño:</strong> ${servicioDetalles.tamanoPaquete} • <strong>Contenido:</strong> ${servicioDetalles.tipoContenido}</div>` : ''}
      <div><strong>Precio estimado:</strong> $${selectedCustomService.precio}</div>
    `;
    det.appendChild(item);
  }
  if (modal) { modal.hidden = false; modal.style.display = 'grid'; }
}

// Confirmación desde el modal (crea la reserva)
// Eliminado: ahora la creación sucede en la pantalla de pago

// Tracking (mock)
let gpsTimer = null;
function startGpsMock() {
  const session = getSession();
  if (!session || session.role !== "conductor") return;
  const status = document.getElementById("gpsStatus");
  status.textContent = "On";
  status.style.color = "#22c55e";
  if (gpsTimer) return;
  gpsTimer = setInterval(() => {
    const reservas = storage.get("reservas", []).filter(r => r.conductorId === session.id && !r.recogido);
    const tracking = storage.get("tracking", []);
    reservas.forEach((r, idx) => {
      const existing = tracking.find(t => t.reservaId === r.id);
      const baseLat = existing?.lat ?? (-0.19 + idx * 0.01);
      const baseLng = existing?.lng ?? (-78.49 + idx * 0.01);
      const next = { reservaId: r.id, lat: baseLat + (Math.random()-0.5)*0.002, lng: baseLng + (Math.random()-0.5)*0.002, active: true };
      if (existing) {
        const i = tracking.findIndex(t => t.reservaId === r.id);
        tracking[i] = next;
      } else {
        tracking.push(next);
      }
    });
    storage.set("tracking", tracking);
  }, 2000);
}

function stopGpsMock() {
  const status = document.getElementById("gpsStatus");
  status.textContent = "Off";
  status.style.color = "";
  if (gpsTimer) { clearInterval(gpsTimer); gpsTimer = null; }
  toast("GPS detenido");
}

function renderTrackingForCliente() {
  const session = getSession();
  const panel = document.getElementById("trackingPanel");
  if (!panel) return;
  const myActive = storage.get("reservas", []).filter(r => r.clienteId === session?.id && r.estado !== "recogido");
  const info = document.getElementById("trackingInfo");
  if (myActive.length === 0) { panel.hidden = true; return; }
  const tracking = storage.get("tracking", []);
  info.innerHTML = "";
  myActive.forEach(r => {
    const t = tracking.find(t => t.reservaId === r.id);
    const div = document.createElement("div");
    div.className = "list-item";
    if (t) {
      div.textContent = `${r.origen} → ${r.destino} • Posición: ${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}`;
    } else {
      div.textContent = `${r.origen} → ${r.destino} • A la espera de GPS del conductor`;
    }
    info.appendChild(div);
  });
  panel.hidden = false;
}

// poll for client tracking updates
setInterval(() => {
  const currentViewVisible = views.cliente?.classList.contains("active");
  if (currentViewVisible) renderTrackingForCliente();
}, 3000);

// Init
seedIfEmpty();
wireEvents();

// Cerrar todos los modales al inicializar la aplicación
document.querySelectorAll('.modal').forEach(modal => {
  modal.style.display = 'none';
});

updateSessionUi();
showView("auth");

// UI helpers
function highlightActiveNav(name) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.nav-btn[data-route="${name}"]`);
  if (btn) btn.classList.add('active');
}

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function applySavedTheme() {
  const saved = localStorage.getItem('theme');
  const root = document.documentElement;
  if (saved === 'light') {
    root.classList.remove('dark');
  } else {
    // default to dark
    root.classList.add('dark');
  }
}

function renderAdminReservas(filter = 'pendiente') {
  const cont = document.getElementById('adminReservas');
  if (!cont) return;
  const reservas = storage.get('reservas', []).sort((a,b)=>b.id-a.id);
  const users = storage.get('users', []);
  const rutas = storage.get('rutas', []);
  let visibles = [];
  if (filter === 'pendiente') visibles = reservas.filter(r => r.estado === 'pendiente' && !r.conductorId);
  else if (filter === 'asignadas') visibles = reservas.filter(r => r.conductorId && (r.estado === 'pendiente' || r.estado === 'en-curso'));
  else if (filter === 'recogido') visibles = reservas.filter(r => r.estado === 'recogido');
  cont.innerHTML = '';
  if (visibles.length === 0) {
    cont.innerHTML = `<div class='text-muted'>No hay reservas ${filter}</div>`;
    return;
  }
  visibles.forEach(r => {
    const cliente = users.find(u => u.id === r.clienteId)?.nombre || 'Cliente';
    const resumen = `${r.origen} → ${r.destino} • ${r.horario} • $${r.precio}`;
    let actions = '';
    if (filter === 'pendiente') {
      actions = `<button class=\"btn primary\" data-act=\"open-assign\" data-id=\"${r.id}\">Asignar</button>`;
    } else if (filter === 'asignadas') {
      const estadoLabel = r.estado === 'en-curso' ? 'En curso' : 'Asignado';
      actions = `<span class=\"badge ${r.estado==='en-curso'?'warn':'info'}\">${estadoLabel}</span>
                 <button class=\"btn secondary\" data-act=\"finish\" data-id=\"${r.id}\">Marcar completada</button>`;
    } else if (filter === 'recogido') {
      actions = `<span class=\"badge success\">Completada</span>`;
    }
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div class=\"row\">
        <strong>#${r.id}</strong>
        <span class=\"badge\">${cliente}</span>
      </div>
      <div>${resumen}</div>
      <div>Dirección: ${r.direccion}</div>
      <div class=\"row\" style=\"gap:6px; flex-wrap:wrap; margin-top:6px\">${actions}</div>
    `;
    cont.appendChild(div);
  });
  cont.querySelectorAll('[data-act]')?.forEach(btn => {
    const act = btn.getAttribute('data-act');
    const id = Number(btn.getAttribute('data-id'));
    btn.addEventListener('click', () => handleAdminReservaAction(act, id, filter));
  });
}

let assignTargetId = null;
function openAssignModal(reservaId) {
  assignTargetId = reservaId;
  const modal = document.getElementById('assignModal');
  if (!modal) return;
  const users = storage.get('users', []);
  const flota = storage.get('flota', []);
  // incluir elementos mock como en Admin
  const mockDrivers = [
    { id: 9001, role: 'conductor', nombre: 'Conductor Demo 1', cedula: '000000001', email: 'conductor1@demo.com' },
    { id: 9002, role: 'conductor', nombre: 'Conductor Demo 2', cedula: '000000002', email: 'conductor2@demo.com' },
    { id: 9003, role: 'conductor', nombre: 'Conductor Demo 3', cedula: '000000003', email: 'conductor3@demo.com' },
  ];
  const mockFlota = [
    { id: 801, placa: 'XYZ-101', conductor: 'Conductor Demo 1', capacidad: 5 },
    { id: 802, placa: 'XYZ-102', conductor: 'Conductor Demo 2', capacidad: 7 },
    { id: 803, placa: 'XYZ-103', conductor: 'Conductor Demo 3', capacidad: 4 },
    { id: 804, placa: 'XYZ-104', conductor: 'Carlos Ruiz', capacidad: 5 },
  ];
  const reservas = storage.get('reservas', []);
  const r = reservas.find(x => x.id === reservaId);
  const conductores = [...users.filter(u => u.role === 'conductor'), ...mockDrivers];
  const displayFlota = [...flota, ...mockFlota];
  const selCon = document.getElementById('assignConductorSelect');
  const selVeh = document.getElementById('assignVehiculoSelect');
  selCon.innerHTML = '';
  selVeh.innerHTML = '';
  conductores.forEach(c => {
    const opt = document.createElement('option');
    opt.value = String(c.id); opt.textContent = c.nombre; selCon.appendChild(opt);
  });
  displayFlota.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.placa; opt.textContent = `${v.placa} • ${v.conductor||'-'}`; selVeh.appendChild(opt);
  });
  const info = document.getElementById('assignInfo');
  const details = document.getElementById('assignDetails');
  if (info && r) info.textContent = `${r.origen} → ${r.destino} • ${r.horario}`;
  if (details && r) {
    const cliente = users.find(u => u.id === r.clienteId)?.nombre || 'Cliente';
    details.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div><strong>Cliente:</strong> ${cliente}</div>
      <div><strong>Tipo:</strong> ${r.tipo} • <strong>Servicio:</strong> ${r.servicio}</div>
      <div><strong>Dirección:</strong> ${r.direccion}</div>
      <div><strong>Método de pago:</strong> ${r.metodoPago}${r.promo?` • <strong>Cupón:</strong> ${r.promo}`:''}</div>
      <div><strong>Precio:</strong> $${r.precio}</div>
    `;
    details.appendChild(item);
  }
  modal.hidden = false;
  modal.style.display = 'grid';
}
function closeAssignModal() {
  const modal = document.getElementById('assignModal');
  if (!modal) return; modal.hidden = true; modal.style.display = 'none'; assignTargetId = null;
}
function saveAssignModal() {
  if (!assignTargetId) return;
  const selCon = document.getElementById('assignConductorSelect');
  const selVeh = document.getElementById('assignVehiculoSelect');
  const reservas = storage.get('reservas', []);
  const idx = reservas.findIndex(r => r.id === assignTargetId);
  if (idx < 0) return;
  reservas[idx] = { ...reservas[idx], conductorId: Number(selCon.value), vehiculo: selVeh.value, estado: 'pendiente' };
  storage.set('reservas', reservas);
  closeAssignModal();
  const activeBtn = document.querySelector('.res-filter-btn.active');
  const current = activeBtn ? activeBtn.getAttribute('data-filter') : 'pendiente';
  renderAdminReservas(current);
  renderAdmin();
}

function handleAdminReservaAction(action, id, currentFilter) {
  if (action === 'open-assign') { openAssignModal(id); return; }
  const reservas = storage.get('reservas', []);
  const idx = reservas.findIndex(r => r.id === id);
  if (idx < 0) return;
  if (action === 'start') reservas[idx] = { ...reservas[idx], estado: 'en-curso', enCurso: true };
  if (action === 'finish') {
    reservas[idx] = { ...reservas[idx], estado: 'recogido', enCurso: false, recogido: true };
    // limpiar tracking
    const tracking = storage.get('tracking', []);
    storage.set('tracking', tracking.filter(t => t.reservaId !== id));
  }
  if (action === 'cancel') {
    reservas[idx] = { ...reservas[idx], estado: 'cancelada', enCurso: false };
    // limpiar tracking
    const tracking = storage.get('tracking', []);
    storage.set('tracking', tracking.filter(t => t.reservaId !== id));
  }
  storage.set('reservas', reservas);
  renderAdminReservas(currentFilter);
  renderAdmin();
}

function populateOrigenOptions() {
  const sel = document.getElementById('csOrigenSelect');
  if (!sel) return;
  const session = getSession();
  const users = storage.get('users', []);
  const user = users.find(u => u.id === session?.id) || {};
  const favoritas = Array.isArray(user.favoritasDirecciones) ? user.favoritasDirecciones : [];
  sel.innerHTML = '';
  // Dirección principal
  const optSaved = document.createElement('option');
  optSaved.value = 'saved';
  optSaved.textContent = user?.direccion ? `Mi dirección: ${user.direccion}` : 'Mi dirección registrada';
  sel.appendChild(optSaved);
  // Favoritas
  favoritas.forEach((addr, i) => {
    const opt = document.createElement('option');
    opt.value = `fav:${addr}`;
    opt.textContent = `Favorita: ${addr}`;
    sel.appendChild(opt);
  });
  // Nueva
  const optNew = document.createElement('option');
  optNew.value = 'new';
  optNew.textContent = 'Elegir otra dirección...';
  sel.appendChild(optNew);
}

function wireOrigenPicker() {
  const sel = document.getElementById('csOrigenSelect');
  const mapBtn = document.getElementById('csOrigenMapBtn');
  const origenInput = document.getElementById('csOrigen');
  const session = getSession();
  const users = storage.get('users', []);
  const user = users.find(u => u.id === session?.id) || {};
  const applyState = () => {
    if (!sel) return;
    const val = sel.value || 'saved';
    const isNew = val === 'new';
    const isSaved = val === 'saved';
    const isFav = val.startsWith('fav:');
    if (isNew) {
      origenInput.style.display = '';
      origenInput.value = '';
      if (mapBtn) mapBtn.disabled = false;
      origenInput.required = true;
    } else if (isSaved) {
      origenInput.style.display = 'none';
      origenInput.value = user?.direccion || '';
      if (mapBtn) mapBtn.disabled = true;
      origenInput.required = false;
    } else if (isFav) {
      const addr = val.slice(4);
      origenInput.style.display = 'none';
      origenInput.value = addr;
      if (mapBtn) mapBtn.disabled = true;
      origenInput.required = false;
    }
  };
  if (sel) sel.addEventListener('change', applyState);
  if (mapBtn) mapBtn.addEventListener('click', () => {
    if (!sel || sel.value !== 'new') return;
    window.__pickerTarget = 'origin';
    openPicker();
  });
  // init default
  if (sel) sel.value = 'saved';
  applyState();
}

// --- ADMIN GPS ---
let adminGpsMap = null;
let adminGpsMarkers = [];
function renderAdminGps(filterText = '') {
  const cont = document.getElementById('adminGpsMap');
  const list = document.getElementById('adminGpsList');
  const countEl = document.getElementById('gpsCount');
  if (!cont || !list) return;
  if (!adminGpsMap) {
    adminGpsMap = L.map('adminGpsMap').setView([-0.1807, -78.4678], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(adminGpsMap);
  }
  // limpiar marcadores previos
  adminGpsMarkers.forEach(m => adminGpsMap.removeLayer(m));
  adminGpsMarkers = [];
  list.innerHTML = '';

  const users = storage.get('users', []);
  const tracking = storage.get('tracking', []); // [{conductorId, lat, lng, updatedAt, reservaId}]
  const reservas = storage.get('reservas', []);
  const activos = tracking.filter(t => reservas.some(r => r.id === t.reservaId && (r.estado === 'en-curso')));
  const visibles = filterText ? activos.filter(t => {
    const name = users.find(u => u.id === t.conductorId)?.nombre || '';
    return name.toLowerCase().includes(filterText.toLowerCase());
  }) : activos;

  visibles.forEach(t => {
    const name = users.find(u => u.id === t.conductorId)?.nombre || `ID ${t.conductorId}`;
    const res = reservas.find(r => r.id === t.reservaId);
    if (t.lat && t.lng) {
      const marker = L.marker([t.lat, t.lng]).addTo(adminGpsMap).bindPopup(`${name}<br/>${res?.origen || ''} → ${res?.destino || ''}`);
      adminGpsMarkers.push(marker);
    }
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class=\"row\"><strong>${name}</strong><span class=\"badge\">${new Date(t.updatedAt||Date.now()).toLocaleTimeString()}</span></div>
      <div>Reserva: #${t.reservaId} • ${res?.origen||''} → ${res?.destino||''}</div>
      <div>Posición: ${t.lat?.toFixed(5)||'-'}, ${t.lng?.toFixed(5)||'-'}</div>
    `;
    list.appendChild(item);
  });
  if (countEl) countEl.textContent = `${visibles.length} activos`;
  if (visibles.length) {
    const group = L.featureGroup(adminGpsMarkers);
    try { adminGpsMap.fitBounds(group.getBounds().pad(0.2)); } catch {}
  }
}

// Wire filtro GPS
(function wireAdminGps(){
  const input = document.getElementById('gpsFilter');
  input?.addEventListener('input', () => renderAdminGps(input.value.trim()));
})();

// Refrescar GPS al cambiar a la pestaña GPS
(function observeAdminTabs(){
  document.querySelectorAll('#view-admin .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab === 'gps') setTimeout(() => renderAdminGps(document.getElementById('gpsFilter')?.value?.trim()||''), 60);
    });
  });
})();

// Timer para refrescar posiciones activas (cada 5s)
setInterval(() => {
  if (views.admin?.classList.contains('active')) {
    const activeTab = document.querySelector('#view-admin .tab-btn.active')?.getAttribute('data-tab');
    if (activeTab === 'gps') renderAdminGps(document.getElementById('gpsFilter')?.value?.trim()||'');
  }
}, 5000);

// navega a pago con un draft de reserva
function goToPayment(draft) {
  window.__payDraft = draft;
  const summary = document.getElementById('paySummary');
  if (summary) {
    summary.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class=\"row\"><strong>${draft.origen} → ${draft.destino}</strong><span class=\"badge\">${draft.horario}</span></div>
      <div><strong>Servicio:</strong> ${draft.servicio}</div>
      ${draft.servicioDetalles?.personas ? `<div><strong>Personas:</strong> ${draft.servicioDetalles.personas}</div>` : ''}
      ${draft.servicioDetalles?.equipaje ? `<div><strong>Equipaje:</strong> ${draft.servicioDetalles.equipaje}</div>` : ''}
      ${draft.servicio==='privado' && draft.servicioDetalles?.tipoVehiculo ? `<div><strong>Vehículo:</strong> ${draft.servicioDetalles.tipoVehiculo}</div>` : ''}
      <div><strong>Precio:</strong> $<span id=\"payPrice\">${draft.precio}</span></div>
    `;
    summary.appendChild(item);
  }
  const method = document.getElementById('payMethod');
  const cardFields = document.getElementById('payCardFields');
  const transferFields = document.getElementById('payTransferFields');
  const instructions = document.getElementById('payInstructionsText');
  const totalEl = document.getElementById('payTotal');
  const toggle = () => {
    const m = method.value;
    cardFields.style.display = m === 'tarjeta' ? '' : 'none';
    transferFields.style.display = m === 'transferencia' ? '' : 'none';
    const base = Number(draft.precio)||0;
    let text = '';
    if (m === 'efectivo') text = `Paga $${base} en efectivo al conductor cuando te recoja. Conserva el efectivo exacto si es posible.`;
    else if (m === 'tarjeta') text = `Introduce los datos de tu tarjeta para procesar el pago de $${base}.`;
    else if (m === 'transferencia') text = `Realiza una transferencia por $${base}. Indica el número de referencia y banco.`;
    else if (m === 'voucher') text = `Introduce tu código de voucher válido para cubrir total o parcial del pago.`;
    instructions.textContent = text;
  };
  if (method) { method.onchange = toggle; toggle(); }
  if (totalEl) totalEl.textContent = `$${draft.precio}`;
  showView('payment');
}

(function wirePayment(){
  const form = document.getElementById('payForm');
  const cancel = document.getElementById('payCancel');
  cancel?.addEventListener('click', () => { showView('cliente'); });
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const session = getSession();
    if (!session || session.role !== 'cliente') { toast('Inicia sesión como cliente'); return; }
    const draft = window.__payDraft;
    if (!draft) { toast('Sin datos de pago'); return; }
    const metodoPago = document.getElementById('payMethod').value;
    // Validaciones según método
    if (metodoPago === 'tarjeta') {
      const num = document.getElementById('payCardNumber').value.replace(/\s+/g,'');
      const exp = document.getElementById('payCardExp').value.trim();
      const name = document.getElementById('payCardName').value.trim();
      const cvv = document.getElementById('payCardCvv').value.trim();
      if (!(num.length >= 13 && num.length <= 19) || !/^[0-9]+$/.test(num)) { toast('Número de tarjeta inválido'); return; }
      if (!/^[0-9]{2}\/[0-9]{2}$/.test(exp)) { toast('Expiración inválida (MM/AA)'); return; }
      if (!name) { toast('Nombre en tarjeta requerido'); return; }
      if (!(cvv.length >= 3 && cvv.length <= 4)) { toast('CVV inválido'); return; }
    } else if (metodoPago === 'transferencia') {
      const bank = document.getElementById('payBank').value.trim();
      const ref = document.getElementById('payRef').value.trim();
      if (!bank || !ref) { toast('Banco y referencia requeridos'); return; }
    }
    const codigoPromo = document.getElementById('payCodigoPromo').value.trim();
    const promos = storage.get('promos', []);
    const promoApplied = codigoPromo ? promos.find(p => p.code.toLowerCase() === codigoPromo.toLowerCase()) : null;
    const precioBase = Number(draft.precio) || 0;
    const precioFinal = promoApplied && promoApplied.discountPct ? Math.max(0, Math.round(precioBase * (100 - promoApplied.discountPct)) / 100) : precioBase;

    const reservas = storage.get('reservas', []);
    const nueva = {
      id: Date.now(), rutaId: draft.rutaId, clienteId: session.id,
      tipo: draft.tipo, direccion: draft.direccion, horario: draft.horario, origen: draft.origen, destino: draft.destino, precio: precioFinal,
      estado: 'pendiente', recogido: false,
      servicio: draft.servicio, metodoPago, promo: promoApplied?.code ?? null,
      conductorId: null, vehiculo: null,
      servicioDetalles: draft.servicioDetalles || null,
    };
    reservas.push(nueva);
    storage.set('reservas', reservas);
    window.__payDraft = null;
    toast('Pago exitoso. Reserva creada');
    renderHistorial();
    showView('cliente');
    if (views.admin.classList.contains('active')) renderAdmin();
  });
})();

// reemplazar submit de confirmación (privado) por navegación a pago
(function overrideClientConfirmToPayment(){
  const form = document.getElementById('clientConfirmForm');
  if (!form) return;
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!selectedCustomService) { toast('Configura el servicio primero'); return; }
    const draft = {
      origen: selectedCustomService.origen,
      destino: selectedCustomService.destino,
      horario: selectedCustomService.horario,
      precio: selectedCustomService.precio,
      servicio: getServicioTipo(),
      servicioDetalles: selectedCustomService.details,
      tipo: getServicioTipo() === 'privado' ? 'privado' : 'otro',
      direccion: document.getElementById('csOrigen').value.trim(),
      rutaId: selectedCustomService.id,
    };
    const modal = document.getElementById('clientConfirmModal');
    if (modal) { modal.hidden = true; modal.style.display = 'none'; }
    goToPayment(draft);
  };
})();

// reemplazar submit de compartido por navegación a pago
(function overrideClientSharedToPayment(){
  const form = document.getElementById('clientSharedForm');
  if (!form) return;
  form.onsubmit = (e) => {
    e.preventDefault();
    const rutas = storage.get('rutas', []);
    const ruta = rutas.find(r => r.id === selectedRutaId);
    if (!ruta) { toast('Ruta no disponible'); return; }
    const draft = {
      origen: ruta.origen,
      destino: ruta.destino,
      horario: ruta.horario,
      precio: ruta.precio,
      servicio: 'compartido',
      servicioDetalles: { personas: Number(document.getElementById('sharedPersonas').value), equipaje: document.getElementById('sharedEquipaje').value.trim() },
      tipo: 'asiento',
      direccion: document.getElementById('sharedDireccion').value.trim(),
      rutaId: ruta.id,
    };
    const modal = document.getElementById('clientSharedModal');
    if (modal) { modal.hidden = true; modal.style.display = 'none'; }
    goToPayment(draft);
  };
})();


