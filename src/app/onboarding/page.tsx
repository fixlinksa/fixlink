'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  User as UserIcon, 
  Hammer, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  Briefcase, 
  Phone, 
  MapPin, 
  Building2,
  ChevronLeft,
  Search
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { syncUserProfile } from '@/lib/db';
import { TRADES } from '@/lib/constants';
import Link from 'next/link';
import Autocomplete from "react-google-autocomplete";



export default function OnboardingPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<'customer' | 'tradesman' | null>(null);
  const [isCompany, setIsCompany] = useState<boolean>(false);
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [tradeSearch, setTradeSearch] = useState<string>('');
  
  // Form fields
  const [formData, setFormData] = useState({
    contactPhone: '',
    address: '',
    companyName: '',
    registrationNumber: '',
    vatNumber: '',
    website: '',
    isVatRegistered: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Redirect if user is not logged in or already has a complete profile
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/signup');
      } else if (profile?.onboardingCompleted && !isSubmitting && !isSuccess) {
        const target = profile.role === 'admin' 
          ? '/admin/dashboard' 
          : profile.role === 'tradesman' 
            ? '/dashboard/tradesman' 
            : '/dashboard/customer';
        router.push(target);
      }
    }
  }, [user, profile, authLoading, router, isSubmitting, isSuccess]);

  const handleNext = () => {
    if (step === 4 && selectedRole === 'customer') {
      handleCompleteOnboarding();
      return;
    }
    setStep(s => s + 1);
  };
  const handleBack = () => {
    // If the role was already in the profile, don't let them go back to step 1
    if (step === 2 && profile?.role) return;
    setStep(s => s - 1);
  };

  // Skip role selection if already set in profile
  useEffect(() => {
    if (profile?.role && step === 1 && !selectedRole) {
      setSelectedRole(profile.role as 'customer' | 'tradesman');
      setStep(2);
    }
  }, [profile, step, selectedRole]);

  const handleCompleteOnboarding = async () => {
    if (!user || !selectedRole) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await syncUserProfile(user.uid, {
        email: user.email || '',
        fullName: user.displayName || 'New User',
        role: selectedRole,
        isCompany: isCompany === true,
        trade: selectedTrades[0] || undefined, // Keep single trade for backwards compatibility
        trades: selectedTrades,
        tier: 'starter', // Default tier for new professionals
        onboardingCompleted: true,
        ...formData,
        imageUrl: user.photoURL || undefined,
      });
      
      setIsSuccess(true);
      setTimeout(() => {
        const target = selectedRole === 'tradesman' ? '/dashboard/tradesman' : '/dashboard/customer';
        router.push(target);
      }, 2000);
    } catch (error: any) {
      console.error('Onboarding sync error:', error);
      setError(error.message || 'Failed to sync profile. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (authLoading || (profile?.onboardingCompleted && !isSubmitting && !isSuccess)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
        <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-primary/20 animate-bounce italic tracking-tighter">
          FL
        </div>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Initializing Fix Link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-24 px-6 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-white rounded-[3.5rem] p-12 md:p-16 shadow-2xl shadow-primary/5 border border-border text-center relative overflow-hidden"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-muted">
           <motion.div 
             className="h-full bg-primary"
             initial={{ width: '0%' }}
             animate={{ width: `${(step / (selectedRole === 'tradesman' ? 5 : 4)) * 100}%` }}
           />
        </div>

        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              {/* Back Button */}
              {step > 1 && (
                <button 
                  onClick={handleBack}
                  className="absolute left-8 top-12 flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}

              {/* Step Headers */}
              <div>
                <img src="/FixLinkLogo.png" alt="Fix Link" className="w-20 h-20 mx-auto mb-8 mix-blend-multiply" />
                
                {step === 1 && (
                   <>
                    <h1 className="text-4xl font-black tracking-tight uppercase italic mb-4">Select your <span className="text-primary">Role</span></h1>
                    <p className="text-muted-foreground font-medium">How would you like to use the Fix Link marketplace?</p>
                   </>
                )}
                {step === 2 && (
                   <>
                    <h1 className="text-4xl font-black tracking-tight uppercase italic mb-4">Identity <span className="text-primary">Type</span></h1>
                    <p className="text-muted-foreground font-medium">Are you operating as an individual or a company?</p>
                   </>
                )}
                {step === 3 && (
                   <>
                    <h1 className="text-4xl font-black tracking-tight uppercase italic mb-4">Contact <span className="text-primary">Details</span></h1>
                    <p className="text-muted-foreground font-medium">How can we reach you or your business?</p>
                   </>
                )}
                {step === 4 && (
                   <>
                    <h1 className="text-4xl font-black tracking-tight uppercase italic mb-4">{isCompany ? 'Business' : 'Trading'} <span className="text-primary">Details</span></h1>
                    <p className="text-muted-foreground font-medium">Provide registration and VAT details for compliance.</p>
                   </>
                )}
                {step === 5 && (
                   <>
                    <h1 className="text-4xl font-black tracking-tight uppercase italic mb-4">Select <span className="text-primary">Trade</span></h1>
                    <p className="text-muted-foreground font-medium">What is your primary professional expertise?</p>
                   </>
                )}
                {error && (
                  <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-bold animate-shake">
                    {error}
                  </div>
                )}
              </div>

              {/* Step 1: Role Selection */}
              {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => { setSelectedRole('customer'); handleNext(); }}
                    className={`p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-6 text-center group ${
                      selectedRole === 'customer' ? 'border-primary bg-primary/5' : 'border-muted bg-muted/20 hover:border-muted-foreground hover:bg-white'
                    }`}
                  >
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all shadow-lg ${
                      selectedRole === 'customer' ? 'bg-primary text-white scale-110' : 'bg-white text-muted-foreground'
                    }`}>
                      <UserIcon className="w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="font-black uppercase tracking-tighter text-lg mb-1">Customer</h3>
                      <p className="text-xs text-muted-foreground font-medium italic">I'm looking for services</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setSelectedRole('tradesman'); handleNext(); }}
                    className={`p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-6 text-center group ${
                      selectedRole === 'tradesman' ? 'border-accent bg-accent/5' : 'border-muted bg-muted/20 hover:border-muted-foreground hover:bg-white'
                    }`}
                  >
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all shadow-lg ${
                      selectedRole === 'tradesman' ? 'bg-accent text-white scale-110' : 'bg-white text-muted-foreground'
                    }`}>
                      <Hammer className="w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="font-black uppercase tracking-tighter text-lg mb-1">Professional</h3>
                      <p className="text-xs text-muted-foreground font-medium italic">I'm providing services</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 2: Identity Selection */}
              {step === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <button
                    onClick={() => { setIsCompany(false); handleNext(); }}
                    className={`p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-6 text-center group ${
                      isCompany === false ? 'border-primary bg-primary/5' : 'border-muted bg-muted/20 hover:border-muted-foreground hover:bg-white'
                    }`}
                  >
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-colors shadow-lg bg-white text-muted-foreground`}>
                      <UserIcon className="w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="font-black uppercase tracking-tighter text-lg mb-1">Personal</h3>
                      <p className="text-xs text-muted-foreground font-medium italic">Individual account</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setIsCompany(true); handleNext(); }}
                    className={`p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-6 text-center group ${
                      isCompany === true ? 'border-primary bg-primary/5' : 'border-muted bg-muted/20 hover:border-muted-foreground hover:bg-white'
                    }`}
                  >
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-colors shadow-lg bg-white text-muted-foreground`}>
                      <Building2 className="w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="font-black uppercase tracking-tighter text-lg mb-1">Company</h3>
                      <p className="text-xs text-muted-foreground font-medium italic">Registered Business</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 3: Contacts */}
              {step === 3 && (
                <div className="space-y-6 text-left">
                  <div className="relative group">
                    <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input 
                      type="tel"
                      placeholder="Contact Phone Number"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      className="w-full bg-muted/50 border-transparent p-6 rounded-2xl pl-16 text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner"
                      required
                    />
                  </div>
                  <div className="relative group">
                    <MapPin className="absolute z-10 left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Autocomplete 
                      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                      onPlaceSelected={(place: any) => {
                         if (place?.formatted_address) {
                            setFormData({ ...formData, address: place.formatted_address });
                         }
                      }}
                      options={{
                        types: ["address"],
                      }}
                      placeholder="Search Permanent Street Address..."
                      defaultValue={formData.address}
                      onChange={(e: any) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full bg-muted/50 border-transparent p-6 rounded-2xl pl-16 text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner relative"
                      required
                    />
                  </div>
                  <button 
                    onClick={handleNext}
                    disabled={!formData.contactPhone || !formData.address}
                    className="w-full bg-primary text-white p-6 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-center"
                  >
                    Continue to Details
                  </button>
                </div>
              )}

              {/* Step 4: Identity Details */}
              {step === 4 && (
                <div className="space-y-6 text-left">
                  {(selectedRole === 'tradesman' || isCompany) ? (
                    <>
                      <div className="relative group">
                        <Briefcase className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input 
                          type="text"
                          placeholder={isCompany ? "Business/Company Name" : "Trading Name"}
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          className="w-full bg-muted/50 border-transparent p-6 rounded-2xl pl-16 text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner"
                          required
                        />
                      </div>
                      <div className="relative group">
                         <input 
                          type="text"
                          placeholder="Registration Number (Optional)"
                          value={formData.registrationNumber}
                          onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                          className="w-full bg-muted/50 border-transparent p-6 rounded-2xl text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner"
                        />
                      </div>
                      <div className="relative group">
                         <input 
                          type="text"
                          placeholder="VAT Number (If Registered)"
                          value={formData.vatNumber}
                          onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value, isVatRegistered: !!e.target.value })}
                          className="w-full bg-muted/50 border-transparent p-6 rounded-2xl text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner"
                        />
                      </div>
                      <div className="relative group">
                         <input 
                          type="url"
                          placeholder="Website (e.g. https://yoursite.com)"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          className="w-full bg-muted/50 border-transparent p-6 rounded-2xl text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="p-8 bg-green-50 rounded-3xl border border-green-100 text-center">
                       <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                       <h3 className="font-black uppercase tracking-tight italic">All Clear!</h3>
                       <p className="text-xs text-muted-foreground font-medium">As a personal customer, no further details are required.</p>
                    </div>
                  )}

                  <button 
                    onClick={handleNext}
                    disabled={isSubmitting || ((selectedRole === 'tradesman' || isCompany) && !formData.companyName)}
                    className="w-full bg-primary text-white p-8 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                    {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (selectedRole === 'customer' ? "Complete Onboarding" : "Continue to Trades")}
                  </button>
                </div>
              )}

              {/* Step 5: Trade Selection */}
              {step === 5 && (
                <div className="space-y-8 text-left">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase tracking-tight italic">Service <span className="text-primary tracking-normal">Categories</span></h2>
                    <p className="text-xs text-muted-foreground font-medium italic">Select one or more trades that you specialize in. You will appear in search results for all selected categories.</p>
                  </div>
                  <div className="relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input 
                      type="text"
                      placeholder="Search for your trade..."
                      value={tradeSearch}
                      onChange={(e) => setTradeSearch(e.target.value)}
                      className="w-full bg-muted/50 border-transparent p-6 rounded-2xl pl-16 text-sm font-bold outline-none border focus:border-primary focus:bg-white transition-all shadow-inner"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                    {TRADES.filter(t => t.toLowerCase().includes(tradeSearch.toLowerCase())).map((trade) => (
                      <button
                        key={trade}
                        onClick={() => {
                          setSelectedTrades(prev => 
                            prev.includes(trade) 
                              ? prev.filter(t => t !== trade) 
                              : [...prev, trade]
                          );
                        }}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          selectedTrades.includes(trade) 
                          ? 'border-primary bg-primary/5 text-primary' 
                          : 'border-muted hover:border-muted-foreground bg-muted/20'
                        }`}
                      >
                         <div className="flex justify-between items-center">
                           <p className="text-xs font-black uppercase tracking-tight">{trade}</p>
                           {selectedTrades.includes(trade) && <CheckCircle2 className="w-4 h-4" />}
                         </div>
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={handleCompleteOnboarding}
                    disabled={isSubmitting || selectedTrades.length === 0}
                    className="w-full bg-primary text-white p-8 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                    {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Finalize Profile"}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-20 space-y-10 flex flex-col items-center"
            >
              <div className="w-24 h-24 bg-green-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-green-500/20 mb-4 animate-bounce">
                <CheckCircle2 className="w-14 h-14" />
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl font-black tracking-tight uppercase italic">Welcome to <span className="text-primary">Fix Link</span></h2>
                <p className="text-muted-foreground font-medium">Your professional profile is active.</p>
              </div>
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
