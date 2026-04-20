# SysOps Hub — Manual de Usuario

> Centro de operaciones para el equipo de Sistemas. Versión 1.0

---

## Índice

1. [Acceso y Autenticación](#1-acceso-y-autenticación)
2. [Dashboard](#2-dashboard)
3. [Incidencias](#3-incidencias)
4. [Automatizaciones](#4-automatizaciones)
5. [Base de Conocimiento](#5-base-de-conocimiento)
6. [Auditoría](#6-auditoría)
7. [Configuración](#7-configuración)
8. [Conectores](#8-conectores)
9. [Roles y Permisos](#9-roles-y-permisos)

---

## 1. Acceso y Autenticación

### Iniciar sesión
Accede a `http://[servidor]:5173` con tu usuario y contraseña.

| Usuario por defecto | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin1234!` | Administrador |
| `jgarcia` | `Tech1234!` | Técnico |
| `mlopez` | `Tech1234!` | Técnico |
| `rperez` | `Tech1234!` | Técnico |

> ⚠️ **Cambia las contraseñas por defecto** en Configuración → Usuarios antes de usar en producción.

### Sesión
La sesión dura **8 horas**. Al expirar, la aplicación redirige al login automáticamente. El token JWT se almacena en una cookie segura — no es necesario hacer nada manual.

---

## 2. Dashboard

**Vista en tiempo real del estado de la infraestructura.**

### Tarjetas de resumen (fila superior)
| Tarjeta | Qué muestra |
|---|---|
| **Alertas activas** | Número total de alertas abiertas en todos los conectores. El subtítulo muestra cuántas son críticas. |
| **Sistemas** | Total de sistemas monitorizados y cuántos están en estado OK. |
| **Incidencias abiertas** | Incidentes activos (no resueltos). El subtítulo indica cuántos se abrieron hoy. |
| **Conectores** | Cuántos conectores están online de los configurados. |

### Top Alertas Activas
Lista las alertas más recientes/graves de todos los conectores (Zabbix, Uptime Kuma, vCenter, etc.). Cada fila muestra:
- **Nombre del sistema** que generó la alerta
- **Descripción** del problema
- **Severidad**: Crítica 🔴 / Alta 🟠 / Media 🟡 / Baja 🔵 / Info ⚪
- **Tiempo** desde que se disparó

Pulsa **"Ver todas →"** para ir a la vista completa de alertas.

### Estado de Conectores
Panel lateral con el estado de cada integración:
- 🟢 **Verde** — conector respondiendo correctamente
- 🔴 **Rojo** — conector con error o no alcanzable
- Número en ms = latencia de la última comprobación

### Botón Actualizar
Fuerza una recarga inmediata de todos los datos. Los datos se refrescan automáticamente cada 30 segundos.

---

## 3. Incidencias

**Gestión del ciclo de vida de incidentes de TI.**

### Crear una incidencia
1. Pulsa el botón **"Nueva Incidencia"** (esquina superior derecha)
2. Rellena:
   - **Título** — descripción breve del problema
   - **Severidad** — Crítica / Alta / Media / Baja
   - **Sistema afectado** — selecciona de la lista (opcional)
   - **Descripción** — detalle completo del problema
   - **Impacto** — qué usuarios o servicios se ven afectados
   - **Tags** — etiquetas para categorizar (ej: `nginx`, `db`, `red`)
3. Pulsa **Guardar**

### Estados de una incidencia
| Estado | Significado |
|---|---|
| **Abierta** | Detectada, sin asignar o sin trabajo iniciado |
| **En progreso** | Alguien está trabajando activamente en ella |
| **Resuelta** | Problema solucionado — se puede documentar causa raíz y resolución |
| **Cerrada** | Archivada, sin acción pendiente |

### Asignar una incidencia
Abre la incidencia → campo **"Asignado a"** → selecciona un técnico del equipo. El técnico asignado verá la incidencia destacada en su vista.

### Documentar la resolución
Al cambiar el estado a **Resuelta**, aparecen dos campos adicionales:
- **Causa raíz** — qué provocó el incidente
- **Resolución** — qué se hizo para solucionarlo

Esta información alimenta la Base de Conocimiento para futuros incidentes similares.

### Filtros
Usa los filtros superiores para buscar por estado, severidad o sistema. La búsqueda de texto filtra por título y descripción en tiempo real.

---

## 4. Automatizaciones

**Catálogo de acciones ejecutables sobre la infraestructura.**

### Catálogo de acciones

#### 🏥 Health Check

| Acción | Para qué sirve | Parámetros |
|---|---|---|
| **Health Check HTTP** | Verifica que una URL responde correctamente (HTTP 200). Detecta si un servicio web está caído. | `url` — URL a verificar (ej: `https://intranet.empresa.local`) |
| **Ping / Conectividad** | Envía 4 pings ICMP a un host y mide la latencia. Confirma conectividad básica de red. | `host` — IP o hostname (ej: `192.168.12.39`) |
| **Health Check Completo** | Ejecuta el health check de **todos** los conectores configurados y muestra un informe. Sin parámetros. | — |
| **Resumen de Alertas Activas** | Agrupa todas las alertas activas por severidad y muestra el top 10. Útil para el inicio del turno. | — |

#### ✅ Validate

| Acción | Para qué sirve | Parámetros |
|---|---|---|
| **Verificar Certificados SSL** | Conecta por TLS a cada dominio y calcula los días hasta expiración. Avisa si quedan menos de 30 días. | `domains` — dominios separados por coma (ej: `portal.empresa.local, vpn.empresa.local`) |
| **Estado de Sistemas** | Genera un informe del estado de todos los sistemas (VMs, contenedores, hosts, NAS). | — |

#### 🔄 Restart

| Acción | Para qué sirve | Parámetros |
|---|---|---|
| **Reiniciar Servicio** | Muestra el comando SSH necesario para reiniciar un servicio. ⚠️ Requiere configuración SSH para ejecución real. | `host` — servidor, `service` — nombre del servicio |

#### 🗑️ Cleanup

| Acción | Para qué sirve | Parámetros |
|---|---|---|
| **Limpiar Logs de Disco** | Muestra el comando para eliminar logs de más de 30 días. ⚠️ Requiere SSH para ejecución real. | `path` — ruta (por defecto `/var/log`) |

#### 📸 Snapshot

| Acción | Para qué sirve | Parámetros |
|---|---|---|
| **Crear Snapshot VM** | Genera el nombre del snapshot y muestra las instrucciones. ⚠️ Requiere Proxmox configurado para ejecución real. | `vm` — nombre de la VM |

### Ejecutar una acción
1. Localiza la acción en el catálogo
2. Pulsa **Ejecutar**
3. Rellena los parámetros si los requiere
4. Pulsa **Ejecutar** en el modal
5. Se abre automáticamente la ventana de **salida en tiempo real**

### Historial de ejecuciones
Pestaña **Historial** → lista todas las ejecuciones con:
- Estado: ✅ Completada / ❌ Fallida / ⏳ Pendiente / 🔄 Ejecutando
- Quién la ejecutó y cuándo
- Duración en segundos
- Clic en cualquier fila para ver la salida completa

---

## 5. Base de Conocimiento

**Repositorio de documentación técnica del equipo.**

### Buscar artículos
La búsqueda en tiempo real filtra por título, contenido y tags. Escribe cualquier término técnico (ej: `nginx`, `ssl`, `raid`).

### Crear un artículo
1. Pulsa **"Nuevo artículo"**
2. Rellena:
   - **Título** — descriptivo y buscable
   - **Resumen** — 1-2 frases para la vista previa
   - **Contenido** — soporte completo para **Markdown** (código, listas, cabeceras, etc.)
   - **Tags** — palabras clave para búsqueda
3. **Publicar** → visible para todo el equipo / **Borrador** → solo visible para ti

### Editar artículos
Solo el autor o un administrador pueden editar un artículo. Cada edición registra quién y cuándo la realizó.

### Artículos preinstalados
| Artículo | Contenido |
|---|---|
| Limpiar logs de nginx en producción | Comandos `logrotate` y `find` para liberar espacio |
| Troubleshooting Error 502 en PHP-FPM | Diagnóstico y solución de workers agotados |
| Recuperación de RAID degradado en Synology | Procedimiento paso a paso para NAS Synology |

---

## 6. Auditoría

**Registro inmutable de todas las acciones realizadas en el sistema.**

### Qué se registra
Cada acción importante genera automáticamente un evento de auditoría:
- Inicio/cierre de sesión
- Creación, edición y cambio de estado de incidencias
- Ejecución de automatizaciones
- Creación y edición de artículos de KB
- Cambios de configuración

### Filtros disponibles
| Filtro | Opciones |
|---|---|
| **Usuario** | Ver solo acciones de un técnico concreto |
| **Tipo de acción** | create / update / delete / execute / login / logout |
| **Entidad** | incident / automation_run / kb_article / user |
| **Fecha** | Rango de fechas personalizado |

### Exportar
El registro de auditoría es solo lectura — ningún usuario puede modificarlo ni borrarlo.

---

## 7. Configuración

**Ajustes del sistema (solo Administradores).**

### Secciones
| Sección | Contenido |
|---|---|
| **Conectores** | Ver el estado de cada integración, latencia y último error |
| **Usuarios** | Gestión de cuentas del equipo (crear, editar rol, desactivar) |
| **Perfil** | Cambiar tu nombre, email y contraseña |

---

## 8. Conectores

**Integraciones activas con la infraestructura.**

| Conector | Sistema | Qué monitoriza |
|---|---|---|
| **Zabbix** | `192.168.12.39` | Alertas de hosts, CPU, memoria, disco, red, servicios Windows |
| **Uptime Kuma** | `192.168.12.52:3001` | Disponibilidad de URLs y servicios (HTTP, ping, TCP) |
| **VMware vCenter** | `192.168.12.38` | Estado y ciclo de vida de máquinas virtuales |
| **Portainer** | `192.168.12.56:9443` | Contenedores Docker: estado running/stopped/exited |
| **NAS Synology** | `192.168.35.6:5001` | Estado de volúmenes RAID, uso de disco, logs de error |

### Frecuencia de actualización
- **Dashboard**: datos en vivo, refresco automático cada 30 segundos
- **Health check de conectores**: cada 5 minutos (tarea programada)
- **Sincronización de alertas**: cada 2 minutos

---

## 9. Roles y Permisos

| Acción | Readonly | Técnico | Admin |
|---|---|---|---|
| Ver Dashboard | ✅ | ✅ | ✅ |
| Ver Incidencias | ✅ | ✅ | ✅ |
| Crear/Editar Incidencias | ❌ | ✅ | ✅ |
| Ejecutar Automatizaciones | ❌ | ✅ | ✅ |
| Ver Base de Conocimiento | ✅ | ✅ | ✅ |
| Crear artículos KB | ❌ | ✅ | ✅ |
| Ver Auditoría | ❌ | ✅ | ✅ |
| Gestionar Usuarios | ❌ | ❌ | ✅ |
| Crear Automatizaciones | ❌ | ❌ | ✅ |
| Configuración del sistema | ❌ | ❌ | ✅ |

---

*Manual generado el 20 de abril de 2026 — SysOps Hub v1.0*
