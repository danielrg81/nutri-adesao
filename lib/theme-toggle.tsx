'use client';

import { useDarkMode } from './use-dark-mode';

export function ThemeToggle() {
  const { theme, resolvedTheme, toggleTheme } = useDarkMode();

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'system':
      default:
        return '💻';
    }
  };

  const getTooltip = () => {
    switch (theme) {
      case 'light':
        return 'Modo Claro (próximo: Escuro)';
      case 'dark':
        return 'Modo Escuro (próximo: Sistema)';
      case 'system':
      default:
        return 'Modo Sistema (próximo: Claro)';
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="
        w-10 h-10 rounded-xl
        bg-slate-100 hover:bg-slate-200 
        dark:bg-slate-800 dark:hover:bg-slate-700
        text-slate-600 dark:text-slate-300
        transition-all duration-200
        flex items-center justify-center
        border border-slate-200 dark:border-slate-700
        hover:scale-105 active:scale-95
      "
      title={getTooltip()}
      aria-label="Alternar tema"
    >
      <span className="text-lg">{getIcon()}</span>
    </button>
  );
}

// Componente simples só com light/dark (sem system)
export function SimpleThemeToggle() {
  const { resolvedTheme, setTheme } = useDarkMode();

  const toggle = () => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      className="
        w-10 h-10 rounded-xl
        bg-slate-100 hover:bg-slate-200 
        dark:bg-slate-800 dark:hover:bg-slate-700
        text-slate-600 dark:text-slate-300
        transition-all duration-200
        flex items-center justify-center
        border border-slate-200 dark:border-slate-700
        hover:scale-105 active:scale-95
      "
      title={resolvedTheme === 'light' ? 'Alternar para modo escuro' : 'Alternar para modo claro'}
      aria-label="Alternar tema"
    >
      <span className="text-lg">
        {resolvedTheme === 'light' ? '🌙' : '☀️'}
      </span>
    </button>
  );
}