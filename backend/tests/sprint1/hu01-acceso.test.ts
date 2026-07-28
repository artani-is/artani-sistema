import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, auth, crearArtesanoAutenticado, CORREO_PRUEBA, CONTRASENA_PRUEBA } from "../helpers/api.js";

describe("HU-01 · Acceso al sistema (Login)", () => {
  beforeEach(async () => {
    await limpiarBaseDatos();
  });

  it("caso de éxito: credenciales válidas devuelven token JWT y datos del artesano", async () => {
    await crearArtesanoAutenticado();

    const res = await api()
      .post("/api/auth/login")
      .send({ correo: CORREO_PRUEBA, contrasena: CONTRASENA_PRUEBA });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.artesano.correo).toBe(CORREO_PRUEBA);
    // El hash de la contraseña nunca debe viajar en la respuesta
    expect(JSON.stringify(res.body)).not.toContain("contrasenaHash");
  });

  it("caso de fallo: contraseña incorrecta devuelve 401 con mensaje genérico", async () => {
    await crearArtesanoAutenticado();

    const res = await api()
      .post("/api/auth/login")
      .send({ correo: CORREO_PRUEBA, contrasena: "ContrasenaEquivocada1!" });

    expect(res.status).toBe(401);
    // CA: mensaje genérico, sin indicar si falló el correo o la contraseña
    expect(res.body.error).toBe("Correo o contraseña incorrectos");
  });

  it("caso de fallo: correo inexistente devuelve el mismo mensaje genérico que la contraseña incorrecta", async () => {
    await crearArtesanoAutenticado();

    const resCorreoMalo = await api()
      .post("/api/auth/login")
      .send({ correo: "nadie@artani.mx", contrasena: CONTRASENA_PRUEBA });
    const resPassMala = await api()
      .post("/api/auth/login")
      .send({ correo: CORREO_PRUEBA, contrasena: "otra" });

    expect(resCorreoMalo.status).toBe(401);
    // CA: el atacante no puede distinguir qué campo falló (enumeración de usuarios)
    expect(resCorreoMalo.body.error).toBe(resPassMala.body.error);
  });

  it("CA: tras 5 intentos fallidos consecutivos la cuenta se bloquea 15 minutos (423)", async () => {
    await crearArtesanoAutenticado();

    for (let i = 0; i < 5; i++) {
      const fallo = await api()
        .post("/api/auth/login")
        .send({ correo: CORREO_PRUEBA, contrasena: `mala-${i}` });
      expect(fallo.status).toBe(401);
    }

    // El sexto intento, incluso con la contraseña CORRECTA, debe bloquearse
    const bloqueado = await api()
      .post("/api/auth/login")
      .send({ correo: CORREO_PRUEBA, contrasena: CONTRASENA_PRUEBA });

    expect(bloqueado.status).toBe(423);
    expect(bloqueado.body.error).toMatch(/bloqueada temporalmente/i);
  });

  it("CA: el bloqueo caduca pasada la ventana de 15 minutos", async () => {
    const sesion = await crearArtesanoAutenticado();

    for (let i = 0; i < 5; i++) {
      await api().post("/api/auth/login").send({ correo: CORREO_PRUEBA, contrasena: "mala" });
    }
    expect(
      (await api().post("/api/auth/login").send({ correo: CORREO_PRUEBA, contrasena: CONTRASENA_PRUEBA })).status,
    ).toBe(423);

    // Se envejecen los intentos más allá de la ventana de 15 min
    await prisma.intentoAcceso.updateMany({
      where: { idArtesano: sesion.idArtesano },
      data: { fechaHora: new Date(Date.now() - 16 * 60 * 1000) },
    });

    const res = await api()
      .post("/api/auth/login")
      .send({ correo: CORREO_PRUEBA, contrasena: CONTRASENA_PRUEBA });
    expect(res.status).toBe(200);
  });

  it("CA: un intento exitoso intercalado impide el bloqueo (no son 5 consecutivos)", async () => {
    await crearArtesanoAutenticado();

    for (let i = 0; i < 4; i++) {
      await api().post("/api/auth/login").send({ correo: CORREO_PRUEBA, contrasena: "mala" });
    }
    // Éxito intercalado
    expect(
      (await api().post("/api/auth/login").send({ correo: CORREO_PRUEBA, contrasena: CONTRASENA_PRUEBA })).status,
    ).toBe(200);
    for (let i = 0; i < 4; i++) {
      await api().post("/api/auth/login").send({ correo: CORREO_PRUEBA, contrasena: "mala" });
    }

    const res = await api()
      .post("/api/auth/login")
      .send({ correo: CORREO_PRUEBA, contrasena: CONTRASENA_PRUEBA });
    expect(res.status).toBe(200);
  });

  it("caso de fallo: petición sin correo devuelve 400", async () => {
    const res = await api().post("/api/auth/login").send({ contrasena: CONTRASENA_PRUEBA });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/correo es obligatorio/i);
  });

  it("caso de fallo: ruta protegida sin token devuelve 401", async () => {
    const res = await api().get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Se requiere autenticación");
  });

  it("caso de fallo: ruta protegida con token manipulado devuelve 401", async () => {
    const sesion = await crearArtesanoAutenticado();
    const tokenRoto = `${sesion.token.slice(0, -4)}aaaa`;

    const res = await api().get("/api/auth/me").set("Authorization", `Bearer ${tokenRoto}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Sesión inválida o expirada");
  });

  it("caso de éxito: el token emitido da acceso al perfil propio", async () => {
    const sesion = await crearArtesanoAutenticado();

    const res = await api().get("/api/auth/me").set(...auth(sesion));
    expect(res.status).toBe(200);
    expect(res.body.correo).toBe(CORREO_PRUEBA);
    expect(res.body).not.toHaveProperty("contrasenaHash");
  });

  it("RNF_005: la contraseña se almacena como hash bcrypt, nunca en texto claro", async () => {
    await crearArtesanoAutenticado();

    const registro = await prisma.artesano.findUniqueOrThrow({ where: { correo: CORREO_PRUEBA } });

    // Formato bcrypt: $2a$/$2b$ + coste + sal/hash de 53 caracteres
    expect(registro.contrasenaHash).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
    expect(registro.contrasenaHash).not.toContain(CONTRASENA_PRUEBA);
    // El hash es verificable contra la contraseña original
    await expect(bcrypt.compare(CONTRASENA_PRUEBA, registro.contrasenaHash)).resolves.toBe(true);
  });
});
