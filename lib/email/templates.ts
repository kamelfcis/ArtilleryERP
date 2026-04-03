export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  variables: string[]
}

export const emailTemplates: EmailTemplate[] = [
  {
    id: 'reservation-confirmation',
    name: 'تأكيد الحجز',
    subject: 'تأكيد حجزك - {{reservation_number}}',
    body: `
      <div dir="rtl" style="font-family: Arial, Tahoma; padding: 20px;">
        <h2>تأكيد الحجز</h2>
        <p>عزيزي/عزيزتي {{guest_name}},</p>
        <p>نؤكد استلام حجزك برقم: <strong>{{reservation_number}}</strong></p>
        <h3>تفاصيل الحجز:</h3>
        <ul>
          <li>الوحدة: {{unit_number}}</li>
          <li>تاريخ الدخول: {{check_in_date}}</li>
          <li>تاريخ الخروج: {{check_out_date}}</li>
          <li>المبلغ الإجمالي: {{total_amount}} ر.س</li>
        </ul>
        <p>نشكرك لاختيارك خدماتنا.</p>
      </div>
    `,
    variables: ['reservation_number', 'guest_name', 'unit_number', 'check_in_date', 'check_out_date', 'total_amount'],
  },
  {
    id: 'check-in-reminder',
    name: 'تذكير تسجيل الدخول',
    subject: 'تذكير: تسجيل الدخول غداً - {{reservation_number}}',
    body: `
      <div dir="rtl" style="font-family: Arial, Tahoma; padding: 20px;">
        <h2>تذكير تسجيل الدخول</h2>
        <p>عزيزي/عزيزتي {{guest_name}},</p>
        <p>نذكرك بأن موعد تسجيل الدخول لحجزك رقم <strong>{{reservation_number}}</strong> هو غداً.</p>
        <p><strong>تاريخ الدخول:</strong> {{check_in_date}}</p>
        <p><strong>وقت تسجيل الدخول:</strong> {{check_in_time}}</p>
        <p>ننتظر استقبالك.</p>
      </div>
    `,
    variables: ['reservation_number', 'guest_name', 'check_in_date', 'check_in_time'],
  },
  {
    id: 'check-out-reminder',
    name: 'تذكير تسجيل الخروج',
    subject: 'تذكير: تسجيل الخروج غداً - {{reservation_number}}',
    body: `
      <div dir="rtl" style="font-family: Arial, Tahoma; padding: 20px;">
        <h2>تذكير تسجيل الخروج</h2>
        <p>عزيزي/عزيزتي {{guest_name}},</p>
        <p>نذكرك بأن موعد تسجيل الخروج لحجزك رقم <strong>{{reservation_number}}</strong> هو غداً.</p>
        <p><strong>تاريخ الخروج:</strong> {{check_out_date}}</p>
        <p><strong>وقت تسجيل الخروج:</strong> {{check_out_time}}</p>
        <p>نتمنى أن تكون إقامتك ممتعة.</p>
      </div>
    `,
    variables: ['reservation_number', 'guest_name', 'check_out_date', 'check_out_time'],
  },
  {
    id: 'payment-reminder',
    name: 'تذكير الدفع',
    subject: 'تذكير: مبلغ متبقي للدفع - {{reservation_number}}',
    body: `
      <div dir="rtl" style="font-family: Arial, Tahoma; padding: 20px;">
        <h2>تذكير الدفع</h2>
        <p>عزيزي/عزيزتي {{guest_name}},</p>
        <p>نذكرك بأن هناك مبلغ متبقي للدفع لحجزك رقم <strong>{{reservation_number}}</strong>.</p>
        <p><strong>المبلغ المتبقي:</strong> {{remaining_amount}} ر.س</p>
        <p>يرجى تسوية المبلغ في أقرب وقت ممكن.</p>
      </div>
    `,
    variables: ['reservation_number', 'guest_name', 'remaining_amount'],
  },
]

export function renderEmailTemplate(template: EmailTemplate, data: Record<string, string>): string {
  let rendered = template.body
  template.variables.forEach(variable => {
    const value = data[variable] || `{{${variable}}}`
    rendered = rendered.replace(new RegExp(`{{${variable}}}`, 'g'), value)
  })
  return rendered
}

export function renderEmailSubject(template: EmailTemplate, data: Record<string, string>): string {
  let rendered = template.subject
  template.variables.forEach(variable => {
    const value = data[variable] || `{{${variable}}}`
    rendered = rendered.replace(new RegExp(`{{${variable}}}`, 'g'), value)
  })
  return rendered
}

