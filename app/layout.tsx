import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HuitSchedule — Native Scheduling Engine',
  description: 'Book appointments powered by HuitSchedule. Zero third-party dependencies.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#060d10', fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
