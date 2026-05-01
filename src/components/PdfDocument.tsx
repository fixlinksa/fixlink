import React from 'react';
import { UserProfile, InventoryItem } from '@/lib/db';

export function PdfDocument({ 
  job, 
  profile, 
  lineItems, 
  totals, 
  type 
}: { 
  job: any, 
  profile: UserProfile, 
  lineItems: any[], 
  totals: any, 
  type: 'Estimate' | 'Invoice' 
}) {
  // Robust deposit calculation
  const jobDepositAmount = job.depositAmount || 0;
  const jobDepositType = String(job.depositType || '').toLowerCase();
  
  const isDepositPercentage = jobDepositType.includes('percent') || 
                              String(jobDepositAmount).includes('%') ||
                              (Number(jobDepositAmount) > 0 && Number(jobDepositAmount) <= 100 && !jobDepositType.includes('fixed'));
  
  const rawDepositValue = typeof jobDepositAmount === 'string' 
                         ? parseFloat(jobDepositAmount.replace(/[^\d.]/g, '')) 
                         : (Number(jobDepositAmount) || 0);
                    
  const depositValue = isDepositPercentage ? (totals.incl * rawDepositValue / 100) : rawDepositValue;

  return (
    <div id="pdf-document" className="w-[800px] h-auto min-h-[1131px] relative bg-white font-sans flex flex-col" style={{ color: '#0f172a' }}>
      
      {/* Top Banner */}
      <div className="w-full h-4" style={{ backgroundColor: '#F7931E' }}></div>
      <div className="w-full h-8" style={{ backgroundColor: '#1E4E79' }}></div>

      <div className="p-12 flex-grow flex flex-col">
        {/* Header section */}
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginBottom: '32px', borderBottom: '2px solid #f1f5f9' }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: 'top', paddingBottom: '32px' }}>
                <table style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '96px', verticalAlign: 'top', paddingRight: '24px' }}>
                        {profile?.companyLogoUrl ? (
                          <img src={profile.companyLogoUrl} alt="Logo" style={{ width: '96px', height: '96px', objectFit: 'contain', borderRadius: '12px' }} />
                        ) : profile?.imageUrl ? (
                          <img src={profile.imageUrl} alt="Logo" style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '12px' }} />
                        ) : (
                          <div style={{ width: '96px', height: '96px', backgroundColor: '#1E4E79', color: '#ffffff', borderRadius: '12px', textAlign: 'center', lineHeight: '96px', fontSize: '32px', fontWeight: 'bold', display: 'block' }}>
                            {profile?.businessName?.charAt(0) || profile?.fullName?.charAt(0) || 'P'}
                          </div>
                        )}
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        <h1 style={{ color: '#1E4E79', fontSize: '24px', fontWeight: '900', textTransform: 'uppercase', margin: 0, letterSpacing: '-0.025em' }}>{profile?.businessName || profile?.fullName || ''}</h1>
                        <p style={{ color: '#475569', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0 0' }}>{profile?.email}</p>
                        {(profile?.contactPhone || profile?.phone) && (
                          <p style={{ color: '#475569', fontSize: '12px', fontWeight: '600', margin: '2px 0 0 0' }}>
                            {profile.contactPhone || profile.phone}
                          </p>
                        )}
                        {profile?.address && (
                          <p style={{ color: '#64748b', fontSize: '12px', fontWeight: '600', margin: '2px 0 0 0', maxWidth: '300px' }}>
                            {profile.address}
                          </p>
                        )}
                        {profile?.website && <p style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', margin: '2px 0 0 0' }}>{profile.website}</p>}
                        {profile?.isVatRegistered && profile?.vatNumber && (
                          <p style={{ color: '#F7931E', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', margin: '4px 0 0 0' }}>VAT: {profile.vatNumber}</p>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style={{ verticalAlign: 'top', textAlign: 'right', paddingBottom: '32px' }}>
                <h2 style={{ color: '#1E4E79', fontSize: '36px', fontWeight: '900', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>{profile?.isVatRegistered && type === 'Invoice' ? 'Tax Invoice' : type}</h2>
                <div style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', display: 'inline-block', textAlign: 'left' }}>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b', margin: 0 }}>Ref: <span style={{ color: '#0f172a' }}>{job?.reference || job?.id?.slice(0,8)?.toUpperCase() || 'NEW'}</span></p>
                  <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', margin: '4px 0 0 0' }}>Date: <span style={{ color: '#0f172a' }}>{new Date().toLocaleDateString()}</span></p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Line Items */}
        <div className="rounded-2xl overflow-hidden border mb-8" style={{ borderColor: '#f1f5f9' }}>
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="text-xs font-black uppercase tracking-widest" style={{ backgroundColor: '#f8fafc', color: '#64748b' }}>
                    <th className="py-4 px-6 border-b" style={{ borderColor: '#e2e8f0' }}>Description</th>
                    <th className="py-4 px-6 text-center border-b" style={{ borderColor: '#e2e8f0', textAlign: 'center' }}>Qty</th>
                    <th className="py-4 px-6 text-right border-b" style={{ borderColor: '#e2e8f0' }}>Price</th>
                    <th className="py-4 px-6 text-right border-b" style={{ borderColor: '#e2e8f0' }}>Total</th>
                 </tr>
              </thead>
              <tbody>
                 {lineItems.map((item, i) => (
                    <tr key={i} className="border-b last:border-b-0" style={{ borderColor: '#f1f5f9', backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafb' }}>
                       <td className="py-4 px-6 font-bold text-sm" style={{ color: '#0f172a', wordBreak: 'break-word' }}>{item.name}</td>
                       <td className="py-4 px-6 text-center font-bold text-sm" style={{ color: '#475569', textAlign: 'center' }}>{item.quantity}</td>
                       <td className="py-4 px-6 text-right font-bold text-sm" style={{ color: '#475569' }}>R {item.sellingIncl.toFixed(2)}</td>
                       <td className="py-4 px-6 text-right font-black text-sm" style={{ color: '#1E4E79' }}>R {(item.sellingIncl * item.quantity).toFixed(2)}</td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>

        {/* Booking Security Notice */}
        {depositValue > 0 && !job?.depositPaid && (
           <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', marginBottom: '32px' }}>
             <tbody>
               <tr>
                 <td style={{ padding: '24px', backgroundColor: '#fff7ed', borderRadius: '16px', border: '2px dashed #fdba74' }}>
                   <table style={{ borderCollapse: 'collapse' }}>
                     <tbody>
                       <tr>
                         <td style={{ verticalAlign: 'middle', paddingRight: '16px' }}>
                           <div style={{ width: '48px', height: '48px', backgroundColor: '#F7931E', color: 'white', borderRadius: '12px', display: 'block', textAlign: 'center', lineHeight: '48px' }}>
                             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                           </div>
                         </td>
                         <td style={{ verticalAlign: 'middle' }}>
                           <h3 style={{ color: '#c2410c', fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', margin: 0, letterSpacing: '-0.025em' }}>Booking Security Required</h3>
                           <p style={{ color: '#9a3412', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                             A secure deposit of <span style={{ fontSize: '14px', fontWeight: '900' }}>R {depositValue.toFixed(2)}</span> is required to finalize this booking and secure the specialist's priority availability for your project.
                           </p>
                         </td>
                       </tr>
                     </tbody>
                   </table>
                 </td>
               </tr>
             </tbody>
           </table>
        )}

        {/* Totals & Notes */}
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginBottom: '48px' }}>
          <tbody>
            <tr>
              {/* Customer Details & Notes */}
              <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '32px' }}>
                <div style={{ marginBottom: '32px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#F7931E', margin: '0 0 12px 0' }}>Billed To</p>
                  <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#1E4E79', margin: 0 }}>{job?.customerName || 'Standard Client'}</h3>
                  {job?.customerPhone && <p style={{ fontSize: '12px', fontWeight: '600', color: '#475569', margin: '4px 0 0 0' }}>{job.customerPhone}</p>}
                  {job?.customerEmail && <p style={{ fontSize: '12px', fontWeight: '600', color: '#475569', margin: '2px 0 0 0' }}>{job.customerEmail}</p>}
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#475569', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                    {(() => {
                      const rawAddr = job?.customerAddress || job?.location;
                      if (!rawAddr) return 'Pending Address';
                      if (typeof rawAddr === 'object') return rawAddr.address || 'Location Identified';
                      return String(rawAddr);
                    })()}
                  </p>
                </div>

                {job?.notes && (
                   <div>
                      <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', margin: '0 0 8px 0' }}>Terms & Notes</p>
                      <p style={{ fontSize: '14px', fontWeight: '500', lineHeight: '1.6', color: '#475569', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{job.notes}</p>
                   </div>
                )}
              </td>
              
              {/* Totals Box */}
              <td style={{ width: '50%', verticalAlign: 'top' }}>
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '16px', padding: '24px' }}>
                  {profile?.isVatRegistered ? (
                     <>
                        <table style={{ width: '100%', marginBottom: '12px' }}>
                          <tbody>
                            <tr>
                              <td style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>Subtotal</td>
                              <td style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b', textAlign: 'right' }}>R {totals.excl.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b', paddingTop: '8px' }}>VAT (15%)</td>
                              <td style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b', textAlign: 'right', paddingTop: '8px' }}>R {totals.vat.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <div style={{ height: '1px', backgroundColor: '#e2e8f0', marginBottom: '16px' }}></div>
                     </>
                  ) : null}
                  
                  <table style={{ width: '100%' }}>
                    <tbody>
                      <tr>
                        <td style={{ fontSize: '24px', fontWeight: '900', color: '#1E4E79' }}>Total</td>
                        <td style={{ fontSize: '24px', fontWeight: '900', color: '#1E4E79', textAlign: 'right' }}>R {totals.incl.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {depositValue > 0 && (
                     <table style={{ width: '100%', marginTop: '16px' }}>
                       <tbody>
                         <tr>
                           <td style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                 Deposit ({isDepositPercentage ? `${rawDepositValue}%` : 'Fixed Amount'})
                                 {job.depositPaid && (
                                   <span style={{ fontSize: '9px', fontWeight: '900', color: '#16a34a', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', marginLeft: '8px' }}>Paid ✓</span>
                                 )}
                              </span>
                           </td>
                           <td style={{ fontSize: '14px', fontWeight: 'bold', color: '#ea580c', textAlign: 'right' }}>- R {depositValue.toFixed(2)}</td>
                         </tr>
                       </tbody>
                     </table>
                  )}
                  
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px dashed #e2e8f0' }}>
                    <table style={{ width: '100%' }}>
                      <tbody>
                        <tr>
                          <td style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>Outstanding Amount</td>
                          <td style={{ fontSize: '18px', fontWeight: '900', color: '#0f172a', textAlign: 'right' }}>R {(totals.incl - (job.depositPaid ? depositValue : 0)).toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Banking Details */}
        {profile?.bankName && profile?.accountNumber && (
           <div className="mt-auto pt-8 border-t-2 mb-8" style={{ borderColor: '#f1f5f9' }}>
              <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: '#F7931E' }}>Payment Information</p>
              <div className="flex flex-wrap gap-x-12 gap-y-6">
                 <div>
                    <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#94a3b8' }}>Bank</p>
                    <p className="text-xs font-black uppercase" style={{ color: '#0f172a' }}>{profile.bankName}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#94a3b8' }}>Account Name</p>
                    <p className="text-xs font-black uppercase" style={{ color: '#0f172a' }}>{profile.accountHolder || profile.businessName || profile.fullName}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#94a3b8' }}>Account No.</p>
                    <p className="text-xs font-black" style={{ color: '#0f172a' }}>{profile.accountNumber}</p>
                 </div>
                 {profile?.accountType && (
                   <div>
                      <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#94a3b8' }}>Account Type</p>
                      <p className="text-xs font-black uppercase" style={{ color: '#0f172a' }}>{profile.accountType}</p>
                   </div>
                 )}
                  <div>
                    <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#94a3b8' }}>Branch</p>
                    <p className="text-xs font-black" style={{ color: '#0f172a' }}>{profile.branchCode}</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#94a3b8' }}>Payment Ref</p>
                    <p className="text-xs font-black" style={{ color: '#F7931E' }}>{job?.reference || job?.id?.slice(0,8)?.toUpperCase()}</p>
                 </div>
              </div>
           </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-6 border-t flex flex-col items-center justify-center gap-2" style={{ borderColor: '#f1f5f9' }}>
           <div className="flex items-center gap-3">
              <img src="/FixLinkLogo.png" alt="Fix Link" className="w-8 h-8 object-contain mix-blend-multiply" />
              <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                 Powered By <span className="text-sm" style={{ color: '#1E4E79' }}>FixLink</span>
              </p>
           </div>
           <p className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: '#F7931E' }}>Elite Maintenance Marketplace • www.fixlink.org.za</p>
        </div>
      </div>
    </div>
  );
}
