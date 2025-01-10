import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { M3m3Config, MeteoraConfig } from "./config";
import { M3M3_PROGRAM_IDS } from "./constants";
import StakeForFee, { deriveFeeVault } from "@meteora-ag/m3m3";
import { BN } from "@coral-xyz/anchor";
import { runSimulateTransaction } from "./utils";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import AmmImpl from "@mercurial-finance/dynamic-amm-sdk";
import Decimal from "decimal.js";

export async function create_m3m3_farm(
  connection: Connection,
  payer: Keypair,
  poolKey: PublicKey,
  stakeMint: PublicKey,
  config: M3m3Config,
  dryRun: boolean,
  opts?: {
    m3m3_program_id: PublicKey;
  },
): Promise<void> {
  const m3m3_program_id =
    opts?.m3m3_program_id ?? new PublicKey(M3M3_PROGRAM_IDS["mainnet-beta"]);
  const m3m3_vault_pubkey = deriveFeeVault(poolKey, m3m3_program_id);
  console.log(`- M3M3 fee vault ${m3m3_vault_pubkey}`);

  // 1. Create m3m3 farm
  try {
    const m3m3_farm = await StakeForFee.create(connection, poolKey);

    console.log(`>>> M3M3 farm is already existed. Skip creating new farm.`);
  } catch (err) {
    console.log(`>> Creating M3M3 fee farm...`);
    const topListLength = config.topListLength;
    const unstakeLockDuration = new BN(config.unstakeLockDurationSecs);
    const secondsToFullUnlock = new BN(config.secondsToFullUnlock);
    const startFeeDistributeTimestamp = new BN(
      config.startFeeDistributeTimestamp,
    );

    console.log(`- Using top list length`);

    // m3m3 farm didn't exist
    const createTx = await StakeForFee.createFeeVault(
      connection,
      poolKey,
      stakeMint,
      payer.publicKey,
      {
        topListLength,
        unstakeLockDuration,
        secondsToFullUnlock,
        startFeeDistributeTimestamp,
      },
    );

    if (dryRun) {
      console.log(`> Simulating create m3m3 farm tx...`);
      await runSimulateTransaction(connection, [payer], payer.publicKey, [
        createTx,
      ]);
    } else {
      console.log(`>> Sending create m3m3 farm transaction...`);
      const txHash = await sendAndConfirmTransaction(connection, createTx, [
        payer,
      ]).catch((err) => {
        console.error(err);
        throw err;
      });
      console.log(
        `>>> M3M3 farm initialized successfully with tx hash: ${txHash}`,
      );
    }
  }
}

export async function lockLiquidityToFeeVault(
  connection: Connection,
  poolKey: PublicKey,
  pool: AmmImpl,
  payer: Keypair,
  lockBps: number,
  dryRun: boolean,
  opts?: {
    m3m3_program_id: PublicKey;
  },
) {
  const m3m3_program_id =
    opts?.m3m3_program_id ?? new PublicKey(M3M3_PROGRAM_IDS["mainnet-beta"]);
  const feeVaultKey = deriveFeeVault(poolKey, m3m3_program_id);

  const poolLpAta = getAssociatedTokenAddressSync(
    pool.poolState.lpMint,
    payer.publicKey,
  );

  const lpAmount = await connection
    .getTokenAccountBalance(poolLpAta)
    .then((info) => new BN(info.value.amount.toString()));

  const lockBpsBN = new BN(Math.min(10_000, lockBps));
  const lockAmount = lpAmount.mul(lockBpsBN).div(new BN(10_000));

  const lockTx = await pool.lockLiquidity(
    feeVaultKey,
    lockAmount,
    payer.publicKey,
    {
      stakeLiquidity: {
        ratio: new Decimal(1), // 0 to 1; 1 means 100%
      },
    },
  );

  if (dryRun) {
    console.log(`> Simulating lock liquidity to fee farm tx...`);
    await runSimulateTransaction(connection, [payer], payer.publicKey, [
      lockTx,
    ]);
  } else {
    console.log(`>> Sending lock liquidity to fee farm transaction...`);
    const txHash = await sendAndConfirmTransaction(connection, lockTx, [
      payer,
    ]).catch((err) => {
      console.error(err);
      throw err;
    });
    console.log(
      `>>> Lock liquidity to fee farm successfully with tx hash: ${txHash}`,
    );
  }
}
