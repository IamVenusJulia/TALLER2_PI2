"use client";

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Role-based routing logic
      const userRole = data.user?.user_metadata?.rol || (email.toLowerCase().includes('admin') ? 'admin' : 'cliente');
      if (userRole === 'admin') {
        router.push('/admin');
      } else {
        router.push('/cliente');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: nombre,
            apellido,
            telefono,
            rol: 'cliente'
          }
        }
      });

      if (error) throw error;

      if (data.session) {
        router.push('/cliente');
      } else {
        setSuccessMsg('¡Registro exitoso! Revisa tu correo de confirmación para activar tu cuenta.');
        setIsSignUp(false);
        setEmail('');
        setPassword('');
        setNombre('');
        setApellido('');
        setTelefono('');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/cliente`
        }
      });
      if (error) throw error;
    } catch (error: any) {
      setErrorMsg(error.message || 'Error al iniciar sesión con Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Lado izquierdo: Imagen / Branding */}
      <div className="hidden md:flex md:w-1/2 bg-footcall-dark relative justify-center items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-footcall-green-hover/80 to-footcall-dark/90 z-10" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1574629810360-7efbb1b272cb?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80')] bg-cover bg-center" />
        <div className="z-20 text-center p-8 max-w-lg">
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">La cancha te espera.</h1>
          <p className="text-footcall-light text-lg">Reserva, juega y administra tus partidos de fútbol 5 de forma inteligente con el primer agente de voz especializado.</p>
        </div>
      </div>

      {/* Lado derecho: Formulario de Login / Registro */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12 bg-background">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image 
              src="/LogoFinal.png" 
              alt="FootCall Logo" 
              width={180} 
              height={180} 
              style={{ height: 'auto' }}
              className="object-contain drop-shadow-md"
              priority
            />
          </div>

          <h2 className="text-3xl font-bold text-foreground mb-2 text-center tracking-tight">
            {isSignUp ? 'Crea tu cuenta' : 'Bienvenido a FootCall'}
          </h2>
          <p className="text-gray-500 mb-8 text-center">
            {isSignUp ? 'Regístrate para reservar tus canchas' : 'Ingresa a tu cuenta para continuar'}
          </p>

          <form className="space-y-5" onSubmit={isSignUp ? handleSignUp : handleLogin}>
            {errorMsg && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg text-center font-medium">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg text-center font-medium">
                {successMsg}
              </div>
            )}
            
             {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="nombre">Nombre</label>
                    <input 
                      id="nombre" 
                      type="text" 
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Juan" 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-footcall-green focus:border-transparent transition-all bg-white text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="apellido">Apellido</label>
                    <input 
                      id="apellido" 
                      type="text" 
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      placeholder="Pérez" 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-footcall-green focus:border-transparent transition-all bg-white text-gray-900"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="telefono">Teléfono de contacto</label>
                  <input 
                    id="telefono" 
                    type="tel" 
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="3001234567" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-footcall-green focus:border-transparent transition-all bg-white text-gray-900"
                    required
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="email">Correo electrónico</label>
              <input 
                id="email" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com" 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-footcall-green focus:border-transparent transition-all bg-white text-gray-900"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="password">Contraseña</label>
              <input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-footcall-green focus:border-transparent transition-all bg-white text-gray-900"
                required
              />
            </div>

            {!isSignUp && (
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center">
                  <input id="remember" type="checkbox" className="h-4 w-4 text-footcall-green focus:ring-footcall-green border-gray-300 rounded" />
                  <label htmlFor="remember" className="ml-2 block text-sm text-gray-600">Recuérdame</label>
                </div>
                <a href="#" className="text-sm font-semibold text-footcall-green hover:text-footcall-green-hover transition-colors">¿Olvidaste tu contraseña?</a>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white transition-all transform ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-footcall-green hover:bg-footcall-green-hover hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-footcall-green'}`}
            >
              {loading ? (isSignUp ? 'Creando cuenta...' : 'Iniciando sesión...') : (isSignUp ? 'Registrarse' : 'Iniciar Sesión')}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-background text-gray-500 font-medium">O continúa con</span>
              </div>
            </div>

            <div className="mt-6">
              <button 
                type="button" 
                onClick={handleGoogleLogin}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-gray-200 rounded-xl shadow-sm bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none transition-all transform hover:scale-[1.02]"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Iniciar sesión con Google
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-gray-500 font-medium">
            {isSignUp ? (
              <>
                ¿Ya tienes una cuenta?{' '}
                <button 
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="font-bold text-footcall-green hover:text-footcall-green-hover transition-colors focus:outline-none"
                >
                  Inicia sesión aquí
                </button>
              </>
            ) : (
              <>
                ¿No tienes una cuenta?{' '}
                <button 
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="font-bold text-footcall-green hover:text-footcall-green-hover transition-colors focus:outline-none"
                >
                  Regístrate aquí
                </button>
              </>
            )}
          </p>

        </div>
      </div>
    </div>
  );
}
