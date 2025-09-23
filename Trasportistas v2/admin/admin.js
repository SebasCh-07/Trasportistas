import { db, Storage, mountSharedChrome, requireRole, notify, startLeafletTracking } from '../shared/assets/scripts.js';

const state = {
  fleet: Storage.load('data:fleet', db.fleet),
  drivers: Storage.load('data:drivers', db.drivers),
  routes: Storage.load('data:routes', db.routes),
  coupons: Storage.load('data:coupons', db.coupons),
  bookings: Storage.load('data:bookings', db.bookings),
};

function saveAll() {
  Storage.save('data:fleet', state.fleet);
  Storage.save('data:drivers', state.drivers);
  Storage.save('data:routes', state.routes);
  Storage.save('data:coupons', state.coupons);
  Storage.save('data:bookings', state.bookings);
}

function renderStats() {
  const todayBookings = state.bookings.length;
  const activeDrivers = state.drivers.length;
  const estRevenue = state.bookings.reduce((acc, b) => {
    const r = state.routes.find(r => r.id === b.routeId);
    return acc + (r ? r.basePrice : 0);
  }, 0);
  document.getElementById('kpiBookings').textContent = todayBookings;
  document.getElementById('kpiDrivers').textContent = activeDrivers;
  document.getElementById('kpiRevenue').textContent = `$${estRevenue}`;
}

function table(headers, rowsHtml) {
  return `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
}

function renderFleet() {
  const container = document.getElementById('fleetTable');
  const rows = state.fleet.map(v => `
    <tr>
      <td>${v.brand}</td><td>${v.model}</td><td>${v.plate}</td><td>${v.capacity}</td>
      <td class="table-actions">
        <button class="btn ghost" data-action="edit" data-id="${v.id}">✏️</button>
        <button class="btn ghost" data-action="del" data-id="${v.id}">🗑️</button>
      </td>
    </tr>`).join('');
  container.innerHTML = `
    <div class="inline-form" id="vehicleForm">
      <input placeholder="Marca" id="vBrand" />
      <input placeholder="Modelo" id="vModel" />
      <input placeholder="Placa" id="vPlate" />
      <input placeholder="Capacidad" id="vCap" type="number" />
      <button class="btn primary" id="saveVehicle">Guardar</button>
    </div>
    ${table(['Marca','Modelo','Placa','Capacidad','Acciones'], rows)}`;
  container.querySelector('#saveVehicle').onclick = () => {
    const brand = document.getElementById('vBrand').value.trim();
    const model = document.getElementById('vModel').value.trim();
    const plate = document.getElementById('vPlate').value.trim();
    const capacity = parseInt(document.getElementById('vCap').value || '0', 10);
    if (!brand || !model || !plate || !capacity) return notify('Completa todos los campos de vehículo', 'error');
    state.fleet.push({ id: `v${Date.now()}`, brand, model, plate, capacity });
    saveAll(); renderFleet(); notify('Vehículo agregado', 'success');
  };
  container.querySelectorAll('button[data-action]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (action === 'del') { state.fleet = state.fleet.filter(v => v.id !== id); saveAll(); renderFleet(); }
      if (action === 'edit') { notify('Edición rápida no implementada; elimina y vuelve a crear', 'info'); }
    });
  });
}

function renderDrivers() {
  const container = document.getElementById('driversTable');
  const rows = state.drivers.map(d => `
    <tr>
      <td>${d.name}</td><td>${d.phone}</td><td>${d.vehicleId || '-'}</td><td>${d.status}</td>
      <td class="table-actions">
        <button class="btn ghost" data-action="del" data-id="${d.id}">🗑️</button>
      </td>
    </tr>`).join('');
  container.innerHTML = `
    <div class="inline-form" id="driverForm">
      <input placeholder="Nombre" id="dName" />
      <input placeholder="Teléfono" id="dPhone" />
      <input placeholder="Vehículo ID" id="dVehicleId" />
      <input placeholder="Estado" id="dStatus" value="Libre" />
      <button class="btn primary" id="saveDriver">Guardar</button>
    </div>
    ${table(['Nombre','Teléfono','Vehículo','Estado','Acciones'], rows)}`;
  container.querySelector('#saveDriver').onclick = () => {
    const name = document.getElementById('dName').value.trim();
    const phone = document.getElementById('dPhone').value.trim();
    const vehicleId = document.getElementById('dVehicleId').value.trim();
    const status = document.getElementById('dStatus').value.trim() || 'Libre';
    if (!name || !phone) return notify('Completa nombre y teléfono', 'error');
    state.drivers.push({ id: `d${Date.now()}`, name, phone, vehicleId, status, location: { x: 10, y: 20 } });
    saveAll(); renderDrivers(); notify('Conductor agregado', 'success');
  };
  container.querySelectorAll('button[data-action="del"]')?.forEach(btn => {
    btn.addEventListener('click', () => { const id = btn.getAttribute('data-id'); state.drivers = state.drivers.filter(d => d.id !== id); saveAll(); renderDrivers(); });
  });
}

function renderRoutes() {
  const container = document.getElementById('routesTable');
  const rows = state.routes.map(r => `
    <tr>
      <td>${r.type}</td><td>${r.name}</td><td>$${r.basePrice}</td>
      <td class="table-actions"><button class="btn ghost" data-action="del" data-id="${r.id}">🗑️</button></td>
    </tr>`).join('');
  container.innerHTML = `
    <div class="inline-form" id="routeForm">
      <input placeholder="Tipo (tour/transfer)" id="rType" />
      <input placeholder="Nombre" id="rName" />
      <input placeholder="Precio base" id="rPrice" type="number" />
      <input placeholder="Imagen URL" id="rImg" />
      <button class="btn primary" id="saveRoute">Guardar</button>
    </div>
    ${table(['Tipo','Nombre','Precio','Acciones'], rows)}`;
  container.querySelector('#saveRoute').onclick = () => {
    const type = document.getElementById('rType').value.trim();
    const name = document.getElementById('rName').value.trim();
    const basePrice = parseInt(document.getElementById('rPrice').value || '0', 10);
    const image = document.getElementById('rImg').value.trim();
    if (!type || !name || !basePrice) return notify('Completa tipo, nombre y precio', 'error');
    state.routes.push({ id: `r${Date.now()}`, type, name, basePrice, image });
    saveAll(); renderRoutes(); notify('Ruta agregada', 'success');
  };
  container.querySelectorAll('button[data-action="del"]')?.forEach(btn => {
    btn.addEventListener('click', () => { const id = btn.getAttribute('data-id'); state.routes = state.routes.filter(r => r.id !== id); saveAll(); renderRoutes(); });
  });
}

function renderCoupons() {
  const container = document.getElementById('couponsTable');
  const rows = state.coupons.map(c => `
    <tr>
      <td>${c.code}</td><td>${c.percent}%</td>
      <td class="table-actions"><button class="btn ghost" data-action="del" data-id="${c.id}">🗑️</button></td>
    </tr>`).join('');
  container.innerHTML = `
    <div class="inline-form" id="couponForm">
      <input placeholder="Código" id="cCode" />
      <input placeholder="%" id="cPercent" type="number" />
      <div></div><div></div>
      <button class="btn primary" id="saveCoupon">Guardar</button>
    </div>
    ${table(['Código','Descuento','Acciones'], rows)}`;
  container.querySelector('#saveCoupon').onclick = () => {
    const code = document.getElementById('cCode').value.trim();
    const percent = parseInt(document.getElementById('cPercent').value || '0', 10);
    if (!code || !percent) return notify('Completa código y porcentaje', 'error');
    state.coupons.push({ id: `c${Date.now()}`, code, percent });
    saveAll(); renderCoupons(); notify('Cupón agregado', 'success');
  };
  container.querySelectorAll('button[data-action="del"]')?.forEach(btn => {
    btn.addEventListener('click', () => { const id = btn.getAttribute('data-id'); state.coupons = state.coupons.filter(c => c.id !== id); saveAll(); renderCoupons(); });
  });
}

function renderAssignments() {
  const container = document.getElementById('assignments');
  const rows = state.bookings.map(b => {
    const route = state.routes.find(r => r.id === b.routeId);
    const driverName = b.driverId ? (state.drivers.find(d => d.id === b.driverId)?.name || '-') : '-';
    return `
      <tr>
        <td>${b.id}</td><td>${route?.name || '-'}</td><td>${b.status}</td><td>${driverName}</td>
        <td>
          <select data-id="${b.id}" class="assign-driver">
            <option value="">-- asignar --</option>
            ${state.drivers.map(d => `<option value="${d.id}" ${b.driverId===d.id?'selected':''}>${d.name}</option>`).join('')}
          </select>
        </td>
      </tr>`;
  }).join('');
  container.innerHTML = table(['Reserva','Ruta','Estado','Conductor','Asignar'], rows || '<tr><td colspan="5">Sin reservas</td></tr>');
  container.querySelectorAll('.assign-driver').forEach(sel => {
    sel.addEventListener('change', () => {
      const id = sel.getAttribute('data-id');
      const booking = state.bookings.find(b => b.id === id);
      booking.driverId = sel.value || null;
      if (booking.status === 'Pendiente' && booking.driverId) booking.status = 'Asignado';
      saveAll(); renderAssignments(); notify('Reserva asignada', 'success');
    });
  });
}

function initMap() {
  const map = document.getElementById('driversMap');
  startLeafletTracking(map, [-0.1807, -78.4678]);
}

function ensureSampleBookings() {
  if (state.bookings.length === 0 && state.routes.length > 0) {
    state.bookings.push({ id: 'b1', userId: 'u3', routeId: state.routes[0].id, status: 'Pendiente', driverId: null });
    saveAll();
  }
}

function main() {
  const user = requireRole('admin');
  if (!user) return;
  mountSharedChrome();
  ensureSampleBookings();
  renderStats();
  renderFleet();
  renderDrivers();
  renderRoutes();
  renderCoupons();
  renderAssignments();
  initMap();
}

document.addEventListener('DOMContentLoaded', main);


