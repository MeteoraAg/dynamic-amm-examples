import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
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
import { ActivationType as DlmmActivationType } from "@meteora-ag/dlmm";
import {
  PermissionWithAuthority,
  PermissionWithMerkleProof,
  Permissionless,
  PoolType,
  WhitelistMode,
} from "@meteora-ag/alpha-vault";
import { MeteoraConfig } from "..";

export function validate_config(config: MeteoraConfig) {
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

  if (config.alphaVault) {
    if (
      config.alphaVault.alphaVaultType != "fcfs" &&
      config.alphaVault.alphaVaultType != "prorata"
    ) {
      throw new Error(
        `Alpha vault type ${config.alphaVault.alphaVaultType} isn't supported.`,
      );
    }

    if (
      config.alphaVault.poolType != "dynamic" &&
      config.alphaVault.poolType != "dlmm"
    ) {
      throw new Error(
        `Alpha vault pool tyep ${config.alphaVault.poolType} isn't supported.`,
      );
    }
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
    return new PublicKey(SOL_TOKEN_MINT);
  } else if (quoteSymbol.toLowerCase() == "usdc") {
    return new PublicKey(USDC_TOKEN_MINT);
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
  wallet: Wallet,
  txs: Array<Transaction>,
) {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const transaction = new Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer: wallet.publicKey,
  }).add(...txs);

  let simulateResp = await simulateTransaction(connection, transaction, [
    wallet.payer,
  ]);
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

export function getAlphaVaultPoolType(poolType: string): PoolType {
  switch (poolType.toLowerCase()) {
    case "dynamic":
      return PoolType.DYNAMIC;
    case "dlmm":
      return PoolType.DLMM;
    default:
      throw new Error(`Unsupported alpha vault pool type: ${poolType}`);
  }
}

export function getAlphaVaultWhitelistMode(mode: string): WhitelistMode {
  switch (mode.toLowerCase()) {
    case "permissionless":
      return Permissionless;
    case "permission_with_merkle_proof":
      return PermissionWithMerkleProof;
    case "permission_with_authority":
      return PermissionWithAuthority;
    default:
      throw new Error(`Unsupported alpha vaultWhitelist mode: ${mode}`);
  }
}

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
