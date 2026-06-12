import { api } from '@/api/client';

export type FnbDashboard = {
  openOrders: number; todayOrders: number; todayRevenue: number | string;
  tablesTotal: number; tablesOccupied: number; activeTickets: number;
};
export type FnbReport = {
  range: { from: string; to: string };
  totals: { orders: number; revenue: number; tax: number; avgOrder: number };
  byType: { type: string; orders: number; revenue: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
};

export async function fetchFnbDashboard(): Promise<FnbDashboard> {
  const { data } = await api.get<FnbDashboard>('/fnb/reports/dashboard');
  return data;
}
export async function fetchFnbReport(params: { from?: string; to?: string }): Promise<FnbReport> {
  const { data } = await api.get<FnbReport>('/fnb/reports', { params });
  return data;
}
