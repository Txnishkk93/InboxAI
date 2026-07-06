'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
};

export function DashboardNav({ workspaceId, items }: { workspaceId: string; items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-2 font-sans">
      {items.map((item) => {
        const fullHref = `/${workspaceId}/${item.href}`;
        const isActive = pathname === fullHref || pathname.startsWith(fullHref + '/');

        return (
          <Link
            key={item.href}
            href={fullHref}
            className={`block py-1 text-base transition-colors duration-150 ${
              isActive
                ? 'font-semibold text-ink underline underline-offset-4 decoration-border-strong'
                : 'text-ink-muted hover:text-ink hover:underline hover:underline-offset-4 decoration-border'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
