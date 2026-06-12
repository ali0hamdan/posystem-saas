import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/lib/format-money';
import type { DailySalesPoint } from '@/types/reports';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function num(v: string | number): number {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function shortLabel(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00.000Z');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return isoDate;
  }
}

type SimpleSalesChartProps = {
  points: DailySalesPoint[];
  rangeLabel?: string;
  currency?: string;
};

export function SimpleSalesChart({ points, rangeLabel, currency = 'USD' }: SimpleSalesChartProps) {
  if (!points.length) {
    return null;
  }

  const data = points.map((p) => ({
    date: p.date,
    label: shortLabel(p.date),
    revenue: num(p.revenue),
    orders: p.ordersCount,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <CardTitle>Sales revenue</CardTitle>
            {rangeLabel ? <CardDescription>{rangeLabel}</CardDescription> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-56 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatMoney(Number(v), currency)}
                width={72}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                }}
                formatter={(value: number) => [formatMoney(value, currency), 'Revenue']}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload as { orders?: number } | undefined;
                  const o = row?.orders;
                  return o !== undefined ? `${label} · ${o} orders` : String(label);
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#ea580c"
                strokeWidth={2}
                fill="url(#fillRevenue)"
                dot={{ r: 3, fill: '#ea580c', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs text-ink-muted">Totals follow your report date range (UTC calendar days).</p>
      </CardContent>
    </Card>
  );
}
