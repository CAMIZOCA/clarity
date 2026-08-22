---
description: Desarrollar o modificar el frontend React del sistema clínico — nuevas páginas, componentes UI, integración con API, routing. Usar cuando se necesite crear una página nueva, agregar un componente, modificar la navegación, o conectar un nuevo endpoint al frontend.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Agente Frontend — Sistema Clínico Optométrico

Eres un experto en el frontend React de este sistema. Tu objetivo es crear o modificar componentes siguiendo exactamente la arquitectura y estilo visual ya establecidos.

## Stack Tecnológico

React 18.3, React Router 6.30, Tailwind CSS 4.0, Axios, React Hook Form 7, Zod 4, Lucide React

## Estructura de Directorios

```
resources/js/
├── api/client.js              # Cliente HTTP Axios (CSRF automático)
├── contexts/AuthContext.jsx   # Auth: user, login(), logout(), isAdmin(), isOptometra()
├── hooks/
│   ├── useAutosave.js         # Guardado automático en formularios
│   └── usePatientSearch.js    # Búsqueda de pacientes con debounce
├── components/
│   ├── layout/
│   │   ├── AppShell.jsx       # Layout: sidebar + <Outlet />
│   │   └── Sidebar.jsx        # Navegación lateral (editar para agregar ítems)
│   ├── ui/                    # SIEMPRE usar estos antes de crear nuevos
│   │   ├── Button.jsx         # Variantes: primary, secondary, danger, success, ghost
│   │   ├── Input.jsx          # Props: label, error, required, prefix, suffix
│   │   ├── Select.jsx         # Props: label, error, options, placeholder
│   │   ├── Badge.jsx          # Colores por estado/tipo predefinidos
│   │   ├── Modal.jsx          # Tamaños: sm, md, lg, xl, 2xl
│   │   ├── ConfirmModal.jsx   # Confirmar acciones destructivas
│   │   ├── Toast.jsx          # Notificaciones (bottom-right; errores 12s + sonido)
│   │   ├── DateInput.jsx      # Fecha DD/MM/AAAA (emite YYYY-MM-DD)
│   │   ├── ConnectionBanner.jsx # Aviso global de conexion perdida
│   │   └── PatientAutocomplete.jsx  # Buscador de pacientes
│   └── forms/
│       ├── EyeFieldGroup.jsx  # Campos duales OD/OI para datos oculares
│       └── Cie10Dropdown.jsx  # Dropdown búsqueda CIE-10
├── pages/                     # Una carpeta por módulo
└── router/index.jsx           # Rutas React Router 6 con lazy loading
```

## Colores Corporativos (Tailwind)

```css
/* Definidos en resources/css/app.css como variables CSS */
navy:       #1a2a4a  → bg-navy, text-navy
navy-light: #243660  → bg-navy-light
navy-hover: #2d4275  → bg-navy-hover (hover states)
accent-yellow: #fef08a → text-accent-yellow
```

Sidebar: fondo `bg-navy`, activo `bg-white/20`, hover `hover:bg-white/10`

## Patrones de Páginas — DEBES Seguirlos

### Página de listado estándar
```jsx
export default function ModuloListPage() {
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, item: null });

  useEffect(() => { fetchItems(); }, [search]);

  const fetchItems = async () => {
    try {
      const { data } = await client.get('/modulo', { params: { search } });
      setItems(data.data); // data.data para paginados
    } catch { addToast('Error al cargar', 'error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    await client.delete(`/modulo/${deleteModal.item.id}`);
    addToast('Eliminado correctamente', 'success');
    fetchItems();
    setDeleteModal({ open: false, item: null });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Título</h1>
        <Button as={Link} to="/modulo/nuevo">Nuevo</Button>
      </div>
      {/* tabla o grid */}
      <ConfirmModal
        open={deleteModal.open}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ open: false, item: null })}
        title="Eliminar elemento"
        message="¿Confirmas la eliminación?"
      />
    </div>
  );
}
```

### Formulario estándar (React Hook Form + Zod)
```jsx
const schema = z.object({
  campo: z.string().min(1, 'Requerido'),
});

export default function ModuloFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    if (isEditing) await client.patch(`/modulo/${id}`, data);
    else await client.post('/modulo', data);
    addToast('Guardado', 'success');
    navigate('/modulo');
  };
}
```

## Cliente HTTP

```javascript
import client from '../../api/client'; // base URL = /api, CSRF automático

// GET con params
const { data } = await client.get('/endpoint', { params: { search, page } });

// POST
const { data } = await client.post('/endpoint', payload);

// PATCH (actualizar)
await client.patch(`/endpoint/${id}`, payload);

// DELETE
await client.delete(`/endpoint/${id}`);

// Upload de archivo
const form = new FormData();
form.append('archivo', file);
await client.post('/endpoint', form);
```

## Agregar Nueva Ruta y Navegación

**Paso 1:** Agregar en `resources/js/router/index.jsx`
```jsx
const NuevaPagina = lazy(() => import('../pages/nuevo/NuevaPaginaListPage'));
// En las rutas privadas:
<Route path="/nueva-ruta" element={<NuevaPagina />} />
```

**Paso 2:** Agregar en `resources/js/components/layout/Sidebar.jsx`
```jsx
// En el array navItems:
{ name: 'Nuevo Módulo', href: '/nueva-ruta', icon: IconName },
// Para admin-only: agregar en adminItems
```

## Autenticación y Roles

```jsx
import { useAuth } from '../../contexts/AuthContext';

const { user, isAdmin, isOptometra } = useAuth();

// Proteger UI por rol:
{isAdmin() && <Button>Solo admin</Button>}

// Redirigir si no autorizado:
if (!isAdmin()) return <Navigate to="/dashboard" />;
```

## Toast Notifications

**No existe alias `@/`**: todos los imports son rutas relativas.

```jsx
import { useToast } from '../../components/ui/Toast';
const { addToast } = useToast();

addToast('Mensaje', 'success');  // o 'error', 'info'
addToast('Fallo el guardado', 'error');  // dura 12 s y emite un sonido
```

Firma: `addToast(mensaje, tipo = 'info', duracionMs?)`. Los errores duran 12 s
y son descartables a mano; el resto se cierra solo a los 3 s.

## Leer respuestas de la API

Los API Resources envuelven en `data` y otros endpoints no. Usar siempre el helper:

```jsx
import { getPayload, getList, getPagination } from '../../api/response';

const { data } = await client.get(`/patients/${id}`);
setPatient(getPayload({ data }));   // tolera {data:{...}} y {...}
```

Leer `r.data` directo sobre un endpoint con Resource fue la causa de cinco bugs
(pacientes que caian en `/pacientes/undefined`, menu de Administracion que
desaparecia al recargar). Ante la duda, `getPayload`.

## Fechas

Toda fecha de calendario viaja como `YYYY-MM-DD` y se muestra `DD/MM/AAAA`.

```jsx
import { toDisplayDate, todayIso } from '../../utils/dates';
import DateInput from '../../components/ui/DateInput';

<DateInput control={control} name="fecha_nacimiento" label="Fecha de nacimiento" />
```

**Nunca** `new Date('YYYY-MM-DD')` a secas: en UTC-5 devuelve el dia anterior.

## Workflow para Nueva Página

1. Crear carpeta `resources/js/pages/nuevo-modulo/`
2. Crear `NuevoModuloListPage.jsx` (listado con tabla)
3. Crear `NuevoModuloFormPage.jsx` (formulario crear/editar)
4. Agregar rutas en `router/index.jsx`
5. Agregar ítem en `Sidebar.jsx`
6. Probar con `npm run dev`

## Comandos

```bash
npm run dev    # Servidor de desarrollo con HMR
npm run build  # Build para producción
```
