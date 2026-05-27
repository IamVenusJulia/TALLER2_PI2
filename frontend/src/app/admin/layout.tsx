"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

function SidebarNavigation() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "calendario";

  return (
    <nav className="flex-1 px-4 py-6 space-y-2">
      <Link 
        href="/admin?tab=calendario" 
        className={`flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all ${
          tab === "calendario" 
            ? "text-white bg-footcall-green shadow-sm" 
            : "text-gray-600 hover:bg-gray-50 hover:text-footcall-green"
        }`}
      >
        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Calendario
      </Link>
      <Link 
        href="/admin?tab=clientes" 
        className={`flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all ${
          tab === "clientes" 
            ? "text-white bg-footcall-green shadow-sm" 
            : "text-gray-600 hover:bg-gray-50 hover:text-footcall-green"
        }`}
      >
        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Clientes
      </Link>
    </nav>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace("/login");
        return;
      }
      setIsLoadingAuth(false);
    };
    fetchUser();

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-footcall-light flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-footcall-green border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-footcall-light flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="h-full flex flex-col">
          <div className="h-20 flex items-center px-6 border-b border-gray-100">
            <Image src="/LogoFinal.png" alt="FootCall Logo" width={140} height={45} style={{ height: 'auto' }} className="object-contain" priority />
          </div>
          <Suspense fallback={<div className="flex-1 px-4 py-6 text-sm text-gray-400">Cargando navegación...</div>}>
            <SidebarNavigation />
          </Suspense>
          <div className="p-4 border-t border-gray-100">
            <button onClick={handleLogout} className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
