'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { Eye, EyeOff, Mail, Lock, Building2, Shield, Users, Calendar, ArrowLeft, MapPin } from 'lucide-react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'

const locations = [
  {
    name: 'فندق كينج توت',
    nameEn: 'King Tut Hotel',
    image: '/فندق كينج توت.jpg',
    description: 'فندق فاخر بأعلى معايير الجودة والراحة',
  },
  {
    name: 'قرية الندي',
    nameEn: 'Nada Village',
    image: '/nada.jpg',
    description: 'قرية سياحية متكاملة على البحر مباشرة',
  },
  {
    name: 'Rocket Beach',
    nameEn: 'Rocket Beach Resort',
    image: '/rocketbeach.jpg',
    description: 'منتجع شاطئي عصري بتصميم فريد',
  },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const router = useRouter()
  const { signIn, user, loading } = useAuth()

  // Auto-rotate slides
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % locations.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Prefetch routes on mount
  useEffect(() => {
    router.prefetch('/modules')
    router.prefetch('/dashboard')
    router.prefetch('/calendar')
  }, [router])

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace('/modules')
    }
  }, [user, loading, router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    
    if (isLoading) return

    setIsLoading(true)

    try {
      await signIn(email.trim(), password)
      
      toast({
        title: 'مرحباً بك',
        description: 'تم تسجيل الدخول بنجاح',
      })

      router.push('/modules')
    } catch (error: any) {
      setIsLoading(false)
      
      let errorMessage = 'فشل تسجيل الدخول'
      
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'يرجى تأكيد البريد الإلكتروني أولاً'
      } else if (error.message?.includes('User not found')) {
        errorMessage = 'المستخدم غير موجود'
      } else {
        errorMessage = error.message || 'فشل تسجيل الدخول'
      }
      
      toast({
        title: 'خطأ في تسجيل الدخول',
        description: errorMessage,
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-row-reverse" dir="rtl">
      {/* Left Side - Location Showcase */}
      <motion.div 
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-slate-950"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Background Images Carousel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.7 }}
            className="absolute inset-0"
          >
            <Image
              src={locations[currentSlide].image}
              alt={locations[currentSlide].name}
              fill
              className="object-cover"
              priority
            />
          </motion.div>
        </AnimatePresence>
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/50" />
        
        {/* Animated Particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.1, 0.5, 0.1],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-16 h-full">
          {/* Top - Logo & Title */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-4 mb-6">
              <motion.div 
                className="relative"
                whileHover={{ scale: 1.05, rotate: 5 }}
                animate={{ 
                  boxShadow: ['0 0 20px rgba(255,255,255,0.1)', '0 0 40px rgba(255,255,255,0.2)', '0 0 20px rgba(255,255,255,0.1)']
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="relative w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm p-1 border border-white/20 shadow-2xl">
                  <Image
                    src="/logo.jpeg"
                    alt="Logo"
                    fill
                    sizes="64px"
                    className="rounded-xl object-cover"
                    priority
                  />
                </div>
              </motion.div>
              <div>
                <h1 className="text-2xl xl:text-3xl font-bold text-white">
                  نوادي و فنادق المدفعية
                </h1>
                <p className="text-slate-400 text-sm">Military Hospitality Management</p>
              </div>
            </div>
          </motion.div>

          {/* Center - Current Location Info */}
          <div className="flex-1 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.5 }}
                className="max-w-lg"
              >
                <motion.div 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6"
                  whileHover={{ scale: 1.02 }}
                >
                  <MapPin className="h-4 w-4 text-blue-400" />
                  <span className="text-white/80 text-sm">وجهتك القادمة</span>
                </motion.div>
                
                <h2 className="text-5xl xl:text-6xl font-bold text-white mb-4 leading-tight">
                  {locations[currentSlide].name}
                </h2>
                
                <p className="text-xl text-slate-300 mb-8">
                  {locations[currentSlide].description}
                </p>

                {/* Features Icons */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Building2 className="h-5 w-5" />
                    <span className="text-sm">إقامة فاخرة</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Shield className="h-5 w-5" />
                    <span className="text-sm">خدمة مميزة</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users className="h-5 w-5" />
                    <span className="text-sm">ضيافة عسكرية</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom - Carousel Indicators & Location Previews */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {/* Location Thumbnails */}
            <div className="flex items-center gap-4 mb-6">
              {locations.map((location, index) => (
                <motion.button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`relative group overflow-hidden rounded-xl transition-all duration-300 ${
                    index === currentSlide 
                      ? 'w-24 h-16 ring-2 ring-white shadow-xl' 
                      : 'w-16 h-12 opacity-60 hover:opacity-100'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Image
                    src={location.image}
                    alt={location.name}
                    fill
                    className="object-cover"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent ${
                    index === currentSlide ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  } transition-opacity`} />
                  {index === currentSlide && (
                    <motion.div 
                      className="absolute bottom-1 left-1 right-1"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <p className="text-[10px] text-white font-medium truncate text-center">
                        {location.name}
                      </p>
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Progress Indicators */}
            <div className="flex items-center gap-2">
              {locations.map((_, index) => (
                <motion.div
                  key={index}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    index === currentSlide 
                      ? 'w-12 bg-white' 
                      : 'w-4 bg-white/30'
                  }`}
                  onClick={() => setCurrentSlide(index)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
              <span className="text-white/50 text-sm mr-4">
                {currentSlide + 1} / {locations.length}
              </span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Side - Login Form */}
      <motion.div 
        className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-12 bg-slate-950 relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#ffffff20_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>

        {/* Subtle Glow */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 6, repeat: Infinity }}
        />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo & Locations Carousel */}
          <div className="lg:hidden mb-8">
            <motion.div 
              className="flex items-center justify-center gap-3 mb-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="relative w-12 h-12 rounded-xl bg-white/10 p-1 border border-white/20">
                <Image
                  src="/logo.jpeg"
                  alt="Logo"
                  fill
                  sizes="48px"
                  className="rounded-lg object-cover"
                  priority
                />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">نوادي و فنادق المدفعية</h1>
              </div>
            </motion.div>
            
            {/* Mobile Location Thumbnails */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {locations.map((location, index) => (
                <motion.div
                  key={index}
                  className={`relative overflow-hidden rounded-lg transition-all ${
                    index === currentSlide ? 'w-20 h-14 ring-2 ring-blue-500' : 'w-14 h-10 opacity-50'
                  }`}
                  onClick={() => setCurrentSlide(index)}
                >
                  <Image src={location.image} alt={location.name} fill className="object-cover" />
                </motion.div>
              ))}
            </div>
            <p className="text-center text-slate-400 text-sm">{locations[currentSlide].name}</p>
          </div>

          {/* Login Header */}
          <motion.div 
            className="text-center lg:text-left mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              مرحباً بعودتك
            </h2>
            <p className="text-slate-400 text-lg">
              سجل دخولك للوصول إلى لوحة التحكم
            </p>
          </motion.div>

          {/* Login Form */}
          <motion.form 
            onSubmit={handleLogin} 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-300">
                البريد الإلكتروني
              </Label>
              <div className="relative group">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-14 pr-12 text-base bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 focus:ring-2 rounded-xl transition-all hover:border-slate-700"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-300">
                كلمة المرور
              </Label>
              <div className="relative group">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="h-14 pr-12 pl-12 text-base bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20 focus:ring-2 rounded-xl transition-all hover:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Button
                type="submit"
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:via-blue-400 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 relative overflow-hidden group"
                disabled={isLoading}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                />
                
                <span className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      <span>جاري تسجيل الدخول...</span>
                    </>
                  ) : (
                    <>
                      <span>تسجيل الدخول</span>
                      <ArrowLeft className="h-5 w-5" />
                    </>
                  )}
                </span>
              </Button>
            </motion.div>
          </motion.form>

          {/* Footer with Location Count */}
          <motion.div 
            className="mt-10 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Building2 className="h-4 w-4" />
                <span className="text-sm">{locations.length} مواقع</span>
              </div>
              <div className="w-px h-4 bg-slate-700" />
              <div className="flex items-center gap-1.5 text-slate-500">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">حجوزات 24/7</span>
              </div>
            </div>
            <p className="text-slate-600 text-xs">
              نظام إدارة نوادي وفنادق المدفعية © {new Date().getFullYear()}
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
