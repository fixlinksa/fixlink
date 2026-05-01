'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  UserPlus, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Eye,
  EyeOff,
  Hammer,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { syncUserProfile } from '@/lib/db';
import { triggerWelcomeEmail, triggerAdminProNotification } from '@/app/actions/auth';
import { useAuth } from '@/context/AuthContext';

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'tradesman' | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && profile?.onboardingCompleted) {
      router.push(profile.role === 'tradesman' ? '/dashboard/tradesman' : '/dashboard/customer');
    }
  }, [user, profile, authLoading, router]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      setError('Please select a role first.');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      // 1. Create Firebase Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // 2. Update Auth Profile
      await updateProfile(firebaseUser, { displayName: fullName });

      // 3. Sync Initial Profile to Firestore
      await syncUserProfile(firebaseUser.uid, {
        email: firebaseUser.email || '',
        fullName: fullName,
        role: role,
        onboardingCompleted: false, // Force onboarding next
      });

      // 4. Send Welcome Email (Server Action) - Non-blocking
      triggerWelcomeEmail(email, fullName).catch(emailErr => {
        console.error('Failed to send welcome email, but proceeding with registration:', emailErr);
      });

      // 5. Notify Admin of new Professional - Non-blocking
      if (role === 'tradesman') {
        triggerAdminProNotification({ 
          name: fullName, 
          email: email, 
          trade: 'New Professional (Pending Onboarding)' 
        }).catch(err => console.error('Admin notification failed:', err));
      }

      // 6. Redirect to onboarding
      router.push('/onboarding');
    } catch (err: any) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Try logging in.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'An unexpected error occurred.');
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
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6 bg-gradient-to-br from-background via-muted/50 to-background overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-white rounded-[3.5rem] p-10 md:p-16 shadow-2xl shadow-primary/5 border border-border relative overflow-hidden"
      >
        <div className="relative text-center space-y-12">
          {/* Header */}
          <div className="space-y-4">
            <Link href="/" className="inline-block transition-transform hover:scale-110">
               <img src="/FixLinkLogo.png" alt="Fix Link" className="w-24 h-24 mx-auto mix-blend-multiply" />
            </Link>
            <h1 className="text-4xl font-black tracking-tight uppercase italic text-foreground">Join the <span className="text-primary">Marketplace</span></h1>
            <p className="text-muted-foreground font-medium max-w-sm mx-auto">Create your professional profile and start hire or providing services today.</p>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <button
                  onClick={() => { setRole('customer'); setStep(2); }}
                  className={`group p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-6 text-center ${
                    role === 'customer' ? 'border-primary bg-primary/5' : 'border-muted bg-muted/20 hover:border-muted-foreground hover:bg-white'
                  }`}
                >
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all bg-white text-muted-foreground group-hover:scale-110 shadow-lg`}>
                    <UserIcon className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="font-black uppercase tracking-tighter text-lg mb-1">Customer</h3>
                    <p className="text-xs text-muted-foreground font-medium italic">I want to hire pros</p>
                  </div>
                </button>

                <button
                  onClick={() => { setRole('tradesman'); setStep(2); }}
                  className={`group p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-6 text-center ${
                    role === 'tradesman' ? 'border-primary bg-primary/5' : 'border-muted bg-muted/20 hover:border-muted-foreground hover:bg-white'
                  }`}
                >
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all bg-white text-muted-foreground group-hover:scale-110 shadow-lg`}>
                    <Hammer className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="font-black uppercase tracking-tighter text-lg mb-1">Professional</h3>
                    <p className="text-xs text-muted-foreground font-medium italic">I want to provide services</p>
                  </div>
                </button>
              </motion.div>
            ) : (
              <motion.form 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleCreateAccount} 
                className="space-y-6 text-left"
              >
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-destructive leading-relaxed">{error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Full Name</label>
                    <div className="relative group">
                      <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input 
                        required
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-muted/50 border-transparent p-6 rounded-2xl pl-16 text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Email Address</label>
                    <div className="relative group">
                      <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input 
                        required
                        type="email"
                        placeholder="john@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-muted/50 border-transparent p-6 rounded-2xl pl-16 text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Choose Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input 
                        required
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-muted/50 border-transparent p-6 rounded-2xl pl-16 pr-16 text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner"
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

                <div className="pt-4 flex flex-col gap-4">
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary text-white p-8 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    {isLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>Create My {role === 'tradesman' ? 'Professional' : 'Customer'} Account <CheckCircle2 className="w-5 h-5" /></>
                    )}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setStep(1)}
                    className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all text-center"
                  >
                    Wait, go back to role selection
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Already registered? <Link href="/login" className="text-primary hover:underline underline-offset-4 decoration-2">Sign In Instead</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
