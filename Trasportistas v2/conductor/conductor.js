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
    mine = mine.filter(b => b.status === assignmentFilter);
  }
  const items = mine.map(b => renderBookingItem(b)).join('');
  container.innerHTML = items || `<div class="empty">Sin asignaciones</div>`;
  container.querySelectorAll('button[data-next]')?.forEach(btn => btn.addEventListener('click', () => advance(btn.getAttribute('data-next'))));
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
          <span><strong>Vehículo:</strong> ${vehicle ? `${vehicle.brand} ${vehicle.model} • ${vehicle.plate}` : '-'}</span>
        </div>
      </div>
      <div class="actions-col">
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


