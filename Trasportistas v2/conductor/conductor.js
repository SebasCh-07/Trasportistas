import { db, Storage, mountSharedChrome, requireRole, Session, notify, startLeafletTracking } from '../shared/assets/scripts.js';

const state = {
  bookings: Storage.load('data:bookings', db.bookings),
  routes: Storage.load('data:routes', db.routes),
};

let trackingInterval = null;

function myAssignments() {
  const user = Session.getUser();
  return state.bookings.filter(b => b.driverId === user.driverId);
}

function renderAssignments() {
  const container = document.getElementById('assignments');
  const mine = myAssignments();
  const rows = mine.map(b => {
    const route = state.routes.find(r => r.id === b.routeId);
    let nextLabel = 'Confirmar';
    if (b.status === 'Asignado') nextLabel = 'Confirmar';
    if (b.status === 'Confirmado') nextLabel = 'Iniciar';
    if (b.status === 'En Curso') nextLabel = 'Finalizar';
    return `<tr>
      <td>${b.id}</td><td>${route?.name || '-'}</td><td>${b.status}</td>
      <td class="actions">
        ${b.status !== 'Finalizado' ? `<button class="btn primary" data-next="${b.id}">${nextLabel}</button>` : ''}
      </td>
    </tr>`;
  }).join('');
  container.innerHTML = `<table><thead><tr><th>ID</th><th>Ruta</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${rows || '<tr><td colspan=4>Sin asignaciones</td></tr>'}</tbody></table>`;
  container.querySelectorAll('button[data-next]')?.forEach(btn => btn.addEventListener('click', () => advance(btn.getAttribute('data-next'))));

  updateTracking();
}

function advance(id) {
  const b = state.bookings.find(x => x.id === id);
  if (!b) return;
  if (b.status === 'Asignado') b.status = 'Confirmado';
  else if (b.status === 'Confirmado') b.status = 'En Curso';
  else if (b.status === 'En Curso') b.status = 'Finalizado';
  Storage.save('data:bookings', state.bookings);
  notify(`Estado actualizado: ${b.status}`, 'success');
  renderAssignments();
}

function updateTracking() {
  const current = myAssignments().find(b => b.status === 'En Curso');
  const map = document.getElementById('driverMap');
  map.innerHTML = '';
  if (trackingInterval?.stop) { trackingInterval.stop(); trackingInterval = null; }
  if (current) { startLeafletTracking(map, [-0.1807, -78.4678]).then(inst => trackingInterval = inst); }
}

function main() {
  const user = requireRole('conductor'); if (!user) return;
  mountSharedChrome();
  renderAssignments();
  setInterval(() => { state.bookings = Storage.load('data:bookings', db.bookings); renderAssignments(); }, 1000);
}

document.addEventListener('DOMContentLoaded', main);


