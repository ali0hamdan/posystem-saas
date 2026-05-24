import { Link } from 'react-router-dom';
import { Download, Monitor, Wifi, Shield, Zap, ArrowRight } from 'lucide-react';
import { usePlanFeature } from '@/hooks/use-plan-features';

const STEPS = [
  { step: '1', label: 'Download the installer', detail: 'Click the button below to download the latest POS Desktop installer for Windows.' },
  { step: '2', label: 'Install the application', detail: 'Run the installer and follow the on-screen instructions. No admin rights required.' },
  { step: '3', label: 'Activate your license', detail: 'Open the app and enter your activation code received after purchase.' },
  { step: '4', label: 'Start selling offline', detail: 'Your POS syncs when online and works seamlessly when the internet drops.' },
];

const FEATURES = [
  { icon: Wifi, title: 'Works offline', desc: 'Sales, inventory, and reports function without internet. Data syncs when you reconnect.' },
  { icon: Shield, title: 'Secure & local', desc: 'Your data is stored locally with encrypted backups. You stay in control.' },
  { icon: Zap, title: 'Lightning fast', desc: 'Native performance means instant loading, no lag, no browser overhead.' },
  { icon: Monitor, title: 'Windows native', desc: 'Built specifically for Windows desktops and touchscreen POS terminals.' },
];

function AccessDenied() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <Monitor className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600 mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Desktop app not included in your plan
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          The offline desktop application is available on the <strong>PRO</strong>, <strong>Enterprise</strong>, and <strong>Lifetime Desktop</strong> plans.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            View plans
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/billing"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            My billing
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DownloadPage() {
  const canDownload = usePlanFeature('offline_mode');

  if (!canDownload) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-16 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-6">
            <Monitor className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">
            POS Desktop App
          </h1>
          <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Download the native Windows application for offline-capable point of sale. Works without internet and syncs automatically when you reconnect.
          </p>
        </div>

        {/* Download card */}
        <div className="rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 p-8 mb-10 text-center shadow-lg shadow-blue-50 dark:shadow-none">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Latest version</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">POS Desktop</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">Windows 10 / 11 · 64-bit</p>

          <a
            href="/downloads/pos-desktop-setup.exe"
            className="inline-flex items-center gap-3 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-md hover:shadow-blue-300 dark:hover:shadow-blue-900/40"
          >
            <Download className="h-5 w-5" />
            Download for Windows
          </a>

          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            By downloading, you agree to the{' '}
            <Link to="/terms" className="underline hover:text-gray-600 dark:hover:text-gray-300">
              Terms of Service
            </Link>
            .
          </p>
        </div>

        {/* Features */}
        <div className="grid gap-4 sm:grid-cols-2 mb-12">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <div className="mt-0.5 shrink-0">
                <Icon className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{title}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Getting started in 4 steps
          </h2>
          <div className="space-y-4">
            {STEPS.map(({ step, label, detail }) => (
              <div key={step} className="flex gap-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{label}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activate link */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Already installed?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Go to the activation page to enter your activation code and unlock the app.
          </p>
          <Link
            to="/activate"
            className="inline-flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-700 px-6 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Activate my license
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
