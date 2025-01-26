import { BN, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { LockLiquidityAllocation, LockLiquidityConfig } from "./config";
import { Connection } from "@solana/web3.js";
import { deriveCustomizablePermissionlessConstantProductPoolAddress, createProgram, getAssociatedTokenAccount } from "@mercurial-finance/dynamic-amm-sdk/dist/cjs/src/amm/utils";
import { SEEDS } from "@mercurial-finance/dynamic-amm-sdk/dist/cjs/src/amm/constants";
import AmmImpl from "@mercurial-finance/dynamic-amm-sdk";

export type AllocationByAmount = {
  address: PublicKey;
  amount: BN;
  percentage: number;
};

export function fromAllocationsToAmount(
  lpAmount: BN,
  allocations: LockLiquidityAllocation[],
): AllocationByAmount[] {
  const sumPercentage = allocations.reduce(
    (partialSum, a) => partialSum + a.percentage,
    0,
  );
  if (sumPercentage === 0) {
    throw Error("sumPercentage is zero");
  } else if (sumPercentage > 100) {
    throw Error("sumPercentage is greater than 100");
  }

  let amounts: AllocationByAmount[] = [];
  let sum = new BN(0);
  for (let i = 0; i < allocations.length - 1; i++) {
    const amount = lpAmount
      .mul(new BN(allocations[i].percentage))
      .div(new BN(sumPercentage));
    sum = sum.add(amount);
    amounts.push({
      address: new PublicKey(allocations[i].address),
      amount,
      percentage: allocations[i].percentage,
    });
  }
  // the last wallet get remaining amount
  amounts.push({
    address: new PublicKey(allocations[allocations.length - 1].address),
    amount: lpAmount.sub(sum),
    percentage: allocations[allocations.length - 1].percentage,
  });
  return amounts;
}

export async function createLockLiquidityTxs(
  connection: Connection,
  wallet: Wallet,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  lockLiquidityConfig: LockLiquidityConfig
): Promise<Array<Transaction>> {
  const poolKey = deriveCustomizablePermissionlessConstantProductPoolAddress(
    baseMint,
    quoteMint,
    createProgram(connection).ammProgram.programId,
  );

  console.log(`\n> Pool address: ${poolKey}`);

  const [lpMint] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.LP_MINT), poolKey.toBuffer()],
    createProgram(connection).ammProgram.programId,
  );
  const payerPoolLp = getAssociatedTokenAccount(lpMint, wallet.publicKey);
  const payerPoolLpBalance = (
    await connection.getTokenAccountBalance(payerPoolLp)
  ).value.amount;
  console.log("> payerPoolLpBalance %s", payerPoolLpBalance.toString());

  const allocationByAmounts = fromAllocationsToAmount(
    new BN(payerPoolLpBalance),
    lockLiquidityConfig.allocations,
  );
  const pool = await AmmImpl.create(connection, poolKey);

  let result: Array<Transaction> = [];
  for (const allocation of allocationByAmounts) {
    console.log("\n> Lock liquidity %s", allocation.address.toString());
    let tx = await pool.lockLiquidity(
      allocation.address,
      allocation.amount,
      wallet.publicKey,
    );

    result.push(tx)
  }
  return result;
}