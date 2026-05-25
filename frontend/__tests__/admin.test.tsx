import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminDashboard from '@/app/admin/page'
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

describe('AdminDashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  test('debe cargar y renderizar el panel de control del administrador', async () => {
    // 1. Mock de sesión de administrador
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          access_token: 'admin-jwt-token',
          user: {
            email: 'admin@footcall.com',
            user_metadata: { full_name: 'Admin FootCall', rol: 'admin' }
          }
        }
      }
    })

    // 2. Mock de API de panel admin
    const mockAdminData = {
      admin: { nombre: 'Admin FootCall' },
      canchas_disponibles: [
        { cancha_id: 1, nombre: 'Cancha 1 Principal', tipo_superficie: 'sintetica', precio_por_hora: 120000 }
      ],
      reservas_activas: [
        { reserva_id: 505, cliente_nombre: 'Juan Perez', cancha_id: 1, fecha: '2026-05-25', hora_inicio: '18:00', estado: 'pendiente' }
      ]
    }

    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.toString().includes('/api/admin/reservas')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAdminData)
        } as any)
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    render(<AdminDashboard />)

    // Debe mostrar la bienvenida
    await waitFor(() => {
      expect(screen.getByText('Bienvenido de nuevo, Admin FootCall')).toBeInTheDocument()
    })

    // Debe mostrar la cancha disponible
    await waitFor(() => {
      expect(screen.getByText('Cancha 1 Principal')).toBeInTheDocument()
      expect(screen.getByText(/120/)).toBeInTheDocument() // Búsqueda independiente de formato
    })

    // Debe mostrar la reserva activa de Juan Perez
    await waitFor(() => {
      expect(screen.getByText('Juan Perez')).toBeInTheDocument()
      expect(screen.getByText('pendiente')).toBeInTheDocument()
    })
  })

  test('debe disparar la actualizacion de estado al confirmar una reserva (HU-17)', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          access_token: 'admin-jwt-token',
          user: { email: 'admin@footcall.com', user_metadata: { rol: 'admin' } }
        }
      }
    })

    let estadoReserva = 'pendiente';

    global.fetch = jest.fn().mockImplementation((url, options) => {
      const urlStr = url.toString();
      const method = options?.method || 'GET';
      
      if (method === 'PATCH' && urlStr.includes('/api/admin/reservas/505/estado')) {
        const body = JSON.parse(options.body);
        estadoReserva = body.estado;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'Success', reserva: { estado: body.estado } })
        } as any);
      }
      
      if (method === 'GET' && urlStr.includes('/api/admin/reservas')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            admin: { nombre: 'Admin FootCall' },
            canchas_disponibles: [],
            reservas_activas: [
              { reserva_id: 505, cliente_nombre: 'Juan Perez', cancha_id: 1, fecha: '2026-05-25', hora_inicio: '18:00', estado: estadoReserva }
            ]
          })
        } as any);
      }
      
      return Promise.reject(new Error(`Unhandled fetch: ${method} ${urlStr}`));
    });

    render(<AdminDashboard />)

    // Esperar a que se pinte el botón de confirmar
    let confirmButton: HTMLElement | null = null
    await waitFor(() => {
      confirmButton = screen.getByRole('button', { name: 'Confirmar' })
      expect(confirmButton).toBeInTheDocument()
    })

    // Hacer click en confirmar
    fireEvent.click(confirmButton!)

    // Debe mostrar el bloqueo de pantalla (loading)
    expect(screen.getByText('Procesando solicitud')).toBeInTheDocument()

    // Esperar a que se complete y recargue la reserva en estado confirmada
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/reservas/505/estado'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ estado: 'confirmada' })
        })
      )
      expect(screen.getByText('confirmada')).toBeInTheDocument()
    })
  })
})
