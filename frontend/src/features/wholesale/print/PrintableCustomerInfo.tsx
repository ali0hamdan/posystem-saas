import type { B2bPrintData } from '@/api/wholesale/b2b-print.api';

type Props = { data: B2bPrintData };

export function PrintableCustomerInfo({ data }: Props) {
  const customer = data.customer;
  if (!customer?.name) {
    return (
      <section className="b2b-print-customer">
        <h2>Bill To</h2>
        <p className="b2b-print-muted">Walk-in / no customer</p>
      </section>
    );
  }

  return (
    <section className="b2b-print-customer">
      <h2>Bill To</h2>
      <p className="b2b-print-customer-name">{customer.companyName && customer.companyName !== customer.name ? customer.companyName : customer.name}</p>
      {customer.companyName && customer.companyName !== customer.name ? <p>{customer.name}</p> : null}
      {customer.phone ? <p>{customer.phone}</p> : null}
      {customer.email ? <p>{customer.email}</p> : null}
      {customer.address ? <p>{customer.address}</p> : null}
      {customer.taxNumber ? <p>Tax/VAT: {customer.taxNumber}</p> : null}
      {customer.paymentTermsDays != null ? (
        <p>Payment terms: Net {customer.paymentTermsDays}</p>
      ) : null}
    </section>
  );
}
