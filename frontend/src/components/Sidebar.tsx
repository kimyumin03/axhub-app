"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

const NAV = [
  { href: "/dashboard", label: "대시보드", icon: "▦" },
  { href: "/voc", label: "VOC 데이터", icon: "≡" },
  { href: "/upload", label: "CSV 업로드", icon: "↑" },
  { href: "/reports", label: "리포트", icon: "◈" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="px-6 py-5 border-b border-gray-100">
        <h1 className="text-lg font-bold text-blue-600">VOC Analytics</h1>
        <p className="text-xs text-gray-400 mt-0.5">운영 대시보드</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-700 truncate">{user?.name}</p>
        <p className="text-xs text-gray-400 truncate mb-3">{user?.email}</p>
        <button
          onClick={handleLogout}
          className="w-full text-xs text-gray-500 hover:text-red-500 text-left transition-colors"
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}
