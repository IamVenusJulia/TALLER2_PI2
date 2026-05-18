export type RolUsuario = 'admin' | 'cliente';
export type TipoSuperficie = 'sintetica' | 'natural' | 'madera' | 'arcilla';
export type EstadoReserva = 'pendiente' | 'confirmada' | 'cancelada';
export type MetodoPago = 'efectivo' | 'transferencia' | 'online';

export interface Usuario {
  nombre: string;
  rol: RolUsuario;
}

export interface Reserva {
  reserva_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  cancha: string;
  superficie: TipoSuperficie;
  estado: EstadoReserva;
  total_pago: number;
  metodo_pago: MetodoPago;
}

export interface HistorialResponse {
  usuario: Usuario;
  historial: Reserva[];
}

export interface CanchaDisponible {
  cancha_id: number;
  nombre: string;
  tipo_superficie: TipoSuperficie;
  precio_por_hora: number;
}

export interface ReservaActiva {
  reserva_id: number;
  cliente_nombre: string;
  cancha_id: number;
  fecha: string;
  hora_inicio: string;
  estado: EstadoReserva;
}

export interface ReservasSemanaResponse {
  admin: {
    nombre: string;
  };
  canchas_disponibles: CanchaDisponible[];
  reservas_activas: ReservaActiva[];
}
