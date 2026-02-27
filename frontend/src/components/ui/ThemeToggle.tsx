import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

type ThemeToggleProps = {
  className?: string
  size?: 'sm' | 'md'
}

export function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const { mode, toggle } = useTheme()
  const isDark = mode === 'dark'
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ||
        `inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors touch-manipulation ${size === 'sm' ? 'min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:h-8 md:w-8' : 'min-h-[44px] min-w-[44px] md:h-9 md:w-9 md:min-h-0 md:min-w-0'}`
      }
      title={isDark ? 'Usar tema claro' : 'Usar tema oscuro'}
      aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
    >
      {isDark ? (
        <Sun className={iconClass} />
      ) : (
        <Moon className={iconClass} />
      )}
    </button>
  )
}
