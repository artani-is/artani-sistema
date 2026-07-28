import { test, expect } from "@playwright/test";
import {
  capturar,
  iniciarSesion,
  sufijo,
  filaTabla,
  seleccionarPorTexto,
  aviso,
  dialogo,
} from "./apoyo.js";

test.beforeEach(async ({ page }) => {
  await iniciarSesion(page);
});

test.describe("HU-02 · Alta de catálogos maestros", () => {
  test("caso de éxito: se agrega una técnica y aparece en el catálogo", async ({ page }, info) => {
    const nombre = `Barro negro ${sufijo()}`;
    await page.goto("/catalogos");

    await page.getByRole("button", { name: /Agregar técnica/i }).click();
    await dialogo(page).getByLabel("Nombre de la técnica").fill(nombre);
    await dialogo(page).getByLabel("Descripción").fill("Alfarería de San Bartolo Coyotepec");
    await dialogo(page).getByRole("button", { name: "Guardar" }).click();

    await expect(filaTabla(page, nombre)).toBeVisible();
    // RNF_002: confirmación por Snackbar con acción Deshacer
    await expect(aviso(page)).toContainText("Se agregó la técnica");
    await capturar(page, "hu02-alta-tecnica", info.project.name);
  });

  test("caso de fallo: el nombre es obligatorio", async ({ page }, info) => {
    await page.goto("/catalogos");
    await page.getByRole("button", { name: /Agregar categoría/i }).first().isVisible().catch(() => {});

    // Pestaña de categorías
    await page.getByRole("button", { name: "Categorías", exact: true }).click();
    await page.getByRole("button", { name: /Agregar categoría/i }).click();
    await dialogo(page).getByRole("button", { name: "Guardar" }).click();

    // El modal sigue abierto y se informa el campo faltante
    await expect(page.getByText(/obligatorio/i).first()).toBeVisible();
    await capturar(page, "hu02-alta-fallo", info.project.name);
  });
});

test.describe("HU-03 · Edición de catálogos maestros", () => {
  test("caso de éxito: se edita el nombre y se refleja en el listado", async ({ page }, info) => {
    const original = `Telar ${sufijo()}`;
    const corregido = `${original} corregido`;
    await page.goto("/catalogos");

    await page.getByRole("button", { name: /Agregar técnica/i }).click();
    await dialogo(page).getByLabel("Nombre de la técnica").fill(original);
    await dialogo(page).getByRole("button", { name: "Guardar" }).click();
    await expect(filaTabla(page, original)).toBeVisible();

    await filaTabla(page, original).getByTitle("Editar").click();
    await dialogo(page).getByLabel("Nombre de la técnica").fill(corregido);
    await dialogo(page).getByRole("button", { name: "Guardar" }).click();

    await expect(filaTabla(page, corregido)).toBeVisible();
    await expect(aviso(page)).toContainText("Se actualizó la técnica");
    await capturar(page, "hu03-edicion-tecnica", info.project.name);
  });
});

test.describe("HU-04 · Eliminación de catálogos maestros", () => {
  test("caso de éxito: se elimina un elemento sin vínculos y se ofrece Deshacer", async ({ page }, info) => {
    const nombre = `Hojalata ${sufijo()}`;
    await page.goto("/catalogos");

    await page.getByRole("button", { name: /Agregar técnica/i }).click();
    await dialogo(page).getByLabel("Nombre de la técnica").fill(nombre);
    await dialogo(page).getByRole("button", { name: "Guardar" }).click();
    await expect(filaTabla(page, nombre)).toBeVisible();

    // CAM-014: los catálogos no exigen justificación, se eliminan directo con «Deshacer»
    await filaTabla(page, nombre).getByTitle("Eliminar").click();

    await expect(aviso(page)).toContainText("Se eliminó la técnica");
    // CA: la operación reversible ofrece Deshacer
    await expect(aviso(page).getByRole("button", { name: "Deshacer" })).toBeVisible();
    await capturar(page, "hu04-eliminacion-deshacer", info.project.name);
  });

  test("caso de fallo: no se elimina una técnica vinculada a una pieza", async ({ page }, info) => {
    const s = sufijo();
    const tecnica = `Vinculada ${s}`;
    const categoria = `Cat ${s}`;

    // Catálogos base
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

    // Pieza que usa la técnica
    await page.goto("/artesanias/nueva");
    await page.getByLabel("Nombre de la pieza").fill(`Pieza ${s}`);
    await seleccionarPorTexto(page, "Técnica", tecnica);
    await seleccionarPorTexto(page, "Categoría", categoria);
    await page.getByRole("button", { name: "Guardar pieza" }).click();
    await expect(page).toHaveURL(/\/artesanias/);

    // Intento de eliminar la técnica en uso
    await page.goto("/catalogos");
    const fila = filaTabla(page, tecnica);

    // La interfaz impide la acción: el botón de baja queda deshabilitado y la
    // fila indica cuántos registros dependen del elemento.
    await expect(fila.getByTitle("Eliminar")).toBeDisabled();
    await expect(fila.getByText(/1 pieza/i)).toBeVisible();
    await capturar(page, "hu04-eliminacion-bloqueada", info.project.name);
  });
});

test.describe("HU-05 · Proveedores y compras de materia prima", () => {
  test("caso de éxito: se registra una compra con proveedor y material", async ({ page }, info) => {
    const s = sufijo();
    const proveedor = `Alfarería ${s}`;
    const material = `Barro crudo ${s}`;

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

    // Compra
    await page.goto("/materia-prima");
    await page.getByRole("button", { name: /Registrar entrada/i }).click();
    // La etiqueta del selector incluye la unidad abreviada (CAM-011)
    await seleccionarPorTexto(page, "Insumo", material);
    await seleccionarPorTexto(page, "Proveedor", proveedor);
    await page.getByLabel("Cantidad").fill("25");
    await page.getByLabel("Costo unitario").fill("18.50");
    await dialogo(page).getByRole("button", { name: "Guardar" }).click();

    await expect(filaTabla(page, material)).toBeVisible();
    await capturar(page, "hu05-compra-registrada", info.project.name);
  });

  test("caso de fallo: cantidad y costo deben ser mayores a cero", async ({ page }, info) => {
    const s = sufijo();
    const proveedor = `Proveedor ${s}`;
    const material = `Material ${s}`;

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
    await page.getByLabel("Insumo").selectOption({ index: 1 });
    await seleccionarPorTexto(page, "Proveedor", proveedor);
    await page.getByLabel("Cantidad").fill("0");
    await page.getByLabel("Costo unitario").fill("0");
    await dialogo(page).getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText(/mayor(es)? a cero/i).first()).toBeVisible();
    await capturar(page, "hu05-compra-fallo", info.project.name);
  });
});
