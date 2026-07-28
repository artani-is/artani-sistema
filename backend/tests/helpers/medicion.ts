import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface Medicion {
  rnf: string;
  descripcion: string;
  unidad: string;
  muestras: number;
  promedio: number;
  maximo: number;
  minimo: number;
  umbral?: number;
}

const DIR_RESULTADOS = path.resolve(process.cwd(), "tests/resultados");
const ARCHIVO = path.join(DIR_RESULTADOS, "mediciones-rnf.jsonl");

/** Ejecuta `accion` n veces y devuelve el tiempo de cada corrida en milisegundos. */
export async function medirMs(n: number, accion: (i: number) => Promise<unknown>): Promise<number[]> {
  const tiempos: number[] = [];
  for (let i = 0; i < n; i++) {
    const inicio = performance.now();
    await accion(i);
    tiempos.push(performance.now() - inicio);
  }
  return tiempos;
}

/**
 * Resume una serie de tiempos y la registra en `tests/resultados/` para poder
 * transcribir promedio y máximo reales al informe.
 */
export function registrar(
  rnf: string,
  descripcion: string,
  tiempos: number[],
  opciones: { unidad?: string; umbral?: number } = {},
): Medicion {
  const { unidad = "ms", umbral } = opciones;
  const medicion: Medicion = {
    rnf,
    descripcion,
    unidad,
    muestras: tiempos.length,
    promedio: Number((tiempos.reduce((s, t) => s + t, 0) / tiempos.length).toFixed(2)),
    maximo: Number(Math.max(...tiempos).toFixed(2)),
    minimo: Number(Math.min(...tiempos).toFixed(2)),
    ...(umbral !== undefined ? { umbral } : {}),
  };

  mkdirSync(DIR_RESULTADOS, { recursive: true });
  appendFileSync(ARCHIVO, `${JSON.stringify(medicion)}\n`);
  console.log(
    `[${rnf}] ${descripcion} — n=${medicion.muestras} prom=${medicion.promedio}${unidad} máx=${medicion.maximo}${unidad}` +
      (umbral !== undefined ? ` (umbral ${umbral}${unidad})` : ""),
  );
  return medicion;
}
