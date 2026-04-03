'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnimatedIconProps {
  icon: LucideIcon
  className?: string
  size?: number
  delay?: number
  animate?: boolean
  variant?: 'pulse' | 'bounce' | 'rotate' | 'float'
}

export function AnimatedIcon({
  icon: Icon,
  className,
  size = 24,
  delay = 0,
  animate = true,
  variant = 'float',
}: AnimatedIconProps) {
  const variants = {
    pulse: {
      scale: [1, 1.2, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        delay,
      },
    },
    bounce: {
      y: [0, -10, 0],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        delay,
      },
    },
    rotate: {
      rotate: [0, 360],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: 'linear',
        delay,
      },
    },
    float: {
      y: [0, -8, 0],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      },
    },
  }

  if (!animate) {
    return <Icon className={cn(className)} size={size} />
  }

  return (
    <motion.div
      variants={variants}
      animate={variant}
      whileHover={{ scale: 1.2, rotate: 5 }}
      whileTap={{ scale: 0.9 }}
    >
      <Icon className={cn(className)} size={size} />
    </motion.div>
  )
}








