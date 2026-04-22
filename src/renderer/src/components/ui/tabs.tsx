import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from './utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function TabsList({ className, style, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const nvStyle: React.CSSProperties = {
    height: 'var(--nv-control-height)',
    borderRadius: 'var(--nv-radius-lg)',
    ...style
  }

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex w-fit items-center justify-center gap-[2px] border border-[var(--nv-border-subtle)] bg-[var(--nv-bg-surface-2)] p-[var(--nv-space-1)] text-[var(--nv-text-secondary)]',
        className
      )}
      style={nvStyle}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  style,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const nvStyle: React.CSSProperties = {
    padding: 'var(--nv-space-2) var(--nv-space-3)',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--nv-text-label)',
    borderRadius: 'var(--nv-radius-sm)',
    ...style
  }

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'nv-focus inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-[var(--nv-gap-inline)] border border-transparent font-medium whitespace-nowrap text-[var(--nv-text-secondary)] transition-[background,color,box-shadow,border-color] hover:bg-[var(--nv-bg-surface-3)] hover:text-[var(--nv-text-primary)] data-[state=active]:border-[var(--nv-border-subtle)] data-[state=active]:bg-[var(--nv-bg-surface-1)] data-[state=active]:text-[var(--nv-text-primary)] data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.12)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        className
      )}
      style={nvStyle}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('mt-[var(--nv-space-4)] flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
