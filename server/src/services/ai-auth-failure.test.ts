import { describe, expect, it } from "vitest";
import { aiBindingForAuthRecovery, isAiAuthenticationFailure, isConfirmedClaudeExecutionAuthenticationFailure } from "./ai-auth-failure.js";

describe("AI authentication failure recovery", () => {
  it.each(["acpx_auth_required", "claude_auth_required", "codex_auth_required", "grok_auth_required", "adapter_auth_missing", "refresh_token_reused", "refresh_token_expired", "refresh_token_invalidated"])("recognizes %s", (code) => {
    expect(isAiAuthenticationFailure(code)).toBe(true);
  });
  it.each(["github_auth_required", "native_adopted_runner_authentication_timeout", "rate_limit", "adapter_failed", "permission_denied", undefined])("does not treat %s as model authentication", (code) => {
    expect(isAiAuthenticationFailure(code)).toBe(false);
  });
  it("confirms only direct Claude execution rejection evidence for subscription recovery", () => {
    expect(isConfirmedClaudeExecutionAuthenticationFailure({ errorCode: "claude_auth_required", resultJson: { api_error_status: 401 } })).toBe(true);
    expect(isConfirmedClaudeExecutionAuthenticationFailure({ errorCode: "claude_auth_required", resultJson: { api_error_status: 403 } })).toBe(false);
    expect(isConfirmedClaudeExecutionAuthenticationFailure({ errorCode: "claude_auth_required", resultJson: { terminalSessionFailure: { category: "access", details: "OAuth access token revoked" } } })).toBe(true);
    expect(isConfirmedClaudeExecutionAuthenticationFailure({ errorCode: "provider_quota", resultJson: { api_error_status: 401 } })).toBe(false);
    expect(isConfirmedClaudeExecutionAuthenticationFailure({ errorCode: "claude_auth_required", resultJson: { terminalSessionFailure: { category: "access", details: "session quota exhausted" } } })).toBe(false);
    expect(isConfirmedClaudeExecutionAuthenticationFailure({ errorCode: "claude_auth_required", providerHttpStatus: 401 })).toBe(true);
    expect(isConfirmedClaudeExecutionAuthenticationFailure({ errorCode: "claude_auth_required", resultJson: { terminalSessionFailure: { category: "access", title: "Authentication required (HTTP 401)" } } })).toBe(true);
    expect(isConfirmedClaudeExecutionAuthenticationFailure({ errorCode: "claude_auth_required", resultJson: { terminalSessionFailure: { category: "access", title: "HTTP: 401 - sign in required" } } })).toBe(true);
    expect(isConfirmedClaudeExecutionAuthenticationFailure({ errorCode: "claude_auth_required", resultJson: { terminalSessionFailure: { category: "access", title: "Authorization denied (HTTP 403)" } } })).toBe(false);
    expect(isConfirmedClaudeExecutionAuthenticationFailure({ errorCode: "claude_auth_required", resultJson: { terminalSessionFailure: { category: "service", title: "Authentication required (HTTP 401)" } } })).toBe(false);
    expect(isConfirmedClaudeExecutionAuthenticationFailure({ errorCode: "claude_auth_required", resultJson: { terminalSessionFailure: { category: "access", title: "Authentication required", details: "Unrelated HTTP 401 in diagnostic context" } } })).toBe(false);
  });
  it.each([
    ["codex_local", {}, "openai"],
    ["claude_local", {}, "anthropic"],
    ["paperclip_runner", { provider: "codex" }, "openai"],
    ["paperclip_runner", { provider: "acpx", acpxAgent: "claude" }, "anthropic"],
    ["paperclip_runner", { provider: "acpx", acpxAgent: "grok" }, "xai"],
    ["opencode_local", { model: "openrouter/model" }, "openrouter"],
  ] as const)("maps %s %j to %s", (adapter, config, provider) => {
    expect(aiBindingForAuthRecovery(adapter, config)).toMatchObject({ provider, mode: "responsible_user" });
  });
  it("does not guess a provider for unsupported harnesses or routes", () => {
    expect(aiBindingForAuthRecovery("gemini_local", {})).toBeUndefined();
    expect(aiBindingForAuthRecovery("opencode_local", { model: "anthropic/claude" })).toBeUndefined();
    expect(aiBindingForAuthRecovery("paperclip_runner", { provider: "acpx", acpxAgent: "custom" })).toBeUndefined();
  });
});
