import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cardealo Admin',
  description: 'Cardealo 관리자 웹 - 가맹점 결제 관리',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="antialiased bg-background text-text">
        {children}
      </body>
    </html>
  );
}
