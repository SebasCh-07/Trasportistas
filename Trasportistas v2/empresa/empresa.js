import { db, Storage, Session, mountSharedChrome, requireRole, getPriceWithEmpresa, notify } from '../shared/assets/scripts.js';

const state = {
  routes: Storage.load('data:routes', db.routes),
  empresas: Storage.load('data:empresas', db.empresas),
};

function getEmpresa() {
  const user = Session.getUser();
  return state.empresas.find(e => e.id === user.empresaId);
}

function renderServices() {
  const user = requireRole('empresa'); if (!user) return;
  mountSharedChrome();
  const empresa = getEmpresa();
  document.getElementById('markupVal').textContent = `${empresa.priceMarkupPercent || 0}%`;
  document.getElementById('markupInput').value = empresa.priceMarkupPercent || 0;
  const list = document.getElementById('services');
  list.innerHTML = state.routes.map(r => {
    const price = getPriceWithEmpresa(r, empresa.id);
    return `
      <div class="tour-card">
        <div class="tour-media" style="background-image:url('${r.image || ''}')"></div>
        <div class="tour-body">
          <div class="badge">${r.type}</div>
          <h4>${r.name}</h4>
          <div class="actions">
            <span class="price">$${price}</span>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="muted">Base: $${r.basePrice}</span>
              <button class="btn ghost" data-view="${r.id}">Ver</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('saveMarkup').onclick = () => {
    const val = Math.max(0, Math.min(100, parseInt(document.getElementById('markupInput').value || '0', 10)));
    empresa.priceMarkupPercent = val;
    Storage.save('data:empresas', state.empresas);
    document.getElementById('markupVal').textContent = `${val}%`;
    renderServices();
    notify('Markup actualizado', 'success');
  };

  // Modal ver ruta
  const modal = document.getElementById('routeModal');
  const backdrop = document.getElementById('routeBackdrop');
  const close = () => { modal.classList.remove('show'); backdrop.classList.remove('show'); };
  document.getElementById('closeRoute').onclick = close;
  document.getElementById('routeCloseBtn').onclick = close;
  list.querySelectorAll('button[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = state.routes.find(x => x.id === btn.getAttribute('data-view'));
      document.getElementById('routeTitle').textContent = r.name;
      document.getElementById('routeBody').innerHTML = `
        <div class="grid cols-2">
          <div style="min-height:160px;background:url('${r.image||''}') center/cover;border-radius:8px;border:1px solid var(--border);"></div>
          <div>
            <p class="muted">Tipo: ${r.type}</p>
            <p>${r.description || ''}</p>
            <p><strong>Precio base:</strong> $${r.basePrice}</p>
          </div>
        </div>`;
      modal.classList.add('show'); backdrop.classList.add('show');
    });
  });
}

document.addEventListener('DOMContentLoaded', renderServices);


