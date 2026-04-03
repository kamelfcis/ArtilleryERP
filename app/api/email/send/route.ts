import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { emailTemplates, renderEmailTemplate, renderEmailSubject } from '@/lib/email/templates'

// This is a placeholder for email sending
// In production, integrate with email service (SendGrid, Resend, etc.)

export async function POST(request: NextRequest) {
  try {
    const { templateId, recipientEmail, data } = await request.json()

    if (!templateId || !recipientEmail) {
      return NextResponse.json(
        { error: 'معرف القالب والبريد الإلكتروني مطلوبان' },
        { status: 400 }
      )
    }

    const template = emailTemplates.find(t => t.id === templateId)
    if (!template) {
      return NextResponse.json(
        { error: 'القالب غير موجود' },
        { status: 404 }
      )
    }

    const subject = renderEmailSubject(template, data || {})
    const body = renderEmailTemplate(template, data || {})

    // Log email (in production, send via email service)
    const supabase = await createServerSupabaseClient()
    await supabase.from('email_logs').insert({
      template_id: templateId,
      recipient_email: recipientEmail,
      subject,
      body,
      status: 'sent', // In production, update after actual send
      sent_at: new Date().toISOString(),
    })

    // In production, send email here:
    // await sendEmail({
    //   to: recipientEmail,
    //   subject,
    //   html: body,
    // })

    return NextResponse.json({
      success: true,
      message: 'تم إرسال البريد الإلكتروني بنجاح',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء إرسال البريد' },
      { status: 500 }
    )
  }
}

