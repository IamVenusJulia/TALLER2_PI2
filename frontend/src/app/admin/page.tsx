"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const router = useRouter();
  const [vista, setVista] = useState<'diaria' | 'semanal'>('diaria');
  const [canchas, setCanchas] = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [adminName, setAdminName] = useState("Administrador");
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Alertas / Notificaciones
  const [alerta, setAlerta] = useState<any | null>(null);
  const [reservaSeleccionada, setReservaSeleccionada] = useState<any | null>(null);

  // Mantener un registro de los IDs de reservas conocidas para detectar nuevas
  const reservasConocidasRef = useRef<Set<number>>(new Set());
  const inicializadoRef = useRef(false);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      
      // Validar rol de admin (en metadatos de usuario o correo)
      const userEmail = session.user?.email || "";
      const userRole = session.user?.user_metadata?.rol || (userEmail.toLowerCase().includes("admin") ? "admin" : "cliente");
      
      if (userRole !== "admin") {
        router.push("/cliente");
        return;
      }

      setSessionToken(session.access_token);
      setAdminName(session.user?.user_metadata?.full_name || userEmail.split("@")[0] || "Administrador");
      await cargarDatos(session.access_token, vista);
    };

    checkAuthAndFetch();
  }, [router, vista]);

  // Loop de Polling para nuevas reservas pendientes (HU-16)
  useEffect(() => {
    if (!sessionToken) return;

    const interval = setInterval(async () => {
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://taller2-pi2-2.onrender.com';
        const res = await fetch(`${apiBaseUrl}/api/admin/reservas?view=week`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          const activas = data.reservas_activas || [];
          
          // Buscar si hay alguna nueva reserva con estado 'pendiente'
          let nuevaReservaPendiente = null;
          
          for (const r of activas) {
            if (!reservasConocidasRef.current.has(r.reserva_id)) {
              // Es una reserva nueva para nuestro cliente local
              reservasConocidasRef.current.add(r.reserva_id);
              
              if (r.estado === "pendiente" && inicializadoRef.current) {
                nuevaReservaPendiente = r;
              }
            }
          }

          // Actualizar la lista en pantalla silenciosamente en background si no se está haciendo una acción
          if (!loadingAction) {
            setReservas(activas);
          }

          if (nuevaReservaPendiente) {
            setAlerta(nuevaReservaPendiente);
          }
        }
      } catch (err) {
        console.error("Error en sondeo de reservas:", err);
      }
    }, 10000); // Polling cada 10 segundos

    return () => clearInterval(interval);
  }, [sessionToken, loadingAction]);

  const cargarDatos = async (token: string, viewType: 'diaria' | 'semanal') => {
    try {
      setLoading(true);
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://taller2-pi2-2.onrender.com';
      const viewParam = viewType === 'diaria' ? 'day' : 'week';
      
      const res = await fetch(`${apiBaseUrl}/api/admin/reservas?view=${viewParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setCanchas(data.canchas_disponibles || []);
        const activas = data.reservas_activas || [];
        setReservas(activas);

        // Llenar reservas conocidas en la carga inicial para no alertar de las ya existentes
        if (!inicializadoRef.current) {
          const ids = new Set<number>();
          activas.forEach((r: any) => ids.add(r.reserva_id));
          reservasConocidasRef.current = ids;
          inicializadoRef.current = true;
        } else {
          // Agregar cualquier ID nuevo
          activas.forEach((r: any) => reservasConocidasRef.current.add(r.reserva_id));
        }
      } else {
        console.error("Error al cargar reservas de administración", res.status);
      }
    } catch (err) {
      console.error("Error cargando panel admin:", err);
    } finally {
      setLoading(false);
    }
  };

  const actualizarEstado = async (reservaId: number, nuevoEstado: 'confirmada' | 'cancelada') => {
    if (!sessionToken) return;
    
    try {
      setLoadingAction(true);
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://taller2-pi2-2.onrender.com';
      
      const res = await fetch(`${apiBaseUrl}/api/admin/reservas/${reservaId}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });

      if (res.ok) {
        // Cerrar modal de gestión y descartar alerta si corresponde
        setReservaSeleccionada(null);
        if (alerta && alerta.reserva_id === reservaId) {
          setAlerta(null);
        }
        
        // Recargar datos inmediatamente
        await cargarDatos(sessionToken, vista);
      } else {
        const errData = await res.json();
        alert(`Error al actualizar estado: ${errData.detail || 'Error en el servidor'}`);
      }
    } catch (err) {
      console.error("Error al actualizar estado de reserva:", err);
      alert("Hubo un error de conexión al actualizar el estado de la reserva.");
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 relative flex-1 overflow-y-auto">
      
      {/* Bloqueo de pantalla durante carga de acciones (HU-17) */}
      {loadingAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex flex-col items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-xs w-full flex flex-col items-center text-center shadow-2xl">
            <svg className="animate-spin h-12 w-12 text-footcall-green mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-900 font-bold text-lg mb-1">Procesando solicitud</p>
            <p className="text-gray-500 text-sm font-medium">Actualizando el estado de la reserva en el sistema...</p>
          </div>
        </div>
      )}

      {/* Banner de Notificación Flotante - Amarillo para pendientes (HU-16) */}
      {alerta && (
        <div className="fixed bottom-6 right-6 z-[90] max-w-md w-full bg-amber-50 border-l-4 border-amber-500 p-5 rounded-2xl shadow-xl flex items-start justify-between space-x-4 animate-in slide-in-from-bottom duration-300">
          <div className="flex-1">
            <div className="flex items-center space-x-2 text-amber-800 mb-1.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-extrabold text-sm uppercase tracking-wider">Nueva Reserva por Voz</span>
            </div>
            <p className="text-amber-900 text-sm font-medium">
              El cliente <strong className="font-bold">{alerta.cliente_nombre}</strong> ha solicitado una reserva el <strong className="font-bold">{alerta.fecha}</strong> a las <strong className="font-bold">{alerta.hora_inicio}</strong>. Requiere confirmación manual.
            </p>
            <div className="mt-3 flex space-x-3">
              <button 
                onClick={() => {
                  setReservaSeleccionada(alerta);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                Gestionar Reserva
              </button>
              <button 
                onClick={() => setAlerta(null)}
                className="px-3 py-2 text-amber-700 hover:text-amber-950 text-xs font-bold transition-colors"
              >
                Ignorar
              </button>
            </div>
          </div>
          <button onClick={() => setAlerta(null)} className="text-amber-400 hover:text-amber-600 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Modal de Gestión de Reserva Específica */}
      {reservaSeleccionada && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Gestionar Reserva #{reservaSeleccionada.reserva_id}</h3>
              <button onClick={() => setReservaSeleccionada(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase">Cliente</span>
                  <p className="text-base font-bold text-gray-900">{reservaSeleccionada.cliente_nombre}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase">Cancha ID</span>
                  <p className="text-base font-bold text-gray-900">Cancha #{reservaSeleccionada.cancha_id}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase">Fecha</span>
                  <p className="text-base font-bold text-gray-900">{reservaSeleccionada.fecha}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase">Hora</span>
                  <p className="text-base font-bold text-gray-900">{reservaSeleccionada.hora_inicio}</p>
                </div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-2xl flex items-center space-x-3">
                <span className="inline-flex h-3 w-3 rounded-full bg-yellow-500 animate-pulse"></span>
                <span className="text-sm font-bold text-yellow-800 uppercase">Estado: {reservaSeleccionada.estado}</span>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row sm:justify-end gap-3">
              <button 
                onClick={() => actualizarEstado(reservaSeleccionada.reserva_id, 'confirmada')}
                className="w-full sm:w-auto px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold text-sm rounded-xl transition-all shadow-sm"
              >
                Confirmar Reserva
              </button>
              <button 
                onClick={() => actualizarEstado(reservaSeleccionada.reserva_id, 'cancelada')}
                className="w-full sm:w-auto px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold text-sm rounded-xl transition-all shadow-sm"
              >
                Cancelar Reserva
              </button>
              <button 
                onClick={() => setReservaSeleccionada(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-sm rounded-xl transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-footcall-dark mb-1 tracking-tight">Calendario de Reservas</h1>
          <p className="text-gray-500 font-medium">Bienvenido de nuevo, {adminName}</p>
        </div>
        <div className="mt-4 sm:mt-0 flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
          <button 
            onClick={() => setVista('diaria')}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-colors ${vista === 'diaria' ? 'bg-footcall-light text-footcall-dark' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            Vista Diaria
          </button>
          <button 
            onClick={() => setVista('semanal')}
            className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-colors ${vista === 'semanal' ? 'bg-footcall-light text-footcall-dark' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            Vista Semanal
          </button>
        </div>
      </header>

      {/* Tarjetas de Canchas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {loading ? (
          /* Esqueleto de Carga */
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between animate-pulse">
              <div className="space-y-2 w-1/2">
                <div className="h-6 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))
        ) : canchas.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-500 font-medium">
            No hay canchas registradas en el sistema.
          </div>
        ) : (
          canchas.map((cancha) => (
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
          ))
        )}
      </div>

      {/* Tabla de Reservas */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900">Reservas Activas ({vista === 'diaria' ? 'Hoy' : 'Esta Semana'})</h3>
          {sessionToken && (
            <button 
              onClick={() => cargarDatos(sessionToken, vista)}
              className="text-sm font-semibold text-footcall-green hover:text-footcall-green-hover transition-colors flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" /></svg>
              Recargar
            </button>
          )}
        </div>
        
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-footcall-green mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-500 font-medium">Cargando reservas...</p>
          </div>
        ) : reservas.length === 0 ? (
          <div className="p-12 text-center text-gray-500 font-medium">
            No hay reservas registradas para {vista === 'diaria' ? 'el día de hoy' : 'esta semana'}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-gray-400 text-xs uppercase tracking-widest font-semibold">
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Hora</th>
                  <th className="px-6 py-4">Cancha</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reservas.map((reserva) => {
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
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor}`}>
                          {reserva.estado}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right space-x-2">
                        {reserva.estado === 'pendiente' ? (
                          <>
                            <button 
                              onClick={() => actualizarEstado(reserva.reserva_id, 'confirmada')}
                              className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-extrabold shadow-sm transition-colors"
                              title="Confirmar reserva"
                            >
                              Confirmar
                            </button>
                            <button 
                              onClick={() => actualizarEstado(reserva.reserva_id, 'cancelada')}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-extrabold shadow-sm transition-colors"
                              title="Cancelar reserva"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => setReservaSeleccionada(reserva)}
                            className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg text-xs font-bold transition-colors"
                          >
                            Ver Detalles
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
