import type { ProtocolConfig, VaultSummary } from "./types.js";

export type VaultDepositSetup = {
  state: "archived" | "platform_paused" | "refresh_required" | "leader_approval" | "verification_pending" | "open_deposits" | "deposit_ready";
  actor: "platform" | "leader" | "follower" | "none";
  message: string;
};

/** Display guidance only. Recheck on-chain balances, admission, limits and gates before signing. */
export function describeVaultDepositSetup(
  protocol: Pick<ProtocolConfig, "transactions_enabled" | "builder_fee_required" | "builder_verifier_automatic" | "builder_verifier_status">,
  vault: Pick<VaultSummary, "archived" | "builder_fee_active" | "builder_fee_approval_requested" | "public_deposits_enabled">,
): VaultDepositSetup {
  if (vault.archived) return { state: "archived", actor: "none", message: "This vault is archived. Use recovery and existing claims; create a fresh vault for new deposits." };
  if (!protocol.transactions_enabled) return { state: "platform_paused", actor: "platform", message: "Vault transactions are paused by the platform. Check recovery availability separately." };
  if (protocol.builder_fee_required && vault.builder_fee_active === null) return { state: "refresh_required", actor: "none", message: "Refresh vault status before choosing a deposit action." };
  if (protocol.builder_fee_required && !vault.builder_fee_active) {
    if (vault.builder_fee_approval_requested === null) return { state: "refresh_required", actor: "none", message: "Builder approval status is unknown. Refresh before signing." };
    if (!vault.builder_fee_approval_requested) return { state: "leader_approval", actor: "leader", message: "Connect the vault leader wallet and finish trading setup and builder approval. Followers do not sign this approval." };
    switch (protocol.builder_verifier_status) {
      case "paused":
        return { state: "platform_paused", actor: "platform", message: "The platform builder account is not eligible. The operator must restore it; vault deposits or repeated signatures will not fix this." };
      case "degraded": case "unavailable": case "stale":
        return { state: "platform_paused", actor: "platform", message: "Omni verification is temporarily unavailable. Wait for platform recovery; do not repeat the leader approval." };
      case "starting":
        return { state: "verification_pending", actor: "none", message: "Omni verification is starting. Refresh status periodically; no new leader signature is required." };
      default:
        return { state: "verification_pending", actor: protocol.builder_verifier_automatic ? "none" : "platform", message: protocol.builder_verifier_automatic
          ? "Omni is checking HyperCore allowance and verifying on-chain. Wait; no new leader signature is required."
          : "Independent platform verification is pending. The operator must verify; no repeated leader signature is required." };
    }
  }
  if (vault.public_deposits_enabled === null) return { state: "refresh_required", actor: "none", message: "Public deposit status is unknown. Refresh before signing." };
  if (!vault.public_deposits_enabled) return { state: "open_deposits", actor: "leader", message: "Builder setup is complete. The leader must enable public deposits if the vault's on-chain gates permit it." };
  return { state: "deposit_ready", actor: "follower", message: "Public deposits are open. Check balance, allowance, admission and limits, then request a deposit and claim shares after settlement." };
}
