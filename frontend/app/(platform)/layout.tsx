import { Sidebar } from "@/components/sidebar";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full">
      <Sidebar />
      <div className="flex-1 min-w-0 pt-14 md:pt-0">{children}</div>
    </div>
  );
}
