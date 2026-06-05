import type { Metadata } from "next";
import Link from "next/link";
import { Providers } from "@/components/Providers";
import { AuthStatus } from "@/components/AuthStatus";
import "./globals.css";

export const metadata: Metadata = {
  title: "ML Practice",
  description: "LeetCode-style machine-learning practice — solve in the browser.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="site-header">
            <Link href="/" className="brand">
              ML&nbsp;Practice
            </Link>
            <nav>
              <Link href="/problems">Problems</Link>
            </nav>
            <div className="header-right">
              <AuthStatus />
            </div>
          </header>
          <main className="container">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
