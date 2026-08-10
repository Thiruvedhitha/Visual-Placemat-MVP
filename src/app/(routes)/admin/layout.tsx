import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/getUser";
import { isPlatformAdmin } from "@/lib/auth/authorization";
import Link from "next/link";

const NAV = [
  { href: "/admin",          label: "Overview" },
  { href: "/admin/folders",  label: "Folders" },
  { href: "/admin/users",    label: "Users" },
  { href: "/admin/diagrams", label: "Diagrams" },
  { href: "/admin/audit",    label: "Audit Log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const admin = await isPlatformAdmin(user.id);
  if (!admin) redirect("/");

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-slate-200 bg-white px-3 py-6">
        <p className="mb-4 px-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Admin Portal
        </p>
        <nav className="space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  );
}
