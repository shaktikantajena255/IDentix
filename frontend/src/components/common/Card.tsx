import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// We use `cardTitle` to avoid conflicting with the native HTML `title` attribute on <div>
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  cardTitle?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
}

export const Card: React.FC<CardProps> = ({
  cardTitle,
  subtitle,
  action,
  footer,
  children,
  className,
  headerClassName,
  bodyClassName,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden',
          className
        )
      )}
      {...props}
    >
      {(cardTitle || subtitle || action) && (
        <div
          className={twMerge(
            clsx(
              'px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4',
              headerClassName
            )
          )}
        >
          <div>
            {cardTitle && (
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                {cardTitle}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      <div className={twMerge(clsx('p-6', bodyClassName))}>
        {children}
      </div>

      {footer && (
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          {footer}
        </div>
      )}
    </div>
  );
};
