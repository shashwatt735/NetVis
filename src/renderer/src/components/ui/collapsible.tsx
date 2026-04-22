import * as React from 'react'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { cn } from './utils'

function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  className,
  style,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  const nvStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--nv-gap-inline)',
    padding: 'var(--nv-space-3) var(--nv-inset-inline)',
    background: 'transparent',
    border: 'none',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--nv-text-label)',
    color: 'var(--nv-text-primary)',
    cursor: 'pointer',
    outline: 'none',
    transition: 'background 0.1s',
    borderRadius: 'var(--nv-radius-md)',
    ...style
  }

  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      className={cn('nv-focus hover:bg-[var(--nv-bg-surface-2)]', className)}
      style={nvStyle}
      {...props}
    />
  )
}

function CollapsibleContent({
  className,
  style,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  // Apply animation based on Radix data-state attribute
  const animationStyle: React.CSSProperties = {
    overflow: 'hidden',
    ...style
  }

  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      className={className}
      style={animationStyle}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
