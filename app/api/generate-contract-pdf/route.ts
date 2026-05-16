import { NextRequest, NextResponse } from 'next/server'

// Allow up to 60s on Vercel Pro; automatically clamped to 10s on Hobby plan
export const maxDuration = 60

export async function POST(request: NextRequest) {
  let browser: import('puppeteer-core').Browser | null = null

  try {
    const { html } = (await request.json()) as { html: string }
    if (!html) {
      return NextResponse.json({ error: 'missing html' }, { status: 400 })
    }

    const chromium = (await import('@sparticuz/chromium-min')).default
    const puppeteer = (await import('puppeteer-core')).default

    // Pin to a stable chromium-min release tar so the download is deterministic.
    // v131 matches a widely tested serverless build.
    const CHROMIUM_URL =
      'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      defaultViewport: { width: 1200, height: 900 },
      executablePath: await chromium.executablePath(CHROMIUM_URL),
      headless: true,
    })

    const page = await browser.newPage()

    // Load the HTML (all images are already embedded as base64 by buildContractHtml).
    // We use waitUntil: 'load' and then explicitly wait for fonts so that Amiri
    // (loaded via Google Fonts @import) has time to finish before we capture the PDF.
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 })

    // Wait for the Amiri font (and any other web fonts) to be fully loaded
    await page.evaluate(() => document.fonts.ready)

    // Produce a PDF that uses exactly the same margins as the @page rule
    // in build-contract-html.ts: 0.15in on every side.
    const pdfBytes: Uint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0.15in', right: '0.15in', bottom: '0.15in', left: '0.15in' },
    })

    // Convert Uint8Array → Buffer so it is accepted as a valid BodyInit
    const pdfBuffer = Buffer.from(pdfBytes)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="contract.pdf"',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error('[generate-contract-pdf]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (browser) await browser.close()
  }
}
