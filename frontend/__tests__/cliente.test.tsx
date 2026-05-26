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

    // 2. Mock de respuesta de API de historial
    const mockHistorial = {
      message: 'Historial de reservas obtenido con éxito',
      usuario_autenticado: {
        id: 'usr_999',
        nombre: 'Daniel Arias',
        rol: 'cliente'
      }
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockHistorial)
    } as any)

    render(<ClienteDashboard />)

    // Debe mostrar la bienvenida al usuario
    await waitFor(() => {
      expect(screen.getByText(/Daniel Arias/)).toBeInTheDocument()
    })

    // Debe mostrar las reservas de la tabla (cargadas desde mocks de fallback)
    await waitFor(() => {
      expect(screen.getAllByText(/Cancha 1/)[0]).toBeInTheDocument()
    })
  })
})
