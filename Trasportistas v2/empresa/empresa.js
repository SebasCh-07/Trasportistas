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

    // 2) Reemplazar el submit del formulario de edición para sumar solo la tarifa adicional al precio
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
          route.basePrice = (parseFloat(route.basePrice) || 0) + surcharge;
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

    // 4) Ajustes robustos post-render para Rutas: precio con tarifa, asegurar botón Editar y sin Eliminar
    code += `
      (function(){
        const __origRenderRoutes = renderRoutes;
        renderRoutes = function(){
          __origRenderRoutes();
          try {
            const container = document.getElementById('routesTable');
            if (!container) return;
            const rows = container.querySelectorAll('tbody tr');
            rows.forEach(tr => {
              const viewBtn = tr.querySelector('button[data-action="view"]');
              const id = viewBtn ? viewBtn.getAttribute('data-id') : null;
              if (!id) return;
              const route = state.routes.find(r => r.id === id);
              if (!route) return;
              const priceEl = tr.querySelector('.price');
              if (priceEl) {
                const total = (parseFloat(route.basePrice) || 0) + (parseFloat(route.surcharge) || 0);
                priceEl.textContent = '$' + total;
              }
              tr.querySelectorAll('button[data-action="del"]').forEach(b => b.remove());
              let editBtn = tr.querySelector('button[data-action="edit"]');
              const actionsTd = tr.querySelector('td.table-actions');
              if (!editBtn && actionsTd) {
                editBtn = document.createElement('button');
                editBtn.className = 'btn ghost';
                editBtn.setAttribute('data-action','edit');
                editBtn.setAttribute('data-id', id);
                editBtn.title = 'Editar ruta';
                editBtn.textContent = '✏️';
                editBtn.addEventListener('click', () => openEditRouteModal(id));
                actionsTd.appendChild(editBtn);
              }
            });
          } catch(e) { console.error('Patch renderRoutes empresa:', e); }
        };
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
            const toDisable = ['editRouteType','editRouteName','editRoutePrice','editRouteDescription','editRouteImage','editRouteStatus'];
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

        const __origOpenViewRouteModal = (typeof openViewRouteModal === 'function') ? openViewRouteModal : window.openViewRouteModal;
        openViewRouteModal = function(routeId){
          if (typeof __origOpenViewRouteModal === 'function') {
            __origOpenViewRouteModal(routeId);
          }
          try {
            const content = document.getElementById('viewRouteContent');
            if (!content) return;
            const route = state.routes.find(r => r.id === routeId);
            const base = route?.basePrice || 0;
            const extra = route?.surcharge || 0;
            const total = base + extra;
            const block = document.createElement('div');
            block.className = 'route-info-item';
            block.innerHTML = '<h4>Tarifa</h4><div class="info-details">'
              + '<p><strong>Precio base:</strong> $' + base + '</p>'
              + '<p><strong>Tarifa adicional (empresa):</strong> $' + extra + '</p>'
              + '<p><strong>Total mostrado al cliente:</strong> $' + total + '</p>'
              + '</div>';
            content.appendChild(block);
          } catch(err) { console.error('Override openViewRouteModal empresa:', err); }
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

    // Crear Blob y cargar como módulo
    const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    await import(blobUrl);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Error inicializando panel Empresa:', err);
  }
})();


