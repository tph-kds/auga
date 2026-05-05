import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/lib/context';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ContentWrapper from '@/components/ContentWrapper';
import NotificationToaster from '@/components/NotificationToaster';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Auga RLAI — Autonomous RL Agent System',
  description:
    'Goal-driven autonomous reinforcement learning platform. Train, evaluate, and deploy RL agents from natural language objectives with real-time game simulation.',
  keywords: ['reinforcement learning', 'AI agent', 'autonomous', 'Angry Birds', 'RL training'],
  openGraph: {
    title: 'Auga RLAI',
    description: 'Autonomous Reinforcement Learning Agent System',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <meta name="theme-color" content="#F97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <AppProvider>
          <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#0a0e1a]">
            <Sidebar />
            <ContentWrapper>
              <Header />
              <main className="flex-1 overflow-y-auto p-6 pt-20 scrollbar-thin">
                {children}
              </main>
            </ContentWrapper>
          </div>
          <NotificationToaster />
        </AppProvider>
      </body>
    </html>
  );
}
