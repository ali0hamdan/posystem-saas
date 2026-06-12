import { api } from '@/api/client';

export type B2bPrintData = {
  documentType: 'QUOTATION' | 'PROFORMA_INVOICE' | 'OFFICIAL_INVOICE';
  title: string;
  subtitle: string;
  company: {
    businessName: string;
    storeName: string;
    branchName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    taxNumber: string | null;
    logoUrl: string | null;
  };
  customer: {
    name: string | null;
    companyName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    taxNumber: string | null;
    paymentTermsDays: number | null;
  } | null;
  document: {
    id: string;
    number: string;
    issueDate: string;
    validUntil: string | null;
    dueDate: string | null;
    status: string;
    createdBy: string | null;
    convertedStatus: string | null;
    sourceReference: string | null;
    paymentStatus: string | null;
    currency: string;
  };
  items: {
    lineNumber: number;
    productName: string;
    sku: string | null;
    barcode: string | null;
    quantity: number;
    unitPrice: string;
    discount: string;
    taxRate: string | null;
    lineTotal: string;
    notes: string | null;
  }[];
  totals: {
    subtotal: string;
    discountTotal: string;
    taxTotal: string;
    shippingFee: string | null;
    total: string;
    amountPaid: string | null;
    balanceDue: string | null;
  };
  payments: {
    id: string;
    method: string;
    amount: string;
    createdAt: string;
  }[] | null;
  terms: {
    terms: string | null;
    notes: string | null;
    defaultTerms: string | null;
    showSignatureArea: boolean;
    footerText: string | null;
  };
};

export async function fetchQuotationPrintData(id: string) {
  const { data } = await api.get<B2bPrintData>(`/wholesale/quotations/${id}/print-data`);
  return data;
}

export async function fetchProformaPrintData(id: string) {
  const { data } = await api.get<B2bPrintData>(`/wholesale/proforma-invoices/${id}/print-data`);
  return data;
}

export async function fetchInvoicePrintData(id: string) {
  const { data } = await api.get<B2bPrintData>(`/wholesale/invoices/${id}/print-data`);
  return data;
}
