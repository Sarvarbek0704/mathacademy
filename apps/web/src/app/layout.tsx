import type { Metadata } from 'next';
import StyledComponentsRegistry from '@/lib/styled-registry';
import { GlobalStyles } from '@/styles/GlobalStyles';

export const metadata: Metadata = {
  title: 'Mathacademy Digital Campus',
  description: 'Academy OS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <StyledComponentsRegistry>
          <GlobalStyles />
          {children}
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
