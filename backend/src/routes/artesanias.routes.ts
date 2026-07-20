import { Router } from "express";
import * as artesaniasController from "../controllers/artesanias.controller.js";
import * as fotosController from "../controllers/fotos.controller.js";
import { subirFotos } from "../lib/uploads.js";

export const artesaniasRouter = Router();

artesaniasRouter.get("/", artesaniasController.listar);
artesaniasRouter.get("/:id", artesaniasController.obtener);
artesaniasRouter.post("/", artesaniasController.crear);
artesaniasRouter.put("/:id", artesaniasController.actualizar);
artesaniasRouter.delete("/:id", artesaniasController.eliminar);

artesaniasRouter.post("/:id/fotos", subirFotos.array("fotos", 10), fotosController.subir);
artesaniasRouter.patch("/:id/fotos/:idFoto/principal", fotosController.marcarPrincipal);
artesaniasRouter.delete("/:id/fotos/:idFoto", fotosController.eliminar);
