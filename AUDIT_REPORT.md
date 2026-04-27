# Reporte de Auditoría: Gym Coach Pro

## 1. Navegación General
- **Barra Inferior:** Funciona correctamente mapeando Inicio (Dashboard), Gimnastas (Alumnos), Grupos (Horario) y Ajustes.
- **Magic Menu (Overlay):** Permite navegación rápida a flujos profundos.
- **Dashboards:** La distinción de roles entre Coordinador y Coach ahora es robusta, basada en la colección `staff`.

## 2. Pantallas sin Retroceso
- **Estado:** Todas las pantallas analizadas poseen mecanismos de retroceso (`BackButton` o `onBack`).

## 3. Pantallas Huérfanas y Flujos Rotos
- **RESOLVIDO:** `Menu -> Habilidades`. El estado `vista === 'Habilidades'` se implementó correctamente en `App.tsx`.
- **Inconsistencia de Nombres:** Existe la vista `TendenciasHabilidades` en el componente de Reportes, pero no está conectada al menú principal.

## 4. Integridad de Formularios y Lógica de Datos
- **BUG DE LÓGICA (Corregido):** En `Dashboard.tsx`, el error de case-sensitivity en `userRole` fue solucionado.
- **Importación de Pagos (RESOLVIDO):**
    - Se flexibilizó el filtro de actividad (reconoce variaciones de "Gimnasia Artística").
    - Se añadió feedback detallado: ahora muestra cuántas filas se ignoraron y por qué (DNI/Nombre no encontrado o actividad incorrecta).
- **Alta de Alumno (RESOLVIDO):** Se implementó validación de DNI duplicado con modal de confirmación para re-asignación de grupo.

## 5. Problemas de Roles y Permisos (RESOLVIDO)
- **Identidad:** Se migró al uso de UIDs. Los profesores se buscan en la colección `staff` por su UID de autenticación.
- **Asignación:** Los grupos ahora guardan `entrenadorId`, asegurando que el Dashboard del profesor siempre muestre sus grupos sin depender del `displayName`.

## 6. Estados Vacíos (UX)
- **Dashboard:** Contadores en cero (Pagos Vencidos, Alertas) no ofrecen feedback positivo, solo el valor numérico.
- **Asistencia:** Si el grupo está vacío, el botón "Inscribir Alumnas" lleva a un formulario que ya tiene pre-cargado el grupo, lo cual es correcto.

## 7. Cambios Implementados
1. **Refactorización de Roles:** Creación de colección `staff`, sincronización automática al login y filtrado por UID.
2. **Validación de Datos:** Modal inteligente de DNI duplicado para evitar registros inconsistentes.
3. **Flexibilidad en Importación:** Sistema de feedback de errores y filtros inclusivos para el Excel de pagos.
4. **Navegación:** Reparación del enlace a Habilidades y carga diferida (lazy) del módulo.
5. **Sincronización robusta:** Reparación de la integración con Google Sheets con sistema de "Public Fallback" (intenta leer por CSV público si falla el OAuth) y feedback de errores específicos en el Dashboard.
