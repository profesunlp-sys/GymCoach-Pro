# Security Specification - GymCoachPro

## Data Invariants
1. **Alumno**: Must have `nombre` (string, max 100), `dni` (string, max 20), `disciplina` (string), and `nivel` (string). `userId` must match the creator.
2. **Asistencia**: Must have `alumnoId` (valid format), `fecha` (string), and `presente` (boolean).
3. **Clase**: Must have `grupo`, `fecha`, and `entrenador`.
4. **Staff**: Must have `nombre` and `userId`.
5. **Roles**: 
   - **Coordinator**: `profesunlp@gmail.com` (Hardcoded for now as per app logic). Full CRUD on everything.
   - **Coach**: Authenticated users who are part of the `staff` collection or identified by their email. Can manage students and classes.

## The Dirty Dozen Payloads (Rejection Targets)

1. **ID Poisoning**: Creating an Alumno with a doc ID of 2KB of random chars.
2. **Type Spoofing**: Setting `edad` to a string `"very old"`.
3. **Identity Theft**: Updating an Alumno's `userId` to a different UID.
4. **Relational Orphan**: Creating an Asistencia with a non-existent `alumnoId`.
5. **PII Leak**: Unauthenticated user reading the `staff` collection.
6. **Shadow Fields**: Creating an Alumno with a `isVerifiedAdmin: true` field not in schema.
7. **Temporal Violation**: Setting `fechaIngreso` to a future date manually.
8. **Malicious ID**: Creating a collection with a path like `/alumnos/../secret_configs`.
9. **Large Payload**: Attempting to write a 1MB string into a `nombre` field.
10. **State Shortcut**: Setting a payment status to 'Al día' without a valid payment record (if logic were strictly enforced).
11. **Impersonation**: Writing to another coach's `staff` entry.
12. **Public Write**: Attempting to write to `config` collection as a non-coordinator.

## Test Runner (Logic Outline)
The `firestore.rules.test.ts` will verify:
- Unauthenticated access is blocked for all collections.
- Non-coordinator users cannot modify `config` or `disciplinas`.
- Users can only modify `Alumno` records they created (if we strictly enforce ownership) or if they are staff.
- Input validation (regex, size) rejects malicious payloads.
