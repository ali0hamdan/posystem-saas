import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SaasSidebar } from '@/saas/layout/SaasSidebar';
import { SaasTopbar } from '@/saas/layout/SaasTopbar';

const COLLAPSE_KEY = 'saas-sidebar-collapsed';

export function SaasLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="saas-theme flex h-screen overflow-hidden bg-canvas text-ink">
      <SaasSidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <SaasTopbar />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

