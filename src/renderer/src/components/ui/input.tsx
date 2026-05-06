import * as React from 'react'

import { cn } from './utils'

function Input({ className, type, style, ...props }: React.ComponentProps<'input'>) {
  const nvStyle: React.CSSProperties = {
    height: 'var(--nv-control-height)',
    padding: '0 var(--nv-inset-inline)',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--nv-text-body)',
    color: 'var(--nv-text-primary)',
    backgroundColor: 'var(--input-background)',
    borderRadius: 'var(--nv-radius-md)',
    border: '1px solid var(--nv-border-default)',
    ...style
  }

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'nv-focus file:border-0 file:bg-transparent file:font-medium placeholder:text-[var(--nv-text-tertiary)] selection:bg-[var(--nv-accent)] selection:text-[var(--nv-text-inverse)] flex w-full min-w-0 outline-none transition-[background-color,color,border-color,box-shadow] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[var(--nv-opacity-disabled)]',
        className
      )}
      style={nvStyle}
      {...props}
    />
  )
}

export { Input }
