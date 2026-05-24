import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export function PaymentCancelledPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          <div className="flex justify-center mb-4">
            <XCircle className="h-16 w-16 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Payment Cancelled
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            No charges were made. You can choose a plan and try again whenever you're ready.
          </p>
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Back to Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
