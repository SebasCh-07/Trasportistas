// Datos quemados (simulados)
export const db = {
  users: [
    { id: 'u1', role: 'admin', email: 'admin@demo.com', password: 'admin123', name: 'Admin' },
    { id: 'u2', role: 'empresa', email: 'empresa@demo.com', password: 'empresa123', name: 'Empresa ACME', empresaId: 'e1' },
    { id: 'u3', role: 'cliente', email: 'cliente@demo.com', password: 'cliente123', name: 'Juan Pérez' },
    { id: 'u4', role: 'clienteEmpresa', email: 'clienteemp@demo.com', password: 'clienteemp123', name: 'Lucía Gómez', empresaId: 'e1' },
    { id: 'u5', role: 'conductor', email: 'driver@demo.com', password: 'driver123', name: 'Carlos Ruiz', driverId: 'd1' },
  ],
  empresas: [
    { id: 'e1', name: 'ACME Travel', priceMarkupPercent: 15 },
  ],
  fleet: [
    { id: 'v1', brand: 'Toyota', model: 'Hiace', plate: 'ABC-123', capacity: 12 },
    { id: 'v2', brand: 'Mercedes', model: 'Sprinter', plate: 'DEF-456', capacity: 16 },
  ],
  drivers: [
    { id: 'd1', name: 'Carlos Ruiz', phone: '+51 999 888 777', vehicleId: 'v1', location: { x: 20, y: 30 }, status: 'Libre' },
  ],
  routes: [
    { id: 'r1', type: 'tour', name: 'Quito City Tour Histórico', basePrice: 45, image: 'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?q=80&w=1200&auto=format&fit=crop', description: 'Recorre el Centro Histórico de Quito, Patrimonio Cultural de la Humanidad: plazas, iglesias y miradores.' },
    { id: 'r2', type: 'transfer', name: 'Aeropuerto Mariscal Sucre → Centro Quito', basePrice: 30, image: 'https://images.unsplash.com/photo-1542144582-1ba00456b5d5?q=80&w=1200&auto=format&fit=crop', description: 'Traslado privado desde el Aeropuerto de Quito hacia tu hotel en el Centro de la ciudad.' },
    { id: 'r3', type: 'tour', name: 'Mitad del Mundo', basePrice: 35, image: 'https://images.unsplash.com/photo-1599426821372-1d4e76f9f2e7?q=80&w=1200&auto=format&fit=crop', description: 'Visita la Ciudad Mitad del Mundo y experimenta la línea ecuatorial con actividades únicas.' },
    { id: 'r4', type: 'tour', name: 'Baños Aventura y Cascadas', basePrice: 75, image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop', description: 'Explora Baños de Agua Santa: Pailón del Diablo, columpio del fin del mundo y rutas de cascadas.' },
  ],
  coupons: [
    { id: 'c1', code: 'WELCOME10', percent: 10 },
  ],
  bookings: [
    // { id, userId, routeId, status, driverId, empresaId? }
  ],
};

// Utilidades compartidas
export const Storage = {
  save(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  load(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  remove(key) { localStorage.removeItem(key); }
};

export const Session = {
  setUser(user) { Storage.save('session:user', user); },
  getUser() { return Storage.load('session:user'); },
  clear() { Storage.remove('session:user'); }
};

export const Auth = {
  login({ email, password }) {
    const users = Storage.load('data:users', db.users);
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return { success: false, message: 'Credenciales inválidas' };
    Session.setUser({ id: user.id, role: user.role, name: user.name, empresaId: user.empresaId, driverId: user.driverId });
    return { success: true, user: { id: user.id, role: user.role } };
  },
  logout() { Session.clear(); window.location.href = '../index.html'; }
};

export function mountSharedChrome() {
  const navContainer = document.getElementById('navbar');
  const footerContainer = document.getElementById('footer');
  if (navContainer) fetch('../shared/components/navbar.html').then(r => r.text()).then(html => { navContainer.innerHTML = html; applyBranding(); bindLogout(); setRoleLabel(); });
  if (footerContainer) fetch('../shared/components/footer.html').then(r => r.text()).then(html => { footerContainer.innerHTML = html; const ys = footerContainer.querySelector('.year'); if (ys) ys.textContent = new Date().getFullYear(); applyBranding(); });
}

function bindLogout() {
  const btn = document.getElementById('logoutBtn');
  if (btn) btn.addEventListener('click', () => Auth.logout());
}

function applyBranding() {
  const isAltBrand = document.body.classList.contains('empresa-theme') || document.body.classList.contains('cliente-empresa-theme');
  const brandSpan = document.querySelector('.nav-brand span');
  const logoCircle = document.querySelector('.nav-brand .logo-circle');
  const footer = document.querySelector('.footer .container');
  if (isAltBrand) {
    if (brandSpan) brandSpan.textContent = 'EMPRESA';
    if (logoCircle) logoCircle.textContent = 'EM';
    if (footer) footer.innerHTML = `© <span class="year">${new Date().getFullYear()}</span> EMPRESA — Hecho con HTML/CSS/JS`;
  }
}

function setRoleLabel() {
  const label = document.getElementById('roleLabel');
  if (!label) return;
  const user = Session.getUser();
  if (!user || !user.role) { label.textContent = ''; label.style.display = 'none'; return; }
  const rolePretty = ({ admin: 'Admin', empresa: 'Empresa', cliente: 'Cliente', clienteEmpresa: 'ClienteEmpresa', conductor: 'Conductor' })[user.role] || user.role;
  label.textContent = `Rol: ${rolePretty}`;
  label.style.display = 'inline-flex';
}

// Notificaciones
export function notify(message, type = 'info', timeout = 2500) {
  let el = document.getElementById('banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'banner';
    el.className = 'banner';
    document.body.appendChild(el);
  }
  el.className = `banner show ${type}`;
  el.textContent = message;
  setTimeout(() => { el.classList.remove('show'); }, timeout);
}

// Precio con markup por empresa
export function getPriceWithEmpresa(route, empresaId) {
  if (!empresaId) return route.basePrice;
  const emp = db.empresas.find(e => e.id === empresaId);
  if (!emp) return route.basePrice;
  return Math.round(route.basePrice * (1 + (emp.priceMarkupPercent || 0) / 100));
}

// Leaflet loader y utilidades de mapas reales
let leafletLoading = null;
export async function ensureLeaflet() {
  if (window.L) return window.L;
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return leafletLoading;
}

export async function initLeafletMap(container, { center = [-0.1807, -78.4678], zoom = 12 } = {}) {
  const L = await ensureLeaflet();
  const map = L.map(container).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  return map;
}

export async function startLeafletTracking(container, start = [-0.1807, -78.4678]) {
  const L = await ensureLeaflet();
  const map = await initLeafletMap(container, { center: start, zoom: 13 });
  const marker = L.marker(start).addTo(map);
  let t = 0;
  const id = setInterval(() => {
    t += 0.02;
    const lat = start[0] + Math.cos(t) * 0.01;
    const lng = start[1] + Math.sin(t) * 0.01;
    marker.setLatLng([lat, lng]);
  }, 200);
  return { map, marker, stop: () => clearInterval(id) };
}

// Helper para proteger rutas
export function requireRole(expectedRole) {
  const user = Session.getUser();
  if (!user || user.role !== expectedRole) {
    window.location.href = '../index.html';
    return null;
  }
  return user;
}

// Registro de usuario
export function registerUser(payload) {
  const users = Storage.load('data:users', db.users);
  if (users.some(u => u.email === payload.email)) {
    return { success: false, message: 'El correo ya está registrado' };
  }
  const id = `u${Date.now()}`;
  const name = `${payload.nombres} ${payload.apellidos}`.trim();
  const newUser = {
    id,
    role: payload.role || 'cliente',
    email: payload.email,
    password: payload.password,
    name,
    profile: {
      nombres: payload.nombres,
      apellidos: payload.apellidos,
      ci: payload.ci,
      telefono: payload.telefono,
      direccion: payload.direccion,
      location: payload.location, // {x,y}
      fotoDataUrl: payload.fotoDataUrl,
      createdAt: new Date().toISOString()
    }
  };
  users.push(newUser);
  Storage.save('data:users', users);
  return { success: true, user: { id: newUser.id, role: newUser.role, name: newUser.name } };
}



