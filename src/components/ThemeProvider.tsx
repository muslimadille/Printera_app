import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof NextThemesProvider>;

/** App-wide theme provider. Storage key matches FOUC script in index.html. */
export function ThemeProvider({ children, ...props }: Props) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey="printCalc_theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
