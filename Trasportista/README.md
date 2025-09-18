# TeLlevo – Documentación funcional

## Descripción general
- Tipo: SPA (JS/HTML/CSS puros, sin backend)
- Propósito: Gestión de transporte para clientes, conductores y administradores
- Persistencia: localStorage (namespacing por empresa desde `companySelect`)
- Mapas: Leaflet + Nominatim (OSM)
- Tema: Modo oscuro por defecto
- Responsive: Media queries para móvil

## Datos (localStorage)
- users: clientes, conductores, admins (email, password, rol, etc.)
- rutas: rutas predefinidas (compartido)
- flota: vehículos (placa, capacidad, etc.)
- reservas: viajes con estados `pendiente` | `en-curso` | `recogido` | `cancelada`
- promos: cupones/vouchers demo
- tracking: posiciones GPS activas (simuladas)
- invoices: facturas generadas al finalizar
- mockClients: clientes demo para listas

## Autenticación
- Login por correo/contraseña
- Redirección por rol: cliente → `view-cliente`, conductor → `view-conductor`, admin → `view-admin`
- Logout: limpia sesión y vuelve a login

## Vistas
### `view-auth` (Login)
- Form de acceso y enlace "Regístrate" (navega a `view-register`)

### `view-register` (Registro)
- Nombres, apellidos, CI, teléfono, correo, password, rol
- Dirección por mapa (lat/lng) y referencia, foto (uploader)

### `view-cliente`
Tabs: Servicios, Mis Viajes, Historial
- Servicios
  - Selector tipo: `compartido`, `privado`, `encomienda`
  - Compartido: cards de rutas → modal (dirección por mapa, personas, equipaje) → vista de pago
  - Privado: origen (mi dirección/favoritas/nueva por mapa), destino preestablecido (select de rutas), pasajeros, tipo vehículo, comentarios → modal de confirmación → vista de pago
  - Encomienda: tamaño, contenido, descripción
- Mis Viajes: pendientes y en curso (detalles, tracking)
- Historial: reservas anteriores + calificación (rating)

### `view-payment` (Pago)
- Resumen (origen/destino/horario/servicio/precio)
- Método de pago: efectivo (instrucciones), tarjeta (campos y validación), transferencia (banco/ref.), voucher (descuento)
- Al confirmar: crea 1 reserva `pendiente` y vuelve a Cliente (Admin se refresca)

### `view-conductor`
- Dashboard: KPIs y próximos viajes
- Asignaciones: Asignado/En curso/Finalizado
  - Ver detalles: modal con secciones y mapa de recogida + links Google Maps/Waze
  - Cambiar a En Curso: activa tracking y aparece en Admin > GPS
  - Cambiar a Finalizado: detiene tracking y crea factura mock

### `view-admin`
Tabs: Dashboard, Usuarios, Clientes, Flota, Rutas, Reservas, Cupones, GPS
- Dashboard: KPIs (reservas, ingresos, flota, rating) + listas (actividad, top rutas, flota, promos)
- Usuarios: lista (reales+mock), ver/editar/eliminar, +Agregar Usuario → `view-admin-user-new`
- Clientes: lista consolidada (reales+mock), ver/editar/eliminar
- Flota: lista (reales+mock), ver/editar/eliminar, +Agregar Vehículo → `view-admin-vehicle-new`
- Rutas: lista + alta de rutas
- Reservas: filtros Pendientes/Asignadas/Completadas
  - Pendientes: botón Asignar (modal)
  - Asignadas: estado (Asignado/En curso) + Marcar completada
  - Completadas: lista
- GPS: mapa en vivo de conductores en curso con filtro por nombre y auto-fit

## Modales
- `#mapModal`: selector de ubicación (marker, coords, reverse geocode). Usado en registro, origen (privado) y reserva compartida
- `#clientConfirmModal`: confirma servicio privado y navega a pago
- `#clientSharedModal`: reserva compartida (dirección por mapa, personas, equipaje) y navega a pago
- `#driverDetailModal`: detalles para conductor con mapa y links Google Maps/Waze
- `#assignModal`: asignación en Admin (conductor+vehículo, detalles de reserva)
- `view-admin-user-new`: alta de usuario (validaciones de duplicados)
- `view-admin-vehicle-new`: alta de vehículo

## Flujo de reservas
1) Cliente configura (compartido/privado) → modal → `view-payment`
2) Pago aplica cupón si corresponde → crea reserva `pendiente`
3) Admin asigna conductor/vehículo (sigue `pendiente`)
4) Conductor cambia a `en-curso` (tracking activo)
5) Conductor/Admin marcan completada (`recogido`) → tracking off, factura mock

## Tracking (GPS)
- Activación: al pasar a `en-curso`
- Posición inicial: geocodifica dirección de recogida
- Actualización: simulada cada 7s
- GPS Tab (Admin): mapa + lista filtrable; se apaga al completar/cancelar

## Direcciones favoritas (Cliente)
- Origen: Mi dirección (registro), Favoritas (guardadas al elegir en mapa), Nueva dirección
- Privado: destino desde rutas preestablecidas

## Promos y facturación
- Descuento por cupón en pago (demo)
- Factura mock al completar viaje (monto y método)

## Responsive
- Barras laterales como carrusel horizontal en móvil
- Formularios y grids a 1 columna, botones e inputs accesibles
- Modales 95vw/90vh, mapas 50vh (móvil)

## Notas técnicas
- Enrutador de vistas: `showView(name)` con scroll-to-top
- Sembrado y migraciones en `seedIfEmpty()`
- Utilidades: toasts, validación básica de tarjeta, nombrespacio por empresa

## Desarrollo
- Entrada principal: `index.html`
- Lógica: `app.js`
- Estilos: `styles.css`
