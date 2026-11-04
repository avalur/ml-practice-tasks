import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { isSiteAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin — ML Practice" };

/* Site admins only (ADMIN_EMAILS). Everybody else gets the same 404 as a page
 * that does not exist. Each page and every API route behind it checks again on
 * its own — a layout is not a security boundary for the routes. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isSiteAdmin())) notFound();
  return (
    <div className="admin">
      <nav className="admin-nav">
        <span className="badge medium">admin</span>
        <Link href="/admin/teachers">Teachers</Link>
        <Link href="/admin/reports">Reports</Link>
      </nav>
      {children}
    </div>
  );
}
