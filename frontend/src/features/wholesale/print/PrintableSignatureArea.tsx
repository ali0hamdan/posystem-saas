type Props = { show: boolean };

export function PrintableSignatureArea({ show }: Props) {
  if (!show) return null;
  return (
    <section className="b2b-print-signatures">
      <div className="b2b-print-sig-block">
        <div className="b2b-print-sig-line" />
        <p>Authorized signature</p>
      </div>
      <div className="b2b-print-sig-block">
        <div className="b2b-print-sig-line" />
        <p>Customer signature</p>
      </div>
    </section>
  );
}
