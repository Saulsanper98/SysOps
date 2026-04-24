# SysOps Hub — Roadmap

## MVP (v0.1) — Entregado ✅

**Backend:**
- [x] Auth local (JWT + bcrypt) con roles admin/tecnico/readonly
- [x] CRUD completo de incidencias con checklist, comentarios, timeline
- [x] Cierre con RCA → auto-generación de artículo KB
- [x] Catálogo de automatizaciones con ejecución asíncrona (BullMQ)
- [x] Base de conocimiento con búsqueda y rating
- [x] Audit trail completo de todas las acciones
- [x] Conectores: Zabbix (real), Uptime Kuma, Proxmox, vCenter, Portainer, NAS
- [x] Demo mode con datos ficticios realistas
- [x] Notificaciones Teams para incidencias críticas
- [x] Docker Compose con PostgreSQL + Redis

**Frontend:**
- [x] Dashboard con KPIs, top alertas, estado de sistemas, conectores
- [x] Lista de incidencias con filtros y paginación
- [x] Detalle de incidencia con checklist, timeline, RCA
- [x] Catálogo de automatizaciones + ejecución + historial + output en tiempo real
- [x] Base de conocimiento con búsqueda y filtro por tags
- [x] Detalle de artículo KB con rating
- [x] Audit trail con filtros por tipo, acción, fecha
- [x] Login con modo demo
- [x] Dark ops theme

---

## v1.0 — Próximo Sprint (4-6 semanas)

**Auth & Usuarios:**
- [ ] Integración Entra ID / Azure AD SSO (OIDC)
- [ ] Página de gestión de usuarios (admin)
- [ ] Avatares desde Gravatar / MS Graph API
- [ ] Sesiones activas y revocación de tokens

**Incidencias:**
- [ ] Asignación desde la lista (dropdown inline)
- [ ] Escalado automático si lleva >X horas sin asignarse
- [ ] Plantillas de checklist reutilizables (por tipo/sistema)
- [ ] Vinculación manual de alertas a incidencias
- [ ] SLA tracking (tiempo de respuesta y resolución)
- [ ] Filtro por rango de fechas

**Automatizaciones:**
- [ ] Editor de acciones en UI (admin)
- [ ] Ejecución programada (cron UI)
- [ ] Runbooks: secuencias de acciones ordenadas
- [ ] Aprobación de acciones peligrosas (segundo técnico)

**KB:**
- [ ] Editor WYSIWYG (Markdown con preview)
- [ ] Versioning de artículos
- [ ] Relacionar artículos entre sí
- [ ] Exportar a PDF

**Dashboard:**
- [ ] Gráficos de tendencia de alertas (últimas 24h/7d)
- [ ] Widget de métricas de SLA
- [ ] Drill-down por conector/sistema

---

## v2.0 — Futuro (3 meses)

**Integraciones avanzadas:**
- [ ] Webhooks entrantes (recibir eventos de Zabbix, Uptime Kuma)
- [ ] Microsoft 365 / Intune connector
- [ ] Integración con Grafana (embed dashboards)
- [ ] SMTP para notificaciones por email

**Inteligencia:**
- [ ] Correlación automática de alertas (misma ventana temporal → misma incidencia)
- [ ] Sugerencia de artículo KB al abrir incidencia similar
- [ ] Análisis de tendencias: sistemas con más incidencias

**Operacional:**
- [ ] Modo mantenimiento por sistema (silenciar alertas)
- [ ] Ventanas de cambio planificadas (change freeze)
- [ ] Report semanal/mensual de incidencias (PDF)
- [ ] App móvil PWA mejorada

**Infraestructura:**
- [ ] Kubernetes Helm chart
- [ ] Backup automático de DB
- [ ] Logs centralizados (Loki / ELK)
- [ ] Métricas de la propia app (Prometheus endpoint)

---

## Deuda Técnica Conocida

| Item | Prioridad | Notas |
|------|-----------|-------|
| Migraciones Drizzle generadas | Alta | Ejecutar `drizzle-kit generate` y revisar |
| Tests E2E | Media | Playwright para flujos principales |
| WebSocket real-time alerts | Media | Actualmente UI hace polling |
| Refresh token | Media | Actualmente token fijo con expiración |
| Cache Redis para dashboard | Baja | Dashboard hace queries directas a DB |
