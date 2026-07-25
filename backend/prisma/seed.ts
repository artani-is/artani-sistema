import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

const CORREO_DEMO = "artesano@artani.mx";
const CONTRASENA_DEMO = "Artani#2026";

async function main() {
  const contrasenaHash = await bcrypt.hash(CONTRASENA_DEMO, 12);

  await prisma.artesano.upsert({
    where: { correo: CORREO_DEMO },
    update: { contrasenaHash },
    create: {
      curp: "AAHF800101HOCRRL09",
      nombres: "Fernando",
      apellidoPaterno: "Artesano",
      apellidoMaterno: "Hule",
      correo: CORREO_DEMO,
      contrasenaHash,
      telefono: "9510000000",
      nombreTaller: "Taller de Artesanías El Árbol del Hule",
    },
  });

  console.log(`Artesano de demostración listo: ${CORREO_DEMO} / ${CONTRASENA_DEMO}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
