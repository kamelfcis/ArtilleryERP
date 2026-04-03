import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This API route calls the update_all_unit_statuses() function
// Make sure to set SUPABASE_SERVICE_ROLE_KEY in your environment variables

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Call the update_all_unit_statuses() function
    const { data, error } = await supabaseAdmin.rpc('update_all_unit_statuses')

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'تم تحديث حالات الوحدات بنجاح'
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تحديث حالات الوحدات' },
      { status: 500 }
    )
  }
}








