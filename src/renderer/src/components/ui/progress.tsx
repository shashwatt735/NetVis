import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'

import { cn } from './utils'

function Progress({
  className,
  value,
  style,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const progressStyle: React.CSSProperties = {
    backgroundColor: 'var(--progress-track-color, var(--proto-tcp-dim))',
    ...style
  }

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('relative h-2 w-full overflow-hidden rounded-full', className)}
      style={progressStyle}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 transition-all"
        style={{
          transform: `translateX(-${100 - (value || 0)}%)`,
          // Support --progress-color custom property for protocol-specific progress bars
          backgroundColor: 'var(--progress-color, var(--primary))'
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
