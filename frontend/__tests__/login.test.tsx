import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/app/login/page'
import { supabase } from '@/lib/supabase'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: mockPush,
      prefetch: () => null,
    }
  },
}))

// Mock supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
      signUp: jest.fn(),
    },
  },
}))

// Mock next/image since next/image doesn't play well in jsdom env by default sometimes
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />
  },
}))

describe('LoginPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('debe renderizar los elementos del formulario de login', () => {
    render(<LoginPage />)
    
    // Verificar que el título y descripción estén en pantalla
    expect(screen.getByText('Bienvenido a FootCall')).toBeInTheDocument()
    expect(screen.getByText('Ingresa a tu cuenta para continuar')).toBeInTheDocument()
    
    // Verificar campos del formulario
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    
    // Verificar el botón de enviar
    expect(screen.getByRole('button', { name: 'Iniciar Sesión' })).toBeInTheDocument()
  })

  test('debe permitir escribir en los campos de entrada', () => {
    render(<LoginPage />)
    
    const emailInput = screen.getByLabelText('Correo electrónico') as HTMLInputElement
    const passwordInput = screen.getByLabelText('Contraseña') as HTMLInputElement
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    
    expect(emailInput.value).toBe('test@example.com')
    expect(passwordInput.value).toBe('password123')
  })

  test('debe iniciar sesion exitosamente y redirigir al cliente si no es admin', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: { email: 'cliente@example.com' } },
      error: null,
    })

    render(<LoginPage />)
    
    const emailInput = screen.getByLabelText('Correo electrónico')
    const passwordInput = screen.getByLabelText('Contraseña')
    const submitButton = screen.getByRole('button', { name: 'Iniciar Sesión' })
    
    fireEvent.change(emailInput, { target: { value: 'cliente@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'cliente@example.com',
        password: 'password123',
      })
      expect(mockPush).toHaveBeenCalledWith('/cliente')
    })
  })

  test('debe iniciar sesion exitosamente y redirigir al dashboard de admin si el correo contiene "admin"', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: { email: 'admin@footcall.com' } },
      error: null,
    })

    render(<LoginPage />)
    
    const emailInput = screen.getByLabelText('Correo electrónico')
    const passwordInput = screen.getByLabelText('Contraseña')
    const submitButton = screen.getByRole('button', { name: 'Iniciar Sesión' })
    
    fireEvent.change(emailInput, { target: { value: 'admin@footcall.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin')
    })
  })

  test('debe mostrar un mensaje de error si las credenciales fallan', async () => {
    const mockError = { message: 'Credenciales inválidas' };
    (supabase.auth.signInWithPassword as jest.Mock).mockRejectedValue(mockError)

    render(<LoginPage />)
    
    const emailInput = screen.getByLabelText('Correo electrónico')
    const passwordInput = screen.getByLabelText('Contraseña')
    const submitButton = screen.getByRole('button', { name: 'Iniciar Sesión' })
    
    fireEvent.change(emailInput, { target: { value: 'incorrecto@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument()
    })
  })

  test('debe cambiar a modo registro, registrarse exitosamente y mostrar mensaje de éxito', async () => {
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    })

    render(<LoginPage />)
    
    // Cambiar a modo registro
    const registerToggle = screen.getByRole('button', { name: 'Regístrate aquí' })
    fireEvent.click(registerToggle)
    
    // Verificar que cambie el título
    expect(screen.getByText('Crea tu cuenta')).toBeInTheDocument()
    
    const nombreInput = screen.getByLabelText('Nombre')
    const apellidoInput = screen.getByLabelText('Apellido')
    const telefonoInput = screen.getByLabelText('Teléfono de contacto')
    const emailInput = screen.getByLabelText('Correo electrónico')
    const passwordInput = screen.getByLabelText('Contraseña')
    const submitButton = screen.getByRole('button', { name: 'Registrarse' })
    
    fireEvent.change(nombreInput, { target: { value: 'Juan' } })
    fireEvent.change(apellidoInput, { target: { value: 'Pérez' } })
    fireEvent.change(telefonoInput, { target: { value: '3001234567' } })
    fireEvent.change(emailInput, { target: { value: 'nuevo@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'nuevoPass123' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'nuevo@example.com',
        password: 'nuevoPass123',
        options: {
          data: {
            full_name: 'Juan',
            apellido: 'Pérez',
            telefono: '3001234567',
            rol: 'cliente',
          },
        },
      })
      expect(screen.getByText('¡Registro exitoso! Revisa tu correo de confirmación para activar tu cuenta.')).toBeInTheDocument()
    })
  })

  test('debe llamar a signInWithOAuth con google al hacer click en el botón de Google', async () => {
    (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
      data: {},
      error: null,
    })

    render(<LoginPage />)
    
    const googleButton = screen.getByRole('button', { name: /Iniciar sesión con Google/i })
    fireEvent.click(googleButton)
    
    await waitFor(() => {
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining('/cliente'),
        },
      })
    })
  })
})
