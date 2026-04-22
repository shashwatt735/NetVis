import * as React from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

// Electron app: detect dark mode from document class instead of next-themes
const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    return () => observer.disconnect()
  }, [])

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        style: {
          background: 'var(--nv-bg-surface-2)',
          color: 'var(--nv-text-primary)',
          border: '1px solid var(--nv-border-default)',
          boxShadow: 'var(--nv-shadow-lg)',
          fontFamily: 'var(--font-ui)',
          fontSize: '14px'
        },
        className: 'toast',
        descriptionClassName: 'toast-description'
      }}
      {...props}
    />
  )
}

export { Toaster }
