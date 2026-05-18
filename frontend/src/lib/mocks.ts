import { HistorialResponse, ReservasSemanaResponse } from '../types';

export const mockHistorialCliente: HistorialResponse = {
  usuario: {
    nombre: "Daniel",
    rol: "cliente"
  },
  historial: [
    {
      reserva_id: 101,
      fecha: "2026-05-20",
      hora_inicio: "18:00",
      hora_fin: "19:00",
      cancha: "Cancha 1 Principal",
      superficie: "sintetica",
      estado: "confirmada",
      total_pago: 120000,
      metodo_pago: "online"
    },
    {
      reserva_id: 102,
      fecha: "2026-05-15",
      hora_inicio: "20:00",
      hora_fin: "21:00",
      cancha: "Cancha 2",
      superficie: "natural",
      estado: "confirmada",
      total_pago: 150000,
      metodo_pago: "efectivo"
    },
    {
      reserva_id: 103,
      fecha: "2026-05-10",
      hora_inicio: "19:00",
      hora_fin: "20:00",
      cancha: "Cancha 1 Principal",
      superficie: "sintetica",
      estado: "cancelada",
      total_pago: 120000,
      metodo_pago: "transferencia"
    }
  ]
};

export const mockReservasAdmin: ReservasSemanaResponse = {
  admin: {
    nombre: "Admin Principal"
  },
  canchas_disponibles: [
    {
      cancha_id: 1,
      nombre: "Cancha 1 Principal",
      tipo_superficie: "sintetica",
      precio_por_hora: 120000
    },
    {
      cancha_id: 2,
      nombre: "Cancha 2 Secundaria",
      tipo_superficie: "natural",
      precio_por_hora: 150000
    }
  ],
  reservas_activas: [
    {
      reserva_id: 505,
      cliente_nombre: "Juan Pérez",
      cancha_id: 1,
      fecha: "2026-05-18",
      hora_inicio: "20:00",
      estado: "pendiente"
    },
    {
      reserva_id: 506,
      cliente_nombre: "María Gómez",
      cancha_id: 2,
      fecha: "2026-05-18",
      hora_inicio: "18:00",
      estado: "confirmada"
    },
    {
      reserva_id: 507,
      cliente_nombre: "Carlos López",
      cancha_id: 1,
      fecha: "2026-05-19",
      hora_inicio: "19:00",
      estado: "confirmada"
    }
  ]
};
