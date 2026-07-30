-- HU-02 y HU-03: unicidad del nombre en los catálogos maestros.
--
-- TECNICA_ARTESANAL y CATEGORIA_PIEZA declaraban UNIQUE sobre `nombre` desde el
-- Sprint 1; GALERIA quedó sin la restricción, de modo que aceptaba nombres
-- duplicados al darla de alta y al editarla. El Product Owner solicitó atender
-- la unicidad de manera uniforme en los tres catálogos (Increment del Sprint 1).
--
-- El índice usa el nombre que Prisma deriva por convención
-- (<tabla>_<columna>_key) para que el esquema no presente deriva.
CREATE UNIQUE INDEX "galeria_nombre_key" ON "galeria"("nombre");
