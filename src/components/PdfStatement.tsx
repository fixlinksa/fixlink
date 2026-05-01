'use client';

import React from 'react';
import { Shield, CheckCircle2, AlertCircle } from 'lucide-react';

interface PdfStatementProps {
  job: any;
  profile: any;
  invoices: any[];
}

export const PdfStatement: React.FC<PdfStatementProps> = ({ job, profile, invoices }) => {
  const jobTotal = job.total || job.amount || 0;
  
  // Robust deposit calculation
  const depositAmountRaw = job.depositAmount || 0;
  const depositTypeRaw = String(job.depositType || '').toLowerCase();
  const isPercentage = depositTypeRaw.includes('percent') || 
                      String(depositAmountRaw).includes('%') ||
                      (Number(depositAmountRaw) > 0 && Number(depositAmountRaw) <= 100 && !depositTypeRaw.includes('fixed'));
  
  const rawDepositValue = typeof depositAmountRaw === 'string' ? parseFloat(depositAmountRaw.replace(/[^\d.]/g, '')) : (Number(depositAmountRaw) || 0);
  const calculatedDeposit = isPercentage ? (jobTotal * rawDepositValue / 100) : rawDepositValue;

  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  
  // To avoid double counting: only count paid invoices that are NOT the deposit if we add deposit separately.
  // Or simpler: count all paid invoices, and if depositPaid is true but no 'deposit' invoice exists, add it.
  // Actually, let's just sum all paid invoices.
  const paidInvoicesAmount = invoices.reduce((sum, inv) => (inv.status === 'paid' || inv.isPaid) ? sum + (inv.amount || 0) : sum, 0);
  
  // If the deposit was paid but isn't in the invoices list (or not marked paid there), 
  // we should still account for it if job.depositPaid is true.
  // But usually in this app, the deposit IS an invoice.
  // Let's check if any invoice is a deposit.
  const hasDepositInvoice = invoices.some(inv => 
    inv.isDeposit || 
    inv.reference?.toLowerCase().includes('deposit') || 
    inv.title?.toLowerCase().includes('deposit')
  );

  const totalPaymentsReceived = paidInvoicesAmount + (job.depositPaid && !hasDepositInvoice ? calculatedDeposit : 0);
  
  // USER REQUEST: Total due should be total amount minus payments/deposit
  const totalDueNow = Math.max(0, jobTotal - totalPaymentsReceived);
  const remainingToBeBilled = Math.max(0, jobTotal - totalInvoiced);

  // HEX Color Constants for html2canvas compatibility
  const problematicFuncs = [
    'lab', 
    'oklab', 
    'lch', 
    'oklch', 
    'color', 
    'hwb', 
    'color-mix',
    'light-dark',
    'clamp',
    'min',
    'max'
  ];
  const colors = {
    primary: '#1E4E79',
    accent: '#F7931E',
    slate50: '#F8FAFC',
    slate100: '#F1F5F9',
    slate200: '#E2E8F0',
    slate400: '#94A3B8',
    slate500: '#64748B',
    slate800: '#1E293B',
    slate900: '#0F172A',
    green100: '#DCFCE7',
    green600: '#16A34A',
    orange100: '#FFEDD5',
    orange600: '#EA580C',
    white: '#FFFFFF'
  };

  return (
    <div id="pdf-statement" style={{ width: '595pt', minHeight: '842pt', backgroundColor: colors.white, padding: '48px', fontFamily: 'sans-serif', color: colors.slate800 }}>
      {/* Header - Simple "Statement" as requested */}
      <div style={{ marginBottom: '48px', borderBottom: `2px solid ${colors.slate900}`, paddingBottom: '24px', textAlign: 'left' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.slate900, margin: 0 }}>Statement</h1>
        <p style={{ fontSize: '10px', fontWeight: 700, color: colors.slate400, marginTop: '8px', textTransform: 'uppercase', margin: 0 }}>Financial Summary & Reconciliation</p>
      </div>

      <div style={{ marginBottom: '48px' }}>
        <p style={{ fontSize: '10px', fontWeight: 900, color: colors.primary, textTransform: 'uppercase', letterSpacing: '0.1em', fontStyle: 'italic', margin: '4px 0 0 0' }}>Ref: {job.reference || job.id.slice(0, 8)}</p>
        <p style={{ fontSize: '10px', fontWeight: 700, color: colors.slate400, marginTop: '4px', textTransform: 'uppercase', margin: 0 }}>Issued: {new Date().toLocaleDateString()}</p>
      </div>

      <table style={{ width: '100%', tableLayout: 'fixed', marginBottom: '48px', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            {/* Professional Details */}
            <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '24px' }}>
              <p style={{ fontSize: '10px', fontWeight: 900, color: colors.slate400, textTransform: 'uppercase', letterSpacing: '0.1em', fontStyle: 'italic', borderBottom: `1px solid ${colors.slate100}`, paddingBottom: '8px', margin: 0 }}>From Specialist</p>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontWeight: 900, fontSize: '18px', textTransform: 'uppercase', fontStyle: 'italic', color: colors.slate900, margin: 0 }}>{profile?.businessName || profile?.fullName || 'FixLink Specialist'}</h3>
                {profile?.email && <p style={{ fontSize: '14px', fontWeight: 500, color: colors.slate500, margin: '4px 0 0 0' }}>{profile.email}</p>}
                {profile?.contactPhone && <p style={{ fontSize: '14px', fontWeight: 500, color: colors.slate500, margin: '2px 0 0 0' }}>{profile.contactPhone}</p>}
                {profile?.address && <p style={{ fontSize: '10px', fontWeight: 700, color: colors.slate400, textTransform: 'uppercase', lineHeight: 1.5, maxWidth: '200px', margin: '4px 0 0 0' }}>{profile.address}</p>}
              </div>
            </td>

            {/* Customer Details */}
            <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '24px' }}>
              <p style={{ fontSize: '10px', fontWeight: 900, color: colors.slate400, textTransform: 'uppercase', letterSpacing: '0.1em', fontStyle: 'italic', borderBottom: `1px solid ${colors.slate100}`, paddingBottom: '8px', margin: 0 }}>Mission Client</p>
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontWeight: 900, fontSize: '18px', textTransform: 'uppercase', fontStyle: 'italic', color: colors.slate900, margin: 0 }}>{job.customerName || 'Valued Client'}</h3>
                {job.customerEmail && <p style={{ fontSize: '14px', fontWeight: 500, color: colors.slate500, margin: '4px 0 0 0' }}>{job.customerEmail}</p>}
                {job.customerPhone && <p style={{ fontSize: '14px', fontWeight: 500, color: colors.slate500, margin: '2px 0 0 0' }}>{job.customerPhone}</p>}
                {job.customerAddress && <p style={{ fontSize: '10px', fontWeight: 700, color: colors.slate400, textTransform: 'uppercase', lineHeight: 1.5, maxWidth: '200px', margin: '4px 0 0 0' }}>{job.customerAddress}</p>}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Summary Boxes as a table with inner containers for robust rendering */}
      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', marginBottom: '48px' }}>
        <tbody>
          <tr>
            {[
              { label: 'Job Quote', value: `R ${jobTotal.toFixed(2)}`, color: colors.slate900 },
              { label: 'Total Billed', value: `R ${totalInvoiced.toFixed(2)}`, color: colors.slate900 },
              { label: 'Received', value: `R ${totalPaymentsReceived.toFixed(2)}`, color: colors.green600 },
              { label: 'Outstanding', value: `R ${totalDueNow.toFixed(2)}`, color: colors.primary, bg: '#F0F7FF', border: '#E0EFFF' },
              { label: 'Unbilled', value: `R ${remainingToBeBilled.toFixed(2)}`, color: colors.slate500 }
            ].map((box, i) => (
              <td key={i} style={{ width: '20%', padding: '0 4px', verticalAlign: 'top' }}>
                <div style={{ 
                  backgroundColor: box.bg || colors.slate50, 
                  borderRadius: '12px', 
                  border: `1px solid ${box.border || colors.slate100}`, 
                  padding: '16px 4px',
                  textAlign: 'center',
                  minHeight: '60px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <p style={{ 
                    fontSize: '7px', 
                    fontWeight: 900, 
                    color: colors.slate400, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em', 
                    margin: '0 0 4px 0', 
                    textAlign: 'center',
                    width: '100%'
                  }}>
                    {box.label}
                  </p>
                  <p style={{ 
                    fontSize: '11px', 
                    fontWeight: 900, 
                    color: box.color, 
                    margin: 0, 
                    textAlign: 'center',
                    width: '100%'
                  }}>
                    {box.value}
                  </p>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>


      {/* Invoices Table */}
      <div style={{ minHeight: '300px' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${colors.slate900}` }}>
              <th style={{ padding: '16px 0', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', fontStyle: 'italic', color: colors.slate400 }}>Date</th>
              <th style={{ padding: '16px 0', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', fontStyle: 'italic', color: colors.slate400 }}>Reference</th>
              <th style={{ padding: '16px 0', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', fontStyle: 'italic', color: colors.slate400 }}>Status</th>
              <th style={{ padding: '16px 0', textAlign: 'right', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', fontStyle: 'italic', color: colors.slate400 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length > 0 ? (
              invoices.map((inv, idx) => (
                <tr key={inv.id || idx} style={{ borderBottom: `1px solid ${colors.slate100}` }}>
                  <td style={{ padding: '24px 0', fontWeight: 700, fontSize: '14px', color: colors.slate500 }}>
                    {inv.createdAt?.toDate ? inv.createdAt.toDate().toLocaleDateString() : (inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A')}
                  </td>
                  <td style={{ padding: '24px 0' }}>
                    <p style={{ fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '-0.025em', fontStyle: 'italic', color: colors.slate900, margin: 0 }}>{inv.reference || `INV-${inv.id?.slice(-6)}`}</p>
                    <p style={{ fontSize: '9px', fontWeight: 700, color: colors.slate400, textTransform: 'uppercase', margin: 0 }}>Project Milestone</p>
                  </td>
                  <td style={{ padding: '24px 0' }}>
                    <div style={{ 
                      display: 'inline-block', 
                      minWidth: '64px',
                      padding: '6px 12px', 
                      borderRadius: '9999px', 
                      fontSize: '8px', 
                      fontWeight: 900, 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.1em', 
                      fontStyle: 'italic',
                      lineHeight: '1.2',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      backgroundColor: (inv.status === 'paid' || inv.isPaid) ? colors.green100 : colors.orange100,
                      color: (inv.status === 'paid' || inv.isPaid) ? colors.green600 : colors.orange600
                    }}>
                      {inv.status === 'paid' || inv.isPaid ? 'Paid' : 'Unpaid'}
                    </div>
                  </td>
                  <td style={{ padding: '24px 0', textAlign: 'right', fontWeight: 900, color: colors.slate900, fontSize: '14px', fontStyle: 'italic' }}>
                    R {(inv.amount || 0).toFixed(2)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ padding: '48px 0', textAlign: 'center', color: colors.slate400, fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase', fontSize: '12px' }}>No invoices issued for this mission yet.</td>
              </tr>
            )}
            
            {/* Deposit Line if applicable */}
            {job.depositAmount > 0 && (
                <tr style={{ borderBottom: `1px solid ${colors.slate100}`, backgroundColor: colors.slate50 }}>
                  <td style={{ padding: '24px 0', fontWeight: 700, fontSize: '14px', color: colors.slate500 }}>-</td>
                  <td style={{ padding: '24px 0' }}>
                    <p style={{ fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '-0.025em', fontStyle: 'italic', color: colors.slate900, margin: 0 }}>Project Security Deposit</p>
                    <p style={{ fontSize: '9px', fontWeight: 700, color: colors.slate400, textTransform: 'uppercase', margin: 0 }}>{job.depositPaid ? 'Paid & Reconciled' : 'Outstanding'}</p>
                  </td>
                  <td style={{ padding: '24px 0' }}>
                    <div style={{ 
                      display: 'inline-block', 
                      minWidth: '64px',
                      padding: '6px 12px', 
                      borderRadius: '9999px', 
                      fontSize: '8px', 
                      fontWeight: 900, 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.1em', 
                      fontStyle: 'italic', 
                      lineHeight: '1.2',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      backgroundColor: job.depositPaid ? colors.green100 : colors.orange100, 
                      color: job.depositPaid ? colors.green600 : colors.orange600 
                    }}>
                      {job.depositPaid ? 'Paid' : 'Unpaid'}
                    </div>
                  </td>
                  <td style={{ padding: '24px 0', textAlign: 'right', fontWeight: 900, color: job.depositPaid ? colors.green600 : colors.slate900, fontSize: '14px', fontStyle: 'italic' }}>
                    {job.depositPaid ? `- R ${calculatedDeposit.toFixed(2)}` : `R ${calculatedDeposit.toFixed(2)}`}
                  </td>
               </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '48px', paddingTop: '48px', borderTop: `1px solid ${colors.slate100}` }}>
        <table style={{ width: '100%', tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: 'bottom' }}>
                <p style={{ fontSize: '10px', fontWeight: 900, color: colors.slate900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0 }}>Tactical Statement Summary</p>
                <p style={{ fontSize: '9px', fontWeight: 700, color: colors.slate400, textTransform: 'uppercase', fontStyle: 'italic', lineHeight: 1.5, maxWidth: '384px', margin: '8px 0 0 0' }}>
                  This document represents the consolidated billing history for job mission {job.id}. 
                  Calculated as: [Total Billed] - [Deposit if Paid] - [Invoices Paid] = [Outstanding].
                </p>
              </td>
              <td style={{ verticalAlign: 'bottom', textAlign: 'right' }}>
                <p style={{ fontSize: '10px', fontWeight: 900, color: colors.slate400, textTransform: 'uppercase', letterSpacing: '0.1em', fontStyle: 'italic', marginBottom: '8px', margin: 0 }}>Total Amount Outstanding</p>
                <p style={{ fontSize: '36px', fontWeight: 900, color: colors.slate900, letterSpacing: '-0.05em', fontStyle: 'italic', margin: 0 }}>R {totalDueNow.toFixed(2)}</p>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: colors.slate400, textTransform: 'uppercase', letterSpacing: '0.25em', margin: 0 }}>Marketplace Statement • Generated via FixLink Protocol</p>
          <div style={{ display: 'inline-block', padding: '8px 24px', backgroundColor: colors.slate900, borderRadius: '9999px', fontSize: '8px', fontWeight: 900, color: colors.white, textTransform: 'uppercase', letterSpacing: '0.25em', fontStyle: 'italic', marginTop: '12px' }}>
            Mission Synchronized <span style={{ color: colors.primary }}>●</span> {new Date().getFullYear()} FixLink
          </div>
        </div>
      </div>
    </div>
  );

};
