import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar, readInitialSidebarCollapsed } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Topbar } from '@/components/layout/Topbar';
import { RoutePermissionGate } from '@/components/auth/RoutePermissionGate';
import { OfflineBootstrap } from '@/components/offline/OfflineBootstrap';
import { LicenseShell } from '@/components/license/LicenseShell';
import { ElectronUpdaterProvider } from '@/components/electron/ElectronUpdaterProvider';
import { ElectronUpdateBanner } from '@/components/electron/ElectronUpdateBanner';
import { DesktopEntitlementBanner } from '@/components/electron/DesktopEntitlementBanner';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readInitialSidebarCollapsed);

  return (
    <div className="flex min-h-screen bg-canvas">
      <div
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex',
          collapsed ? 'lg:w-[68px]' : 'lg:w-60',
        )}
      >
        <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
      </div>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative flex h-full w-64 max-w-[85vw] shadow-soft">
            <Sidebar
              collapsed={false}
              onCollapsedChange={() => {}}
              onNavigate={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className={cn('flex min-h-screen flex-1 flex-col', collapsed ? 'lg:pl-[68px]' : 'lg:pl-60')}>
        <MobileHeader onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="hidden lg:block">
          <Topbar onToggleSidebar={() => setCollapsed((c) => !c)} sidebarCollapsed={collapsed} />
        </div>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <OfflineBootstrap />
          <div className="mx-auto max-w-[1600px]">
            <ElectronUpdaterProvider>
              <LicenseShell />
              <DesktopEntitlementBanner />
              <ElectronUpdateBanner />
              <RoutePermissionGate>
                <Outlet />
              </RoutePermissionGate>
            </ElectronUpdaterProvider>
          </div>
        </main>
      </div>
    </div>
  );
}
