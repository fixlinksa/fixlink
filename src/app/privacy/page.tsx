import React from 'react';
import { Shield, Lock, Eye, FileText } from 'lucide-react';

export default function PrivacyPage() {
  const sections = [
    { title: 'Information We Collect', desc: 'Personal details such as name, email, phone number, and location used to connect you with service providers.', icon: Eye },
    { title: 'How We Use Data', desc: 'Primarily to facilitate matches, enable real-time chat, and manage job history and payments.', icon: FileText },
    { title: 'Safety and Security', desc: 'Encryption and multi-factor authentication protect your data. We do not sell personal data to third parties.', icon: Lock },
    { title: 'Your Rights', desc: 'Providing you full control over your data including the right to access, correct, or delete information.', icon: Shield },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 md:py-32 space-y-16">
      <div className="text-center space-y-6 mb-12">
        <h1 className="text-5xl font-black text-primary">Privacy Policy</h1>
        <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
          Last Updated: April 2026. Your privacy is our top priority. Learn how we handle your information with care.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {sections.map((s, i) => (
           <div key={i} className="p-10 rounded-[2.5rem] bg-white border border-border hover:border-primary/20 hover:shadow-xl transition-all space-y-6">
             <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
               <s.icon className="w-6 h-6" />
             </div>
             <h3 className="text-xl font-bold">{s.title}</h3>
             <p className="text-muted-foreground font-medium leading-relaxed">{s.desc}</p>
           </div>
         ))}
      </div>

      <div className="bg-muted p-12 md:p-20 rounded-[3rem] space-y-8">
        <h2 className="text-3xl font-bold">Standard Data Protection</h2>
        <div className="prose prose-slate max-w-none text-muted-foreground font-medium leading-loose space-y-6">
          <p>
            This Privacy Policy describes how Fix Link collects, uses, and shares your personal information when you use our mobile-first marketplace. By using the platform, you agree to the collection and use of information in accordance with this policy.
          </p>
          <p>
            We take data security seriously and implement industry-standard measures to protect your personal details. Our use of Firebase and Clerk ensures that your authentication data and database entries are encrypted at rest and in transit.
          </p>
          <p>
            If you have any questions or concern regarding this policy, please contact us at info@fixlink.org.za.
          </p>
        </div>
      </div>
    </div>
  );
}
