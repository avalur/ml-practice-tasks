import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/components/Providers";
import { AuthStatus } from "@/components/AuthStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <Providers>
          <header className="site-header">
            <Link href="/" className="brand">
              ML&nbsp;Practice
            </Link>
            <nav className="nav-links">
              <Link href="/problems">Problems</Link>
              <Link href="/profile">Profile</Link>
            </nav>
            <div className="header-right">
              <ThemeToggle />
              <AuthStatus />
            </div>
          </header>
          <main className="container">{children}</main>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
