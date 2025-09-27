import { db, Storage, mountSharedChrome, requireRole, notify, startLeafletTracking, ensureLeaflet } from '../shared/assets/scripts.js';

const state = {
  fleet: Storage.load('data:fleet', db.fleet),
  drivers: Storage.load('data:drivers', db.drivers),
  routes: Storage.load('data:routes', db.routes),
  coupons: Storage.load('data:coupons', db.coupons),
  bookings: Storage.load('data:bookings', db.bookings),
  users: Storage.load('data:users', db.users),
  clients: Storage.load('data:clients', []),
};

let __lastBookingsSnapshot = null;

// Agregar conductores de ejemplo si no existen
function ensureSampleDrivers() {
  if (state.drivers.length <= 1) {
    const sampleDrivers = [
      { 
        id: 'd2', 
        name: 'María González', 
        phone: '+51 999 777 666', 
        email: 'maria.gonzalez@email.com',
        license: 'LIC-001234',
        vehicleId: null, 
        location: { x: 15, y: 25 }, 
        status: 'Ocupado',
        experience: 5,
        notes: 'Conductora experimentada con excelente historial',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'd3', 
        name: 'Pedro Martínez', 
        phone: '+51 999 555 444', 
        email: 'pedro.martinez@email.com',
        license: 'LIC-005678',
        vehicleId: null, 
        location: { x: 25, y: 35 }, 
        status: 'Libre',
        experience: 3,
        notes: 'Conductor disponible para servicios especiales',
        createdAt: new Date().toISOString()
      },
      { 
        id: 'd4', 
        name: 'Ana López', 
        phone: '+51 999 333 222', 
        email: 'ana.lopez@email.com',
        license: 'LIC-009012',
        vehicleId: null, 
        location: { x: 10, y: 40 }, 
        status: 'Libre',
        experience: 2,
        notes: 'Nueva conductora, muy puntual y responsable',
        createdAt: new Date().toISOString()
      },
    ];
    state.drivers.push(...sampleDrivers);
    saveAll();
  }
}

function saveAll() {
  Storage.save('data:fleet', state.fleet);
  Storage.save('data:drivers', state.drivers);
  Storage.save('data:routes', state.routes);
  Storage.save('data:coupons', state.coupons);
  Storage.save('data:bookings', state.bookings);
  Storage.save('data:users', state.users);
  Storage.save('data:clients', state.clients);
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
      <td>
        <div style="font-weight: 600; color: var(--text-primary);">${v.brand} ${v.model}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${v.plate}</div>
      </td>
      <td>${v.year || 'N/A'}</td>
      <td>${v.capacity}</td>
      <td>
        <span class="vehicle-type-badge ${v.type || 'default'}">${getVehicleTypeDisplay(v.type)}</span>
      </td>
      <td>
        <span class="vehicle-status-badge ${v.status || 'disponible'}">${getVehicleStatusDisplay(v.status)}</span>
      </td>
      <td class="table-actions">
        <button class="btn ghost" data-action="view" data-id="${v.id}" title="Ver vehículo">👁️</button>
        <button class="btn ghost" data-action="edit" data-id="${v.id}" title="Editar vehículo">✏️</button>
        <button class="btn ghost" data-action="del" data-id="${v.id}" title="Eliminar vehículo">🗑️</button>
      </td>
    </tr>`).join('');
  
  container.innerHTML = table(['Vehículo','Año','Capacidad','Tipo','Estado','Acciones'], rows);
  
  container.querySelectorAll('button[data-action]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (action === 'del') { 
        if (confirm('¿Estás seguro de que quieres eliminar este vehículo?')) {
          state.fleet = state.fleet.filter(v => v.id !== id); 
          saveAll(); 
          renderFleet(); 
          notify('Vehículo eliminado correctamente', 'success');
        }
      }
      if (action === 'view') { 
        openViewVehicleModal(id); 
      }
      if (action === 'edit') { 
        openEditVehicleModal(id); 
      }
    });
  });
}

function renderDrivers() {
  const container = document.getElementById('driversTable');
  const rows = state.drivers.map(d => {
    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--text-primary);">${d.name}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">${d.email || 'Sin email'}</div>
        </td>
        <td>${d.phone}</td>
        <td>
          <span class="status-badge ${d.status.toLowerCase().replace(' ', '-')}">${d.status}</span>
        </td>
        <td>
          <div style="font-size: 12px; color: var(--text-secondary);">
            ${d.experience || 0} años exp.
          </div>
        </td>
        <td class="table-actions">
          <button class="btn ghost" data-action="view" data-id="${d.id}" title="Ver conductor">👁️</button>
          <button class="btn ghost" data-action="edit" data-id="${d.id}" title="Editar conductor">✏️</button>
          <button class="btn ghost" data-action="del" data-id="${d.id}" title="Eliminar conductor">🗑️</button>
        </td>
      </tr>`;
  }).join('');
  
  container.innerHTML = table(['Conductor','Teléfono','Estado','Experiencia','Acciones'], rows);
  
  container.querySelectorAll('button[data-action]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const driver = state.drivers.find(d => d.id === id);
      
      if (action === 'del') {
        if (confirm(`¿Estás seguro de que quieres eliminar al conductor "${driver.name}"?`)) {
          state.drivers = state.drivers.filter(d => d.id !== id);
          saveAll();
          renderDrivers();
          notify('Conductor eliminado correctamente', 'success');
        }
      } else if (action === 'view') {
        openViewDriverModal(id);
      } else if (action === 'edit') {
        openEditDriverModal(id);
      }
    });
  });
}

function renderRoutes() {
  const container = document.getElementById('routesTable');
  const routesToShow = state.routes; // Mostrar todas las rutas
  const rows = routesToShow.map(r => `
    <tr>
      <td>
        <span class="route-type ${r.type}">${r.type.toUpperCase()}</span>
        ${r.image ? `<br><small class="muted">📷 Con imagen</small>` : ''}
      </td>
      <td>
        <strong>${r.name}</strong>
      </td>
      <td><span class="price">$${r.basePrice}</span></td>
      <td>${typeof r.childPrice === 'number' ? `$${r.childPrice}` : '-'}</td>
      <td>
        <span class="status-badge ${r.status || 'activo'}">${(r.status || 'activo').toUpperCase()}</span>
      </td>
      <td class="table-actions">
        <button class="btn ghost" data-action="view" data-id="${r.id}" title="Ver ruta">👁️</button>
        <button class="btn ghost" data-action="edit" data-id="${r.id}" title="Editar ruta">✏️</button>
        <button class="btn ghost" data-action="del" data-id="${r.id}" title="Eliminar ruta">🗑️</button>
      </td>
    </tr>`).join('');
  
  container.innerHTML = table(['Tipo','Nombre','Precio','Niños','Estado','Acciones'], rows);
  
  container.querySelectorAll('button[data-action]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const route = state.routes.find(r => r.id === id);
      
      if (action === 'del') {
        if (confirm(`¿Estás seguro de que quieres eliminar la ruta "${route.name}"?`)) {
          state.routes = state.routes.filter(r => r.id !== id);
          saveAll();
          renderRoutes();
          notify('Ruta eliminada correctamente', 'success');
        }
      } else if (action === 'view') {
        openViewRouteModal(id);
      } else if (action === 'edit') {
        openEditRouteModal(id);
      }
    });
  });
}

function renderCoupons() {
  const container = document.getElementById('couponsTable');
  const rows = state.coupons.map(c => `
    <tr>
      <td>
        <div style="font-weight: 600; color: var(--text-primary);">${c.code}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${c.status || 'activo'}</div>
      </td>
      <td><span class="discount-badge">${c.percent}%</span></td>
      <td>${c.description || 'Sin descripción'}</td>
      <td>
        <span class="status-badge ${(c.status || 'activo').toLowerCase()}">${(c.status || 'activo').toUpperCase()}</span>
      </td>
      <td class="table-actions">
        <button class="btn ghost" data-action="view" data-id="${c.id}" title="Ver cupón">👁️</button>
        <button class="btn ghost" data-action="edit" data-id="${c.id}" title="Editar cupón">✏️</button>
        <button class="btn ghost" data-action="del" data-id="${c.id}" title="Eliminar cupón">🗑️</button>
      </td>
    </tr>`).join('');
  
  container.innerHTML = table(['Código','Descuento','Descripción','Estado','Acciones'], rows);
  
  container.querySelectorAll('button[data-action]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const coupon = state.coupons.find(c => c.id === id);
      
      if (action === 'del') {
        if (confirm(`¿Estás seguro de que quieres eliminar el cupón "${coupon.code}"?`)) {
          state.coupons = state.coupons.filter(c => c.id !== id);
          saveAll();
          renderCoupons();
          notify('Cupón eliminado correctamente', 'success');
        }
      } else if (action === 'view') {
        openViewCouponModal(id);
      } else if (action === 'edit') {
        openEditCouponModal(id);
      }
    });
  });
}

// Función para inicializar las pestañas de asignaciones
function initAssignmentTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn[data-assignment-tab]');
  const tabPanes = document.querySelectorAll('.assignment-tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-assignment-tab');
      
      // Remover clase active de todos los botones y paneles
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      // Activar el botón y panel seleccionado
      button.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
      
      // Renderizar el contenido de la pestaña seleccionada
      renderAssignmentTab(targetTab);
    });
  });
}

// Función para renderizar el contenido de cada pestaña
function renderAssignmentTab(tabName) {
  const container = document.getElementById(`assignments-${tabName}`);
  if (!container) return;

  let filteredBookings = [];
  
  switch(tabName) {
    case 'pendiente':
      filteredBookings = state.bookings.filter(b => b.status === 'Pendiente');
      break;
    case 'asignadas':
      filteredBookings = state.bookings.filter(b => b.status === 'Asignado' || b.status === 'Confirmado');
      break;
    case 'en-curso':
      filteredBookings = state.bookings.filter(b => b.status === 'En Curso');
      break;
    case 'completadas':
      filteredBookings = state.bookings.filter(b => b.status === 'Completado');
      break;
  }

  if (filteredBookings.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <div style="font-size: 48px; margin-bottom: 16px;">${getTabIcon(tabName)}</div>
        <h3>No hay reservas ${getTabTitle(tabName).toLowerCase()}</h3>
        <p>Las reservas aparecerán aquí cuando cambien de estado.</p>
      </div>
    `;
    return;
  }

  const rows = filteredBookings.map(b => {
    const route = state.routes.find(r => r.id === b.routeId);
    const driver = b.driverId ? state.drivers.find(d => d.id === b.driverId) : null;
    const vehicle = driver?.vehicleId ? state.fleet.find(v => v.id === driver.vehicleId) : null;
    const client = b.userId ? state.users.find(u => u.id === b.userId) : null;
    const total = typeof b?.details?.total === 'number' ? b.details.total : null;
    
    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--text-primary);">${b.id}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">${new Date().toLocaleDateString()}</div>
        </td>
        <td>
          <div style="font-weight: 600;">${route?.name || 'Ruta no encontrada'}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">${total !== null ? `Total: $${total.toFixed(2)} USD` : `$${route?.basePrice || 0}`}</div>
        </td>
        <td>
          ${client ? `
            <div class="driver-info">
              <div class="driver-avatar">${(client.name || '?').charAt(0).toUpperCase()}</div>
              <div class="driver-details">
                <div class="driver-name">${client.name}</div>
                <div class="driver-phone">${client.email || ''}</div>
                <div>
                  <span class="user-role-badge ${client.role}">${(client.role || '').toUpperCase()}</span>
                  <button class="btn ghost" style="margin-left:8px; padding:4px 8px; font-size:12px;" onclick="openViewClientModal('${client.id}')">Ver</button>
                </div>
              </div>
            </div>
          ` : `
            <div style="color: var(--text-secondary); font-style: italic;">Cliente no encontrado</div>
          `}
        </td>
        <td>
          <span class="status-badge ${b.status.toLowerCase().replace(' ', '-')}">${b.status}</span>
        </td>
        <td>
          ${driver ? `
            <div class="driver-info">
              <div class="driver-avatar">${driver.name.charAt(0)}</div>
              <div class="driver-details">
                <div class="driver-name">${driver.name}</div>
                <div class="driver-phone">${driver.phone}</div>
                ${vehicle ? `
                  <div class="vehicle-info">
                    <span class="vehicle-icon">🚗</span>
                    <span>${vehicle.brand} ${vehicle.model} - ${vehicle.plate}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : `
            <div style="color: var(--text-secondary); font-style: italic;">Sin asignar</div>
          `}
        </td>
        <td>
          <div class="assignment-actions">
            ${b.status === 'Pendiente' ? `
              <button class="btn primary" onclick="openAssignModal('${b.id}')" style="font-size: 12px; padding: 6px 12px;">
                📋 Asignar
              </button>
            ` : b.status === 'Asignado' || b.status === 'Confirmado' ? `
              <button class="btn primary" onclick="startTrip('${b.id}')" style="font-size: 12px; padding: 6px 12px;">
                🚗 Iniciar Viaje
              </button>
            ` : b.status === 'En Curso' ? `
              <button class="btn success" onclick="completeTrip('${b.id}')" style="font-size: 12px; padding: 6px 12px;">
                ✅ Finalizar
              </button>
            ` : `
              <div style="color: var(--text-secondary); font-size: 12px;">
                ${new Date().toLocaleString()}
              </div>
            `}
          </div>
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="assignment-table">
      <thead>
        <tr>
          <th>Reserva</th>
          <th>Ruta</th>
          <th>Cliente</th>
          <th>Estado</th>
          <th>Conductor</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  // Los event listeners para asignación ahora se manejan a través del modal
}

// Función para actualizar los contadores de las pestañas
function updateAssignmentCounts() {
  const counts = {
    pendiente: state.bookings.filter(b => b.status === 'Pendiente').length,
    asignadas: state.bookings.filter(b => b.status === 'Asignado' || b.status === 'Confirmado').length,
    'en-curso': state.bookings.filter(b => b.status === 'En Curso').length,
    completadas: state.bookings.filter(b => b.status === 'Completado').length
  };

  Object.entries(counts).forEach(([tab, count]) => {
    const countElement = document.getElementById(`${tab}-count`);
    if (countElement) {
      countElement.textContent = count;
    }
  });
}

// Funciones para cambiar el estado de las reservas
window.startTrip = function(bookingId) {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (booking && (booking.status === 'Asignado' || booking.status === 'Confirmado')) {
    booking.status = 'En Curso';
    
    // Actualizar estado del conductor
    const driver = state.drivers.find(d => d.id === booking.driverId);
    if (driver) {
      driver.status = 'En Ruta';
    }
    
    saveAll();
    updateAssignmentCounts();
    renderAssignmentTab('asignadas');
    renderDrivers(); // Actualizar vista de conductores
    notify('Viaje iniciado', 'success');
  }
};

window.completeTrip = function(bookingId) {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (booking) {
    booking.status = 'Completado';
    
    // Actualizar estado del conductor y vehículo
    const driver = state.drivers.find(d => d.id === booking.driverId);
    const vehicle = state.fleet.find(v => v.id === driver?.vehicleId);
    
    if (driver) {
      driver.status = 'Libre';
      driver.vehicleId = null; // Desasignar vehículo
    }
    
    if (vehicle) {
      vehicle.status = 'disponible';
    }
    
    saveAll();
    updateAssignmentCounts();
    renderAssignmentTab('en-curso');
    renderDrivers(); // Actualizar vista de conductores
    renderFleet(); // Actualizar vista de flota
    notify('Viaje completado', 'success');
  }
};

// Función auxiliar para obtener el icono de la pestaña
function getTabIcon(tabName) {
  const icons = {
    'pendiente': '⏳',
    'asignadas': '👤',
    'en-curso': '🚗',
    'completadas': '✅'
  };
  return icons[tabName] || '📋';
}

// Función auxiliar para obtener el título de la pestaña
function getTabTitle(tabName) {
  const titles = {
    'pendiente': 'Pendientes',
    'asignadas': 'Asignadas',
    'en-curso': 'En Curso',
    'completadas': 'Completadas'
  };
  return titles[tabName] || 'Sin título';
}

function renderAssignments() {
  // Esta función ahora solo inicializa las pestañas y renderiza la primera
  initAssignmentTabs();
  updateAssignmentCounts();
  renderAssignmentTab('pendiente');
}

let mapInstance = null;
let driverMarkers = new Map();

async function initMap() {
  const mapContainer = document.getElementById('driversMap');
  if (!mapContainer) return;

  try {
    // Asegurar que Leaflet esté cargado
    const L = await ensureLeaflet();
    window.L = L; // Hacer disponible globalmente
    
    // Inicializar el mapa
    mapInstance = await startLeafletTracking(mapContainer, [-0.1807, -78.4678]);
    
    // Agregar controles del mapa
    addMapControls();
    
    // Mostrar conductores en el mapa
    renderDriversOnMap();
    
    // Inicializar búsqueda de conductores
    initDriverSearch();
    
    // Iniciar actualización automática
    startLocationUpdates();
    
    notify('Mapa GPS inicializado correctamente', 'success');
  } catch (error) {
    console.error('Error al inicializar el mapa:', error);
    notify('Error al cargar el mapa GPS', 'error');
  }
}

function addMapControls() {
  const mapContainer = document.getElementById('driversMap');
  if (!mapContainer || !mapInstance) return;

  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'map-controls';
  controlsDiv.innerHTML = `
    <button class="map-control-btn" id="centerMap">📍 Centrar</button>
    <button class="map-control-btn" id="refreshDrivers">🔄 Actualizar</button>
    <button class="map-control-btn" id="toggleTracking">📍 Seguimiento</button>
  `;
  
  mapContainer.appendChild(controlsDiv);
  
  // Event listeners para controles
  document.getElementById('centerMap').addEventListener('click', () => {
    mapInstance.map.setView([-0.1807, -78.4678], 13);
  });
  
  document.getElementById('refreshDrivers').addEventListener('click', () => {
    renderDriversOnMap();
    notify('Ubicaciones actualizadas', 'info');
  });
  
  document.getElementById('toggleTracking').addEventListener('click', (e) => {
    const isTracking = e.target.classList.contains('active');
    if (isTracking) {
      stopLocationUpdates();
      e.target.classList.remove('active');
      e.target.textContent = '📍 Seguimiento';
    } else {
      startLocationUpdates();
      e.target.classList.add('active');
      e.target.textContent = '⏹️ Parar';
    }
  });
}

function renderDriversOnMap() {
  if (!mapInstance || !mapInstance.map || !window.L) return;
  
  // Limpiar marcadores existentes
  driverMarkers.forEach(marker => {
    mapInstance.map.removeLayer(marker);
  });
  driverMarkers.clear();
  
  // Contar conductores activos
  const activeDrivers = state.drivers.filter(d => d.status === 'En Ruta' || d.status === 'Ocupado');
  document.getElementById('activeCount').textContent = `${activeDrivers.length} activos`;
  
  // Renderizar lista de conductores en el panel derecho
  renderDriversList();
  
  // Agregar marcadores para cada conductor
  state.drivers.forEach(driver => {
    if (!driver.location) return;
    
    // Convertir coordenadas simuladas a coordenadas reales de Quito
    const lat = -0.1807 + (driver.location.x - 20) * 0.01;
    const lng = -78.4678 + (driver.location.y - 30) * 0.01;
    
    // Crear icono personalizado
    const driverIcon = window.L.divIcon({
      className: `driver-marker ${driver.status.toLowerCase().replace(' ', '-')}`,
      html: `<div style="
        background: ${getStatusColor(driver.status)};
        color: white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        cursor: pointer;
      ">${driver.name.charAt(0)}</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    
    // Crear marcador
    const marker = window.L.marker([lat, lng], { icon: driverIcon }).addTo(mapInstance.map);
    
    // Agregar evento de click para mostrar información del conductor
    marker.on('click', () => {
      showDriverInfo(driver);
    });
    
    driverMarkers.set(driver.id, marker);
  });
}

function renderDriversList() {
  const container = document.getElementById('driversListContainer');
  if (!container) return;
  
  const driverCards = state.drivers.map(driver => `
    <div class="driver-card-item" data-driver-id="${driver.id}">
      <div class="driver-card-header">
        <h3 class="driver-name">${driver.name}</h3>
        <span class="driver-status-badge ${driver.status.toLowerCase().replace(' ', '-')}">${driver.status}</span>
      </div>
      <div class="driver-card-body">
        <p class="driver-description">${getDriverDescription(driver)}</p>
        <div class="driver-actions">
          <button class="action-btn" onclick="focusOnDriver('${driver.id}')" title="Centrar en mapa">
            📍
          </button>
          <button class="action-btn" onclick="showDriverInfo('${driver.id}')" title="Ver detalles">
            👁️
          </button>
        </div>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = `
    <div class="drivers-list">
      <div class="list-header">
        <h4>Conductores Disponibles</h4>
        <span class="driver-count">${state.drivers.length} conductores</span>
      </div>
      <div class="drivers-cards-container">
        ${driverCards}
      </div>
    </div>
  `;
  
  // Agregar eventos de click a las tarjetas
  container.querySelectorAll('.driver-card-item').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        const driverId = card.getAttribute('data-driver-id');
        const driver = state.drivers.find(d => d.id === driverId);
        if (driver) {
          showDriverInfo(driver);
          focusOnDriver(driverId);
        }
      }
    });
  });
}

function getDriverDescription(driver) {
  switch (driver.status.toLowerCase()) {
    case 'libre':
      return 'Conductor disponible para asignar viajes';
    case 'ocupado':
      return 'Conductor actualmente en servicio';
    case 'en ruta':
      return 'En espera de que el conductor inicie el viaje';
    default:
      return 'Estado del conductor no definido';
  }
}

function focusOnDriver(driverId) {
  const driver = state.drivers.find(d => d.id === driverId);
  if (!driver || !driver.location || !mapInstance) return;
  
  const lat = -0.1807 + (driver.location.x - 20) * 0.01;
  const lng = -78.4678 + (driver.location.y - 30) * 0.01;
  
  mapInstance.map.setView([lat, lng], 15);
  showDriverInfo(driver);
}

function showDriverInfo(driver) {
  if (typeof driver === 'string') {
    driver = state.drivers.find(d => d.id === driver);
  }
  
  if (!driver) return;
  
  document.getElementById('driverName').textContent = driver.name;
  document.getElementById('driverStatus').textContent = driver.status;
  document.getElementById('driverStatus').className = `status-badge ${driver.status.toLowerCase().replace(' ', '-')}`;
  
  const details = `
        <p><strong>Teléfono:</strong> ${driver.phone}</p>
        <p><strong>Vehículo:</strong> ${driver.vehicleId || 'Sin asignar'}</p>
        <p><strong>Última actualización:</strong> ${new Date().toLocaleTimeString()}</p>
    ${driver.status === 'En Ruta' ? '<p>En espera de que el conductor inicie el viaje</p>' : ''}
  `;
  
  document.getElementById('driverDetails').innerHTML = details;
}

function initDriverSearch() {
  const searchInput = document.getElementById('driverSearch');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    
    if (searchTerm === '') {
      // Mostrar todos los marcadores
      driverMarkers.forEach(marker => {
        marker.setOpacity(1);
      });
      return;
    }
    
    // Filtrar conductores por nombre
    const matchingDrivers = state.drivers.filter(driver => 
      driver.name.toLowerCase().includes(searchTerm)
    );
    
    // Ocultar todos los marcadores primero
    driverMarkers.forEach(marker => {
      marker.setOpacity(0.3);
    });
    
    // Mostrar solo los conductores que coinciden
    matchingDrivers.forEach(driver => {
      const marker = driverMarkers.get(driver.id);
      if (marker) {
        marker.setOpacity(1);
        // Centrar el mapa en el primer conductor encontrado
        if (matchingDrivers.indexOf(driver) === 0) {
          const lat = -0.1807 + (driver.location.x - 20) * 0.01;
          const lng = -78.4678 + (driver.location.y - 30) * 0.01;
          mapInstance.map.setView([lat, lng], 15);
          showDriverInfo(driver);
        }
      }
    });
  });
}

function getStatusColor(status) {
  switch (status.toLowerCase()) {
    case 'libre': return '#10b981';
    case 'ocupado': return '#ef4444';
    case 'en-ruta': return '#f59e0b';
    default: return '#6b7280';
  }
}

function startLocationUpdates() {
  // Simular actualización de ubicaciones cada 5 segundos
  if (window.locationUpdateInterval) {
    clearInterval(window.locationUpdateInterval);
  }
  
  window.locationUpdateInterval = setInterval(() => {
    updateDriverLocations();
  }, 5000);
}

function stopLocationUpdates() {
  if (window.locationUpdateInterval) {
    clearInterval(window.locationUpdateInterval);
    window.locationUpdateInterval = null;
  }
}

function updateDriverLocations() {
  // Simular movimiento de conductores
  state.drivers.forEach(driver => {
    if (driver.location) {
      // Movimiento aleatorio pequeño
      const deltaX = (Math.random() - 0.5) * 0.002;
      const deltaY = (Math.random() - 0.5) * 0.002;
      
      driver.location.x = Math.max(0, Math.min(50, driver.location.x + deltaX));
      driver.location.y = Math.max(0, Math.min(50, driver.location.y + deltaY));
    }
  });
  
  // Guardar cambios
  saveAll();
  
  // Actualizar marcadores en el mapa
  renderDriversOnMap();
}

// Función global para cambiar el estado del conductor desde el popup
window.changeDriverStatus = function(driverId, newStatus) {
  const driver = state.drivers.find(d => d.id === driverId);
  if (driver) {
    driver.status = newStatus;
    saveAll();
    renderDriversOnMap();
    notify(`Estado de ${driver.name} cambiado a ${newStatus}`, 'success');
  }
};

// Funciones auxiliares para vehículos
function getVehicleTypeDisplay(type) {
  const types = {
    'sedan': 'Sedán',
    'suv': 'SUV',
    'van': 'Van',
    'bus': 'Bus',
    'pickup': 'Pickup',
    'hatchback': 'Hatchback',
    'default': 'No especificado'
  };
  return types[type] || 'No especificado';
}

function getVehicleStatusDisplay(status) {
  const statuses = {
    'disponible': 'Disponible',
    'en-uso': 'En Uso',
    'mantenimiento': 'Mantenimiento',
    'inactivo': 'Inactivo'
  };
  return statuses[status] || 'Disponible';
}

function getFuelTypeDisplay(fuel) {
  const fuels = {
    'gasolina': 'Gasolina',
    'diesel': 'Diesel',
    'hibrido': 'Híbrido',
    'electrico': 'Eléctrico'
  };
  return fuels[fuel] || 'No especificado';
}

function getTransmissionDisplay(transmission) {
  const transmissions = {
    'manual': 'Manual',
    'automatica': 'Automática'
  };
  return transmissions[transmission] || 'No especificado';
}

// Funciones para manejar los modales de rutas
function openViewRouteModal(routeId) {
  const route = state.routes.find(r => r.id === routeId);
  if (!route) return;
  
  const content = document.getElementById('viewRouteContent');
  content.innerHTML = `
    <div class="route-header">
      <div class="route-icon">🛣️</div>
      <div class="route-title">
        <h2>${route.name}</h2>
        <p class="route-type-badge">${route.type.toUpperCase()}</p>
      </div>
    </div>
    
    <div class="route-info-grid">
      <div class="route-info-item">
        <h4>Información Básica</h4>
        <div class="info-details">
          <p><strong>Nombre:</strong> ${route.name}</p>
          <p><strong>Tipo:</strong> ${route.type.toUpperCase()}</p>
          <p><strong>Precio Base:</strong> $${route.basePrice}</p>
          ${typeof route.childPrice === 'number' ? `<p><strong>Precio Niños:</strong> $${route.childPrice}</p>` : ''}
          <p><strong>Estado:</strong> <span class="status-badge ${route.status || 'activo'}">${(route.status || 'activo').toUpperCase()}</span></p>
        </div>
      </div>
      
      <div class="route-info-item">
        <h4>Descripción</h4>
        <div class="info-details">
          <p>${route.description || 'Sin descripción disponible'}</p>
        </div>
      </div>
      
      <div class="route-info-item">
        <h4>Imagen</h4>
        <div class="info-details">
          ${route.image ? `
            <div class="route-image-preview">
              <img src="${route.image}" alt="${route.name}" style="max-width: 100%; height: 200px; object-fit: cover; border-radius: 8px; border: 2px solid var(--border-color);">
            </div>
          ` : '<p>Sin imagen disponible</p>'}
        </div>
      </div>
      
      <div class="route-info-item">
        <h4>ID de la Ruta</h4>
        <div class="info-details">
          <p><strong>Código:</strong> ${route.id}</p>
          <p><strong>Creada:</strong> ${new Date(route.createdAt).toLocaleDateString()}</p>
          ${route.updatedAt ? `<p><strong>Actualizada:</strong> ${new Date(route.updatedAt).toLocaleDateString()}</p>` : ''}
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('viewRouteModal').style.display = 'block';
}

function openEditRouteModal(routeId) {
  const route = state.routes.find(r => r.id === routeId);
  if (!route) return;
  
  // Llenar el formulario con los datos de la ruta
  document.getElementById('editRouteType').value = route.type;
  document.getElementById('editRouteName').value = route.name;
  document.getElementById('editRoutePrice').value = route.basePrice;
  document.getElementById('editRouteChildPrice').value = route.childPrice || '';
  document.getElementById('editRouteDescription').value = route.description || '';
  document.getElementById('editRouteImage').value = route.image || '';
  document.getElementById('editRouteStatus').value = route.status || 'activo';
  
  // Guardar el ID de la ruta para la actualización
  document.getElementById('editRouteForm').setAttribute('data-route-id', routeId);
  
  document.getElementById('editRouteModal').style.display = 'block';
}

function showAddRouteModal() {
  const modal = document.getElementById('addRouteModal');
  const form = document.getElementById('addRouteForm');
  
  // Limpiar el formulario
  form.reset();
  
  modal.style.display = 'block';
}

function createRoute() {
  const form = document.getElementById('addRouteForm');
  const formData = new FormData(form);
  
  const type = formData.get('type').trim();
  const name = formData.get('name').trim();
  const basePrice = parseFloat(formData.get('basePrice')) || 0;
  const childPrice = formData.get('childPrice') ? parseFloat(formData.get('childPrice')) : null;
  const description = formData.get('description').trim();
  const image = formData.get('image').trim();
  
  if (!type || !name || !basePrice) {
    notify('Completa tipo, nombre y precio', 'error');
    return;
  }
  
  if (basePrice <= 0) {
    notify('El precio debe ser mayor a 0', 'error');
    return;
  }
  
  // Crear la nueva ruta
  const newRoute = {
    id: `r${Date.now()}`,
    type: type.toLowerCase(),
    name,
    basePrice,
    childPrice,
    description: description || null,
    image: image || null,
    status: 'activo',
    createdAt: new Date().toISOString()
  };
  
  state.routes.push(newRoute);
  saveAll();
  renderRoutes();
  closeModal('addRouteModal');
  notify('Ruta creada correctamente', 'success');
}

// Función para inicializar los event listeners de los modales de rutas
function initRouteModals() {
  // Modal de vista de ruta
  const viewModal = document.getElementById('viewRouteModal');
  const closeViewBtn = document.getElementById('closeViewRouteModal');
  
  if (closeViewBtn) {
    closeViewBtn.addEventListener('click', () => closeModal('viewRouteModal'));
  }
  if (viewModal) {
    viewModal.addEventListener('click', (event) => {
      if (event.target === viewModal) closeModal('viewRouteModal');
    });
  }
  
  // Modal de edición de ruta
  const editModal = document.getElementById('editRouteModal');
  const closeEditBtn = document.getElementById('closeEditRouteModal');
  const cancelEditBtn = document.getElementById('cancelEditRoute');
  const editForm = document.getElementById('editRouteForm');
  
  if (closeEditBtn) {
    closeEditBtn.addEventListener('click', () => closeModal('editRouteModal'));
  }
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => closeModal('editRouteModal'));
  }
  if (editModal) {
    editModal.addEventListener('click', (event) => {
      if (event.target === editModal) closeModal('editRouteModal');
    });
  }
  
  // Manejar el envío del formulario de edición
  if (editForm) {
    editForm.addEventListener('submit', (event) => {
      event.preventDefault();
      
      const routeId = editForm.getAttribute('data-route-id');
      const route = state.routes.find(r => r.id === routeId);
      
      if (!route) {
        notify('Ruta no encontrada', 'error');
        return;
      }
      
      // Actualizar los datos de la ruta
      route.type = document.getElementById('editRouteType').value.toLowerCase();
      route.name = document.getElementById('editRouteName').value.trim();
      route.basePrice = parseFloat(document.getElementById('editRoutePrice').value) || 0;
  route.childPrice = document.getElementById('editRouteChildPrice').value ? parseFloat(document.getElementById('editRouteChildPrice').value) : null;
      route.description = document.getElementById('editRouteDescription').value.trim() || null;
      route.image = document.getElementById('editRouteImage').value.trim() || null;
      route.status = document.getElementById('editRouteStatus').value;
      route.updatedAt = new Date().toISOString();
      
      // Guardar cambios
      saveAll();
      renderRoutes();
      closeModal('editRouteModal');
      notify('Ruta actualizada correctamente', 'success');
    });
  }
  
  // Modal de añadir ruta
  const addModal = document.getElementById('addRouteModal');
  const closeAddBtn = document.getElementById('closeAddRouteModal');
  const cancelAddBtn = document.getElementById('cancelAddRoute');
  const addForm = document.getElementById('addRouteForm');
  
  if (closeAddBtn) {
    closeAddBtn.addEventListener('click', () => closeModal('addRouteModal'));
  }
  if (cancelAddBtn) {
    cancelAddBtn.addEventListener('click', () => closeModal('addRouteModal'));
  }
  if (addModal) {
    addModal.addEventListener('click', (event) => {
      if (event.target === addModal) closeModal('addRouteModal');
    });
  }
  
  // Manejar el envío del formulario de añadir
  if (addForm) {
    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      createRoute();
    });
  }
  
  // Botón para añadir ruta
  const addRouteBtn = document.getElementById('addRoute');
  if (addRouteBtn) {
    addRouteBtn.addEventListener('click', showAddRouteModal);
  }
}

// Funciones para manejar los modales de vehículos
function openViewVehicleModal(vehicleId) {
  const vehicle = state.fleet.find(v => v.id === vehicleId);
  if (!vehicle) return;
  
  const content = document.getElementById('viewVehicleContent');
  content.innerHTML = `
    <div class="vehicle-header">
      <div class="vehicle-icon">🚗</div>
      <div class="vehicle-title">
        <h2>${vehicle.brand} ${vehicle.model}</h2>
        <p class="vehicle-plate">Placa: ${vehicle.plate}</p>
      </div>
    </div>
    
    <div class="vehicle-info-grid">
      <div class="vehicle-info-item">
        <h4>Información Básica</h4>
        <div class="info-details">
          <p><strong>Marca:</strong> ${vehicle.brand}</p>
          <p><strong>Modelo:</strong> ${vehicle.model}</p>
          <p><strong>Año:</strong> ${vehicle.year || 'N/A'}</p>
          <p><strong>Color:</strong> ${vehicle.color || 'No especificado'}</p>
        </div>
      </div>
      
      <div class="vehicle-info-item">
        <h4>Especificaciones</h4>
        <div class="info-details">
          <p><strong>Capacidad:</strong> ${vehicle.capacity} pasajeros</p>
          <p><strong>Tipo:</strong> ${getVehicleTypeDisplay(vehicle.type)}</p>
          <p><strong>Combustible:</strong> ${getFuelTypeDisplay(vehicle.fuel)}</p>
          <p><strong>Transmisión:</strong> ${getTransmissionDisplay(vehicle.transmission)}</p>
        </div>
      </div>
      
      <div class="vehicle-info-item">
        <h4>Estado y Mantenimiento</h4>
        <div class="info-details">
          <p><strong>Estado:</strong> <span class="vehicle-status-badge ${vehicle.status || 'disponible'}">${getVehicleStatusDisplay(vehicle.status)}</span></p>
          <p><strong>Kilometraje:</strong> ${(vehicle.mileage || 0).toLocaleString()} km</p>
          <p><strong>Seguro:</strong> ${vehicle.insurance || 'No especificado'}</p>
        </div>
      </div>
      
      <div class="vehicle-info-item">
        <h4>ID del Vehículo</h4>
        <div class="info-details">
          <p><strong>Código:</strong> ${vehicle.id}</p>
        </div>
      </div>
    </div>
    
    ${vehicle.notes ? `
      <div class="vehicle-notes">
        <h4>Notas Adicionales</h4>
        <p>${vehicle.notes}</p>
      </div>
    ` : ''}
  `;
  
  document.getElementById('viewVehicleModal').style.display = 'block';
}

function openEditVehicleModal(vehicleId) {
  const vehicle = state.fleet.find(v => v.id === vehicleId);
  if (!vehicle) return;
  
  // Llenar el formulario con los datos del vehículo
  document.getElementById('editVehicleBrand').value = vehicle.brand || '';
  document.getElementById('editVehicleModel').value = vehicle.model || '';
  document.getElementById('editVehiclePlate').value = vehicle.plate || '';
  document.getElementById('editVehicleYear').value = vehicle.year || '';
  document.getElementById('editVehicleCapacity').value = vehicle.capacity || '';
  document.getElementById('editVehicleType').value = vehicle.type || '';
  document.getElementById('editVehicleFuel').value = vehicle.fuel || '';
  document.getElementById('editVehicleTransmission').value = vehicle.transmission || '';
  document.getElementById('editVehicleColor').value = vehicle.color || '';
  document.getElementById('editVehicleMileage').value = vehicle.mileage || 0;
  document.getElementById('editVehicleStatus').value = vehicle.status || 'disponible';
  document.getElementById('editVehicleInsurance').value = vehicle.insurance || '';
  document.getElementById('editVehicleNotes').value = vehicle.notes || '';
  
  // Guardar el ID del vehículo para la actualización
  document.getElementById('editVehicleForm').setAttribute('data-vehicle-id', vehicleId);
  
  document.getElementById('editVehicleModal').style.display = 'block';
}

// Función para mostrar el modal de añadir vehículo
function showAddVehicleModal() {
  const modal = document.getElementById('addVehicleModal');
  if (!modal) return;
  modal.style.display = 'block';
  modal.style.visibility = 'visible';
  modal.style.opacity = '1';
  const form = document.getElementById('addVehicleForm');
  if (form) {
    form.reset();
    const statusField = document.getElementById('addVehicleStatus');
    const yearField = document.getElementById('addVehicleYear');
    const mileageField = document.getElementById('addVehicleMileage');
    if (statusField) statusField.value = 'disponible';
    if (yearField) yearField.value = new Date().getFullYear();
    if (mileageField) mileageField.value = '0';
  }
}

// Función para crear un nuevo vehículo
function createVehicle() {
  const form = document.getElementById('addVehicleForm');
  const formData = new FormData(form);
  
  const brand = formData.get('brand').trim();
  const model = formData.get('model').trim();
  const plate = formData.get('plate').trim();
  const year = parseInt(formData.get('year')) || new Date().getFullYear();
  const capacity = parseInt(formData.get('capacity')) || 1;
  const type = formData.get('type');
  const fuel = formData.get('fuel');
  const transmission = formData.get('transmission');
  const color = formData.get('color').trim();
  const mileage = parseInt(formData.get('mileage')) || 0;
  const status = formData.get('status');
  const insurance = formData.get('insurance').trim();
  const notes = formData.get('notes').trim();
  
  if (!brand || !model || !plate || !capacity || !type || !fuel || !transmission || !color || !status) {
    notify('Completa todos los campos obligatorios', 'error');
    return;
  }
  
  // Validar que la placa no esté en uso
  const existingVehicle = state.fleet.find(v => v.plate.toLowerCase() === plate.toLowerCase());
  if (existingVehicle) {
    notify('Ya existe un vehículo con esta placa', 'error');
    return;
  }
  
  // Crear el nuevo vehículo
  const newVehicle = {
    id: `v${Date.now()}`,
    brand,
    model,
    plate,
    year,
    capacity,
    type,
    fuel,
    transmission,
    color,
    mileage,
    status,
    insurance,
    notes,
    createdAt: new Date().toISOString()
  };
  
  state.fleet.push(newVehicle);
  saveAll();
  renderFleet();
  closeModal('addVehicleModal');
  notify('Vehículo agregado correctamente', 'success');
}

// Función para inicializar los event listeners de los modales de vehículos
function initVehicleModals() {
  // Modal de añadir vehículo
  const addModal = document.getElementById('addVehicleModal');
  const closeAddBtn = document.getElementById('closeAddVehicleModal');
  const cancelAddBtn = document.getElementById('cancelAddVehicle');
  const addForm = document.getElementById('addVehicleForm');
  
  if (closeAddBtn) {
    closeAddBtn.addEventListener('click', () => closeModal('addVehicleModal'));
  }
  if (cancelAddBtn) {
    cancelAddBtn.addEventListener('click', () => closeModal('addVehicleModal'));
  }
  if (addModal) {
    addModal.addEventListener('click', (event) => {
      if (event.target === addModal) closeModal('addVehicleModal');
    });
  }
  
  // Manejar el envío del formulario de añadir
  if (addForm) {
    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      createVehicle();
    });
  }
  
  // Botón para añadir vehículo - usar event delegation para evitar conflictos
  // Remover event listeners anteriores si existen
  const existingListener = document.getElementById('addVehicle');
  if (existingListener) {
    existingListener.replaceWith(existingListener.cloneNode(true));
  }
  
  // Usar event delegation en el documento
  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'addVehicle') {
      e.preventDefault();
      e.stopPropagation();
      showAddVehicleModal();
    }
  });
  
  // Modal de vista de vehículo
  const viewModal = document.getElementById('viewVehicleModal');
  const closeViewBtn = document.getElementById('closeViewVehicleModal');
  
  if (closeViewBtn) {
    closeViewBtn.addEventListener('click', () => closeModal('viewVehicleModal'));
  }
  if (viewModal) {
    viewModal.addEventListener('click', (event) => {
      if (event.target === viewModal) closeModal('viewVehicleModal');
    });
  }
  
  // Modal de edición de vehículo
  const editModal = document.getElementById('editVehicleModal');
  const closeEditBtn = document.getElementById('closeEditVehicleModal');
  const cancelEditBtn = document.getElementById('cancelEditVehicle');
  const editForm = document.getElementById('editVehicleForm');
  
  if (closeEditBtn) {
    closeEditBtn.addEventListener('click', () => closeModal('editVehicleModal'));
  }
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => closeModal('editVehicleModal'));
  }
  if (editModal) {
    editModal.addEventListener('click', (event) => {
      if (event.target === editModal) closeModal('editVehicleModal');
    });
  }
  
  // Manejar el envío del formulario de edición
  if (editForm) {
    editForm.addEventListener('submit', (event) => {
      event.preventDefault();
      
      const vehicleId = editForm.getAttribute('data-vehicle-id');
      const vehicle = state.fleet.find(v => v.id === vehicleId);
      
      if (!vehicle) {
        notify('Vehículo no encontrado', 'error');
        return;
      }
      
      // Actualizar los datos del vehículo
      vehicle.brand = document.getElementById('editVehicleBrand').value.trim();
      vehicle.model = document.getElementById('editVehicleModel').value.trim();
      vehicle.plate = document.getElementById('editVehiclePlate').value.trim();
      vehicle.year = parseInt(document.getElementById('editVehicleYear').value) || new Date().getFullYear();
      vehicle.capacity = parseInt(document.getElementById('editVehicleCapacity').value) || 1;
      vehicle.type = document.getElementById('editVehicleType').value;
      vehicle.fuel = document.getElementById('editVehicleFuel').value;
      vehicle.transmission = document.getElementById('editVehicleTransmission').value;
      vehicle.color = document.getElementById('editVehicleColor').value.trim();
      vehicle.mileage = parseInt(document.getElementById('editVehicleMileage').value) || 0;
      vehicle.status = document.getElementById('editVehicleStatus').value;
      vehicle.insurance = document.getElementById('editVehicleInsurance').value.trim();
      vehicle.notes = document.getElementById('editVehicleNotes').value.trim();
      
      // Guardar cambios
      saveAll();
      renderFleet();
      closeModal('editVehicleModal');
      notify('Vehículo actualizado correctamente', 'success');
    });
  }
}

// Funciones para manejar los modales de conductores
function openViewDriverModal(driverId) {
  const driver = state.drivers.find(d => d.id === driverId);
  if (!driver) return;
  
  const content = document.getElementById('viewDriverContent');
  content.innerHTML = `
    <div class="driver-header">
      <div class="driver-icon">👨‍💼</div>
      <div class="driver-title">
        <h2>${driver.name}</h2>
        <p class="driver-status-badge">${driver.status}</p>
      </div>
    </div>
    
    <div class="driver-info-grid">
      <div class="driver-info-item">
        <h4>Información Personal</h4>
        <div class="info-details">
          <p><strong>Nombre:</strong> ${driver.name}</p>
          <p><strong>Email:</strong> ${driver.email || 'No especificado'}</p>
          <p><strong>Teléfono:</strong> ${driver.phone}</p>
          <p><strong>Licencia:</strong> ${driver.license || 'No especificado'}</p>
        </div>
      </div>
      
      <div class="driver-info-item">
        <h4>Información Laboral</h4>
        <div class="info-details">
          <p><strong>Estado:</strong> <span class="status-badge ${driver.status.toLowerCase().replace(' ', '-')}">${driver.status}</span></p>
          <p><strong>Experiencia:</strong> ${driver.experience || 0} años</p>
        </div>
      </div>
      
      <div class="driver-info-item">
        <h4>ID del Conductor</h4>
        <div class="info-details">
          <p><strong>Código:</strong> ${driver.id}</p>
          <p><strong>Registrado:</strong> ${new Date(driver.createdAt || Date.now()).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
    
    ${driver.notes ? `
      <div class="driver-notes">
        <h4>Notas Adicionales</h4>
        <p>${driver.notes}</p>
      </div>
    ` : ''}
  `;
  
  document.getElementById('viewDriverModal').style.display = 'block';
}

function openEditDriverModal(driverId) {
  const driver = state.drivers.find(d => d.id === driverId);
  if (!driver) return;
  
  // Llenar el formulario con los datos del conductor
  document.getElementById('editDriverName').value = driver.name || '';
  document.getElementById('editDriverPhone').value = driver.phone || '';
  document.getElementById('editDriverEmail').value = driver.email || '';
  document.getElementById('editDriverLicense').value = driver.license || '';
  document.getElementById('editDriverStatus').value = driver.status || 'Libre';
  document.getElementById('editDriverExperience').value = driver.experience || 0;
  document.getElementById('editDriverNotes').value = driver.notes || '';
  
  // Guardar el ID del conductor para la actualización
  document.getElementById('editDriverForm').setAttribute('data-driver-id', driverId);
  
  document.getElementById('editDriverModal').style.display = 'block';
}

function showAddDriverModal() {
  const modal = document.getElementById('addDriverModal');
  const form = document.getElementById('addDriverForm');
  
  // Limpiar el formulario
  form.reset();
  document.getElementById('addDriverStatus').value = 'Libre';
  document.getElementById('addDriverExperience').value = '0';
  
  modal.style.display = 'block';
}


function createDriver() {
  const form = document.getElementById('addDriverForm');
  const formData = new FormData(form);
  
  const name = formData.get('name').trim();
  const phone = formData.get('phone').trim();
  const email = formData.get('email').trim();
  const license = formData.get('license').trim();
  const status = formData.get('status');
  const experience = parseInt(formData.get('experience')) || 0;
  const notes = formData.get('notes').trim();
  
  if (!name || !phone || !email || !license) {
    notify('Completa todos los campos obligatorios', 'error');
    return;
  }
  
  // Validar que el email no esté en uso
  const existingDriver = state.drivers.find(d => d.email === email);
  if (existingDriver) {
    notify('Este email ya está en uso por otro conductor', 'error');
    return;
  }
  
  // Validar que la licencia no esté en uso
  const existingLicense = state.drivers.find(d => d.license === license);
  if (existingLicense) {
    notify('Este número de licencia ya está en uso', 'error');
    return;
  }
  
  // Crear el nuevo conductor
  const newDriver = {
    id: `d${Date.now()}`,
    name,
    phone,
    email,
    license,
    vehicleId: null,
    status,
    experience,
    notes: notes || null,
    location: { x: 10, y: 20 },
    createdAt: new Date().toISOString()
  };
  
  state.drivers.push(newDriver);
  saveAll();
  renderDrivers();
  closeModal('addDriverModal');
  notify('Conductor creado correctamente', 'success');
}

// Función para inicializar los event listeners de los modales de conductores
function initDriverModals() {
  // Modal de vista de conductor
  const viewModal = document.getElementById('viewDriverModal');
  const closeViewBtn = document.getElementById('closeViewDriverModal');
  
  if (closeViewBtn) {
    closeViewBtn.addEventListener('click', () => closeModal('viewDriverModal'));
  }
  if (viewModal) {
    viewModal.addEventListener('click', (event) => {
      if (event.target === viewModal) closeModal('viewDriverModal');
    });
  }
  
  // Modal de edición de conductor
  const editModal = document.getElementById('editDriverModal');
  const closeEditBtn = document.getElementById('closeEditDriverModal');
  const cancelEditBtn = document.getElementById('cancelEditDriver');
  const editForm = document.getElementById('editDriverForm');
  
  if (closeEditBtn) {
    closeEditBtn.addEventListener('click', () => closeModal('editDriverModal'));
  }
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => closeModal('editDriverModal'));
  }
  if (editModal) {
    editModal.addEventListener('click', (event) => {
      if (event.target === editModal) closeModal('editDriverModal');
    });
  }
  
  // Manejar el envío del formulario de edición
  if (editForm) {
    editForm.addEventListener('submit', (event) => {
      event.preventDefault();
      
      const driverId = editForm.getAttribute('data-driver-id');
      const driver = state.drivers.find(d => d.id === driverId);
      
      if (!driver) {
        notify('Conductor no encontrado', 'error');
        return;
      }
      
      // Actualizar los datos del conductor
      driver.name = document.getElementById('editDriverName').value.trim();
      driver.phone = document.getElementById('editDriverPhone').value.trim();
      driver.email = document.getElementById('editDriverEmail').value.trim();
      driver.license = document.getElementById('editDriverLicense').value.trim();
      driver.status = document.getElementById('editDriverStatus').value;
      driver.experience = parseInt(document.getElementById('editDriverExperience').value) || 0;
      driver.notes = document.getElementById('editDriverNotes').value.trim() || null;
      
      // Guardar cambios
      saveAll();
      renderDrivers();
      closeModal('editDriverModal');
      notify('Conductor actualizado correctamente', 'success');
    });
  }
  
  // Modal de añadir conductor
  const addModal = document.getElementById('addDriverModal');
  const closeAddBtn = document.getElementById('closeAddDriverModal');
  const cancelAddBtn = document.getElementById('cancelAddDriver');
  const addForm = document.getElementById('addDriverForm');
  
  if (closeAddBtn) {
    closeAddBtn.addEventListener('click', () => closeModal('addDriverModal'));
  }
  if (cancelAddBtn) {
    cancelAddBtn.addEventListener('click', () => closeModal('addDriverModal'));
  }
  if (addModal) {
    addModal.addEventListener('click', (event) => {
      if (event.target === addModal) closeModal('addDriverModal');
    });
  }
  
  // Manejar el envío del formulario de añadir
  if (addForm) {
    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      createDriver();
    });
  }
  
  // Botón para añadir conductor
  const addDriverBtn = document.getElementById('addDriver');
  if (addDriverBtn) {
    addDriverBtn.addEventListener('click', showAddDriverModal);
  }
}

// Funciones para manejar los modales de cupones
function openViewCouponModal(couponId) {
  const coupon = state.coupons.find(c => c.id === couponId);
  if (!coupon) return;
  
  const content = document.getElementById('viewCouponContent');
  content.innerHTML = `
    <div class="coupon-header">
      <div class="coupon-icon">🎫</div>
      <div class="coupon-title">
        <h2>${coupon.code}</h2>
        <p class="coupon-discount">${coupon.percent}% de descuento</p>
      </div>
    </div>
    
    <div class="coupon-info-grid">
      <div class="coupon-info-item">
        <h4>Información Básica</h4>
        <div class="info-details">
          <p><strong>Código:</strong> ${coupon.code}</p>
          <p><strong>Descuento:</strong> ${coupon.percent}%</p>
          <p><strong>Estado:</strong> <span class="status-badge ${(coupon.status || 'activo').toLowerCase()}">${(coupon.status || 'activo').toUpperCase()}</span></p>
          <p><strong>Descripción:</strong> ${coupon.description || 'Sin descripción'}</p>
        </div>
      </div>
      
      <div class="coupon-info-item">
        <h4>Configuración</h4>
        <div class="info-details">
          <p><strong>Fecha de Expiración:</strong> ${coupon.expiry ? new Date(coupon.expiry).toLocaleDateString() : 'Sin fecha límite'}</p>
          <p><strong>Límite de Uso:</strong> ${coupon.usageLimit || 'Sin límite'}</p>
          <p><strong>Usos Actuales:</strong> ${coupon.usageCount || 0}</p>
        </div>
      </div>
      
      <div class="coupon-info-item">
        <h4>ID del Cupón</h4>
        <div class="info-details">
          <p><strong>Código:</strong> ${coupon.id}</p>
          <p><strong>Creado:</strong> ${new Date(coupon.createdAt || Date.now()).toLocaleDateString()}</p>
          ${coupon.updatedAt ? `<p><strong>Actualizado:</strong> ${new Date(coupon.updatedAt).toLocaleDateString()}</p>` : ''}
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('viewCouponModal').style.display = 'block';
}

function openEditCouponModal(couponId) {
  const coupon = state.coupons.find(c => c.id === couponId);
  if (!coupon) return;
  
  // Llenar el formulario con los datos del cupón
  document.getElementById('editCouponCode').value = coupon.code || '';
  document.getElementById('editCouponPercent').value = coupon.percent || '';
  document.getElementById('editCouponDescription').value = coupon.description || '';
  document.getElementById('editCouponStatus').value = coupon.status || 'activo';
  document.getElementById('editCouponExpiry').value = coupon.expiry || '';
  document.getElementById('editCouponUsageLimit').value = coupon.usageLimit || '';
  
  // Guardar el ID del cupón para la actualización
  document.getElementById('editCouponForm').setAttribute('data-coupon-id', couponId);
  
  document.getElementById('editCouponModal').style.display = 'block';
}

function showAddCouponModal() {
  const modal = document.getElementById('addCouponModal');
  const form = document.getElementById('addCouponForm');
  
  // Limpiar el formulario
  form.reset();
  document.getElementById('addCouponStatus').value = 'activo';
  
  modal.style.display = 'block';
}

function createCoupon() {
  const form = document.getElementById('addCouponForm');
  const formData = new FormData(form);
  
  const code = formData.get('code').trim();
  const percent = parseInt(formData.get('percent')) || 0;
  const description = formData.get('description').trim();
  const status = formData.get('status');
  const expiry = formData.get('expiry');
  const usageLimit = formData.get('usageLimit');
  
  if (!code || !percent) {
    notify('Completa código y porcentaje', 'error');
    return;
  }
  
  if (percent <= 0 || percent > 100) {
    notify('El porcentaje debe estar entre 1 y 100', 'error');
    return;
  }
  
  // Validar que el código no esté en uso
  const existingCoupon = state.coupons.find(c => c.code.toLowerCase() === code.toLowerCase());
  if (existingCoupon) {
    notify('Ya existe un cupón con este código', 'error');
    return;
  }
  
  // Crear el nuevo cupón
  const newCoupon = {
    id: `c${Date.now()}`,
    code,
    percent,
    description: description || null,
    status,
    expiry: expiry || null,
    usageLimit: usageLimit ? parseInt(usageLimit) : null,
    usageCount: 0,
    createdAt: new Date().toISOString()
  };
  
  state.coupons.push(newCoupon);
  saveAll();
  renderCoupons();
  closeModal('addCouponModal');
  notify('Cupón creado correctamente', 'success');
}

// Función para inicializar los event listeners de los modales de cupones
function initCouponModals() {
  // Modal de vista de cupón
  const viewModal = document.getElementById('viewCouponModal');
  const closeViewBtn = document.getElementById('closeViewCouponModal');
  
  if (closeViewBtn) {
    closeViewBtn.addEventListener('click', () => closeModal('viewCouponModal'));
  }
  if (viewModal) {
    viewModal.addEventListener('click', (event) => {
      if (event.target === viewModal) closeModal('viewCouponModal');
    });
  }
  
  // Modal de edición de cupón
  const editModal = document.getElementById('editCouponModal');
  const closeEditBtn = document.getElementById('closeEditCouponModal');
  const cancelEditBtn = document.getElementById('cancelEditCoupon');
  const editForm = document.getElementById('editCouponForm');
  
  if (closeEditBtn) {
    closeEditBtn.addEventListener('click', () => closeModal('editCouponModal'));
  }
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => closeModal('editCouponModal'));
  }
  if (editModal) {
    editModal.addEventListener('click', (event) => {
      if (event.target === editModal) closeModal('editCouponModal');
    });
  }
  
  // Manejar el envío del formulario de edición
  if (editForm) {
    editForm.addEventListener('submit', (event) => {
      event.preventDefault();
      
      const couponId = editForm.getAttribute('data-coupon-id');
      const coupon = state.coupons.find(c => c.id === couponId);
      
      if (!coupon) {
        notify('Cupón no encontrado', 'error');
        return;
      }
      
      // Actualizar los datos del cupón
      const formData = new FormData(editForm);
      const code = formData.get('code').trim();
      const percent = parseInt(formData.get('percent')) || 0;
      const description = formData.get('description').trim();
      const status = formData.get('status');
      const expiry = formData.get('expiry');
      const usageLimit = formData.get('usageLimit');
      
      if (!code || !percent) {
        notify('Completa código y porcentaje', 'error');
        return;
      }
      
      if (percent <= 0 || percent > 100) {
        notify('El porcentaje debe estar entre 1 y 100', 'error');
        return;
      }
      
      // Validar que el código no esté en uso por otro cupón
      const existingCoupon = state.coupons.find(c => c.code.toLowerCase() === code.toLowerCase() && c.id !== couponId);
      if (existingCoupon) {
        notify('Ya existe otro cupón con este código', 'error');
        return;
      }
      
      coupon.code = code;
      coupon.percent = percent;
      coupon.description = description || null;
      coupon.status = status;
      coupon.expiry = expiry || null;
      coupon.usageLimit = usageLimit ? parseInt(usageLimit) : null;
      coupon.updatedAt = new Date().toISOString();
      
      // Guardar cambios
      saveAll();
      renderCoupons();
      closeModal('editCouponModal');
      notify('Cupón actualizado correctamente', 'success');
    });
  }
  
  // Modal de añadir cupón
  const addModal = document.getElementById('addCouponModal');
  const closeAddBtn = document.getElementById('closeAddCouponModal');
  const cancelAddBtn = document.getElementById('cancelAddCoupon');
  const addForm = document.getElementById('addCouponForm');
  
  if (closeAddBtn) {
    closeAddBtn.addEventListener('click', () => closeModal('addCouponModal'));
  }
  if (cancelAddBtn) {
    cancelAddBtn.addEventListener('click', () => closeModal('addCouponModal'));
  }
  if (addModal) {
    addModal.addEventListener('click', (event) => {
      if (event.target === addModal) closeModal('addCouponModal');
    });
  }
  
  // Manejar el envío del formulario de añadir
  if (addForm) {
    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      createCoupon();
    });
  }
  
  // Botón para añadir cupón
  const addCouponBtn = document.getElementById('addCoupon');
  if (addCouponBtn) {
    addCouponBtn.addEventListener('click', showAddCouponModal);
  }
}

// Funciones para manejar los modales de clientes
function openViewClientModal(clientId) {
  const client = state.users.find(u => u.id === clientId);
  if (!client) return;
  
  const content = document.getElementById('viewClientContent');
  content.innerHTML = `
    <div class="user-avatar">${client.name.charAt(0).toUpperCase()}</div>
    <div class="user-info-grid">
      <div class="user-info-item">
        <h4>Nombre Completo</h4>
        <p>${client.name}</p>
      </div>
      <div class="user-info-item">
        <h4>Email</h4>
        <p>${client.email}</p>
      </div>
      <div class="user-info-item">
        <h4>Teléfono</h4>
        <p>${client.profile?.telefono || 'No especificado'}</p>
      </div>
      <div class="user-info-item">
        <h4>Tipo de Cliente</h4>
        <p><span class="user-role-badge ${client.role}">${client.role.toUpperCase()}</span></p>
      </div>
      <div class="user-info-item">
        <h4>Estado</h4>
        <p><span class="user-status ${(client.status || 'Activo').toLowerCase()}">${client.status || 'Activo'}</span></p>
      </div>
      <div class="user-info-item">
        <h4>ID de Usuario</h4>
        <p>${client.id}</p>
      </div>
    </div>
    ${client.profile ? `
      <div class="user-info-grid">
        <div class="user-info-item">
          <h4>Nombres</h4>
          <p>${client.profile.nombres || 'No especificado'}</p>
        </div>
        <div class="user-info-item">
          <h4>Apellidos</h4>
          <p>${client.profile.apellidos || 'No especificado'}</p>
        </div>
      </div>
    ` : ''}
  `;
  
  document.getElementById('viewClientModal').style.display = 'block';
}

function openEditClientModal(clientId) {
  const client = state.users.find(u => u.id === clientId);
  if (!client) return;
  
  // Llenar el formulario con los datos del cliente
  document.getElementById('editClientName').value = client.name;
  document.getElementById('editClientEmail').value = client.email;
  document.getElementById('editClientPhone').value = client.profile?.telefono || '';
  document.getElementById('editClientRole').value = client.role;
  document.getElementById('editClientStatus').value = client.status || 'Activo';
  
  // Guardar el ID del cliente para la actualización
  document.getElementById('editClientForm').setAttribute('data-client-id', clientId);
  
  document.getElementById('editClientModal').style.display = 'block';
}

// Función para inicializar los event listeners de los modales de clientes
function initClientModals() {
  // Modal de vista de cliente
  const viewModal = document.getElementById('viewClientModal');
  const closeViewBtn = document.getElementById('closeViewClientModal');
  
  if (closeViewBtn) {
    closeViewBtn.addEventListener('click', () => closeModal('viewClientModal'));
  }
  if (viewModal) {
    viewModal.addEventListener('click', (event) => {
      if (event.target === viewModal) closeModal('viewClientModal');
    });
  }
  
  // Modal de edición de cliente
  const editModal = document.getElementById('editClientModal');
  const closeEditBtn = document.getElementById('closeEditClientModal');
  const cancelEditBtn = document.getElementById('cancelEditClient');
  const editForm = document.getElementById('editClientForm');
  
  if (closeEditBtn) {
    closeEditBtn.addEventListener('click', () => closeModal('editClientModal'));
  }
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => closeModal('editClientModal'));
  }
  if (editModal) {
    editModal.addEventListener('click', (event) => {
      if (event.target === editModal) closeModal('editClientModal');
    });
  }
  
  // Manejar el envío del formulario de edición
  if (editForm) {
    editForm.addEventListener('submit', (event) => {
      event.preventDefault();
      
      const clientId = editForm.getAttribute('data-client-id');
      const client = state.users.find(u => u.id === clientId);
      
      if (!client) {
        notify('Cliente no encontrado', 'error');
        return;
      }
      
      // Actualizar los datos del cliente
      client.name = document.getElementById('editClientName').value.trim();
      client.email = document.getElementById('editClientEmail').value.trim();
      client.role = document.getElementById('editClientRole').value;
      client.status = document.getElementById('editClientStatus').value;
      
      // Actualizar el perfil
      if (!client.profile) client.profile = {};
      client.profile.telefono = document.getElementById('editClientPhone').value.trim();
      client.profile.nombres = client.name.split(' ')[0] || '';
      client.profile.apellidos = client.name.split(' ').slice(1).join(' ') || '';
      
      // Guardar cambios
      saveAll();
      renderClients();
      closeModal('editClientModal');
      notify('Cliente actualizado correctamente', 'success');
    });
  }
}

// Sistema de navegación del sidebar
function initTabs() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Remover clase active de todos los botones y paneles
      navButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      // Activar el botón y panel seleccionado
      button.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
      
      // Manejar el mapa GPS
      if (targetTab === 'gps') {
        // Inicializar el mapa cuando se accede a la pestaña GPS
        setTimeout(() => {
          if (!mapInstance) {
            initMap();
          }
        }, 100);
      } else {
        // Limpiar el mapa cuando se sale de la pestaña GPS
        if (mapInstance) {
          stopLocationUpdates();
        }
      }
    });
  });
}

// Funciones para las nuevas secciones
function renderUsers() {
  const container = document.getElementById('usersTable');
  // Filtrar solo trabajadores: admin, conductor, empresa
  const workers = state.users.filter(u => ['admin', 'conductor', 'empresa'].includes(u.role));
  const rows = workers.map(u => `
    <tr>
      <td>${u.name}</td><td>${u.email}</td><td><span class="role-badge ${u.role}">${u.role.toUpperCase()}</span></td><td>${u.status || 'Activo'}</td>
      <td class="table-actions">
        <button class="btn ghost" data-action="view" data-id="${u.id}" title="Ver detalles">👁️</button>
        <button class="btn ghost" data-action="edit" data-id="${u.id}" title="Editar">✏️</button>
        <button class="btn ghost" data-action="del" data-id="${u.id}" title="Eliminar">🗑️</button>
      </td>
    </tr>`).join('');
  
  container.innerHTML = table(['Nombre','Email','Rol','Estado','Acciones'], rows);
  
  // Event listeners para los botones de acción
  container.querySelectorAll('button[data-action]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const user = state.users.find(u => u.id === id);
      
      if (action === 'view') {
        showViewUserModal(user);
      } else if (action === 'edit') {
        showEditUserModal(user);
      } else if (action === 'del') {
        if (confirm(`¿Estás seguro de que quieres eliminar al usuario "${user.name}"?`)) {
          state.users = state.users.filter(u => u.id !== id);
          saveAll();
          renderUsers();
          notify('Usuario eliminado correctamente', 'success');
        }
      }
    });
  });
}

// Función para mostrar el modal de vista de usuario
function showViewUserModal(user) {
  const modal = document.getElementById('viewUserModal');
  const content = document.getElementById('viewUserContent');
  
  content.innerHTML = `
    <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
    <div class="user-info-grid">
      <div class="user-info-item">
        <h4>Nombre Completo</h4>
        <p>${user.name}</p>
    </div>
      <div class="user-info-item">
        <h4>Email</h4>
        <p>${user.email}</p>
      </div>
      <div class="user-info-item">
        <h4>Rol</h4>
        <p><span class="user-role-badge ${user.role}">${user.role.toUpperCase()}</span></p>
      </div>
      <div class="user-info-item">
        <h4>Estado</h4>
        <p><span class="user-status ${(user.status || 'Activo').toLowerCase()}">${user.status || 'Activo'}</span></p>
      </div>
    </div>
    <div class="user-info-item">
      <h4>ID del Usuario</h4>
      <p style="font-family: monospace; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 4px;">${user.id}</p>
    </div>
  `;
  
  modal.style.display = 'block';
}

// Función para mostrar el modal de edición de usuario
function showEditUserModal(user) {
  const modal = document.getElementById('editUserModal');
  const form = document.getElementById('editUserForm');
  
  // Llenar el formulario con los datos actuales del usuario
  document.getElementById('editUserName').value = user.name;
  document.getElementById('editUserEmail').value = user.email;
  document.getElementById('editUserRole').value = user.role;
  document.getElementById('editUserStatus').value = user.status || 'Activo';
  
  modal.style.display = 'block';
  
  // Remover event listeners anteriores
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  
  // Agregar event listener para el formulario
  document.getElementById('editUserForm').addEventListener('submit', (e) => {
    e.preventDefault();
    updateUser(user.id);
  });
}

// Función para actualizar un usuario
function updateUser(userId) {
  const form = document.getElementById('editUserForm');
  const formData = new FormData(form);
  
  const name = formData.get('name').trim();
  const email = formData.get('email').trim();
  const role = formData.get('role').trim();
  const status = formData.get('status').trim();
  
  if (!name || !email || !role || !status) {
    notify('Completa todos los campos', 'error');
    return;
  }
  
  // Validar que el email no esté en uso por otro usuario
  const existingUser = state.users.find(u => u.email === email && u.id !== userId);
  if (existingUser) {
    notify('Este email ya está en uso por otro usuario', 'error');
    return;
  }
  
  // Actualizar el usuario
  const userIndex = state.users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    state.users[userIndex] = {
      ...state.users[userIndex],
      name,
      email,
      role,
      status
    };
    saveAll();
    renderUsers();
    closeModal('editUserModal');
    notify('Usuario actualizado correctamente', 'success');
  }
}

// Función para mostrar el modal de añadir usuario
function showAddUserModal() {
  const modal = document.getElementById('addUserModal');
  const form = document.getElementById('addUserForm');
  
  // Limpiar el formulario
  form.reset();
  document.getElementById('addUserStatus').value = 'Activo';
  
  modal.style.display = 'block';
  
  // Remover event listeners anteriores
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);
  
  // Agregar event listener para el formulario
  document.getElementById('addUserForm').addEventListener('submit', (e) => {
    e.preventDefault();
    createUser();
  });
}

// Función para crear un nuevo usuario
function createUser() {
  const form = document.getElementById('addUserForm');
  const formData = new FormData(form);
  
  const name = formData.get('name').trim();
  const email = formData.get('email').trim();
  const password = formData.get('password').trim();
  const role = formData.get('role').trim();
  const status = formData.get('status').trim();
  
  if (!name || !email || !password || !role || !status) {
    notify('Completa todos los campos', 'error');
    return;
  }
  
  // Validar que el email no esté en uso
  const existingUser = state.users.find(u => u.email === email);
  if (existingUser) {
    notify('Este email ya está en uso', 'error');
    return;
  }
  
  // Validar contraseña
  if (password.length < 6) {
    notify('La contraseña debe tener al menos 6 caracteres', 'error');
    return;
  }
  
  // Crear el nuevo usuario
    const newUser = {
      id: `u${Date.now()}`,
      name,
      email,
    password,
      role,
    status,
    createdAt: new Date().toISOString()
  };
  
    state.users.push(newUser);
  saveAll();
  renderUsers();
  closeModal('addUserModal');
  notify('Usuario creado correctamente', 'success');
}

// Función para cerrar modales
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

// Función para mostrar modales
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'block';
  }
}

// Función universal para inicializar todos los modales
function initAllModals() {
  // Obtener todos los modales
  const modals = document.querySelectorAll('.modal');
  
  modals.forEach(modal => {
    const modalId = modal.id;
    
    // Buscar botón de cerrar (X) en el header
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal(modalId));
    }
    
    // Buscar botones de cancelar
    const cancelBtns = modal.querySelectorAll('[data-action="cancel"], .btn.secondary');
    cancelBtns.forEach(btn => {
      if (btn.textContent.toLowerCase().includes('cancelar') || 
          btn.textContent.toLowerCase().includes('cerrar')) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          console.log(`Cancelando modal ${modalId}`);
          closeModal(modalId);
        });
      }
    });
    
    // Buscar específicamente botones con IDs conocidos
    const specificCancelBtns = modal.querySelectorAll('#cancelEdit, #cancelAdd');
    specificCancelBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`Cancelando modal específico ${modalId}`);
        closeModal(modalId);
      });
    });
    
    // Cerrar modal haciendo click fuera del contenido
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal(modalId);
      }
    });
    
    // Cerrar modal con tecla Escape
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.style.display === 'block') {
        closeModal(modalId);
      }
    });
  });
}

// Variables globales para el modal de asignación
let currentBookingId = null;

// Función para abrir el modal de asignación
function openAssignModal(bookingId) {
  currentBookingId = bookingId;
  const modal = document.getElementById('assignModal');
  const driverSelect = document.getElementById('assignDriver');
  const vehicleSelect = document.getElementById('assignVehicle');
  
  // Limpiar selects
  driverSelect.innerHTML = '<option value="">Seleccionar conductor</option>';
  vehicleSelect.innerHTML = '<option value="">Seleccionar vehículo</option>';
  
  // Cargar conductores disponibles
  const availableDrivers = state.drivers.filter(d => d.status === 'Libre');
  availableDrivers.forEach(driver => {
    const option = document.createElement('option');
    option.value = driver.id;
    option.textContent = `${driver.name} - ${driver.phone}`;
    driverSelect.appendChild(option);
  });
  
  // Cargar todos los vehículos
  state.fleet.forEach(vehicle => {
    const option = document.createElement('option');
    option.value = vehicle.id;
    const statusText = vehicle.status === 'disponible' ? 'Disponible' : 
                      vehicle.status === 'en-uso' ? 'En Uso' : 
                      vehicle.status === 'mantenimiento' ? 'Mantenimiento' : 'Inactivo';
    option.textContent = `${vehicle.brand} ${vehicle.model} - ${vehicle.plate} (${statusText})`;
    vehicleSelect.appendChild(option);
  });
  
  // Mostrar modal
  modal.style.display = 'block';
}

// Función para asignar conductor y vehículo
function assignDriverAndVehicle() {
  const driverId = document.getElementById('assignDriver').value;
  const vehicleId = document.getElementById('assignVehicle').value;
  
  if (!driverId || !vehicleId) {
    notify('Selecciona un conductor y un vehículo', 'error');
    return;
  }
  
  const booking = state.bookings.find(b => b.id === currentBookingId);
  const driver = state.drivers.find(d => d.id === driverId);
  const vehicle = state.fleet.find(v => v.id === vehicleId);
  
  if (!booking || !driver || !vehicle) {
    notify('Error: datos no encontrados', 'error');
    return;
  }
  
  // Validar que el conductor esté libre
  if (driver.status !== 'Libre') {
    notify('El conductor seleccionado no está disponible', 'error');
    return;
  }
  
  // Validar que el vehículo no esté en mantenimiento o inactivo
  if (vehicle.status === 'mantenimiento' || vehicle.status === 'inactivo') {
    notify('El vehículo seleccionado no está disponible para asignación', 'error');
    return;
  }
  
  // Asignar conductor y vehículo
  booking.driverId = driverId;
  booking.status = 'Confirmado'; // Cambiar directamente a Confirmado para que el cliente lo vea
  
  // Actualizar estado del conductor
  driver.status = 'Ocupado';
  driver.vehicleId = vehicleId;
  
  // Actualizar estado del vehículo
  vehicle.status = 'en-uso';
  
  // Guardar cambios
  saveAll();
  
  // Cerrar modal
  closeModal('assignModal');
  
  // Actualizar interfaz
  updateAssignmentCounts();
  const activePane = document.querySelector('.assignment-tab-pane.active');
  const activeId = activePane ? activePane.id : 'pendiente';
  renderAssignmentTab(activeId);
  
  // Actualizar otras vistas
  renderDrivers();
  renderFleet();
  
  notify(`Reserva ${booking.id} asignada a ${driver.name} con vehículo ${vehicle.brand} ${vehicle.model}`, 'success');
}

// Hacer las funciones globales para que funcionen desde HTML
window.closeModal = closeModal;
window.showModal = showModal;
window.showAddVehicleModal = showAddVehicleModal;
window.createVehicle = createVehicle;
window.openViewClientModal = openViewClientModal;
window.openAssignModal = openAssignModal;
window.assignDriverAndVehicle = assignDriverAndVehicle;

// Función de prueba para el modal
// Eliminada función de prueba testAddVehicleModal por no ser necesaria en producción

// Inicializar event listeners para modales
function initModalEventListeners() {
  // Botón para limpiar todas las reservas
  const clearBookingsBtn = document.getElementById('clearBookings');
  if (clearBookingsBtn) {
    clearBookingsBtn.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que quieres eliminar todas las reservas? Esta acción no se puede deshacer.')) {
        clearAllBookings();
      }
    });
  }
  
  // Botón para añadir usuario
  const addUserBtn = document.getElementById('addUser');
  if (addUserBtn) {
    addUserBtn.addEventListener('click', showAddUserModal);
  }
  
  // Botón para añadir conductor
  const addDriverBtn = document.getElementById('addDriver');
  if (addDriverBtn) {
    addDriverBtn.addEventListener('click', () => {
      // Limpiar formulario
      document.getElementById('dName').value = '';
      document.getElementById('dPhone').value = '';
      document.getElementById('dVehicleId').value = '';
      document.getElementById('dStatus').value = 'Libre';
      notify('Formulario de conductor listo', 'info');
    });
  }
  
  // Botón para cargar rutas de ejemplo
  const loadSampleRoutesBtn = document.getElementById('loadSampleRoutes');
  if (loadSampleRoutesBtn) {
    loadSampleRoutesBtn.addEventListener('click', () => {
      state.routes = [];
      ensureSampleRoutes();
      renderRoutes();
      notify('Rutas de ejemplo cargadas correctamente', 'success');
    });
  }
  
  // Botón para actualizar precios de niños
  const updateChildPricesBtn = document.getElementById('updateChildPrices');
  if (updateChildPricesBtn) {
    updateChildPricesBtn.addEventListener('click', () => {
      updateChildPrices();
    });
  }
  
  // Cerrar modales con X - verificar que existan antes de agregar listeners
  const closeViewModal = document.getElementById('closeViewModal');
  const closeEditModal = document.getElementById('closeEditModal');
  const closeAddModal = document.getElementById('closeAddModal');
  
  if (closeViewModal) closeViewModal.addEventListener('click', () => closeModal('viewUserModal'));
  if (closeEditModal) closeEditModal.addEventListener('click', () => closeModal('editUserModal'));
  if (closeAddModal) closeAddModal.addEventListener('click', () => closeModal('addUserModal'));
  
  // Los botones de cancelar se manejan con event delegation en initUserModals()
  
  // Cerrar modales haciendo click fuera del contenido
  const viewModal = document.getElementById('viewUserModal');
  const editModal = document.getElementById('editUserModal');
  const addModal = document.getElementById('addUserModal');
  
  if (viewModal) {
    viewModal.addEventListener('click', (event) => {
      if (event.target === viewModal) closeModal('viewUserModal');
    });
  }
  
  if (editModal) {
    editModal.addEventListener('click', (event) => {
      if (event.target === editModal) closeModal('editUserModal');
    });
  }
  
  if (addModal) {
    addModal.addEventListener('click', (event) => {
      if (event.target === addModal) closeModal('addUserModal');
    });
  }
}

function renderClients() {
  const container = document.getElementById('clientsTable');
  // Filtrar solo clientes: cliente, clienteEmpresa
  const clients = state.users.filter(u => ['cliente', 'clienteEmpresa'].includes(u.role));
  const rows = clients.map(c => `
    <tr>
      <td>${c.name}</td><td>${c.email}</td><td>${c.profile?.telefono || '-'}</td><td><span class="role-badge ${c.role}">${c.role.toUpperCase()}</span></td>
      <td class="table-actions">
        <button class="btn ghost" data-action="view" data-id="${c.id}" title="Ver cliente">👁️</button>
        <button class="btn ghost" data-action="edit" data-id="${c.id}" title="Editar cliente">✏️</button>
        <button class="btn ghost" data-action="del" data-id="${c.id}" title="Eliminar cliente">🗑️</button>
      </td>
    </tr>`).join('');
  container.innerHTML = table(['Nombre','Email','Teléfono','Tipo','Acciones'], rows);
  
  container.querySelectorAll('button[data-action]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (action === 'del') { 
        state.users = state.users.filter(u => u.id !== id); 
        saveAll(); 
        renderClients(); 
      }
      if (action === 'view') { 
        openViewClientModal(id); 
      }
      if (action === 'edit') { 
        openEditClientModal(id); 
      }
    });
  });
}

function renderRecentBookings() {
  const container = document.getElementById('recentBookings');
  const recentBookings = state.bookings.slice(-5).reverse();
  const rows = recentBookings.map(b => {
    const route = state.routes.find(r => r.id === b.routeId);
    return `<tr><td>${b.id}</td><td>${route?.name || '-'}</td><td>${b.status}</td></tr>`;
  }).join('');
  container.innerHTML = table(['ID','Ruta','Estado'], rows || '<tr><td colspan="3">Sin reservas recientes</td></tr>');
}

function renderSystemStatus() {
  const container = document.getElementById('systemStatus');
  const status = {
    'Servidores': 'Operativo',
    'Base de Datos': 'Conectada',
    'API': 'Funcionando',
    'GPS': 'Activo'
  };
  const rows = Object.entries(status).map(([key, value]) => 
    `<tr><td>${key}</td><td><span class="status-ok">${value}</span></td></tr>`
  ).join('');
  container.innerHTML = table(['Componente','Estado'], rows);
}

// Función para actualizar precios de ejemplo para niños en rutas existentes
function updateChildPrices() {
  let updated = false;
  state.routes.forEach(route => {
    if (typeof route.childPrice !== 'number' || route.childPrice === null || route.childPrice === undefined) {
      // Calcular precio de niños como 60% del precio base
      route.childPrice = Math.round(route.basePrice * 0.6 * 100) / 100;
      updated = true;
    }
  });
  
  if (updated) {
    saveAll();
    renderRoutes();
    notify('Precios de ejemplo para niños actualizados', 'success');
  }
}

function ensureSampleRoutes() {
  // Asegurar que todas las rutas tengan precios de ejemplo para niños
  state.routes.forEach(route => {
    if (typeof route.childPrice !== 'number') {
      // Calcular precio de niños como 60% del precio base
      route.childPrice = Math.round(route.basePrice * 0.6 * 100) / 100;
    }
  });
  
  // Forzar creación de rutas de ejemplo siempre
  if (state.routes.length === 0 || state.routes.length < 5) {
    // Limpiar rutas existentes si hay menos de 5
    if (state.routes.length < 5) {
      state.routes = [];
    }
    const sampleRoutes = [
      {
        id: 'r1',
        type: 'tour',
        name: 'Tour Centro Histórico de Quito',
        basePrice: 25.00,
        childPrice: 15.00,
        description: 'Tour por el centro histórico de Quito.',
        image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
        status: 'activo',
        createdAt: new Date().toISOString()
      },
      {
        id: 'r2',
        type: 'tour',
        name: 'Mitad del Mundo y Teleférico',
        basePrice: 45.00,
        childPrice: 27.00,
        description: 'Visita el monumento de la Mitad del Mundo y disfruta de las vistas panorámicas desde el Teleférico de Quito. Una experiencia única en la línea ecuatorial.',
        image: 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5d?w=800&h=600&fit=crop',
        status: 'activo',
        createdAt: new Date().toISOString()
      },
      {
        id: 'r4',
        type: 'aeropuerto',
        name: 'Transfer Aeropuerto - Hoteles',
        basePrice: 20.00,
        childPrice: 12.00,
        description: 'Servicio de transfer desde/hacia el aeropuerto a los principales hoteles de Quito. Incluye asistencia con equipaje.',
        image: 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=800&h=600&fit=crop',
        status: 'activo',
        createdAt: new Date().toISOString()
      },
      {
        id: 'r5',
        type: 'tour',
        name: 'Tour Gastronómico Quito',
        basePrice: 35.00,
        childPrice: 21.00,
        description: 'Descubre la rica gastronomía quiteña visitando mercados tradicionales y restaurantes locales. Incluye degustaciones.',
        image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=600&fit=crop',
        status: 'activo',
        createdAt: new Date().toISOString()
      },
      {
        id: 'r7',
        type: 'tour',
        name: 'Tour Parque Nacional Cotopaxi',
        basePrice: 55.00,
        childPrice: 33.00,
        description: 'Excursión al Parque Nacional Cotopaxi, uno de los volcanes activos más altos del mundo. Incluye senderismo y avistamiento de fauna.',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
        status: 'activo',
        createdAt: new Date().toISOString()
      },
    ];
    state.routes.push(...sampleRoutes);
    saveAll();
  }
}

function ensureSampleBookings() {
  // Función deshabilitada - no crear reservas de ejemplo automáticamente
  // Las reservas solo se crean cuando los clientes realizan reservaciones reales
}

// Función para limpiar todas las reservas existentes
function clearAllBookings() {
  state.bookings = [];
  saveAll();
  updateAssignmentCounts();
  renderAssignmentTab('pendiente');
  notify('Todas las reservas han sido eliminadas', 'success');
}

function main() {
  const user = requireRole('admin');
  if (!user) return;
  mountSharedChrome();
  initTabs();
  initModalEventListeners();
  initAllModals(); // Inicializar todos los modales de forma universal
  initUserModals(); // Inicializar modales de usuarios con event delegation
  ensureSampleRoutes();
  ensureSampleDrivers();
  ensureSampleBookings();
  renderStats();
  renderRecentBookings();
  renderSystemStatus();
  renderUsers();
  renderClients();
  renderFleet();
  renderDrivers();
  renderRoutes();
  renderCoupons();
  renderAssignments();
  // Polling de cambios de reservas para notificaciones en tiempo real
  setInterval(() => {
    try {
      state.bookings = Storage.load('data:bookings', db.bookings);
      const minimal = state.bookings.map(b => ({ id: b.id, status: b.status || '', driverId: b.driverId || null }));
      const snapshot = JSON.stringify(minimal);
      if (__lastBookingsSnapshot) {
        const prev = JSON.parse(__lastBookingsSnapshot);
        const prevMap = new Map(prev.map(x => [x.id, x]));
        minimal.forEach(now => {
          const before = prevMap.get(now.id);
          if (!before) return;
          const prevStatus = (before.status || '').toLowerCase();
          const nowStatus = (now.status || '').toLowerCase();
          if (!before.driverId && now.driverId) {
            notify(`Reserva ${now.id} asignada a un conductor.`, 'info');
          }
          if (prevStatus !== 'confirmado' && nowStatus === 'confirmado') {
            notify(`Reserva ${now.id} confirmada por el conductor.`, 'success');
          }
          if (prevStatus !== 'en curso' && nowStatus === 'en curso') {
            notify(`Reserva ${now.id} en curso. GPS activo.`, 'info');
          }
          if (prevStatus !== 'completado' && nowStatus === 'completado') {
            notify(`Reserva ${now.id} completada.`, 'success');
          }
        });
        if (__lastBookingsSnapshot !== snapshot) {
          updateAssignmentCounts();
          // Re-render pestaña activa de asignaciones para reflejar cambios
          const activePane = document.querySelector('.assignment-tab-pane.active');
          const activeId = activePane ? activePane.id : 'pendiente';
          renderAssignmentTab(activeId);
          renderRecentBookings();
          renderStats();
        }
      }
      __lastBookingsSnapshot = snapshot;
    } catch {}
  }, 1000);
  
  // Inicializar modales inmediatamente
  initClientModals();
  initVehicleModals();
  initRouteModals();
  initDriverModals();
  initCouponModals();
  initAssignModal();
  
  // También inicializar después de un delay por si acaso
  setTimeout(() => {
    initClientModals();
    initVehicleModals();
    initRouteModals();
    initDriverModals();
    initCouponModals();
    initAssignModal();
  }, 100);
  // El mapa se inicializa solo cuando se accede a la pestaña GPS
}

// Función para inicializar el modal de asignación
function initAssignModal() {
  const modal = document.getElementById('assignModal');
  const closeBtn = document.getElementById('closeAssignModal');
  const cancelBtn = document.getElementById('cancelAssign');
  const form = document.getElementById('assignForm');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal('assignModal'));
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => closeModal('assignModal'));
  }
  
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal('assignModal');
    });
  }
  
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      assignDriverAndVehicle();
    });
  }
}

// Función específica para inicializar modales de usuarios usando event delegation
function initUserModals() {
  console.log('Inicializando modales de usuarios con event delegation');
  
  // Verificar que los botones existan
  const cancelEdit = document.getElementById('cancelEdit');
  const cancelAdd = document.getElementById('cancelAdd');
  console.log('cancelEdit existe:', !!cancelEdit);
  console.log('cancelAdd existe:', !!cancelAdd);
  
  // Usar event delegation para manejar todos los botones de cancelar
  document.addEventListener('click', (e) => {
    console.log('Click detectado en:', e.target);
    
    // Botón cancelar editar usuario
    if (e.target && e.target.id === 'cancelEdit') {
      e.preventDefault();
      console.log('Cancelar editar usuario - Event delegation');
      closeModal('editUserModal');
    }
    
    // Botón cancelar añadir usuario
    if (e.target && e.target.id === 'cancelAdd') {
      e.preventDefault();
      console.log('Cancelar añadir usuario - Event delegation');
      closeModal('addUserModal');
    }
  });
}

document.addEventListener('DOMContentLoaded', main);


