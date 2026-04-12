'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Shield, 
  Zap, 
  MessageSquare, 
  AlertTriangle, 
  ExternalLink,
  Info,
  ChevronRight,
  HelpCircle,
  FileText
} from 'lucide-react';

export default function PlatformInfoPage() {
  const protocols = [
    {
      title: 'Mission Authorization',
      description: 'Standard procedure for verifying professional identity and granting marketplace access.',
      icon: Shield,
      color: 'primary'
    },
    {
      title: 'Conflict Resolution',
      description: 'Protocols for handling disputes between seekers and heroes regarding mission outcomes.',
      icon: MessageSquare,
      color: 'slate-900'
    },
    {
      title: 'Tier Management',
      description: 'Guidelines for manual tier elevation and professional growth tracking.',
      icon: Zap,
      color: 'primary'
    }
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px] mb-3 italic">
          <span className="w-8 h-[2px] bg-primary"></span>
          Tactical Manual
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-slate-900 mb-2 uppercase italic">
          FixLink <span className="text-primary">Intelligence</span>
        </h1>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest italic opacity-60">
          Operational guidelines and platform management protocols.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Main Protocols */}
        <div className="lg:col-span-8 space-y-10">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {protocols.map((protocol, index) => (
                <motion.div 
                  key={protocol.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
                >
                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 bg-${protocol.color === 'primary' ? 'primary' : 'slate-900'}/10 text-${protocol.color === 'primary' ? 'primary' : 'slate-900'} group-hover:scale-110 transition-transform`}>
                      <protocol.icon className="w-7 h-7" />
                   </div>
                   <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 mb-4">{protocol.title}</h3>
                   <p className="text-sm font-medium text-slate-500 italic leading-relaxed mb-8">
                      {protocol.description}
                   </p>
                   <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:gap-4 transition-all">
                      Open Protocol <ChevronRight className="w-4 h-4" />
                   </button>
                </motion.div>
              ))}
           </div>

           {/* Manual / Text Section */}
           <div className="bg-slate-900 rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px] -mr-48 -mt-48"></div>
              
              <div className="relative z-10">
                 <div className="flex items-center gap-4 mb-10">
                    <BookOpen className="w-8 h-8 text-primary shadow-glow" />
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">Operating <span className="text-primary">Manual</span></h2>
                 </div>

                 <div className="space-y-8 max-w-2xl">
                    <section>
                       <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4 italic">01. Purpose</h4>
                       <p className="text-slate-400 text-sm font-medium italic leading-relaxed">
                          FixLink exists to connect high-tier local professionals with seekers in immediate need of specialized expertise. Every mission must be tracked for quality and completion.
                       </p>
                    </section>
                    
                    <section>
                       <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4 italic">02. Integrity Control</h4>
                       <p className="text-slate-400 text-sm font-medium italic leading-relaxed">
                          Administrators must ensure that all "Heroes" (Professionals) meet the required verification standards before they are authorized to accept public missions.
                       </p>
                    </section>

                    <button className="w-full sm:w-auto px-10 py-5 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-3">
                       <FileText className="w-4 h-4" />
                       Download Full Manual
                    </button>
                 </div>
              </div>
           </div>
        </div>

        {/* Support & Quick Links */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 mb-8 flex items-center gap-3">
                 <HelpCircle className="w-5 h-5 text-primary" />
                 Tactical Help
              </h3>
              
              <div className="space-y-4">
                 {[
                   'Technical Support Link',
                   'Database Emergency Manual',
                   'Payment Gateway Protocol',
                   'Platform Ethics Guidelines'
                 ].map(link => (
                    <button key={link} className="w-full p-4 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 text-left transition-all flex items-center justify-between group">
                       <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight italic group-hover:text-primary transition-colors">{link}</span>
                       <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                    </button>
                 ))}
              </div>
           </div>

           <div className="bg-primary rounded-[3rem] p-10 shadow-xl shadow-primary/20 text-white relative overflow-hidden group">
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                 <AlertTriangle className="w-10 h-10 mb-6" />
                 <h3 className="text-xl font-black uppercase italic tracking-tighter mb-4">Emergency Reset</h3>
                 <p className="text-white/80 text-[11px] font-medium leading-relaxed italic mb-8">
                    In the event of a catastrophic system malfunction, contact the core engineering team immediately via the encrypted channel.
                 </p>
                 <button className="w-full py-4 bg-white text-primary rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg">
                    Request Core Support
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
