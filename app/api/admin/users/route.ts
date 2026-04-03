import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This is a server-side API route for admin operations
// Make sure to set SUPABASE_SERVICE_ROLE_KEY in your environment variables

function getAdminClient() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, role } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getAdminClient()

    // Create user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (userError) {
      return NextResponse.json(
        { error: userError.message },
        { status: 400 }
      )
    }

    // Assign role if provided
    if (role && userData.user) {
      const { data: roleData } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('name', role)
        .single()

      if (roleData) {
        await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userData.user.id,
            role_id: roleData.id,
          })
      }
    }

    return NextResponse.json({
      success: true,
      user: userData.user,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء إنشاء المستخدم' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()

    const allUsers: any[] = []
    let page = 1
    const perPage = 1000
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      allUsers.push(...data.users)
      if (data.users.length < perPage) break
      page++
    }

    return NextResponse.json({ users: allUsers })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء جلب المستخدمين' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, email, password } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getAdminClient()

    const updateData: any = {}
    if (email) updateData.email = email
    if (password) updateData.password = password

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData)

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تحديث المستخدم' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getAdminClient()

    // Delete staff records first
    await supabaseAdmin
      .from('staff')
      .delete()
      .eq('user_id', userId)

    // Delete user roles
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    // Delete user from auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء حذف المستخدم' },
      { status: 500 }
    )
  }
}
