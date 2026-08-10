-- Corrección encontrada al validar ADR-010 en ejecución real: kit_items.resource_category
-- se definió NOT NULL en ADR-002, pero ADR-010 decide que para resource_type en
-- ('vehicle','room') esa columna no se usa para el matching (no existe columna
-- 'category' equivalente en vehicles_details/rooms_details, ver ADR-001) y por tanto
-- debe poder quedar vacía en vez de forzar un valor de relleno sin significado.
alter table kit_items alter column resource_category drop not null;
