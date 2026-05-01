# Security Specification - GymCoach Pro Elite

## Data Invariants
- All data access requires a verified email account.
- The user `profesunlp@gmail.com` is the system administrator.
- `alumnoId` in `asistencias` must reference a valid document in `alumnos`.
- System configuration (`config`, `disciplinas`, `niveles`, `sources`) can only be modified by admins.
- Timestamps must be handled via server-side validation where possible.

## The "Dirty Dozen" Payloads (Denial Tests)

1. **Anonymous Read**: Attempt to read `alumnos` without logging in.
2. **Unverified Write**: Attempt to create an `alumno` with an unverified email.
3. **Identity Spoofing**: Attempt to update an `alumno` setting `userId` to a different user's ID.
4. **ID Poisoning**: Attempt to create a document with a 2KB string as an ID.
5. **Shadow Fields**: Attempt to create an `alumno` with an extra `isAdmin: true` field.
6. **Immutable Field Break**: Attempt to change the `fechaIngreso` of an existing `alumno`.
7. **Resource Poisoning**: Attempt to inject a 1MB string into a `nombre` field.
8. **Relational Break**: Create an `asistencia` for a non-existent `alumnoId`.
9. **Role Escalation**: Attempt to write to the `staff` collection as a non-admin.
10. **Global Search**: Attempt to list all `alumnos` without any filters as a guest.
11. **Update Gap**: Update only the `dni` of an `alumno` without sending the rest of the required schema.
12. **Status Shortcut**: (Not applicable yet, but potentially in payments).

## Test Runner (Draft)
A `firestore.rules.test.ts` will be created to verify these invariants using the Firebase Emulators or logic checks.
