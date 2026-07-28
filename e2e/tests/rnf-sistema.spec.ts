import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { capturar, iniciarSesion } from "./apoyo.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARCHIVO_MEDICIONES = path.join(RAIZ, "resultados", "mediciones-e2e.jsonl");

function registrar(rnf: string, descripcion: string, tiempos: number[], umbral?: number) {
  const medicion = {
    rnf,
    descripcion,
    unidad: "ms",
    muestras: tiempos.length,
    promedio: Number((tiempos.reduce((s, t) => s + t, 0) / tiempos.length).toFixed(2)),
    maximo: Number(Math.max(...tiempos).toFixed(2)),
    minimo: Number(Math.min(...tiempos).toFixed(2)),
    ...(umbral !== undefined ? { umbral } : {}),
  };
  mkdirSync(path.dirname(ARCHIVO_MEDICIONES), { recursive: true });
  appendFileSync(ARCHIVO_MEDICIONES, `${JSON.stringify(medicion)}\n`);
  console.log(
    `[${rnf}] ${descripcion} — n=${medicion.muestras} prom=${medicion.promedio}ms máx=${medicion.maximo}ms`,
  );
  return medicion;
}

// ---------------------------------------------------------------------------
// RNF_004 · Portabilidad entre navegadores
// ---------------------------------------------------------------------------
test.describe("RNF_004 · Portabilidad entre navegadores", () => {
  test("el sistema opera igual en el navegador bajo prueba", async ({ page }, info) => {
    await iniciarSesion(page);

    // Recorrido por las vistas principales: todas deben renderizar sin error
    for (const [ruta, encabezado] of [
      ["/", /panel|inicio|resumen|artani/i],
      ["/artesanias", /inventario/i],
      ["/catalogos", /catálogos/i],
      ["/materia-prima", /materia prima/i],
      ["/reportes", /reporte de ventas/i],
      ["/ajustes", /ajustes|perfil/i],
    ] as const) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { name: encabezado }).first()).toBeVisible({
        timeout: 20_000,
      });
    }

    await capturar(page, `rnf004-portabilidad-${info.project.name}`, "chromium");
    // La captura de Firefox se guarda con su propio nombre para la evidencia
    if (info.project.name === "firefox") {
      await page.screenshot({
        path: path.join(RAIZ, "capturas", "rnf004-portabilidad-firefox.png"),
        fullPage: true,
      });
    }
  });

  test("la verificación pública funciona sin sesión en el navegador bajo prueba", async ({ page }) => {
    await page.goto("/verificar/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("Certificado inválido")).toBeVisible({ timeout: 20_000 });
  });
});

// ---------------------------------------------------------------------------
// RNF_008 · Adaptabilidad (responsive)
// ---------------------------------------------------------------------------
test.describe("RNF_008 · Adaptabilidad a tablet y escritorio", () => {
  /** Desbordamiento horizontal del documento, en píxeles. */
  async function desbordamiento(page: import("@playwright/test").Page): Promise<number> {
    return page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }

  test("el inventario se adapta a escritorio (1440 px) sin desbordamiento", async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await iniciarSesion(page);
    await page.goto("/artesanias");
    await expect(page.getByRole("heading", { name: /inventario/i })).toBeVisible();

    expect(await desbordamiento(page)).toBeLessThanOrEqual(1);
    await capturar(page, "rnf008-escritorio-1440", info.project.name);
  });

  // DEFECTO CONFIRMADO (ambos navegadores): en las resoluciones de tablet el
  // contenido conserva un ancho mínimo mayor que el área visible y el documento
  // se desplaza en horizontal. Se marca como fallo esperado para dejar constancia
  // del incumplimiento sin ocultarlo.
  test("el inventario se adapta a tablet horizontal (1024 px) sin desbordamiento", async ({ page }, info) => {
    test.fail(true, "Defecto confirmado: desbordamiento horizontal a 1024 px");
    await page.setViewportSize({ width: 1024, height: 768 });
    await iniciarSesion(page);
    await page.goto("/artesanias");
    await expect(page.getByRole("heading", { name: /inventario/i })).toBeVisible();

    await capturar(page, "rnf008-tablet-1024", info.project.name);
    expect(await desbordamiento(page), "desbordamiento horizontal a 1024 px").toBeLessThanOrEqual(1);
  });

  test("el inventario se adapta a tablet vertical (768 px) sin desbordamiento", async ({ page }, info) => {
    test.fail(true, "Defecto confirmado: desbordamiento horizontal a 768 px");
    await page.setViewportSize({ width: 768, height: 1024 });
    await iniciarSesion(page);
    await page.goto("/artesanias");
    await expect(page.getByRole("heading", { name: /inventario/i })).toBeVisible();

    await capturar(page, "rnf008-tablet-768", info.project.name);
    expect(await desbordamiento(page), "desbordamiento horizontal a 768 px").toBeLessThanOrEqual(1);
  });

  test("caracterización: se miden los intervalos de ancho afectados", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Basta con caracterizarlo una vez");
    await iniciarSesion(page);

    const medidas: { ancho: number; exceso: number }[] = [];
    for (const ancho of [1440, 1280, 1151, 1150, 1024, 1023, 900, 887, 886, 800, 768, 767, 600]) {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto("/artesanias");
      await page.getByRole("heading", { name: /inventario/i }).waitFor();
      medidas.push({ ancho, exceso: await desbordamiento(page) });
    }
    console.log(
      "[RNF_008] exceso horizontal por ancho: " +
        medidas.map((m) => `${m.ancho}px→${m.exceso}px`).join(", "),
    );

    // Los anchos por debajo del punto de quiebre md (<768) y los de escritorio
    // amplio (>=1151) no presentan desbordamiento
    expect(medidas.find((m) => m.ancho === 767)!.exceso).toBeLessThanOrEqual(1);
    expect(medidas.find((m) => m.ancho === 1440)!.exceso).toBeLessThanOrEqual(1);
    // En cambio, las resoluciones de tablet sí lo presentan
    expect(medidas.find((m) => m.ancho === 768)!.exceso).toBeGreaterThan(1);
    expect(medidas.find((m) => m.ancho === 1024)!.exceso).toBeGreaterThan(1);
  });

  test("la ficha pública del certificado se adapta a pantalla de teléfono", async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/verificar/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("Certificado inválido")).toBeVisible({ timeout: 20_000 });

    expect(await desbordamiento(page)).toBeLessThanOrEqual(1);
    await capturar(page, "rnf008-verificacion-movil", info.project.name);
  });
});

// ---------------------------------------------------------------------------
// RNF_003 · Tiempo de respuesta percibido en el navegador
// ---------------------------------------------------------------------------
test.describe("RNF_003 · Tiempo de respuesta en el navegador", () => {
  test("la carga del inventario se mantiene muy por debajo de 3 s (12 mediciones)", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Se mide una sola vez, en Chromium");
    await iniciarSesion(page);

    const tiempos: number[] = [];
    for (let i = 0; i < 12; i++) {
      const inicio = Date.now();
      await page.goto("/artesanias");
      await page.getByRole("heading", { name: /inventario/i }).waitFor();
      tiempos.push(Date.now() - inicio);
    }

    const m = registrar("RNF_003", "Carga de la vista de inventario (navegador)", tiempos, 3000);
    expect(m.promedio).toBeLessThan(3000);
    expect(m.maximo).toBeLessThan(3000);
  });

  test("la verificación pública del QR responde por debajo de 3 s (12 mediciones)", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Se mide una sola vez, en Chromium");

    const tiempos: number[] = [];
    for (let i = 0; i < 12; i++) {
      const inicio = Date.now();
      await page.goto("/verificar/00000000-0000-4000-8000-000000000000");
      await page.getByText("Certificado inválido").waitFor();
      tiempos.push(Date.now() - inicio);
    }

    const m = registrar("RNF_003", "Verificación pública del QR (navegador)", tiempos, 3000);
    expect(m.promedio).toBeLessThan(3000);
    expect(m.maximo).toBeLessThan(3000);
  });
});

// ---------------------------------------------------------------------------
// RNF_014 · Localización en español mexicano
// ---------------------------------------------------------------------------
test.describe("RNF_014 · Localización", () => {
  test("la interfaz y sus mensajes están en español", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();

    const texto = await page.locator("body").innerText();
    expect(texto).not.toMatch(/\b(Sign in|Password|Email|Submit|Loading)\b/);
  });
});
