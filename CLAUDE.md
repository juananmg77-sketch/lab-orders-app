# CLAUDE.md — Lab Orders App (HSLAB)

## Proyecto
Aplicación de gestión de laboratorio para HS Consulting. Cubre compras, producción, equipos, proveedores, documentos ISO, RRHH y generación de etiquetas.

- **Producción:** https://lab-orders.netlify.app
- **Repo:** https://github.com/juananmg77-sketch/lab-orders-app
- **Supabase project ID:** `zrqrodjbgknighdwwooy` (West EU — Ireland)
- **Stack:** React 18 + Vite + JSX · Supabase (PostgreSQL + Storage) · Netlify

---

## Arquitectura

`App.jsx` es el enrutador central — renderiza un módulo u otro según `activeModule`. Cada módulo es un fichero `.jsx` independiente que recibe props desde App.

### Módulos
| Fichero | Módulo |
|---|---|
| `Hub.jsx` | Menú principal |
| `PurchasingModule.jsx` | Compras, proveedores, producción de lotes |
| `EquipmentModule.jsx` | Gestión de equipos |
| `DocumentsModule.jsx` | Gestor documental ISO (procesos PC-XX) |
| `RRHHModule.jsx` | RRHH, competencias, formación |
| `LabelGeneratorModule.jsx` | Generador de etiquetas (CSV → XLS) |
| `LegionellaForecastModule.jsx` | Previsión Legionella |
| `TrainingCertificateModule.jsx` | Certificados de formación |
| `UserManagementModule.jsx` | Gestión de usuarios |

### Props globales (App.jsx → módulos)
- `session` — usuario autenticado (Supabase Auth)
- `globalLab` — `'HSLAB Baleares'` o `'HSLAB Canarias'`
- `role` — `'admin'` | `'lab'` | `'operations'`
- `canApprove` — booleano para aprobar pedidos
- `onBackToHub` — vuelve al menú principal

### Lab por delegación
```js
labFromDelegacion = (d) => d === 'Canarias' ? 'HSLAB Canarias' : 'HSLAB Baleares'
```
El `globalLab` se inicializa al login desde el perfil del usuario y condiciona qué datos se muestran en toda la app.

---

## Base de datos (Supabase)

### Tablas principales
| Tabla | Descripción |
|---|---|
| `profiles` | Roles y delegación de usuarios (`role`, `delegacion`, `can_approve`) |
| `employees` | Técnicos y personal (`full_name`, `department`, `delegacion`, `status`) |
| `competency_evaluations` | Evaluaciones de PNTs por técnico (`evidence_url`, `evidence_name`) |
| `competency_eval_history` | Historial de exámenes con PDF adjunto (`document_url`, `document_name`) |
| `employee_competencies` | Competencias asignadas por empleado |
| `employee_documents` | Documentos del empleado (contratos, títulos, certificados) |
| `lab_pnts` | Procedimientos normalizados de trabajo (`code`, `name`, `group_name`) |
| `training_templates` | Plantillas de formación |
| `suppliers` | Proveedores (`lab`, `accreditation_body`, `accreditation_number`) |
| `supplier_documents` | Documentos de proveedores |
| `supplier_evaluations` | Evaluaciones ISO 9001 de proveedores |
| `equipments` | Equipos de consultores (`status`: ALTA/BAJA) |
| `equipment_incidents` | Incidencias de equipos |
| `orders` | Pedidos de compra |
| `articles` | Artículos/reactivos |
| `article_lots` | Lotes de artículos |
| `production_lots` | Lotes de producción de medios |
| `production_lot_ingredients` | Ingredientes de cada lote |
| `documents` | Gestor documental ISO (`is_active`, `is_obsolete`, `previous_version_id`) |
| `label_muestras` | Muestras importadas para etiquetas |
| `legionella_establecimientos` | Establecimientos para previsión Legionella |
| `legionella_actividades` | Actividades de Legionella |
| `lab_calendar_events` | Eventos del calendario de laboratorio |
| `absences` | Ausencias de personal |
| `monthly_budgets` | Presupuestos mensuales |
| `candidates` | Candidatos RRHH |
| `record_amendments` | Enmiendas de registros |

### Storage buckets
- `documents` — documentos ISO (PNTs, normativa, fichas de seguridad)
- `employee-documents` — documentos de empleados (`{employee_id}/evaluaciones/`, `eval-history/{employee_id}/`, `{employee_id}/competencias/`)

---

## Conceptos clave

### Versioning de documentos
Cadena: `previous_version_id` → doc anterior. `is_obsolete = true` = versión antigua. `is_active = false` = eliminado. Al borrar el documento actual hay que reactivar (`is_obsolete = false`) el anterior.

### Medios de producción (etiquetas)
```js
const LABEL_TIPOS = ['TAB', 'TAG', 'TTB', 'TTG', 'STB', 'STG', null];
// null → se reemplaza por "Matriz A" o "Matriz B"
// Genera 7 etiquetas por muestra
```

### Filtro de proveedores por lab
```js
labSuppliers = suppliers.filter(s => (s.lab || 'HSLAB Baleares') === selectedLab)
```

### Prevención de auto-traducción Chrome
`index.html` tiene `lang="es" translate="no"` y `<meta name="google" content="notranslate">` — **no cambiar** — evita que Chrome traduzca los códigos de medios (TAB, TAG, STB...).

---

## Deploy

**El deploy es siempre manual.** No hay CI/CD automático.

```bash
# Desde la raíz del proyecto
npx netlify-cli deploy --prod
```

Solo el Owner del proyecto hace deploy a producción.

---

## Flujo de trabajo Git

```bash
# Antes de empezar
git checkout main
git pull origin main
git checkout -b feature/nombre-tarea

# Al terminar
git add src/ModuloModificado.jsx
git commit -m "feat: descripción del cambio"
git push origin feature/nombre-tarea
# → abrir Pull Request en GitHub → esperar aprobación del Owner
```

**Nunca hacer push directo a `main`.** Toda incorporación de código requiere Pull Request aprobado.

---

## Variables de entorno

El fichero `.env` no está en el repo. Pedírselo al Owner del proyecto. Contiene las claves de Supabase (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
