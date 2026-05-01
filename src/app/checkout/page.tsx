'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getJob, updateJob, createNotification } from '@/lib/db';
import { Loader2, ShieldCheck, CreditCard, CheckCircle2, Lock, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const jobId = searchParams.get('jobId');
  const amount = searchParams.get('amount');
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [job, setJob] = useState<any>(null);

  useEffect(() => {
    if (jobId) {
      getJob(jobId).then(setJob).finally(() => setLoading(false));
    }
  }, [jobId]);

  const handlePayment = async () => {
    setProcessing(true);
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      if (jobId) {
        await updateJob(jobId, {
          status: 'accepted',
          depositPaid: true,
          depositPaidAt: new Date(),
          updatedAt: new Date()
        });

        if (job?.tradesmanId) {
          await createNotification({
            userId: job.tradesmanId,
            type: 'payment',
            title: 'Deposit Paid!',
            message: `The deposit of R${amount} for "${job.title}" has been paid. You can now start the mission.`,
            jobId: jobId
          });
        }
      }
      setSuccess(true);
      setTimeout(() => {
        router.push(`/jobs/view?id=${jobId}`);
      }, 3000);
    } catch (err) {
      console.error(err);
      alert('Payment simulation failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
    </div>
  );

  if (success) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center max-w-md w-full border border-green-100"
      >
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter mb-4 text-center">Payment Successful</h2>
        <p className="text-slate-500 font-bold mb-8">Your deposit has been secured. The specialist has been notified and will begin the mission shortly.</p>
        <div className="text-sm font-black text-primary uppercase tracking-widest animate-pulse">Redirecting to Job...</div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all font-black uppercase tracking-widest text-[10px] mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Estimate
        </button>

        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div>
              <h1 className="text-5xl font-black text-slate-900 uppercase italic tracking-tighter leading-none mb-4">Secure <span className="text-primary">Checkout</span></h1>
              <p className="text-slate-500 font-bold">Secure your booking by paying the required deposit.</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Service</span>
                <span className="text-sm font-black text-slate-900 italic">{job?.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Deposit Amount</span>
                <span className="text-2xl font-black text-slate-900 tracking-tighter italic">R {parseFloat(amount || '0').toFixed(2)}</span>
              </div>
              <div className="pt-6 border-t border-slate-50 flex items-center gap-4 text-slate-400">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                <p className="text-[10px] font-bold">Payment is held in escrow and only released upon mission completion.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] -mr-16 -mt-16"></div>
            
            <div className="relative z-10 space-y-8">
              <div className="flex items-center justify-between mb-8">
                <CreditCard className="w-10 h-10 text-primary" />
                <div className="flex gap-2">
                  <div className="w-8 h-5 bg-white/10 rounded-sm"></div>
                  <div className="w-8 h-5 bg-white/10 rounded-sm"></div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic ml-4">Card Holder</label>
                  <input 
                    type="text" 
                    placeholder="NAME ON CARD"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold placeholder:text-white/20 outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic ml-4">Card Number</label>
                  <input 
                    type="text" 
                    placeholder="0000 0000 0000 0000"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold placeholder:text-white/20 outline-none focus:border-primary transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic ml-4">Expiry</label>
                    <input 
                      type="text" 
                      placeholder="MM/YY"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold placeholder:text-white/20 outline-none focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic ml-4">CVV</label>
                    <input 
                      type="text" 
                      placeholder="000"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold placeholder:text-white/20 outline-none focus:border-primary transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={processing}
                className="w-full py-6 bg-primary text-white rounded-[2rem] font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4 mt-8"
              >
                {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Lock className="w-5 h-5" />}
                {processing ? 'Processing...' : `Pay R ${parseFloat(amount || '0').toFixed(2)}`}
              </button>

              <div className="text-center">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic flex items-center justify-center gap-2">
                  <ShieldCheck className="w-3 h-3" />
                  Bank-grade 256-bit SSL encryption
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
