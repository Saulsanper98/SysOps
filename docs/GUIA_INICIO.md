# Guía de inicio — SysOps Hub

Pasos para levantar la aplicación por primera vez y acceder. Incluye modo demo (sin integraciones reales) y referencia a producción.

---

## Requisitos previos

| Entorno | Necesitas |
|--------|-----------|
| **Docker** | Docker Desktop (o Docker Engine) y Docker Compose v2 |
| **Solo Node (desarrollo)** | Node.js 20+, PostgreSQL 16, Redis 7 |

---

## Opción 1: Inicio con Docker Compose (recomendado)

Desde la **raíz del proyecto** (donde están `docker-compose.yml` y `.env`).

### 1. Variables de entorno

- Si no existe `.env`, copia el ejemplo:
  ```bash
  cp .env.example .env
  ```
- Revisa al menos:
  - `JWT_SECRET`: cadena larga y aleatoria (mínimo 32 caracteres). En producción: `openssl rand -hex 64`
  - `DEMO_MODE=true` para probar sin Zabbix, Hikvision, etc. reales (los conectores se simulan, **incluido Hikvision NVR** en demo)
  - `POSTGRES_PASSWORD`: si lo cambias, debe coincidir con lo que use `DATABASE_URL` del host (el compose inyecta la URL al backend con la misma contraseña)

### 2. Arrancar contenedores

```bash
docker-compose up -d
```

Espera **unos 20–30 segundos** hasta que Postgres y Redis pasen el healthcheck y el backend arranque.

### 3. Base de datos (solo la primera vez)

```bash
docker-compose exec backend npm run db:push
docker-compose exec backend npm run db:seed
```

- `db:push` aplica el esquema en PostgreSQL  
- `db:seed` crea usuarios y datos de ejemplo

### 4. Abrir la aplicación

| Servicio | URL |
|----------|-----|
| **Interfaz web** | http://localhost (puerto **80**) |
| **API** | http://localhost:3001 |
| **Salud de la API** | http://localhost:3001/health |

### 5. Iniciar sesión

En la pantalla de login introduce usuario y contraseña (no se eligen integraciones ahí; Hikvision y el resto aparecen **tras entrar**, en el Dashboard y en Configuración → Conectores).

**Usuarios demo** (tras `db:seed`; el README detalla variantes):

- `admin` / `Admin1234!` — administrador  
- Otros técnicos según el seed del proyecto (`jgarcia`, `mlopez`, etc. con `Tech1234!` si aplica)

### 6. Parar la aplicación

```bash
docker-compose down
```

Datos de Postgres se conservan en el volumen Docker salvo que uses `docker-compose down -v`.

---

## Opción 2: Desarrollo local sin Docker (frontend + backend en tu máquina)

### Backend

```bash
cd backend
npm install
```

Asegúrate de que en la raíz exista `.env` con `DATABASE_URL` y `REDIS_URL` apuntando a tu Postgres y Redis locales (ver `.env.example`).

```bash
npm run dev
```

Primera vez:

```bash
npm run db:push
npm run db:seed
```

API en **http://localhost:3001**.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

SPA en **http://localhost:5173** (Vite). El frontend debe poder llamar a la API (`VITE_API_URL` en build o proxy según tu configuración).

---

## Modo demo vs integraciones reales

| `DEMO_MODE` | Comportamiento |
|-------------|----------------|
| `true` | Conectores **simulados** (Zabbix, Uptime Kuma, Proxmox, vCenter, Portainer, NAS y **Hikvision NVR**). No hace falta URL de Hikvision ni del resto. |
| `false` | Solo se registran conectores con variables definidas en `.env` (por ejemplo `HIKVISION_URL` + usuario/contraseña para Hikvision ISAPI). |

Tras cambiar `.env`, **reinicia el backend** (o `docker-compose up -d --build` si cambias variables de build del frontend).

---

## Producción (resumen)

1. `DEMO_MODE=false` y rellenar solo las integraciones que uses.  
2. `JWT_SECRET` fuerte y único.  
3. `docker-compose up -d --build`  
4. Primera vez: `db:push` y `db:seed` (o migraciones según vuestra política).  
5. Acceso: `http://<IP-o-dominio-del-servidor>` (puerto 80 en el compose por defecto).

---

## Incidencias habituales

- **Login falla o “Network error”**: comprobar que el backend esté en marcha y que la URL de la API sea la correcta (compose: API en 3001, front en 80).  
- **No hay datos / errores de BD**: ejecutar `db:push` y `db:seed`; revisar logs de `sysops_postgres` y `sysops_backend`.  
- **Hikvision no aparece en demo**: a partir de la versión que incluye Hikvision en el registro demo, debe listarse como **Hikvision NVR** en conectores; si usas una imagen antigua, reconstruye el backend.

---

*Documento alineado con el README del repositorio y el comportamiento actual del modo demo.*
