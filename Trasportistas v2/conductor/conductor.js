import { db, Storage, mountSharedChrome, requireRole, Session, notify } from '../shared/assets/scripts.js';

const state = {
  bookings: Storage.load('data:bookings', db.bookings),
  routes: Storage.load('data:routes', db.routes),
  drivers: Storage.load('data:drivers', db.drivers),
};

let assignmentFilter = 'Asignado';

function myAssignments() {
  const user = Session.getUser();
  return state.bookings.filter(b => b.driverId === user.driverId);
}

function renderAssignments() {
  const container = document.getElementById('assignments');
  let mine = myAssignments();
  if (assignmentFilter) {
    if (assignmentFilter === 'Asignado') {
      // Mostrar tanto 'Asignado' como 'Confirmado' en la pestaña Asignado
      mine = mine.filter(b => b.status === 'Asignado' || b.status === 'Confirmado');
    } else {
      mine = mine.filter(b => b.status === assignmentFilter);
    }
  }
  const items = mine.map(b => renderBookingItem(b)).join('');
  container.innerHTML = items || `<div class="empty">Sin asignaciones</div>`;
  container.querySelectorAll('button[data-next]')?.forEach(btn => btn.addEventListener('click', () => advance(btn.getAttribute('data-next'))));
  container.querySelectorAll('button[data-details]')?.forEach(btn => btn.addEventListener('click', () => showDetails(btn.getAttribute('data-details'))));
}

function setDriverStatus(newStatus) {
  try {
    const user = Session.getUser();
    if (!user || !user.driverId) return;
    // Cargar última versión de drivers por si otro módulo los actualizó
    state.drivers = Storage.load('data:drivers', db.drivers);
    const idx = state.drivers.findIndex(d => d.id === user.driverId);
    if (idx >= 0) {
      state.drivers[idx] = { ...state.drivers[idx], status: newStatus };
      Storage.save('data:drivers', state.drivers);
    }
  } catch {}
}

function advance(id) {
  const b = state.bookings.find(x => x.id === id);
  if (!b) return;
  if (b.status === 'Asignado') {
    b.status = 'Confirmado';
  } else if (b.status === 'Confirmado') {
    b.status = 'En Curso';
    // Al iniciar viaje: activar GPS (simulado) marcando conductor "En Ruta"
    setDriverStatus('En Ruta');
  } else if (b.status === 'En Curso') {
    // Finalizar viaje
    b.status = 'Completado';
    // Al finalizar: desactivar GPS (simulado) marcando conductor "Libre"
    setDriverStatus('Libre');
  }
  Storage.save('data:bookings', state.bookings);
  notify(`Estado actualizado: ${b.status}`, 'success');
  renderAssignments();
}

// Tracking eliminado

function renderDashboard() {
  const container = document.getElementById('dashboard');
  if (!container) return;
  const mine = myAssignments();
  const total = mine.length;
  const enCurso = mine.filter(b => b.status === 'En Curso').length;
  const pendientes = mine.filter(b => b.status === 'Asignado' || b.status === 'Confirmado').length;
  const finalizados = mine.filter(b => b.status === 'Completado').length;
  container.innerHTML = `
    <div class="card"><div class="section-header"><h3>Total</h3></div><div class="metric">${total}</div></div>
    <div class="card"><div class="section-header"><h3>En curso</h3></div><div class="metric">${enCurso}</div></div>
    <div class="card"><div class="section-header"><h3>Pendientes</h3></div><div class="metric">${pendientes}</div></div>
    <div class="card"><div class="section-header"><h3>Finalizados</h3></div><div class="metric">${finalizados}</div></div>
  `;
}

function main() {
  const user = requireRole('conductor'); if (!user) return;
  mountSharedChrome();
  setupTabs();
  setupModal();
  renderDashboard();
  renderAssignments();
  setupAssignmentSubtabs();
  setInterval(() => { state.bookings = Storage.load('data:bookings', db.bookings); renderAssignments(); }, 1000);
}

document.addEventListener('DOMContentLoaded', main);

function setupTabs() {
  const tabs = document.getElementById('tabs');
  if (!tabs) return;
  tabs.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest('button.tab');
    if (!btn) return;
    const tab = btn.getAttribute('data-tab');
    if (!tab) return;
    tabs.querySelectorAll('button.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    togglePanels(tab);
  });
}

function renderBookingItem(booking) {
  const route = state.routes.find(r => r.id === booking.routeId);
  const users = Storage.load('data:users', db.users) || [];
  const client = users.find(u => u.id === booking.userId);
  const driver = db.drivers.find(d => d.id === booking.driverId);
  const vehicle = driver ? db.fleet.find(v => v.id === driver.vehicleId) : null;
  let nextLabel = 'Confirmar';
  if (booking.status === 'Asignado') nextLabel = 'Confirmar';
  if (booking.status === 'Confirmado') nextLabel = 'Iniciar';
  if (booking.status === 'En Curso') nextLabel = 'Finalizar';
  const desc = (route?.description || '').slice(0, 120) + ((route?.description || '').length > 120 ? '…' : '');
  const statusClass = statusToClass(booking.status);
  return `
    <div class="booking-item ${statusClass && statusClass.replace('badge', 'status')}">
      <div class="thumb" style="background-image:url('${route?.image || ''}')"></div>
      <div class="body">
        <div class="row1">
          <h4 class="title">${route?.name || '-'}</h4>
          <span class="status ${statusClass}">${booking.status}</span>
        </div>
        <p class="desc">${desc}</p>
        <div class="meta">
          <span><strong>ID:</strong> ${booking.id}</span>
          <span><strong>Cliente:</strong> ${client?.name || '-'}</span>
          <span><strong>Tipo:</strong> ${route?.type || '-'}</span>
          <span><strong>Vehículo Asignado:</strong> ${vehicle ? `${vehicle.brand} ${vehicle.model} • ${vehicle.plate}` : 'Sin asignar'}</span>
          ${vehicle ? `<span><strong>Capacidad:</strong> ${vehicle.capacity} pasajeros</span>` : ''}
          ${vehicle ? `<span><strong>Color:</strong> ${vehicle.color || 'No especificado'}</span>` : ''}
        </div>
      </div>
      <div class="actions-col">
        ${booking.status === 'En Curso' ? `<button class="btn secondary" data-details="${booking.id}" style="margin-right: 8px;">Detalles</button>` : ''}
        ${booking.status !== 'Completado' ? `<button class="btn primary" data-next="${booking.id}">${nextLabel}</button>` : ''}
      </div>
    </div>
  `;
}

function statusToClass(status) {
  if (status === 'Asignado') return 'badge-assigned';
  if (status === 'Confirmado') return 'badge-confirmed';
  if (status === 'En Curso') return 'badge-inprogress';
  if (status === 'Completado') return 'badge-done';
  return '';
}

function togglePanels(active) {
  const dash = document.getElementById('panel-dashboard');
  const asg = document.getElementById('panel-assignments');
  if (!dash || !asg) return;
  if (active === 'dashboard') {
    dash.classList.remove('hidden');
    asg.classList.add('hidden');
  } else {
    dash.classList.add('hidden');
    asg.classList.remove('hidden');
  }
}

function setupAssignmentSubtabs() {
  const subtabs = document.getElementById('assignmentTabs');
  if (!subtabs) return;
  subtabs.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const btn = target.closest('button.subtab');
    if (!btn) return;
    const status = btn.getAttribute('data-status');
    if (!status) return;
    subtabs.querySelectorAll('button.subtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    assignmentFilter = status;
    renderAssignments();
  });
}

function showDetails(bookingId) {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking) return;
  
  const route = state.routes.find(r => r.id === booking.routeId);
  const users = Storage.load('data:users', db.users) || [];
  const client = users.find(u => u.id === booking.userId);
  const driver = db.drivers.find(d => d.id === booking.driverId);
  const vehicle = driver ? db.fleet.find(v => v.id === driver.vehicleId) : null;
  
  const detailsContent = document.getElementById('detailsContent');
  if (!detailsContent) return;
  
  // Determinar coordenadas según el tipo de servicio
  let pickupCoords = null;
  let destinationCoords = null;
  let pickupAddress = '';
  let destinationAddress = '';
  
  if (booking.serviceType === 'encomienda') {
    pickupCoords = booking.details?.origenCoords;
    destinationCoords = booking.details?.destinoCoords;
    pickupAddress = booking.details?.origen || '';
    destinationAddress = booking.details?.destino || '';
  } else {
    // Para tours, usar la ubicación del pickup
    pickupCoords = booking.details?.pickup?.coords;
    pickupAddress = booking.details?.ubicacion || booking.details?.pickup?.address || '';
    // Para tours, el destino sería la ruta
    destinationAddress = route?.name || '';
  }
  
  detailsContent.innerHTML = `
    <div class="details-section">
      <h4>🚀 Información del Viaje</h4>
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">🆔 ID del Viaje</span>
          <span class="detail-value">${booking.id}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">📊 Estado Actual</span>
          <span class="detail-value">${booking.status}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">🏷️ Tipo de Servicio</span>
          <span class="detail-value">${booking.serviceType === 'encomienda' ? '📦 Encomienda' : '🎯 Tour'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">📅 Fecha de Creación</span>
          <span class="detail-value">${new Date(booking.createdAt).toLocaleDateString('es-ES')}</span>
        </div>
      </div>
    </div>

    <div class="details-section">
      <h4>👤 Información del Cliente</h4>
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">👨‍💼 Nombre Completo</span>
          <span class="detail-value">${client?.name || '❌ No disponible'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">📞 Teléfono</span>
          <span class="detail-value">${client?.profile?.telefono || '❌ No disponible'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">📧 Email</span>
          <span class="detail-value">${client?.email || '❌ No disponible'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">🆔 Cédula de Identidad</span>
          <span class="detail-value">${client?.profile?.ci || '❌ No disponible'}</span>
        </div>
      </div>
    </div>

    ${booking.serviceType === 'encomienda' ? `
    <div class="details-section">
      <h4>📦 Información de Encomienda</h4>
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">📤 Remitente</span>
          <span class="detail-value">${booking.details?.remitente || '❌ No disponible'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">📥 Destinatario</span>
          <span class="detail-value">${booking.details?.destinatario || '❌ No disponible'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">📞 Teléfono Contacto</span>
          <span class="detail-value">${booking.details?.telefono || '❌ No disponible'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">⚖️ Peso (kg)</span>
          <span class="detail-value">${booking.details?.pesoKg || '0'} kg</span>
        </div>
        <div class="detail-item" style="grid-column: 1 / -1;">
          <span class="detail-label">📝 Descripción del Paquete</span>
          <span class="detail-value">${booking.details?.descripcion || '❌ No disponible'}</span>
        </div>
      </div>
    </div>
    ` : `
    <div class="details-section">
      <h4>🎯 Información del Tour</h4>
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">🗺️ Ruta del Tour</span>
          <span class="detail-value">${route?.name || '❌ No disponible'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">👥 Total Pasajeros</span>
          <span class="detail-value">${booking.details?.pasajeros || '0'} personas</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">👨‍💼 Adultos</span>
          <span class="detail-value">${booking.details?.adultos || '0'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">👶 Niños</span>
          <span class="detail-value">${booking.details?.ninos || '0'}</span>
        </div>
        ${booking.details?.fecha ? `
        <div class="detail-item">
          <span class="detail-label">📅 Fecha y Hora</span>
          <span class="detail-value">${new Date(booking.details.fecha).toLocaleString('es-ES')}</span>
        </div>
        ` : ''}
        ${booking.details?.notas ? `
        <div class="detail-item" style="grid-column: 1 / -1;">
          <span class="detail-label">📝 Notas Especiales</span>
          <span class="detail-value">${booking.details.notas}</span>
        </div>
        ` : ''}
      </div>
    </div>
    `}

    <div class="details-section">
      <h4>🚗 Información del Vehículo</h4>
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">👨‍✈️ Conductor Asignado</span>
          <span class="detail-value">${driver?.name || '❌ No asignado'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">🚙 Vehículo</span>
          <span class="detail-value">${vehicle ? `${vehicle.brand} ${vehicle.model}` : '❌ No asignado'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">🏷️ Placa</span>
          <span class="detail-value">${vehicle?.plate || '❌ No disponible'}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">👥 Capacidad</span>
          <span class="detail-value">${vehicle?.capacity || '0'} pasajeros</span>
        </div>
        ${vehicle?.color ? `
        <div class="detail-item">
          <span class="detail-label">🎨 Color</span>
          <span class="detail-value">${vehicle.color}</span>
        </div>
        ` : ''}
      </div>
    </div>

    ${pickupCoords ? `
    <div class="details-section">
      <h4>📍 Ubicación de Recogida</h4>
      <div class="detail-item" style="margin-bottom: 16px; padding: 16px; background: rgba(14, 165, 233, 0.1); border-left: 4px solid #0ea5e9;">
        <span class="detail-label">🏠 Dirección Exacta</span>
        <span class="detail-value" style="font-size: 16px; font-weight: 600; color: #60a5fa;">${pickupAddress}</span>
      </div>
      <div class="map-container" id="pickupMap">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <div style="font-size: 48px;">🗺️</div>
          <span style="font-size: 16px; color: #94a3b8;">Cargando mapa interactivo...</span>
        </div>
      </div>
      <div class="navigation-buttons">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${pickupCoords.lat},${pickupCoords.lng}" target="_blank" class="nav-btn google-maps">
          🗺️ Navegar con Google Maps
        </a>
        <a href="https://waze.com/ul?ll=${pickupCoords.lat},${pickupCoords.lng}&navigate=yes" target="_blank" class="nav-btn waze">
          🧭 Navegar con Waze
        </a>
      </div>
    </div>
    ` : ''}

    ${destinationCoords ? `
    <div class="details-section">
      <h4>🎯 Ubicación de Destino</h4>
      <div class="detail-item" style="margin-bottom: 16px; padding: 16px; background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e;">
        <span class="detail-label">🏁 Dirección de Destino</span>
        <span class="detail-value" style="font-size: 16px; font-weight: 600; color: #4ade80;">${destinationAddress}</span>
      </div>
      <div class="map-container" id="destinationMap">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <div style="font-size: 48px;">🎯</div>
          <span style="font-size: 16px; color: #94a3b8;">Cargando mapa interactivo...</span>
        </div>
      </div>
      <div class="navigation-buttons">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${destinationCoords.lat},${destinationCoords.lng}" target="_blank" class="nav-btn google-maps">
          🗺️ Navegar con Google Maps
        </a>
        <a href="https://waze.com/ul?ll=${destinationCoords.lat},${destinationCoords.lng}&navigate=yes" target="_blank" class="nav-btn waze">
          🧭 Navegar con Waze
        </a>
      </div>
    </div>
    ` : ''}
  `;
  
  // Mostrar el modal
  const modal = document.getElementById('detailsModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
  
  // Cargar mapas si hay coordenadas
  if (pickupCoords) {
    loadMap('pickupMap', pickupCoords, 'Ubicación de Recogida');
  }
  if (destinationCoords) {
    loadMap('destinationMap', destinationCoords, 'Ubicación de Destino');
  }
}

function loadMap(containerId, coords, title) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Crear iframe de Google Maps
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dOWWgU6xFWx4vE&q=${coords.lat},${coords.lng}&zoom=15`;
  
  container.innerHTML = `
    <iframe 
      width="100%" 
      height="100%" 
      style="border:0" 
      loading="lazy" 
      allowfullscreen 
      referrerpolicy="no-referrer-when-downgrade"
      src="${mapUrl}">
    </iframe>
  `;
}

function closeDetailsModal() {
  const modal = document.getElementById('detailsModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function setupModal() {
  // Event listener para cerrar modal
  const closeBtn = document.getElementById('closeDetailsModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDetailsModal);
  }
  
  // Cerrar modal al hacer click fuera del contenido
  const modal = document.getElementById('detailsModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeDetailsModal();
      }
    });
  }
  
  // Cerrar modal con tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetailsModal();
    }
  });
}


