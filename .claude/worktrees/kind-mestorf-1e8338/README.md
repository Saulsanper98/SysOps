# SysOps Hub

Centro de operaciones interno para el equipo de Sistemas.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Fastify + TypeScript + Drizzle ORM |
| Base de datos | PostgreSQL 16 |
| Jobs / Colas | BullMQ + Redis 7 |
| Auth | JWT + bcrypt (local) · Entra ID preparado |
| Notificaciones | Microsoft Teams (webhook) |

---

## Inicio rápido (modo demo local)

```bash
# 1. Copiar variables de entorno
cp .env.example .env

# El archivo .env.example ya tiene DEMO_MODE=true
# No necesitas integraciones reales para probar

# 2. Levantar servicios con Docker Compose
docker-compose up -d

# 3. Esperar ~20s a que arranquen los servicios

# 4. Inicializar la base de datos (primera vez)
docker-compose exec backend npm run db:push
docker-compose exec backend npm run db:seed

# 5. Abrir en el navegador
# Frontend: http://localhost:80
# API:      http://localhost:3001
# Health:   http://localhost:3001/health
```

**Credenciales demo:**
- `admin / Admin1234!` — Administrador (acceso completo)
- `jgarcia / Tech1234!` — Técnico
- `mlopez / Tech1234!` — Técnico

---

## Desarrollo local (sin Docker)

### Requisitos
- Node.js 20+
- PostgreSQL 16 corriendo en localhost:5432
- Redis 7 corriendo en localhost:6379

### Backend
```bash
cd backend
npm install
cp ../.env.example ../.env  # ajusta DATABASE_URL y REDIS_URL
npm run dev          # inicia en http://localhost:3001
npm run db:push      # aplica esquema (primera vez)
npm run db:seed      # carga datos demo
npm test             # ejecuta tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # inicia en http://localhost:5173
```

---

## Producción con Docker Compose

```bash
# 1. Ajusta .env (DEMO_MODE=false, conectores reales, JWT_SECRET seguro)
# 2. Genera un JWT_SECRET seguro:
openssl rand -hex 64

# 3. Construir e iniciar
docker-compose up -d --build

# 4. Inicializar BD (solo primera vez)
docker-compose exec backend npm run db:push
docker-compose exec backend npm run db:seed
```

**Acceso:** `http://<ip-servidor>` (puerto 80)

---

## Configurar integraciones

Edita `.env` y establece `DEMO_MODE=false`. Configura solo las integraciones disponibles:

```env
DEMO_MODE=false

# Zabbix
ZABBIX_URL=http://zabbix.empresa.local/zabbix
ZABBIX_USER=Admin
ZABBIX_PASSWORD=tu_password

# Proxmox
PROXMOX_URL=https://proxmox.empresa.local:8006
PROXMOX_USER=root@pam
PROXMOX_PASSWORD=tu_password
PROXMOX_VERIFY_SSL=false

# Teams (opcional)
TEAMS_WEBHOOK_URL=https://empresa.webhook.office.com/...
```

Los conectores no configurados simplemente no aparecen. Los configurados que fallen se muestran como "degradados" sin afectar al resto.

---

## Estructura del proyecto

```
sysops-hub/
├── backend/                 # Fastify API
│   └── src/
│       ├── auth/           # JWT + bcrypt
│       ├── connectors/     # Integraciones (Zabbix, Proxmox...)
│       ├── db/             # Schema Drizzle + migraciones + seed
│       ├── jobs/           # BullMQ workers
│       ├── routes/         # REST endpoints
│       ├── services/       # Lógica de negocio + notificaciones
│       ├── tests/          # Tests unitarios
│       └── utils/          # Logger, audit, errors
├── frontend/               # React SPA
│   └── src/
│       ├── components/     # UI components + layout
│       ├── pages/          # Vistas principales
│       ├── store/          # Zustand state
│       └── lib/            # API client + utils
├── docs/
│   ├── architecture.md     # Arquitectura detallada
│   └── roadmap.md          # Fases MVP → v2
└── docker-compose.yml
```

---

## Funcionalidades

### Dashboard
- KPIs en tiempo real: alertas críticas, salud de sistemas, incidencias abiertas
- Top alertas activas con severidad y sistema afectado
- Estado de todos los conectores con latencia
- Grid de sistemas con estado visual (ok / degradado / crítico)

### Incidencias
- Creación manual o desde alertas
- Checklist con progreso visual
- Timeline de eventos y comentarios
- Cierre con RCA → genera artículo KB automáticamente
- Notificación Teams en incidencias críticas/altas

### Automatizaciones
- Catálogo de acciones por categoría (health-check, restart, snapshot, cleanup, validate)
- Ejecución asíncrona con visualización de output en tiempo real
- Historial de ejecuciones con tiempos
- Control de acceso por rol

### Base de Conocimiento
- Artículos manuales y auto-generados desde cierres de incidencias
- Búsqueda por título, contenido, tags
- Rating (útil / no útil)
- Relación con incidencia origen

### Auditoría
- Registro de todas las acciones que modifican estado
- Filtros por tipo de entidad, acción, usuario, fechas
- Timeline visual con navegación a entidades

---

## Entra ID (Azure AD) — Preparación

Para activar SSO con Entra ID, configura en `.env`:

```env
ENTRA_CLIENT_ID=<app-registration-client-id>
ENTRA_CLIENT_SECRET=<client-secret>
ENTRA_TENANT_ID=<tenant-id>
ENTRA_REDIRECT_URI=http://tu-servidor/auth/entra/callback
```

> **Nota:** El adaptador OIDC está preparado en la arquitectura pero requiere implementación del callback OAuth2. Ver `docs/roadmap.md` — v1.0.

---

## Seguridad

- Contraseñas hasheadas con bcrypt (factor 12)
- JWT con expiración configurable (default 8h)
- Rate limiting: 200 req/min por IP
- CORS restringido a `FRONTEND_URL`
- Headers de seguridad (Helmet)
- Audit trail completo — cada acción queda registrada con usuario, IP y timestamp
- Roles: admin > tecnico > readonly

---

## Tests

```bash
cd backend
npm test              # vitest run
npm run test:watch    # modo watch
```
