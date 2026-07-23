import { Router } from "express";
import * as artesaniasController from "../controllers/artesanias.controller.js";
import * as fotosController from "../controllers/fotos.controller.js";
import * as costeoController from "../controllers/costeo.controller.js";
import * as certificadosController from "../controllers/certificados.controller.js";
import * as ventasController from "../controllers/ventas.controller.js";
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

// Sprint 3: costeo (HU-8, HU-9)
artesaniasRouter.get("/:id/insumos", costeoController.listarInsumos);
artesaniasRouter.put("/:id/insumos", costeoController.guardarInsumos);
artesaniasRouter.put("/:id/costeo", costeoController.actualizarCosteo);
artesaniasRouter.put("/:id/precio", costeoController.asignarPrecio);

// Sprint 4: certificación digital (HU-10, HU-11)
artesaniasRouter.post("/:id/certificado", certificadosController.emitir);
artesaniasRouter.get("/:id/certificado", certificadosController.obtener);

// Sprint 5: consignación y ventas (HU-13, HU-14)
artesaniasRouter.post("/:id/consignacion", ventasController.enviarConsignacion);
artesaniasRouter.post("/:id/venta", ventasController.registrar);
