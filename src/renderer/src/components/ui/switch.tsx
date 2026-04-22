import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from './utils'

function Switch({ className, style, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      style={{
        backgroundColor: props.checked ? 'var(--primary)' : 'var(--switch-background)',
        ...style
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid var(--proto-tcp)'
        e.currentTarget.style.outlineOffset = '2px'
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none'
        e.currentTarget.style.boxShadow = 'none'
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0'
        )}
        style={{
          backgroundColor: props.checked ? 'var(--primary-foreground)' : 'var(--card)'
        }}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
