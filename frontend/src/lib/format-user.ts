/** Display label for API role enums (e.g. GENERAL_MANAGER → General Manager). */
export function formatRoleLabel(role: string | undefined): string {
  if (!role) return '—';
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/^Co Manager$/, 'Co-Manager');
}
