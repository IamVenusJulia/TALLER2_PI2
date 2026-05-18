import { mockReservasAdmin } from "@/lib/mocks";

export default function AdminDashboard() {
  const data = mockReservasAdmin;

  return (
    <div className="p-6 lg:p-10 overflow-y-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-footcall-dark mb-1 tracking-tight">Calendario de Reservas</h1>
          <p className="text-gray-500 font-medium">Bienvenido de nuevo, {data.admin.nombre}</p>
        </div>
        <div className="mt-4 sm:mt-0 flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
          <button className="px-5 py-2.5 text-sm font-bold bg-footcall-light text-footcall-dark rounded-lg transition-colors">Vista Diaria</button>
          <button className="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">Vista Semanal</button>
        </div>
      </header>

      {/* Tarjetas de Canchas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {data.canchas_disponibles.map((cancha) => (
          <div key={cancha.cancha_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:shadow-md transition-shadow">
            <div className="mb-4 sm:mb-0">
              <h3 className="text-xl font-bold text-gray-900 mb-1">{cancha.nombre}</h3>
              <div className="flex items-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 capitalize">
                  {cancha.tipo_superficie}
                </span>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="block text-2xl font-black text-footcall-green">${cancha.precio_por_hora.toLocaleString()}</span>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">por hora</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla de Reservas */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900">Reservas Activas</h3>
          <button className="text-sm font-semibold text-footcall-green hover:text-footcall-green-hover transition-colors">Ver todas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-100 text-gray-400 text-xs uppercase tracking-widest font-semibold">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Hora</th>
                <th className="px-6 py-4">Cancha</th>
                <th className="px-6 py-4 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.reservas_activas.map((reserva) => {
                let statusColor = "bg-gray-100 text-gray-800";
                if (reserva.estado === "confirmada") statusColor = "bg-green-100 text-green-800";
                if (reserva.estado === "pendiente") statusColor = "bg-yellow-100 text-yellow-800";
                if (reserva.estado === "cancelada") statusColor = "bg-red-100 text-red-800";

                return (
                  <tr key={reserva.reserva_id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-5 font-bold text-gray-900">{reserva.cliente_nombre}</td>
                    <td className="px-6 py-5 text-gray-600 font-medium">{reserva.fecha}</td>
                    <td className="px-6 py-5 text-gray-900 font-bold">{reserva.hora_inicio}</td>
                    <td className="px-6 py-5 text-gray-600 font-medium">Cancha #{reserva.cancha_id}</td>
                    <td className="px-6 py-5 text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor}`}>
                        {reserva.estado}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
