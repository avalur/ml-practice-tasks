import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/Providers";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

// Self-hosted at build time by next/font: no request to Google from the page.
const inter = Inter({ subsets: ["latin", "cyrillic"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ML Practice",
  description: "LeetCode-style machine-learning practice — solve in the browser.",
};

// Set the theme on <html> before first paint so there's no dark/light flash.
// Stored choice wins; otherwise follow the OS preference; fall back to dark.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('mlp:theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <Providers>
          <SiteHeader />
          <main className="container">{children}</main>
          <footer className="site-footer">
            <div className="site-footer-inner">
              <span>ML Practice — machine learning, by hand.</span>
              <a href="https://avalur.github.io/mlcourse" target="_blank" rel="noopener noreferrer">
                The course
              </a>
              <Link href="/teach">Teach here</Link>
              <a
                href="https://github.com/avalur/ml-practice-tasks"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </div>
          </footer>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
