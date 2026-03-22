import React from 'react'
import { cn, getInitials, generateColor } from '../../utils'

// ─── Button ───────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...props
}) => {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-150 select-none'
  const variants = {
    primary: 'bg-ink text-snow hover:bg-[#333] active:scale-[0.98]',
    secondary: 'bg-silver text-ink hover:bg-[#ccc] active:scale-[0.98]',
    ghost: 'bg-transparent text-ink hover:bg-silver active:scale-[0.98]',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]',
  }
  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 h-7',
    md: 'text-sm px-3.5 py-2 h-9',
    lg: 'text-sm px-5 py-2.5 h-10',
  }
  return (
    <button
      className={cn(base, variants[variant], sizes[size], (disabled || loading) && 'opacity-50 cursor-not-allowed', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[#666]">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]">{icon}</span>}
        <input
          ref={ref}
          className={cn(
            'w-full h-9 px-3 bg-white border border-silver rounded-lg text-sm text-ink',
            'placeholder:text-[#bbb] transition-all duration-150',
            'focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/20',
            icon && 'pl-9',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-200',
            className
          )}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
)
Input.displayName = 'Input'

// ─── Textarea ────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[#666]">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-2 bg-white border border-silver rounded-lg text-sm text-ink resize-none',
          'placeholder:text-[#bbb] transition-all duration-150',
          'focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/20',
          error && 'border-red-400',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
)
Textarea.displayName = 'Textarea'

// ─── Select ───────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, children, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[#666]">{label}</label>}
      <select
        ref={ref}
        className={cn(
          'w-full h-9 px-3 bg-white border border-silver rounded-lg text-sm text-ink appearance-none',
          'focus:outline-none focus:border-violet focus:ring-2 focus:ring-violet/20',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
)
Select.displayName = 'Select'

// ─── Modal ────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  footer?: React.ReactNode
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = 'md', footer }) => {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl', full: 'max-w-5xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative bg-white rounded-2xl shadow-modal w-full animate-scale-in', sizes[size])}>
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-silver">
            <h3 className="text-base font-semibold">{title}</h3>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-silver transition-colors text-[#999] text-lg leading-none">×</button>
          </div>
        )}
        <div className={cn('px-5 py-4', !title && 'pt-5')}>{children}</div>
        {footer && <div className="px-5 pb-5">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', className }) => {
  const sizes = { xs: 'w-5 h-5 text-[9px]', sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' }
  const bg = generateColor(name)

  return src ? (
    <img src={src} alt={name} className={cn('rounded-full object-cover flex-shrink-0', sizes[size], className)} />
  ) : (
    <div
      className={cn('rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0', sizes[size], className)}
      style={{ backgroundColor: bg }}
    >
      {getInitials(name)}
    </div>
  )
}

// ─── AvatarGroup ──────────────────────────────────────────────────────────

export const AvatarGroup: React.FC<{ members: { username: string; avatar_url?: string | null }[]; max?: number }> = ({
  members, max = 3
}) => {
  const visible = members.slice(0, max)
  const rest = members.length - max
  return (
    <div className="flex -space-x-2">
      {visible.map((m, i) => (
        <Avatar key={i} name={m.username} src={m.avatar_url} size="xs" className="ring-2 ring-white" />
      ))}
      {rest > 0 && (
        <div className="w-5 h-5 rounded-full bg-silver flex items-center justify-center text-[9px] font-semibold ring-2 ring-white">
          +{rest}
        </div>
      )}
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode
  color?: string
  bg?: string
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({ children, color, bg, className }) => (
  <span
    className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium', className)}
    style={{ color: color || '#666', backgroundColor: bg || '#F3F4F6' }}
  >
    {children}
  </span>
)

// ─── Spinner ──────────────────────────────────────────────────────────────

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 18, className }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={cn('animate-spin', className)}
    stroke="currentColor" strokeWidth={2.5}
  >
    <circle cx={12} cy={12} r={9} strokeOpacity={0.2} />
    <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round" />
  </svg>
)

// ─── Empty State ──────────────────────────────────────────────────────────

export const EmptyState: React.FC<{ icon?: string; title: string; description?: string; action?: React.ReactNode }> = ({
  icon, title, description, action
}) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {icon && <div className="text-4xl mb-3">{icon}</div>}
    <p className="font-semibold text-[#444] text-sm">{title}</p>
    {description && <p className="text-xs text-[#999] mt-1 max-w-xs">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)

// ─── Card ────────────────────────────────────────────────────────────────

export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({
  children, className, onClick
}) => (
  <div
    className={cn(
      'bg-white rounded-2xl border border-silver shadow-card',
      onClick && 'cursor-pointer hover:shadow-card-hover transition-shadow',
      className
    )}
    onClick={onClick}
  >
    {children}
  </div>
)

// ─── Tabs ─────────────────────────────────────────────────────────────────

interface TabsProps {
  tabs: { key: string; label: string; icon?: string }[]
  active: string
  onChange: (key: string) => void
  className?: string
}

export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange, className }) => (
  <div className={cn('flex gap-0.5 bg-silver/50 p-1 rounded-xl', className)}>
    {tabs.map((t) => (
      <button
        key={t.key}
        onClick={() => onChange(t.key)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
          active === t.key ? 'bg-white text-ink shadow-card' : 'text-[#888] hover:text-ink'
        )}
      >
        {t.icon && <span>{t.icon}</span>}
        {t.label}
      </button>
    ))}
  </div>
)

// ─── Toggle ───────────────────────────────────────────────────────────────

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label?: string }> = ({
  checked, onChange, label
}) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <div
      onClick={() => onChange(!checked)}
      className={cn(
        'w-8 h-5 rounded-full transition-colors duration-200 relative',
        checked ? 'bg-violet' : 'bg-silver'
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200',
        checked ? 'translate-x-3.5' : 'translate-x-0.5'
      )} />
    </div>
    {label && <span className="text-sm">{label}</span>}
  </label>
)

// ─── Dropdown Menu ────────────────────────────────────────────────────────

interface DropdownItem {
  label: string
  icon?: string
  onClick: () => void
  danger?: boolean
  divider?: boolean
}

interface DropdownProps {
  trigger: React.ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, align = 'right' }) => {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className={cn(
          'absolute top-full mt-1.5 z-50 bg-white border border-silver rounded-xl shadow-modal py-1 min-w-[160px] animate-scale-in',
          align === 'right' ? 'right-0' : 'left-0'
        )}>
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {item.divider && <div className="my-1 border-t border-silver" />}
              <button
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-snow transition-colors',
                  item.danger && 'text-red-500 hover:bg-red-50'
                )}
                onClick={() => { item.onClick(); setOpen(false) }}
              >
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
