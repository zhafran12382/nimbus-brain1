"use client";

import { Menu } from "lucide-react";

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
  children?: React.ReactNode;
}

export function Header({ title, onMenuClick, children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 px-4 lg:px-6 glass border-b border-[hsl(0_0%_100%_/_0.04)]">
      <button
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(0_0%_45%)] hover:text-[hsl(0_0%_93%)] hover:bg-[hsl(0_0%_10%)] transition-colors lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="text-base font-semibold text-[hsl(0_0%_93%)]">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        {children}
      </div>
    </header>
  );
}
