import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import ClienteDashboard from '@/app/cliente/page'
import { supabase } from '@/lib/supabase'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      prefetch: () => null,
    }
  },
}))

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
  },
}))

// Mock window.Audio and URL.createObjectURL
beforeAll(() => {
  global.Audio = class {
    play = jest.fn().mockResolvedValue(undefined)
  } as any;
  global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-audio-url')
  
  // Mock SpeechRecognition
  const MockSpeechRecognition = class {
    lang = 'es-ES'
    continuous = false
    interimResults = false
    start = jest.fn()
    stop = jest.fn()
    onstart = jest.fn()
    onerror = jest.fn()
    onend = jest.fn()
    onresult = jest.fn()
  };
  (global as any).webkitSpeechRecognition = MockSpeechRecognition;
  (global as any).SpeechRecognition = MockSpeechRecognition;
})

describe('ClienteDashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  test('debe cargar y mostrar las reservas del cliente exitosamente', async () => {
    // 1. Mock de sesión activa
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-jwt-token-123',
          user: {
            email: 'daniel@example.com',
            user_metadata: { full_name: 'Daniel Arias' }
          }
        }
      }
    })

    // 2. Mock de respuesta de API de reservas
    const mockReservas = [
      {
        reserva_id: 101,
        fecha: '2026-05-20',
        hora_inicio: '18:00',
        hora_fin: '19:00',
        cancha: 'Cancha 1 Principal',
        superficie: 'sintetica',
        estado: 'confirmada',
        total_pago: 120000,
        metodo_pago: 'online'
      }
    ]

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockReservas)
    } as any)

    render(<ClienteDashboard />)

    // Debe mostrar la bienvenida al usuario
    await waitFor(() => {
      expect(screen.getByText('Hola, Daniel Arias 👋')).toBeInTheDocument()
    })

    // Debe mostrar la reserva cargada en la tabla
    await waitFor(() => {
      expect(screen.getByText('Cancha 1 Principal')).toBeInTheDocument()
      expect(screen.getByText('18:00 - 19:00')).toBeInTheDocument()
      expect(screen.getByText('confirmada')).toBeInTheDocument()
    })
  })

  test('debe mostrar mensaje amigable si el cliente no posee reservas (HU-14)', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-jwt-token-123',
          user: {
            email: 'daniel@example.com',
            user_metadata: { full_name: 'Daniel Arias' }
          }
        }
      }
    })

    // API retorna lista vacía
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([])
    } as any)

    render(<ClienteDashboard />)

    // Comprobar mensaje de validación de la HU-14
    await waitFor(() => {
      expect(screen.getByText('Aún no tienes reservas registradas. ¡Prueba haciendo una con tu voz!')).toBeInTheDocument()
    })
  })
})
