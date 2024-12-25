import { Wallet, BN } from "@coral-xyz/anchor";
import AlphaVault, { PoolType } from "@meteora-ag/alpha-vault";
import { Cluster, Connection, PublicKey, Transaction } from "@solana/web3.js";
import { FcfsAlphaVaultConfig, ProrataAlphaVaultConfig } from "./config";
import { getAmountInLamports, getAlphaVaultWhitelistMode } from "./utils";

export async function createFcfsAlphaVault(
  connection: Connection,
  wallet: Wallet,
  poolType: PoolType,
  poolAddress: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  quoteDecimals: number,
  params: FcfsAlphaVaultConfig,
  opts?: {
    cluster: Cluster;
  },
): Promise<Transaction> {
  let maxDepositingCap = getAmountInLamports(
    params.maxDepositCap,
    quoteDecimals,
  );
  let individualDepositingCap = getAmountInLamports(
    params.individualDepositingCap,
    quoteDecimals,
  );
  let escrowFee = getAmountInLamports(params.escrowFee, quoteDecimals);
  let whitelistMode = getAlphaVaultWhitelistMode(params.whitelistMode);

  console.log(`\n> Initializing FcfsAlphaVault...`);
  console.log(`- Using poolType: ${poolType}`);
  console.log(`- Using poolMint ${poolAddress}`);
  console.log(`- Using baseMint ${baseMint}`);
  console.log(`- Using quoteMint ${quoteMint}`);
  console.log(`- Using depositingPoint ${params.depositingPoint}`);
  console.log(`- Using startVestingPoint ${params.startVestingPoint}`);
  console.log(`- Using endVestingPoint ${params.endVestingPoint}`);
  console.log(
    `- Using maxDepositingCap ${params.maxDepositCap}. In lamports ${maxDepositingCap}`,
  );
  console.log(
    `- Using individualDepositingCap ${params.individualDepositingCap}. In lamports ${individualDepositingCap}`,
  );
  console.log(
    `- Using escrowFee ${params.escrowFee}. In lamports ${escrowFee}`,
  );
  console.log(
    `- Using whitelistMode ${params.whitelistMode}. In value ${whitelistMode}`,
  );

  const tx = await AlphaVault.createCustomizableFcfsVault(
    connection,
    {
      quoteMint,
      baseMint,
      poolAddress,
      poolType,
      depositingPoint: new BN(params.depositingPoint),
      startVestingPoint: new BN(params.startVestingPoint),
      endVestingPoint: new BN(params.endVestingPoint),
      maxDepositingCap,
      individualDepositingCap,
      escrowFee,
      whitelistMode,
    },
    wallet.publicKey,
    opts,
  );
  return tx;
}

export async function createProrataAlphaVault(
  connection: Connection,
  wallet: Wallet,
  poolType: PoolType,
  poolAddress: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  quoteDecimals: number,
  params: ProrataAlphaVaultConfig,
  opts?: {
    cluster: Cluster;
  },
): Promise<Transaction> {
  let maxBuyingCap = getAmountInLamports(params.maxBuyingCap, quoteDecimals);
  let escrowFee = getAmountInLamports(params.escrowFee, quoteDecimals);
  let whitelistMode = getAlphaVaultWhitelistMode(params.whitelistMode);

  console.log(`\n> Initializing ProrataAlphaVault...`);
  console.log(`- Using poolType: ${poolType}`);
  console.log(`- Using poolMint ${poolAddress}`);
  console.log(`- Using baseMint ${baseMint}`);
  console.log(`- Using quoteMint ${quoteMint}`);
  console.log(`- Using depositingPoint ${params.depositingPoint}`);
  console.log(`- Using startVestingPoint ${params.startVestingPoint}`);
  console.log(`- Using endVestingPoint ${params.endVestingPoint}`);
  console.log(
    `- Using maxBuyingCap ${params.maxBuyingCap}. In lamports ${maxBuyingCap}`,
  );
  console.log(
    `- Using escrowFee ${params.escrowFee}. In lamports ${escrowFee}`,
  );
  console.log(
    `- Using whitelistMode ${params.whitelistMode}. In value ${whitelistMode}`,
  );

  const tx = await AlphaVault.createCustomizableProrataVault(
    connection,
    {
      quoteMint,
      baseMint,
      poolAddress,
      poolType,
      depositingPoint: new BN(params.depositingPoint),
      startVestingPoint: new BN(params.startVestingPoint),
      endVestingPoint: new BN(params.endVestingPoint),
      maxBuyingCap,
      escrowFee,
      whitelistMode,
    },
    wallet.publicKey,
    opts,
  );
  return tx;
}
