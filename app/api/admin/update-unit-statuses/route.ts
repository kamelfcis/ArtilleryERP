import { NextRequest, NextResponse } from 'next/server'
import {
  createAdminClient,
  handleSupabaseRouteError,
  safeSupabaseCall,
  validateSupabaseAdminConfig,
} from '@/lib/supabase/admin-server'

export async function POST(_request: NextRequest) {
  const configError = validateSupabaseAdminConfig()
  if (configError) return configError

  try {
    const supabaseAdmin = createAdminClient()

    const { error } = await safeSupabaseCall(() =>
      supabaseAdmin.rpc('update_all_unit_statuses')
    )

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'تم تحديث حالات الوحدات بنجاح',
    })
  } catch (error: unknown) {
    return handleSupabaseRouteError(error, 'حدث خطأ أثناء تحديث حالات الوحدات')
  }
}
