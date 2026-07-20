import "dotenv/config";
import { crearServidor } from "./server.js";

if (!process.env.JWT_SECRET) {
  console.error("Falta la variable de entorno JWT_SECRET; revisa backend/.env");
  process.exit(1);
}

const app = crearServidor();
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
