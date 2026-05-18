"use client";

import { useState } from "react";
import { mockHistorialCliente } from "@/lib/mocks";

export default function ClienteDashboard() {
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState("");
  
  const data = mockHistorialCliente;

  const toggleVoiceAgent = () => {
    if (!isListening) {
      setIsListening(true);
      setTranscription("Escuchando... ¿En qué te puedo ayudar hoy?");
    } else {
      setIsListening(false);
      setTranscription("Quiero reservar la cancha principal para este viernes a las 8 PM.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header Cliente */}
      <header>
        <h1 className="text-3xl font-extrabold text-footcall-dark tracking-tight">Hola, {data.usuario.nombre} 👋</h1>
        <p className="text-gray-500 mt-1 font-medium">¿Listo para organizar tu próximo partido?</p>
      </header>

      {/* Zona Principal: Agente de Voz */}
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-footcall-green to-footcall-green-hover"></div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Asistente de Reservas por Voz</h2>
        
        {/* Botón de Micrófono Animado */}
        <div className="relative flex justify-center items-center mb-8">
          {/* Ondas expansivas cuando está escuchando */}
          {isListening && (
            <>
              <div className="absolute w-32 h-32 bg-footcall-green/20 rounded-full animate-ping"></div>
              <div className="absolute w-40 h-40 bg-footcall-green/10 rounded-full animate-pulse delay-150"></div>
            </>
          )}
          
          <button 
            onClick={toggleVoiceAgent}
            className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform hover:scale-105 ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-footcall-green hover:bg-footcall-green-hover'}`}
            aria-label={isListening ? "Detener grabación" : "Iniciar grabación"}
          >
            {isListening ? (
              /* Icono de Detener (Stop) */
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm3 2a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H6z" clipRule="evenodd"></path>
              </svg>
            ) : (
              /* Icono de Micrófono */
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
              </svg>
            )}
          </button>
        </div>

        {/* Zona de Transcripción / Feedback */}
        <div className={`w-full max-w-2xl bg-gray-50 rounded-2xl p-6 min-h-[120px] flex items-center justify-center border transition-all duration-300 ${isListening ? 'border-footcall-green ring-2 ring-footcall-green/20 shadow-inner' : 'border-gray-200'}`}>
          <p className={`text-center font-medium ${transcription ? 'text-gray-800 text-lg' : 'text-gray-400'}`}>
            {transcription || 'Toca el micrófono y dime qué cancha quieres reservar...'}
          </p>
        </div>
      </section>

      {/* Historial de Reservas del Cliente */}
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900">Tu Historial de Reservas</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-100 text-gray-400 text-xs uppercase tracking-widest font-semibold">
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Hora</th>
                <th className="px-6 py-4">Cancha</th>
                <th className="px-6 py-4">Pago</th>
                <th className="px-6 py-4 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.historial.map((reserva) => {
                let statusColor = "bg-gray-100 text-gray-800";
                if (reserva.estado === "confirmada") statusColor = "bg-green-100 text-green-800";
                if (reserva.estado === "pendiente") statusColor = "bg-yellow-100 text-yellow-800";
                if (reserva.estado === "cancelada") statusColor = "bg-red-100 text-red-800";

                return (
                  <tr key={reserva.reserva_id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-5 text-gray-900 font-bold">{reserva.fecha}</td>
                    <td className="px-6 py-5 text-gray-600 font-medium">{reserva.hora_inicio} - {reserva.hora_fin}</td>
                    <td className="px-6 py-5">
                      <p className="text-gray-900 font-bold">{reserva.cancha}</p>
                      <p className="text-xs text-gray-500 capitalize">{reserva.superficie}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-footcall-green font-bold">${reserva.total_pago.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 capitalize">{reserva.metodo_pago}</p>
                    </td>
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
      </section>
    </div>
  );
}
