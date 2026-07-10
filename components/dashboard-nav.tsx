'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
};

const testIdMap: { [key: string]: string } = {
  overview: 'sidebar-nav-overview',
  'domain-health': 'sidebar-nav-domain-health',
  'inbox-placement': 'sidebar-nav-inbox-placement',
  recommendations: 'sidebar-nav-recommendations',
  history: 'sidebar-nav-history',
  settings: 'sidebar-nav-settings',
};

export function DashboardNav({ workspaceId, items }: { workspaceId: string; items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-2 font-sans">
      {items.map((item) => {
        const fullHref = `/${workspaceId}/${item.href}`;
        const isActive = pathname === fullHref || pathname.startsWith(fullHref + '/');
        const testId = testIdMap[item.href];

        return (
          <Link
            key={item.href}
            href={fullHref}
            data-testid={testId}
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
