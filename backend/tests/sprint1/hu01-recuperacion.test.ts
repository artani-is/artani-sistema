import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api, crearArtesanoAutenticado, CORREO_PRUEBA, CONTRASENA_PRUEBA } from "../helpers/api.js";
import { usarTransporte, restablecerTransporte, type Correo } from "../../src/lib/correo.js";
import {
  hashDeToken,
  MAX_SOLICITUDES_POR_HORA,
  VIGENCIA_MINUTOS,
} from "../../src/services/recuperacion.service.js";

const CONTRASENA_NUEVA = "MiNuevaClave2026";

/** Correos capturados por el transporte de prueba. */
let enviados: Correo[] = [];

beforeEach(async () => {
  await limpiarBaseDatos();
  enviados = [];
  usarTransporte(async (correo) => {
    enviados.push(correo);
  });
});

afterEach(() => {
  restablecerTransporte();
});

/** Extrae el token del enlace incluido en el correo. */
function tokenDelCorreo(correo: Correo): string {
  const encontrado = /\/restablecer\/([A-Za-z0-9_-]+)/.exec(correo.texto);
  if (!encontrado) throw new Error("El correo no contiene un enlace de recuperación");
  return encontrado[1]!;
}

describe("HU-01 · Recuperación de contraseña — solicitud", () => {
  it("caso de éxito: envía el enlace al correo registrado y guarda el token hasheado", async () => {
    await crearArtesanoAutenticado();

    const res = await api().post("/api/auth/recuperacion").send({ correo: CORREO_PRUEBA });

    expect(res.status).toBe(202);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.para).toBe(CORREO_PRUEBA);
    expect(enviados[0]!.asunto).toMatch(/restablece/i);

    const token = tokenDelCorreo(enviados[0]!);
    const registro = await prisma.tokenRecuperacion.findUniqueOrThrow({
      where: { tokenHash: hashDeToken(token) },
    });

    // En base de datos solo vive el hash: el valor en claro no es recuperable
    expect(registro.tokenHash).toHaveLength(64);
    expect(registro.tokenHash).not.toContain(token);
    expect(registro.fechaUso).toBeNull();

    // Vigencia corta
    const minutos = (registro.fechaExpiracion.getTime() - Date.now()) / 60000;
    expect(minutos).toBeGreaterThan(VIGENCIA_MINUTOS - 2);
    expect(minutos).toBeLessThanOrEqual(VIGENCIA_MINUTOS);
  });

  it("el correo se envía desde no-reply@artani.app y enlaza a la base pública", async () => {
    await crearArtesanoAutenticado();
    const { REMITENTE } = await import("../../src/lib/correo.js");

    await api().post("/api/auth/recuperacion").send({ correo: CORREO_PRUEBA });

    expect(REMITENTE).toContain("no-reply@artani.app");
    expect(enviados[0]!.texto).toContain("http://localhost:5173/restablecer/");
  });

  it("CA: un correo desconocido responde igual que uno registrado y no envía nada", async () => {
    await crearArtesanoAutenticado();

    const conocido = await api().post("/api/auth/recuperacion").send({ correo: CORREO_PRUEBA });
    enviados = [];
    const desconocido = await api()
      .post("/api/auth/recuperacion")
      .send({ correo: "nadie@artani.mx" });

    // Misma respuesta: no se revela qué correos están registrados
    expect(desconocido.status).toBe(conocido.status);
    expect(desconocido.body).toEqual(conocido.body);
    expect(enviados).toHaveLength(0);
    expect(await prisma.tokenRecuperacion.count()).toBe(1);
  });

  it("no hay restricción de dominio: cualquier correo ya registrado puede recuperarse", async () => {
    await crearArtesanoAutenticado("maestro@gmail.com", CONTRASENA_PRUEBA);

    const res = await api().post("/api/auth/recuperacion").send({ correo: "maestro@gmail.com" });

    expect(res.status).toBe(202);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.para).toBe("maestro@gmail.com");
  });

  it("CA (caso de fallo): se limita el número de solicitudes por hora y por cuenta", async () => {
    await crearArtesanoAutenticado();

    for (let i = 0; i < MAX_SOLICITUDES_POR_HORA; i++) {
      const res = await api().post("/api/auth/recuperacion").send({ correo: CORREO_PRUEBA });
      expect(res.status).toBe(202);
    }
    expect(enviados).toHaveLength(MAX_SOLICITUDES_POR_HORA);

    // La siguiente ya no genera token ni envía correo
    const excedida = await api().post("/api/auth/recuperacion").send({ correo: CORREO_PRUEBA });
    expect(excedida.status).toBe(202);
    expect(enviados).toHaveLength(MAX_SOLICITUDES_POR_HORA);
    expect(await prisma.tokenRecuperacion.count()).toBe(MAX_SOLICITUDES_POR_HORA);
  });

  it("el límite se libera cuando las solicitudes salen de la ventana de una hora", async () => {
    const sesion = await crearArtesanoAutenticado();
    for (let i = 0; i < MAX_SOLICITUDES_POR_HORA; i++) {
      await api().post("/api/auth/recuperacion").send({ correo: CORREO_PRUEBA });
    }

    await prisma.tokenRecuperacion.updateMany({
      where: { idArtesano: sesion.idArtesano },
      data: { fechaSolicitud: new Date(Date.now() - 61 * 60 * 1000) },
    });

    await api().post("/api/auth/recuperacion").send({ correo: CORREO_PRUEBA });
    expect(enviados).toHaveLength(MAX_SOLICITUDES_POR_HORA + 1);
  });

  it("caso de fallo: la solicitud sin correo devuelve 400", async () => {
    const res = await api().post("/api/auth/recuperacion").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/correo es obligatorio/i);
  });
});

describe("HU-01 · Recuperación de contraseña — confirmación", () => {
  async function solicitarToken(): Promise<string> {
    await api().post("/api/auth/recuperacion").send({ correo: CORREO_PRUEBA });
    return tokenDelCorreo(enviados.at(-1)!);
  }

  it("caso de éxito: cambia la contraseña y permite iniciar sesión con la nueva", async () => {
    await crearArtesanoAutenticado();
    const token = await solicitarToken();

    const res = await api()
      .post("/api/auth/recuperacion/confirmar")
      .send({ token, contrasena: CONTRASENA_NUEVA });

    expect(res.status).toBe(200);
    expect(res.body.mensaje).toMatch(/se actualizó/i);

    // La contraseña nueva funciona y la anterior deja de servir
    const conNueva = await api()
      .post("/api/auth/login")
      .send({ correo: CORREO_PRUEBA, contrasena: CONTRASENA_NUEVA });
    expect(conNueva.status).toBe(200);

    const conAnterior = await api()
      .post("/api/auth/login")
      .send({ correo: CORREO_PRUEBA, contrasena: CONTRASENA_PRUEBA });
    expect(conAnterior.status).toBe(401);
  });

  it("la contraseña nueva queda hasheada con bcrypt, nunca en claro", async () => {
    await crearArtesanoAutenticado();
    const token = await solicitarToken();

    await api()
      .post("/api/auth/recuperacion/confirmar")
      .send({ token, contrasena: CONTRASENA_NUEVA });

    const enBd = await prisma.artesano.findUniqueOrThrow({ where: { correo: CORREO_PRUEBA } });
    expect(enBd.contrasenaHash).not.toContain(CONTRASENA_NUEVA);
    expect(enBd.contrasenaHash).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
    await expect(bcrypt.compare(CONTRASENA_NUEVA, enBd.contrasenaHash)).resolves.toBe(true);
  });

  it("CA (caso de fallo): el token es de un solo uso", async () => {
    await crearArtesanoAutenticado();
    const token = await solicitarToken();

    const primera = await api()
      .post("/api/auth/recuperacion/confirmar")
      .send({ token, contrasena: CONTRASENA_NUEVA });
    expect(primera.status).toBe(200);

    const segunda = await api()
      .post("/api/auth/recuperacion/confirmar")
      .send({ token, contrasena: "OtraClaveMas2026" });

    expect(segunda.status).toBe(400);
    expect(segunda.body.error).toMatch(/ya se usó o venció/i);

    // La contraseña siguió siendo la del primer cambio
    const login = await api()
      .post("/api/auth/login")
      .send({ correo: CORREO_PRUEBA, contrasena: CONTRASENA_NUEVA });
    expect(login.status).toBe(200);
  });

  it("CA (caso de fallo): un token vencido se rechaza", async () => {
    await crearArtesanoAutenticado();
    const token = await solicitarToken();

    // Se envejece la solicitud completa, como un enlace pedido hace más de
    // media hora: la restricción CHECK exige que la expiración siga siendo
    // posterior a la solicitud.
    const solicitado = new Date(Date.now() - (VIGENCIA_MINUTOS + 5) * 60 * 1000);
    await prisma.tokenRecuperacion.update({
      where: { tokenHash: hashDeToken(token) },
      data: {
        fechaSolicitud: solicitado,
        fechaExpiracion: new Date(solicitado.getTime() + VIGENCIA_MINUTOS * 60 * 1000),
      },
    });

    const res = await api()
      .post("/api/auth/recuperacion/confirmar")
      .send({ token, contrasena: CONTRASENA_NUEVA });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ya se usó o venció/i);
  });

  it("caso de fallo: un token inexistente se rechaza con el mismo mensaje que uno vencido", async () => {
    await crearArtesanoAutenticado();

    const inexistente = await api()
      .post("/api/auth/recuperacion/confirmar")
      .send({ token: "token-que-nadie-emitio", contrasena: CONTRASENA_NUEVA });

    expect(inexistente.status).toBe(400);
    expect(inexistente.body.error).toMatch(/ya se usó o venció/i);
  });

  it("caso de fallo: una contraseña nueva débil se rechaza y no cambia nada", async () => {
    await crearArtesanoAutenticado();
    const token = await solicitarToken();

    const res = await api()
      .post("/api/auth/recuperacion/confirmar")
      .send({ token, contrasena: "corta1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/12 caracteres/);

    // El token sigue disponible y la contraseña original intacta
    const registro = await prisma.tokenRecuperacion.findUniqueOrThrow({
      where: { tokenHash: hashDeToken(token) },
    });
    expect(registro.fechaUso).toBeNull();
    const login = await api()
      .post("/api/auth/login")
      .send({ correo: CORREO_PRUEBA, contrasena: CONTRASENA_PRUEBA });
    expect(login.status).toBe(200);
  });

  it("cambiar la contraseña invalida los demás enlaces pendientes", async () => {
    await crearArtesanoAutenticado();
    const primero = await solicitarToken();
    const segundo = await solicitarToken();
    expect(primero).not.toBe(segundo);

    await api()
      .post("/api/auth/recuperacion/confirmar")
      .send({ token: segundo, contrasena: CONTRASENA_NUEVA });

    const conElPrimero = await api()
      .post("/api/auth/recuperacion/confirmar")
      .send({ token: primero, contrasena: "TerceraClave2026" });

    expect(conElPrimero.status).toBe(400);
  });
});

describe("HU-01 · Recuperación de contraseña — transporte de correo", () => {
  it("sin RESEND_API_KEY el envío falla en lugar de continuar en silencio", async () => {
    restablecerTransporte();
    const claveOriginal = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);

    try {
      const { enviarCorreo } = await import("../../src/lib/correo.js");
      await expect(
        enviarCorreo({ para: "x@y.mx", asunto: "a", html: "<p>a</p>", texto: "a" }),
      ).rejects.toThrow(/RESEND_API_KEY/);
      // Ni siquiera se intenta la llamada a la API
      expect(fetchFalso).not.toHaveBeenCalled();
    } finally {
      if (claveOriginal !== undefined) process.env.RESEND_API_KEY = claveOriginal;
      vi.unstubAllGlobals();
    }
  });
});
