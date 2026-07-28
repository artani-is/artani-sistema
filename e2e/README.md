# Pruebas de Artani

Suite de pruebas del sistema, organizada según las tres etapas de Sommerville
(ver la sección «Metodología de pruebas de software» del Marco Teórico del
informe).

## Requisitos previos

PostgreSQL en marcha y las dos bases de datos de pruebas creadas:

```sh
docker.exe compose up -d          # desde la raíz del repositorio

docker.exe exec artani_db psql -U artani -d postgres \
  -c "CREATE DATABASE artani_test OWNER artani;" \
  -c "CREATE DATABASE artani_e2e  OWNER artani;"
```

Ninguna suite toca la base de datos de desarrollo (`artani`).

## Ejecución

| Categoría | Comando | Ubicación |
|---|---|---|
| Unitarias e integración (API) | `pnpm test` | `backend/` |
| Componentes y stores (cliente) | `pnpm test` | `frontend/` |
| Extremo a extremo y RNF de sistema | `pnpm test` | `e2e/` |

Las pruebas de extremo a extremo levantan por su cuenta la API (puerto 3000,
contra `artani_e2e`) y el cliente de Vite (puerto 5174); no hace falta
arrancarlos a mano.

La primera vez, instalar los navegadores:

```sh
pnpm exec playwright install chromium firefox
```

## Resultados y evidencia

- `e2e/capturas/` — capturas de pantalla que ilustran el informe. Se regeneran
  en cada corrida (la carpeta se vacía al iniciar), por lo que no se versionan
  aquí; la copia definitiva vive en el repositorio de la documentación, en
  `capitulo3/evidencias/e2e/`.
- `backend/tests/resultados/mediciones-rnf.jsonl` y
  `e2e/resultados/mediciones-e2e.jsonl` — mediciones de tiempo (promedio,
  máximo y mínimo sobre doce corridas por escenario).

## Fallos esperados

Algunas pruebas están declaradas como **fallo esperado** (`it.fails` en Vitest,
`test.fail()` en Playwright). No son pruebas rotas: documentan defectos
conocidos y avisan en cuanto se corrijan.

| Prueba | Defecto documentado |
|---|---|
| `backend/tests/sprint1/hu02-04-catalogos.test.ts` (3 casos) | `GALERIA.nombre` carece de restricción `UNIQUE`, y la comprobación de uso de galerías está fijada en `false`. Motivo por el que HU-02, HU-03 y HU-04 permanecen en el Product Backlog. |
| `e2e/tests/rnf-sistema.spec.ts` (2 casos) | RNF\_008: la vista de inventario desborda horizontalmente entre 768–886 px y 1024–1150 px, en Chromium y en Firefox. |
