import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { expect, type Locator, type Page } from "@playwright/test";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DIR_CAPTURAS = path.join(RAIZ, "capturas");

export const CORREO = "artesano@artani.mx";
export const CONTRASENA = "Artani#2026";

/**
 * Guarda la captura que respalda el resultado clave de la prueba.
 * Solo se conserva la de Chromium: Firefox corre el mismo flujo para verificar
 * la portabilidad (RNF_004), no para duplicar la evidencia del informe.
 */
export async function capturar(page: Page, nombre: string, proyecto: string): Promise<void> {
  if (proyecto !== "chromium") return;
  mkdirSync(DIR_CAPTURAS, { recursive: true });
  await page.screenshot({ path: path.join(DIR_CAPTURAS, `${nombre}.png`), fullPage: true });
}

/** Inicia sesión con el artesano sembrado y espera el panel. */
export async function iniciarSesion(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(CORREO);
  await page.getByLabel("Contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/$|\/#?$/, { timeout: 20_000 });
}

/** Crea un elemento de catálogo por interfaz y devuelve su nombre. */
export async function crearTecnica(page: Page, nombre: string): Promise<string> {
  await page.goto("/catalogos");
  await page.getByRole("button", { name: /nueva técnica|agregar técnica/i }).first().click();
  await page.getByLabel("Nombre").fill(nombre);
  await page.getByRole("button", { name: /guardar|crear/i }).click();
  await expect(page.getByText(nombre).first()).toBeVisible();
  return nombre;
}

/**
 * Fila de la tabla que contiene el texto indicado. Acota la búsqueda al listado
 * para no confundirla con el mismo texto dentro del Snackbar de confirmación.
 */
export function filaTabla(page: Page, texto: string): Locator {
  return page.locator("tbody tr").filter({ hasText: texto }).first();
}

/**
 * Selecciona en un `<select>` la opción cuyo texto contiene `texto`.
 * Las etiquetas incluyen sufijos (unidad abreviada, etc.), por lo que no puede
 * usarse una coincidencia exacta.
 */
export async function seleccionarPorTexto(
  page: Page,
  etiqueta: string,
  texto: string,
): Promise<void> {
  const select = page.getByLabel(etiqueta);
  const valor = await select.locator("option").filter({ hasText: texto }).first().getAttribute("value");
  if (!valor) throw new Error(`No hay opción que contenga «${texto}» en «${etiqueta}»`);
  await select.selectOption(valor);
}

/**
 * Aviso Snackbar visible. Durante la transición de salida pueden coexistir dos
 * nodos, por lo que se toma el último (el más reciente).
 */
export function aviso(page: Page): Locator {
  return page.locator(".snackbar").last();
}

/** Diálogo modal abierto (alta, edición o confirmación). */
export function dialogo(page: Page): Locator {
  return page.getByRole("dialog");
}

/** Confirma un diálogo destructivo, capturando el motivo cuando es obligatorio. */
export async function confirmarEliminacion(page: Page, motivo?: string): Promise<void> {
  const modal = dialogo(page);
  await expect(modal).toBeVisible();
  if (motivo) {
    await modal.getByLabel(/motivo/i).fill(motivo);
  }
  await modal.getByRole("button", { name: "Eliminar" }).click();
}

/** Sufijo único para no colisionar entre corridas y navegadores. */
export function sufijo(): string {
  return Math.random().toString(36).slice(2, 7);
}
