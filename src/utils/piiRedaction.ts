/**
 * PII redaction helpers for log statements.
 *
 * Used to satisfy the `no-restricted-syntax` ESLint rule that flags raw PII
 * (email, userId, token, etc.) inside `console.*` calls. See COPPA US-012.
 *
 * Pattern:
 *   console.log('user:', redactUserId(userId))
 *   console.log({ email: redactEmail(email) })
 */

/** Redact a userId/sessionId/token to its first 4 chars + ***. */
export function redactId(value: string | null | undefined): string {
  if (!value) return '<empty>';
  if (value.length <= 4) return '***';
  return `${value.slice(0, 4)}***`;
}

/** Redact an email to first char of local-part + domain. */
export function redactEmail(value: string | null | undefined): string {
  if (!value) return '<empty>';
  const at = value.indexOf('@');
  if (at <= 0) return '***';
  return `${value[0]}***${value.slice(at)}`;
}
