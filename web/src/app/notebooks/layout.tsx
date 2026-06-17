import manifest from "../../../../notebooks/manifest.json";
import { NotebooksSidebar } from "@/components/NotebooksSidebar";

export default function NotebookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="notebooks-shell">
      <NotebooksSidebar sections={manifest.sections} />
      <main className="notebooks-main">{children}</main>
    </div>
  );
}
