/** Display label for API role enums (e.g. OWNER → Owner). */
export function formatRoleLabel(role: string | undefined): string {
  if (!role) return '—';
  const lower = role.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
