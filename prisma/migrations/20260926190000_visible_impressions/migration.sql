-- Impresión visible del feed (T5, ADR-037): tipo de evento propio para no mezclarla con la pieza
-- servida (`IMPRESSION`), que se conserva como métrica aparte.
ALTER TYPE "AnalyticsEventType" ADD VALUE 'VISIBLE_IMPRESSION';
