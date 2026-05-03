# ESTADO DEL PROYECTO - GYMCOACH PRO
Última actualización: 2026-05-03

## 🎯 Objetivo Actual
Finalizar el sistema de control de pagos y asegurar la sincronización UI entre el Excel de importación y la base de datos de alumnas.

## ✅ Avances Realizados (Hoy)
1. **Importador Masivo (`BulkPaymentImport.tsx`):**
   - Implementada lógica de detección de grupo por descripción del trámite.
   - Agregado panel de auditoría con contadores de "Nuevos", "Ya estaban" y "No encontrados".
   - Funcionalidad para ver la lista de nombres no encontrados al hacer clic en el contador.
   - Filtro automático para "Gimnasia Artística Infantil".

2. **Control de Pagos UI (`ControlPagos.tsx`):**
   - Agregado **Selector de Año** (2024-2027) para visualizar pagos de periodos anteriores.
   - Lógica de tildes (redondelitos) ultra-flexible: ignora mayúsculas, espacios y detecta abreviaturas de meses.
   - Visualización del grupo (Días y Horarios) debajo del nombre de cada alumna.

3. **Base de Datos (Firestore):**
   - Los pagos se guardan como objetos en un array `pagosMensuales` dentro de cada alumno.
   - Formato: `{ mes: string, anio: number, fechaPago: ISOString, monto: number, importado: true }`.

## ⚠️ Pendientes / Próximos Pasos
- [ ] Verificar con el usuario si los nombres "No encontrados" deben ser corregidos en el Excel o en la App.
- [ ] Implementar reporte de deudores (quiénes NO tienen pago en el mes seleccionado).
- [ ] Sincronizar este estado con el Google Drive compartido con Claude y AI Studio.

## 🔑 IDs de Google Drive (Suministrados por Claude)
- **ACTIVO:** 1nwL1KAnRmkU4m0v62mD_22I8lMxGXPTM
- **RESPALDO CLAUDE:** 1rvLZgWetHGUgUxwg2fSTopzGdWA5iSAz
- **RESPALDO GOOGLE:** 1F1ECBmrzBdd_9EQChyDfzHuPVzNbCyH1
