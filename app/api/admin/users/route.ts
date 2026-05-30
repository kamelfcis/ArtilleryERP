import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import {
  createAdminClient,
  handleSupabaseRouteError,
  safeSupabaseCall,
  SupabaseUnavailableError,
  validateSupabaseAdminConfig,
} from '@/lib/supabase/admin-server'

/** Resolve logged-in user from Bearer JWT (browser) or Supabase auth cookies (SSR). */
async function getVerifiedAuthUser(request: NextRequest): Promise<{ id: string } | null> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim()
  const admin = createAdminClient()

  if (bearer) {
    const {
      data: { user },
      error,
    } = await safeSupabaseCall(() => admin.auth.getUser(bearer))
    if (error || !user) return null
    return { id: user.id }
  }

  try {
    const cookieStore = cookies()
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore })
    const {
      data: { session },
    } = await safeSupabaseCall(() => supabaseAuth.auth.getSession())
    if (!session?.user) return null
    return { id: session.user.id }
  } catch (error) {
    if (error instanceof SupabaseUnavailableError) throw error
    return null
  }
}

export async function POST(request: NextRequest) {
  const configError = validateSupabaseAdminConfig()
  if (configError) return configError

  try {
    const { email, password, role } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()

    const { data: userData, error: userError } = await safeSupabaseCall(() =>
      supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
    )

    if (userError) {
      return NextResponse.json(
        { error: userError.message },
        { status: 400 }
      )
    }

    if (role && userData.user) {
      const { data: roleData } = await safeSupabaseCall(() =>
        supabaseAdmin
          .from('roles')
          .select('id')
          .eq('name', role)
          .single()
      )

      if (roleData) {
        await safeSupabaseCall(() =>
          supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: userData.user!.id,
              role_id: roleData.id,
            })
        )
      }
    }

    return NextResponse.json({
      success: true,
      user: userData.user,
    })
  } catch (error: unknown) {
    return handleSupabaseRouteError(error, 'حدث خطأ أثناء إنشاء المستخدم')
  }
}

export async function GET(request: NextRequest) {
  const configError = validateSupabaseAdminConfig()
  if (configError) return configError

  try {
    const authed = await getVerifiedAuthUser(request)
    if (!authed) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()

    const allUsers: Array<{ id: string; email?: string }> = []
    let page = 1
    const perPage = 1000
    while (true) {
      const { data, error } = await safeSupabaseCall(() =>
        supabaseAdmin.auth.admin.listUsers({ page, perPage })
      )
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      allUsers.push(...data.users)
      if (data.users.length < perPage) break
      page++
    }

    return NextResponse.json({ users: allUsers })
  } catch (error: unknown) {
    return handleSupabaseRouteError(error, 'حدث خطأ أثناء جلب المستخدمين')
  }
}

export async function PUT(request: NextRequest) {
  const configError = validateSupabaseAdminConfig()
  if (configError) return configError

  try {
    const { userId, email, password } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()

    const updateData: { email?: string; password?: string } = {}
    if (email) updateData.email = email
    if (password) updateData.password = password

    const { data, error } = await safeSupabaseCall(() =>
      supabaseAdmin.auth.admin.updateUserById(userId, updateData)
    )

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      user: data.user,
    })
  } catch (error: unknown) {
    return handleSupabaseRouteError(error, 'حدث خطأ أثناء تحديث المستخدم')
  }
}

export async function DELETE(request: NextRequest) {
  const configError = validateSupabaseAdminConfig()
  if (configError) return configError

  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()

    await safeSupabaseCall(() =>
      supabaseAdmin
        .from('staff')
        .delete()
        .eq('user_id', userId)
    )

    await safeSupabaseCall(() =>
      supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
    )

    const { error } = await safeSupabaseCall(() =>
      supabaseAdmin.auth.admin.deleteUser(userId)
    )

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف المستخدم بنجاح',
    })
  } catch (error: unknown) {
    return handleSupabaseRouteError(error, 'حدث خطأ أثناء حذف المستخدم')
  }
}
