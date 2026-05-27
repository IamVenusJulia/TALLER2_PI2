"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [initial, setInitial] = useState("C");
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      if (session?.user?.user_metadata?.full_name) {
        setInitial(session.user.user_metadata.full_name.charAt(0).toUpperCase());
      } else if (session?.user?.email) {
        setInitial(session.user.email.charAt(0).toUpperCase());
      }
      setIsLoadingAuth(false);
    };
    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.replace("/login");
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-footcall-light flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-footcall-green border-t-transparent rounded-full"></div>
      </div>
    );
  }

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
                {initial}
              </div>
              <div className="border-l border-gray-200 h-6 mx-2 hidden sm:block"></div>
              <button onClick={handleLogout} className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors">
                Salir
              </button>
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
