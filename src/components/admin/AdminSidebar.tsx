'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Hammer, 
  Settings, 
  BarChart3, 
  LogOut,
  ShieldCheck,
  Zap,
  X,
  BookOpen
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS = [
  { id: 'overview', label: 'Platform Pulse', icon: BarChart3, href: '/admin/dashboard' },
  { id: 'professionals', label: 'Pro Fleet', icon: Hammer, href: '/admin/professionals' },
  { id: 'customers', label: 'Customer Base', icon: Users, href: '/admin/customers' },
  { id: 'team', label: 'Team Matrix', icon: ShieldCheck, href: '/admin/team' },
  { id: 'info', label: 'Intel Manual', icon: BookOpen, href: '/admin/info' },
];

export default function AdminSidebar({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (val: boolean) => void }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  return (
    <motion.div 
      initial={false}
      animate={{ x: isOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 768 ? -window.innerWidth : -320) }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-full md:w-80 h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0 z-50 shadow-[20px_0_50px_rgba(0,0,0,0.2)]"
    >
      {/* Sidebar Header */}
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-2xl shadow-primary/20 group-hover:scale-110 transition-all italic tracking-tighter">
            FL
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter uppercase italic">Fix Link</h1>
            <div className="flex items-center gap-1 text-[10px] uppercase font-black tracking-widest text-primary italic">
              <ShieldCheck className="w-3 h-3" />
              Admin Portal
            </div>
          </div>
        </Link>
        <button 
          onClick={() => setIsOpen(false)}
          className="md:hidden p-2 hover:bg-white/5 rounded-xl transition-colors"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.id} 
              href={item.href}
              className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all group relative overflow-hidden ${
                isActive ? 'text-white shadow-xl shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className={`w-5 h-5 relative z-10 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-primary'}`} />
              <span className="relative z-10">{item.label}</span>
              {isActive && (
                <motion.div 
                  layoutId="active-pill"
                  className="absolute inset-0 bg-primary z-0"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-6 border-t border-white/5 space-y-4">
        <div className="px-6 py-5 bg-white/5 rounded-[2rem] border border-white/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-[1rem] bg-accent flex items-center justify-center font-black text-white italic">
            {profile?.fullName?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-black truncate uppercase tracking-tighter">{profile?.fullName || 'Active Admin'}</p>
            <p className="text-[10px] font-medium text-slate-500 truncate lowercase italic">Administrator</p>
          </div>
        </div>
        
        <button 
          onClick={signOut}
          className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[11px] md:text-xs uppercase tracking-widest text-red-100 bg-red-500/10 hover:bg-red-500/20 transition-all border border-red-500/20 shadow-lg shadow-red-500/5 active:scale-95"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="truncate">Terminate Session</span>
        </button>
      </div>

      {/* Decorative Glow */}
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
    </motion.div>
  );
}
