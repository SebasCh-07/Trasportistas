// Seed & storage helpers (multi-tenant namespace)
const storage = {
  get(key, fallback) {
    try { return JSON.parse(sessionStorage.getItem(namespacedKey(key))) ?? fallback; } catch { return fallback; }
  },
  set(key, value) { sessionStorage.setItem(namespacedKey(key), JSON.stringify(value)); },
};

function namespacedKey(key) {
  const ns = getCompanyNamespace();
  return `${ns}:${key}`;
}

function getCompanyNamespace() {
  return sessionStorage.getItem("tenant") || "TeLlevo";
}

function setCompanyNamespace(ns) {
  sessionStorage.setItem("tenant", ns);
}

// Resolve asset paths consistently whether we're at root or inside views/*
function asset(relPath) {
  try {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (/\/views\//.test(path)) {
      const clean = relPath.replace(/^\.\//, '');
      return `../../${clean}`;
    }
    return relPath;
  } catch {
    return relPath;
  }
}

const SEED = {
  users: [
    { id: 1, role: "cliente", nombre: "Juan Pérez", cedula: "1234567890", email: "cliente@demo.com", password: "123456", direccion: "Av. Siempre Viva 123", foto: null },
    { id: 2, role: "conductor", nombre: "Carlos Ruiz", cedula: "0987654321", email: "conductor@demo.com", password: "123456", direccion: "Calle 10 #20", foto: null },
    { id: 3, role: "admin", nombre: "Administrador", cedula: "0000000000", email: "admin@demo.com", password: "123456", direccion: "Oficina Central", foto: null },
    { id: 4, role: "empresa", nombre: "Ecuador Travel Tours", cedula: "0999999999", email: "empresa@demo.com", password: "123456", direccion: "Av. Amazonas 1234", foto: null, empresa: "Ecuador Travel Tours", tarifaEmpresa: 1.5 },
    { id: 5, role: "cliente_empresa", nombre: "Cliente Empresa Demo", cedula: "2223334445", email: "cliente.empresa@demo.com", password: "123456", direccion: "Av. Empresa 456", empresa: "Ecuador Travel Tours", foto: null },
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
  tracking: [
    {
      conductorId: 2,
      reservaId: 1,
      lat: -0.1807,
      lng: -78.4678,
      updatedAt: Date.now() - 300000 // 5 minutos atrás
    }
  ],
  mockClients: [
    { id: 10001, nombre: "María González", cedula: "1102233445", email: "maria@example.com", telefono: "+593987654321", empresa: "Ecuador Travel Tours" },
    { id: 10002, nombre: "Luis Andrade", cedula: "1719988776", email: "luis@example.com", telefono: "+593987650000", empresa: "Ecuador Travel Tours" },
    { id: 10003, nombre: "Ana Torres", cedula: "0911122233", email: "ana@example.com", telefono: "+593999111222", empresa: "Ecuador Travel Tours" },
    { id: 10004, nombre: "Pedro Morales", cedula: "1711223344", email: "pedro@example.com", telefono: "+593999888777", empresa: "Ecuador Travel Tours" },
    { id: 10005, nombre: "Carmen Silva", cedula: "1712334455", email: "carmen@example.com", telefono: "+593999777666", empresa: "Ecuador Travel Tours" },
  ],
};

function seedIfEmpty() {
  const key = namespacedKey("users");
  if (!sessionStorage.getItem(key)) {
    storage.set("users", SEED.users);
  } else {
    // migrate existing users to include email/password if missing (avoid breaking login)
    try {
      const current = JSON.parse(sessionStorage.getItem(key));
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
        
        // Asegurar usuarios semilla importantes (empresa y cliente_empresa)
        const ensureByEmail = (email) => {
          if (!migrated.some(u => (u.email||'').toLowerCase() === email)) {
            const seedUser = (SEED.users||[]).find(u => (u.email||'').toLowerCase() === email);
            if (seedUser) migrated.push(seedUser);
          }
        };
        ensureByEmail('empresa@demo.com');
        ensureByEmail('cliente.empresa@demo.com');
        
        sessionStorage.setItem(key, JSON.stringify(migrated));
      }
    } catch {}
  }
  if (!sessionStorage.getItem(namespacedKey('mockClients'))) storage.set('mockClients', SEED.mockClients);
  if (!sessionStorage.getItem(namespacedKey("rutas"))) storage.set("rutas", SEED.rutas);
  if (!sessionStorage.getItem(namespacedKey("flota"))) storage.set("flota", SEED.flota);
  if (!sessionStorage.getItem(namespacedKey("reservas"))) storage.set("reservas", SEED.reservas);
  if (!sessionStorage.getItem(namespacedKey("promos"))) storage.set("promos", SEED.promos);
  if (!sessionStorage.getItem(namespacedKey("tracking"))) storage.set("tracking", []);
  if (!sessionStorage.getItem(namespacedKey("invoices"))) storage.set("invoices", []);
}

// Session
function getSession() { return storage.get("session", null); }
function setSession(session) { storage.set("session", session); }
function clearSession() { try { sessionStorage.removeItem(namespacedKey("session")); } catch {} }

// Router
const views = {
  auth: document.getElementById("view-auth"),
  cliente: document.getElementById("view-cliente"),
  empresa: document.getElementById("view-empresa"),
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
  // Ocultar todas las vistas presentes actualmente en el DOM
  document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.hidden = true; });
  // Encontrar dinámicamente la vista de destino
  const target = document.getElementById(`view-${name}`);
  if (target) {
    target.classList.add('active');
    target.hidden = false;
  }
  if (name === 'auth') showAuthScreen('login');
  highlightActiveNav(name);
  
  // Ejecutar funciones de renderizado específicas para cada vista
  switch(name) {
    case 'cliente':
      try { renderCliente(); } catch {}
      break;
    case 'empresa':
      try { renderEmpresa(); } catch {}
      break;
    case 'conductor':
      try { renderConductor(); } catch {}
      break;
    case 'admin':
      try { renderAdmin(); } catch {}
      break;
  }
  
  try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { window.scrollTo(0,0); }
}

function updateSessionUi() {
  const sessionSpan = document.getElementById("sessionUser");
  const session = getSession();
  if (sessionSpan) {
    if (session) {
      sessionSpan.textContent = `${session.nombre} (${session.role})`;
    } else {
      sessionSpan.textContent = "Sin sesión";
    }
  }
  // Actualizar marca según rol (para empresa/cliente_empresa mostrar EMPRESA)
  const brand = document.querySelector('.brand');
  if (brand) {
    if (session && (session.role === 'empresa' || session.role === 'cliente_empresa')) {
      brand.textContent = 'EMPRESA';
    } else {
      brand.textContent = 'TeLlevo';
    }
  }
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
  const form = e.target;
  const getInForm = (sel) => form?.querySelector(sel);
  const nombres = getInForm('[id="regNombres"]')?.value?.trim() || '';
  const apellidos = getInForm('[id="regApellidos"]')?.value?.trim() || '';
  const nombre = `${nombres} ${apellidos}`.trim();
  const cedula = getInForm('[id="regCedula"]')?.value?.trim() || '';
  const tipoCliente = (getInForm('[id="regTipoCliente"]')?.value || 'cliente').trim();
  let role = 'cliente';
  if (tipoCliente === 'empresa') role = 'empresa';
  else if (tipoCliente === 'cliente_empresa') role = 'cliente_empresa';
  const nombreEmpresa = getInForm('[id="regNombreEmpresa"]')?.value?.trim() || null;
  const fotoFile = getInForm('[id="regFoto"]')?.files?.[0] || null;
  const direccion = getInForm('[id="pickedAddress"]')?.textContent?.replace(/^Dirección:\s*/, '')?.trim() || '';
  const lat = Number(getInForm('[id="regLat"]')?.value || 0);
  const lng = Number(getInForm('[id="regLng"]')?.value || 0);
  const telefono = getInForm('[id="regTelefono"]')?.value?.trim() || '';
  const referencia = getInForm('[id="regReferencia"]')?.value?.trim() || '';
  const email = getInForm('[id="regEmail"]')?.value?.trim() || '';
  const password = getInForm('[id="regPassword"]')?.value || '';
  const users = storage.get("users", []);
  if (users.some(u => u.cedula === cedula)) {
    const msgEl = getInForm('#registerMsg'); if (msgEl) msgEl.textContent = 'Ya existe un usuario con esa cédula';
    return;
  }
  if (users.some(u => u.email?.toLowerCase() === email.toLowerCase())) {
    const msgEl = getInForm('#registerMsg'); if (msgEl) msgEl.textContent = 'Ya existe un usuario con ese correo';
    return;
  }
  const finalize = (photoDataUrl) => {
    const newUser = { id: Date.now(), role, nombre, cedula, direccion, lat, lng, telefono, referencia, email, password, foto: photoDataUrl || null };
    if (role === 'empresa' || role === 'cliente_empresa') {
      newUser.empresa = nombreEmpresa || 'Otra Empresa';
    }
    users.push(newUser);
    storage.set("users", users);
    const msgEl = getInForm('#registerMsg'); if (msgEl) msgEl.textContent = 'Registro exitoso. Ahora inicie sesión.';
    toast("Registro completado");
    form.reset();
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
  // Redirigir a páginas separadas por rol
  const map = {
    'cliente': 'views/cliente/index.html',
    'cliente_empresa': 'views/cliente_empresa/index.html',
    'empresa': 'views/empresa/index.html',
    'conductor': 'views/conductor/index.html',
    'admin': 'views/admin/index.html',
  };
  const target = map[role];
  if (target) {
    window.location.href = target;
  } else {
    showView('auth');
  }
}

function applyRoleStyles(role) {
  const link = document.getElementById('roleStyles');
  if (!link) return;
  const map = {
    'cliente': 'styles/styles_cliente.css',
    'cliente_empresa': 'styles/clienteEmpresa.css',
    'empresa': 'styles/empresa.css',
    'conductor': 'styles/styles_conductor.css',
    'admin': 'styles/styles_admin.css',
  };
  // Usar resolver de assets para rutas correctas dentro de views/*
  link.href = asset(map[role] || 'styles/base.css');
  try {
    const shouldContrast = (role === 'empresa' || role === 'cliente_empresa');
    const root = document.documentElement;
    if (shouldContrast) root.setAttribute('data-theme', 'contrast');
    else root.removeAttribute('data-theme');
  } catch {}
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
  // Iniciar simulación de tracking en tiempo real
  startTrackingSimulation();
  // preparar opciones de origen
  populateOrigenOptions();
  wireOrigenPicker();
  wireMapButtons();
}

// Empresa (solo servicios privado y compartido)
function renderEmpresa() {
  // Header empresa
  const session = getSession();
  const tarifa = (() => {
    if (session?.role === 'empresa') return Number(session.tarifaEmpresa || 0);
    if (session?.role === 'cliente_empresa') {
      const users = storage.get('users', []);
      const emp = users.find(u => u.role === 'empresa' && (u.empresa === session.empresa));
      return Number(emp?.tarifaEmpresa || 0);
    }
    return 0;
  })();
  const nombre = session?.empresa || session?.nombre || '-';
  const headerNombre = document.getElementById('empresaHeaderNombre');
  const headerTarifa = document.getElementById('empresaHeaderTarifa');
  if (headerNombre) headerNombre.textContent = nombre;
  if (headerTarifa) headerTarifa.textContent = `$${tarifa.toFixed(2)}`;

  // Renderizar dashboard
  renderEmpresaDashboard();
  
  renderHistorialEmpresa();
  renderMisViajesEmpresa();
  renderTrackingForEmpresa();
  // preparar opciones de origen para empresa
  populateOrigenOptionsEmpresa();
  wireOrigenPickerEmpresa();
  wireEmpresaTabs();
  wireEmpresaViajesTabs();
}

// Cliente Empresa (mismo flujo que cliente, pero con rutas de empresa y tarifas)
function renderClienteEmpresa() {
  // Header empresa (nombre y tarifa aplicada al cliente_empresa)
  const session = getSession();
  const tarifa = (() => {
    if (session?.role === 'empresa') return Number(session.tarifaEmpresa || 0);
    if (session?.role === 'cliente_empresa') {
      const users = storage.get('users', []);
      const emp = users.find(u => u.role === 'empresa' && (u.empresa === session.empresa));
      return Number(emp?.tarifaEmpresa || 0);
    }
    return 0;
  })();
  const nombre = session?.empresa || session?.nombre || '-';
  const headerNombre = document.getElementById('empresaHeaderNombre');
  const headerTarifa = document.getElementById('empresaHeaderTarifa');
  if (headerNombre) headerNombre.textContent = nombre;
  if (headerTarifa) headerTarifa.textContent = `$${tarifa.toFixed(2)}`;

  // Renderizar rutas disponibles (compartido) para cliente_empresa
  renderRutasClienteEmpresa();

  // Wire del selector de servicios (simple descripción)
  const servicioSelect = document.getElementById('servicioTipoEmpresa');
  const servicioDesc = document.getElementById('servicioDescripcionEmpresa');
  if (servicioSelect && servicioDesc) {
    const updateDesc = () => {
      const v = servicioSelect.value;
      if (v === 'privado') {
        servicioDesc.innerHTML = '<p>Unidad exclusiva para tu traslado, precio a convenir.</p>';
      } else {
        servicioDesc.innerHTML = '<p>Servicio compartido por asiento en rutas disponibles.</p>';
      }
    };
    servicioSelect.onchange = updateDesc;
    updateDesc();
  }

  // Mis viajes e historial (reutiliza funciones de empresa orientadas a cliente)
  renderMisViajesEmpresa();
  renderHistorialEmpresa();

  // Wire pestañas específicas de cliente_empresa
  wireClienteEmpresaTabs();
  // Wire subtabs de viajes (reutiliza)
  wireEmpresaViajesTabs();
}

function renderRutasClienteEmpresa() {
  const cont = document.getElementById('rutasListEmpresa');
  if (!cont) return;
  const rutas = storage.get('rutas', []);
  cont.innerHTML = '';
  if (!rutas.length) { cont.innerHTML = "<div class='text-muted'>Sin rutas</div>"; return; }
  const session = getSession();
  const empresaKey = (session?.empresa || session?.id || 'empresa');
  rutas.forEach(r => {
    const tarifaAdicional = getRutaTarifaAdicional(empresaKey, r.id);
    const precioFinal = (Number(r.precio) || 0) + (Number(tarifaAdicional) || 0);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h4>${r.origen} → ${r.destino}</h4>
      <div class="row"><span class="badge">${r.horario}</span><span class="price">$${precioFinal.toFixed(2)}</span></div>
      <div class="row"><span>Asientos disp.: ${r.asientos}</span><button ${r.asientos<=0?"disabled":""} data-id="${r.id}" class="reserveEmpresaBtn">Reservar</button></div>
    `;
    cont.appendChild(card);
  });
  cont.querySelectorAll('.reserveEmpresaBtn').forEach(btn =>
    btn.addEventListener('click', () => openReservaEmpresa(Number(btn.dataset.id)))
  );
}

function wireClienteEmpresaTabs() {
  const scope = document.getElementById('view-empresa');
  if (!scope) return;
  const buttons = scope.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      // activar botón
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // activar panel
      const map = {
        'servicios': 'tab-servicios',
        'mis-viajes': 'tab-mis-viajes-empresa',
        'historial': 'tab-historial-empresa',
      };
      const targetId = map[tab];
      scope.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(targetId);
      if (panel) panel.classList.add('active');
      // refrescos por pestaña
      if (targetId === 'tab-servicios') renderRutasClienteEmpresa();
      if (targetId === 'tab-mis-viajes-empresa') renderMisViajesEmpresa();
      if (targetId === 'tab-historial-empresa') renderHistorialEmpresa();
    });
  });
}

function wireEmpresaTabs() {
  document.querySelectorAll('#view-empresa .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      document.querySelectorAll('#view-empresa .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#view-empresa .tab-panel').forEach(p => p.classList.remove('active'));
      let panelId = 'tab-dashboard';
      if (tab === 'reservas') panelId = 'tab-reservas-empresa';
      else if (tab === 'rutas') panelId = 'tab-rutas-empresa';
      else if (tab === 'flota') panelId = 'tab-flota-empresa';
      else if (tab === 'clientes') panelId = 'tab-clientes-empresa';
      else if (tab === 'gps') panelId = 'tab-gps-empresa';
      const panel = document.getElementById(panelId);
      if (panel) panel.classList.add('active');
      if (panelId === 'tab-dashboard') renderEmpresaDashboard();
      if (panelId === 'tab-reservas-empresa') renderEmpresaReservas('pendiente');
      if (panelId === 'tab-rutas-empresa') renderEmpresaRutas();
      if (panelId === 'tab-flota-empresa') renderEmpresaFlota();
      if (panelId === 'tab-clientes-empresa') renderEmpresaClientes();
      
      if (panelId === 'tab-gps-empresa') renderEmpresaGps(document.getElementById('empresaGpsFilter')?.value?.trim()||'');
      
    });
  });
}

// --- Rutas: helpers de tarifa por empresa ---
function getRutaTarifaAdicional(empresaKey, rutaId) {
  try {
    const map = storage.get('empresaRutaTarifas', {});
    const byEmpresa = map?.[empresaKey] || {};
    return Number(byEmpresa[rutaId] || 0);
  } catch { return 0; }
}

function setRutaTarifaAdicional(empresaKey, rutaId, valueNumber) {
  const map = storage.get('empresaRutaTarifas', {});
  const byEmpresa = map[empresaKey] || {};
  byEmpresa[rutaId] = Number(valueNumber) || 0;
  map[empresaKey] = byEmpresa;
  storage.set('empresaRutaTarifas', map);
}

// --- Rutas: acciones Ver / Editar ---
let __rutaSeleccionadaId = null;
function verRuta(rutaId) {
  const rutas = storage.get('rutas', []);
  const r = rutas.find(x => x.id === rutaId);
  if (!r) return;
  const session = getSession();
  const empresaKey = (session?.empresa || session?.id || 'empresa');
  const tarifaAdicional = getRutaTarifaAdicional(empresaKey, rutaId);
  const precioFinal = (Number(r.precio)||0) + (Number(tarifaAdicional)||0);
  const cont = document.getElementById('verRutaContent');
  if (cont) {
    cont.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
        <div>
          <div style="font-size:18px; font-weight:600;">${r.origen} → ${r.destino}</div>
          <div class="row" style="gap:6px; margin-top:4px;">
            <span class="badge">⏰ ${r.horario}</span>
            <span class="badge">🪑 Asientos: ${r.asientos}</span>
          </div>
        </div>
      </div>
      <div class="two-col" style="gap:12px;">
        <div>
          <div class="panel" style="padding:12px;">
            <div class="row" style="justify-content:space-between; margin-bottom:6px;">
              <span class="text-muted">Precio base</span>
              <strong>$${Number(r.precio).toFixed(2)}</strong>
            </div>
            <div class="row" style="justify-content:space-between; margin-bottom:6px;">
              <span class="text-muted">Tarifa adicional</span>
              <strong>$${Number(tarifaAdicional||0).toFixed(2)}</strong>
            </div>
            <div class="row" style="justify-content:space-between;">
              <span class="text-muted">Precio final</span>
              <strong>$${precioFinal.toFixed(2)}</strong>
            </div>
          </div>
        </div>
        <div>
          <div class="panel" style="padding:12px;">
            <div style="font-weight:600; margin-bottom:6px;">Resumen</div>
            <div class="row" style="justify-content:space-between; margin-bottom:4px;"><span>Origen</span><span>${r.origen}</span></div>
            <div class="row" style="justify-content:space-between; margin-bottom:4px;"><span>Destino</span><span>${r.destino}</span></div>
            <div class="row" style="justify-content:space-between; margin-bottom:4px;"><span>Horario</span><span>${r.horario}</span></div>
            <div class="row" style="justify-content:space-between;"><span>Asientos</span><span>${r.asientos}</span></div>
          </div>
        </div>
      </div>
    `;
  }
  const modal = document.getElementById('verRutaModal');
  if (modal) modal.style.display = 'block';
}

function cerrarVerRutaModal() {
  const modal = document.getElementById('verRutaModal');
  if (modal) modal.style.display = 'none';
}

function editarRuta(rutaId) {
  __rutaSeleccionadaId = rutaId;
  const session = getSession();
  const empresaKey = (session?.empresa || session?.id || 'empresa');
  const tarifaAdicional = getRutaTarifaAdicional(empresaKey, rutaId);
  const input = document.getElementById('erTarifa');
  if (input) input.value = Number(tarifaAdicional||0).toFixed(2);
  const modal = document.getElementById('editarRutaModal');
  if (modal) modal.style.display = 'block';
  const btn = document.getElementById('confirmarEditarRuta');
  if (btn) {
    btn.onclick = () => {
      const value = Number(document.getElementById('erTarifa')?.value || 0);
      if (value < 0 || Number.isNaN(value)) { toast('Tarifa inválida'); return; }
      setRutaTarifaAdicional(empresaKey, rutaId, value);
      cerrarEditarRutaModal();
      renderEmpresaRutas();
      toast('Tarifa actualizada');
    };
  }
}

function cerrarEditarRutaModal() {
  const modal = document.getElementById('editarRutaModal');
  if (modal) modal.style.display = 'none';
}

// Función para renderizar el dashboard de empresa
function renderEmpresaDashboard() {
  const session = getSession();
  const reservas = storage.get('reservas', []).filter(r => r.clienteId === session?.id);
  const rutas = storage.get('rutas', []);
  const flota = storage.get('flota', []);
  const ratings = storage.get('ratings', []);
  
  // Calcular KPIs
  const totalReservas = reservas.length;
  const ingresos = reservas.reduce((sum, r) => sum + (parseFloat(r.precio) || 0), 0);
  const viajesActivos = reservas.filter(r => r.estado === 'en-curso').length;
  const pendientes = reservas.filter(r => r.estado === 'pendiente').length;
  const enCurso = reservas.filter(r => r.estado === 'en-curso').length;
  
  // Completados hoy
  const hoy = new Date().toDateString();
  const completadosHoy = reservas.filter(r => 
    r.estado === 'recogido' && new Date(r.fecha).toDateString() === hoy
  ).length;
  
  // Calificación promedio
  const empresaRatings = ratings.filter(r => r.clienteId === session?.id);
  const calificacionPromedio = empresaRatings.length > 0 
    ? (empresaRatings.reduce((sum, r) => sum + r.valor, 0) / empresaRatings.length).toFixed(1)
    : '-';
  
  // Actualizar KPIs
  updateElement('empresaTotalReservas', totalReservas);
  updateElement('empresaIngresos', `$${ingresos.toFixed(2)}`);
  updateElement('empresaViajesActivos', viajesActivos);
  updateElement('empresaCalificacion', calificacionPromedio);
  
  // Actualizar estado operacional
  updateElement('empresaPendientes', pendientes);
  updateElement('empresaEnCurso', enCurso);
  updateElement('empresaCompletadosHoy', completadosHoy);
  
  // Actividad reciente
  renderEmpresaRecentActivity();
  
  // Rutas más populares
  renderEmpresaTopRutas();
  
  // Estadísticas de flota
  renderEmpresaFleetStats();
}

function updateElement(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function renderEmpresaRecentActivity() {
  const cont = document.getElementById('empresaRecentActivity');
  if (!cont) return;
  
  const session = getSession();
  const reservas = storage.get('reservas', [])
    .filter(r => r.clienteId === session?.id)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 5);
  
  cont.innerHTML = '';
  if (!reservas.length) {
    cont.innerHTML = "<div class='text-muted'>Sin actividad reciente</div>";
    return;
  }
  
  reservas.forEach(r => {
    const div = document.createElement('div');
    div.className = 'activity-item';
    div.innerHTML = `
      <div class="activity-icon">${getActivityIcon(r.estado)}</div>
      <div class="activity-content">
        <div class="activity-title">${r.origen} → ${r.destino}</div>
        <div class="activity-meta">${r.estado} • $${r.precio}</div>
      </div>
    `;
    cont.appendChild(div);
  });
}

function renderEmpresaTopRutas() {
  const cont = document.getElementById('empresaTopRutas');
  if (!cont) return;
  
  const session = getSession();
  const reservas = storage.get('reservas', []).filter(r => r.clienteId === session?.id);
  
  // Contar rutas más populares
  const rutasCount = {};
  reservas.forEach(r => {
    const ruta = `${r.origen} → ${r.destino}`;
    rutasCount[ruta] = (rutasCount[ruta] || 0) + 1;
  });
  
  const topRutas = Object.entries(rutasCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  cont.innerHTML = '';
  if (!topRutas.length) {
    cont.innerHTML = "<div class='text-muted'>Sin datos de rutas</div>";
    return;
  }
  
  topRutas.forEach(([ruta, count]) => {
    const div = document.createElement('div');
    div.className = 'route-item';
    div.innerHTML = `
      <div class="route-name">${ruta}</div>
      <div class="route-count">${count} viajes</div>
    `;
    cont.appendChild(div);
  });
}

function renderEmpresaFleetStats() {
  const cont = document.getElementById('empresaFleetStats');
  if (!cont) return;
  
  const flota = storage.get('flota', []);
  const totalFlota = flota.length;
  const flotaActiva = flota.filter(v => v.estado === 'activo').length;
  const flotaMantenimiento = flota.filter(v => v.estado === 'mantenimiento').length;
  
  cont.innerHTML = `
    <div class="fleet-stats">
      <div class="fleet-stat">
        <div class="fleet-number">${totalFlota}</div>
        <div class="fleet-label">Total</div>
      </div>
      <div class="fleet-stat">
        <div class="fleet-number">${flotaActiva}</div>
        <div class="fleet-label">Activos</div>
      </div>
      <div class="fleet-stat">
        <div class="fleet-number">${flotaMantenimiento}</div>
        <div class="fleet-label">Mantenimiento</div>
      </div>
    </div>
  `;
}

function getActivityIcon(estado) {
  const icons = {
    'pendiente': '⏳',
    'confirmada': '✅',
    'en-curso': '🚗',
    'recogido': '🏁',
    'cancelada': '❌'
  };
  return icons[estado] || '📋';
}

// Función para cambiar pestañas desde el dashboard
function switchEmpresaTab(tabName) {
  const tabBtn = document.querySelector(`#view-empresa .tab-btn[data-tab="${tabName}"]`);
  if (tabBtn) {
    tabBtn.click();
  }
}

function renderEmpresaReservas(filter = 'pendiente') {
  const cont = document.getElementById('empresaReservas');
  if (!cont) return;
  const session = getSession();
  const reservas = storage.get('reservas', []).filter(r => r.clienteId === session?.id);
  const filtered = reservas.filter(r => (filter === 'pendiente' ? r.estado === 'pendiente' : r.estado === filter));
  cont.innerHTML = '';
  if (!filtered.length) { cont.innerHTML = "<div class='text-muted'>Sin reservas</div>"; return; }
  filtered.sort((a,b)=>b.id-a.id).forEach(r => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div class="row"><strong>${r.origen} → ${r.destino}</strong><span class="badge">${r.estado}</span></div>
      <div>Horario: ${r.horario} • Precio: $${r.precio}</div>
      <div>Método: ${r.metodoPago || '-'}${r.promo?` • Cupón: ${r.promo}`:''}</div>
    `;
    cont.appendChild(div);
  });
  document.querySelectorAll('.empresa-res-filter-btn').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.empresa-res-filter-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      renderEmpresaReservas(b.getAttribute('data-filter'));
    }
  });
}

function renderEmpresaRutas() {
  const cont = document.getElementById('empresaRutas');
  if (!cont) return;
  const rutas = storage.get('rutas', []);
  cont.innerHTML = '';
  if (!rutas.length) { cont.innerHTML = "<div class='text-muted'>Sin rutas</div>"; return; }
  const session = getSession();
  const empresaKey = (session?.empresa || session?.id || 'empresa');
  rutas.forEach(r => {
    const tarifaAdicional = getRutaTarifaAdicional(empresaKey, r.id);
    const precioFinal = (Number(r.precio) || 0) + (Number(tarifaAdicional) || 0);
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
      <div class="row">
        <strong>${r.origen} → ${r.destino}</strong>
        <span class="badge">${r.horario}</span>
      </div>
      <div>
        Precio base: $${Number(r.precio).toFixed(2)} • Tarifa: $${Number(tarifaAdicional||0).toFixed(2)} • Precio final: <strong>$${precioFinal.toFixed(2)}</strong> • Asientos: ${r.asientos}
      </div>
      <div class="row" style="gap:8px; margin-top:6px;">
        <button class="btn secondary" onclick="verRuta(${r.id})"><span>👁️</span> Ver</button>
        <button class="btn secondary" onclick="editarRuta(${r.id})"><span>✏️</span> Editar</button>
      </div>
    `;
    cont.appendChild(div);
  });
}

function renderEmpresaFlota() {
  const cont = document.getElementById('empresaFlota');
  if (!cont) return;
  
  const session = getSession();
  if (!session) { 
    cont.innerHTML = "<div class='text-muted'>Inicie sesión</div>"; 
    return; 
  }

  const flota = storage.get('flota', []);
  const mockFlota = [
    { id: 801, placa: 'XYZ-101', conductor: 'Conductor Demo 1', capacidad: 5, tipo: 'sedan', marca: 'Toyota', modelo: 'Corolla', año: 2020, color: 'Blanco' },
    { id: 802, placa: 'XYZ-102', conductor: 'Conductor Demo 2', capacidad: 7, tipo: 'suv', marca: 'Honda', modelo: 'CR-V', año: 2021, color: 'Negro' },
    { id: 803, placa: 'XYZ-103', conductor: 'Conductor Demo 3', capacidad: 4, tipo: 'sedan', marca: 'Nissan', modelo: 'Sentra', año: 2019, color: 'Gris' },
    { id: 804, placa: 'XYZ-104', conductor: 'Carlos Ruiz', capacidad: 5, tipo: 'sedan', marca: 'Chevrolet', modelo: 'Cruze', año: 2022, color: 'Azul' },
  ];
  
  // Filtrar solo vehículos de la empresa (asumiendo que la empresa tiene acceso a toda la flota demo)
  const allFlota = [...flota, ...mockFlota];
  
  cont.innerHTML = '';
  if (!allFlota.length) { 
    cont.innerHTML = "<div class='text-muted'>Sin flota registrada</div>"; 
    return; 
  }

  allFlota.forEach(v => {
    const div = document.createElement('div');
    div.className = 'list-item';
    
    // Obtener información del conductor
    const conductorNombre = v.conductor || 'Sin asignar';
    
    // Determinar estado del vehículo
    const reservas = storage.get('reservas', []);
    const viajesActivos = reservas.filter(r => r.vehiculo === v.placa && r.estado === 'en-curso');
    const estado = viajesActivos.length > 0 ? 'En Servicio' : 'Disponible';
    const estadoClass = viajesActivos.length > 0 ? 'status-busy' : 'status-available';
    
    // Icono según tipo de vehículo
    const tipoIcon = {
      'sedan': '🚗',
      'suv': '🚙', 
      'van': '🚐',
      'camioneta': '🛻',
      'bus': '🚌'
    }[v.tipo] || '🚗';
    
    div.innerHTML = `
      <div class="admin-item">
        <div class="admin-item-info">
          <div class="admin-item-header">
            <span class="admin-item-title">${tipoIcon} ${v.placa}</span>
            <span class="badge ${estadoClass}">${estado}</span>
          </div>
          <div class="admin-item-details">
            <div class="admin-item-detail">
              <span class="detail-label">Tipo:</span>
              <span class="detail-value">${v.tipo || 'No especificado'}</span>
            </div>
            <div class="admin-item-detail">
              <span class="detail-label">Marca/Modelo:</span>
              <span class="detail-value">${v.marca || 'N/A'} ${v.modelo || ''}</span>
            </div>
            <div class="admin-item-detail">
              <span class="detail-label">Capacidad:</span>
              <span class="detail-value">${v.capacidad || '-'} pasajeros</span>
            </div>
            <div class="admin-item-detail">
              <span class="detail-label">Conductor:</span>
              <span class="detail-value">${conductorNombre}</span>
            </div>
          </div>
        </div>
        
        <div class="admin-item-actions">
          <button class="btn secondary" onclick="verVehiculo('${v.placa}')">
            <span>👁️</span> Ver
          </button>
        </div>
      </div>
    `;
    cont.appendChild(div);
  });
}

function renderEmpresaClientes() {
  const cont = document.getElementById('empresaClientes');
  if (!cont) return;

  const session = getSession();
  if (!session) { cont.innerHTML = "<div class='text-muted'>Inicie sesión</div>"; return; }

  const users = storage.get('users', []);
  const mockClients = storage.get('mockClients', []);
  const reservas = storage.get('reservas', []);
  const clientesAll = [
    ...users.filter(u => u.role === 'cliente_empresa' && u.empresa === session.empresa),
    ...mockClients
      .filter(m => m.empresa === session.empresa)
      .map(m => ({ ...m, role: 'cliente_empresa' }))
  ];

  cont.innerHTML = '';
  if (clientesAll.length === 0) {
    cont.innerHTML = "<div class='empty-state'>👥 No hay clientes de tu empresa</div>";
    return;
  }

  clientesAll.forEach(u => {
    const mias = reservas.filter(r => r.clienteId === u.id);
    const entregadas = mias.filter(r => r.estado === 'recogido');
    const pendientes = mias.filter(r => !r.conductorId).length;
    const rated = mias.filter(r => typeof r.rating === 'number');
    const avg = rated.length ? (rated.reduce((a,b)=>a+b.rating,0)/rated.length).toFixed(1) : null;
    const gastoTotal = mias.reduce((sum, r) => sum + (Number(r.precio) || 0), 0);

    let clientLevel = '';
    let levelClass = '';
    if (mias.length === 0) { clientLevel = '🆕 Nuevo'; levelClass = 'level-new'; }
    else if (mias.length >= 10) { clientLevel = '⭐ VIP'; levelClass = 'level-vip'; }
    else if (mias.length >= 5) { clientLevel = '💎 Premium'; levelClass = 'level-premium'; }
    else { clientLevel = '👤 Regular'; levelClass = 'level-regular'; }

    const div = document.createElement('div');
    div.className = 'admin-list-item';
    div.innerHTML = `
      <div class="admin-item-header">
        <div class="admin-item-main">
          <div class="admin-item-avatar"><span class="avatar-icon">👤</span></div>
          <div class="admin-item-details">
            <div class="admin-item-name">${u.nombre}</div>
            <div class="admin-item-meta">CI: ${u.cedula || '-'} • ${u.email || 'Sin email'}</div>
            <div class="admin-item-contact">📞 ${u.telefono || 'Sin teléfono'}</div>
          </div>
        </div>
        <div class="admin-item-badge"><span class="client-level-badge ${levelClass}">${clientLevel}</span></div>
      </div>
      <div class="admin-item-stats">
        <div class="stat-item"><span class="stat-icon">📋</span><span class="stat-label">Total Reservas:</span><span class="stat-value">${mias.length}</span></div>
        <div class="stat-item"><span class="stat-icon">✅</span><span class="stat-label">Completadas:</span><span class="stat-value">${entregadas.length}</span></div>
        <div class="stat-item"><span class="stat-icon">⏳</span><span class="stat-label">Pendientes:</span><span class="stat-value">${pendientes}</span></div>
        <div class="stat-item"><span class="stat-icon">💰</span><span class="stat-label">Gasto Total:</span><span class="stat-value">$${gastoTotal}</span></div>
        ${avg ? `<div class="stat-item"><span class="stat-icon">⭐</span><span class="stat-label">Calificación:</span><span class="stat-value">${avg}/5</span></div>` : ''}
      </div>
      <div class="admin-item-actions">
        <button class="btn secondary" onclick="verCliente(${u.id})"><span>👁️</span> Ver</button>
        <button class="btn secondary" onclick="editarCliente(${u.id})"><span>✏️</span> Editar</button>
        <button class="btn danger" onclick="deleteCliente(${u.id})"><span>🗑️</span> Eliminar</button>
      </div>
    `;
    cont.appendChild(div);
  });
}

// eliminado renderEmpresaPromos

// --- EMPRESA GPS ---
let empresaGpsMap = null;
let empresaGpsMarkers = [];
let empresaGpsMarkerByKey = {};
function renderEmpresaGps(filterText = '') {
  const cont = document.getElementById('empresaGpsMap');
  const list = document.getElementById('empresaGpsList');
  const countEl = document.getElementById('empresaGpsCount');
  if (!cont || !list) return;
  if (!empresaGpsMap) {
    empresaGpsMap = L.map('empresaGpsMap').setView([-0.1807, -78.4678], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(empresaGpsMap);
  }
  // limpiar marcadores previos
  empresaGpsMarkers.forEach(m => empresaGpsMap.removeLayer(m));
  empresaGpsMarkers = [];
  empresaGpsMarkerByKey = {};
  list.innerHTML = '';

  const session = getSession();
  if (!session) return;

  const users = storage.get('users', []);
  const tracking = storage.get('tracking', []); // [{conductorId, lat, lng, updatedAt, reservaId}]
  const reservas = storage.get('reservas', []).filter(r => r.clienteId === session.id);

  // Conductores del sistema
  const allDrivers = users.filter(u => u.role === 'conductor');
  const visiblesDrivers = filterText
    ? allDrivers.filter(u => (u.nombre || '').toLowerCase().includes(filterText.toLowerCase()))
    : allDrivers;

  // Mapear conductor -> tracking activo (solo reservas de la empresa en curso)
  const reservasEmpresaIds = new Set(reservas.map(r => r.id));
  const trackingActivos = tracking.filter(t => 
    reservasEmpresaIds.has(t.reservaId) && 
    reservas.some(r => r.id === t.reservaId && (r.estado === 'en-curso'))
  );
  const activoByDriverId = new Map();
  trackingActivos.forEach(t => {
    // preferir el más reciente por si hay múltiples
    const prev = activoByDriverId.get(t.conductorId);
    if (!prev || (t.updatedAt || 0) > (prev.updatedAt || 0)) activoByDriverId.set(t.conductorId, t);
  });

  let visiblesActivosCount = 0;
  visiblesDrivers.forEach(driver => {
    const t = activoByDriverId.get(driver.id) || null;
    const res = t ? reservas.find(r => r.id === t.reservaId) : null;
    const isActive = Boolean(t && t.lat && t.lng);

    const item = document.createElement('div');
    item.className = 'list-item';
    if (!isActive) item.style.opacity = '0.6';
    item.style.cursor = isActive ? 'pointer' : 'not-allowed';

    const titleRow = isActive
      ? `<div class="row"><strong>${driver.nombre}</strong><span class="badge" style="background:#16a34a; color:#fff;">Activo</span><span class="badge">${new Date(t.updatedAt||Date.now()).toLocaleTimeString()}</span></div>`
      : `<div class="row"><strong>${driver.nombre}</strong><span class="badge" style="background:#9ca3af; color:#fff;">Inactivo</span></div>`;

    const bodyLines = isActive
      ? `
        <div>Reserva: #${t.reservaId} • ${res?.origen||''} → ${res?.destino||''}</div>
        <div>Posición: ${t.lat?.toFixed(5)||'-'}, ${t.lng?.toFixed(5)||'-'}</div>
      `
      : `<div class="text-muted">En espera de que el conductor inicie el viaje</div>`;

    item.innerHTML = `${titleRow}${bodyLines}`;

    if (isActive) {
      // marcador en el mapa
      const marker = L.marker([t.lat, t.lng]).addTo(empresaGpsMap).bindPopup(`${driver.nombre}<br/>${res?.origen || ''} → ${res?.destino || ''}`);
      empresaGpsMarkers.push(marker);
      const key = `${t.conductorId}:${t.reservaId}`;
      empresaGpsMarkerByKey[key] = marker;
      item.dataset.key = key;
      item.addEventListener('click', () => {
        const key2 = item.dataset.key;
        const m = empresaGpsMarkerByKey[key2];
        if (m) {
          try {
            const latlng = m.getLatLng();
            empresaGpsMap.setView(latlng, 15);
            m.openPopup();
          } catch {}
        }
      });
      visiblesActivosCount++;
    }

    list.appendChild(item);
  });

  if (countEl) countEl.textContent = `${visiblesActivosCount} activos`;
  if (empresaGpsMarkers.length > 1) {
    const group = L.featureGroup(empresaGpsMarkers);
    try { empresaGpsMap.fitBounds(group.getBounds().pad(0.2)); } catch {}
  } else if (empresaGpsMarkers.length === 1) {
    try { empresaGpsMap.setView(empresaGpsMarkers[0].getLatLng(), 15); } catch {}
  }
}

// eliminado renderEmpresaZonas

function openReservaEmpresa(rutaId) {
  selectedRutaId = rutaId;
  selectedCustomService = null;
  const rutas = storage.get("rutas", []);
  const ruta = rutas.find(r => r.id === rutaId);
  // abrir modal compartido en lugar de panel
  const modal = document.getElementById('clientSharedModal');
  const sum = document.getElementById('clientSharedSummary');
  if (sum && ruta) {
    sum.innerHTML = `
      <div class="row"><strong>${ruta.origen} → ${ruta.destino}</strong><span class="badge">${ruta.horario}</span></div>
      <div><strong>Precio por asiento:</strong> $${ruta.precio}</div>
      <div><strong>Asientos disponibles:</strong> ${ruta.asientos}</div>
    `;
  }
  if (modal) { modal.hidden = false; modal.style.display = 'grid'; }
  window.__pickerTarget = 'shared';
}

function openReserva(rutaId) {
  selectedRutaId = rutaId;
  selectedCustomService = null;
  const rutas = storage.get("rutas", []);
  const ruta = rutas.find(r => r.id === rutaId);
  if (!ruta) return;

  // Rellenar contenido del modal
  const sum = document.getElementById('clientSharedSummary');
  if (sum) {
    sum.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="row"><strong>${ruta.origen} → ${ruta.destino}</strong><span class="badge">${ruta.horario}</span></div>
      <div><strong>Precio por asiento:</strong> $${ruta.precio}</div>
      <div><strong>Asientos disponibles:</strong> ${ruta.asientos}</div>
    `;
    sum.appendChild(item);
  }

  // Limpiar campos del formulario del modal
  const dir = document.getElementById('sharedDireccion');
  const per = document.getElementById('sharedPersonas');
  const eq = document.getElementById('sharedEquipaje');
  if (dir) dir.value = '';
  if (per) per.value = '1';
  if (eq) eq.value = '';

  // Mostrar modal
  const modal = document.getElementById('clientSharedModal');
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

// Funciones específicas para empresa
function renderHistorialEmpresa() {
  const session = getSession();
  const cont = document.getElementById("historialListEmpresa");
  if (!cont) return;
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
    div.innerHTML = `
      <div class="row"><strong>${res.origen} → ${res.destino}</strong><span class="badge">${res.estado}</span></div>
      <div><strong>Servicio:</strong> ${res.servicio} • <strong>Fecha:</strong> ${res.horario}</div>
      <div><strong>Precio total:</strong> $${res.precio}${res.esEmpresa ? ` (Transporte: $${res.precioTransporte || res.precio} + Empresa: $${res.tarifaEmpresa || 0})` : ''}</div>
      <div><strong>Método de pago:</strong> ${res.metodoPago}${res.promo ? ` • <strong>Cupón:</strong> ${res.promo}` : ''}</div>
      ${res.estado === 'recogido' ? `<button class="btn secondary" onclick="calificarViaje(${res.id})">Calificar</button>` : ''}
    `;
    cont.appendChild(div);
  });
}

function renderTrackingForEmpresa() {
  const session = getSession();
  const panel = document.getElementById("trackingPanelEmpresa");
  if (!panel) return;
  const myActive = storage.get("reservas", []).filter(r => 
    r.clienteId === session?.id && 
    (r.estado === "en-curso" || (r.estado === "pendiente" && r.enCurso))
  );
  
  if (myActive.length === 0) { panel.hidden = true; return; }
  const tracking = storage.get("tracking", []);
  const info = document.getElementById("trackingInfoEmpresa");
  info.innerHTML = "";
  myActive.forEach(r => {
    const t = tracking.find(t => t.reservaId === r.id);
    const div = document.createElement("div");
    div.className = "list-item";
    if (t) {
      div.textContent = `${r.origen} → ${r.destino} • Posición: ${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}`;
    } else {
      div.textContent = `${r.origen} → ${r.destino} • Esperando actualización de posición`;
    }
    info.appendChild(div);
  });
  panel.hidden = false;
}

function populateOrigenOptionsEmpresa() {
  const session = getSession();
  if (!session) return;
  
  const select = document.getElementById('csOrigenSelectEmpresa');
  if (!select) return;
  
  select.innerHTML = `
    <option value="mi-direccion">Mi dirección</option>
    <option value="favoritas">Favoritas</option>
    <option value="nueva">Nueva dirección</option>
  `;
}

function wireOrigenPickerEmpresa() {
  const select = document.getElementById('csOrigenSelectEmpresa');
  const mapBtn = document.getElementById('csOrigenMapBtnEmpresa');
  
  if (select) {
    select.addEventListener('change', () => {
      if (mapBtn) mapBtn.style.display = select.value === 'nueva' ? 'block' : 'none';
    });
  }
  
  if (mapBtn) {
    mapBtn.addEventListener('click', () => {
      window.__pickerTarget = 'origin';
      openPicker();
    });
  }
}

// Mis Viajes (Empresa)
function renderMisViajesEmpresa() {
  const session = getSession();
  
  if (!session || (session.role !== "empresa" && session.role !== "cliente_empresa")) {
    const p = document.getElementById("viajesPendientesListEmpresa"); if (p) p.innerHTML = "<div class='text-muted'>Inicie sesión para ver sus viajes</div>";
    const c = document.getElementById("viajesConfirmadosListEmpresa"); if (c) c.innerHTML = "<div class='text-muted'>Inicie sesión para ver sus viajes</div>";
    const e = document.getElementById("viajesEnCursoListEmpresa"); if (e) e.innerHTML = "<div class='text-muted'>Inicie sesión para ver sus viajes</div>";
    return;
  }

  const reservas = storage.get("reservas", [])
    .filter(r => r.clienteId === session.id)
    .sort((a, b) => b.id - a.id);

  // Pendientes (solicitados/pendientes)
  const pendientes = reservas.filter(r => r.estado === "pendiente" && !r.recogido);
  renderViajesEnContenedorEmpresa("viajesPendientesListEmpresa", pendientes, "pendiente");

  // Confirmados
  const confirmados = reservas.filter(r => r.estado === "confirmada");
  renderViajesEnContenedorEmpresa("viajesConfirmadosListEmpresa", confirmados, "confirmado");

  // En curso
  const enCurso = reservas.filter(r => r.estado === "en-curso" || (r.estado === "pendiente" && r.enCurso));
  renderViajesEnContenedorEmpresa("viajesEnCursoListEmpresa", enCurso, "en-curso");
}

function renderViajesEnContenedorEmpresa(containerId, viajes, tipo) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  
  if (viajes.length === 0) {
    let mensaje = 'No hay viajes';
    if (tipo === 'pendiente') mensaje = 'No hay viajes pendientes';
    else if (tipo === 'confirmado') mensaje = 'No hay viajes confirmados';
    else if (tipo === 'en-curso') mensaje = 'No hay viajes en curso';
    cont.innerHTML = `<div class="text-muted">${mensaje}</div>`;
    return;
  }
  
  cont.innerHTML = "";
  viajes.forEach(v => {
    const div = document.createElement("div");
    div.className = "list-item";
    const estadoTexto = tipo === 'en-curso' ? 'En curso' : (tipo === 'confirmado' ? 'Confirmado' : 'Pendiente');
    div.innerHTML = `
      <div class="row"><strong>${v.origen} → ${v.destino}</strong><span class="badge">${estadoTexto}</span></div>
      <div><strong>Servicio:</strong> ${v.servicio || '-'} • <strong>Horario:</strong> ${v.horario || '-'}</div>
      <div><strong>Precio total:</strong> $${v.precio}${v.esEmpresa ? ` (Transporte: $${v.precioTransporte || v.precio} + Empresa: $${v.tarifaEmpresa || 0})` : ''}</div>
      <div><strong>Dirección:</strong> ${v.direccion || '-'}</div>
      ${tipo === 'pendiente' ? `<button class="btn secondary" onclick="cancelarViaje(${v.id})">Cancelar</button>` : ''}
      ${tipo === 'en-curso' ? `<button class="btn primary" onclick="verTrackingViaje(${v.id})">Ver Tracking</button>` : ''}
    `;
    cont.appendChild(div);
  });
}

function wireEmpresaViajesTabs() {
  const scope = document.getElementById('tab-mis-viajes-empresa');
  if (!scope) return;
  const buttons = scope.querySelectorAll('.viajes-tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-status');
      scope.querySelectorAll('.viajes-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      scope.querySelectorAll('.viajes-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`empresa-viajes-${status}`);
      if (panel) panel.classList.add('active');
      renderMisViajesEmpresa();
    });
  });
}

// Mis Viajes (Cliente)
function renderMisViajes() {
  const session = getSession();
  
  if (!session || (session.role !== "cliente" && session.role !== "empresa")) {
    document.getElementById("viajesPendientesList").innerHTML = "<div class='text-muted'>Inicie sesión para ver sus viajes</div>";
    const ec = document.getElementById("viajesEnCursoList"); if (ec) ec.innerHTML = "<div class='text-muted'>Inicie sesión para ver sus viajes</div>";
    const cf = document.getElementById("viajesConfirmadosList"); if (cf) cf.innerHTML = "<div class='text-muted'>Inicie sesión para ver sus viajes</div>";
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

  // Viajes confirmados (confirmada por admin/operador, aún no en curso)
  const confirmados = reservas.filter(r => r.estado === "confirmada");
  renderViajesEnContenedor("viajesConfirmadosList", confirmados, "confirmado");

  // Tracking en tiempo real
  renderTrackingCliente();
}

function renderViajesEnContenedor(containerId, reservas, tipo) {
  const cont = document.getElementById(containerId);
  cont.innerHTML = "";
  
  if (reservas.length === 0) {
    let mensaje = "No tienes viajes";
    if (tipo === "pendiente") mensaje = "No tienes viajes pendientes";
    else if (tipo === "en-curso") mensaje = "No tienes viajes en curso";
    else if (tipo === "confirmado") mensaje = "No tienes viajes confirmados";
    cont.innerHTML = `<div class='text-muted'>${mensaje}</div>`;
    return;
  }
  
  reservas.forEach(res => {
    const div = document.createElement("div");
    div.className = "list-item";
    
    const fechaCreacion = new Date(res.id).toLocaleDateString('es-ES');
  const estadoTexto = tipo === "en-curso" ? "En curso" : (tipo === "confirmado" ? "Confirmado" : "Pendiente");
  const estadoBadge = tipo === "en-curso" ? "warn" : (tipo === "confirmado" ? "success" : "muted");
    
    let actionButtons = "";
  if (tipo === "pendiente") {
      actionButtons = `
        <div class="row" style="gap: 8px;">
          <button class="btn secondary detailViajeBtn" data-id="${res.id}">Ver detalles</button>
          <button class="btn danger cancelViajeBtn" data-id="${res.id}">Cancelar</button>
        </div>
      `;
  } else if (tipo === "confirmado") {
    actionButtons = `
      <div class="row" style="gap: 8px;">
        <button class="btn secondary detailViajeBtn" data-id="${res.id}">Ver detalles</button>
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

// Función para agregar marcadores de puntos de interés en el mapa de tracking
function addTrackingMarkers() {
  if (!window.__clienteTrackingMap) return;
  
  // Marcadores de ubicaciones comunes en Ecuador
  const locations = [
    {
      name: "Quito Centro",
      coords: [-0.1807, -78.4678],
      type: "city",
      icon: "🏛️"
    },
    {
      name: "Aeropuerto Mariscal Sucre",
      coords: [-0.1411, -78.4882],
      type: "airport",
      icon: "✈️"
    },
    {
      name: "Terminal Terrestre Quitumbe",
      coords: [-0.3247, -78.5665],
      type: "terminal",
      icon: "🚌"
    }
  ];
  
  locations.forEach(location => {
    const icon = L.divIcon({
      className: 'location-marker',
      html: `<div class="location-icon">${location.icon}</div>`,
      iconSize: [25, 25],
      iconAnchor: [12, 12]
    });
    
    L.marker(location.coords, { icon })
      .addTo(window.__clienteTrackingMap)
      .bindPopup(`<strong>${location.icon} ${location.name}</strong><br/>${location.type}`);
  });
}

function renderTrackingCliente() {
  const session = getSession();
  const panel = document.getElementById("trackingClienteInfo");
  if (!panel) return;
  const msgEl = document.getElementById('trackingClienteMsg');
  const mapEl = document.getElementById('trackingClienteMap');

  // Inicializar el mapa siempre que exista el contenedor
  if (mapEl && !window.__clienteTrackingMap && typeof L !== 'undefined') {
    try {
      window.__clienteTrackingMap = L.map('trackingClienteMap', {
        zoomControl: true,
        attributionControl: true
      }).setView([-0.1807, -78.4678], 12);
      
      // Usar un tile layer más moderno y con mejor rendimiento
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(window.__clienteTrackingMap);
      
      // Agregar marcadores de ejemplo para puntos de interés
      addTrackingMarkers();
      
      setTimeout(() => { 
        try { 
          window.__clienteTrackingMap.invalidateSize(); 
        } catch {} 
      }, 100);
    } catch (e) {
      console.warn('Error inicializando mapa de tracking:', e);
    }
  }
  
  if (!session || session.role !== "cliente") {
    panel.innerHTML = "<div class='text-muted'>Inicie sesión para ver el tracking</div>";
    return;
  }
  
  // Agregar botón de demostración para crear una reserva de ejemplo
  const demoBtn = document.createElement('button');
  demoBtn.className = 'btn secondary';
  demoBtn.innerHTML = '🚀 Crear viaje de demostración';
  demoBtn.style.marginBottom = '12px';
  demoBtn.addEventListener('click', createDemoReservation);
  panel.appendChild(demoBtn);

  const myActive = storage.get("reservas", []).filter(r => 
    r.clienteId === session.id && 
    (r.estado === "en-curso" || (r.estado === "pendiente" && r.enCurso))
  );
  
  if (myActive.length === 0) {
    panel.innerHTML = "<div class='text-muted'>No hay viajes activos para rastrear</div>";
    if (msgEl) msgEl.textContent = 'Cuando un conductor sea asignado podrás ver su ubicación en este mapa.';
    // invalida tamaño por si la pestaña se acaba de activar
    if (window.__clienteTrackingMap) setTimeout(() => { try { window.__clienteTrackingMap.invalidateSize(); } catch {} }, 80);
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

  // Mensaje contextual y mapa
  const anyAssigned = myActive.some(r => !!r.conductorId);
  const anyTracking = myActive.some(r => tracking.find(t => t.reservaId === r.id));
  
  if (msgEl) {
    if (!anyAssigned) {
      msgEl.textContent = 'Aún no hay conductor asignado a tus viajes.';
      msgEl.className = 'msg warning';
    } else if (anyTracking) {
      msgEl.textContent = 'El conductor está en camino. Visualizando posición en el mapa.';
      msgEl.className = 'msg success';
    } else {
      msgEl.textContent = 'Conductor asignado. Esperando señal GPS...';
      msgEl.className = 'msg info';
    }
  }

  // Actualizar el mapa con información de tracking
  if (mapEl && window.__clienteTrackingMap) {
    try {
      // Limpiar marcadores anteriores
      if (window.__clienteTrackingMarkers) {
        window.__clienteTrackingMarkers.forEach(marker => {
          window.__clienteTrackingMap.removeLayer(marker);
        });
      }
      window.__clienteTrackingMarkers = [];

      const withT = myActive.map(r => ({ r, t: tracking.find(t => t.reservaId === r.id) })).filter(x => !!x.t);
      
      if (withT.length > 0) {
        // Mostrar tracking de viajes activos
        withT.forEach(({ r, t }) => {
          // Marcador del conductor
          const conductorIcon = L.divIcon({
            className: 'conductor-marker',
            html: '<div class="conductor-icon">🚗</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          
          const conductorMarker = L.marker([t.lat, t.lng], { icon: conductorIcon })
            .addTo(window.__clienteTrackingMap)
            .bindPopup(`
              <div class="popup-content">
                <strong>🚗 Conductor en camino</strong><br/>
                <strong>Ruta:</strong> ${r.origen} → ${r.destino}<br/>
                <strong>Estado:</strong> ${r.estado}<br/>
                <strong>Última actualización:</strong> ${new Date(t.updatedAt).toLocaleTimeString()}
              </div>
            `);
          
          window.__clienteTrackingMarkers.push(conductorMarker);
        });

        // Centrar el mapa en el primer marcador
        const firstMarker = withT[0];
        window.__clienteTrackingMap.setView([firstMarker.t.lat, firstMarker.t.lng], 14);
      } else {
        // Si no hay tracking activo, mostrar ubicación por defecto de Quito
        window.__clienteTrackingMap.setView([-0.1807, -78.4678], 12);
      }
      
      setTimeout(() => { try { window.__clienteTrackingMap.invalidateSize(); } catch {} }, 100);
    } catch (e) {
      console.warn('Error actualizando mapa de tracking:', e);
    }
  }
}

// Función para simular actualizaciones de tracking en tiempo real
function simulateTrackingUpdates() {
  const tracking = storage.get("tracking", []);
  const reservas = storage.get("reservas", []);
  const session = getSession();
  
  if (!session || session.role !== "cliente") return;
  
  // Solo simular si hay viajes activos del cliente
  const myActive = reservas.filter(r => 
    r.clienteId === session.id && 
    (r.estado === "en-curso" || (r.estado === "pendiente" && r.enCurso))
  );
  
  if (myActive.length === 0) return;
  
  // Simular movimiento del conductor para cada viaje activo
  myActive.forEach(reserva => {
    let trackingData = tracking.find(t => t.reservaId === reserva.id);
    
    if (!trackingData) {
      // Crear nuevo tracking si no existe
      trackingData = {
        conductorId: reserva.conductorId,
        reservaId: reserva.id,
        lat: -0.1807 + (Math.random() - 0.5) * 0.01, // Variación pequeña
        lng: -78.4678 + (Math.random() - 0.5) * 0.01,
        updatedAt: Date.now()
      };
      tracking.push(trackingData);
    } else {
      // Actualizar posición existente con movimiento simulado
      const movement = 0.001; // Movimiento pequeño
      trackingData.lat += (Math.random() - 0.5) * movement;
      trackingData.lng += (Math.random() - 0.5) * movement;
      trackingData.updatedAt = Date.now();
    }
  });
  
  // Guardar tracking actualizado
  storage.set("tracking", tracking);
  
  // Re-renderizar el tracking
  renderTrackingCliente();
}

// Iniciar simulación de tracking cada 10 segundos
let trackingInterval = null;

function startTrackingSimulation() {
  if (trackingInterval) return;
  
  trackingInterval = setInterval(() => {
    simulateTrackingUpdates();
  }, 10000); // Cada 10 segundos
}

function stopTrackingSimulation() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
}

// Función para crear una reserva de demostración con tracking
function createDemoReservation() {
  const session = getSession();
  if (!session || session.role !== "cliente") return;
  
  const reservas = storage.get("reservas", []);
  const tracking = storage.get("tracking", []);
  
  // Crear una nueva reserva de demostración
  const demoReservation = {
    id: Date.now(),
    clienteId: session.id,
    conductorId: 2, // Carlos Ruiz
    origen: "Quito Centro",
    destino: "Aeropuerto Mariscal Sucre",
    estado: "en-curso",
    enCurso: true,
    fecha: new Date().toISOString(),
    precio: 15,
    metodoPago: "efectivo"
  };
  
  // Agregar la reserva
  reservas.push(demoReservation);
  storage.set("reservas", reservas);
  
  // Crear datos de tracking iniciales
  const demoTracking = {
    conductorId: 2,
    reservaId: demoReservation.id,
    lat: -0.1807,
    lng: -78.4678,
    updatedAt: Date.now()
  };
  
  tracking.push(demoTracking);
  storage.set("tracking", tracking);
  
  // Re-renderizar todo
  renderMisViajes();
  renderTrackingCliente();
  
  toast("¡Viaje de demostración creado! Observa el mapa para ver el tracking en tiempo real.", "success");
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
          <div class=\"value\">${cliente}${r.esEmpresa ? ` (${r.nombreEmpresa})` : ''}</div>
          <div class=\"label\">Servicio</div>
          <div class=\"value\">${r.servicio} • ${r.tipo}</div>
          <div class=\"label\">Método de pago</div>
          <div class=\"value\">${r.metodoPago || 'No especificado'}</div>
          ${r.promo ? `<div class=\"label\">Cupón</div><div class=\"value\">${r.promo}</div>` : ''}
          ${r.esEmpresa ? `<div class=\"label\">Precio transporte</div><div class=\"value\">$${r.precioTransporte || r.precio}</div>` : ''}
          ${r.esEmpresa ? `<div class=\"label\">Tarifa empresa</div><div class=\"value\">$${r.tarifaEmpresa || 0}</div>` : ''}
          ${typeof r.precio !== 'undefined' ? `<div class=\"label\">Precio total</div><div class=\"value\">$${r.precio}</div>` : ''}
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
  // si empresa GPS está visible, refrescar
  if (views.empresa.classList.contains('active')) {
    const activeTab = document.querySelector('#view-empresa .tab-btn.active')?.getAttribute('data-tab');
    if (activeTab === 'gps') renderEmpresaGps(document.getElementById('empresaGpsFilter')?.value?.trim()||'');
  }
  toast("Viaje cambiado a Finalizado");
}

// Admin
function renderAdmin() {
  const reservas = storage.get("reservas", []);
  const rutas = storage.get("rutas", []);
  const flota = storage.get("flota", []);
  const zonas = storage.get('zonas', []);
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
  const kpiReservasEl = document.getElementById("kpiReservas");
  if (kpiReservasEl) kpiReservasEl.textContent = reservas.length;
  const kpiFlotaEl = document.getElementById("kpiFlota");
  if (kpiFlotaEl) kpiFlotaEl.textContent = flota.length;
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

  const opPend = document.getElementById("opPendientes"); if (opPend) opPend.textContent = pendientes;
  const opCurso = document.getElementById("opEnCurso"); if (opCurso) opCurso.textContent = enCurso;
  const opComp = document.getElementById("opCompletadosHoy"); if (opComp) opComp.textContent = completadosHoy;

  const rutasCont = document.getElementById("adminRutas");
  if (rutasCont) {
    rutasCont.innerHTML = "";
    rutas.slice().sort((a,b)=> b.id - a.id).forEach(r => {
      const zonaLabel = (r.provincia && r.ciudad) ? `${r.provincia} / ${r.ciudad}` : 'Sin zona';
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div class="row" style="justify-content: space-between; gap:8px; align-items:center;">
          <div style="min-width:0;">
            <div><strong>${r.origen} → ${r.destino}</strong> • ${r.horario}</div>
            <div class="text-muted" style="font-size:12px">${zonaLabel} • Precio: $${Number(r.precio).toFixed(2)} • Asientos: ${r.asientos}</div>
          </div>
          <div class="row" style="gap:6px;">
            <button class="btn secondary" data-act="edit-ruta" data-id="${r.id}">Editar</button>
            <button class="btn danger" data-act="del-ruta" data-id="${r.id}">Eliminar</button>
          </div>
        </div>`;
      rutasCont.appendChild(div);
    });
    rutasCont.querySelectorAll('button[data-act]')?.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const act = btn.getAttribute('data-act');
        if (act === 'del-ruta') deleteRuta(id);
        else if (act === 'edit-ruta') openEditarRuta(id);
      });
    });
  }

  // Flota - Rediseñado
  const flotaCont = document.getElementById("adminFlota");
  if (flotaCont) flotaCont.innerHTML = "";
  const displayFlota = [...flota, ...mockFlota];
  
  if (flotaCont) {
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
      const meta = p.type === 'cupon' ? `${p.discountPct ?? 0}%` : `$${Number(p.balance ?? 0).toFixed(2)}`;
      div.innerHTML = `
        <div class="item-main">
          <div class="item-title">${p.code}</div>
          <div class="item-meta">${p.type === 'cupon' ? 'Cupón' : 'Voucher'} · ${meta}</div>
        </div>
        <div class="item-actions">
          <button class="btn secondary" onclick="editPromo('${p.code.replace(/'/g, "&#39;")}')">✏️ Editar</button>
          <button class="btn danger" onclick="deletePromo('${p.code.replace(/'/g, "&#39;")}')">🗑️ Eliminar</button>
        </div>
      `;
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
  // Zonas eliminadas

  // dentro de renderAdmin(), después de KPIs y otros renders, añadimos:
  const resFilterBtns = document.querySelectorAll('.res-filter-btn');
  resFilterBtns.forEach(b => b.classList.remove('active'));
  const first = document.querySelector('.res-filter-btn[data-filter="pendiente"]');
  first?.classList.add('active');
  renderAdminReservas('pendiente');
}

// ==========================
// Admin: Cupones y Vouchers (CRUD)
// ==========================
function renderPromosList() {
  const list = document.getElementById('adminPromos');
  if (!list) return;
  const promos = storage.get('promos', []);
  if (!Array.isArray(promos) || promos.length === 0) {
    list.innerHTML = '<div class="empty-state">🎟️ No hay promociones</div>';
    return;
  }
  list.innerHTML = '';
  promos.forEach(p => {
    const div = document.createElement('div');
    div.className = 'list-item';
    const meta = p.type === 'cupon' ? `${p.discountPct ?? 0}%` : `$${Number(p.balance ?? 0).toFixed(2)}`;
    div.innerHTML = `
      <div class="item-main">
        <div class="item-title">${p.code}</div>
        <div class="item-meta">${p.type === 'cupon' ? 'Cupón' : 'Voucher'} · ${meta}</div>
      </div>
      <div class="item-actions">
        <button class="btn secondary" onclick="editPromo('${p.code.replace(/'/g, "&#39;")}')">✏️ Editar</button>
        <button class="btn danger" onclick="deletePromo('${p.code.replace(/'/g, "&#39;")}')">🗑️ Eliminar</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function setPromoFormMode(mode) {
  const submitBtn = document.getElementById('promoSubmit');
  const cancelBtn = document.getElementById('promoCancelEdit');
  const form = document.getElementById('promoForm');
  if (!submitBtn || !form || !cancelBtn) return;
  if (mode === 'edit') {
    submitBtn.textContent = 'Actualizar';
    cancelBtn.style.display = '';
  } else {
    submitBtn.textContent = 'Agregar';
    cancelBtn.style.display = 'none';
    form.removeAttribute('data-editing');
  }
}

function onPromoTypeChange() {
  const tipo = document.getElementById('promoTipo');
  const descuento = document.getElementById('promoDescuento');
  const balance = document.getElementById('promoBalance');
  if (!tipo || !descuento || !balance) return;
  if (tipo.value === 'cupon') {
    descuento.style.display = '';
    descuento.required = true;
    balance.style.display = 'none';
    balance.required = false;
  } else {
    descuento.style.display = 'none';
    descuento.required = false;
    balance.style.display = '';
    balance.required = true;
  }
}

function initAdminPromos() {
  const form = document.getElementById('promoForm');
  const tipo = document.getElementById('promoTipo');
  const cancelar = document.getElementById('promoCancelEdit');
  const nuevo = document.getElementById('promoNuevoBtn');
  if (!form || !tipo) return;
  onPromoTypeChange();
  tipo.addEventListener('change', onPromoTypeChange);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('promoCodigo')?.value.trim();
    const discountPct = Number(document.getElementById('promoDescuento')?.value || 0);
    const balance = Number(document.getElementById('promoBalance')?.value || 0);
    if (!code) { toast('Ingrese un código'); return; }
    const promos = storage.get('promos', []);
    const editing = form.getAttribute('data-editing');
    if (tipo.value === 'cupon') {
      if (!(discountPct > 0 && discountPct <= 100)) { toast('Descuento inválido (1-100)'); return; }
    } else if (tipo.value === 'voucher') {
      if (!(balance >= 0)) { toast('Saldo inválido'); return; }
    }
    const idx = promos.findIndex(p => p.code.toLowerCase() === code.toLowerCase());
    if (!editing) {
      if (idx >= 0) { toast('El código ya existe'); return; }
      const newPromo = tipo.value === 'cupon' ? { type: 'cupon', code, discountPct } : { type: 'voucher', code, balance };
      promos.push(newPromo);
    } else {
      // Modo edición
      const oldIdx = promos.findIndex(p => p.code === editing);
      if (oldIdx >= 0) {
        promos[oldIdx] = tipo.value === 'cupon' ? { type: 'cupon', code, discountPct } : { type: 'voucher', code, balance };
      } else {
        // Si no se encontró, actuar como inserción
        const newPromo = tipo.value === 'cupon' ? { type: 'cupon', code, discountPct } : { type: 'voucher', code, balance };
        promos.push(newPromo);
      }
    }
    storage.set('promos', promos);
    form.reset();
    setPromoFormMode('add');
    onPromoTypeChange();
    renderPromosList();
    toast('Promoción guardada');
  });
  cancelar?.addEventListener('click', () => {
    form.reset();
    setPromoFormMode('add');
    onPromoTypeChange();
  });
  nuevo?.addEventListener('click', () => {
    form.reset();
    setPromoFormMode('add');
    onPromoTypeChange();
    document.getElementById('promoCodigo')?.focus();
  });
  renderPromosList();
}

function editPromo(code) {
  const promos = storage.get('promos', []);
  const p = promos.find(x => x.code === code);
  if (!p) { toast('Promoción no encontrada'); return; }
  const form = document.getElementById('promoForm');
  const tipo = document.getElementById('promoTipo');
  if (!form || !tipo) return;
  tipo.value = p.type;
  onPromoTypeChange();
  document.getElementById('promoCodigo').value = p.code;
  const desc = document.getElementById('promoDescuento');
  const bal = document.getElementById('promoBalance');
  if (p.type === 'cupon') { if (desc) desc.value = String(p.discountPct ?? 0); if (bal) bal.value = ''; }
  else { if (bal) bal.value = String(p.balance ?? 0); if (desc) desc.value = ''; }
  form.setAttribute('data-editing', p.code);
  setPromoFormMode('edit');
}

function deletePromo(code) {
  const promos = storage.get('promos', []);
  const next = promos.filter(p => p.code !== code);
  storage.set('promos', next);
  renderPromosList();
  toast('Promoción eliminada');
}

try {
  window.initAdminPromos = initAdminPromos;
  window.editPromo = editPromo;
  window.deletePromo = deletePromo;
} catch {}

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
  document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
  document.getElementById("registerForm")?.addEventListener("submit", handleRegister);
  document.getElementById("registerFormStandalone")?.addEventListener("submit", handleRegister);
  document.getElementById("reservaForm")?.addEventListener("submit", handleReserva);
  document.getElementById("rutaForm")?.addEventListener("submit", handleAddRuta);
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    clearSession();
    updateSessionUi();
    const path = window.location.pathname.replace(/\\/g, '/');
    const target = path.includes('/views/') ? '../../index.html' : 'index.html';
    window.location.href = target;
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
      if (tab === 'promos') { try { initAdminPromos(); } catch {} }
      // zonas eliminadas
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

  // empresa tabs
  document.querySelectorAll('#view-empresa .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      document.querySelectorAll('#view-empresa .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#view-empresa .tab-panel').forEach(p => p.classList.remove('active'));
      
      // Mapear los nombres de pestañas a los IDs correctos
      let panelId;
      if (tab === 'servicios') panelId = 'tab-servicios';
      else if (tab === 'mis-viajes') panelId = 'tab-mis-viajes-empresa';
      else if (tab === 'historial') panelId = 'tab-historial-empresa';
      
      const panel = document.getElementById(panelId);
      if (panel) panel.classList.add('active');
      
      // Actualizar contenido según la pestaña
      if (tab === 'historial') {
        renderHistorialEmpresa();
      } else if (tab === 'mis-viajes') {
        renderMisViajesEmpresa();
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
  // Soporta duplicidad de IDs en formularios (usando ámbito del form)
  [document.getElementById('registerForm'), document.getElementById('registerFormStandalone')]
    .filter(Boolean)
    .forEach(form => {
      const fotoBtn = form.querySelector('[id="regFotoBtn"]');
      const fotoInput = form.querySelector('[id="regFoto"]');
      const fotoPreview = form.querySelector('[id="regFotoPreview"]');
      fotoBtn?.addEventListener('click', () => fotoInput?.click());
      fotoInput?.addEventListener('change', () => {
        const file = fotoInput.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast('La imagen supera 2MB'); fotoInput.value = ''; return; }
        const reader = new FileReader();
        reader.onload = () => {
          if (fotoPreview) {
            fotoPreview.src = String(reader.result);
            fotoPreview.hidden = false;
          }
        };
        reader.readAsDataURL(file);
      });
    });

  // Mostrar/ocultar campo de empresa según tipo de cliente (soporta ambos formularios)
  const tipoClienteSelects = Array.from(document.querySelectorAll('[id="regTipoCliente"]'));
  function toggleEmpresaFieldFor(selectEl) {
    try {
      const form = selectEl.closest('form');
      const wrapper = form?.querySelector('[id="regNombreEmpresaWrapper"]');
      if (!wrapper) return;
      const isEmpresa = (selectEl.value || 'cliente') === 'empresa';
      wrapper.style.display = isEmpresa ? '' : 'none';
    } catch {}
  }
  tipoClienteSelects.forEach(sel => {
    toggleEmpresaFieldFor(sel);
    sel.addEventListener('change', () => toggleEmpresaFieldFor(sel));
  });

  // map picker
  const openMapPickerBtns = Array.from(document.querySelectorAll('#openMapPicker, #openMapPicker2'));
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
    } else if (window.__pickerTargetInput) {
      // Manejar todos los campos de entrada específicos
      const input = document.getElementById(window.__pickerTargetInput);
      const address = addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (input) input.value = address;
      window.__pickerTarget = null;
      window.__pickerTargetInput = null;
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
  
  // P2P calculation method change
  const metodoCalculoP2P = document.getElementById("csMetodoCalculoP2P");
  if (metodoCalculoP2P) {
    metodoCalculoP2P.addEventListener("change", onP2PMetodoChange);
  }
  
  // P2P zone selection change
  const zonaP2P = document.getElementById("csZonaP2P");
  if (zonaP2P) {
    zonaP2P.addEventListener("change", onP2PZonaChange);
  }
  
  // P2P fields change for price calculation
  const p2pFields = ["csPersonasP2P", "csTipoVehiculoP2P", "csOrigen", "csDestino"];
  p2pFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener("input", calculateP2PPrice);
      field.addEventListener("change", calculateP2PPrice);
    }
  });

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
  // Solo en pestaña Usuarios
  document.getElementById('addFlotaBtn')?.addEventListener('click', () => {
    showView('admin-vehicle-new');
  });

  // admin create user form
  const auForm = document.getElementById('adminCreateUserForm');
  if (auForm) {
    document.getElementById('auBack')?.addEventListener('click', () => {
      showView('admin');
      renderAdmin();
    });
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
/* function renderAdminZonas() {
  const cont = document.getElementById('adminZonas');
  if (!cont) return;
  const zonas = storage.get('zonas', []);
  cont.innerHTML = '';
  if (!zonas.length) {
    cont.innerHTML = "<div class='text-muted'>Sin zonas configuradas</div>";
  } else {
    zonas.forEach(z => {
      const item = document.createElement('div');
      item.className = 'admin-list-item';
      item.innerHTML = `
        <div><strong>${z.provincia || '-'} - ${z.ciudad || '-'}</strong></div>
        <div>Precio base: $${Number(z.precio).toFixed(2)} • Extra fuera de zona: $${Number(z.extra).toFixed(2)}</div>
        <div class="row" style="gap:8px;">
          <button class="btn secondary" data-id="${z.id}" data-act="edit-zona">Editar</button>
          <button class="btn danger" data-id="${z.id}" data-act="del-zona">Eliminar</button>
        </div>
      `;
      cont.appendChild(item);
    });
  }

  const form = document.getElementById('zonaForm');
  const msg = document.getElementById('zonaMsg');
  const provSel = document.getElementById('zonaProvincia');
  const citySel = document.getElementById('zonaCiudad');

  // Provincias y ciudades desde archivo jsonProvincias
  let EC = null;
  try {
    const raw = document.getElementById('jsonProvinciaCache')?.textContent;
    if (raw) {
      EC = JSON.parse(raw);
    }
  } catch {}
  const populateFromData = (data) => {
    if (!data?.provincias) return;
    if (provSel && provSel.options.length <= 1) {
      data.provincias.forEach(p => {
        const o = document.createElement('option');
        o.value = p.nombre; o.textContent = p.nombre; provSel.appendChild(o);
      });
    }
  };
  if (!EC) {
    // fallback: intentar fetch del archivo local
    fetch(asset('jsonProvincias')).then(r => r.json()).then(data => { EC = data; populateFromData(data); updateCities(); }).catch(()=>{
      EC = { provincias: [] };
      updateCities();
    });
  } else { populateFromData(EC); }
  // actualizar ciudades según provincia
  const updateCities = () => {
    if (!citySel) return;
    citySel.innerHTML = '<option value="">Ciudad...</option>';
    const p = provSel.value;
    const prov = EC?.provincias?.find(x => x.nombre === p);
    (prov?.ciudades || []).forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; citySel.appendChild(o); });
  };
  provSel?.addEventListener('change', updateCities);
  updateCities();
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const provincia = provSel.value;
    const ciudad = citySel.value;
    const precio = Number(document.getElementById('zonaPrecio').value);
    const extra = Number(document.getElementById('zonaExtra').value);
    if (!provincia || !ciudad || isNaN(precio) || isNaN(extra)) { msg.textContent = 'Completa todos los campos'; return; }
    let zonas = storage.get('zonas', []);
    const idx = zonas.findIndex(z => (z.provincia||'').toLowerCase() === provincia.toLowerCase() && (z.ciudad||'').toLowerCase() === ciudad.toLowerCase());
    if (idx >= 0) zonas[idx] = { ...zonas[idx], provincia, ciudad, precio, extra };
    else zonas.push({ id: Date.now(), provincia, ciudad, precio, extra });
    storage.set('zonas', zonas);
    (document.getElementById('zonaForm')).reset();
    msg.textContent = 'Zona guardada';
    renderAdminZonas();
  });

  cont.querySelectorAll('button[data-act]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-id'));
      const act = btn.getAttribute('data-act');
      let zonas = storage.get('zonas', []);
      if (act === 'del-zona') {
        zonas = zonas.filter(z => z.id !== id);
        storage.set('zonas', zonas);
        renderAdminZonas();
      } else if (act === 'edit-zona') {
        const z = zonas.find(z => z.id === id);
        if (z) {
          provSel.value = z.provincia || '';
          updateCities();
          citySel.value = z.ciudad || '';
          document.getElementById('zonaPrecio').value = z.precio;
          document.getElementById('zonaExtra').value = z.extra;
        }
      }
    });
  });
} */

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

  // Inicializar CRUD de promociones si la pestaña está activa
  if (document.querySelector('#tab-promos')?.classList.contains('active')) {
    try { initAdminPromos(); } catch {}
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
  const session = getSession();
  
  // Si estamos en contexto de empresa, buscar clientes de empresa
  if (session && session.role === 'empresa') {
    const allClientes = [
      ...users.filter(u => u.role === 'cliente_empresa' && u.empresa === session.empresa),
      ...mockClients
        .filter(m => m.empresa === session.empresa)
        .map(m => ({ ...m, role: 'cliente_empresa' }))
    ];
    const cliente = allClientes.find(c => c.id === clienteId);
    if (cliente) {
      mostrarVerClienteModal(cliente);
      return;
    }
  }
  
  // Fallback para clientes regulares (admin)
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

function mostrarVerClienteModal(cliente) {
  const reservas = storage.get("reservas", []);
  const misReservas = reservas.filter(r => r.clienteId === cliente.id);
  const completadas = misReservas.filter(r => r.estado === 'recogido');
  const pendientes = misReservas.filter(r => !r.conductorId);
  const gastoTotal = misReservas.reduce((sum, r) => sum + (Number(r.precio) || 0), 0);
  const rated = misReservas.filter(r => typeof r.rating === 'number');
  const avgRating = rated.length ? (rated.reduce((a,b)=>a+b.rating,0)/rated.length).toFixed(1) : null;

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
        ${cliente.empresa ? `
        <div class="view-detail-item">
          <div class="view-detail-label">Empresa</div>
          <div class="view-detail-value">${cliente.empresa}</div>
        </div>
        ` : ''}
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
  const session = getSession();
  
  // Si estamos en contexto de empresa, buscar clientes de empresa
  if (session && session.role === 'empresa') {
    const allClientes = [
      ...users.filter(u => u.role === 'cliente_empresa' && u.empresa === session.empresa),
      ...mockClients
        .filter(m => m.empresa === session.empresa)
        .map(m => ({ ...m, role: 'cliente_empresa' }))
    ];
    const cliente = allClientes.find(c => c.id === clienteId);
    if (cliente) {
      mostrarEditarClienteModal(cliente);
      return;
    }
  }
  
  // Fallback para clientes regulares (admin)
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

function mostrarEditarClienteModal(cliente) {
  // Pre-llenar el formulario
  document.getElementById('ecNombre').value = cliente.nombre || '';
  document.getElementById('ecCedula').value = cliente.cedula || '';
  document.getElementById('ecEmail').value = cliente.email || '';
  document.getElementById('ecTelefono').value = cliente.telefono || '';
  document.getElementById('ecDireccion').value = cliente.direccion || '';

  // Guardar el ID para usar en confirmar
  document.getElementById('editarClienteForm').dataset.clienteId = cliente.id;

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
  const empresaView = document.getElementById('tab-clientes-empresa');
  if (empresaView) { renderEmpresaClientes(); }
  else { renderAdmin(); }
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
    const empresaView = document.getElementById('tab-clientes-empresa');
    if (empresaView) { renderEmpresaClientes(); }
    else { renderAdmin(); }
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
  const provOri = document.getElementById('rutaProvinciaOrigen')?.value || '';
  const cityOri = document.getElementById('rutaCiudadOrigen')?.value || '';
  const provDes = document.getElementById('rutaProvinciaDestino')?.value || '';
  const cityDes = document.getElementById('rutaCiudadDestino')?.value || '';
  const horario = document.getElementById("rutaHorario").value.trim();
  const precio = Number(document.getElementById("rutaPrecio").value);
  const asientos = Number(document.getElementById("rutaAsientos").value);
  if (!provOri || !cityOri || !provDes || !cityDes || !horario || !precio || !asientos) { document.getElementById("rutaMsg").textContent = "Complete todos los campos"; return; }
  const rutas = storage.get("rutas", []);
  const nueva = {
    id: Date.now(),
    // Compatibilidad y nuevos campos
    provincia: provOri,
    ciudad: cityOri,
    originProvince: provOri,
    originCity: cityOri,
    destProvince: provDes,
    destCity: cityDes,
    origen: cityOri,
    destino: cityDes,
    horario,
    precio,
    asientos
  };
  rutas.push(nueva);
  storage.set("rutas", rutas);
  document.getElementById("rutaMsg").textContent = "Ruta añadida";
  (document.getElementById("rutaForm")).reset();
  renderAdmin();
  // actualizar vista cliente si está abierta
  renderCliente();
  toast("Ruta añadida");
}

// --- Rutas: CRUD helpers ---
function deleteRuta(id) {
  const rutas = storage.get('rutas', []);
  const filtered = rutas.filter(r => r.id !== id);
  storage.set('rutas', filtered);
  renderAdmin();
  toast('Ruta eliminada');
}

let editingRutaId = null;
function openEditarRuta(id) {
  const modal = document.getElementById('editarRutaModal');
  const form = document.getElementById('editarRutaForm');
  if (!modal || !form) return;
  const r = storage.get('rutas', []).find(x => x.id === id);
  if (!r) return;
  editingRutaId = id;
  document.getElementById('erHorario').value = r.horario || '';
  document.getElementById('erPrecio').value = String(r.precio ?? '');
  document.getElementById('erAsientos').value = String(r.asientos ?? '');
  // preparar selects de Origen
  ensureProvinciaCiudadSelectors('erProvinciaOrigen', 'erCiudadOrigen', () => {
    const provOrigen = r.originProvince || r.provincia || findProvinceByCity(r.originCity || r.origen) || '';
    document.getElementById('erProvinciaOrigen').value = provOrigen;
    populateCitiesFor('erProvinciaOrigen', 'erCiudadOrigen');
    document.getElementById('erCiudadOrigen').value = r.originCity || r.ciudad || r.origen || '';
  });
  // preparar selects de Destino
  ensureProvinciaCiudadSelectors('erProvinciaDestino', 'erCiudadDestino', () => {
    const provDestino = r.destProvince || findProvinceByCity(r.destCity || r.destino) || '';
    document.getElementById('erProvinciaDestino').value = provDestino;
    populateCitiesFor('erProvinciaDestino', 'erCiudadDestino');
    document.getElementById('erCiudadDestino').value = r.destCity || r.destino || '';
  });
  modal.hidden = false;
}

function closeEditarRuta() {
  const modal = document.getElementById('editarRutaModal');
  if (modal) modal.hidden = true;
  editingRutaId = null;
}

document.getElementById('closeEditarRutaModal')?.addEventListener('click', closeEditarRuta);
document.getElementById('cancelarEditarRuta')?.addEventListener('click', closeEditarRuta);
document.getElementById('confirmarEditarRuta')?.addEventListener('click', () => {
  if (!editingRutaId) return closeEditarRuta();
  const provOri = document.getElementById('erProvinciaOrigen')?.value || '';
  const cityOri = document.getElementById('erCiudadOrigen')?.value || '';
  const provDes = document.getElementById('erProvinciaDestino')?.value || '';
  const cityDes = document.getElementById('erCiudadDestino')?.value || '';
  const horario = document.getElementById('erHorario').value.trim();
  const precio = Number(document.getElementById('erPrecio').value);
  const asientos = Number(document.getElementById('erAsientos').value);
  if (!provOri || !cityOri || !provDes || !cityDes || !horario || !precio || !asientos) {
    document.getElementById('editarRutaMsg').textContent = 'Completa todos los campos';
    return;
  }
  const rutas = storage.get('rutas', []);
  const idx = rutas.findIndex(r => r.id === editingRutaId);
  if (idx >= 0) {
    rutas[idx] = {
      ...rutas[idx],
      provincia: provOri,
      ciudad: cityOri,
      originProvince: provOri,
      originCity: cityOri,
      destProvince: provDes,
      destCity: cityDes,
      origen: cityOri,
      destino: cityDes,
      horario,
      precio,
      asientos
    };
    storage.set('rutas', rutas);
    toast('Ruta actualizada');
    renderAdmin();
  }
  closeEditarRuta();
});

// --- Provincias/Ciudades: carga y helpers ---
let EC_CACHE = null;
function ensureProvinciaCiudadSelectors(provId, cityId, onReady) {
  const provSel = document.getElementById(provId);
  const citySel = document.getElementById(cityId);
  if (!provSel || !citySel) return;
  function populateFromData(data) {
    provSel.innerHTML = '<option value="">Provincia...</option>';
    data.provincias?.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.nombre;
      opt.textContent = p.nombre;
      provSel.appendChild(opt);
    });
  }
  function updateCities() {
    const nombre = provSel.value;
    citySel.innerHTML = '<option value="">Ciudad...</option>';
    const p = EC_CACHE?.provincias?.find(x => x.nombre === nombre);
    p?.ciudades?.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      citySel.appendChild(opt);
    });
  }
  provSel.onchange = updateCities;
  if (EC_CACHE) { populateFromData(EC_CACHE); if (onReady) onReady(); return; }
  try {
    if (window.__EC_DATA__) {
      EC_CACHE = window.__EC_DATA__;
      populateFromData(EC_CACHE);
      if (onReady) onReady();
      return;
    }
  } catch {}
  fetch(asset('jsonProvincias')).then(r=>r.json()).then(data => {
    EC_CACHE = data;
    try { window.__EC_DATA__ = data; } catch {}
    populateFromData(data);
    if (onReady) onReady();
  }).catch(()=>{
    EC_CACHE = { provincias: [] };
    populateFromData(EC_CACHE);
    if (onReady) onReady();
  });
}

function populateCitiesFor(provId, cityId) {
  const provSel = document.getElementById(provId);
  const citySel = document.getElementById(cityId);
  if (!provSel || !citySel) return;
  const p = EC_CACHE?.provincias?.find(x => x.nombre === provSel.value);
  citySel.innerHTML = '<option value="">Ciudad...</option>';
  p?.ciudades?.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    citySel.appendChild(opt);
  });
}

function findProvinceByCity(cityName) {
  if (!cityName || !EC_CACHE?.provincias) return '';
  const p = EC_CACHE.provincias.find(p => (p.ciudades||[]).includes(cityName));
  return p ? p.nombre : '';
}

// Wire selects de rutas (form principal) al activar pestaña Rutas o al cargar admin
;(function wireRutasProvinciaCiudad(){
  const init = () => {
    ensureProvinciaCiudadSelectors('rutaProvinciaOrigen', 'rutaCiudadOrigen');
    ensureProvinciaCiudadSelectors('rutaProvinciaDestino', 'rutaCiudadDestino');
  };
  // al cargar
  init();
  // al cambiar de pestaña
  document.querySelectorAll('#view-admin .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab === 'rutas') setTimeout(init, 50);
    });
  });
})();
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
  const servicioTransferFields = document.getElementById('servicioTransferFields');
  const servicioP2PFields = document.getElementById('servicioP2PFields');
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
    if (servicioTransferFields) servicioTransferFields.style.display = 'none';
    if (servicioP2PFields) servicioP2PFields.style.display = 'none';
  } else if (tipo === 'encomienda') {
    if (destinoWrapper) destinoWrapper.style.display = '';
    if (destinoInput) destinoInput.required = true;
    if (rutaWrapper) rutaWrapper.style.display = 'none';
    if (rutaSelect) rutaSelect.required = false;
    if (servicioPrivadoFields) servicioPrivadoFields.style.display = 'none';
    if (servicioEncomiendaFields) servicioEncomiendaFields.style.display = '';
    if (servicioTransferFields) servicioTransferFields.style.display = 'none';
    if (servicioP2PFields) servicioP2PFields.style.display = 'none';
  } else if (tipo === 'transfer') {
    if (destinoWrapper) destinoWrapper.style.display = 'none';
    if (destinoInput) destinoInput.required = false;
    if (rutaWrapper) rutaWrapper.style.display = 'none';
    if (rutaSelect) rutaSelect.required = false;
    if (servicioPrivadoFields) servicioPrivadoFields.style.display = 'none';
    if (servicioEncomiendaFields) servicioEncomiendaFields.style.display = 'none';
    if (servicioTransferFields) servicioTransferFields.style.display = '';
    if (servicioP2PFields) servicioP2PFields.style.display = 'none';
  } else if (tipo === 'p2p') {
    if (destinoWrapper) destinoWrapper.style.display = '';
    if (destinoInput) destinoInput.required = true;
    if (rutaWrapper) rutaWrapper.style.display = 'none';
    if (rutaSelect) rutaSelect.required = false;
    if (servicioPrivadoFields) servicioPrivadoFields.style.display = 'none';
    if (servicioEncomiendaFields) servicioEncomiendaFields.style.display = 'none';
    if (servicioTransferFields) servicioTransferFields.style.display = 'none';
    if (servicioP2PFields) servicioP2PFields.style.display = '';
  } else {
    if (destinoWrapper) destinoWrapper.style.display = '';
    if (destinoInput) destinoInput.required = true;
    if (rutaWrapper) rutaWrapper.style.display = 'none';
    if (rutaSelect) rutaSelect.required = false;
    if (servicioPrivadoFields) servicioPrivadoFields.style.display = 'none';
    if (servicioEncomiendaFields) servicioEncomiendaFields.style.display = 'none';
    if (servicioTransferFields) servicioTransferFields.style.display = 'none';
    if (servicioP2PFields) servicioP2PFields.style.display = 'none';
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
    case "transfer":
      descripcion = "✈️ <strong>Transfer Aeropuerto (directo):</strong> Solo aeropuertos habilitados (Quito, Guayaquil). Selecciona Aeropuerto ↔ Casa. Precio automático según configuración del admin.";
      break;
    case "p2p":
      descripcion = "📍 <strong>Cotización Punto a Punto:</strong> Cotiza cualquier ruta fuera de las predeterminadas. Opciones de cálculo: por kilometraje (API Maps) o tarifas planas por zonas. Se muestra el valor antes de reservar.";
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
  } else if (tipo === 'transfer') {
    // Transfer: origen/destino se deducen por tipo de transfer
    const tipoTransfer = document.getElementById('csTipoTransfer').value;
    const aeropuerto = document.getElementById('csAeropuerto').value;
    const direccionTransfer = document.getElementById('csDireccionTransfer').value.trim();
    
    if (!direccionTransfer) { toast('Por favor ingresa la dirección de recogida/llegada'); return; }
    
    if (tipoTransfer === 'aeropuerto-casa') {
      origen = aeropuerto === 'quito' ? 'Aeropuerto Mariscal Sucre (Quito)' : 'Aeropuerto José Joaquín de Olmedo (Guayaquil)';
      destino = direccionTransfer;
    } else {
      origen = direccionTransfer;
      destino = aeropuerto === 'quito' ? 'Aeropuerto Mariscal Sucre (Quito)' : 'Aeropuerto José Joaquín de Olmedo (Guayaquil)';
    }
    horario = 'A coordinar';
  } else if (tipo === 'p2p') {
    destino = document.getElementById("csDestino").value.trim();
    if (!destino) { toast('Ingrese destino'); return; }
    horario = 'A coordinar';
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
  } else if (tipo === 'transfer') {
    const personasTransfer = document.getElementById('csPersonasTransfer').value;
    const numeroVuelo = document.getElementById('csNumeroVuelo').value.trim();
    const tipoTransfer = document.getElementById('csTipoTransfer').value;
    const aeropuerto = document.getElementById('csAeropuerto').value;
    
    if (!personasTransfer) { toast("Por favor indica el número de pasajeros"); return; }
    
    servicioDetalles = { 
      ...servicioDetalles, 
      personas: Number(personasTransfer), 
      tipoTransfer, 
      aeropuerto,
      numeroVuelo: numeroVuelo || null
    };
  } else if (tipo === 'p2p') {
    const personasP2P = document.getElementById('csPersonasP2P').value;
    const tipoVehiculoP2P = document.getElementById('csTipoVehiculoP2P').value;
    const fechaHoraP2P = document.getElementById('csFechaHoraP2P').value;
    const comentariosP2P = document.getElementById('csComentariosP2P').value.trim();
    const metodoCalculoP2P = document.getElementById('csMetodoCalculoP2P').value;
    const zonaP2P = document.getElementById('csZonaP2P').value;
    
    if (!personasP2P) { toast("Por favor indica el número de pasajeros"); return; }
    
    servicioDetalles = { 
      ...servicioDetalles, 
      personas: Number(personasP2P), 
      tipoVehiculo: tipoVehiculoP2P,
      fechaHora: fechaHoraP2P || null,
      comentarios: comentariosP2P || null,
      metodoCalculo: metodoCalculoP2P,
      zona: zonaP2P || null
    };
  }

  // Precios base: transfer según aeropuerto, p2p según configuración
  let precioEstimado = 15;
  if (tipo === 'transfer') {
    const aeropuerto = document.getElementById('csAeropuerto').value;
    // Precio automático según configuración del admin
    precioEstimado = aeropuerto === 'quito' ? 25 : 30; // Quito: $25, Guayaquil: $30
  } else if (tipo === 'p2p') {
    // Usar el precio calculado dinámicamente
    const precioCalculadoElement = document.getElementById("precioCalculadoP2P");
    if (precioCalculadoElement) {
      const precioTexto = precioCalculadoElement.textContent;
      precioEstimado = parseInt(precioTexto.replace('$', '')) || 20;
    } else {
      precioEstimado = 20; // Precio base por defecto
    }
  }

  selectedCustomService = {
    id: Date.now(),
    origen: servicioDetalles.origen,
    destino: servicioDetalles.destino,
    horario: servicioDetalles.horario,
    precio: tipo === 'privado' ? 25 : precioEstimado,
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
      ${tipo==='transfer' ? `<div><strong>Pasajeros:</strong> ${servicioDetalles.personas} • <strong>Tipo:</strong> ${servicioDetalles.tipoTransfer} • <strong>Aeropuerto:</strong> ${servicioDetalles.aeropuerto}</div>` : ''}
      ${tipo==='p2p' ? `<div><strong>Pasajeros:</strong> ${servicioDetalles.personas} • <strong>Vehículo:</strong> ${servicioDetalles.tipoVehiculo} • <strong>Cálculo:</strong> ${servicioDetalles.metodoCalculo}</div>` : ''}
      <div><strong>Precio estimado:</strong> $${selectedCustomService.precio}</div>
    `;
    det.appendChild(item);
  }
  if (modal) { modal.hidden = false; modal.style.display = 'grid'; }
}

// P2P calculation methods
function onP2PMetodoChange() {
  const metodo = document.getElementById("csMetodoCalculoP2P").value;
  const zonaFields = document.getElementById("p2pZonaFields");
  const precioPreview = document.getElementById("p2pPrecioPreview");
  
  if (metodo === "zonas") {
    if (zonaFields) zonaFields.style.display = '';
    calculateP2PPrice();
  } else {
    if (zonaFields) zonaFields.style.display = 'none';
    calculateP2PPrice();
  }
  
  if (precioPreview) precioPreview.style.display = '';
}

function onP2PZonaChange() {
  calculateP2PPrice();
}

function calculateP2PPrice() {
  const metodo = document.getElementById("csMetodoCalculoP2P")?.value;
  if (!metodo) return;
  
  const precioPreview = document.getElementById("p2pPrecioPreview");
  const precioCalculado = document.getElementById("precioCalculadoP2P");
  const detalleCalculo = document.getElementById("detalleCalculoP2P");
  
  if (!precioPreview || !precioCalculado || !detalleCalculo) return;
  
  let precio = 0;
  let detalle = "";
  
  if (metodo === "kilometraje") {
    // Cálculo por kilometraje (simulado - en producción usar API Maps)
    const origen = document.getElementById("csOrigen")?.value?.trim();
    const destino = document.getElementById("csDestino")?.value?.trim();
    
    if (origen && destino) {
      // Simulación de cálculo por distancia
      const distanciaKm = Math.random() * 50 + 10; // 10-60 km simulado
      precio = Math.round(distanciaKm * 1.5 + 15); // $1.5 por km + $15 base
      detalle = `Distancia estimada: ${distanciaKm.toFixed(1)} km × $1.5/km + $15 base`;
    } else {
      precio = 15;
      detalle = "Ingresa origen y destino para calcular por kilometraje";
    }
  } else if (metodo === "zonas") {
    const zona = document.getElementById("csZonaP2P")?.value;
    if (zona) {
      // Tarifas por zonas
      const tarifasZonas = {
        "quito-centro": { base: 20, extra: 0 },
        "quito-norte": { base: 20, extra: 5 },
        "quito-sur": { base: 20, extra: 5 },
        "quito-valle": { base: 20, extra: 10 },
        "guayaquil-centro": { base: 25, extra: 0 },
        "guayaquil-norte": { base: 25, extra: 5 },
        "guayaquil-sur": { base: 25, extra: 5 },
        "otra-zona": { base: 30, extra: 0 }
      };
      
      const tarifa = tarifasZonas[zona] || { base: 20, extra: 0 };
      precio = tarifa.base + tarifa.extra;
      
      const nombreZona = document.getElementById("csZonaP2P").selectedOptions[0]?.text || zona;
      detalle = `Tarifa zona: ${nombreZona}`;
    } else {
      precio = 20;
      detalle = "Selecciona una zona para ver la tarifa";
    }
  }
  
  // Ajuste por tipo de vehículo
  const tipoVehiculo = document.getElementById("csTipoVehiculoP2P")?.value;
  if (tipoVehiculo) {
    const ajustesVehiculo = {
      "sedan": 0,
      "suv": 5,
      "van": 10
    };
    const ajuste = ajustesVehiculo[tipoVehiculo] || 0;
    precio += ajuste;
    if (ajuste > 0) {
      detalle += ` + $${ajuste} (${tipoVehiculo.toUpperCase()})`;
    }
  }
  
  precioCalculado.textContent = `$${precio}`;
  detalleCalculo.textContent = detalle;
  precioPreview.style.display = '';
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
  // Soporte para dos ubicaciones previas y nueva en Mis Viajes
  const legacyPanel = document.getElementById("trackingPanel");
  const legacyInfo = document.getElementById("trackingInfo");
  const newPanel = document.getElementById("trackingClientePanel");
  const infoNew = document.getElementById("trackingClienteInfo");
  const msgNew = document.getElementById("trackingClienteMsg");
  const mapEl = document.getElementById("trackingClienteMap");

  const myActive = storage.get("reservas", []).filter(r => r.clienteId === session?.id && r.estado !== "recogido");
  const tracking = storage.get("tracking", []);

  // Inicializar mapa si existe el contenedor
  if (mapEl && !window.__clienteTrackingMap) {
    try {
      window.__clienteTrackingMap = L.map('trackingClienteMap').setView([-0.1807, -78.4678], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(window.__clienteTrackingMap);
      setTimeout(() => { try { window.__clienteTrackingMap.invalidateSize(); } catch {} }, 100);
    } catch {}
  }

  // Render mensajes y marcador
  function renderLists(targetEl) {
    if (!targetEl) return;
    targetEl.innerHTML = "";
    if (myActive.length === 0) return;
    myActive.forEach(r => {
      const t = tracking.find(t => t.reservaId === r.id);
      const div = document.createElement('div');
      div.className = 'list-item';
      if (r.estado === 'pendiente' && !r.conductorId) {
        div.textContent = `${r.origen} → ${r.destino} • Aún no hay conductor asignado.`;
      } else if (r.conductorId && (r.estado === 'pendiente' || r.estado === 'confirmada') && !t) {
        div.textContent = `${r.origen} → ${r.destino} • Conductor asignado. Esperando señal GPS...`;
      } else if (t) {
        div.textContent = `${r.origen} → ${r.destino} • Conductor en camino: ${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}`;
      } else {
        div.textContent = `${r.origen} → ${r.destino} • Actualización pendiente.`;
      }
      targetEl.appendChild(div);
    });
  }

  // Control visibilidad de paneles
  if (legacyPanel && legacyInfo) {
    if (myActive.length === 0) {
      legacyPanel.hidden = true;
    } else {
      legacyPanel.hidden = false;
      renderLists(legacyInfo);
    }
  }

  if (newPanel) {
    // Mensaje contextual superior
    if (msgNew) {
      if (myActive.length === 0) {
        msgNew.textContent = 'No tienes viajes activos. Cuando un conductor sea asignado verás su ubicación aquí.';
      } else {
        const anyAssigned = myActive.some(r => !!r.conductorId);
        const anyTracking = myActive.some(r => tracking.find(t => t.reservaId === r.id));
        msgNew.textContent = !anyAssigned
          ? 'Aún no hay conductor asignado a tus viajes activos.'
          : (anyTracking ? 'El conductor está en camino. Visualiza su posición en el mapa.' : 'Conductor asignado. Esperando señal GPS...');
      }
    }

    renderLists(infoNew);

    // Actualizar marcador en el mapa con la primera reserva que tenga tracking
    if (window.__clienteTrackingMap && mapEl) {
      try {
        const withT = myActive.map(r => ({ r, t: tracking.find(t => t.reservaId === r.id) })).filter(x => !!x.t);
        if (withT.length) {
          const { r, t } = withT[0];
          if (!window.__clienteTrackingMarker) {
            window.__clienteTrackingMarker = L.marker([t.lat, t.lng]).addTo(window.__clienteTrackingMap).bindPopup(`${r.origen} → ${r.destino}`);
          } else {
            window.__clienteTrackingMarker.setLatLng([t.lat, t.lng]);
          }
          window.__clienteTrackingMap.setView([t.lat, t.lng], 14);
        }
      } catch {}
      setTimeout(() => { try { window.__clienteTrackingMap.invalidateSize(); } catch {} }, 50);
    }
  }
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
  sessionStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function applySavedTheme() {
  const saved = sessionStorage.getItem('theme');
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
  if (filter === 'pendiente') {
    visibles = reservas.filter(r => r.estado === 'pendiente' && !r.conductorId);
  } else if (filter === 'asignadas') {
    visibles = reservas.filter(r => r.conductorId && r.estado === 'pendiente');
  } else if (filter === 'en-curso') {
    visibles = reservas.filter(r => r.estado === 'en-curso');
  } else if (filter === 'recogido') {
    visibles = reservas.filter(r => r.estado === 'recogido');
  } else {
    visibles = reservas;
  }
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
      actions = `<span class=\"badge info\">Asignada</span>
                 <button class=\"btn secondary\" data-act=\"start\" data-id=\"${r.id}\">Iniciar</button>
                 <button class=\"btn danger\" data-act=\"cancel\" data-id=\"${r.id}\">Cancelar</button>`;
    } else if (filter === 'en-curso') {
      actions = `<span class=\"badge warn\">En curso</span>
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
      <div><strong>Cliente:</strong> ${cliente}${r.esEmpresa ? ` (${r.nombreEmpresa})` : ''}</div>
      <div><strong>Tipo:</strong> ${r.tipo} • <strong>Servicio:</strong> ${r.servicio}</div>
      <div><strong>Dirección:</strong> ${r.direccion}</div>
      <div><strong>Método de pago:</strong> ${r.metodoPago}${r.promo?` • <strong>Cupón:</strong> ${r.promo}`:''}</div>
      ${r.esEmpresa ? `<div><strong>Precio transporte:</strong> $${r.precioTransporte || r.precio}</div>` : ''}
      ${r.esEmpresa ? `<div><strong>Tarifa empresa:</strong> $${r.tarifaEmpresa || 0}</div>` : ''}
      <div><strong>Precio total:</strong> $${r.precio}</div>
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

// Configurar botones de mapa para todos los campos de ubicación
function wireMapButtons() {
  // Botón para destino general
  const destinoMapBtn = document.getElementById('csDestinoMapBtn');
  if (destinoMapBtn) {
    destinoMapBtn.addEventListener('click', () => {
      window.__pickerTarget = 'destino';
      window.__pickerTargetInput = 'csDestino';
      openPicker();
    });
  }

  // Botón para dirección de transfer
  const transferMapBtn = document.getElementById('csDireccionTransferMapBtn');
  if (transferMapBtn) {
    transferMapBtn.addEventListener('click', () => {
      window.__pickerTarget = 'transfer';
      window.__pickerTargetInput = 'csDireccionTransfer';
      openPicker();
    });
  }

  // Botones para P2P
  const p2pOrigenMapBtn = document.getElementById('csP2POrigenMapBtn');
  if (p2pOrigenMapBtn) {
    p2pOrigenMapBtn.addEventListener('click', () => {
      window.__pickerTarget = 'p2pOrigen';
      window.__pickerTargetInput = 'csP2POrigen';
      openPicker();
    });
  }

  const p2pDestinoMapBtn = document.getElementById('csP2PDestinoMapBtn');
  if (p2pDestinoMapBtn) {
    p2pDestinoMapBtn.addEventListener('click', () => {
      window.__pickerTarget = 'p2pDestino';
      window.__pickerTargetInput = 'csP2PDestino';
      openPicker();
    });
  }
}

// --- ADMIN GPS ---
let adminGpsMap = null;
let adminGpsMarkers = [];
let adminGpsMarkerByKey = {};
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
  adminGpsMarkerByKey = {};
  list.innerHTML = '';

  const users = storage.get('users', []);
  const tracking = storage.get('tracking', []); // [{conductorId, lat, lng, updatedAt, reservaId}]
  const reservas = storage.get('reservas', []);

  // Conductores del sistema
  const allDrivers = users.filter(u => u.role === 'conductor');
  const visiblesDrivers = filterText
    ? allDrivers.filter(u => (u.nombre || '').toLowerCase().includes(filterText.toLowerCase()))
    : allDrivers;

  // Mapear conductor -> tracking activo (solo reservas en curso)
  const trackingActivos = tracking.filter(t => reservas.some(r => r.id === t.reservaId && (r.estado === 'en-curso')));
  const activoByDriverId = new Map();
  trackingActivos.forEach(t => {
    // preferir el más reciente por si hay múltiples
    const prev = activoByDriverId.get(t.conductorId);
    if (!prev || (t.updatedAt || 0) > (prev.updatedAt || 0)) activoByDriverId.set(t.conductorId, t);
  });

  let visiblesActivosCount = 0;
  visiblesDrivers.forEach(driver => {
    const t = activoByDriverId.get(driver.id) || null;
    const res = t ? reservas.find(r => r.id === t.reservaId) : null;
    const isActive = Boolean(t && t.lat && t.lng);

    const item = document.createElement('div');
    item.className = 'list-item';
    if (!isActive) item.style.opacity = '0.6';
    item.style.cursor = isActive ? 'pointer' : 'not-allowed';

    const titleRow = isActive
      ? `<div class=\"row\"><strong>${driver.nombre}</strong><span class=\"badge\" style=\"background:#16a34a; color:#fff;\">Activo</span><span class=\"badge\">${new Date(t.updatedAt||Date.now()).toLocaleTimeString()}</span></div>`
      : `<div class=\"row\"><strong>${driver.nombre}</strong><span class=\"badge\" style=\"background:#9ca3af; color:#fff;\">Inactivo</span></div>`;

    const bodyLines = isActive
      ? `
        <div>Reserva: #${t.reservaId} • ${res?.origen||''} → ${res?.destino||''}</div>
        <div>Posición: ${t.lat?.toFixed(5)||'-'}, ${t.lng?.toFixed(5)||'-'}</div>
      `
      : `<div class=\"text-muted\">En espera de que el conductor inicie el viaje</div>`;

    item.innerHTML = `${titleRow}${bodyLines}`;

    if (isActive) {
      // marcador en el mapa
      const marker = L.marker([t.lat, t.lng]).addTo(adminGpsMap).bindPopup(`${driver.nombre}<br/>${res?.origen || ''} → ${res?.destino || ''}`);
      adminGpsMarkers.push(marker);
      const key = `${t.conductorId}:${t.reservaId}`;
      adminGpsMarkerByKey[key] = marker;
      item.dataset.key = key;
      item.addEventListener('click', () => {
        const key2 = item.dataset.key;
        const m = adminGpsMarkerByKey[key2];
        if (m) {
          try {
            const latlng = m.getLatLng();
            adminGpsMap.setView(latlng, 15);
            m.openPopup();
          } catch {}
        }
      });
      visiblesActivosCount++;
    }

    list.appendChild(item);
  });

  if (countEl) countEl.textContent = `${visiblesActivosCount} activos`;
  if (adminGpsMarkers.length > 1) {
    const group = L.featureGroup(adminGpsMarkers);
    try { adminGpsMap.fitBounds(group.getBounds().pad(0.2)); } catch {}
  } else if (adminGpsMarkers.length === 1) {
    try { adminGpsMap.setView(adminGpsMarkers[0].getLatLng(), 15); } catch {}
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

// Wire filtro GPS Empresa
(function wireEmpresaGps(){
  const input = document.getElementById('empresaGpsFilter');
  input?.addEventListener('input', () => renderEmpresaGps(input.value.trim()));
})();

// Refrescar GPS al cambiar a la pestaña GPS Empresa
(function observeEmpresaTabs(){
  document.querySelectorAll('#view-empresa .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab === 'gps') setTimeout(() => renderEmpresaGps(document.getElementById('empresaGpsFilter')?.value?.trim()||''), 60);
    });
  });
})();

// Timer para refrescar posiciones activas de empresa (cada 5s)
setInterval(() => {
  if (views.empresa?.classList.contains('active')) {
    const activeTab = document.querySelector('#view-empresa .tab-btn.active')?.getAttribute('data-tab');
    if (activeTab === 'gps') renderEmpresaGps(document.getElementById('empresaGpsFilter')?.value?.trim()||'');
  }
}, 5000);

// navega a pago con un draft de reserva
function goToPayment(draft) {
  window.__payDraft = draft;
  const session = getSession();
  const isEmpresa = session && session.role === 'empresa';
  const isClienteEmpresa = session && session.role === 'cliente_empresa';
  // Buscar tarifa fija de la empresa para clientes de otra empresa
  let tarifaEmpresaFija = 0;
  if (isClienteEmpresa) {
    try {
      const users = storage.get('users', []);
      const empresaName = session.empresa || session.nombre;
      const emp = users.find(u => u.role === 'empresa' && (u.empresa === empresaName || u.nombre === empresaName));
      tarifaEmpresaFija = Number(emp?.tarifaEmpresa || 0);
    } catch {}
  }
  
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
      <div><strong>Precio transporte:</strong> $<span id=\"payPrice\">${draft.precio}</span></div>
      ${(isEmpresa || isClienteEmpresa) ? `<div><strong>Tarifa empresa:</strong> $<span id=\"empresaTarifaDisplay\">${isClienteEmpresa ? tarifaEmpresaFija.toFixed(2) : '0.00'}</span></div>` : ''}
      <div><strong>Total:</strong> $<span id=\"payTotalDisplay\">${draft.precio}</span></div>
    `;
    summary.appendChild(item);
  }
  
  // Mostrar/ocultar campo de tarifa de empresa
  const empresaTarifaSection = document.getElementById('empresaTarifaSection');
  if (empresaTarifaSection) {
    // Solo Empresa puede editar; Cliente de Otra Empresa no edita
    empresaTarifaSection.style.display = isEmpresa ? 'block' : 'none';
  }
  
  // Función para actualizar total cuando cambie la tarifa de empresa
  const updateTotal = () => {
    const precioTransporte = Number(draft.precio) || 0;
    const tarifaEmpresa = isEmpresa ? Number(document.getElementById('empresaTarifa')?.value || 0) : (isClienteEmpresa ? tarifaEmpresaFija : 0);
    const total = precioTransporte + tarifaEmpresa;
    
    const empresaTarifaDisplay = document.getElementById('empresaTarifaDisplay');
    const payTotalDisplay = document.getElementById('payTotalDisplay');
    
    if (empresaTarifaDisplay) empresaTarifaDisplay.textContent = tarifaEmpresa.toFixed(2);
    if (payTotalDisplay) payTotalDisplay.textContent = total.toFixed(2);
    
    // Actualizar también las instrucciones de pago
    toggle();
  };
  
  // Event listener para tarifa de empresa
  const empresaTarifaInput = document.getElementById('empresaTarifa');
  if (empresaTarifaInput) {
    empresaTarifaInput.addEventListener('input', updateTotal);
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
    
    // Calcular el precio total actual (transporte + tarifa empresa)
    const precioTransporte = Number(draft.precio) || 0;
    const tarifaEmpresa = isEmpresa ? Number(document.getElementById('empresaTarifa')?.value || 0) : (isClienteEmpresa ? tarifaEmpresaFija : 0);
    const precioTotal = precioTransporte + tarifaEmpresa;
    
    let text = '';
    if (m === 'efectivo') text = `Paga $${precioTotal.toFixed(2)} en efectivo al conductor cuando te recoja. Conserva el efectivo exacto si es posible.`;
    else if (m === 'tarjeta') text = `Introduce los datos de tu tarjeta para procesar el pago de $${precioTotal.toFixed(2)}.`;
    else if (m === 'transferencia') text = `Realiza una transferencia por $${precioTotal.toFixed(2)}. Indica el número de referencia y banco.`;
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
    if (!session || (session.role !== 'cliente' && session.role !== 'empresa' && session.role !== 'cliente_empresa')) { toast('Inicia sesión como cliente o empresa'); return; }
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
    const isEmpresa = session.role === 'empresa';
    const isClienteEmpresa = session.role === 'cliente_empresa';
    // calcular tarifa
    let tarifaEmpresa = 0;
    if (isEmpresa) tarifaEmpresa = Number(document.getElementById('empresaTarifa')?.value || 0);
    else if (isClienteEmpresa) {
      try {
        const users = storage.get('users', []);
        const empresaName = session.empresa || session.nombre;
        const emp = users.find(u => u.role === 'empresa' && (u.empresa === empresaName || u.nombre === empresaName));
        tarifaEmpresa = Number(emp?.tarifaEmpresa || 0);
      } catch { tarifaEmpresa = 0; }
    }
    const precioConTarifa = precioBase + tarifaEmpresa;
    const precioFinal = promoApplied && promoApplied.discountPct ? Math.max(0, Math.round(precioConTarifa * (100 - promoApplied.discountPct)) / 100) : precioConTarifa;

    const reservas = storage.get('reservas', []);
    const nueva = {
      id: Date.now(), rutaId: draft.rutaId, clienteId: session.id,
      tipo: draft.tipo, direccion: draft.direccion, horario: draft.horario, origen: draft.origen, destino: draft.destino, precio: precioFinal,
      estado: 'pendiente', recogido: false,
      servicio: draft.servicio, metodoPago, promo: promoApplied?.code ?? null,
      conductorId: null, vehiculo: null,
      servicioDetalles: draft.servicioDetalles || null,
      // Información específica para empresas
      esEmpresa: (session.role === 'empresa' || session.role === 'cliente_empresa'),
      nombreEmpresa: (session.role === 'empresa' || session.role === 'cliente_empresa') ? (session.empresa || session.nombre) : null,
      tarifaEmpresa: (session.role === 'empresa' || session.role === 'cliente_empresa') ? tarifaEmpresa : 0,
      precioTransporte: precioBase,
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


