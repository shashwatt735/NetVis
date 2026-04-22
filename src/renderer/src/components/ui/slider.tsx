import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'

import { cn } from './utils'

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  style,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className
      )}
      style={style}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          'relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-4 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5'
        )}
        style={{
          backgroundColor: 'var(--nv-bg-surface-3)'
        }}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            'absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full'
          )}
          style={{
            backgroundColor: 'var(--primary)'
          }}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          style={{
            borderColor: 'var(--primary)',
            backgroundColor: 'var(--nv-bg-surface-1)'
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'var(--nv-shadow-sm)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5)'
          }}
          onMouseLeave={(e) => {
            if (document.activeElement !== e.currentTarget) {
              e.currentTarget.style.boxShadow = 'var(--nv-shadow-sm)'
            }
          }}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
