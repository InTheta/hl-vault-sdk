import { PublicVaultClient } from "@intheta/hl-vault-sdk";

const client = new PublicVaultClient({
  baseUrl: process.env.HL_VAULT_API_URL ?? "https://vault-api.example.com",
});

const list = await client.vaults();
for (const vault of list.vaults) {
  console.log({
    name: vault.name,
    address: vault.address,
    contractNavUsdc: vault.tvl_usdc,
    coreCashUsdc: vault.core_spot_usdc,
    accounting: vault.reconciliation_status,
  });
}
