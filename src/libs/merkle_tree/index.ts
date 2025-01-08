import AlphaVault, { WalletDepositCap } from "@meteora-ag/alpha-vault";
import { Connection } from "@solana/web3.js";
import Decimal from "decimal.js";
import { BalanceTree } from "./balance_tree";
import { BN } from "bn.js";

export * from "./balance_tree";
export * from "./merkle_tree";

export const createMerkleTree = async (
  connection: Connection,
  alphaVault: AlphaVault,
  whitelistedWallets: WalletDepositCap[],
): Promise<BalanceTree> => {
  const quoteMint = await connection.getTokenSupply(alphaVault.vault.quoteMint);
  const toNativeAmountMultiplier = new Decimal(10 ** quoteMint.value.decimals);
  const tree = new BalanceTree(
    whitelistedWallets.map((info) => {
      return {
        account: info.address,
        maxCap: new BN(info.maxAmount.mul(toNativeAmountMultiplier).toString()),
      };
    }),
  );

  return tree;
};
