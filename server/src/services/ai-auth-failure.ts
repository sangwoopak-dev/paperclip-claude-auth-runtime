import { AI_PROVIDERS, isAiConnectionCompatible, type AiConnectionBinding } from "@paperclipai/shared";

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

/** Provider authentication signals only. Tool authorization and quotas need different repairs. */
export function isAiAuthenticationFailure(code: string | null | undefined): boolean {
  return Boolean(code && (
    /^(acpx|claude|codex|grok|opencode|gemini|kimi|pi|cursor)_auth_required$/.test(code)
    || ["adapter_auth_missing", "authentication_required", "auth_required", "refresh_token_reused", "refresh_token_expired", "refresh_token_invalidated"].includes(code)
  ));
}

/** Usage access is not proof of inference authentication for Claude setup-tokens. */
export function isConfirmedClaudeExecutionAuthenticationFailure(input: {
  errorCode?: string | null;
  resultJson?: unknown;
  providerHttpStatus?: number | null;
}): boolean {
  if (!isAiAuthenticationFailure(input.errorCode)) return false;
  if (input.providerHttpStatus === 401) return true;
  const result = object(input.resultJson);
  if (!result) return false;
  const status = Number(result.api_error_status ?? result.error_status);
  if (status === 401) return true;
  const terminal = object(result.terminalSessionFailure);
  const diagnostic = [terminal?.title, terminal?.details, result.error]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
  // Only the typed ACP access *title* supplies a bare HTTP status signal.
  // Diagnostic details can contain unrelated or quoted HTTP errors.
  const explicitExecution401 = terminal?.category === "access"
    && typeof terminal.title === "string"
    && /\bHTTP\s*[:=]?\s*401\b/i.test(terminal.title);
  return explicitExecution401 || (
    terminal?.category === "access"
    && /\b(?:revoked|invalid|expired)\b[\s\S]{0,60}\b(?:bearer|oauth|access)\s+token\b|\b(?:bearer|oauth|access)\s+token\b[\s\S]{0,60}\b(?:revoked|invalid|expired)\b/i.test(diagnostic)
  );
}

/** Only a persisted blocked classification confirms that an inline repair owns recovery. */
export function isAiAuthenticationBlocked(run: { errorCode?: string | null; livenessState?: string | null } | null | undefined): boolean {
  return run?.livenessState === "blocked" && isAiAuthenticationFailure(run.errorCode);
}

export function aiBindingForAuthRecovery(
  adapterType: string,
  config: Record<string, unknown>,
): AiConnectionBinding | undefined {
  for (const provider of AI_PROVIDERS) {
    const binding = { provider, method: provider === "openrouter" ? "api_key" : "subscription", mode: "responsible_user" } as const;
    if (isAiConnectionCompatible(binding, adapterType, config.model, config.provider, config.acpxAgent)) return binding;
  }
  return undefined;
}
