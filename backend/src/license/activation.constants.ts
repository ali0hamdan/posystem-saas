/** Shared response body for failed POS activation (no client/code hints). */
export const ACTIVATION_PUBLIC_FAILURE_BODY = {
  message: 'Activation could not be completed. Check your code and try again.',
  code: 'ACTIVATION_FAILED',
} as const;
