import { db, Storage, mountSharedChrome, requireRole, Session, notify, startLeafletTracking, initLeafletMap, getPriceWithEmpresa } from '../shared/assets/scripts.js';

const state = {
  routes: Storage.load('data:routes', db.routes),
  bookings: Storage.load('data:bookings', db.bookings),
  empresas: Storage.load('data:empresas', db.empresas),
  activeOuterTab: 'catalogo',
  activeInnerTab: 'pendiente',
  catalogTab: 'rutas',
  routeMode: 'privada',
};

let lastSnapshot = null;
let trackingInterval = null;

function renderCatalog() {
  const user = Session.getUser();
  const empresaId = user.empresaId;
  const list = document.getElementById('catalog');
  const routes = state.routes.filter(r => (r.type || 'tour').toLowerCase() === 'tour');
  list.innerHTML = routes.map(r => {
    const price = getPriceWithEmpresa(r, empresaId);
    return `
    <div class="tour-card">
      <div class="tour-media" style="background-image:url('${r.image || ''}')"></div>
      <div class="tour-body">
        <div class="badge">${r.type}</div>
        <h4>${r.name}</h4>
        <div class="actions">
          <span class="price">$${price}</span>
          <div style="display:flex; gap:8px;">
            <button class="btn ghost" data-view="${r.id}">Ver</button>
            <button class="btn primary" data-book="${r.id}">Reservar</button>
          </div>
        </div>
      </div>
    </div>`;}).join('');
  list.querySelectorAll('button[data-book]')?.forEach(btn => {
    btn.addEventListener('click', () => createBooking(btn.getAttribute('data-book')));
  });
  const modal = document.getElementById('routeModal');
  const backdrop = document.getElementById('routeBackdrop');
  const close = () => { modal.classList.remove('show'); backdrop.classList.remove('show'); };
  document.getElementById('closeRoute').onclick = close;
  document.getElementById('routeCloseBtn').onclick = close;
  list.querySelectorAll('button[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = state.routes.find(x => x.id === btn.getAttribute('data-view'));
      const user = Session.getUser();
      const empresaId = user.empresaId;
      const price = getPriceWithEmpresa(r, empresaId);
      document.getElementById('routeTitle').textContent = r.name;
      document.getElementById('routeBody').innerHTML = `
        <div class="grid cols-2">
          <div style="min-height:160px;background:url('${r.image||''}') center/cover;border-radius:8px;border:1px solid var(--border);"></div>
          <div>
            <p class="muted">Tipo: ${r.type}</p>
            <p>${r.description || ''}</p>
            <p><strong>Precio empresa:</strong> $${price}</p>
          </div>
        </div>`;
      modal.classList.add('show'); backdrop.classList.add('show');
    });
  });
}

function createBooking(routeId) {
  const user = Session.getUser();
  const id = `b${Date.now()}`;
  state.bookings.push({ id, userId: user.id, routeId, status: 'Pendiente', driverId: null, createdAt: new Date().toISOString(), mode: state.routeMode, serviceType: 'tour', empresaId: user.empresaId });
  Storage.save('data:bookings', state.bookings);
  renderBookings();
  notify('Reserva creada para tu empresa. Esperando asignación.', 'success');
}

function renderBookings() {
  const user = Session.getUser();
  const containerPending = document.getElementById('myBookingsPending');
  const containerConfirmed = document.getElementById('myBookingsConfirmed');
  const containerInProgress = document.getElementById('myBookingsInProgress');
  const my = state.bookings.filter(b => b.userId === user.id);

  const fmtDate = (iso) => {
    if (!iso) return '-';
    try { const d = new Date(iso); return d.toLocaleString(); } catch { return '-'; }
  };

  const statusBadge = (s) => {
    const key = (s || '').toLowerCase();
    const classMap = { pendiente: 'pending', confirmado: 'confirmado', 'en curso': 'en-curso', finalizado: 'finalizado' };
    const cls = classMap[key] || 'pending';
    return `<span class="status ${cls}">${s || '-'}</span>`;
  };

  const makeCard = (b) => {
    const route = state.routes.find(r => r.id === b.routeId) || {};
    const user = Session.getUser();
    const empresaId = user.empresaId;
    const price = getPriceWithEmpresa(route, empresaId);
    return `
    <div class="booking-card">
      <div class="booking-media" style="background-image:url('${route.image || ''}')"></div>
      <div class="booking-content">
        <div class="booking-header">
          <h4>${route.name || b.label || 'Servicio'}</h4>
          ${statusBadge(b.status)}
        </div>
        <div class="booking-meta">
          <div><strong>ID:</strong> ${b.id}</div>
          <div><strong>Tipo:</strong> ${route.type || (b.serviceType || '-')}</div>
          <div><strong>Conductor:</strong> ${b.driverId || 'Sin asignar'}</div>
          <div><strong>Creada:</strong> ${fmtDate(b.createdAt)}</div>
        </div>
      </div>
      <div class="booking-aside">
        <div class="price">$${price || '-'}</div>
      </div>
    </div>`;
  };

  const renderList = (items) => {
    if (!items || items.length === 0) return '<div class="muted">Sin reservas</div>';
    return `<div class="booking-list">${items.map(makeCard).join('')}</div>`;
  };

  const pending = my.filter(b => !b.driverId);
  const confirmed = my.filter(b => {
    const s = (b.status || '').toLowerCase();
    return (s === 'confirmado') || (b.driverId && s !== 'en curso');
  });
  const inProgress = my.filter(b => (b.status || '').toLowerCase() === 'en curso');

  if (containerPending) containerPending.innerHTML = renderList(pending);
  if (containerConfirmed) containerConfirmed.innerHTML = renderList(confirmed);
  if (containerInProgress) containerInProgress.innerHTML = renderList(inProgress);

  const current = my.find(b => b.status === 'En Curso' && b.driverId);
  const map = document.getElementById('trackingMap');
  map.innerHTML = '';
  if (trackingInterval?.stop) { trackingInterval.stop(); trackingInterval = null; }
  if (current) {
    startLeafletTracking(map, [-0.1807, -78.4678]).then(inst => { trackingInterval = inst; });
  } else {
    // Mostrar siempre un mapa real como base
    initLeafletMap(map, { center: [-0.1807, -78.4678], zoom: 12 });
  }
}

function renderHistory() {
  const user = Session.getUser();
  const container = document.getElementById('bookingHistory');
  if (!container) return;
  const my = state.bookings.filter(b => b.userId === user.id).filter(b => {
    const s = (b.status || '').toLowerCase();
    return s.includes('finaliz') || s.includes('complet');
  });
  const rows = my.map(b => {
    const route = state.routes.find(r => r.id === b.routeId);
    return `
      <tr>
        <td>${b.id}</td><td>${route?.name || '-'}</td><td>${b.status}</td><td>${b.driverId || '-'}</td>
      </tr>`;
  }).join('');
  container.innerHTML = `<table><thead><tr><th>ID</th><th>Ruta</th><th>Estado</th><th>Conductor</th></tr></thead><tbody>${rows || '<tr><td colspan=4>Sin historial</td></tr>'}</tbody></table>`;
}

function bindTabs() {
  // Tabs externas
  const outerTabs = document.querySelectorAll('#outerTabs .tab');
  const sections = {
    catalogo: document.getElementById('tab-catalogo'),
    reservas: document.getElementById('tab-reservas'),
    historial: document.getElementById('tab-historial'),
  };
  outerTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      outerTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeOuterTab = tab.getAttribute('data-tab');
      Object.entries(sections).forEach(([key, el]) => {
        if (!el) return;
        if (key === state.activeOuterTab) el.classList.remove('hidden'); else el.classList.add('hidden');
      });
      if (state.activeOuterTab === 'catalogo') renderCatalog();
      if (state.activeOuterTab === 'reservas') renderBookings();
      if (state.activeOuterTab === 'historial') renderHistory();
    });
  });

  // Subtabs internas en Reservas
  const innerTabs = document.querySelectorAll('#innerTabs .tab');
  const innerPanels = {
    'pendiente': document.getElementById('panel-pendiente'),
    'confirmado': document.getElementById('panel-confirmado'),
    'en-curso': document.getElementById('panel-en-curso'),
  };
  innerTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      innerTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeInnerTab = tab.getAttribute('data-subtab');
      Object.entries(innerPanels).forEach(([key, el]) => {
        if (!el) return;
        if (key === state.activeInnerTab) el.classList.remove('hidden'); else el.classList.add('hidden');
      });
    });
  });

  // Subtabs en Catálogo
  const catalogTabs = document.querySelectorAll('#catalogTabs .tab');
  const catalogPanels = {
    'rutas': document.getElementById('catalog-panel-rutas'),
    'encomienda': document.getElementById('catalog-panel-encomienda'),
    'p2p': document.getElementById('catalog-panel-p2p'),
    'aeropuerto': document.getElementById('catalog-panel-aeropuerto'),
  };
  catalogTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      catalogTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.catalogTab = tab.getAttribute('data-cat');
      Object.entries(catalogPanels).forEach(([key, el]) => {
        if (!el) return;
        if (key === state.catalogTab) el.classList.remove('hidden'); else el.classList.add('hidden');
      });
      if (state.catalogTab === 'rutas') renderCatalog();
    });
  });

  // Modalidad Rutas (Privada/Compartida)
  const routeModeTabs = document.querySelectorAll('#routeModeTabs .tab');
  routeModeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      routeModeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.routeMode = tab.getAttribute('data-mode');
      renderCatalog();
    });
  });

  // Formularios de Catálogo: Encomienda, P2P y Aeropuerto
  const formEncomienda = document.getElementById('formEncomienda');
  if (formEncomienda) formEncomienda.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = Session.getUser();
    const id = `b${Date.now()}`;
    const payload = {
      id,
      userId: user.id,
      routeId: null,
      status: 'Pendiente',
      driverId: null,
      createdAt: new Date().toISOString(),
      serviceType: 'encomienda',
      label: 'Encomienda',
      empresaId: user.empresaId,
      details: {
        remitente: document.getElementById('encRemitente')?.value,
        destinatario: document.getElementById('encDestinatario')?.value,
        telefono: document.getElementById('encTelefono')?.value,
        descripcion: document.getElementById('encDescripcion')?.value,
        origen: document.getElementById('encOrigen')?.value,
        destino: document.getElementById('encDestino')?.value,
      }
    };
    state.bookings.push(payload);
    Storage.save('data:bookings', state.bookings);
    notify('Solicitud de encomienda creada para tu empresa. Esperando asignación.', 'success');
    // Reset y cambiar a Reservas
    formEncomienda.reset();
    switchToReservations();
  });

  const formP2P = document.getElementById('formP2P');
  if (formP2P) formP2P.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = Session.getUser();
    const id = `b${Date.now()}`;
    const payload = {
      id,
      userId: user.id,
      routeId: null,
      status: 'Pendiente',
      driverId: null,
      createdAt: new Date().toISOString(),
      serviceType: 'p2p',
      label: 'Traslado Punto a Punto',
      empresaId: user.empresaId,
      details: {
        origen: document.getElementById('p2pOrigen')?.value,
        destino: document.getElementById('p2pDestino')?.value,
        fecha: document.getElementById('p2pFecha')?.value,
        notas: document.getElementById('p2pNotas')?.value,
      }
    };
    state.bookings.push(payload);
    Storage.save('data:bookings', state.bookings);
    notify('Solicitud de traslado creada para tu empresa. Esperando asignación.', 'success');
    formP2P.reset();
    switchToReservations();
  });

  const formAeropuerto = document.getElementById('formAeropuerto');
  if (formAeropuerto) formAeropuerto.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = Session.getUser();
    const id = `b${Date.now()}`;
    const payload = {
      id,
      userId: user.id,
      routeId: null,
      status: 'Pendiente',
      driverId: null,
      createdAt: new Date().toISOString(),
      serviceType: 'aeropuerto',
      label: 'Transfer Aeropuerto',
      empresaId: user.empresaId,
      details: {
        tipo: document.getElementById('airTipo')?.value,
        vuelo: document.getElementById('airVuelo')?.value,
        fecha: document.getElementById('airFecha')?.value,
        direccion: document.getElementById('airDireccion')?.value,
      }
    };
    state.bookings.push(payload);
    Storage.save('data:bookings', state.bookings);
    notify('Solicitud de transfer creada para tu empresa. Esperando asignación.', 'success');
    formAeropuerto.reset();
    switchToReservations();
  });
}

function switchToReservations() {
  // Cambia a pestaña Reservas y subtab Pendiente
  const reservasTab = document.querySelector('#outerTabs .tab[data-tab="reservas"]');
  if (reservasTab) reservasTab.click();
  const pendienteTab = document.querySelector('#innerTabs .tab[data-subtab="pendiente"]');
  if (pendienteTab) pendienteTab.click();
  renderBookings();
}

function pollChanges() {
  const user = Session.getUser();
  const my = state.bookings.filter(b => b.userId === user.id);
  const current = my.map(b => ({ id: b.id, status: b.status || '', driverId: b.driverId || null }));
  const snapshot = JSON.stringify(current);
  if (lastSnapshot) {
    try {
      const prev = JSON.parse(lastSnapshot);
      const prevMap = new Map(prev.map(x => [x.id, x]));
      current.forEach(now => {
        const before = prevMap.get(now.id);
        if (!before) return;
        const prevStatus = (before.status || '').toLowerCase();
        const nowStatus = (now.status || '').toLowerCase();
        // Notificación al pasar a Confirmado
        if (prevStatus !== 'confirmado' && nowStatus === 'confirmado') {
          notify(`Tu reserva ${now.id} ha sido confirmada.`, 'success');
        }
        // Notificación si se asigna driver aunque estado no haya cambiado aún
        if (!before.driverId && now.driverId && nowStatus !== 'confirmado' && nowStatus !== 'en curso') {
          notify(`Tu reserva ${now.id} ha sido asignada.`, 'info');
        }
        // Notificación al pasar a En Curso
        if (prevStatus !== 'en curso' && nowStatus === 'en curso') {
          notify(`Tu reserva ${now.id} ya está en curso.`, 'info');
        }
      });
    } catch {}
    // Re-render en cualquier cambio
    if (lastSnapshot !== snapshot) {
    renderBookings();
    }
  }
  lastSnapshot = snapshot;
}

function main() {
  const user = requireRole('clienteEmpresa'); if (!user) return;
  mountSharedChrome();
  bindTabs();
  renderCatalog();
  // solo renderizar reservas e historial cuando toque su tab
  setInterval(() => { state.bookings = Storage.load('data:bookings', db.bookings); pollChanges(); }, 1000);
}

document.addEventListener('DOMContentLoaded', main);


