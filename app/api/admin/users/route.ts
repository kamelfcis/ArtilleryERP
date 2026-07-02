import { NextRequest, NextResponse } from 'next/server'
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
    // Loaded lazily so `@supabase/auth-helpers-nextjs` is never imported in api mode.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRouteHandlerClient } =
      require('@supabase/auth-helpers-nextjs') as typeof import('@supabase/auth-helpers-nextjs')
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

async function userIsSuperAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient()

  const { data: roleData } = await safeSupabaseCall(() =>
    admin.from('roles').select('id').eq('name', 'SuperAdmin').single()
  )

  if (!roleData) return false

  const { data: userRole } = await safeSupabaseCall(() =>
    admin
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userId)
      .eq('role_id', roleData.id)
      .maybeSingle()
  )

  return !!userRole
}

/** Require authenticated SuperAdmin; returns user or error response. */
async function requireSuperAdmin(
  request: NextRequest
): Promise<{ id: string } | NextResponse> {
  const authed = await getVerifiedAuthUser(request)
  if (!authed) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  const isSuperAdmin = await userIsSuperAdmin(authed.id)
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'غير مصرح - مدير عام فقط' }, { status: 403 })
  }

  return authed
}

async function lockUserLogin(userId: string): Promise<{ error: { message: string } | null }> {
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()

  await safeSupabaseCall(() =>
    supabaseAdmin.from('user_accounts').upsert({
      user_id: userId,
      is_active: false,
      updated_at: now,
    })
  )

  const { error } = await safeSupabaseCall(() =>
    supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    })
  )

  return { error }
}

async function unlockUserLogin(userId: string): Promise<{ error: { message: string } | null }> {
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()

  await safeSupabaseCall(() =>
    supabaseAdmin.from('user_accounts').upsert({
      user_id: userId,
      is_active: true,
      updated_at: now,
    })
  )

  const { error } = await safeSupabaseCall(() =>
    supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
      user_metadata: { deleted: null, deleted_at: null },
    })
  )

  return { error }
}

export async function POST(request: NextRequest) {
  const configError = validateSupabaseAdminConfig()
  if (configError) return configError

  try {
    const authResult = await requireSuperAdmin(request)
    if (authResult instanceof NextResponse) return authResult

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

    if (userData.user) {
      await safeSupabaseCall(() =>
        supabaseAdmin.from('user_accounts').insert({
          user_id: userData.user!.id,
          is_active: true,
        })
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

    const { data: accountRows } = await safeSupabaseCall(() =>
      supabaseAdmin
        .from('user_accounts')
        .select('user_id, is_active, deleted_at')
    )

    const accountMap = new Map(
      (accountRows ?? []).map((a: { user_id: string; is_active: boolean; deleted_at: string | null }) => [
        a.user_id,
        { is_active: a.is_active, deleted_at: a.deleted_at },
      ])
    )

    const visibleUsers = allUsers
      .filter((u) => {
        const account = accountMap.get(u.id)
        return !account?.deleted_at
      })
      .map((u) => {
        const account = accountMap.get(u.id)
        return {
          ...u,
          is_active: account?.is_active ?? true,
        }
      })

    return NextResponse.json({ users: visibleUsers })
  } catch (error: unknown) {
    return handleSupabaseRouteError(error, 'حدث خطأ أثناء جلب المستخدمين')
  }
}

export async function PATCH(request: NextRequest) {
  const configError = validateSupabaseAdminConfig()
  if (configError) return configError

  try {
    const authResult = await requireSuperAdmin(request)
    if (authResult instanceof NextResponse) return authResult

    const { userId, isActive } = await request.json()

    if (!userId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'معرف المستخدم وحالة التفعيل مطلوبان' },
        { status: 400 }
      )
    }

    if (userId === authResult.id) {
      return NextResponse.json(
        { error: 'لا يمكنك تعطيل حسابك الخاص' },
        { status: 400 }
      )
    }

    const { error } = isActive
      ? await unlockUserLogin(userId)
      : await lockUserLogin(userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: isActive ? 'تم تفعيل تسجيل الدخول' : 'تم تعطيل تسجيل الدخول',
    })
  } catch (error: unknown) {
    return handleSupabaseRouteError(error, 'حدث خطأ أثناء تحديث حالة تسجيل الدخول')
  }
}

export async function PUT(request: NextRequest) {
  const configError = validateSupabaseAdminConfig()
  if (configError) return configError

  try {
    const authResult = await requireSuperAdmin(request)
    if (authResult instanceof NextResponse) return authResult

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
    const authResult = await requireSuperAdmin(request)
    if (authResult instanceof NextResponse) return authResult

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    if (userId === authResult.id) {
      return NextResponse.json(
        { error: 'لا يمكنك تعطيل حسابك الخاص' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()
    const now = new Date().toISOString()

    await safeSupabaseCall(() =>
      supabaseAdmin.from('user_accounts').upsert({
        user_id: userId,
        is_active: false,
        deleted_at: now,
        deleted_by: authResult.id,
        updated_at: now,
      })
    )

    await safeSupabaseCall(() =>
      supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
    )

    await safeSupabaseCall(() =>
      supabaseAdmin
        .from('staff')
        .update({ is_active: false })
        .eq('user_id', userId)
    )

    const { error } = await safeSupabaseCall(() =>
      supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: '876000h',
        user_metadata: { deleted: true, deleted_at: now },
      })
    )

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'تم تعطيل المستخدم بنجاح',
    })
  } catch (error: unknown) {
    return handleSupabaseRouteError(error, 'حدث خطأ أثناء تعطيل المستخدم')
  }
}
