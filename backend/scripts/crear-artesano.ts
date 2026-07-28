import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { prisma } from "../src/lib/prisma.js";
import {
  crearArtesano,
  ErrorAlta,
  MIN_LONGITUD_CONTRASENA,
  type DatosAltaArtesano,
} from "../src/lib/artesanos.js";

/**
 * Alta administrativa de la cuenta del artesano.
 *
 *   pnpm seed:artesano
 *
 * Los datos se toman de variables de entorno y, si falta alguno y la terminal
 * es interactiva, se solicitan por consola. La contraseña se captura oculta,
 * nunca se imprime y solo se persiste su hash bcrypt.
 *
 * Sustituye la inserción directa en base de datos, que obligaba a calcular el
 * hash aparte y dejaba abierta la posibilidad de guardar texto plano.
 */

interface Campo {
  clave: keyof DatosAltaArtesano;
  entorno: string;
  etiqueta: string;
  obligatorio: boolean;
  secreto?: boolean;
}

const CAMPOS: Campo[] = [
  { clave: "curp", entorno: "ARTESANO_CURP", etiqueta: "CURP", obligatorio: true },
  { clave: "nombres", entorno: "ARTESANO_NOMBRES", etiqueta: "Nombre(s)", obligatorio: true },
  {
    clave: "apellidoPaterno",
    entorno: "ARTESANO_APELLIDO_PATERNO",
    etiqueta: "Apellido paterno",
    obligatorio: true,
  },
  {
    clave: "apellidoMaterno",
    entorno: "ARTESANO_APELLIDO_MATERNO",
    etiqueta: "Apellido materno (opcional)",
    obligatorio: false,
  },
  { clave: "correo", entorno: "ARTESANO_CORREO", etiqueta: "Correo electrónico", obligatorio: true },
  {
    clave: "telefono",
    entorno: "ARTESANO_TELEFONO",
    etiqueta: "Teléfono (opcional)",
    obligatorio: false,
  },
  {
    clave: "nombreTaller",
    entorno: "ARTESANO_TALLER",
    etiqueta: "Nombre del taller (opcional)",
    obligatorio: false,
  },
  {
    clave: "contrasena",
    entorno: "ARTESANO_CONTRASENA",
    etiqueta: `Contraseña (mínimo ${MIN_LONGITUD_CONTRASENA} caracteres)`,
    obligatorio: true,
    secreto: true,
  },
];

/** Lee una línea ocultando lo que se teclea (para la contraseña). */
async function preguntarOculto(pregunta: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const salida = stdout as unknown as { write(texto: string): boolean };
  const escrituraOriginal = salida.write.bind(salida);
  let ocultando = false;

  salida.write = (texto: string) => (ocultando ? true : escrituraOriginal(texto));
  try {
    const promesa = rl.question(pregunta);
    ocultando = true;
    const valor = await promesa;
    ocultando = false;
    escrituraOriginal("\n");
    return valor;
  } finally {
    ocultando = false;
    salida.write = escrituraOriginal;
    rl.close();
  }
}

async function recolectar(): Promise<DatosAltaArtesano> {
  const interactivo = stdin.isTTY === true;
  const datos: Record<string, string> = {};
  const faltantes: string[] = [];

  for (const campo of CAMPOS) {
    const desdeEntorno = process.env[campo.entorno]?.trim();
    if (desdeEntorno) {
      datos[campo.clave] = desdeEntorno;
      continue;
    }
    if (!interactivo) {
      if (campo.obligatorio) faltantes.push(campo.entorno);
      continue;
    }
    datos[campo.clave] = campo.secreto
      ? await preguntarOculto(`${campo.etiqueta}: `)
      : await (async () => {
          const rl = createInterface({ input: stdin, output: stdout });
          try {
            return await rl.question(`${campo.etiqueta}: `);
          } finally {
            rl.close();
          }
        })();
  }

  if (faltantes.length > 0) {
    throw new ErrorAlta(
      `La terminal no es interactiva y faltan variables de entorno: ${faltantes.join(", ")}`,
    );
  }
  return datos as unknown as DatosAltaArtesano;
}

async function main() {
  const datos = await recolectar();
  const artesano = await crearArtesano(datos);

  console.log("\nArtesano dado de alta:");
  console.log(`  id     : ${artesano.idArtesano}`);
  console.log(`  nombre : ${artesano.nombreCompleto}`);
  console.log(`  correo : ${artesano.correo}`);
  console.log("\nLa contraseña se almacenó como hash bcrypt; no se guarda en claro.");
  if (process.env.ARTESANO_CONTRASENA) {
    console.log(
      "Aviso: definiste ARTESANO_CONTRASENA en el entorno. Bórrala del historial\n" +
        "de la terminal y del archivo donde la hayas escrito.",
    );
  }
}

main()
  .catch((err: unknown) => {
    if (err instanceof ErrorAlta) {
      console.error(`\nNo se pudo dar de alta al artesano: ${err.message}`);
    } else {
      console.error("\nError inesperado al dar de alta al artesano:", err);
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
