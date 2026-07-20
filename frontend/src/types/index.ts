export interface Artesano {
  idArtesano: string
  curp?: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string | null
  correo: string
  telefono?: string | null
  nombreTaller: string | null
}

export interface Sesion {
  token: string
  artesano: Artesano
}

export interface TipoMaterial {
  idTipoMaterial: string
  nombre: string
  _count?: { materiasPrimas: number }
}

export interface TecnicaArtesanal {
  idTecnica: string
  nombre: string
  descripcion: string | null
  _count?: { artesanias: number }
}

export interface CategoriaPieza {
  idCategoria: string
  nombre: string
  _count?: { artesanias: number }
}

export interface Galeria {
  idGaleria: string
  nombre: string
  nombreContacto: string | null
  telefono: string | null
  correo: string | null
  calle: string | null
  numero: string | null
  colonia: string | null
  codigoPostal: string | null
  ciudad: string | null
  estado: string | null
  pais: string
}

export interface Proveedor {
  idProveedor: string
  nombre: string
  telefono: string | null
  correo: string | null
  ciudad: string | null
  estado: string | null
  _count?: { compras: number }
}

export const UNIDADES_MEDIDA = [
  'KG',
  'GRAMO',
  'METRO',
  'CENTIMETRO',
  'LITRO',
  'MILILITRO',
  'PIEZA',
] as const
export type UnidadMedida = (typeof UNIDADES_MEDIDA)[number]

export const ETIQUETA_UNIDAD: Record<UnidadMedida, string> = {
  KG: 'Kilogramos (kg)',
  GRAMO: 'Gramos (g)',
  METRO: 'Metros (m)',
  CENTIMETRO: 'Centímetros (cm)',
  LITRO: 'Litros (L)',
  MILILITRO: 'Mililitros (ml)',
  PIEZA: 'Piezas (pza)',
}

export interface MateriaPrima {
  idMateria: string
  nombre: string
  unidadMedida: UnidadMedida
  idTipoMaterial: string
  tipoMaterial?: TipoMaterial
  _count?: { detallesCompra: number }
}

export interface DetalleCompra {
  idDetalle: string
  cantidad: string
  costoUnitario: string
  idCompra: string
  idMateria: string
  materiaPrima?: MateriaPrima
}

export interface Compra {
  idCompra: string
  fecha: string
  folioNota: string | null
  idProveedor: string
  proveedor?: Proveedor
  detalles: DetalleCompra[]
}

export interface PrecioHistorico {
  idDetalle: string
  fecha: string
  folioNota: string | null
  proveedor: { idProveedor: string; nombre: string }
  cantidad: string
  costoUnitario: string
}

export const ESTADOS_ARTESANIA = ['DISPONIBLE', 'EN_CONSIGNACION', 'VENDIDA'] as const
export type EstadoArtesania = (typeof ESTADOS_ARTESANIA)[number]

export const ETIQUETA_ESTADO: Record<EstadoArtesania, string> = {
  DISPONIBLE: 'Disponible',
  EN_CONSIGNACION: 'En consignación',
  VENDIDA: 'Vendida',
}

export interface FotoArtesania {
  idFoto: string
  rutaArchivo: string
  esPrincipal: boolean
  fechaCarga: string
  idArtesania: string
}

export interface Artesania {
  idArtesania: string
  nombre: string
  descripcion: string | null
  estado: EstadoArtesania
  fechaRegistro: string
  horasTrabajadas: string | null
  tarifaHora: string | null
  precioVenta: string | null
  idArtesano: string
  idTecnica: string
  idCategoria: string
  tecnica?: TecnicaArtesanal
  categoria?: CategoriaPieza
  fotos: FotoArtesania[]
}
