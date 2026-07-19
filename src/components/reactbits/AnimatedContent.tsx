import type { ReactNode } from 'react'

type AnimatedContentProps = {
  children: ReactNode
  className?: string
}

/** Local, copy-owned React Bits-style reveal primitive. */
export function AnimatedContent({ children, className = '' }: AnimatedContentProps) {
  return <div className={`rb-reveal ${className}`}>{children}</div>
}
