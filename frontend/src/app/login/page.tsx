import Image from 'next/image';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Lado izquierdo: Imagen / Branding (Oculto en móviles muy pequeños, visible de tablet en adelante) */}
      <div className="hidden md:flex md:w-1/2 bg-footcall-dark relative justify-center items-center overflow-hidden">
        {/* Usamos un div con gradiente oscuro para asegurar que el texto sea legible sobre la imagen de fondo */}
        <div className="absolute inset-0 bg-gradient-to-br from-footcall-green-hover/80 to-footcall-dark/90 z-10" />
        
        {/* Imagen de fondo sacada de Unsplash como placeholder visual del campo de fútbol */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1574629810360-7efbb1b272cb?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80')] bg-cover bg-center" />
        
        <div className="z-20 text-center p-8 max-w-lg">
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">La cancha te espera.</h1>
          <p className="text-footcall-light text-lg">Reserva, juega y administra tus partidos de fútbol 5 de forma inteligente con el primer agente de voz especializado.</p>
        </div>
      </div>

      {/* Lado derecho: Formulario de Login */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12 bg-background">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image 
              src="/LogoFinal.png" 
              alt="FootCall Logo" 
              width={180} 
              height={180} 
              className="object-contain drop-shadow-md"
              priority
            />
          </div>

          <h2 className="text-3xl font-bold text-foreground mb-2 text-center tracking-tight">Bienvenido a FootCall</h2>
          <p className="text-gray-500 mb-8 text-center">Ingresa a tu cuenta para continuar</p>

          <form className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="email">Correo electrónico</label>
              <input 
                id="email" 
                type="email" 
                placeholder="tu@correo.com" 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-footcall-green focus:border-transparent transition-all bg-white"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5" htmlFor="password">Contraseña</label>
              <input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-footcall-green focus:border-transparent transition-all bg-white"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center">
                <input id="remember" type="checkbox" className="h-4 w-4 text-footcall-green focus:ring-footcall-green border-gray-300 rounded" />
                <label htmlFor="remember" className="ml-2 block text-sm text-gray-600">Recuérdame</label>
              </div>
              <a href="#" className="text-sm font-semibold text-footcall-green hover:text-footcall-green-hover transition-colors">¿Olvidaste tu contraseña?</a>
            </div>

            <button 
              type="button" 
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-footcall-green hover:bg-footcall-green-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-footcall-green transition-all transform hover:scale-[1.02]"
            >
              Iniciar Sesión
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
                className="w-full flex justify-center items-center py-3.5 px-4 border border-gray-200 rounded-xl shadow-sm bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none transition-all transform hover:scale-[1.02]"
              >
                {/* SVG Icon of Google */}
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
            ¿No tienes una cuenta? <a href="#" className="font-bold text-footcall-green hover:text-footcall-green-hover transition-colors">Regístrate aquí</a>
          </p>

        </div>
      </div>
    </div>
  );
}
