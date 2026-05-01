'use client';

import React from 'react';
import { Mail, Shield, Globe, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-orange-100/50 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-100/50 blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white shadow-xl shadow-blue-500/10 mb-6 group hover:scale-105 transition-transform duration-500">
            <Mail className="w-10 h-10 text-[#1E4E79] group-hover:rotate-12 transition-transform duration-500" />
          </div>
          <h1 className="text-5xl font-black text-[#1E4E79] tracking-tight mb-4">
            Get in <span className="text-[#F7931E]">Touch</span>
          </h1>
          <p className="text-slate-500 text-lg font-medium max-w-md mx-auto leading-relaxed">
            Have a question or need assistance? Our team is dedicated to providing you with elite support for all your maintenance needs.
          </p>
        </div>

        {/* Contact Card */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200/60 border border-slate-100 relative group overflow-hidden">
          {/* Card Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col items-center text-center">
              <div className="text-xs font-black uppercase tracking-[0.3em] text-[#F7931E] mb-6">
                Direct Communication
              </div>
              
              <a 
                href="mailto:info@fixlink.org.za" 
                className="group/email relative"
              >
                <span className="text-3xl md:text-4xl font-black text-[#1E4E79] transition-all duration-300 group-hover/email:text-[#F7931E]">
                  info@fixlink.org.za
                </span>
                <div className="h-1.5 w-0 bg-[#F7931E] mx-auto rounded-full mt-2 group-hover/email:w-full transition-all duration-500"></div>
              </a>

              <p className="mt-8 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                Response Time: Within 24 Hours
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-12 pt-10 border-t border-slate-100">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Shield className="w-5 h-5 text-[#1E4E79]" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Security</p>
                  <p className="text-sm font-bold text-[#1E4E79]">Verified Experts</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Globe className="w-5 h-5 text-[#F7931E]" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Support</p>
                  <p className="text-sm font-bold text-[#1E4E79]">Nationwide</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-12 text-center">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-slate-400 hover:text-[#1E4E79] font-bold text-sm transition-colors duration-300 group"
          >
            Back to Marketplace
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
