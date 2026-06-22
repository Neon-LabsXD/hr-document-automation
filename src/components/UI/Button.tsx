import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ children, className = '', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button className={`ui-button ui-button-${variant} ${className}`} type="button" {...props}>
      {children}
    </button>
  )
}

export function LinkButton({ children, className = '', variant = 'primary', ...props }: LinkButtonProps) {
  return (
    <a className={`ui-button ui-button-${variant} ${className}`} {...props}>
      {children}
    </a>
  )
}
