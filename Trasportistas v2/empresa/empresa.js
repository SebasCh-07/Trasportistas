// Loader que reutiliza la lógica de admin para el rol empresa
// Carga admin/admin.js como texto, cambia requireRole('admin') -> requireRole('empresa')
// y ajusta la ruta de imports para ejecutarlo como módulo ESM.

(async () => {
  try {
    const adminModuleUrl = new URL('../admin/admin.js', import.meta.url).href;
    const scriptsUrl = new URL('../shared/assets/scripts.js', import.meta.url).href;

    const res = await fetch(adminModuleUrl);
    if (!res.ok) throw new Error(`No se pudo cargar admin.js: ${res.status}`);
    let code = await res.text();

    // Reemplazar import de scripts con URL absoluta para que funcione desde Blob URL
    code = code.replace(
      /from\s+['"]\.\.\/shared\/assets\/scripts\.js['"];?/,
      `from '${scriptsUrl}';`
    );

    // Forzar el guard de rol a 'empresa'
    code = code.replace(/requireRole\(['"]admin['"]\)/g, "requireRole('empresa')");

    // Asegurar que main() se ejecute aunque DOMContentLoaded ya haya ocurrido
    code = code.replace(
      /document\.addEventListener\(['"]DOMContentLoaded['"],\s*main\s*\);?/,
      "(document.readyState !== 'loading' ? main() : document.addEventListener('DOMContentLoaded', main));"
    );

    // Omitir seccion de Usuarios en Empresa: quitar llamadas que dependen del DOM de usuarios
    code = code.replace(/\n\s*renderUsers\(\);/g, '');
    code = code.replace(/\n\s*initUserModals\(\);/g, '');
    // Omitir sección de Cupones en Empresa
    code = code.replace(/\n\s*renderCoupons\(\);/g, '');
    code = code.replace(/\n\s*initCouponModals\(\);/g, '');

    // En la sección de clientes, mostrar SOLO 'clienteEmpresa'
    code = code.replace(
      /\['cliente',\s*'clienteEmpresa'\]/g,
      "['clienteEmpresa']"
    );

    // En Flota: eliminar botones Editar/Eliminar vehículo (dejar solo Ver)
    code = code.replace(/<button\s+class=\"btn ghost\"[^>]*data-action=\"edit\"[^>]*title=\"Editar vehículo\"[^>]*>[^<]*<\/button>/g, '');
    code = code.replace(/<button\s+class=\"btn ghost\"[^>]*data-action=\"del\"[^>]*title=\"Eliminar vehículo\"[^>]*>[^<]*<\/button>/g, '');

    // En Conductores: eliminar botones Editar/Eliminar conductor (dejar solo Ver)
    code = code.replace(/<button\s+class=\"btn ghost\"[^>]*data-action=\"edit\"[^>]*title=\"Editar conductor\"[^>]*>[^<]*<\/button>/g, '');
    code = code.replace(/<button\s+class=\"btn ghost\"[^>]*data-action=\"del\"[^>]*title=\"Eliminar conductor\"[^>]*>[^<]*<\/button>/g, '');

    // En Rutas: eliminar botón Eliminar ruta en acciones
    code = code.replace(/<button\s+class=\"btn ghost\"[^>]*data-action=\"del\"[^>]*title=\"Eliminar ruta\"[^>]*>[^<]*<\/button>/g, '');

    // Ajustes específicos de Empresa para EDITAR ruta:
    // 1) Envolver openEditRouteModal para deshabilitar campos y agregar campo de Tarifa adicional
    code = code.replace(
      /document\.getElementById\('editRouteModal'\)\.style\.display = 'block';\s*\}/,
      `document.getElementById('editRouteModal').style.display = 'block';
        try {
          const form = document.getElementById('editRouteForm');
          if (form) {
            const toDisable = ['editRouteType','editRouteName','editRoutePrice','editRouteDescription','editRouteImage','editRouteStatus'];
            toDisable.forEach(id => { const el = document.getElementById(id); if (el) el.setAttribute('disabled','disabled'); });
            if (!document.getElementById('editRouteSurcharge')){
              const grp = document.createElement('div');
              grp.className = 'form-group';
              grp.innerHTML = '<label for="editRouteSurcharge">Tarifa adicional ($):</label><input type="number" id="editRouteSurcharge" name="surcharge" min="0" step="0.01" value="0">';
              const actions = form.querySelector('.form-actions');
              if (actions) { actions.parentNode.insertBefore(grp, actions); }
            } else {
              document.getElementById('editRouteSurcharge').value = '0';
            }
          }
        } catch(err) { console.error('Error ajustando modal de edición de ruta (empresa):', err); }
      }`
    );

    // 2) Reemplazar el submit del formulario de edición para guardar SOLO la tarifa adicional (precio niños lo define Admin)
    code = code.replace(
      /if \(editForm\) \{[\s\S]*?editForm\.addEventListener\('submit',[\s\S]*?\}\);[\s\S]*?\}/,
      `if (editForm) {
        editForm.addEventListener('submit', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          const routeId = editForm.getAttribute('data-route-id');
          const route = state.routes.find(r => r.id === routeId);
          if (!route) { notify('Ruta no encontrada', 'error'); return; }
          const surchargeEl = document.getElementById('editRouteSurcharge');
          const surcharge = surchargeEl ? parseFloat(surchargeEl.value) || 0 : 0;
          if (surcharge < 0) { notify('La tarifa adicional no puede ser negativa', 'error'); return; }
          route.surcharge = surcharge;
          route.updatedAt = new Date().toISOString();
          saveAll();
          renderRoutes();
          closeModal('editRouteModal');
          notify('Tarifa actualizada correctamente', 'success');
        }, { capture: true });
      }`
    );

    // 3) Remover botones de crear/cargar rutas en la UI al cargar
    code += `
      document.addEventListener('DOMContentLoaded', () => {
        const addBtn = document.getElementById('addRoute'); if (addBtn) addBtn.remove();
        const sampleBtn = document.getElementById('loadSampleRoutes'); if (sampleBtn) sampleBtn.remove();
        const couponsTabBtn = document.querySelector('.nav-btn[data-tab="cupones"]'); if (couponsTabBtn) couponsTabBtn.remove();
      });
    `;

    // 4) Sobrescribir completamente renderRoutes para mostrar precio total correcto
    code += `
      (function(){
        // Guardar la función original
        const __origRenderRoutes = renderRoutes;
        const __origTable = table;
        
        // Sobrescribir la función table para interceptar la creación de tablas de rutas
        table = function(headers, rows) {
          const result = __origTable(headers, rows);
          
          // Si es la tabla de rutas, actualizar los precios
          if (headers && headers.includes('Precio')) {
            // Buscar todos los elementos de precio y actualizarlos
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = result;
            
            const priceElements = tempDiv.querySelectorAll('.price');
            priceElements.forEach(el => {
              const row = el.closest('tr');
              const viewBtn = row?.querySelector('button[data-action="view"]');
              if (viewBtn) {
                const routeId = viewBtn.getAttribute('data-id');
                const route = state.routes.find(r => r.id === routeId);
                if (route) {
                  const totalPrice = (parseFloat(route.basePrice) || 0) + (parseFloat(route.surcharge) || 0);
                  el.textContent = '$' + totalPrice;
                }
              }
            });
            
            return tempDiv.innerHTML;
          }
          
          return result;
        };
        
        // Sobrescribir renderRoutes (mostrar también precio niños + tarifa)
        renderRoutes = function(){
          const container = document.getElementById('routesTable');
          if (!container) return;
          
          const rows = state.routes.map(r => {
            const totalPrice = (parseFloat(r.basePrice) || 0) + (parseFloat(r.surcharge) || 0);
            const childTotal = (typeof r.childPrice === 'number') ? ((parseFloat(r.childPrice) || 0) + (parseFloat(r.surcharge) || 0)) : null;
            return '<tr>' +
              '<td>' +
                '<span class="route-type ' + r.type + '">' + r.type.toUpperCase() + '</span>' +
                (r.image ? '<br><small class="muted">📷 Con imagen</small>' : '') +
              '</td>' +
              '<td>' +
                '<strong>' + r.name + '</strong>' +
              '</td>' +
              '<td><span class="price">$' + totalPrice + '</span></td>' +
              '<td>' + (childTotal !== null ? ('$' + childTotal) : '-') + '</td>' +
              '<td>' +
                '<span class="status-badge ' + (r.status || 'activo') + '">' + (r.status || 'activo').toUpperCase() + '</span>' +
              '</td>' +
              '<td class="table-actions">' +
                '<button class="btn ghost" data-action="view" data-id="' + r.id + '" title="Ver ruta">👁️</button>' +
                '<button class="btn ghost" data-action="edit" data-id="' + r.id + '" title="Editar ruta">✏️</button>' +
              '</td>' +
            '</tr>';
          }).join('');
          
          container.innerHTML = table(['Tipo','Nombre','Adulto','Niños','Estado','Acciones'], rows);
          
          container.querySelectorAll('button[data-action]')?.forEach(btn => {
            btn.addEventListener('click', () => {
              const id = btn.getAttribute('data-id');
              const action = btn.getAttribute('data-action');
              const route = state.routes.find(r => r.id === id);
              
              if (action === 'view') {
                openViewRouteModal(id);
              } else if (action === 'edit') {
                openEditRouteModal(id);
              }
            });
          });
        };
        
        // Forzar la ejecución inicial
        setTimeout(() => {
          if (document.getElementById('routesTable')) {
            renderRoutes();
          }
        }, 100);
      })();
    `;

    // 5) Overrides de modales de Rutas para manejar Tarifa adicional y bloqueo de campos
    code += `
      (function(){
        const __origOpenEditRouteModal = (typeof openEditRouteModal === 'function') ? openEditRouteModal : window.openEditRouteModal;
        openEditRouteModal = function(routeId){
          if (typeof __origOpenEditRouteModal === 'function') {
            __origOpenEditRouteModal(routeId);
          }
          try {
            const form = document.getElementById('editRouteForm');
            if (!form) return;
            const toDisable = ['editRouteType','editRouteName','editRoutePrice','editRouteChildPrice','editRouteDescription','editRouteImage','editRouteStatus'];
            toDisable.forEach(id => { const el = document.getElementById(id); if (el) { el.setAttribute('disabled','disabled'); el.setAttribute('readonly','readonly'); }});
            if (!document.getElementById('editRouteSurcharge')){
              const grp = document.createElement('div');
              grp.className = 'form-group';
              grp.innerHTML = '<label for="editRouteSurcharge">Tarifa adicional ($):</label><input type="number" id="editRouteSurcharge" name="surcharge" min="0" step="0.01" value="0">';
              const actions = form.querySelector('.form-actions');
              if (actions) { actions.parentNode.insertBefore(grp, actions); }
            }
            const route = state.routes.find(r => r.id === routeId);
            const surchargeEl = document.getElementById('editRouteSurcharge');
            if (surchargeEl) surchargeEl.value = (route && typeof route.surcharge === 'number') ? route.surcharge : 0;
            // Pre-cargar precio niños si existe
            const childEl = document.getElementById('editRouteChildPrice');
            if (childEl && route) childEl.value = (typeof route.childPrice === 'number') ? route.childPrice : '';
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            newForm.addEventListener('submit', (event) => {
              event.preventDefault();
              const surcharge = parseFloat(document.getElementById('editRouteSurcharge')?.value || '0') || 0;
              if (surcharge < 0) { notify('La tarifa adicional no puede ser negativa', 'error'); return; }
              const r = state.routes.find(rr => rr.id === routeId);
              if (!r) { notify('Ruta no encontrada', 'error'); return; }
              r.surcharge = surcharge;
              r.updatedAt = new Date().toISOString();
              saveAll();
              renderRoutes();
              closeModal('editRouteModal');
              notify('Tarifa actualizada correctamente', 'success');
            });
          } catch(err) { console.error('Override openEditRouteModal empresa:', err); }
        };

        openViewRouteModal = function(routeId){
          const route = state.routes.find(r => r.id === routeId);
          if (!route) return;
          
          const content = document.getElementById('viewRouteContent');
          const base = parseFloat(route.basePrice) || 0;
          const extra = parseFloat(route.surcharge) || 0;
          const total = base + extra;
          const childBase = (typeof route.childPrice === 'number') ? (parseFloat(route.childPrice) || 0) : null;
          const childTotal = (childBase !== null) ? (childBase + extra) : null;
          
          content.innerHTML = 
            '<div class="route-header">' +
              '<div class="route-icon">🛣️</div>' +
              '<div class="route-title">' +
                '<h2>' + route.name + '</h2>' +
                '<p class="route-type-badge">' + route.type.toUpperCase() + '</p>' +
              '</div>' +
            '</div>' +
            
            '<div class="route-info-grid">' +
              '<div class="route-info-item">' +
                '<h4>Información Básica</h4>' +
                '<div class="info-details">' +
                  '<p><strong>Nombre:</strong> ' + route.name + '</p>' +
                  '<p><strong>Tipo:</strong> ' + route.type.toUpperCase() + '</p>' +
                  '<p><strong>Estado:</strong> <span class="status-badge ' + (route.status || 'activo') + '">' + (route.status || 'activo').toUpperCase() + '</span></p>' +
                '</div>' +
              '</div>' +
              
              '<div class="route-info-item">' +
                '<h4>Tarifas</h4>' +
                '<div class="info-details">' +
                  '<p><strong>Precio adulto (base):</strong> $' + base + '</p>' +
                  '<p><strong>Precio niño:</strong> ' + (childBase !== null ? ('$' + childBase) : '-') + '</p>' +
                  '<p><strong>Tarifa adicional (empresa):</strong> $' + extra + '</p>' +
                  '<p><strong>Precio adulto (tarifa):</strong> <span style="font-weight: bold; color: var(--primary);">$' + total + '</span></p>' +
                  '<p><strong>Precio niño (tarifa):</strong> ' + (childTotal !== null ? ('<span style="font-weight: bold; color: var(--primary);">$' + childTotal + '</span>') : '-') + '</p>' +
                '</div>' +
              '</div>' +
              
              '<div class="route-info-item">' +
                '<h4>Descripción</h4>' +
                '<div class="info-details">' +
                  '<p>' + (route.description || 'Sin descripción disponible') + '</p>' +
                '</div>' +
              '</div>' +
              
              '<div class="route-info-item">' +
                '<h4>Imagen</h4>' +
                '<div class="info-details">' +
                  (route.image ? 
                    '<div class="route-image-preview">' +
                      '<img src="' + route.image + '" alt="' + route.name + '" style="max-width: 100%; height: 200px; object-fit: cover; border-radius: 8px; border: 2px solid var(--border-color);">' +
                    '</div>' : 
                    '<p>Sin imagen disponible</p>') +
                '</div>' +
              '</div>' +
              
              '<div class="route-info-item">' +
                '<h4>ID de la Ruta</h4>' +
                '<div class="info-details">' +
                  '<p><strong>Código:</strong> ' + route.id + '</p>' +
                  '<p><strong>Creada:</strong> ' + new Date(route.createdAt).toLocaleDateString() + '</p>' +
                  (route.updatedAt ? '<p><strong>Actualizada:</strong> ' + new Date(route.updatedAt).toLocaleDateString() + '</p>' : '') +
                '</div>' +
              '</div>' +
            '</div>';
          
          document.getElementById('viewRouteModal').style.display = 'block';
        };
      })();
    `;

    // 6) Asignación: filtrar reservas a clienteEmpresa reemplazando filtros en el código base
    code = code.replace(/state\.bookings\.filter\(b => b\.status === 'Pendiente'\)/g,
      "state.bookings.filter(b => b.status === 'Pendiente' && (state.users.find(u => u.id === b.userId)?.role === 'clienteEmpresa'))");
    code = code.replace(/state\.bookings\.filter\(b => b\.status === 'Asignado'\)/g,
      "state.bookings.filter(b => b.status === 'Asignado' && (state.users.find(u => u.id === b.userId)?.role === 'clienteEmpresa'))");
    code = code.replace(/state\.bookings\.filter\(b => b\.status === 'En Curso'\)/g,
      "state.bookings.filter(b => b.status === 'En Curso' && (state.users.find(u => u.id === b.userId)?.role === 'clienteEmpresa'))");
    code = code.replace(/state\.bookings\.filter\(b => b\.status === 'Completado'\)/g,
      "state.bookings.filter(b => b.status === 'Completado' && (state.users.find(u => u.id === b.userId)?.role === 'clienteEmpresa'))");

    // 7) Asignación: Empty state amigable si no hay items tras el filtro
    code += `
      (function(){
        var __origRenderAssignmentTab = (typeof renderAssignmentTab === 'function') ? renderAssignmentTab : null;
        if (__origRenderAssignmentTab) {
          renderAssignmentTab = function(tabName){
            __origRenderAssignmentTab(tabName);
            try {
              var container = document.getElementById('assignments-' + tabName);
              if (!container) return;
              var hasRows = container.querySelector('tbody tr');
              if (!hasRows) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">\
                  <div style="font-size: 48px; margin-bottom: 12px;">🗂️</div>\
                  <h3>Sin elementos</h3>\
                  <p>No hay reservas para mostrar en esta pestaña.</p>\
                </div>';
              }
            } catch(e) { /* noop */ }
          };
        }
      })();
    `;

    // 7) Inicializar tarifas adicionales para rutas existentes
    code += `
      (function(){
        // Asegurar que todas las rutas tengan el campo surcharge inicializado
        state.routes.forEach(route => {
          if (typeof route.surcharge === 'undefined') {
            route.surcharge = 0;
          }
        });
        saveAll();
        
        // Función simple para actualizar precios en la tabla
        function updateRoutePrices() {
          const routesTable = document.getElementById('routesTable');
          if (!routesTable) return;
          
          const priceElements = routesTable.querySelectorAll('.price');
          priceElements.forEach(el => {
            const row = el.closest('tr');
            const viewBtn = row?.querySelector('button[data-action="view"]');
            if (viewBtn) {
              const routeId = viewBtn.getAttribute('data-id');
              const route = state.routes.find(r => r.id === routeId);
              if (route) {
                const totalPrice = (parseFloat(route.basePrice) || 0) + (parseFloat(route.surcharge) || 0);
                el.textContent = '$' + totalPrice;
              }
            }
          });
        }
        
        // Actualizar precios después de un tiempo para asegurar que la tabla se haya renderizado
        setTimeout(updateRoutePrices, 200);
        setTimeout(updateRoutePrices, 500);
        setTimeout(updateRoutePrices, 1000);
      })();
    `;

    // Crear Blob y cargar como módulo
    const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    await import(blobUrl);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Error inicializando panel Empresa:', err);
  }
})();


