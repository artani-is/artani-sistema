import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma.js";
import { limpiarBaseDatos } from "../helpers/db.js";
import { api } from "../helpers/api.js";
import {
  crearArtesano,
  ErrorAlta,
  MIN_LONGITUD_CONTRASENA,
  type DatosAltaArtesano,
} from "../../src/lib/artesanos.js";

const ejecutar = promisify(execFile);
const RAIZ_BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const URL_PRUEBAS = "postgresql://artani:artani_dev@localhost:5432/artani_test?schema=public";

const DATOS_VALIDOS: DatosAltaArtesano = {
  curp: "GOML950214HOCNGS08",
  nombres: "Luis Fernando",
  apellidoPaterno: "González",
  apellidoMaterno: "Miguel",
  correo: "maestro@artani.mx",
  telefono: "9515553344",
  nombreTaller: "Taller El Árbol del Hule",
  contrasena: "BarroNegro2026x",
};

beforeEach(async () => {
  await limpiarBaseDatos();
});

describe("HU-01 · Alta administrativa de la cuenta del artesano", () => {
  it("caso de éxito: da de alta al artesano y guarda solo el hash bcrypt", async () => {
    const creado = await crearArtesano(DATOS_VALIDOS);

    expect(creado.idArtesano).toMatch(/^[0-9a-f-]{36}$/i);
    expect(creado.correo).toBe("maestro@artani.mx");
    expect(creado.nombreCompleto).toBe("Luis Fernando González");

    const enBd = await prisma.artesano.findUniqueOrThrow({
      where: { correo: DATOS_VALIDOS.correo },
    });
    // La contraseña nunca se almacena en claro
    expect(enBd.contrasenaHash).not.toContain(DATOS_VALIDOS.contrasena);
    expect(enBd.contrasenaHash).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
    await expect(bcrypt.compare(DATOS_VALIDOS.contrasena, enBd.contrasenaHash)).resolves.toBe(true);
  });

  it("caso de éxito: la cuenta creada puede iniciar sesión de inmediato", async () => {
    await crearArtesano(DATOS_VALIDOS);

    const res = await api()
      .post("/api/auth/login")
      .send({ correo: DATOS_VALIDOS.correo, contrasena: DATOS_VALIDOS.contrasena });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.artesano.nombreTaller).toBe("Taller El Árbol del Hule");
  });

  it("el correo y la CURP se normalizan antes de persistirse", async () => {
    await crearArtesano({
      ...DATOS_VALIDOS,
      correo: "  MAESTRO@Artani.MX  ",
      curp: "goml950214hocngs08",
    });

    const enBd = await prisma.artesano.findFirstOrThrow();
    expect(enBd.correo).toBe("maestro@artani.mx");
    expect(enBd.curp).toBe("GOML950214HOCNGS08");
  });

  it("caso de fallo: una contraseña más corta que el mínimo se rechaza y no crea nada", async () => {
    await expect(
      crearArtesano({ ...DATOS_VALIDOS, contrasena: "corta1" }),
    ).rejects.toThrow(ErrorAlta);

    await expect(
      crearArtesano({ ...DATOS_VALIDOS, contrasena: "corta1" }),
    ).rejects.toThrow(new RegExp(`${MIN_LONGITUD_CONTRASENA} caracteres`));

    expect(await prisma.artesano.count()).toBe(0);
  });

  it("caso de fallo: una contraseña sin números o de un solo carácter repetido se rechaza", async () => {
    await expect(
      crearArtesano({ ...DATOS_VALIDOS, contrasena: "solamenteletras" }),
    ).rejects.toThrow(/letras y números/i);

    await expect(
      crearArtesano({ ...DATOS_VALIDOS, contrasena: "aaaaaaaaaaaaaa" }),
    ).rejects.toThrow(ErrorAlta);

    expect(await prisma.artesano.count()).toBe(0);
  });

  it("caso de fallo: campos obligatorios vacíos se rechazan antes de tocar la base de datos", async () => {
    for (const campo of ["curp", "nombres", "apellidoPaterno", "correo"] as const) {
      await expect(
        crearArtesano({ ...DATOS_VALIDOS, [campo]: "   " }),
      ).rejects.toThrow(ErrorAlta);
    }
    expect(await prisma.artesano.count()).toBe(0);
  });

  it("caso de fallo: CURP y correo mal formados se rechazan", async () => {
    await expect(crearArtesano({ ...DATOS_VALIDOS, curp: "ABC123" })).rejects.toThrow(/CURP/i);
    await expect(
      crearArtesano({ ...DATOS_VALIDOS, correo: "no-es-un-correo" }),
    ).rejects.toThrow(/correo/i);
    expect(await prisma.artesano.count()).toBe(0);
  });

  it("caso de fallo: no se admite un correo o una CURP ya registrados", async () => {
    await crearArtesano(DATOS_VALIDOS);

    await expect(
      crearArtesano({ ...DATOS_VALIDOS, curp: "MAML960315HOCRNS04" }),
    ).rejects.toThrow(/ya existe.*correo/i);

    await expect(
      crearArtesano({ ...DATOS_VALIDOS, correo: "otro@artani.mx" }),
    ).rejects.toThrow(/ya existe.*CURP/i);

    expect(await prisma.artesano.count()).toBe(1);
  });

  it("no existe ninguna vía para inyectar un hash ya calculado", async () => {
    const hashAjeno = await bcrypt.hash("otra-contrasena", 12);

    // Aunque se pase un hash como si fuera la contraseña, se vuelve a hashear:
    // lo almacenado nunca coincide con lo recibido.
    await crearArtesano({ ...DATOS_VALIDOS, contrasena: hashAjeno });
    const enBd = await prisma.artesano.findFirstOrThrow();

    expect(enBd.contrasenaHash).not.toBe(hashAjeno);
    await expect(bcrypt.compare("otra-contrasena", enBd.contrasenaHash)).resolves.toBe(false);
    await expect(bcrypt.compare(hashAjeno, enBd.contrasenaHash)).resolves.toBe(true);
  });
});

describe("HU-01 · Script pnpm seed:artesano", () => {
  it("caso de éxito: da de alta al artesano leyendo variables de entorno", async () => {
    const { stdout } = await ejecutar("pnpm", ["seed:artesano"], {
      cwd: RAIZ_BACKEND,
      env: {
        ...process.env,
        DATABASE_URL: URL_PRUEBAS,
        ARTESANO_CURP: DATOS_VALIDOS.curp,
        ARTESANO_NOMBRES: DATOS_VALIDOS.nombres,
        ARTESANO_APELLIDO_PATERNO: DATOS_VALIDOS.apellidoPaterno,
        ARTESANO_APELLIDO_MATERNO: DATOS_VALIDOS.apellidoMaterno ?? "",
        ARTESANO_CORREO: DATOS_VALIDOS.correo,
        ARTESANO_TELEFONO: DATOS_VALIDOS.telefono ?? "",
        ARTESANO_TALLER: DATOS_VALIDOS.nombreTaller ?? "",
        ARTESANO_CONTRASENA: DATOS_VALIDOS.contrasena,
      },
    });

    expect(stdout).toContain("Artesano dado de alta");
    expect(stdout).toContain(DATOS_VALIDOS.correo);
    // La contraseña no aparece en la salida del script
    expect(stdout).not.toContain(DATOS_VALIDOS.contrasena);

    const enBd = await prisma.artesano.findUniqueOrThrow({
      where: { correo: DATOS_VALIDOS.correo },
    });
    await expect(bcrypt.compare(DATOS_VALIDOS.contrasena, enBd.contrasenaHash)).resolves.toBe(true);
  }, 60_000);

  it("caso de fallo: sin terminal interactiva y sin variables, indica cuáles faltan y sale con error", async () => {
    const entorno = { ...process.env, DATABASE_URL: URL_PRUEBAS };
    for (const clave of Object.keys(entorno)) {
      if (clave.startsWith("ARTESANO_")) delete entorno[clave];
    }

    await expect(
      ejecutar("pnpm", ["seed:artesano"], { cwd: RAIZ_BACKEND, env: entorno }),
    ).rejects.toMatchObject({ code: 1 });

    expect(await prisma.artesano.count()).toBe(0);
  }, 60_000);

  it("caso de fallo: una contraseña débil por entorno aborta el alta", async () => {
    await expect(
      ejecutar("pnpm", ["seed:artesano"], {
        cwd: RAIZ_BACKEND,
        env: {
          ...process.env,
          DATABASE_URL: URL_PRUEBAS,
          ARTESANO_CURP: DATOS_VALIDOS.curp,
          ARTESANO_NOMBRES: DATOS_VALIDOS.nombres,
          ARTESANO_APELLIDO_PATERNO: DATOS_VALIDOS.apellidoPaterno,
          ARTESANO_CORREO: DATOS_VALIDOS.correo,
          ARTESANO_CONTRASENA: "123",
        },
      }),
    ).rejects.toMatchObject({ code: 1 });

    expect(await prisma.artesano.count()).toBe(0);
  }, 60_000);
});
