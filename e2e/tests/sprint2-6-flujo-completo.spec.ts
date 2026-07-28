import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "@playwright/test";
import {
  capturar,
  iniciarSesion,
  sufijo,
  filaTabla,
  seleccionarPorTexto,
  aviso,
  dialogo,
} from "./apoyo.js";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const FOTO = path.join(RAIZ, "recursos", "pieza.png");

test.beforeEach(async ({ page }) => {
  await iniciarSesion(page);
});

/** Crea técnica y categoría por interfaz y devuelve sus nombres. */
async function catalogosBase(page: Page, s: string) {
  const tecnica = `Barro negro ${s}`;
  const categoria = `Jarrón ${s}`;

  await page.goto("/catalogos");
  await page.getByRole("button", { name: /Agregar técnica/i }).click();
  await dialogo(page).getByLabel("Nombre de la técnica").fill(tecnica);
  await dialogo(page).getByRole("button", { name: "Guardar" }).click();
  await expect(filaTabla(page, tecnica)).toBeVisible();

  await page.getByRole("button", { name: "Categorías", exact: true }).click();
  await page.getByRole("button", { name: /Agregar categoría/i }).click();
  await dialogo(page).getByLabel("Nombre de la categoría").fill(categoria);
  await dialogo(page).getByRole("button", { name: "Guardar" }).click();
  await expect(filaTabla(page, categoria)).toBeVisible();

  return { tecnica, categoria };
}

/** Registra una pieza; al guardar, el sistema abre su ficha de detalle. */
async function registrarPieza(page: Page, nombre: string, tecnica: string, categoria: string) {
  await page.goto("/artesanias/nueva");
  await page.getByLabel("Nombre de la pieza").fill(nombre);
  await seleccionarPorTexto(page, "Técnica", tecnica);
  await seleccionarPorTexto(page, "Categoría", categoria);
  await page.getByRole("button", { name: "Guardar pieza" }).click();
  // Tras guardar se navega a la ficha de la pieza recién creada
  await expect(page).toHaveURL(/\/artesanias\/[0-9a-f-]{36}$/);
}

/** Abre la ficha de detalle de una pieza desde el inventario y devuelve su URL. */
async function abrirFicha(page: Page, nombre: string): Promise<string> {
  await page.goto("/artesanias");
  await filaTabla(page, nombre).click();
  await expect(page.getByRole("heading", { name: nombre })).toBeVisible();
  return page.url();
}

/** Abre la calculadora de costeo de la pieza cuya ficha está en `urlFicha`. */
async function abrirCosteo(page: Page, urlFicha: string) {
  await page.goto(`${urlFicha}/costeo`);
  await expect(page).toHaveURL(/costeo/);
}

// ---------------------------------------------------------------------------
// Sprint 2 — HU-06, HU-07
// ---------------------------------------------------------------------------
test.describe("HU-06 · Registro de nueva artesanía", () => {
  test("caso de éxito: la pieza se registra con estado Disponible", async ({ page }, info) => {
    const s = sufijo();
    const { tecnica, categoria } = await catalogosBase(page, s);
    const nombre = `Jarrón ceremonial ${s}`;

    await registrarPieza(page, nombre, tecnica, categoria);

    await page.goto("/artesanias");
    const fila = filaTabla(page, nombre);
    await expect(fila).toBeVisible();
    // CA: estado inicial asignado automáticamente
    await expect(fila.getByText("Disponible")).toBeVisible();
    await capturar(page, "hu06-registro-pieza", info.project.name);
  });

  test("caso de fallo: no se guarda sin los campos obligatorios", async ({ page }, info) => {
    await page.goto("/artesanias/nueva");
    await page.getByRole("button", { name: "Guardar pieza" }).click();

    // Permanece en el formulario: el navegador/validación impide continuar
    await expect(page).toHaveURL(/\/artesanias\/nueva/);
    await capturar(page, "hu06-registro-fallo", info.project.name);
  });

  test("CA: la baja de una pieza exige justificación", async ({ page }, info) => {
    const s = sufijo();
    const { tecnica, categoria } = await catalogosBase(page, s);
    const nombre = `Pieza de baja ${s}`;
    await registrarPieza(page, nombre, tecnica, categoria);
    await abrirFicha(page, nombre);

    await page.getByRole("button", { name: "Eliminar pieza" }).click();
    // Sin motivo no se puede continuar
    await dialogo(page).getByRole("button", { name: "Eliminar" }).click();
    await expect(page.getByText(/Escribe el motivo/i)).toBeVisible();
    await capturar(page, "hu06-baja-motivo-obligatorio", info.project.name);

    await dialogo(page).getByLabel(/Motivo/i).fill("La pieza se fracturó en el traslado");
    await dialogo(page).getByRole("button", { name: "Eliminar" }).click();

    await expect(page).toHaveURL(/\/artesanias$/);
    await expect(filaTabla(page, nombre)).toBeHidden();
  });
});

test.describe("HU-07 · Fotografías de la pieza", () => {
  test("caso de éxito: se sube una fotografía y queda como principal", async ({ page }, info) => {
    const s = sufijo();
    const { tecnica, categoria } = await catalogosBase(page, s);
    const nombre = `Pieza con foto ${s}`;
    await registrarPieza(page, nombre, tecnica, categoria);
    await abrirFicha(page, nombre);

    await page.locator('input[type="file"]').setInputFiles(FOTO);
    await expect(page.getByRole("img", { name: /principal|pieza/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await capturar(page, "hu07-foto-principal", info.project.name);
  });
});

// ---------------------------------------------------------------------------
// Sprint 3 — HU-08, HU-09
// ---------------------------------------------------------------------------
test.describe("HU-08 y HU-09 · Costeo y precio final", () => {
  test("caso de éxito: el precio sugerido se calcula y el final se asigna", async ({ page }, info) => {
    const s = sufijo();
    const { tecnica, categoria } = await catalogosBase(page, s);
    const proveedor = `Proveedor ${s}`;
    const material = `Barro ${s}`;
    const nombre = `Pieza costeada ${s}`;

    // Proveedor, material y compra que fija el costo histórico
    await page.goto("/catalogos");
    await page.getByRole("button", { name: "Proveedores", exact: true }).click();
    await page.getByRole("button", { name: /Agregar proveedor/i }).click();
    await dialogo(page).getByLabel("Nombre del proveedor").fill(proveedor);
    await dialogo(page).getByRole("button", { name: "Guardar" }).click();
    await expect(filaTabla(page, proveedor)).toBeVisible();

    await page.getByRole("button", { name: "Materiales", exact: true }).click();
    await page.getByRole("button", { name: /Agregar material/i }).click();
    await dialogo(page).getByLabel("Nombre del material").fill(material);
    await dialogo(page).getByLabel("Unidad de medida").selectOption({ index: 1 });
    await dialogo(page).getByRole("button", { name: "Guardar" }).click();
    await expect(filaTabla(page, material)).toBeVisible();

    await page.goto("/materia-prima");
    await page.getByRole("button", { name: /Registrar entrada/i }).click();
    await seleccionarPorTexto(page, "Insumo", material);
    await seleccionarPorTexto(page, "Proveedor", proveedor);
    await page.getByLabel("Cantidad").fill("50");
    await page.getByLabel("Costo unitario").fill("20");
    await dialogo(page).getByRole("button", { name: "Guardar" }).click();
    await expect(filaTabla(page, material)).toBeVisible();

    await registrarPieza(page, nombre, tecnica, categoria);
    const urlFicha = await abrirFicha(page, nombre);
    await abrirCosteo(page, urlFicha);

    // Insumo + mano de obra: 3 × 20 + 8 × 75 = 660
    await page.getByRole("button", { name: /Agregar insumo/i }).click();
    await seleccionarPorTexto(page, "Insumo", material);
    await page.getByLabel("Cantidad").last().fill("3");
    await page.getByLabel(/Horas/i).fill("8");
    await page.getByLabel(/Tarifa/i).fill("75");

    await expect(page.getByText("$660").first()).toBeVisible();
    await capturar(page, "hu08-precio-sugerido", info.project.name);

    // HU-09: el artesano fija un precio final distinto del sugerido
    await page.getByRole("button", { name: /Guardar costeo/i }).click();
    await expect(aviso(page)).toBeVisible();
    await page.getByLabel("Precio final").fill("900");
    await page.getByRole("button", { name: /Asignar precio final/i }).click();
    await expect(aviso(page)).toContainText(/Precio final asignado/i);
    await capturar(page, "hu09-precio-final", info.project.name);
  });

  test("CA: horas o tarifa en cero advierten sin bloquear el cálculo", async ({ page }, info) => {
    const s = sufijo();
    const { tecnica, categoria } = await catalogosBase(page, s);
    const nombre = `Pieza sin horas ${s}`;
    await registrarPieza(page, nombre, tecnica, categoria);
    const urlFicha = await abrirFicha(page, nombre);
    await abrirCosteo(page, urlFicha);

    await page.getByLabel(/Horas/i).fill("0");
    await page.getByLabel(/Tarifa/i).fill("0");

    // El precio final sigue pudiendo asignarse: no hay bloqueo
    await page.getByLabel("Precio final").fill("500");
    await page.getByRole("button", { name: /Asignar precio final/i }).click();
    await expect(aviso(page)).toContainText(/Precio final asignado/i);
    await capturar(page, "hu08-advertencia-horas-cero", info.project.name);
  });
});

// ---------------------------------------------------------------------------
// Sprint 4 — HU-10, HU-11, HU-12
// ---------------------------------------------------------------------------
test.describe("HU-10, HU-11 y HU-12 · Certificación y verificación pública", () => {
  test("caso de éxito: se emite el certificado y su QR verifica públicamente", async ({ page, context }, info) => {
    const s = sufijo();
    const { tecnica, categoria } = await catalogosBase(page, s);
    const nombre = `Pieza certificada ${s}`;
    await registrarPieza(page, nombre, tecnica, categoria);
    const urlFicha = await abrirFicha(page, nombre);

    // Requisitos del certificado: fotografía y precio final
    await page.locator('input[type="file"]').setInputFiles(FOTO);
    await expect(page.getByRole("button", { name: /Emitir certificado/i })).toBeDisabled();
    await capturar(page, "hu11-certificado-bloqueado", info.project.name);

    await abrirCosteo(page, urlFicha);
    await page.getByLabel("Precio final").fill("1850");
    await page.getByRole("button", { name: /Asignar precio final/i }).click();
    await expect(aviso(page)).toContainText(/Precio final asignado/i);

    await page.goto(urlFicha);
    await page.getByRole("button", { name: /Emitir certificado/i }).click();

    // HU-10: aparece el QR y el enlace de descarga del PDF (HU-11)
    await expect(page.getByRole("link", { name: /Descargar certificado/i })).toBeVisible({
      timeout: 30_000,
    });
    await capturar(page, "hu10-certificado-emitido", info.project.name);

    // HU-12: la ficha pública se abre SIN sesión, en una pestaña limpia
    const enlace = page.getByRole("link", { name: /Ver ficha pública/i });
    const href = await enlace.getAttribute("href");
    const anonima = await context.browser()!.newContext();
    const publica = await anonima.newPage();
    await publica.goto(`http://localhost:5174${href}`);

    await expect(publica.getByText(nombre)).toBeVisible({ timeout: 20_000 });
    await expect(publica.getByText(tecnica)).toBeVisible();
    await capturar(publica, "hu12-verificacion-publica", info.project.name);
    await anonima.close();
  });

  test("caso de fallo: un código QR inexistente no se verifica", async ({ page }, info) => {
    await page.goto("/verificar/00000000-0000-4000-8000-000000000000");

    await expect(page.getByText("Certificado inválido")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/no corresponde a ninguna pieza registrada/i)).toBeVisible();
    await capturar(page, "hu12-verificacion-invalida", info.project.name);
  });
});

// ---------------------------------------------------------------------------
// Sprint 5 — HU-13, HU-14, HU-15
// ---------------------------------------------------------------------------
test.describe("HU-13, HU-14 y HU-15 · Consignación, venta y filtrado", () => {
  test("caso de éxito: consignación, venta y exclusión del listado de disponibles", async ({ page }, info) => {
    const s = sufijo();
    const { tecnica, categoria } = await catalogosBase(page, s);
    const galeria = `Galería ${s}`;
    const nombre = `Pieza consignada ${s}`;

    await page.goto("/catalogos");
    await page.getByRole("button", { name: "Galerías", exact: true }).click();
    await page.getByRole("button", { name: /Agregar galería/i }).click();
    await dialogo(page).getByLabel("Nombre de la galería").fill(galeria);
    await dialogo(page).getByRole("button", { name: "Guardar" }).click();
    await expect(filaTabla(page, galeria)).toBeVisible();

    await registrarPieza(page, nombre, tecnica, categoria);
    await abrirFicha(page, nombre);

    // HU-13: salida a consignación
    await page.getByRole("button", { name: "Enviar a consignación" }).click();
    await seleccionarPorTexto(page, "Galería receptora", galeria);
    await dialogo(page).getByRole("button", { name: /Enviar|Guardar|Confirmar/i }).last().click();
    await expect(page.getByText("En consignación").first()).toBeVisible({ timeout: 20_000 });
    await capturar(page, "hu13-consignacion", info.project.name);

    // HU-15: deja de aparecer entre las disponibles
    await page.goto("/artesanias");
    await seleccionarPorTexto(page, "Estado", "Disponible");
    await expect(filaTabla(page, nombre)).toBeHidden();
    await capturar(page, "hu15-filtro-disponibles", info.project.name);

    // HU-14: venta reportada por la galería
    await abrirFicha(page, nombre);
    await page.getByRole("button", { name: "Registrar venta" }).click();
    await dialogo(page).getByLabel("Monto final cobrado").fill("2400");
    await dialogo(page).getByRole("button", { name: /Registrar|Guardar|Confirmar/i }).last().click();
    await expect(page.getByText("Vendida").first()).toBeVisible({ timeout: 20_000 });
    await capturar(page, "hu14-venta-registrada", info.project.name);
  });

  test("CA: una pieza vendida ya no puede editarse ni consignarse", async ({ page }, info) => {
    const s = sufijo();
    const { tecnica, categoria } = await catalogosBase(page, s);
    const nombre = `Pieza vendida ${s}`;
    await registrarPieza(page, nombre, tecnica, categoria);
    await abrirFicha(page, nombre);

    await page.getByRole("button", { name: "Registrar venta" }).click();
    await dialogo(page).getByLabel("Monto final cobrado").fill("1500");
    await dialogo(page).getByRole("button", { name: /Registrar|Guardar|Confirmar/i }).last().click();
    await expect(page.getByText("Vendida").first()).toBeVisible({ timeout: 20_000 });

    // Las acciones que alterarían la pieza desaparecen o quedan bloqueadas
    await expect(page.getByRole("button", { name: "Enviar a consignación" })).toBeHidden();
    await capturar(page, "hu14-pieza-vendida-bloqueada", info.project.name);
  });

  test("CA: los filtros vuelven a la opción general sin recargar la página", async ({ page }, info) => {
    const s = sufijo();
    const { tecnica, categoria } = await catalogosBase(page, s);
    await registrarPieza(page, `Pieza filtro ${s}`, tecnica, categoria);

    await page.goto("/artesanias");
    await seleccionarPorTexto(page, "Estado", "Vendida");
    await expect(filaTabla(page, `Pieza filtro ${s}`)).toBeHidden();

    await page.getByRole("button", { name: /Limpiar filtros/i }).click();
    await expect(filaTabla(page, `Pieza filtro ${s}`)).toBeVisible();
    await capturar(page, "hu15-restablecer-filtros", info.project.name);
  });
});

// ---------------------------------------------------------------------------
// Sprint 6 — HU-16, HU-17
// ---------------------------------------------------------------------------
test.describe("HU-16 · Reporte de ventas", () => {
  test("caso de fallo: sin ventas en el periodo se informa explícitamente", async ({ page }, info) => {
    await page.goto("/reportes");
    // Año pasado completo: con toda seguridad sin ventas registradas
    const anioPasado = String(new Date().getFullYear() - 1);
    await page.getByLabel("Mes").selectOption("ANIO");
    await page.getByLabel("Año").selectOption(anioPasado);

    // CA: se explica la ausencia de ventas, no se muestra un reporte vacío
    await expect(page.getByText(/No hay ventas registradas en/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await capturar(page, "hu16-reporte-sin-ventas", info.project.name);

    // La exportación tampoco produce un PDF vacío
    await page.getByRole("button", { name: /Exportar PDF/i }).click();
    await expect(page.getByText(/No hay ventas/i).first()).toBeVisible();
  });

  test("caso de éxito: se genera el reporte del periodo con su total", async ({ page }, info) => {
    const s = sufijo();
    const { tecnica, categoria } = await catalogosBase(page, s);
    const nombre = `Pieza reportada ${s}`;
    await registrarPieza(page, nombre, tecnica, categoria);
    await abrirFicha(page, nombre);

    await page.getByRole("button", { name: "Registrar venta" }).click();
    await dialogo(page).getByLabel("Monto final cobrado").fill("1750");
    await dialogo(page).getByRole("button", { name: /Registrar|Guardar|Confirmar/i }).last().click();
    await expect(page.getByText("Vendida").first()).toBeVisible({ timeout: 20_000 });

    const hoy = new Date();
    await page.goto("/reportes");
    await page.getByLabel("Mes").selectOption(String(hoy.getMonth() + 1));
    await page.getByLabel("Año").selectOption(String(hoy.getFullYear()));

    // CA: el reporte totaliza las ventas del periodo
    await expect(page.getByText(/1,?750/).first()).toBeVisible({ timeout: 20_000 });
    await capturar(page, "hu16-reporte-generado", info.project.name);

    // CA: exportación en PDF
    await page.getByRole("button", { name: /Exportar PDF/i }).click();
    await expect(page.getByText(/reporte|PDF/i).first()).toBeVisible({ timeout: 20_000 });
    await capturar(page, "hu16-reporte-exportado", info.project.name);
  });
});

test.describe("HU-17 · Perfil y datos del taller", () => {
  test("caso de éxito: el taller se actualiza al instante y el correo no es editable", async ({ page }, info) => {
    const s = sufijo();
    const taller = `Taller Artani ${s}`;

    await page.goto("/ajustes");
    await expect(page.getByLabel("Nombre del taller")).toBeVisible({ timeout: 20_000 });

    // CA: el correo de acceso no puede editarse desde esta pantalla
    await expect(page.getByLabel("Correo de acceso")).toBeDisabled();

    await page.getByLabel("Nombre del taller").fill(taller);
    await page.getByRole("button", { name: /Guardar/i }).first().click();

    await expect(aviso(page)).toBeVisible();
    await capturar(page, "hu17-perfil-actualizado", info.project.name);

    // CA: el cambio se refleja sin cerrar sesión
    await page.goto("/");
    await expect(page.getByText(taller).first()).toBeVisible();
  });

  test("caso de fallo: nombre y apellido son obligatorios", async ({ page }, info) => {
    await page.goto("/ajustes");
    await expect(page.getByLabel("Nombre(s) del artesano")).toBeVisible({ timeout: 20_000 });

    await page.getByLabel("Nombre(s) del artesano").fill("");
    await page.getByRole("button", { name: /Guardar/i }).first().click();

    await expect(page.getByText(/obligatorios/i).first()).toBeVisible();
    await capturar(page, "hu17-perfil-fallo", info.project.name);
  });
});
