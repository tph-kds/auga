import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/lib/context';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ContentWrapper from '@/components/ContentWrapper';
import {
  ToastProvider,
  ToastViewport,
} from '@/components/ui/Toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Auga RLAI - Autonomous RL Agent',
  description: 'Goal-driven autonomous reinforcement learning system for game environments',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3B82F6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={inter.className}>
        <AppProvider>
          <ToastProvider>
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
              <Sidebar />
              <ContentWrapper>
                <Header />
                <main className="flex-1 overflow-y-auto p-6">
                  {children}
                </main>
              </ContentWrapper>
            </div>
            <ToastViewport />
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  );
}
