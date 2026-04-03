'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import { Hotel, PartyPopper, Users, ArrowLeft, Lock, Sparkles, Shield } from 'lucide-react'
import Image from 'next/image'

const modules = [
  {
    id: 'hotel',
    title: 'حجوزات الفنادق',
    titleEn: 'Hotel Reservations',
    description: 'إدارة حجوزات الفنادق والغرف والأجنحة والشاليهات مع لوحة تحكم متكاملة',
    icon: Hotel,
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
    href: '/dashboard',
    active: true,
    gradient: 'from-blue-500 to-indigo-600',
    glowColor: 'blue',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-600',
  },
  {
    id: 'events',
    title: 'حجز حفلات و قاعات الأفراح',
    titleEn: 'Events & Halls Booking',
    description: 'إدارة حجوزات قاعات الأفراح والمناسبات والحفلات الخاصة',
    icon: PartyPopper,
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80',
    href: '#',
    active: false,
    gradient: 'from-purple-500 to-pink-600',
    glowColor: 'purple',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-600',
  },
  {
    id: 'hr',
    title: 'إدارة الموارد البشرية',
    titleEn: 'HR Management',
    description: 'إدارة شؤون الموظفين والرواتب والحضور والانصراف',
    icon: Users,
    image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80',
    href: '#',
    active: false,
    gradient: 'from-emerald-500 to-teal-600',
    glowColor: 'emerald',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-600',
  },
]

export default function ModulesPage() {
  const router = useRouter()
  const { user, loading, roles, hasRole } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
      return
    }
    // Non-SuperAdmin users skip this page entirely
    if (!loading && user && roles.length > 0 && !hasRole('SuperAdmin')) {
      router.replace('/dashboard')
    }
  }, [loading, user, roles, hasRole, router])

  // Show loading while checking auth or waiting for roles
  if (loading || !user || roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-3 border-slate-200 border-t-blue-500 rounded-full"
        />
      </div>
    )
  }

  // If not SuperAdmin, show nothing (redirecting)
  if (!hasRole('SuperAdmin')) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white relative overflow-hidden" dir="rtl">
      {/* Animated Background */}
      <div className="absolute inset-0">
        {/* Gradient Mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.04),transparent_60%)]" />

        {/* Dot Grid */}
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_center,#94a3b8_1px,transparent_1px)] bg-[size:40px_40px]" />

        {/* Floating Orbs */}
        <motion.div
          className="absolute top-20 right-20 w-72 h-72 bg-blue-200/30 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.35, 0.2], x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-20 left-20 w-96 h-96 bg-purple-200/30 rounded-full blur-[120px]"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.3, 0.2], x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-200/20 rounded-full blur-[100px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Animated Particles */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-slate-300/40 rounded-full"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
            }}
            animate={{
              y: [0, -40, 0],
              opacity: [0.15, 0.5, 0.15],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Logo */}
          <motion.div
            className="flex items-center justify-center mb-8"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="relative">
              <motion.div
                className="absolute -inset-3 bg-gradient-to-r from-blue-300/30 via-purple-300/30 to-emerald-300/30 rounded-3xl blur-xl"
                animate={{ opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
              <div className="relative w-20 h-20 rounded-2xl bg-white backdrop-blur-sm p-1.5 border border-slate-200 shadow-xl">
                <Image
                  src="/logo.jpeg"
                  alt="Logo"
                  width={80}
                  height={80}
                  className="rounded-xl object-cover w-full h-full"
                  priority
                />
              </div>
            </div>
          </motion.div>

          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 shadow-sm mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Shield className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-slate-600 font-medium">لوحة تحكم المدير العام</span>
          </motion.div>

          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            نظام إدارة نوادي و فنادق المدفعية
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            اختر الوحدة التي تريد الدخول إليها لإدارتها
          </p>
        </motion.div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
          {modules.map((mod, index) => (
            <motion.div
              key={mod.id}
              className="relative group"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.15 }}
            >
              {/* Glow Effect */}
              <motion.div
                className={`absolute -inset-1 rounded-3xl bg-gradient-to-b ${mod.gradient} opacity-0 group-hover:opacity-15 blur-xl transition-opacity duration-500`}
              />

              <motion.div
                className={`relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-lg cursor-pointer transition-all duration-500 group-hover:border-slate-300 group-hover:shadow-2xl ${
                  !mod.active ? 'opacity-60' : ''
                }`}
                whileHover={mod.active ? { y: -8, scale: 1.02 } : { scale: 1.01 }}
                whileTap={mod.active ? { scale: 0.98 } : {}}
                onClick={() => {
                  if (mod.active) {
                    router.push(mod.href)
                  }
                }}
              >
                {/* Image */}
                <div className="relative h-52 overflow-hidden">
                  <Image
                    src={mod.image}
                    alt={mod.title}
                    fill
                    className={`object-cover transition-transform duration-700 group-hover:scale-110 ${
                      !mod.active ? 'grayscale' : ''
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
                  <div className={`absolute inset-0 bg-gradient-to-br ${mod.gradient} opacity-10`} />

                  {/* Status Badge */}
                  {!mod.active && (
                    <motion.div
                      className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-amber-200 shadow-sm"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.15 }}
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-medium text-amber-600">قريباً</span>
                    </motion.div>
                  )}

                  {mod.active && (
                    <motion.div
                      className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/90 backdrop-blur-sm border border-emerald-200 shadow-sm"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.15 }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600">متاح</span>
                    </motion.div>
                  )}

                  {/* Icon Floating */}
                  <motion.div
                    className={`absolute bottom-4 right-4 w-14 h-14 rounded-2xl ${mod.iconBg} backdrop-blur-sm border border-white/60 shadow-lg flex items-center justify-center bg-white/80`}
                    whileHover={{ rotate: 5, scale: 1.1 }}
                  >
                    <mod.icon className={`w-7 h-7 ${mod.iconColor}`} />
                  </motion.div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                    {mod.description}
                  </p>

                  {/* Action */}
                  <div
                    className={`flex items-center justify-between ${
                      mod.active ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  >
                    <span className="text-sm font-medium">
                      {mod.active ? 'الدخول للوحدة' : 'سيتم الإطلاق قريباً'}
                    </span>
                    {mod.active && (
                      <motion.div
                        className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors"
                        animate={{ x: [0, -4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.p
          className="text-slate-400 text-sm mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          نظام إدارة نوادي وفنادق المدفعية © {new Date().getFullYear()}
        </motion.p>
      </div>
    </div>
  )
}
