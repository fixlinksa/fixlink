'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, Loader2, ArrowRight, Lock, Mail, User as UserIcon } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, collection, getDocs, limit, query } from 'firebase/firestore';

export default function SetupPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const router = useRouter();

  // Admin credentials from user request
  const adminEmail = 'admin@fixlink.org.za';
  const adminPassword = 'Sharne2010!';
  const adminName = 'System Admin';

  useEffect(() => {
    async function checkEmpty() {
      try {
        const q = query(collection(db, 'users'), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
          setIsEmpty(true);
        } else {
          // Already setup? Go to login
          router.push('/login');
        }
      } catch (err) {
        console.error('Setup check error:', err);
      } finally {
        setLoading(false);
      }
    }
    checkEmpty();
  }, [router]);

  const handleSetup = async () => {
    setSubmitting(true);
    setError(null);

    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
      const user = userCredential.user;

      // 2. Create Admin Profile in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: adminEmail,
        fullName: adminName,
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 3. Success!
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to initialize admin account.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isEmpty) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-primary/5 to-background">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl border border-border"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight uppercase italic mb-2">Platform <span className="text-primary">Setup</span></h1>
          <p className="text-muted-foreground font-medium italic">Initialize the primary administrator account for Fix Link.</p>
        </div>

        <div className="space-y-6 bg-muted/30 p-8 rounded-3xl border border-border/50 mb-10">
          <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
             <Mail className="w-4 h-4" /> <span>{adminEmail}</span>
          </div>
          <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
             <Lock className="w-4 h-4" /> <span>••••••••••••</span>
          </div>
          <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
             <UserIcon className="w-4 h-4" /> <span>{adminName}</span>
          </div>
        </div>

        {error && (
          <p className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center">
            {error}
          </p>
        )}

        <button 
          onClick={handleSetup}
          disabled={submitting}
          className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 uppercase tracking-tight text-sm"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>Initialize Admin <ArrowRight className="w-5 h-5" /></>
          )}
        </button>

        <p className="mt-8 text-center text-[10px] text-muted-foreground/40 font-black uppercase tracking-[0.2em]">
          One-time initialization only.
        </p>
      </motion.div>
    </div>
  );
}
