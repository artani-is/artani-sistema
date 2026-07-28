import { test, expect } from "@playwright/test";
import { capturar, CORREO } from "./apoyo.js";

/**
 * HU-1: recuperación de contraseña, extremo a extremo.
 *
 * El correo real lo envía Resend, que no se invoca desde las pruebas: el token
 * se obtiene de la base de datos, que es donde queda su hash. Aquí se verifica
 * el recorrido del navegador, no el transporte del correo.
 */

test.describe("HU-01 · Recuperación de contraseña (interfaz)", () => {
  test("caso de éxito: se solicita el enlace desde el inicio de sesión", async ({ page }, info) => {
    await page.goto("/login");

    await page.getByRole("link", { name: /Olvidaste tu contraseña/i }).click();
    await expect(page).toHaveURL(/\/recuperar/);
    await expect(page.getByRole("heading", { name: "Recuperar contraseña" })).toBeVisible();

    // Sin correo válido no se puede enviar
    await expect(page.getByRole("button", { name: "Enviar enlace" })).toBeDisabled();

    await page.getByLabel("Correo electrónico").fill(CORREO);
    await expect(page.getByRole("button", { name: "Enviar enlace" })).toBeEnabled();
    await page.getByRole("button", { name: "Enviar enlace" }).click();

    await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible({
      timeout: 20_000,
    });
    // No se afirma que la cuenta exista
    await expect(page.getByText(/corresponde a una cuenta registrada/i)).toBeVisible();
    await capturar(page, "hu01-recuperacion-solicitud", info.project.name);
  });

  test("un correo no registrado recibe exactamente la misma respuesta", async ({ page }) => {
    await page.goto("/recuperar");
    await page.getByLabel("Correo electrónico").fill("nadie@ejemplo.mx");
    await page.getByRole("button", { name: "Enviar enlace" }).click();

    await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("CA: los requisitos de la contraseña se muestran y bloquean el envío", async ({ page }, info) => {
    await page.goto("/restablecer/token-cualquiera");

    await expect(page.getByRole("heading", { name: /Elige tu contraseña nueva/i })).toBeVisible();
    await expect(page.getByText("Al menos 12 caracteres")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar contraseña" })).toBeDisabled();

    await page.getByLabel("Contraseña nueva").fill("corta1");
    await expect(page.getByRole("button", { name: "Guardar contraseña" })).toBeDisabled();

    await page.getByLabel("Contraseña nueva").fill("MiNuevaClave2026");
    await page.getByLabel("Confirma la contraseña").fill("OtraCosa2026");
    await expect(page.getByText("Las contraseñas no coinciden")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar contraseña" })).toBeDisabled();

    await page.getByLabel("Confirma la contraseña").fill("MiNuevaClave2026");
    await expect(page.getByRole("button", { name: "Guardar contraseña" })).toBeEnabled();
    await capturar(page, "hu01-recuperacion-requisitos", info.project.name);
  });

  test("caso de fallo: un enlace inexistente ofrece solicitar uno nuevo", async ({ page }, info) => {
    await page.goto("/restablecer/token-que-nadie-emitio");

    await page.getByLabel("Contraseña nueva").fill("MiNuevaClave2026");
    await page.getByLabel("Confirma la contraseña").fill("MiNuevaClave2026");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();

    await expect(page.getByRole("heading", { name: /Este enlace ya no sirve/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /Solicitar un enlace nuevo/i })).toBeVisible();
    await capturar(page, "hu01-recuperacion-enlace-invalido", info.project.name);
  });

  test("RNF_008: ambas pantallas se adaptan a tablet sin desbordamiento horizontal", async ({ page }) => {
    for (const ancho of [1024, 768]) {
      await page.setViewportSize({ width: ancho, height: 900 });
      for (const ruta of ["/recuperar", "/restablecer/abc"]) {
        await page.goto(ruta);
        await page.getByRole("heading").first().waitFor();
        const exceso = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(exceso, `desbordamiento en ${ruta} a ${ancho}px`).toBeLessThanOrEqual(1);
      }
    }
  });
});
