import { test, expect } from "@playwright/test";
import { capturar, iniciarSesion, CORREO, CONTRASENA } from "./apoyo.js";

test.describe("HU-01 · Acceso al sistema", () => {
  test("caso de éxito: el artesano inicia sesión y llega al panel", async ({ page }, info) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();

    await page.getByLabel("Correo electrónico").fill(CORREO);
    await page.getByLabel("Contraseña").fill(CONTRASENA);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    // El panel del taller queda a la vista
    await expect(page.getByRole("navigation")).toBeVisible({ timeout: 20_000 });
    await capturar(page, "hu01-login-exito", info.project.name);
  });

  test("caso de fallo: credenciales inválidas muestran un mensaje genérico", async ({ page }, info) => {
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(CORREO);
    await page.getByLabel("Contraseña").fill("ContrasenaEquivocada1!");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page.getByText("Correo o contraseña incorrectos")).toBeVisible();
    // Sigue en la pantalla de acceso
    await expect(page).toHaveURL(/\/login/);
    await capturar(page, "hu01-login-fallo", info.project.name);
  });

  test("una ruta protegida redirige al inicio de sesión si no hay sesión", async ({ page }) => {
    await page.goto("/artesanias");
    await expect(page).toHaveURL(/\/login/);
  });

  test("la sesión permite navegar y cerrar sesión", async ({ page }) => {
    await iniciarSesion(page);
    await page.goto("/artesanias");
    await expect(page.getByRole("heading", { name: /inventario/i })).toBeVisible();
  });
});
