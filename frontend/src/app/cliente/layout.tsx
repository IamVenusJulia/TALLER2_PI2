import Image from "next/image";
import Link from "next/link";

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-footcall-light flex flex-col">
      {/* Navbar Superior */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center">
              <Image src="/LogoFinal.png" alt="FootCall Logo" width={140} height={45} style={{ height: 'auto' }} className="object-contain" priority />
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-semibold text-gray-600 hidden sm:block">Mi Cuenta</span>
              <div className="h-10 w-10 rounded-full bg-footcall-green flex items-center justify-center text-white font-bold shadow-sm">
                D
              </div>
              <div className="border-l border-gray-200 h-6 mx-2 hidden sm:block"></div>
              <Link href="/login" className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors">
                Salir
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
