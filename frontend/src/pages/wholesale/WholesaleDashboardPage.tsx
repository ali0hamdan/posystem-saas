import { useQuery } from '@tanstack/react-query';

import { Link } from 'react-router-dom';

import {

  ArrowRight, DollarSign, FileText, FileSpreadsheet, FileCheck, Users, Warehouse, Truck,

  AlertCircle, Package, ShoppingCart, LineChart, Receipt,

} from 'lucide-react';

import { fetchWholesaleDashboard } from '@/api/wholesale-reports.api';

import { getApiErrorMessage } from '@/api/client';

import { useStoreSettings } from '@/hooks/use-store-settings';

import { PageHeader } from '@/components/ui/page-header';

import { Skeleton } from '@/components/ui/skeleton';

import { ErrorBanner } from '@/components/ui/error-banner';

import { StatCard } from '@/components/ui/stat-card';

import { Badge } from '@/components/ui/badge';



export function WholesaleDashboardPage() {

  const { formatMoney: fmt } = useStoreSettings();

  const q = useQuery({ queryKey: ['wholesale', 'dashboard'], queryFn: fetchWholesaleDashboard, refetchInterval: 30_000 });

  const d = q.data;



  return (

    <div className="space-y-8 pb-8">

      <PageHeader

        title="Wholesale Dashboard"

        description="Full operations at a glance — retail core metrics plus B2B pipeline."

      />



      {q.isError && <ErrorBanner message={getApiErrorMessage(q.error, 'Failed to load dashboard')} />}



      {q.isPending ? (

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}

        </div>

      ) : d ? (

        <>

          <p className="text-xs text-ink-muted">{d.note}</p>



          <section>

            <h2 className="mb-3 font-display text-lg font-semibold text-ink">Today</h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <StatCard icon={DollarSign} title="Today sales" value={fmt(Number(d.operational.todaySales))} />

              <StatCard icon={LineChart} title="Today profit" value={fmt(Number(d.operational.todayProfit))} />

              <StatCard icon={Receipt} title="Invoices today" value={String(d.operational.todayOrdersCount)} />

              <StatCard icon={Warehouse} title="Stock movements" value={String(d.operational.stockMovementsToday)} subtitle="Today" />

            </div>

          </section>



          <section>

            <h2 className="mb-3 font-display text-lg font-semibold text-ink">Inventory &amp; operations</h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <StatCard icon={AlertCircle} title="Low stock" value={String(d.operational.lowStockCount)} />

              <StatCard icon={Package} title="Products" value={String(d.operational.totalProducts)} />

              <StatCard icon={Users} title="Customers" value={String(d.operational.totalCustomers)} />

              <StatCard icon={ShoppingCart} title="POs pending" value={String(d.operational.purchaseOrdersPending)} />

            </div>

          </section>



          <section>

            <h2 className="mb-3 font-display text-lg font-semibold text-ink">B2B pipeline</h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

              <StatCard icon={FileText} title="Pending quotations" value={String(d.cards.pendingQuotations)} />

              <StatCard icon={FileCheck} title="Accepted quotations" value={String(d.cards.acceptedQuotations)} />

              <StatCard icon={FileSpreadsheet} title="Proforma pending" value={String(d.cards.proformaInvoicesPending)} />

              <StatCard icon={FileCheck} title="Unpaid invoices" value={String(d.cards.officialInvoicesUnpaid)} subtitle={fmt(Number(d.cards.officialInvoicesUnpaidValue))} />

              <StatCard icon={Users} title="Customer debt" value={fmt(Number(d.cards.customerOutstandingDebt))} subtitle={`${d.cards.customersWithDebt} accounts`} />

              <StatCard icon={Warehouse} title="Stock reserved" value={String(d.cards.stockReservedUnits)} subtitle={`${d.cards.stockReservedLines} lines`} />

              <StatCard icon={Truck} title="Deliveries pending" value={String(d.cards.deliveriesPending)} />

              <StatCard icon={AlertCircle} title="Overdue invoices" value={String(d.cards.overdueInvoices)} subtitle="30+ days unpaid" />

              <StatCard icon={FileText} title="Quoted value" value={fmt(Number(d.cards.totalQuotedValue))} subtitle="Not revenue" />

            </div>

          </section>



          <div className="grid gap-4 lg:grid-cols-2">

            <section className="rounded-xl border border-line bg-surface p-5 shadow-card">

              <h3 className="mb-3 text-sm font-semibold text-ink">Recent official invoices</h3>

              {d.recentInvoices.length === 0 ? (

                <p className="text-sm text-ink-muted">No invoices yet.</p>

              ) : (

                <ul className="space-y-2">

                  {d.recentInvoices.map((inv) => (

                    <li key={inv.id} className="flex items-center justify-between text-sm">

                      <span className="text-ink">{inv.invoiceNumber} · {inv.customerName ?? 'Walk-in'}</span>

                      <span className="flex items-center gap-2">

                        <Badge variant={inv.paymentStatus === 'PAID' ? 'success' : 'warning'}>{inv.paymentStatus}</Badge>

                        <span className="text-ink-muted">{fmt(Number(inv.total))}</span>

                      </span>

                    </li>

                  ))}

                </ul>

              )}

            </section>



            <section className="rounded-xl border border-line bg-surface p-5 shadow-card">

              <h3 className="mb-3 text-sm font-semibold text-ink">Recent quotations</h3>

              {d.recentQuotations.length === 0 ? (

                <p className="text-sm text-ink-muted">No quotations yet.</p>

              ) : (

                <ul className="space-y-2">

                  {d.recentQuotations.map((row) => (

                    <li key={row.id} className="flex items-center justify-between text-sm">

                      <span className="text-ink">{row.quotationNumber} · {row.customerName ?? 'Walk-in'}</span>

                      <span className="text-ink-muted">{fmt(Number(row.total))}</span>

                    </li>

                  ))}

                </ul>

              )}

            </section>



            <section className="rounded-xl border border-line bg-surface p-5 shadow-card">

              <h3 className="mb-3 text-sm font-semibold text-ink">Recent proforma invoices</h3>

              {d.recentProformas.length === 0 ? (

                <p className="text-sm text-ink-muted">No proforma invoices yet.</p>

              ) : (

                <ul className="space-y-2">

                  {d.recentProformas.map((row) => (

                    <li key={row.id} className="flex items-center justify-between text-sm">

                      <span className="text-ink">{row.proformaNumber} · {row.customerName ?? 'Walk-in'}</span>

                      <span className="text-ink-muted">{fmt(Number(row.total))}</span>

                    </li>

                  ))}

                </ul>

              )}

            </section>



            <section className="rounded-xl border border-line bg-surface p-5 shadow-card">

              <h3 className="mb-3 text-sm font-semibold text-ink">Low stock products</h3>

              {d.lowStockProducts.length === 0 ? (

                <p className="text-sm text-ink-muted">All products above minimum stock.</p>

              ) : (

                <ul className="space-y-2">

                  {d.lowStockProducts.map((p) => (

                    <li key={p.productId} className="flex items-center justify-between text-sm">

                      <span className="text-ink">{p.name}</span>

                      <span className="text-warning-700">{p.quantity} / min {p.minStock}</span>

                    </li>

                  ))}

                </ul>

              )}

            </section>

          </div>



          {d.topCustomersByBalance.length > 0 && (

            <section className="rounded-xl border border-line bg-surface p-5 shadow-card">

              <h3 className="mb-3 text-sm font-semibold text-ink">Top customers by balance owed</h3>

              <ul className="space-y-2">

                {d.topCustomersByBalance.map((c) => (

                  <li key={c.customerId} className="flex items-center justify-between text-sm">

                    <Link to={`/wholesale/customers/${c.customerId}`} className="text-primary-600 hover:underline">{c.customerName}</Link>

                    <span className="font-semibold text-warning-700">{fmt(Number(c.balance))}</span>

                  </li>

                ))}

              </ul>

            </section>

          )}



          {d.recentStockMovements.length > 0 && (

            <section className="rounded-xl border border-line bg-surface p-5 shadow-card">

              <h3 className="mb-3 text-sm font-semibold text-ink">Recent stock movements</h3>

              <ul className="space-y-2">

                {d.recentStockMovements.map((m) => (

                  <li key={m.id} className="flex items-center justify-between text-sm">

                    <span className="text-ink">{m.productName} · {m.type}</span>

                    <span className="text-ink-muted">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>

                  </li>

                ))}

              </ul>

            </section>

          )}



          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            {[

              { to: '/wholesale/invoices/new', label: 'New invoice', icon: FileCheck },

              { to: '/wholesale/quotations', label: 'Quotations', icon: FileText },

              { to: '/wholesale/proforma-invoices', label: 'Proforma', icon: FileSpreadsheet },

              { to: '/wholesale/products', label: 'Products', icon: Package },

            ].map((l) => (

              <Link key={l.to} to={l.to} className="group flex items-center justify-between rounded-xl border border-line bg-surface p-4 transition hover:border-primary-300">

                <span className="flex items-center gap-2 text-sm font-medium text-ink">

                  <l.icon className="h-4 w-4 text-primary-500" /> {l.label}

                </span>

                <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-0.5" />

              </Link>

            ))}

          </div>

        </>

      ) : null}

    </div>

  );

}

