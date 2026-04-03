'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Calendar,
  Users,
  Home,
  FileText,
  BarChart3,
  Settings,
  Utensils,
  Package,
  DollarSign,
  Wrench,
  Mail,
  Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AnimatedIcon } from '@/components/ui/animated-icon'
import { GlowEffect } from '@/components/ui/glow-effect'

const shortcuts = [
  {
    title: 'حجز جديد',
    icon: Plus,
    href: '/reservations/new',
    color: 'bg-blue-500 hover:bg-blue-600',
    description: 'إنشاء حجز جديد',
  },
  {
    title: 'التقويم',
    icon: Calendar,
    href: '/calendar',
    color: 'bg-green-500 hover:bg-green-600',
    description: 'عرض التقويم الكامل',
  },
  {
    title: 'الحجوزات',
    icon: FileText,
    href: '/reservations',
    color: 'bg-purple-500 hover:bg-purple-600',
    description: 'إدارة الحجوزات',
  },
  {
    title: 'الضيوف',
    icon: Users,
    href: '/guests',
    color: 'bg-pink-500 hover:bg-pink-600',
    description: 'إدارة الضيوف',
  },
  {
    title: 'الوحدات',
    icon: Home,
    href: '/units',
    color: 'bg-orange-500 hover:bg-orange-600',
    description: 'إدارة الوحدات',
  },
  {
    title: 'التقارير',
    icon: BarChart3,
    href: '/reports',
    color: 'bg-indigo-500 hover:bg-indigo-600',
    description: 'عرض التقارير',
  },
  {
    title: 'الخدمات',
    icon: Utensils,
    href: '/services',
    color: 'bg-teal-500 hover:bg-teal-600',
    description: 'إدارة الخدمات',
  },
  {
    title: 'المخزون',
    icon: Package,
    href: '/inventory',
    color: 'bg-cyan-500 hover:bg-cyan-600',
    description: 'إدارة المخزون',
  },
  {
    title: 'المالية',
    icon: DollarSign,
    href: '/financial/reconciliation',
    color: 'bg-emerald-500 hover:bg-emerald-600',
    description: 'المصالحة المالية',
  },
  {
    title: 'الصيانة',
    icon: Wrench,
    href: '/maintenance',
    color: 'bg-red-500 hover:bg-red-600',
    description: 'إدارة الصيانة',
  },
  {
    title: 'البريد',
    icon: Mail,
    href: '/email-templates',
    color: 'bg-yellow-500 hover:bg-yellow-600',
    description: 'قوالب البريد',
  },
  {
    title: 'الإعدادات',
    icon: Settings,
    href: '/settings',
    color: 'bg-gray-500 hover:bg-gray-600',
    description: 'إعدادات النظام',
  },
]

export function DashboardShortcuts() {
  const router = useRouter()

  return (
    <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:30px_30px]" />
      </div>
      
      {/* Floating Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-primary/20 rounded-full"
          style={{
            left: `${20 + i * 15}%`,
            top: `${10 + i * 20}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.sin(i) * 20, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 4 + i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.3,
          }}
        />
      ))}

      <CardHeader className="relative z-10 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <Sparkles className="h-6 w-6 text-primary" />
          </motion.div>
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-primary via-purple-600 to-primary bg-clip-text text-transparent">
            الاختصارات السريعة
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 pt-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence>
            {shortcuts.map((shortcut, index) => {
              const Icon = shortcut.icon
              return (
                <motion.div
                  key={shortcut.href}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{
                    delay: index * 0.05,
                    type: 'spring',
                    stiffness: 100,
                    damping: 15,
                  }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative group"
                >
                  <GlowEffect color={shortcut.color.split('-')[1] || 'blue'} intensity="low">
                    <Button
                      variant="outline"
                      className="w-full h-auto p-5 flex flex-col items-center gap-3 hover:shadow-2xl transition-all duration-300 border-2 hover:border-primary/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm relative overflow-hidden group-hover:bg-gradient-to-br group-hover:from-primary/5 group-hover:to-purple-500/5"
                      onClick={() => router.push(shortcut.href)}
                    >
                      {/* Shine Effect */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{
                          x: ['-100%', '100%'],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'linear',
                          repeatDelay: 3,
                        }}
                      />

                      {/* Icon Container */}
                      <motion.div
                        className={`${shortcut.color} p-4 rounded-2xl text-white shadow-lg relative z-10`}
                        whileHover={{
                          rotate: [0, -10, 10, -10, 0],
                          scale: 1.1,
                        }}
                        transition={{ duration: 0.5 }}
                      >
                        <motion.div
                          animate={{
                            y: [0, -5, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: index * 0.1,
                          }}
                        >
                          <Icon className="h-7 w-7" />
                        </motion.div>
                        
                        {/* Pulse Effect */}
                        <motion.div
                          className={`absolute inset-0 ${shortcut.color} rounded-2xl`}
                          animate={{
                            scale: [1, 1.3, 1],
                            opacity: [0.5, 0, 0.5],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: index * 0.2,
                          }}
                        />
                      </motion.div>

                      {/* Text Content */}
                      <div className="text-center relative z-10">
                        <motion.div
                          className="font-bold text-sm"
                          whileHover={{ scale: 1.05 }}
                        >
                          {shortcut.title}
                        </motion.div>
                        <motion.div
                          className="text-xs text-muted-foreground mt-1"
                          initial={{ opacity: 0.7 }}
                          whileHover={{ opacity: 1 }}
                        >
                          {shortcut.description}
                        </motion.div>
                      </div>

                      {/* Hover Indicator */}
                      <motion.div
                        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-purple-500"
                        initial={{ scaleX: 0 }}
                        whileHover={{ scaleX: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                    </Button>
                  </GlowEffect>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}

