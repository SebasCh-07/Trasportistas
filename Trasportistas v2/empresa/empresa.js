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

    // En la sección de clientes, mostrar SOLO 'clienteEmpresa'
    code = code.replace(
      /\['cliente',\s*'clienteEmpresa'\]/g,
      "['clienteEmpresa']"
    );

    // En Flota: eliminar botones Editar/Eliminar vehículo (dejar solo Ver)
    code = code.replace(/<button\s+class=\"btn ghost\"[^>]*data-action=\"edit\"[^>]*title=\"Editar vehículo\"[^>]*>[^<]*<\/button>/g, '');
    code = code.replace(/<button\s+class=\"btn ghost\"[^>]*data-action=\"del\"[^>]*title=\"Eliminar vehículo\"[^>]*>[^<]*<\/button>/g, '');

    // En Conductores: eliminar botones Editar/Eliminar conductor (dejar solo Ver)
    code = code.replace(/\n\s*<button class=\"btn ghost\"[^>]*title=\"Editar conductor\"[^>]*>[^<]*<\/button>\n/g, '\n');
    code = code.replace(/\n\s*<button class=\"btn ghost\"[^>]*title=\"Eliminar conductor\"[^>]*>[^<]*<\/button>\n/g, '\n');

    // Crear Blob y cargar como módulo
    const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    await import(blobUrl);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error('Error inicializando panel Empresa:', err);
  }
})();


