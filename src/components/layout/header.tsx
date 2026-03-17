"use client";

import { Menu, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
  children?: React.ReactNode;
}

export function Header({ title, onMenuClick, children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 px-4 lg:px-6 glass border-b border-[hsl(0_0%_100%_/_0.04)]">
      {/* Back to Chat button — always visible on sub-pages */}
      <Link
        href="/chat"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(0_0%_45%)] hover:text-[hsl(0_0%_93%)] hover:bg-[hsl(0_0%_10%)] transition-colors"
        title="Kembali ke Chat"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>

      <h1 className="text-base font-semibold text-[hsl(0_0%_93%)]">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        {children}
      </div>
    </header>
  );
}
