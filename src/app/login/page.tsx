'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  LogIn, 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Eye,
  EyeOff,
  User as UserIcon
} from 'lucide-react';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (profile?.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (profile?.role === 'tradesman') {
        router.push('/dashboard/tradesman');
      } else {
        router.push('/dashboard/customer');
      }
    }
  }, [user, profile, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Admin Alias Logic
    let loginEmail = email;
    if (email.toLowerCase() === 'admin') {
      loginEmail = 'admin@fixlink.org.za';
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      // Success - useAuth will handle redirection via useEffect
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('An unexpected error occurred. Please try again later.');
      }
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6 bg-gradient-to-br from-background via-muted/50 to-background">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[3rem] p-10 md:p-12 shadow-2xl shadow-primary/5 border border-border relative overflow-hidden"
      >
        {/* Abstract Background Element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent/5 rounded-full blur-3xl" />

        <div className="relative text-center space-y-8">
          <div className="space-y-4">
            <Link href="/" className="inline-block transition-transform hover:scale-110">
               <img src="/FixLinkLogo.png" alt="Fix Link" className="w-24 h-24 mx-auto mix-blend-multiply" />
            </Link>
            <h1 className="text-4xl font-black tracking-tight uppercase italic text-foreground">Welcome <span className="text-primary">Back</span></h1>
            <p className="text-muted-foreground font-medium">Log in to manage your Fix Link marketplace account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 text-left">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-destructive/10 border border-destructive/20 p-4 rounded-2xl flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-destructive leading-relaxed">{error}</p>
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Email Address or Username</label>
                <div className="relative group">
                  <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-muted/50 border-transparent p-6 rounded-2xl pl-16 text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Secure Password</label>
                <div className="relative group">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-muted/50 border-transparent p-6 rounded-2xl pl-16 pr-16 text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner placeholder:text-muted-foreground/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white p-6 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>Sign In to Fix Link <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </form>

          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Don't have an account? <Link href="/signup" className="text-primary hover:underline underline-offset-4 decoration-2">Create One Free</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
