// Core: storage, seed, session, router, UI helpers

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

// Seed data
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
}

function navigateByRole(role) {
  if (role === "cliente") { renderCliente(); showView("cliente"); }
  else if (role === "conductor") { renderConductor(); showView("conductor"); }
  else if (role === "admin") { renderAdmin(); showView("admin"); }
  else { showView("auth"); }
}

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
  sessionStorage.setItem('theme', isDark ? 'dark' : 'light');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

function applySavedTheme() {
  const saved = sessionStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = '☀️';
  }
}


