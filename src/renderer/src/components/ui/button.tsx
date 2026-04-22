import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from './utils'

const buttonVariants = cva(
  'nv-focus inline-flex items-center justify-center whitespace-nowrap border font-medium outline-none transition-[background-color,color,border-color,box-shadow,opacity] disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
  {
    variants: {
      variant: {
        default:
          'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90',
        destructive:
          'border-[var(--destructive)] bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90',
        outline:
          'border-[var(--nv-border-default)] bg-transparent text-[var(--nv-text-primary)] hover:bg-[var(--nv-bg-surface-2)]',
        secondary:
          'border-[var(--nv-border-subtle)] bg-[var(--nv-bg-surface-2)] text-[var(--nv-text-primary)] hover:bg-[var(--nv-bg-surface-3)]',
        ghost:
          'border-transparent bg-transparent text-[var(--nv-text-secondary)] hover:bg-[var(--nv-bg-surface-2)] hover:text-[var(--nv-text-primary)]',
        link: 'border-transparent bg-transparent text-[var(--primary)] underline-offset-4 hover:underline'
      },
      size: {
        default: '',
        sm: '',
        lg: '',
        icon: 'justify-center'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

const buttonSizeStyles = {
  default: {
    height: 'var(--nv-control-height)',
    padding: '0 var(--nv-inset-inline)',
    gap: 'var(--nv-gap-inline)'
  },
  sm: {
    height: 'calc(var(--nv-control-height) - 6px)',
    padding: '0 var(--nv-space-3)',
    gap: 'var(--nv-space-2)'
  },
  lg: {
    height: 'calc(var(--nv-control-height) + 8px)',
    padding: '0 var(--nv-space-5)',
    gap: 'var(--nv-gap-inline)'
  },
  icon: {
    height: 'var(--nv-control-height)',
    width: 'var(--nv-control-height)',
    padding: 0,
    gap: 0
  }
} satisfies Record<NonNullable<VariantProps<typeof buttonVariants>['size']>, React.CSSProperties>

function Button({
  className,
  variant,
  size = 'default',
  asChild = false,
  style,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'
  const resolvedSize = size ?? 'default'

  const nvStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--nv-text-label)',
    fontWeight: 500,
    borderRadius: 'var(--nv-radius-md)',
    opacity: props.disabled ? 'var(--nv-opacity-disabled)' : undefined,
    ...buttonSizeStyles[resolvedSize],
    ...style
  }

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size: resolvedSize, className }))}
      style={nvStyle}
      {...props}
    />
  )
}

export { Button, buttonVariants }
