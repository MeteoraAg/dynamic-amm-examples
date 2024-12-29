import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import { parseArgs } from "util";
import { BN } from "bn.js";
import Decimal from "decimal.js";
import {
  SOL_TOKEN_DECIMALS,
  SOL_TOKEN_MINT,
  USDC_TOKEN_DECIMALS,
  USDC_TOKEN_MINT,
} from "./constants";
import { Wallet } from "@coral-xyz/anchor";
import { simulateTransaction } from "@coral-xyz/anchor/dist/cjs/utils/rpc";
import { ActivationType as DynamicAmmActivationType } from "@mercurial-finance/dynamic-amm-sdk/dist/cjs/src/amm/types";
import {
  ActivationType as DlmmActivationType,
  getPriceOfBinByBinId,
} from "@meteora-ag/dlmm";
import {
  PermissionWithAuthority,
  PermissionWithMerkleProof,
  Permissionless,
  PoolType,
  SEED,
  WhitelistMode,
} from "@meteora-ag/alpha-vault";
import { MeteoraConfig, PoolTypeConfig, WhitelistModeConfig } from "..";

export const DEFAULT_ADD_LIQUIDITY_CU = 800_000;

export function extraConfigValidation(config: MeteoraConfig) {
  if (!config.keypairFilePath) {
    throw new Error("Missing keypairFilePath in config file.");
  }
  if (!config.rpcUrl) {
    throw new Error("Missing rpcUrl in config file.");
  }

  if (config.createBaseToken && config.baseMint) {
    throw new Error(
      "Both createBaseToken and baseMint cannot be set simultaneously.",
    );
  }

  if (config.dynamicAmm && config.dlmm) {
    throw new Error(
      "Both Dynamic AMM and DLMM configuration cannot be set simultaneously.",
    );
  }
}

export function safeParseJsonFromFile<T>(filePath: string): T {
  try {
    const rawData = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Error reading or parsing JSON file:", error);
    throw new Error(`failed to parse file ${filePath}`);
  }
}

export function safeParseKeypairFromFile(filePath: string): Keypair {
  let keypairJson: Array<number> = safeParseJsonFromFile(filePath);
  let keypairBytes = Uint8Array.from(keypairJson);
  let keypair = Keypair.fromSecretKey(keypairBytes);
  return keypair;
}

export function parseKeypairFromSecretKey(secretKey: string): Keypair {
  const keypairBytes = bs58.decode(secretKey);
  const keypair = Keypair.fromSecretKey(keypairBytes);
  return keypair;
}

export function getAmountInLamports(
  amount: number | string,
  decimals: number,
): BN {
  const amountD = new Decimal(amount);
  const amountLamports = amountD.mul(new Decimal(10 ** decimals));
  return new BN(amountLamports.toString());
}

export function getDecimalizedAmount(amountLamport: BN, decimals: number): BN {
  return amountLamport / new BN(10 ** decimals);
}

export function getQuoteMint(quoteSymbol: string): PublicKey {
  if (quoteSymbol.toLowerCase() == "sol") {
    return SOL_TOKEN_MINT;
  } else if (quoteSymbol.toLowerCase() == "usdc") {
    return USDC_TOKEN_MINT;
  } else {
    throw new Error(`Unsupported quote symbol: ${quoteSymbol}`);
  }
}

export function getQuoteDecimals(quoteSymbol: string): number {
  if (quoteSymbol.toLowerCase() == "sol") {
    return SOL_TOKEN_DECIMALS;
  } else if (quoteSymbol.toLowerCase() == "usdc") {
    return USDC_TOKEN_DECIMALS;
  } else {
    throw new Error(`Unsupported quote symbol: ${quoteSymbol}`);
  }
}

export async function runSimulateTransaction(
  connection: Connection,
  signers: Array<Keypair>,
  feePayer: PublicKey,
  txs: Array<Transaction>,
) {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const transaction = new Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer,
  }).add(...txs);

  let simulateResp = await simulateTransaction(
    connection,
    transaction,
    signers,
  );
  if (simulateResp.value.err) {
    console.error(">>> Simulate transaction failed:", simulateResp.value.err);
    console.log(`Logs ${simulateResp.value.logs}`);
    throw simulateResp.value.err;
  }

  console.log(">>> Simulated transaction successfully");
}

export function getDynamicAmmActivationType(
  activationType: string,
): DynamicAmmActivationType {
  switch (activationType.toLowerCase()) {
    case "timestamp":
      return DynamicAmmActivationType.Timestamp;
    case "slot":
      return DynamicAmmActivationType.Slot;
    default:
      throw new Error(
        `Unsupported Dynamic AMM activation type: ${activationType}`,
      );
  }
}

export function getDlmmActivationType(
  activationType: string,
): DlmmActivationType {
  switch (activationType.toLowerCase()) {
    case "timestamp":
      return DlmmActivationType.Timestamp;
    case "slot":
      return DlmmActivationType.Slot;
    default:
      throw new Error(`Unsupported DLMM activation type: ${activationType}`);
  }
}

export function toAlphaVaulSdkPoolType(poolType: PoolTypeConfig): PoolType {
  switch (poolType) {
    case PoolTypeConfig.Dynamic:
      return PoolType.DYNAMIC;
    case PoolTypeConfig.Dlmm:
      return PoolType.DLMM;
    default:
      throw new Error(`Unsupported alpha vault pool type: ${poolType}`);
  }
}

export function getAlphaVaultWhitelistMode(
  mode: WhitelistModeConfig,
): WhitelistMode {
  switch (mode) {
    case WhitelistModeConfig.Permissionless:
      return Permissionless;
    case WhitelistModeConfig.PermissionedWithAuthority:
      return PermissionWithAuthority;
    case WhitelistModeConfig.PermissionedWithMerkleProof:
      return PermissionWithMerkleProof;
    default:
      throw new Error(`Unsupported alpha vaultWhitelist mode: ${mode}`);
  }
}

/**
 * Modify priority fee in transaction
 * @param tx
 * @param newPriorityFee
 * @returns {boolean} true if priority fee was modified
 **/
export const modifyComputeUnitPriceIx = (
  tx: VersionedTransaction | Transaction,
  newPriorityFee: number,
): boolean => {
  if ("version" in tx) {
    for (let ix of tx.message.compiledInstructions) {
      let programId = tx.message.staticAccountKeys[ix.programIdIndex];
      if (programId && ComputeBudgetProgram.programId.equals(programId)) {
        // need check for data index
        if (ix.data[0] === 3) {
          ix.data = Uint8Array.from(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: newPriorityFee,
            }).data,
          );
          return true;
        }
      }
    }
    // could not inject for VT
  } else {
    for (let ix of tx.instructions) {
      if (ComputeBudgetProgram.programId.equals(ix.programId)) {
        // need check for data index
        if (ix.data[0] === 3) {
          ix.data = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: newPriorityFee,
          }).data;
          return true;
        }
      }
    }

    // inject if none
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: newPriorityFee,
      }),
    );
    return true;
  }

  return false;
};

export interface CliArguments {
  // Config filepath
  config?: string | undefined;
}

export function parseCliArguments(): CliArguments {
  const { values, positionals } = parseArgs({
    args: Bun.argv,
    options: {
      config: {
        type: "string",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  return values;
}

export function deriveAlphaVault(
  base: PublicKey,
  lbPair: PublicKey,
  programId: PublicKey,
) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED.vault), base.toBuffer(), lbPair.toBuffer()],
    programId,
  );
}
