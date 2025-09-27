import { db, Storage, mountSharedChrome, requireRole, Session, notify, startLeafletTracking, initLeafletMap, ensureLeaflet, getPriceForUser } from '../shared/assets/scripts.js';

const state = {
  routes: Storage.load('data:routes', db.routes),
  bookings: Storage.load('data:bookings', db.bookings),
  activeOuterTab: 'catalogo',
  activeInnerTab: 'pendiente',
  catalogTab: 'rutas',
  routeMode: 'privada',
};

let lastSnapshot = null;
let trackingInterval = null;
let shownNotifications = new Set(); // Para rastrear notificaciones ya mostradas
// Selecciones de mapa para Encomienda
let encPickup = { origen: null, destino: null };
// Registro de mapas por contenedor para evitar re-inicialización
const containerIdToLeafletMap = new WeakMap();
function getOrResetLeafletMap(container, center, zoom) {
  // Si ya hay un mapa en este contenedor, elimínalo antes de crear otro
  const existing = containerIdToLeafletMap.get(container);
  if (existing && existing.remove) {
    try { existing.remove(); } catch {}
    containerIdToLeafletMap.delete(container);
  }
  container.innerHTML = '';
  return initLeafletMap(container, { center, zoom }).then(map => {
    containerIdToLeafletMap.set(container, map);
    return map;
  });
}

function renderCatalog() {
  const list = document.getElementById('catalog');
  const routes = state.routes.filter(r => (r.type || 'tour').toLowerCase() === 'tour');
  const userRole = Session.getUser()?.role || 'cliente';
  const fmtUSD = (n) => `$${Number(n).toFixed(2)} usd`;
  list.innerHTML = routes.map(r => {
    const displayPrice = getPriceForUser(r, userRole);
    const childPrice = (typeof r.childPrice === 'number' && isFinite(r.childPrice)) ? r.childPrice : null;
    return `
    <div class="tour-card">
      <div class="tour-media" style="background-image:url('${r.image || ''}')"></div>
      <div class="tour-body">
        <div class="badge">${r.type}</div>
        <h4>${r.name}</h4>
        <div class="price-section">
          <div class="price-title">General</div>
          <div class="price-grid">
            <div class="price-col">
              <div class="price-label">Adultos</div>
              <div class="price-value">${fmtUSD(displayPrice)}</div>
            </div>
            <div class="price-col">
              <div class="price-label">Niños</div>
              <div class="price-value">${childPrice !== null ? fmtUSD(childPrice) : '-'}</div>
            </div>
          </div>
        </div>
        <div class="actions">
          <div style="display:flex; gap:8px;">
            <button class="btn ghost" data-view="${r.id}">Ver</button>
            <button class="btn primary" data-book="${r.id}">Reservar</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('button[data-book]')?.forEach(btn => {
    btn.addEventListener('click', () => openBookingModal(btn.getAttribute('data-book')));
  });
  const modal = document.getElementById('routeModal');
  const backdrop = document.getElementById('routeBackdrop');
  const close = () => { modal.classList.remove('show'); backdrop.classList.remove('show'); };
  document.getElementById('closeRoute').onclick = close;
  document.getElementById('routeCloseBtn').onclick = close;
  list.querySelectorAll('button[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = state.routes.find(x => x.id === btn.getAttribute('data-view'));
      const userRole = Session.getUser()?.role || 'cliente';
      const displayPrice = getPriceForUser(r, userRole);
      const childPrice = (typeof r.childPrice === 'number' && isFinite(r.childPrice)) ? r.childPrice : null;
      document.getElementById('routeTitle').textContent = r.name;
      document.getElementById('routeBody').innerHTML = `
        <div class="grid cols-2">
          <div style="min-height:160px;background:url('${r.image||''}') center/cover;border-radius:8px;border:1px solid var(--border);"></div>
          <div>
            <p class="muted">Tipo: ${r.type}</p>
            <p>${r.description || ''}</p>
            <p><strong>Adultos:</strong> $${Number(displayPrice).toFixed(2)} usd</p>
            ${childPrice !== null ? `<p><strong>Niños:</strong> $${Number(childPrice).toFixed(2)} usd</p>` : ''}
          </div>
        </div>`;
      modal.classList.add('show'); backdrop.classList.add('show');
    });
  });
}

function createBooking(routeId) {
  const user = Session.getUser();
  const id = `b${Date.now()}`;
  state.bookings.push({ id, userId: user.id, routeId, status: 'Pendiente', driverId: null, createdAt: new Date().toISOString(), mode: state.routeMode, serviceType: 'tour' });
  Storage.save('data:bookings', state.bookings);
  renderBookings();
  notify('Reserva creada. Esperando asignación.', 'success');
}

// Modal de reserva con campos por modalidad
let bookingRouteId = null;
let pickupPoint = null;
function openBookingModal(routeId) {
  bookingRouteId = routeId;
  const modal = document.getElementById('bookingModal');
  const backdrop = document.getElementById('bookingBackdrop');
  const title = document.getElementById('bookingTitle');
  const hint = document.getElementById('bookingModeHint');
  const route = state.routes.find(r => r.id === routeId);
  title.textContent = `Reservar: ${route?.name || 'Ruta'}`;

  const isPrivada = (state.routeMode || 'privada') === 'privada';
  const elPrivada = document.getElementById('bkPrivadaOnly');
  const elCompartida = document.getElementById('bkCompartidaOnly');
  if (elPrivada) elPrivada.classList.toggle('hidden', !isPrivada);
  if (elCompartida) elCompartida.classList.toggle('hidden', isPrivada);
  // Fecha/Hora fijas en compartida
  const fNote = document.getElementById('bkFechaFijaNote');
  const hNote = document.getElementById('bkHoraFijaNote');
  const fInput = document.getElementById('bkFechaDate');
  const hInput = document.getElementById('bkHora');
  if (!isPrivada) {
    if (fNote) fNote.classList.remove('hidden');
    if (hNote) hNote.classList.remove('hidden');
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const dd = String(now.getDate()+1).padStart(2,'0');
    if (fInput) { fInput.value = `${yyyy}-${mm}-${dd}`; fInput.disabled = true; }
    if (hInput) { hInput.value = '10:00'; hInput.disabled = true; }
    const disp = document.getElementById('bkDisponibles');
    if (disp) disp.textContent = 'Asientos disponibles: 8';
  } else {
    if (fNote) fNote.classList.add('hidden');
    if (hNote) hNote.classList.add('hidden');
    if (fInput) { fInput.disabled = false; fInput.value = ''; }
    if (hInput) { hInput.disabled = false; hInput.value = ''; }
    const disp = document.getElementById('bkDisponibles');
    if (disp) disp.textContent = '';
  }
  hint.textContent = isPrivada ? 'Modalidad: Privada (se reserva el vehículo completo)' : 'Modalidad: Compartida (elige asientos y punto de encuentro)';

  modal.classList.add('show');
  backdrop.classList.add('show');

  // Bind mapa para ubicación
  const openMapBtn = document.getElementById('bkOpenMap');
  const mapModal = document.getElementById('bkMapModal');
  const mapBackdrop = document.getElementById('bkMapBackdrop');
  const mapContainer = document.getElementById('bkMap');
  const closeMap = () => { mapModal.classList.remove('show'); mapBackdrop.classList.remove('show'); };
  if (openMapBtn) openMapBtn.onclick = async () => {
    mapModal.classList.add('show'); mapBackdrop.classList.add('show');
    await ensureLeaflet();
    const map = await getOrResetLeafletMap(mapContainer, [-0.1807, -78.4678], 12);
    let marker = null;
    map.on('click', (e) => {
      pickupPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (!marker) marker = L.marker([pickupPoint.lat, pickupPoint.lng]).addTo(map);
      else marker.setLatLng([pickupPoint.lat, pickupPoint.lng]);
      const prev = document.getElementById('bkPickPreview');
      if (prev) prev.textContent = `Coordenadas: ${pickupPoint.lat.toFixed(5)}, ${pickupPoint.lng.toFixed(5)}`;
    });
    setTimeout(()=>{ try { map.invalidateSize(); } catch {} }, 50);
    document.getElementById('bkUseMap').onclick = () => { closeMap(); };
    document.getElementById('bkCloseMap').onclick = closeMap;
    document.getElementById('bkCancelMap').onclick = closeMap;
  };

  // Cálculo dinámico de precios en el modal
  const priceAdultEl = document.getElementById('bkPriceAdultos');
  const priceChildEl = document.getElementById('bkPriceNinos');
  const priceTotalEl = document.getElementById('bkPriceTotal');
  const selAdultos = document.getElementById('bkAdultos');
  const selNinos = document.getElementById('bkNinos');
  const userRole = Session.getUser()?.role || 'cliente';
  const baseAdult = getPriceForUser(route, userRole) || 0;
  const baseChild = (typeof route?.childPrice === 'number' && isFinite(route.childPrice)) ? route.childPrice : null;
  function fmt(n) { return `$${Number(n).toFixed(2)} USD`; }
  function setOrDash(el, val) { if (el) el.textContent = (val === null || val === undefined) ? '-' : val; }
  function recalcPrice() {
    const adults = parseInt(selAdultos?.value || '0', 10);
    const childs = parseInt(selNinos?.value || '0', 10);
    const adultSubtotal = adults > 0 ? adults * baseAdult : null;
    const childSubtotal = (baseChild !== null && childs > 0) ? childs * baseChild : (childs > 0 && baseChild === null ? 0 : null);
    const total = (adultSubtotal || 0) + (childSubtotal || 0);
    setOrDash(priceAdultEl, adults > 0 ? fmt(adultSubtotal) : '-');
    setOrDash(priceChildEl, childs > 0 ? (baseChild !== null ? fmt(childSubtotal) : '-') : '-');
    const showTotal = (adults > 0) || (childs > 0 && baseChild !== null);
    setOrDash(priceTotalEl, showTotal ? fmt(total) : '-');
  }
  if (selAdultos) selAdultos.addEventListener('change', recalcPrice);
  if (selNinos) selNinos.addEventListener('change', recalcPrice);
  recalcPrice();
}

// Mapa para Encomienda: origen/destino
let encMapCurrentKind = null; // 'origen' | 'destino'
async function openEncMap(kind) {
  encMapCurrentKind = kind;
  const modal = document.getElementById('encMapModal');
  const backdrop = document.getElementById('encMapBackdrop');
  const title = document.getElementById('encMapTitle');
  const mapContainer = document.getElementById('encMap');
  if (!modal || !backdrop || !mapContainer) return;
  title.textContent = kind === 'origen' ? 'Selecciona punto de Origen' : 'Selecciona punto de Destino';
  modal.classList.add('show');
  backdrop.classList.add('show');
  await ensureLeaflet();
  const map = await getOrResetLeafletMap(mapContainer, [-0.1807, -78.4678], 12);
  let marker = null;
  map.on('click', (e) => {
    const point = { lat: e.latlng.lat, lng: e.latlng.lng };
    if (!marker) marker = L.marker([point.lat, point.lng]).addTo(map);
    else marker.setLatLng([point.lat, point.lng]);
    if (kind === 'origen') encPickup.origen = point; else encPickup.destino = point;
  });
  setTimeout(() => { try { map.invalidateSize(); } catch {} }, 50);
  const close = () => { modal.classList.remove('show'); backdrop.classList.remove('show'); };
  const applyPoint = () => {
    if (kind === 'origen' && encPickup.origen) {
      const { lat, lng } = encPickup.origen;
      const prev = document.getElementById('encOrigenPreview');
      const latEl = document.getElementById('encOrigenLat');
      const lngEl = document.getElementById('encOrigenLng');
      if (prev) prev.textContent = `Coordenadas origen: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (latEl) latEl.value = String(lat);
      if (lngEl) lngEl.value = String(lng);
    }
    if (kind === 'destino' && encPickup.destino) {
      const { lat, lng } = encPickup.destino;
      const prev = document.getElementById('encDestinoPreview');
      const latEl = document.getElementById('encDestinoLat');
      const lngEl = document.getElementById('encDestinoLng');
      if (prev) prev.textContent = `Coordenadas destino: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      if (latEl) latEl.value = String(lat);
      if (lngEl) lngEl.value = String(lng);
    }
    close();
  };
  const btnUse = document.getElementById('encUseMap');
  const btnClose = document.getElementById('encCloseMap');
  const btnCancel = document.getElementById('encCancelMap');
  if (btnUse) btnUse.onclick = applyPoint;
  if (btnClose) btnClose.onclick = close;
  if (btnCancel) btnCancel.onclick = close;
}

function closeBookingModal() {
  document.getElementById('bookingModal').classList.remove('show');
  document.getElementById('bookingBackdrop').classList.remove('show');
}

// Modal de checkout grande
function openCheckoutModal(tempBooking) {
  // Rellenar resumen
  const route = state.routes.find(r => r.id === tempBooking.routeId);
  const fecha = new Date(tempBooking.details?.fecha || tempBooking.createdAt || Date.now());
  const fmt = (n) => n.toString().padStart(2, '0');
  const fechaStr = `${fmt(fecha.getDate())}/${fmt(fecha.getMonth()+1)}/${fecha.getFullYear()}`;
  const horaStr = `${fmt(fecha.getHours())}:${fmt(fecha.getMinutes())}`;
  const pax = tempBooking.details?.pasajeros || 1;
  document.getElementById('sumTour').textContent = route?.name || '-';
  document.getElementById('sumFecha').textContent = fechaStr;
  document.getElementById('sumHora').textContent = horaStr;
  document.getElementById('sumPersonas').textContent = `${pax} ${pax===1?'Persona':'Personas'}`;
  const userRole = Session.getUser()?.role || 'cliente';
  const displayPrice = getPriceForUser(route, userRole);
  const draftTotal = typeof tempBooking?.details?.total === 'number' ? tempBooking.details.total : null;
  document.getElementById('sumSubtotal').textContent = draftTotal !== null ? `$${draftTotal.toFixed(2)} USD` : `$${(displayPrice || 0).toFixed(2)} USD`;

  const modal = document.getElementById('checkoutModal');
  const backdrop = document.getElementById('checkoutBackdrop');
  modal.classList.add('show');
  backdrop.classList.add('show');

  // Bind cierre/confirmación
  const close = () => { modal.classList.remove('show'); backdrop.classList.remove('show'); };
  const closeBtn = document.getElementById('closeCheckout');
  const cancelBtn = document.getElementById('cancelCheckout');
  if (closeBtn) closeBtn.onclick = close;
  if (cancelBtn) cancelBtn.onclick = (e) => { e.preventDefault(); close(); };
  const confirmBtn = document.getElementById('confirmCheckout');
  if (confirmBtn) confirmBtn.onclick = (e) => {
    e.preventDefault();
    const payMethod = (document.getElementById('ckPago')?.value || '').toLowerCase();
    if (payMethod === 'tarjeta') {
      // Guardar borrador y navegar a pantalla de pago con tarjeta
      Storage.save('draft:booking', tempBooking);
      close();
      window.location.href = 'pago-tarjeta.html';
      return;
    }
    // Otros métodos: guardar de inmediato
    const final = tempBooking;
    state.bookings.push(final);
    Storage.save('data:bookings', state.bookings);
    notify('Reserva confirmada. Recibirás un correo de confirmación.', 'success');
    close();
    switchToReservations();
  };
}

function renderBookings() {
  const user = Session.getUser();
  const containerPending = document.getElementById('myBookingsPending');
  const containerConfirmed = document.getElementById('myBookingsConfirmed');
  const containerInProgress = document.getElementById('myBookingsInProgress');
  const my = state.bookings.filter(b => b.userId === user.id);
  
  // Verificar si hay reservas confirmadas y mostrar notificación una sola vez
  const confirmedBookings = my.filter(b => {
    const s = (b.status || '').toLowerCase();
    return (s === 'confirmado') || (b.driverId && s !== 'en curso');
  });
  
  if (confirmedBookings.length > 0 && !shownNotifications.has('confirmed-on-entry')) {
    showFloatingNotification(`¡Tienes ${confirmedBookings.length} reserva${confirmedBookings.length > 1 ? 's' : ''} confirmada${confirmedBookings.length > 1 ? 's' : ''}!`, 'success');
    shownNotifications.add('confirmed-on-entry');
  }

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
    const pax = b?.details?.pasajeros;
    const total = b?.details?.total;
    const driver = b.driverId ? db.drivers.find(d => d.id === b.driverId) : null;
    const vehicle = driver?.vehicleId ? db.fleet.find(v => v.id === driver.vehicleId) : null;
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
          <div><strong>Conductor:</strong> ${driver ? driver.name : 'Sin asignar'}</div>
          ${driver ? `<div><strong>Teléfono Conductor:</strong> ${driver.phone}</div>` : ''}
          ${vehicle ? `<div><strong>Vehículo:</strong> ${vehicle.brand} ${vehicle.model} - ${vehicle.plate}</div>` : ''}
          ${vehicle ? `<div><strong>Capacidad:</strong> ${vehicle.capacity} pasajeros</div>` : ''}
          <div><strong>Creada:</strong> ${fmtDate(b.createdAt)}</div>
          ${pax ? `<div><strong>Pasajeros:</strong> ${pax}</div>` : ''}
          ${typeof total === 'number' ? `<div><strong>Total:</strong> $${total.toFixed(2)} USD</div>` : ''}
        </div>
      </div>
      <div class="booking-aside">
        <div class="price">${typeof total === 'number' ? `$${total.toFixed(2)} USD` : (route.basePrice ? `$${route.basePrice}` : '-')}</div>
        <button class="btn danger" data-delete="${b.id}">Eliminar</button>
      </div>
    </div>`;
  };

  const renderList = (items) => {
    if (!items || items.length === 0) {
      return `
        <div class="booking-empty" role="status" aria-live="polite">
          <div class="empty-inner">
            <div class="empty-icon" aria-hidden="true">🗂️</div>
            <div class="empty-text">Sin reservas</div>
          </div>
        </div>`;
    }
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

  // Bind eliminar
  document.querySelectorAll('button[data-delete]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete');
      const ok = confirm('¿Seguro que deseas eliminar esta reserva?');
      if (!ok) return;
      const idx = state.bookings.findIndex(x => x.id === id);
      if (idx >= 0) {
        state.bookings.splice(idx, 1);
        Storage.save('data:bookings', state.bookings);
        notify('Reserva eliminada', 'success');
        renderBookings();
      }
    });
  });

  // Contadores en tabs internas
  const tabPend = document.querySelector('#innerTabs .tab[data-subtab="pendiente"]');
  const tabConf = document.querySelector('#innerTabs .tab[data-subtab="confirmado"]');
  const tabCurso = document.querySelector('#innerTabs .tab[data-subtab="en-curso"]');
  if (tabPend) tabPend.innerHTML = `Pendiente <span class="tab-count">${pending.length}</span>`;
  if (tabConf) tabConf.innerHTML = `Confirmado <span class="tab-count">${confirmed.length}</span>`;
  if (tabCurso) tabCurso.innerHTML = `En Curso <span class="tab-count">${inProgress.length}</span>`;

  const current = my.find(b => (b.status || '').toLowerCase() === 'en curso' && b.driverId);
  const map = document.getElementById('trackingMap');
  if (!map) return;
  map.innerHTML = '';
  if (trackingInterval?.stop) { trackingInterval.stop(); trackingInterval = null; }
  (async () => {
    try {
      await ensureLeaflet();
      if (current) {
        const inst = await startLeafletTracking(map, [-0.1807, -78.4678]);
        trackingInterval = inst;
        setTimeout(() => { try { inst.map.invalidateSize(); } catch {} }, 50);
      } else {
        const m = await initLeafletMap(map, { center: [-0.1807, -78.4678], zoom: 12 });
        setTimeout(() => { try { m.invalidateSize(); } catch {} }, 50);
      }
    } catch {}
  })();
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
  const routeModeSelect = document.getElementById('routeModeSelect');
  if (routeModeSelect) {
    routeModeSelect.addEventListener('change', () => {
      state.routeMode = routeModeSelect.value;
      renderCatalog();
    });
  }

  // Formularios de Catálogo: Encomienda, P2P y Aeropuerto
  const formEncomienda = document.getElementById('formEncomienda');
  // Botones mapa Encomienda
  const btnMapOrigen = document.getElementById('encOpenMapOrigen');
  const btnMapDestino = document.getElementById('encOpenMapDestino');
  if (btnMapOrigen) btnMapOrigen.addEventListener('click', () => openEncMap('origen'));
  if (btnMapDestino) btnMapDestino.addEventListener('click', () => openEncMap('destino'));
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
      details: {
        remitente: document.getElementById('encRemitente')?.value,
        destinatario: document.getElementById('encDestinatario')?.value,
        telefono: document.getElementById('encTelefono')?.value,
        descripcion: document.getElementById('encDescripcion')?.value,
        pesoKg: parseFloat(document.getElementById('encPeso')?.value || '0') || 0,
        origen: document.getElementById('encOrigen')?.value,
        destino: document.getElementById('encDestino')?.value,
        origenCoords: encPickup.origen || (
          (() => {
            const lat = parseFloat(document.getElementById('encOrigenLat')?.value || '');
            const lng = parseFloat(document.getElementById('encOrigenLng')?.value || '');
            return isFinite(lat) && isFinite(lng) ? { lat, lng } : null;
          })()
        ),
        destinoCoords: encPickup.destino || (
          (() => {
            const lat = parseFloat(document.getElementById('encDestinoLat')?.value || '');
            const lng = parseFloat(document.getElementById('encDestinoLng')?.value || '');
            return isFinite(lat) && isFinite(lng) ? { lat, lng } : null;
          })()
        ),
      }
    };
    state.bookings.push(payload);
    Storage.save('data:bookings', state.bookings);
    notify('Solicitud de encomienda creada. Esperando asignación.', 'success');
    // Reset y cambiar a Reservas
    formEncomienda.reset();
    encPickup = { origen: null, destino: null };
    const p1 = document.getElementById('encOrigenPreview'); if (p1) p1.textContent = '';
    const p2 = document.getElementById('encDestinoPreview'); if (p2) p2.textContent = '';
    switchToReservations();
  });

  const formP2P = document.getElementById('formP2P');
  // P2P: carga de provincias/ciudades y mapa
  const provO = document.getElementById('p2pProvOrigen');
  const cityO = document.getElementById('p2pCiudadOrigen');
  const provD = document.getElementById('p2pProvDestino');
  const cityD = document.getElementById('p2pCiudadDestino');
  const priceEl = document.getElementById('p2pPrecio');
  const p2pPersonasEl = document.getElementById('p2pPersonas');
  const btnMapP2POrigen = document.getElementById('p2pOpenMapOrigen');
  if (btnMapP2POrigen) btnMapP2POrigen.addEventListener('click', () => openP2PMapOrigen());

  // Datos de provincias/ciudades (placeholder si no existe fuente externa)
  let jsonProvincias = Storage.load('data:jsonProvincias', null);
  async function ensureJsonProvincias() {
    if (jsonProvincias) return jsonProvincias;
    // 1) Intentar desde script embebido en el HTML
    try {
      const inline = document.getElementById('jsonProvinciasData');
      if (inline && inline.textContent && inline.textContent.trim().length > 0) {
        const raw = JSON.parse(inline.textContent);
        const provincias = Array.isArray(raw?.provincias) ? raw.provincias : [];
        jsonProvincias = provincias.map(p => ({
          nombre: p.nombre,
          ciudades: (p.ciudades || []).map(c => (typeof c === 'string' ? { nombre: c } : { nombre: c?.nombre || String(c || '') }))
        }));
        Storage.save('data:jsonProvincias', jsonProvincias);
        return jsonProvincias;
      }
    } catch {}
    try {
      // Intenta cargar el archivo en varias rutas y parsear como texto si es necesario
      const candidates = ['../jsonProvincias', '../jsonProvincias.json', '../../jsonProvincias', '../../jsonProvincias.json'];
      for (const path of candidates) {
        try {
          const resp = await fetch(path, { cache: 'no-store' });
          if (!resp.ok) continue;
          let raw;
          try { raw = await resp.json(); }
          catch {
            const txt = await resp.text();
            raw = JSON.parse(txt);
          }
          const provincias = Array.isArray(raw?.provincias) ? raw.provincias : [];
          if (!Array.isArray(provincias) || provincias.length === 0) continue;
          jsonProvincias = provincias.map(p => ({
            nombre: p.nombre,
            ciudades: (p.ciudades || []).map(c => (typeof c === 'string' ? { nombre: c } : { nombre: c?.nombre || String(c || '') }))
          }));
          Storage.save('data:jsonProvincias', jsonProvincias);
          return jsonProvincias;
        } catch {}
      }
    } catch {}
    // Fallback mínimo si no existe el archivo
    jsonProvincias = [
      { nombre: 'Pichincha', ciudades: [
        { nombre: 'Quito', centro: { lat: -0.22985, lng: -78.52495 }, factor: 1.0 },
      ]},
    ];
    Storage.save('data:jsonProvincias', jsonProvincias);
    notify('No se pudo cargar jsonProvincias. Usando datos mínimos.', 'info');
    return jsonProvincias;
  }

  function fillProvinces(select, provincias) {
    if (!select) return;
    select.innerHTML = provincias.map((p, i) => `<option value="${i}">${p.nombre}</option>`).join('');
  }
  function fillCities(select, provinciaIdx) {
    if (!select) return;
    const p = jsonProvincias[provinciaIdx];
    select.innerHTML = (p?.ciudades || []).map((c, i) => `<option value="${i}">${c.nombre || c}</option>`).join('');
  }
  async function initP2PSelects() {
    const data = await ensureJsonProvincias();
    if (provO && provD) {
      fillProvinces(provO, data);
      fillProvinces(provD, data);
      fillCities(cityO, provO.value || 0);
      fillCities(cityD, provD.value || 0);
      provO.addEventListener('change', () => { fillCities(cityO, provO.value); });
      provD.addEventListener('change', () => { fillCities(cityD, provD.value); updateP2PPrice(); });
      cityD.addEventListener('change', updateP2PPrice);
      updateP2PPrice();
    }
  }
  function getSelectedDestinoFactor() {
    if (!provD || !cityD) return 1;
    const provIndex = parseInt(provD.value || '0', 10);
    const cityIndex = parseInt(cityD.value || '0', 10);
    const p = jsonProvincias[provIndex];
    const c = p?.ciudades?.[cityIndex];
    // Si no hay factor en datos, generar uno simple según índices para variar precio
    const inferred = 1 + (provIndex * 0.03) + (cityIndex * 0.01);
    return (c && typeof c.factor === 'number') ? c.factor : inferred;
  }
  function updateP2PPrice() {
    const base = 12; // tarifa base referencia
    const factor = getSelectedDestinoFactor();
    const personas = Math.max(1, parseInt(p2pPersonasEl?.value || '1', 10));
    const price = base * factor * Math.min(personas, 4);
    if (priceEl) priceEl.value = `$${price.toFixed(2)} USD`;
  }
  function getSelectedCityCenter(kind) {
    const provSel = kind === 'origen' ? provO : provD;
    const citySel = kind === 'origen' ? cityO : cityD;
    const p = jsonProvincias[parseInt(provSel?.value || '0', 10)];
    const c = p?.ciudades?.[parseInt(citySel?.value || '0', 10)];
    return c?.centro || { lat: -0.1807, lng: -78.4678 };
  }
  // Mapa P2P Origen
  async function openP2PMapOrigen() {
    const modal = document.getElementById('bkMapModal');
    const backdrop = document.getElementById('bkMapBackdrop');
    const title = document.querySelector('#bkMapModal .modal-header strong');
    const mapContainer = document.getElementById('bkMap');
    if (!modal || !backdrop || !mapContainer) return;
    if (title) title.textContent = 'Selecciona punto de origen';
    modal.classList.add('show');
    backdrop.classList.add('show');
    await ensureLeaflet();
    const center = getSelectedCityCenter('origen');
    const map = await getOrResetLeafletMap(mapContainer, [center.lat, center.lng], 13);
    let marker = null;
    map.on('click', (e) => {
      const point = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (!marker) marker = L.marker([point.lat, point.lng]).addTo(map);
      else marker.setLatLng([point.lat, point.lng]);
      const prev = document.getElementById('p2pOrigenPreview');
      const latEl = document.getElementById('p2pOrigenLat');
      const lngEl = document.getElementById('p2pOrigenLng');
      if (prev) prev.textContent = `Coordenadas origen: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
      if (latEl) latEl.value = String(point.lat);
      if (lngEl) lngEl.value = String(point.lng);
    });
    setTimeout(() => { try { map.invalidateSize(); } catch {} }, 50);
    const close = () => { modal.classList.remove('show'); backdrop.classList.remove('show'); };
    const useBtn = document.getElementById('bkUseMap');
    const closeBtn = document.getElementById('bkCloseMap');
    const cancelBtn = document.getElementById('bkCancelMap');
    if (useBtn) useBtn.onclick = async () => {
      // Reverse geocoding para rellenar la caja de texto
      try {
        const lat = parseFloat(document.getElementById('p2pOrigenLat')?.value || '');
        const lng = parseFloat(document.getElementById('p2pOrigenLng')?.value || '');
        if (isFinite(lat) && isFinite(lng)) {
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (res.ok) {
            const data = await res.json();
            const display = data?.display_name || '';
            const input = document.getElementById('p2pOrigen');
            if (input && display) input.value = display;
          }
        }
      } catch {}
      close();
    };
    if (closeBtn) closeBtn.onclick = close;
    if (cancelBtn) cancelBtn.onclick = close;
  }

  initP2PSelects();
  if (p2pPersonasEl) p2pPersonasEl.addEventListener('input', updateP2PPrice);

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
      details: {
        origen: document.getElementById('p2pOrigen')?.value,
        origenProv: provO?.options?.[provO.selectedIndex]?.text || '',
        origenCiudad: cityO?.options?.[cityO.selectedIndex]?.text || '',
        origenCoords: (() => {
          const lat = parseFloat(document.getElementById('p2pOrigenLat')?.value || '');
          const lng = parseFloat(document.getElementById('p2pOrigenLng')?.value || '');
          return isFinite(lat) && isFinite(lng) ? { lat, lng } : null;
        })(),
        destinoProv: provD?.options?.[provD.selectedIndex]?.text || '',
        destinoCiudad: cityD?.options?.[cityD.selectedIndex]?.text || '',
        personas: Math.max(1, parseInt(p2pPersonasEl?.value || '1', 10)),
        precio: priceEl?.value || '',
        fecha: document.getElementById('p2pFecha')?.value,
        notas: document.getElementById('p2pNotas')?.value,
      }
    };
    state.bookings.push(payload);
    Storage.save('data:bookings', state.bookings);
    notify('Solicitud de traslado creada. Esperando asignación.', 'success');
    formP2P.reset();
    switchToReservations();
  });

  const formAeropuerto = document.getElementById('formAeropuerto');
  // Transfer Aeropuerto: selects y precio
  const airTipo = document.getElementById('airTipo');
  const airAeropuerto = document.getElementById('airAeropuerto');
  const airProv = document.getElementById('airProv');
  const airCiudad = document.getElementById('airCiudad');
  const airPrecio = document.getElementById('airPrecio');
  const airPersonas = document.getElementById('airPersonas');
  const airCitySectionTitle = document.getElementById('airCitySectionTitle');

  const aeropuertosAdmin = Storage.load('data:aeropuertos', [
    { id: 'uio', nombre: 'Quito (UIO)', provincia: 'Pichincha' },
    { id: 'gye', nombre: 'Guayaquil (GYE)', provincia: 'Guayas' },
    { id: 'cue', nombre: 'Cuenca (CUE)', provincia: 'Azuay' },
  ]);

  function fillAeropuertos() {
    if (!airAeropuerto) return;
    airAeropuerto.innerHTML = aeropuertosAdmin.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
  }

  function updateAirCityTitle() {
    if (!airCitySectionTitle || !airTipo) return;
    airCitySectionTitle.textContent = airTipo.value === 'llegada' ? 'Ciudad de Destino' : 'Ciudad de Origen';
  }

  function updateAirPrice() {
    if (!airPrecio) return;
    // Tarifa base por aeropuerto + factor por ciudad/prov destino/origen y cantidad de personas
    const baseMap = { uio: 18, gye: 16, cue: 14 };
    const aeropuertoId = airAeropuerto?.value || 'uio';
    const base = baseMap[aeropuertoId] || 15;
    const provIndex = parseInt(airProv?.value || '0', 10);
    const cityIndex = parseInt(airCiudad?.value || '0', 10);
    const factor = 1 + (provIndex * 0.03) + (cityIndex * 0.01);
    const personas = Math.max(1, parseInt(airPersonas?.value || '1', 10));
    const price = base * factor * Math.min(personas, 4); // supongamos hasta 4 sin recargo por vehículo
    airPrecio.value = `$${price.toFixed(2)} USD`;
  }

  async function initAirSelects() {
    fillAeropuertos();
    const data = await ensureJsonProvincias();
    if (airProv && airCiudad) {
      fillProvinces(airProv, data);
      fillCities(airCiudad, airProv.value || 0);
      airProv.addEventListener('change', () => { fillCities(airCiudad, airProv.value); updateAirPrice(); });
      airCiudad.addEventListener('change', updateAirPrice);
    }
    if (airTipo) airTipo.addEventListener('change', updateAirCityTitle);
    if (airPersonas) airPersonas.addEventListener('input', updateAirPrice);
    if (airAeropuerto) airAeropuerto.addEventListener('change', updateAirPrice);
    updateAirCityTitle();
    updateAirPrice();
  }

  initAirSelects();

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
      details: {
        tipo: airTipo?.value || 'salida',
        aeropuertoId: airAeropuerto?.value,
        aeropuerto: airAeropuerto?.options?.[airAeropuerto.selectedIndex]?.text || '',
        provincia: airProv?.options?.[airProv.selectedIndex]?.text || '',
        ciudad: airCiudad?.options?.[airCiudad.selectedIndex]?.text || '',
        personas: Math.max(1, parseInt(airPersonas?.value || '1', 10)),
        fecha: document.getElementById('airFecha')?.value,
        precio: airPrecio?.value || '',
      }
    };
    state.bookings.push(payload);
    Storage.save('data:bookings', state.bookings);
    notify('Solicitud de transfer creada. Esperando asignación.', 'success');
    formAeropuerto.reset();
    switchToReservations();
  });
}

function showFloatingNotification(message, type = 'success') {
  // Crear el contenedor de notificación flotante
  const notification = document.createElement('div');
  notification.className = `floating-notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-icon">
        ${type === 'success' ? '🎉' : type === 'error' ? '⚠️' : type === 'info' ? '🚀' : 'ℹ️'}
      </div>
      <div class="notification-message">
        <div class="notification-title">${type === 'success' ? '¡Excelente!' : type === 'info' ? '¡En marcha!' : type === 'error' ? 'Atención' : 'Información'}</div>
        <div class="notification-text">${message}</div>
      </div>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="notification-progress"></div>
  `;
  
  // Agregar al DOM
  document.body.appendChild(notification);
  
  // Animar entrada
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  // Auto-remover después de 6 segundos
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.add('hide');
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 400);
    }
  }, 6000);
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
        // Notificación al pasar a Confirmado (solo si no se ha mostrado antes)
        if (prevStatus !== 'confirmado' && nowStatus === 'confirmado' && !shownNotifications.has(now.id)) {
          showFloatingNotification(`¡Tu reserva ${now.id} ha sido confirmada!`, 'success');
          shownNotifications.add(now.id);
        }
        // Notificación si se asigna driver aunque estado no haya cambiado aún
        if (!before.driverId && now.driverId && nowStatus !== 'confirmado' && nowStatus !== 'en curso') {
          notify(`Tu reserva ${now.id} ha sido asignada.`, 'info');
        }
        // Notificación al pasar a En Curso
        if (prevStatus !== 'en curso' && nowStatus === 'en curso') {
          showFloatingNotification(`¡Tu reserva ${now.id} ya está en curso! ¡Disfruta tu viaje!`, 'info');
        }
        // Notificación al pasar a Completado
        if (prevStatus !== 'completado' && nowStatus === 'completado') {
          notify(`Tu reserva ${now.id} ha finalizado. ¡Gracias por viajar con nosotros!`, 'success');
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
  const user = requireRole('cliente'); if (!user) return;
  
  // Limpiar completamente todas las reservas existentes
  Storage.remove('data:bookings');
  state.bookings = [];
  
  mountSharedChrome();
  bindTabs();
  renderCatalog();
  // Bind modal booking
  const closeBk = document.getElementById('closeBooking');
  const cancelBk = document.getElementById('cancelBooking');
  const submitBk = document.getElementById('submitBooking');
  if (closeBk) closeBk.onclick = closeBookingModal;
  if (cancelBk) cancelBk.onclick = (e) => { e.preventDefault(); closeBookingModal(); };
  if (submitBk) submitBk.onclick = (e) => {
    e.preventDefault();
    const isPrivada = (state.routeMode || 'privada') === 'privada';
    // Combinar fecha + hora
    const fechaStr = document.getElementById('bkFechaDate')?.value;
    const horaStr = document.getElementById('bkHora')?.value;
    const fecha = (fechaStr && horaStr) ? new Date(`${fechaStr}T${horaStr}:00`).toISOString() : '';
    const notas = document.getElementById('bkNotas')?.value || '';
    const adultos = parseInt(document.getElementById('bkAdultos')?.value || '0', 10);
    const ninos = parseInt(document.getElementById('bkNinos')?.value || '0', 10);
    const pasajeros = Math.max(0, adultos) + Math.max(0, ninos);
    const asientos = parseInt(document.getElementById('bkAsientos')?.value || '1', 10);
    const ubicacionTxt = document.getElementById('bkUbicacion')?.value || '';
    if (!fecha) { notify('Selecciona fecha y hora', 'error'); return; }
    if (pasajeros <= 0) { notify('Indica al menos 1 pasajero', 'error'); return; }
    if (!isPrivada) {
      const max = 8; // ejemplo de cupo; en real se lee por ruta/salida
      if (pasajeros > max) { notify(`Cupo insuficiente. Disponibles ${max} asientos.`, 'error'); return; }
    }
    const user = Session.getUser();
    const id = `b${Date.now()}`;
    // Calcular total según cantidades y tarifas
    const route = state.routes.find(r => r.id === bookingRouteId);
    const userRole = user?.role || 'cliente';
    const baseAdult = getPriceForUser(route, userRole) || 0;
    const baseChild = (typeof route?.childPrice === 'number' && isFinite(route.childPrice)) ? route.childPrice : null;
    const total = (Math.max(0, adultos) * baseAdult) + (Math.max(0, ninos) * (baseChild || 0));
    const payload = {
      id,
      userId: user.id,
      routeId: bookingRouteId,
      status: 'Pendiente',
      driverId: null,
      createdAt: new Date().toISOString(),
      mode: state.routeMode,
      serviceType: 'tour',
      details: isPrivada 
        ? { adultos, ninos, pasajeros, fecha, notas, pickup: pickupPoint, ubicacion: ubicacionTxt, total }
        : { adultos, ninos, pasajeros, asientos, fecha, notas, pickup: pickupPoint, ubicacion: ubicacionTxt, total }
    };
    // No guardamos aún, abrimos checkout con un borrador
    closeBookingModal();
    openCheckoutModal(payload);
  };
  // Instrucciones dinámicas según método de pago
  const paySelect = document.getElementById('ckPago');
  const payInstruction = document.getElementById('payInstruction');
  const setInstr = () => {
    const v = (paySelect?.value || '').toLowerCase();
    const map = {
      efectivo: 'Paga en efectivo al final del viaje al conductor.',
      transferencia: 'Realiza la transferencia y presenta el comprobante al conductor.',
      voucher: 'Presenta tu voucher válido al conductor antes de iniciar el viaje.',
      tarjeta: 'Serás dirigido a una pantalla para completar el pago con tarjeta.'
    };
    if (payInstruction) payInstruction.textContent = map[v] || '';
  };
  if (paySelect) { setInstr(); paySelect.addEventListener('change', setInstr); }
  // solo renderizar reservas e historial cuando toque su tab
  setInterval(() => { 
    // Mantener solo las reservas del usuario actual
    const currentBookings = Storage.load('data:bookings', []);
    const userBookings = currentBookings.filter(b => b.userId === user.id);
    if (currentBookings.length !== userBookings.length) {
      Storage.save('data:bookings', userBookings);
    }
    state.bookings = userBookings;
    pollChanges(); 
  }, 1000);
}

document.addEventListener('DOMContentLoaded', main);


