import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockAdminData)
    } as any)

    render(<AdminDashboard />)

    // Debe mostrar la bienvenida
    await waitFor(() => {
      expect(screen.getByText('Bienvenido de nuevo, Admin FootCall')).toBeInTheDocument()
    })

    // Debe mostrar la cancha disponible y su precio
    await waitFor(() => {
      expect(screen.getByText('Cancha 1 Principal')).toBeInTheDocument()
      expect(screen.getByText('$120,000')).toBeInTheDocument()
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

    const mockAdminData = {
      admin: { nombre: 'Admin FootCall' },
      canchas_disponibles: [],
      reservas_activas: [
        { reserva_id: 505, cliente_nombre: 'Juan Perez', cancha_id: 1, fecha: '2026-05-25', hora_inicio: '18:00', estado: 'pendiente' }
      ]
    }

    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockAdminData) // Primer GET
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ message: 'Success' }) // PATCH
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          admin: { nombre: 'Admin FootCall' },
          canchas_disponibles: [],
          reservas_activas: [
            { reserva_id: 505, cliente_nombre: 'Juan Perez', cancha_id: 1, fecha: '2026-05-25', hora_inicio: '18:00', estado: 'confirmada' }
          ]
        }) // Segundo GET (recarga)
      } as any)

    global.fetch = fetchMock

    render(<AdminDashboard />)

    // Esperar a que se pinte el botón de confirmar
    let confirmButton: HTMLElement | null = null
    await waitFor(() => {
      confirmButton = screen.getByRole('button', { name: 'Confirmar' })
      expect(confirmButton).toBeInTheDocument()
    })

    // Hacer click en confirmar
    fireEvent.click(confirmButton!)

    // Debe mostrar brevemente el bloqueo de pantalla (loading)
    expect(screen.getByText('Procesando solicitud')).toBeInTheDocument()

    // Esperar a que se complete y recargue la reserva en estado confirmada
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
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
