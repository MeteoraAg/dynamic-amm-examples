import { BN, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { MeteoraConfig, parseConfigFromCli } from "./libs/config";
import { DEFAULT_COMMITMENT_LEVEL, M3M3_PROGRAM_IDS } from "./libs/constants";
import {
  safeParseKeypairFromFile,
  getQuoteMint,
  getQuoteDecimals,
  runSimulateTransaction,
} from "./libs/utils";
import { createTokenMint } from "./libs/create_token_mint";
import { createPermissionlessDynamicPool } from "./libs/create_pool_utils";
import {
  createProgram,
  deriveCustomizablePermissionlessConstantProductPoolAddress,
} from "@mercurial-finance/dynamic-amm-sdk/dist/cjs/src/amm/utils";
import AmmImpl from "@mercurial-finance/dynamic-amm-sdk";
import StakeForFee, { deriveFeeVault } from "@meteora-ag/m3m3";
import {
  create_m3m3_farm,
  lockLiquidityToFeeVault,
} from "./libs/create_m3m3_farm_utils";

async function main() {
  let config: MeteoraConfig = parseConfigFromCli();

  console.log(`> Using keypair file path ${config.keypairFilePath}`);
  let keypair = safeParseKeypairFromFile(config.keypairFilePath);

  console.log("\n> Initializing with general configuration...");
  console.log(`- Using RPC URL ${config.rpcUrl}`);
  console.log(`- Dry run = ${config.dryRun}`);
  console.log(`- Using payer ${keypair.publicKey} to execute commands`);

  const connection = new Connection(config.rpcUrl, DEFAULT_COMMITMENT_LEVEL);
  const wallet = new Wallet(keypair);

  let quoteMint = getQuoteMint(config.quoteSymbol);
  const ammProgram = createProgram(connection).ammProgram;
  const poolKey = deriveCustomizablePermissionlessConstantProductPoolAddress(
    new PublicKey(config.baseMint),
    quoteMint,
    ammProgram.programId,
  );

  let baseMint: PublicKey;
  let poolExisted = false;
  if (config.baseMint) {
    try {
      await AmmImpl.create(connection, poolKey);
      // pool existed, can use configured base mint
      baseMint = new PublicKey(config.baseMint);
      poolExisted = true;
    } catch (err) {
      // pool not existed, require create base token mint
      if (!config.createBaseToken) {
        throw new Error(
          "Missing createBaseToken in configuration. New token mint is required when creating M3M3 farm.",
        );
      }

      // 1. Mint token
      baseMint = await createTokenMint(connection, wallet, {
        dryRun: config.dryRun,
        mintTokenAmount: config.createBaseToken.mintBaseTokenAmount,
        decimals: config.createBaseToken.baseDecimals,
        computeUnitPriceMicroLamports: config.computeUnitPriceMicroLamports,
      });
    }
  }

  console.log(`- Using base token mint ${baseMint.toString()}`);
  console.log(`- Using quote token mint ${quoteMint.toString()}`);
  console.log(`- Pool key ${poolKey}`);

  // If pool is not existed
  if (!poolExisted) {
    if (!config.dynamicAmm) {
      throw new Error("Missing dynamicAmm configuration");
    }

    // 2. Create pool
    await createPermissionlessDynamicPool(
      config,
      connection,
      wallet,
      baseMint,
      quoteMint,
    );
  } else {
    console.log(">>> Pool is already existed. Skip creating new pool.");
  }

  if (!config.m3m3) {
    throw new Error("Missing M3M3 configuration");
  }

  // 3. Create M3M3 farm
  await create_m3m3_farm(
    connection,
    wallet.payer,
    poolKey,
    baseMint,
    config.m3m3,
    config.dryRun,
  );

  const pool = await AmmImpl.create(connection, poolKey);
  // 4. Lock LP to m3m3 vault
  await lockLiquidityToFeeVault(
    connection,
    poolKey,
    pool,
    wallet.payer,
    10_000,
    config.dryRun,
  );
}
