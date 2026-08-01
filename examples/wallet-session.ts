import type { Address, Hex } from "@intheta/hl-vault-sdk";
import { LeaderTradingClient } from "@intheta/hl-vault-sdk";

declare const connectedLeader: Address;
declare function signWithConnectedWallet(message: string): Promise<Hex>;

const client = new LeaderTradingClient({
  baseUrl: "https://trade.example.com",
});

const session = await client.authorizeLeader(
  connectedLeader,
  signWithConnectedWallet,
);
console.log({ vault: session.vault, expiresAt: session.expiresAt });
