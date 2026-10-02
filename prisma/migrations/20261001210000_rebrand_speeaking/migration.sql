-- speeaking (ADR-070): las cuentas internas de la plataforma pasan al dominio reservado nuevo. Solo
-- toca correos `.invalid` y `.test` (nadie puede registrarse con ellos) y el nombre de las cuentas
-- editoriales; en una base nueva no hay filas y no hace nada.

-- Cuentas editoriales y tiendas de demostración (antes `@vendeia.invalid`).
UPDATE "users"
SET "email" = replace("email", '@vendeia.invalid', '@speeaking.invalid')
WHERE "email" LIKE '%@vendeia.invalid';

-- Cuentas eliminadas (antes `@estreno.invalid`).
UPDATE "users"
SET "email" = replace("email", '@estreno.invalid', '@speeaking.invalid')
WHERE "email" LIKE '%@estreno.invalid';

-- Cuenta de prueba local (antes `@estreno.test`).
UPDATE "users"
SET "email" = replace("email", '@estreno.test', '@speeaking.test')
WHERE "email" LIKE '%@estreno.test';

-- «Equipo Estreno» → «Equipo speeaking» en las cuentas editoriales.
UPDATE "users"
SET "name" = 'Equipo speeaking'
WHERE "name" = 'Equipo Estreno' AND "email" LIKE 'editorial.%@speeaking.invalid';

UPDATE "profiles"
SET "displayName" = 'Equipo speeaking'
WHERE "displayName" = 'Equipo Estreno' AND "isEditorial";
