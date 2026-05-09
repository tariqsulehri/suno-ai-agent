import nodemailer from 'nodemailer'
import type { LeadData, ReviewData } from '@/types'
import type { TenantConfig } from '@/lib/tenants/types'

interface EscalationInput {
  tenant:   TenantConfig
  lead:     LeadData
  review:   ReviewData | null
  shopName: string
  summary:  string
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function val(v: string | null | undefined): string {
  return v?.trim() || 'Not provided'
}

function renderHtml({ tenant, lead, review, shopName, summary }: EscalationInput): string {
  const sentimentLabel = review?.sentiment === 'complaint' ? '🚨 Complaint' : '⚠️ Negative'
  const rating = review?.rating ? `${review.rating}/5` : '—'

  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.6;max-width:600px;">
      <div style="background:#ef4444;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:18px;">🚨 Urgent Customer ${sentimentLabel} — Action Required</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.85;">${escapeHtml(tenant.companyName)} · ${escapeHtml(shopName)}</p>
      </div>
      <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:0 0 8px 8px;padding:20px;">

        <table style="border-collapse:collapse;width:100%;background:#fff;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:16px;">
          <tr><td style="padding:8px 14px;color:#6b7280;font-size:13px;font-weight:600;width:110px;">Customer</td>
              <td style="padding:8px 14px;color:#111;font-size:13px;">${escapeHtml(val(lead.name))}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 14px;color:#6b7280;font-size:13px;font-weight:600;">Phone</td>
              <td style="padding:8px 14px;color:#111;font-size:13px;">${escapeHtml(val(lead.phone))}</td></tr>
          <tr><td style="padding:8px 14px;color:#6b7280;font-size:13px;font-weight:600;">Email</td>
              <td style="padding:8px 14px;color:#111;font-size:13px;">${escapeHtml(val(lead.email))}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 14px;color:#6b7280;font-size:13px;font-weight:600;">Outlet</td>
              <td style="padding:8px 14px;color:#111;font-size:13px;">${escapeHtml(shopName)}</td></tr>
          <tr><td style="padding:8px 14px;color:#6b7280;font-size:13px;font-weight:600;">Category</td>
              <td style="padding:8px 14px;color:#111;font-size:13px;text-transform:capitalize;">${escapeHtml(val(review?.category))}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:8px 14px;color:#6b7280;font-size:13px;font-weight:600;">Issue</td>
              <td style="padding:8px 14px;color:#111;font-size:13px;">${escapeHtml(val(review?.subcategory))}</td></tr>
          <tr><td style="padding:8px 14px;color:#6b7280;font-size:13px;font-weight:600;">Rating</td>
              <td style="padding:8px 14px;color:#ef4444;font-weight:700;font-size:13px;">${rating}</td></tr>
        </table>

        <h3 style="margin:0 0 8px;font-size:14px;color:#374151;">What the customer said</h3>
        <p style="margin:0;background:#fff;border-left:4px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;font-size:13px;color:#374151;">${escapeHtml(summary)}</p>

        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">
          This alert was triggered automatically because the customer sentiment was classified as ${sentimentLabel.toLowerCase()}.
          Please follow up with the customer within 24 hours.
        </p>
      </div>
    </div>
  `
}

function renderText({ lead, review, shopName, summary, tenant }: EscalationInput): string {
  return [
    `URGENT: Customer Complaint — ${tenant.companyName} · ${shopName}`,
    '',
    `Customer: ${val(lead.name)}`,
    `Phone:    ${val(lead.phone)}`,
    `Email:    ${val(lead.email)}`,
    `Outlet:   ${shopName}`,
    `Category: ${val(review?.category)}`,
    `Issue:    ${val(review?.subcategory)}`,
    `Rating:   ${review?.rating ?? '—'}`,
    '',
    'Customer feedback:',
    summary,
    '',
    'Please follow up within 24 hours.',
  ].join('\n')
}

export async function sendEscalationAlert(input: EscalationInput): Promise<void> {
  const config = input.tenant.emailNotifications
  if (!config?.enabled) return

  const user = process.env[config.smtp.userEnv]
  const pass = process.env[config.smtp.passEnv]
  if (!user || !pass) return

  const recipients = [...new Set(
    (config.recipients ?? []).map((r) => r?.trim()).filter(Boolean) as string[]
  )]
  if (recipients.length === 0) return

  try {
    const transporter = nodemailer.createTransport({
      host:   config.smtp.host,
      port:   config.smtp.port,
      secure: config.smtp.secure,
      auth:   { user, pass },
    })
    await transporter.sendMail({
      from:    `"${config.fromName}" <${config.fromEmail}>`,
      to:      recipients,
      subject: `🚨 URGENT Complaint — ${input.shopName} · ${input.tenant.companyName}`,
      text:    renderText(input),
      html:    renderHtml(input),
    })
  } catch (err) {
    console.error('[escalation-alert]', err)
  }
}
