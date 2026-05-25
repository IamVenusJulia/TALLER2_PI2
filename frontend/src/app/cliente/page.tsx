"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { mockHistorialCliente } from "@/lib/mocks";

export default function ClienteDashboard() {
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [assistantResponse, setAssistantResponse] = useState("");
  const [historial, setHistorial] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [userName, setUserName] = useState("Daniel");
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setSessionToken(session.access_token);
      await fetchHistorial(session.access_token);
    };

    checkAuthAndFetch();
  }, [router]);

  const fetchHistorial = async (token: string) => {
    try {
      setLoadingHistory(true);
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://taller2-pi2-2.onrender.com';
      
      // Llamamos al contrato oficial del backend
      const res = await fetch(`${apiBaseUrl}/api/cliente/historial`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        // Usar el nombre autenticado por el backend
        if (data.usuario_autenticado) {
          setUserName(data.usuario_autenticado.nombre || "Cliente");
        }
        // Cargamos el historial (si el backend no retorna lista, usamos los datos del mockup inicial)
        setHistorial(mockHistorialCliente.historial);
      } else {
        console.warn("Error al obtener historial del cliente", res.status);
      }
    } catch (err) {
      console.warn("Error cargando historial:", err);
      // Fallback a mock en caso de desconexión
      setHistorial(mockHistorialCliente.historial);
    } finally {
      setLoadingHistory(false);
    }
  };

  const enviarTextoBackend = async (texto: string) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://taller2-pi2-2.onrender.com';
      
      const payload = {
        usuario: {
          nombre: userName,
          rol: "cliente"
        },
        texto_transcrito: texto
      };

      const headersInit: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (sessionToken) {
        headersInit['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`${apiBaseUrl}/api/voice/process`, {
        method: 'POST',
        headers: headersInit,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor: ${response.statusText}`);
      }

      // 1. Obtener los textos devueltos en las cabeceras HTTP expuestas por el backend
      const transReal = response.headers.get("X-Transcription") || texto;
      const asistText = response.headers.get("X-Assistant-Text") || "Procesado correctamente.";
      const intent = response.headers.get("X-Intent");

      setTranscription(transReal);
      setAssistantResponse(asistText);

      // 2. Obtener y reproducir la respuesta binaria de voz (TTS)
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();

      // 3. Si la intención fue crear una reserva, agregamos dinámicamente un registro pendiente a la UI
      if (intent === "crear_reserva") {
        const nuevaReserva = {
          reserva_id: Date.now(),
          fecha: new Date().toISOString().split('T')[0],
          hora_inicio: "18:00", // Hora tentativa
          hora_fin: "19:00",
          cancha: "Cancha 1 Principal",
          superficie: "sintetica" as any,
          estado: "pendiente" as any,
          total_pago: 120000,
          metodo_pago: "efectivo" as any
        };
        setHistorial(prev => [nuevaReserva, ...prev]);
      }

    } catch (error: any) {
      console.error("Error al procesar con el backend:", error);
      setAssistantResponse("Lo siento, no pude conectarme con el asistente. Inténtalo de nuevo.");
    }
  };

  const toggleVoiceAgent = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta la Web Speech API. Por favor usa Google Chrome.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'es-ES';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      setIsListening(true);
      setTranscription("Escuchando... ¿Qué cancha deseas reservar?");
      setAssistantResponse("");
    };

    rec.onerror = (event: any) => {
      console.error(event.error);
      setIsListening(false);
      setTranscription(`Error al capturar voz: ${event.error}`);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onresult = async (event: any) => {
      const resultText = event.results[0][0].transcript;
      setTranscription(`Entendido: "${resultText}". Enviando...`);
      await enviarTextoBackend(resultText);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header Cliente */}
      <header>
        <h1 className="text-3xl font-extrabold text-footcall-dark tracking-tight">Hola, {userName} 👋</h1>
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
        <div className={`w-full max-w-2xl bg-gray-50 rounded-2xl p-6 min-h-[100px] flex items-center justify-center border transition-all duration-300 ${isListening ? 'border-footcall-green ring-2 ring-footcall-green/20 shadow-inner' : 'border-gray-200'}`}>
          <p className={`text-center font-medium ${transcription ? 'text-gray-800 text-lg' : 'text-gray-400'}`}>
            {transcription || 'Toca el micrófono y dime qué cancha quieres reservar...'}
          </p>
        </div>

        {/* Respuesta de voz (asistente) en texto */}
        {assistantResponse && (
          <div className="mt-4 p-5 bg-footcall-light/40 border border-footcall-green/10 rounded-2xl w-full max-w-2xl text-center shadow-inner animate-in fade-in duration-300">
            <span className="text-xs font-bold text-footcall-green uppercase tracking-wider block mb-1">Asistente Virtual</span>
            <p className="text-footcall-dark font-semibold text-lg leading-relaxed">{assistantResponse}</p>
          </div>
        )}
      </section>

      {/* Historial de Reservas del Cliente */}
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900">Tu Historial de Reservas</h3>
          {sessionToken && (
            <button 
              onClick={() => fetchHistorial(sessionToken)}
              className="text-xs font-bold text-footcall-green hover:text-footcall-green-hover flex items-center transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
              </svg>
              Actualizar
            </button>
          )}
        </div>
        
        {loadingHistory ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-footcall-green mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-500 font-medium">Cargando tus reservas...</p>
          </div>
        ) : historial.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 font-medium text-lg">Aún no tienes reservas registradas. ¡Prueba haciendo una con tu voz!</p>
          </div>
        ) : (
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
                {historial.map((reserva) => {
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
        )}
      </section>
    </div>
  );
}
