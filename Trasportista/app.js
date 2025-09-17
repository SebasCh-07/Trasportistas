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
  try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { window.scrollTo(0,0); }
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
}

function openReserva(rutaId) {
  selectedRutaId = rutaId;
  selectedCustomService = null;
  const rutas = storage.get("rutas", []);
  const ruta = rutas.find(r => r.id === rutaId);
  const panel = document.getElementById("reservaPanel");
  const info = document.getElementById("reservaInfo");
  info.textContent = `${ruta.origen} → ${ruta.destino} • ${ruta.horario} • $${ruta.precio}`;
  panel.hidden = false;
}

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
    conductorId: 2, vehiculo: "ABC-123",
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
  if (!session) { cont.innerHTML = "Inicie sesión"; return; }
  const reservas = storage.get("reservas", []).filter(r => r.clienteId === session.id);
  if (reservas.length === 0) { cont.innerHTML = "Sin reservas"; return; }
  reservas.forEach(res => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `${res.origen} → ${res.destino} • ${res.horario} • ${res.tipo} • ${res.direccion} • Pago: ${res.metodoPago}${res.promo?` • ${res.promo}`:""}`;
    cont.appendChild(div);
  });
  // populate rating select with delivered trips without rating
  const ratingSelect = document.getElementById('ratingReserva');
  if (ratingSelect) {
    ratingSelect.innerHTML = '';
    reservas.filter(r => r.estado === 'recogido' && typeof r.rating !== 'number').forEach(r => {
      const opt = document.createElement('option');
      opt.value = String(r.id);
      opt.textContent = `${r.origen}→${r.destino} ${r.horario}`;
      ratingSelect.appendChild(opt);
    });
  }
}

// Conductor
function renderConductor() {
  const session = getSession();
  const cont = document.getElementById("viajesAsignados");
  cont.innerHTML = "";
  if (!session || session.role !== "conductor") {
    cont.textContent = "Inicie sesión como conductor";
    return;
  }

  const reservas = storage.get("reservas", []);
  const asignadas = reservas.filter(r => r.conductorId === session.id);

  if (asignadas.length === 0) { cont.textContent = "No hay reservas"; return; }
  asignadas.forEach(res => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="row"><strong>${res.origen} → ${res.destino}</strong><span class="badge">${res.horario}</span></div>
      <div>Cliente: ${getUserName(res.clienteId)} • Tipo: ${res.tipo}</div>
      <div>Dirección: ${res.direccion}</div>
      <div class="row"><span>Estado: ${res.recogido ? "Recogido" : "Pendiente"}</span>
      <button class="pickupBtn" data-id="${res.id}" ${res.recogido?"disabled":""}>Confirmar recogida</button></div>
    `;
    cont.appendChild(div);
  });
  cont.querySelectorAll(".pickupBtn").forEach(btn => btn.addEventListener("click", () => confirmarRecogida(Number(btn.dataset.id))));
}

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
  renderConductor();
  // refresh rating choices for client if open
  if (views.cliente.classList.contains('active')) renderHistorial();
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
  document.getElementById("kpiReservas").textContent = reservas.length;
  document.getElementById("kpiRutas").textContent = rutas.length;
  document.getElementById("kpiFlota").textContent = flota.length;
  const revenue = reservas.reduce((sum, r) => sum + (Number(r.precio)||0), 0);
  const kpiRevenue = document.getElementById('kpiRevenue');
  if (kpiRevenue) kpiRevenue.textContent = `$${revenue}`;

  const rutasCont = document.getElementById("adminRutas");
  rutasCont.innerHTML = "";
  rutas.forEach(r => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.textContent = `${r.origen} → ${r.destino} • ${r.horario} • $${r.precio} • Asientos: ${r.asientos}`;
    rutasCont.appendChild(div);
  });

  const flotaCont = document.getElementById("adminFlota");
  flotaCont.innerHTML = "";
  const displayFlota = [...flota, ...mockFlota];
  displayFlota.forEach(v => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.textContent = `${v.placa} • Conductor: ${v.conductor} • Capacidad: ${v.capacidad}`;
    flotaCont.appendChild(div);
  });

  // usuarios (conductor y admin)
  const usuariosCont = document.getElementById('adminUsuarios');
  if (usuariosCont) {
    usuariosCont.innerHTML = '';
    const realStaff = users.filter(u => u.role !== 'cliente');
    const displayStaff = [...realStaff, ...mockDrivers];
    displayStaff.forEach(u => {
      const vehiculo = displayFlota.find(f => f.conductor === u.nombre)?.placa ?? '-';
      const resAsignadas = reservas.filter(r => r.conductorId === u.id).length;
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `<div class="row"><strong>${u.nombre}</strong><span class="badge">${u.role}</span></div>
        <div>CI: ${u.cedula} • Email: ${u.email ?? '-'} • Vehículo: ${vehiculo}</div>
        <div>Reservas asignadas: ${resAsignadas}</div>`;
      usuariosCont.appendChild(div);
    });
  }

  // clientes
  // recientes
  const recentCont = document.getElementById('adminRecent');
  if (recentCont) {
    recentCont.innerHTML = '';
    [...reservas].sort((a,b)=>b.id-a.id).slice(0,5).forEach(r => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.textContent = `#${r.id} • ${r.origen}→${r.destino} • ${r.horario} • ${getUserName(r.clienteId)} • ${r.tipo} • ${r.estado}`;
      recentCont.appendChild(div);
    });
  }

  // top rutas por reservas
  const topRutas = document.getElementById('adminTopRutas');
  if (topRutas) {
    topRutas.innerHTML = '';
    const countByRuta = reservas.reduce((acc, r) => { const k = `${r.origen}→${r.destino}`; acc[k] = (acc[k]||0)+1; return acc; }, {});
    Object.entries(countByRuta).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([k, c]) => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.textContent = `${k} • ${c} reservas`;
      topRutas.appendChild(div);
    });
    if (topRutas.children.length === 0) topRutas.innerHTML = 'Sin datos';
  }

  // uso de flota (conteo por vehículo)
  const fleetStats = document.getElementById('adminFleetStats');
  if (fleetStats) {
    fleetStats.innerHTML = '';
    const countByVeh = reservas.reduce((acc, r) => { const k = r.vehiculo || '-'; acc[k] = (acc[k]||0)+1; return acc; }, {});
    Object.entries(countByVeh).sort((a,b)=>b[1]-a[1]).forEach(([k,c]) => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.textContent = `${k} • ${c} viajes`;
      fleetStats.appendChild(div);
    });
    if (fleetStats.children.length === 0) fleetStats.innerHTML = 'Sin datos';
  }

  // uso de promos
  const promoStats = document.getElementById('adminPromoStats');
  if (promoStats) {
    promoStats.innerHTML = '';
    const countByPromo = reservas.filter(r=>r.promo).reduce((acc, r) => { const k = r.promo; acc[k] = (acc[k]||0)+1; return acc; }, {});
    Object.entries(countByPromo).sort((a,b)=>b[1]-a[1]).forEach(([k,c]) => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.textContent = `${k} • ${c} usos`;
      promoStats.appendChild(div);
    });
    if (promoStats.children.length === 0) promoStats.innerHTML = 'Sin datos';
  }
  const clientesCont = document.getElementById('adminClientes');
  if (clientesCont) {
    clientesCont.innerHTML = '';
    const mockClients = storage.get('mockClients', []);
    const clientesAll = [
      ...users.filter(u => u.role === 'cliente'),
      ...mockClients.map(m => ({ ...m, role: 'cliente' })),
    ];
    clientesAll.forEach(u => {
      const mias = reservas.filter(r => r.clienteId === u.id);
      const entregadas = mias.filter(r => r.estado === 'recogido');
      const rated = mias.filter(r => typeof r.rating === 'number');
      const avg = rated.length ? (rated.reduce((a,b)=>a+b.rating,0)/rated.length).toFixed(2) : '-';
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `<div class="row"><strong>${u.nombre}</strong><span class="badge">Cliente</span></div>
        <div>CI: ${u.cedula} • Email: ${u.email ?? '-'} • Tel: ${u.telefono ?? '-'}</div>
        <div>Reservas: ${mias.length} • Completadas: ${entregadas.length} • ★ Promedio: ${avg}</div>`;
      clientesCont.appendChild(div);
    });
  }

  const resCont = document.getElementById("adminReservas");
  resCont.innerHTML = "";
  reservas.forEach(res => {
    const div = document.createElement("div");
    div.className = "list-item";
    const assigned = res.conductorId ? ` • Conductor: ${getUserName(res.conductorId)}` : "";
    const ratingText = res.rating ? ` • ★ ${res.rating}` : "";
    div.textContent = `${res.origen} → ${res.destino} • ${res.horario} • ${getUserName(res.clienteId)} • ${res.tipo} • ${res.estado}${assigned}${ratingText}`;
    resCont.appendChild(div);
  });

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

  // assignment selects
  const assignReserva = document.getElementById("assignReserva");
  const assignConductor = document.getElementById("assignConductor");
  if (assignReserva && assignConductor) {
    assignReserva.innerHTML = "";
    reservas.forEach(r => {
      const opt = document.createElement("option");
      opt.value = String(r.id);
      opt.textContent = `${r.id} • ${r.origen}→${r.destino} ${r.horario} ${r.conductorId?"(asignado)":""}`;
      assignReserva.appendChild(opt);
    });
    assignConductor.innerHTML = "";
    const users = storage.get("users", []);
    users.filter(u => u.role === "conductor").forEach(c => {
      const opt = document.createElement("option");
      opt.value = String(c.id);
      opt.textContent = `${c.nombre}`;
      assignConductor.appendChild(opt);
    });
  }
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

  // theme toggle
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
    applySavedTheme();
  }

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

  // auth toggles
  const goToRegister = document.getElementById('goToRegister');
  const goToLogin = document.getElementById('goToLogin');
  goToRegister?.addEventListener('click', (e) => { e.preventDefault(); showAuthScreen('register'); });
  goToLogin?.addEventListener('click', (e) => { e.preventDefault(); showAuthScreen('login'); });

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
  const openMapPicker = document.getElementById('openMapPicker');
  const mapModal = document.getElementById('mapModal');
  const closeMapPicker = document.getElementById('closeMapPicker');
  const saveMapPicker = document.getElementById('saveMapPicker');
  const mapCoords = document.getElementById('mapCoords');
  const mapAddress = document.getElementById('mapAddress');
  const regLat = document.getElementById('regLat');
  const regLng = document.getElementById('regLng');
  const pickedAddress = document.getElementById('pickedAddress');

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

  openMapPicker?.addEventListener('click', openPicker);
  closeMapPicker?.addEventListener('click', closePicker);
  saveMapPicker?.addEventListener('click', async () => {
    if (!leafletMarker) { toast('Seleccione una ubicación en el mapa'); return; }
    const { lat, lng } = leafletMarker.getLatLng();
    regLat.value = String(lat);
    regLng.value = String(lng);
    const addr = mapAddress.textContent || await reverseGeocode(lat, lng);
    pickedAddress.textContent = addr ? `Dirección: ${addr}` : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    closePicker();
  });

  // removed top nav buttons

  // servicio selector
  const servicioTipo = document.getElementById("servicioTipo");
  if (servicioTipo) servicioTipo.addEventListener("change", onServicioChange);
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
  const extraLabel = document.getElementById("csExtraLabel");
  if (!compartido || !customPanel) return;
  if (tipo === "compartido") {
    compartido.hidden = false;
    customPanel.hidden = true;
  } else {
    compartido.hidden = true;
    customPanel.hidden = false;
  }
  if (extraLabel) extraLabel.hidden = tipo !== "encomienda";
}

function handleCustomServiceSubmit(e) {
  e.preventDefault();
  const tipo = getServicioTipo();
  const origen = document.getElementById("csOrigen").value.trim();
  const destino = document.getElementById("csDestino").value.trim();
  const horario = document.getElementById("csHorario").value.trim();
  const precio = Number(document.getElementById("csPrecio").value);
  if (!origen || !destino || !horario || !precio) return;
  selectedRutaId = null;
  selectedCustomService = { id: Date.now(), origen, destino, horario, precio, asientos: tipo === "privado" ? 1 : 0 };
  // open reserve panel with sensible defaults
  document.getElementById("tipoReserva").value = (tipo === "encomienda") ? "encomienda" : "asiento";
  const info = document.getElementById("reservaInfo");
  info.textContent = `${origen} → ${destino} • ${horario} • $${precio} • ${tipo}`;
  document.getElementById("reservaPanel").hidden = false;
}

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
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

function applySavedTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = '☀️';
  }
}


