'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, User as UserIcon, LogOut, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut, isAdmin } = useAuth();

  const isPublic = !pathname.includes('/dashboard') && !pathname.includes('/chat') && !pathname.includes('/profile') && !pathname.includes('/admin');
  
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
    setIsOpen(false);
  };

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Services', href: '/services' },
    { name: 'Contact', href: '/contact' },
  ];

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || !isPublic ? 'bg-white/80 backdrop-blur-xl border-b border-border py-4 shadow-sm' : 'bg-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
               <img 
                 src="/FixLinkLogo.png" 
                 alt="Fix Link" 
                 className="w-full h-full object-contain group-hover:scale-110 transition-transform mix-blend-multiply" 
               />
            </div>
            <span className="font-black text-2xl tracking-tighter text-primary uppercase">FixLink</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href}
                className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors relative group py-2"
              >
                {link.name}
                <span className={`absolute -bottom-1 left-0 h-0.5 bg-primary transition-all duration-300 ${
                  pathname === link.href ? 'w-full' : 'w-0 group-hover:w-full'
                }`} />
              </Link>
            ))}

            {user ? (
              <div className="flex items-center gap-6 pl-6 border-l border-border">
                {isAdmin && (
                  <Link href="/admin/dashboard" className="flex items-center gap-2 text-xs font-black text-accent uppercase tracking-widest bg-accent/10 px-4 py-2 rounded-xl">
                    <ShieldCheck className="w-4 h-4" /> Admin
                  </Link>
                )}
                <Link href="/dashboard" className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2 group">
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
                <div className="relative group/user">
                   <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-black border border-primary/10 cursor-pointer overflow-hidden backdrop-blur-sm">
                      {profile?.imageUrl ? (
                        <img src={profile.imageUrl} alt={profile.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-5 h-5" />
                      )}
                   </div>
                   
                   {/* Profile Dropdown */}
                   <div className="absolute right-0 top-full pt-4 opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all duration-300">
                      <div className="bg-white border border-border rounded-3xl shadow-2xl p-4 min-w-[200px]">
                         <div className="pb-4 mb-4 border-b border-border">
                            <p className="text-sm font-black truncate">{profile?.fullName || 'User'}</p>
                            <p className="text-[10px] text-muted-foreground truncate uppercase font-bold tracking-widest">{profile?.role}</p>
                         </div>
                         <div className="space-y-1">
                            <Link href="/profile" className="flex items-center gap-2 p-3 text-sm font-bold text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-xl transition-all">
                               <UserIcon className="w-4 h-4" /> My Profile
                            </Link>
                            <button 
                              onClick={handleLogout}
                              className="w-full flex items-center gap-2 p-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                               <LogOut className="w-4 h-4" /> Logout
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link href="/login" className="text-sm font-bold text-muted-foreground hover:text-primary px-4 py-2">
                  Sign In
                </Link>
                <Link href="/signup" className="px-6 py-3 bg-primary text-white text-sm font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-xl bg-muted/50 text-foreground"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-white pt-24 px-6 md:hidden"
          >
            <div className="flex flex-col gap-8">
              {navLinks.map((link) => (
                <Link 
                  key={link.name} 
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="text-2xl font-black text-foreground hover:text-primary transition-colors"
                >
                  {link.name}
                </Link>
              ))}
              
              <div className="h-px bg-border my-4" />
              
              {user ? (
                <div className="flex flex-col gap-6">
                   {isAdmin && (
                     <Link href="/admin/dashboard" onClick={() => setIsOpen(false)} className="text-xl font-black text-accent flex items-center gap-2">
                       <ShieldCheck className="w-6 h-6" /> Admin Panel
                     </Link>
                   )}
                   <Link href="/dashboard" onClick={() => setIsOpen(false)} className="text-xl font-black text-primary flex items-center gap-2">
                     <LayoutDashboard className="w-6 h-6" /> Dashboard
                   </Link>
                   <Link href="/profile" onClick={() => setIsOpen(false)} className="text-xl font-black text-foreground flex items-center gap-2">
                     <UserIcon className="w-6 h-6" /> Profile
                   </Link>
                   <button onClick={handleLogout} className="flex items-center gap-3 text-red-500 text-xl font-black">
                     <LogOut className="w-6 h-6" /> Sign Out
                   </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <Link href="/signup" onClick={() => setIsOpen(false)} className="w-full py-5 bg-primary text-white text-center font-bold rounded-2xl shadow-xl shadow-primary/20">
                    Get Started
                  </Link>
                  <Link href="/login" onClick={() => setIsOpen(false)} className="w-full py-5 bg-muted text-foreground text-center font-bold rounded-2xl">
                    Sign In
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
