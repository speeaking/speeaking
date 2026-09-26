# ai

Vende con IA, generación de contenido, `AIProvider` (simulado en Sprint 1), guardián de presupuesto y
registro de tokens/costo (ADR-005, ADR-006, ADR-020). Fase: 1.8.

- `reservation.ts`: reserva cuota por persona (hora y día) y presupuesto global ANTES de llamar
  (SEC-19, ADR-031).
- `proposal-numbers.ts`: rango de precio y presupuesto diario calculados por código (P2).
- `output-guard.ts`: revisa el contenido de la propuesta contra los datos del vendedor (SEC-28).
- `personal-data.ts` y `retention.ts`: la entrada se guarda sin contactos ni cuentas y se redacta a
  los 90 días (SEC-29).
