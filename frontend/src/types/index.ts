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
  insumos?: InsumoArtesania[]
  certificado?: CertificadoQr | null
  venta?: Venta | null
  /** Solo la consignación ACTIVA (si existe) viene incluida desde la API. */
  consignaciones?: Consignacion[]
}

// Sprint 3 — costeo

export interface InsumoArtesania {
  idInsumoArt: string
  cantidadUsada: string
  costoUnitarioUso: string
  idArtesania: string
  idMateria: string
  materiaPrima?: MateriaPrima
}

// Sprint 4 — certificación digital

export interface VerificacionCertificado {
  idVerificacion: string
  fechaHora: string
  idCertificado: string
}

export interface CertificadoQr {
  idCertificado: string
  fechaEmision: string
  rutaPdf: string
  idArtesania: string
  rutaQr?: string
  urlVerificacion?: string
  verificaciones?: VerificacionCertificado[]
  _count?: { verificaciones: number }
}

/** Derivados del certificado (la PK es el token público del QR). */
export function rutaQrDe(certificado: CertificadoQr): string {
  return certificado.rutaQr ?? `/uploads/certificados/${certificado.idCertificado}-qr.png`
}

export interface VerificacionPublica {
  idCertificado: string
  fechaEmision: string
  pieza: {
    nombre: string
    descripcion: string | null
    tecnica: string
    categoria: string
    foto: string | null
  }
  artesano: {
    nombre: string
    taller: string | null
  }
}

// Sprint 5 — consignación y ventas

export const ESTADOS_CONSIGNACION = ['ACTIVA', 'DEVUELTA', 'VENDIDA'] as const
export type EstadoConsignacion = (typeof ESTADOS_CONSIGNACION)[number]

export const ETIQUETA_ESTADO_CONSIGNACION: Record<EstadoConsignacion, string> = {
  ACTIVA: 'Activa',
  DEVUELTA: 'Devuelta',
  VENDIDA: 'Vendida',
}

export interface Consignacion {
  idConsignacion: string
  fechaSalida: string
  fechaRetorno: string | null
  estado: EstadoConsignacion
  porcentajeComision: string | null
  idArtesania: string
  idGaleria: string
  galeria?: Pick<Galeria, 'idGaleria' | 'nombre'>
  artesania?: Pick<Artesania, 'idArtesania' | 'nombre' | 'estado'>
}

export interface Venta {
  idVenta: string
  fechaVenta: string
  montoCobrado: string
  idArtesania: string
  idConsignacion: string | null
  canal?: 'DIRECTA' | 'CONSIGNACION'
  artesania?: Pick<Artesania, 'idArtesania' | 'nombre'>
  consignacion?: Consignacion | null
}
