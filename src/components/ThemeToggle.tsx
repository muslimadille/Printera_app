import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light', label: 'فاتح', icon: Sun },
  { value: 'dark', label: 'داكن', icon: Moon },
  { value: 'system', label: 'تلقائي', icon: Monitor },
] as const;

type ThemeToggleProps = {
  className?: string;
  /** Wider ghost button for mobile sheets */
  fullWidth?: boolean;
};

export function ThemeToggle({ className, fullWidth }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const active = mounted ? theme ?? 'light' : 'light';
  const ResolvedIcon = mounted && resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={fullWidth ? 'default' : 'icon'}
          className={cn(
            'transition-colors duration-200',
            fullWidth ? 'w-full justify-start gap-3 h-11' : 'h-9 w-9',
            className,
          )}
          aria-label="تبديل المظهر"
        >
          <ResolvedIcon className="h-4 w-4" />
          {fullWidth && <span>المظهر</span>}
          <span className="sr-only">تبديل المظهر</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              'gap-2 cursor-pointer transition-colors duration-150',
              active === value && 'bg-accent/15 text-foreground font-semibold',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
