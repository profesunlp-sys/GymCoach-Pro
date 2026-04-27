# Reporte de Auditoría: Gym Coach Pro

## 1. Navegación General
- **Barra Inferior:** Funciona correctamente mapeando Inicio (Dashboard), Gimnastas (Alumnos), Grupos (Horario) y Ajustes.
- **Magic Menu (Overlay):** Permite navegación rápida a flujos profundos, pero presenta un fallo en el enlace de "Habilidades".
- **Dashboards:** La distinción de roles entre Coordinador y Coach funciona, pero depende de variables hardcoded.

## 2. Pantallas sin Retroceso
- **Estado:** Todas las pantallas analizadas poseen mecanismos de retroceso (`BackButton` o `onBack`).
- **Observación:** El flujo de `ReportePDF` (Planilla Mensual) obliga a volver a la lista de asistencia, no permitiendo volver al dashboard de estadísticas directamente.

## 3. Pantallas Huérfanas y Flujos Rotos
- **Link Roto:** `Menu -> Habilidades`. El estado `vista === 'Habilidades'` no está implementado en el bloque de renderizado de `App.tsx`.
- **Inconsistencia de Nombres:** Existe la vista `TendenciasHabilidades` en el componente de Reportes, pero no está conectada al menú principal.

## 4. Integridad de Formularios y Lógica de Datos
- **BUG DE LÓGICA (Corregido):** En `Dashboard.tsx`, la sincronización de Google Sheets no se activaba porque el código comparaba el rol con `'coordinator'` (minúscula) mientras que el tipo real es `'Coordinator'`. 
- **Importación de Pagos (Sincronización Inteligente):**
    - El filtro de actividad es demasiado restrictivo (Línea 129 de `BulkPaymentImport.tsx`). Ignora filas que no digan explícitamente "Gimnasia" o "Artística".
    - El procesamiento de pagos no da feedback detallado de *por qué* una fila fue ignorada (ej. "Nombre no coincide", "Actividad no válida").
- **Alta de Alumno:** Falta validación preventiva de DNI duplicado.

## 5. Problemas de Roles y Permisos
- **Identidad:** Los profesores dependen totalmente de que su `displayName` en Firebase Auth coincida con el campo `entrenador` del grupo. Si el nombre tiene un error tipográfico o el usuario no tiene nombre en la cuenta de Google, la pantalla aparece vacía.
- **Acceso Administrativo:** El rol de Coordinador está anclado al email `profesunlp@gmail.com`.

## 6. Estados Vacíos (UX)
- **Dashboard:** Contadores en cero (Pagos Vencidos, Alertas) no ofrecen feedback positivo, solo el valor numérico.
- **Asistencia:** Si el grupo está vacío, el botón "Inscribir Alumnas" lleva a un formulario que ya tiene pre-cargado el grupo, lo cual es correcto.
- **Buscadores:** El buscador de alumnos maneja correctamente el estado "Sin resultados".

## 7. Recomendaciones Prioritarias
1. **Corregir Navegación:** Mapear `v: 'Habilidades'` a la lógica de renderizado en `App.tsx`.
2. **Mejorar Importación:** Flexibilizar el reconocimiento de actividades en el Excel de pagos para evitar que procese "0 pagos".
3. **Robustecer Roles:** Implementar una tabla de `staff` en Firestore para manejar roles por UID en lugar de por email hardcoded.
4. **Feedback de Importación:** Mostrar una lista de "Filas no identificadas" después de procesar un Excel para que el coordinador sepa qué nombres no coincidieron.
