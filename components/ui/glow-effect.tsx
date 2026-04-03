'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlowEffectProps {
  children: ReactNode
  className?: string
  color?: string
  intensity?: 'low' | 'medium' | 'high'
}

export function GlowEffect({
  children,
  className,
  color = 'blue',
  intensity = 'medium',
}: GlowEffectProps) {
  const intensityMap = {
    low: 'opacity-20 blur-xl',
    medium: 'opacity-40 blur-2xl',
    high: 'opacity-60 blur-3xl',
  }

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
    yellow: 'bg-yellow-500',
    emerald: 'bg-emerald-500',
    indigo: 'bg-indigo-500',
  }

  return (
    <div className={cn('relative', className)}>
      {children}
      <motion.div
        className={cn(
          'absolute inset-0 -z-10 rounded-full',
          colorMap[color],
          intensityMap[intensity]
        )}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  )
}








