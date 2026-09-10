import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant = 
  | 'clear' 
  | 'review' 
  | 'high_risk' 
  | 'info' 
  | 'neutral' 
  | 'online' 
  | 'offline' 
  | 'warning';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  dot = false,
  className,
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
    clear: {
      container: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
      dot: 'bg-emerald-600',
    },
    review: {
      container: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
      dot: 'bg-amber-600',
    },
    high_risk: {
      container: 'bg-red-50 text-red-800 border-red-200 font-semibold',
      dot: 'bg-red-600',
    },
    info: {
      container: 'bg-blue-50 text-blue-800 border-blue-200',
      dot: 'bg-blue-600',
    },
    neutral: {
      container: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-500',
    },
    online: {
      container: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dot: 'bg-emerald-600 animate-pulse',
    },
    offline: {
      container: 'bg-slate-100 text-slate-600 border-slate-300',
      dot: 'bg-slate-400',
    },
    warning: {
      container: 'bg-amber-50 text-amber-800 border-amber-200',
      dot: 'bg-amber-600',
    },
  };

  const style = variantStyles[variant];

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border tracking-wide select-none',
          style.container,
          className
        )
      )}
      {...props}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />}
      {children}
    </span>
  );
};
