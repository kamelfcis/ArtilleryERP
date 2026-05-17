import { formatCurrency } from '@/lib/utils'
import type { Reservation } from '@/lib/types/database'

const UNIT_TYPE_AR: Record<string, string> = {
  room: 'غرفة',
  suite: 'جناح',
  chalet: 'شاليه',
  duplex: 'دوبلكس',
  villa: 'فيلا',
  apartment: 'عمارة',
}

const GUEST_TYPE_AR: Record<string, string> = {
  military: 'عسكري',
  civilian: 'مدنى',
  club_member: 'عضو دار',
  artillery_family: 'ابناء مدفعية',
}

// Module-level cache for logo base64
let cachedLogoBase64: string | null = null

async function getLogoBase64(): Promise<string> {
  if (cachedLogoBase64) return cachedLogoBase64
  try {
    const res = await fetch('/logo.jpeg')
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result as string
        resolve(cachedLogoBase64)
      }
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

// Module-level cache for QR code base64
let cachedQrBase64: string | null = null

async function getQrBase64(): Promise<string> {
  if (cachedQrBase64) return cachedQrBase64
  try {
    const res = await fetch('/artillery203030.png')
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        cachedQrBase64 = reader.result as string
        resolve(cachedQrBase64)
      }
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

// Convert Western digits (0-9) to Arabic-Indic (٠-٩)
function toAr(val: string | number | undefined | null): string {
  if (val == null) return ''
  return String(val).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)])
}

export async function buildContractHtml(
  reservation: Reservation,
  opts?: { mergePrice?: number; reservationServices?: any[] }
): Promise<string> {
  const [logoBase64, qrBase64] = await Promise.all([getLogoBase64(), getQrBase64()])
  const reservationServices = opts?.reservationServices ?? []
  const servicesTotal = reservationServices.reduce((sum, rs) => sum + rs.total_amount, 0)

  // Use merge price from opts when set, otherwise reservation total
  const effectiveTotal =
    opts?.mergePrice != null && !Number.isNaN(opts.mergePrice) && opts.mergePrice > 0
      ? opts.mergePrice
      : reservation.total_amount
  const accommodationAmount = effectiveTotal - servicesTotal
const remaining = effectiveTotal - reservation.paid_amount

const guestFullName = `${reservation.guest?.first_name_ar || reservation.guest?.first_name || ''} ${reservation.guest?.last_name_ar || reservation.guest?.last_name || ''}`.trim()
const locationName = reservation.unit?.location?.name_ar || reservation.unit?.location?.name || ''

const checkIn = new Date(reservation.check_in_date)
const checkOut = new Date(reservation.check_out_date)
const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)))

const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' })
const todayStr = new Date().toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' })

const unitTypeAr = UNIT_TYPE_AR[reservation.unit?.type || ''] || reservation.unit?.type || ''
const guestTypeAr = GUEST_TYPE_AR[reservation.guest?.guest_type || ''] || ''
const totalPersons = reservation.unit?.capacity || 0
const printDateTime = new Date().toLocaleString('ar-EG', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
// Build family rows (4 blank rows for manual entry)
let familyRowsHtml = ''
for (let i = 0; i < 4; i++) {
  const num = i + 1
  familyRowsHtml += `<tr>
    <td class="c">${toAr(num)}</td><td>&nbsp;</td><td>&nbsp;</td>
    <td class="c">${toAr(num)}</td><td>&nbsp;</td><td>&nbsp;</td>
  </tr>`
}

// Services rows for financial table
let servicesRowsHtml = ''
if (reservationServices && reservationServices.length > 0) {
  servicesRowsHtml = reservationServices.map((rs: any) => `
    <tr>
      <td colspan="2">&nbsp;</td>
      <td>&nbsp;</td>
      <td>${formatCurrency(rs.total_amount)}</td>
      <td>${formatCurrency(rs.unit_price)}</td>
      <td>${toAr(rs.quantity)}</td>
      <td colspan="3">${rs.service?.name_ar || rs.service?.name || ''}</td>
      <td>${formatCurrency(rs.total_amount)}</td>
    </tr>
  `).join('')
}

const printContent = `
  <!DOCTYPE html>
  <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>عقد إيجار وحدة سكنية - ${toAr(reservation.reservation_number)}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        @page {
          size: A4;
          margin: 0.15in;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Arial', 'Tahoma', 'Simplified Arabic', sans-serif;
          direction: rtl;
          color: #000;
          font-size: 14px;
          line-height: 1.4;
          background: #fff;
        }

        .page { page-break-after: always; }
        .page:last-child { page-break-after: auto; }

        /* Double page border */
        .page-border {
          border: 4px double #000;
          padding: 6px 8px;
          margin: 1px;
          min-height: calc(100vh - 0.6in - 8px);
          display: flex;
          flex-direction: column;
        }

        /* Signature bracket gap */
        .sig-gap {
          display: inline-block;
          min-width: 120px;
          border-bottom: 1px dotted #000;
        }

        /* Tables */
        table { width: 100%; border-collapse: collapse; }
        td, th {
          border: 1.5px solid #000;
          padding: 3px 5px;
          font-size: 13px;
          vertical-align: middle;
        }
        th { background: #f0f0f0; font-weight: bold; text-align: center; }
        td.c { text-align: center; }
        td.b { font-weight: bold; }
        td.nb { border: none; }
        td.bt0 { border-top: none; }
        td.bb0 { border-bottom: none; }

        .header { display: flex; align-items: center; margin-bottom: 5px; position: relative; direction: ltr; }
        .header-logo { width: 72px; height: 72px; object-fit: contain; flex-shrink: 0; }
        .header-center { flex: 1; text-align: center; direction: rtl; }
        .header-center .brand-title {
          /* Use Tahoma/Arial first — they have proper Arabic glyph shaping
             and are guaranteed to be available.  Amiri (Google Fonts) is
             kept as a stylistic fallback when it loads.
             We deliberately removed:
               • font-style: italic   — italic Arabic shears glyph joins
               • letter-spacing: 2px  — letter-spacing BREAKS the kashida
                                         connections between Arabic letters,
                                         which made the text look shattered. */
          font-family: 'Tahoma', 'Arial', 'Simplified Arabic', 'Amiri', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #1a1a1a;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.15);
          padding-bottom: 4px;
          margin-bottom: 2px;
          border-bottom: 2px solid #b8860b;
          display: inline-block;
        }
        .header-center .title { font-size: 19px; font-weight: bold; border: 2px solid #000; display: inline-block; padding: 2px 18px; margin: 2px 0; }
        .header-center .subtitle { font-size: 16px; font-weight: bold; }
        .header-copy-note { position: absolute; top: 0; right: 0; font-size: 10px; color: #666; direction: rtl; }

        .meta-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
        .meta-row span { }
        .meta-row .val { font-weight: bold; border-bottom: 1px dotted #000; min-width: 80px; display: inline-block; padding: 0 3px; }

        .section-title {
          text-align: center;
          font-weight: bold;
          font-size: 16px;
          background: #e8e8e8;
          border: 1.5px solid #000;
          padding: 3px;
          margin: 4px 0 0 0;
        }

        .inline-field { margin: 3px 0; font-size: 15px; }
        .inline-field .label { font-weight: bold; }
        .inline-field .dots { border-bottom: 1px dotted #000; min-width: 150px; display: inline-block; padding: 0 3px; }

        .sig-row { display: flex; justify-content: space-between; margin-top: 5px; gap: 10px; }
        .sig-block { text-align: right; width: 48%; }
        .sig-block .label { font-weight: bold; font-size: 15px; margin-bottom: 3px; }
        .sig-block .line { border-bottom: 1px dotted #000; margin-top: 14px; }
        .sig-block .sub { font-size: 10px; color: #555; margin-top: 2px; }

        .note-box {
          border: 1.5px solid #000;
          padding: 5px 8px;
          margin-top: 5px;
          font-size: 14px;
          line-height: 1.6;
        }
        .note-box .note-title {
          text-align: center;
          font-weight: bold;
          font-size: 16px;
          background: #e8e8e8;
          margin: -5px -8px 5px -8px;
          padding: 3px;
          border-bottom: 1.5px solid #000;
        }

        .separator { border-top: 2px dashed #000; margin: 5px 0; }

        /* Page 2 */
        .rules-page .page-border { padding: 16px 20px; }
        .rules-header { display: flex; align-items: flex-start; direction: ltr; margin-bottom: 6px; }
        .rules-header .qr-img { width: 80px; height: 80px; object-fit: contain; flex-shrink: 0; }
        .rules-top-title { text-align: center; font-size: 20px; font-weight: bold; text-decoration: underline; margin-bottom: 4px; }
        .rules-page h2 { text-align: center; font-size: 19px; margin-bottom: 4px; text-decoration: underline; }
        /* Custom RTL-safe ordered list.
           html2canvas does NOT paint native <ol> markers correctly in RTL
           direction — they end up on the LEFT side of each line.  We replace
           the native list-style with CSS counters and absolutely position the
           number on the RIGHT, which renders identically in both the print
           preview and the canvas-rasterised WhatsApp PDF. */
        .rules-page ol {
          list-style: none;
          padding: 0;
          margin: 0;
          counter-reset: rules-counter;
          font-size: 14px;
          line-height: 1.6;
        }
        .rules-page ol li {
          counter-increment: rules-counter;
          position: relative;
          padding-right: 28px;
          margin-bottom: 1px;
        }
        .rules-page ol li::before {
          content: counter(rules-counter) ".";
          position: absolute;
          right: 0;
          top: 0;
          font-weight: bold;
          min-width: 22px;
          text-align: right;
        }
        .rules-sig { margin-top: 12px; font-size: 15px; font-weight: bold; }
        .rules-sig .sig-line { border-bottom: 1px dotted #000; min-width: 200px; display: inline-block; }

        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
          .header-copy-note {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 10px;
  color: #666;
  direction: rtl;
}

.header-print-date {
  position: absolute;
  top: 15px;
  right: 0;
  font-size: 9px;
  color: #333;
  direction: rtl;
  border-top: 1px solid #999;
  padding-top: 2px;
  font-weight: bold;
}
      </style>
    </head>
    <body>

    <!-- ==================== PAGE 1: FRONT ==================== -->
    <div class="page">
      <div class="page-border">

      <!-- HEADER -->
      <div class="header">
        ${logoBase64 ? `<img src="${logoBase64}" class="header-logo" alt="Logo" />` : ''}
        <div class="header-center">
          <div class="brand-title">${locationName}</div>
        </div>
        <div style="flex-shrink:0; text-align:center; direction:rtl;">
          <div style="font-size:20px; font-weight:bold;">دار ضباط المدفعية</div>
          <div style="font-size:17px; font-weight:bold; margin-top:1px;">قسم الإسكان</div>
        </div>
        <div class="header-copy-note">هذه النسخة تسلم للمتعاقد شخصياً</div>
        <div class="header-print-date">
  تاريخ الطباعة : ${printDateTime}
</div>
      </div>
      <div style="text-align:center; margin-bottom:2px;">
        <div class="header-center">
          <div class="title">عقد</div>
          <div class="subtitle">إيجار وحدة سكنية</div>
        </div>
      </div>

      <!-- Contract number & date -->
      <div class="meta-row">
        <span>رقم العقد : <span class="val">${toAr(reservation.reservation_number)}</span></span>
        <span>تاريخه : <span class="val">${todayStr}</span></span>
      </div>

      <!-- 1. Personal ID Table -->
      <table>
        <tr>
          <th>تحقيق الشخصية</th>
          <th>العضوية</th>
          <th>الرقم القومى</th>
          <th>الرتبة</th>
          <th>الاسم</th>
          <th>السلاح</th>
        </tr>
        <tr>
          <td class="c">&nbsp;</td>
          <td class="c">&nbsp;</td>
          <td class="c">${toAr(reservation.guest?.national_id)}</td>
          <td class="c">${reservation.guest?.military_rank_ar || ''}</td>
          <td class="c b">${guestFullName}</td>
          <td class="c">${reservation.guest?.unit_ar || ''}</td>
        </tr>
      </table>

      <!-- 2. Contact info -->
      <div class="inline-field" style="display:flex; justify-content:space-between; margin-top:4px;">
        <span><span class="label">محل الإقامة :</span> <span class="dots">&nbsp;</span></span>
        <span><span class="label">تليفون :</span> <span class="dots">${toAr(reservation.guest?.phone)}</span></span>
      </div>

      <!-- 3. Family Members -->
   <div class="section-title">بيانات الأسرة حاملى بطاقات عضوية الدار :</div>
      <table>
        <tr>
          <th style="width:5%">م</th>
          <th style="width:30%">الاسم</th>
          <th style="width:15%">درجة القرابة</th>
          <th style="width:5%">م</th>
          <th style="width:30%">الاسم</th>
          <th style="width:15%">درجة القرابة</th>
        </tr>
        ${familyRowsHtml}
      </table>

      <!-- 4. Housing Unit Details -->
      <div class="section-title">بيانات الوحدة السكنية</div>
      <table>
        <tr>
          <th>عمارة / شاليه / فيلا</th>
          <th>رقم الوحدة</th>
          <th>عدد الأفراد</th>
          <th colspan="2">المدة</th>
          <th>القيمة الإيجارية</th>
        </tr>
        <tr>
          <th style="font-size:9px;font-weight:normal"></th>
          <th style="font-size:9px;font-weight:normal"></th>
          <th style="font-size:9px;font-weight:normal"></th>
          <th style="font-size:9px;">من</th>
          <th style="font-size:9px;">إلى</th>
          <th style="font-size:9px;font-weight:normal"></th>
        </tr>
        <tr>
          <td class="c b">${unitTypeAr}</td>
          <td class="c b">${toAr(reservation.unit?.unit_number)}</td>
          <td class="c">${toAr(totalPersons || '')}</td>
          <td class="c">${fmtDate(reservation.check_in_date)}</td>
          <td class="c">${fmtDate(reservation.check_out_date)}</td>
          <td class="c b">${formatCurrency(effectiveTotal)}</td>
        </tr>
      </table>

      <!-- 5. Signatures Row 1 -->
      <table style="margin-top:6px;">
        <tr>
          <td class="nb" style="width:50%; text-align:right; font-weight:bold; vertical-align:top;">عضو / ق.م / مدنى : ${guestTypeAr}</td>
          <td class="nb" style="width:50%; text-align:right; font-weight:bold; vertical-align:top;">قسم الإسكان</td>
        </tr>
        <tr>
          <td class="nb" style="text-align:right; font-weight:bold; padding-top:8px;">التوقيع : ( <span class="sig-gap">&nbsp;</span> )</td>
          <td class="nb" style="text-align:right; font-weight:bold; padding-top:8px;">التوقيع : ( <span class="sig-gap">&nbsp;</span> )</td>
        </tr>
        <tr>
          <td class="nb" style="text-align:right; font-weight:bold;">الاسم : ${guestFullName}</td>
          <td class="nb" style="text-align:right; font-size:9px; color:#555;">رئيس قسم الإسكان</td>
        </tr>
      </table>

      <!-- SEPARATOR -->
      <div class="separator"></div>

      <!-- 6. Lower Receipt Section -->
      <div class="meta-row">
        <span>رقم العقد : <span class="val">${toAr(reservation.reservation_number)}</span></span>
      </div>
      <div class="inline-field">
        <span class="label">رقم العضوية :</span> <span class="dots">&nbsp;</span>
        &nbsp;&nbsp;&nbsp;
        <span class="label">رقم تحقيق الشخصية :</span> <span class="dots">&nbsp;</span>
        &nbsp;&nbsp;&nbsp;
        <span class="label">الرقم القومى :</span> <span class="dots">${toAr(reservation.guest?.national_id)}</span>
      </div>
      <div class="inline-field">
        <span class="label">رتبة :</span> <span class="dots">${reservation.guest?.military_rank_ar || ''}</span>
        &nbsp;&nbsp;&nbsp;
        <span class="label">الاسم :</span> <span class="dots">${guestFullName}</span>
      </div>

      <!-- 7. Financial Breakdown Table -->
      <table style="margin-top:5px;">
        <tr>
          <th colspan="2">مدة الإقامة</th>
          <th rowspan="2">رقم الوحدة</th>
          <th rowspan="2">إجمالى القيمة الإيجارية</th>
          <th rowspan="2">رسم الخدمة</th>
          <th rowspan="2">المرافقين</th>
          <th rowspan="2">عدد</th>
          <th colspan="3">الإعاشة</th>
          <th rowspan="2">الإجمالى</th>
        </tr>
        <tr>
          <th>من</th>
          <th>إلى</th>
          <th>إفطار</th>
          <th>غداء</th>
          <th>عشاء</th>
        </tr>
        <tr>
          <td class="c">${fmtDate(reservation.check_in_date)}</td>
          <td class="c">${fmtDate(reservation.check_out_date)}</td>
          <td class="c b">${toAr(reservation.unit?.unit_number)}</td>
          <td class="c b">${formatCurrency(accommodationAmount)}</td>
          <td class="c">${servicesTotal > 0 ? formatCurrency(servicesTotal) : ''}</td>
          <td class="c">${totalPersons > 1 ? toAr(totalPersons - 1) : ''}</td>
          <td class="c">${totalPersons ? toAr(totalPersons) : ''}</td>
          <td class="c">&nbsp;</td>
          <td class="c">&nbsp;</td>
          <td class="c">&nbsp;</td>
          <td class="c b">${formatCurrency(effectiveTotal)}</td>
        </tr>
        ${servicesRowsHtml}
      </table>

      ${reservation.discount_amount > 0 ? `
      <div class="inline-field" style="margin-top:4px;">
        <span class="label">القيمة الايجارية بعد الخصم :</span> <span class="dots">${formatCurrency(effectiveTotal - reservation.discount_amount)}</span>
      </div>
      ` : ''}

      <!-- Additional fees -->
      <div class="inline-field" style="margin-top:4px;">
        <span class="label">رسوم إضافية :</span> <span class="dots"></span>
        &nbsp;&nbsp;&nbsp;
        <span class="label">المدفوع :</span> <span class="dots">${formatCurrency(reservation.paid_amount)}</span>
        &nbsp;&nbsp;&nbsp;
        <span class="label">المتبقى :</span> <span class="dots">${formatCurrency(remaining)}</span>
      </div>

      <!-- Member signature -->
      <div class="sig-row" style="margin-top:5px;">
        <div class="sig-block" style="text-align:right;">
          <div class="label">توقيع العضو : ( <span class="sig-gap">&nbsp;</span> )</div>
          <div class="label" style="margin-top:4px;">الاسم : ${guestFullName}</div>
        </div>
        <div class="sig-block" style="text-align:right;">
          <div class="label">تاريخ الدخول : ${fmtDate(reservation.check_in_date)}</div>
          <div class="label" style="margin-top:4px;">تاريخ الخروج : ${fmtDate(reservation.check_out_date)}</div>
          <div class="label" style="margin-top:4px;">عدد الليالى : ${toAr(nights)}</div>
        </div>
      </div>

      ${reservation.notes_ar || reservation.notes ? `
      <div class="inline-field" style="margin-top:5px;">
        <span class="label">مسئول الحجز :</span> <span class="dots">${reservation.notes_ar || reservation.notes || ''}</span>
      </div>
      ` : ''}
      

      <!-- Follow instructions notice -->
<div style="
  margin-top: 10px;
  text-align: center;
  font-size: 15px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #000;
">
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2.5" stroke-linecap="round"
       stroke-linejoin="round">
    <path d="M19 12H5"></path>
    <path d="M12 19l-7-7 7-7"></path>
  </svg>

  <span>برجاء اتباع التعليمات في الخلف</span>
</div>
      </div><!-- /.page-border -->
    </div>

    <!-- ==================== PAGE 2: BACK ==================== -->
    <div class="page rules-page">
      <div class="page-border">

      ${qrBase64 ? `<div style="text-align:left; margin-bottom:4px;"><img src="${qrBase64}" alt="QR" style="width:70px; height:70px; object-fit:contain;" /></div>` : ''}

      <!-- Rules at the top of page 2 -->
      <div class="rules-top-title">تعليمات الإسكان بقرية روكيت بيتش الندى</div>
      <h2>التعليمات الرئيسية لتنظيم الإسكان :</h2>
      <ol>
        <li>الأساس فى الإقامة بقرية روكيت بيتش الندى حاملى بطاقات عضوية المدفعية المجددة عن نفس العام وأسرهم.</li>
        
        <li>التأكد من بطاقة عضوية الندى للضباط وأسرهم عند الإقامة بقرية روكيت بيتش الندى.</li>
        <li>غير مسموح للعضو بالتنازل عن الوحدة السكنية المخصصة لأى عضو آخر.</li>
        <li>يجب أن يكون عدد الأعضاء مساوياً بعدد الأسرة بالوحدة وفى حالة الزيادة يتم تحصيل ١٥٠ جنيهاً عن كل فرد زيادة بحد أقصى ٢ فرد.</li>
        <li>الوحدات السكنية تسلم للضباط شخصياً أو زوجته بشرط تواجد بطاقة العضوية المجددة عن نفس العام ولا يجوز إقامة أبناء الضباط بمفردهم بالوحدة السكنية لمن هم تحت السن أو غير متزوجين.</li>
        <li>غير مسموح بإصطحاب الحيوانات الأليفة.</li>
        <li>غير مسموح بأستعمال الشوايات و الشيشة داخل الوحدات السكنية.</li>
        <li>تسلم جميع الأمانات خاصة الضباط وأسرته فى خزينة الأمانات بقسم الاستقبال عدا ذلك يكون مسئولية العضو نفسه.</li>
        <li>عدم إصطحاب الأسلحة النارية والبيضاء بقرية بيتش الندى وتسلم بخزينة الأمانات بقسم الاستقبال.</li>
        <li>عند تسليم الوحدة السكنية يخصم الفاقد التالف من قيمة التأمين على الوحدة السكنية وفى حالة زيادة قيمة التالف أكثر من قيمة التأمين يتم تحصيلها من الضابط وفى حالة عدم السداد يتم إخطار قسم الإسكان بالدار لايقاف عضوية روكيت بيتش الندى لحين السداد.</li>
        <li>فى حالة تواجد ( نجل - كريمة ) الضابط ومعهم كارنيهات عضوية القرية روكيت بيتش الندى تابع للضابط وليس كارنيهات فوق السن لايتم تسليمهم الوحدة السكنية.</li>
        <li>فى حالة تواجد ( نجل - كريمة ) الضابط ومعهم كارنيهات عضوية القرية روكيت بيتش الندى فوق السن وعقد إسكان بقيمة إيجارية للعسكريين يتم التعاقد معهم بعقد جديد طبقاً لفئتهم.</li>
        <li>الزائر لقاطنى القرية أثناء الحجز يتم دفع رسوم دخول حسب صفة الزائر ( مدنى / ق.م / مدفعية / حامل كارنية الندى ).</li>
        <li>يتم إخطار مكتب الاستقبال بالدار وصفة الزائرين قبل مجيئهم بوقت كافى.</li>
        <li>لايسمح بتعديل الحجز سواء بالتقديم أو التأخير لمدة الحجز ويعتبر أى تعديل على المده بمثابة تعاقد جديد تطبق عليه إشتراطات الحجز فى البنود ( 1 - 2 - 3 بالملاحظات ).</li>
        <li>الفرد بعد ٨ سنوات يحاسب كفرد بالغ.</li>
        <li>حدد الأرقام الآتية للرد على التساؤلات والشكاوى ( 0222910609  - 01505346563 - 01090900516 ).</li>
        
      </ol>

      <!-- Notes Box -->
      <div class="note-box" style="margin-bottom:6px;">
        <div class="note-title" style="text-align:right; margin:0 0 4px 0; padding:0; background:transparent; border:none;">ملحوظة :</div>
        <div>١ - فى حالة ارتجاع العقد يتم خصم مبلغ ٢٥٪ من اجمالى قيمة التعاقد حتى ٣ أيام بخلاف يوم بداية العقد.</div>
        <div>٢ - فى حالة ارتجاع العقد قبل بداية التعاقد بأقل من ٣ أيام يتم خصم ٥٠٪ من قيمة التعاقد.</div>
        <div>٣ - لا يسمح بارتجاع قيمة العقد بعد مُضى أول يوم تعاقد.</div>
        <div>٤ - ميعاد استلام الوحدة الساعة ١٢ ظهراً والتسليم ١٠ صباحاً</div>
        <div>٥ - يتم دفع قيمة تأمين للشاليه ٥٠٠ ج.م والشقة والفيلا ١٠٠٠ ج.م عند الإسكان فى القرية.</div>
        <div>٦ - يجب تسليم الشقة نظيفة؛ وفى حالة عدم تسليم الوحدة نظيفة يتم خصم ٢٠٠ ج.م من قيمة التأمين المدفوع فى القرية.</div>
      </div>

      <!-- Signature -->
      <div class="rules-sig">
        <div>توقيع العضو : ( <span class="sig-gap">&nbsp;</span> )</div>
        <div style="margin-top:6px;">الإسم : <span class="sig-line">&nbsp;</span></div>
      </div>
      </div><!-- /.page-border -->
    </div>

    </body>
  </html>
`


  return printContent
}
