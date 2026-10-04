-- Valor adicional compatible con las notificaciones existentes; no cambia ni borra datos.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MENTION';
