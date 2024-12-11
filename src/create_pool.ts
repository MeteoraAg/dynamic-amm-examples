import {
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  DEFAULT_COMMITMENT_LEVEL,
  MeteoraConfig,
  getAmountInLamports,
  getQuoteMint,
  getQuoteDecimals,
  safeParseKeypairFromFile,
  runSimulateTransaction,
  getDynamicAmmActivationType,
  getDlmmActivationType,
  parseConfigFromCli,
} from ".";
import { AmmImpl } from "@mercurial-finance/dynamic-amm-sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { BN } from "bn.js";
import DLMM, {
  LBCLMM_PROGRAM_IDS,
  deriveCustomizablePermissionlessLbPair,
} from "@meteora-ag/dlmm";
import Decimal from "decimal.js";
import { createTokenMint } from "./libs/create_token_mint";
import { CustomizableParams } from "@mercurial-finance/dynamic-amm-sdk/dist/cjs/src/amm/types";
import {
  deriveCustomizablePermissionlessConstantProductPoolAddress,
  createProgram,
} from "@mercurial-finance/dynamic-amm-sdk/dist/cjs/src/amm/utils";

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
  const provider = new AnchorProvider(connection, wallet, {
    commitment: connection.commitment,
  });

  let baseMint: PublicKey;
  let quoteMint = getQuoteMint(config.quoteSymbol);

  // If we want to create a new token mint
  if (config.createBaseToken) {
    if (!config.createBaseToken.mintBaseTokenAmount) {
      throw new Error("Missing mintBaseTokenAmount in configuration");
    }
    if (!config.baseDecimals) {
      throw new Error("Missing baseDecimals in configuration");
    }
    baseMint = await createTokenMint(connection, wallet, {
      dryRun: config.dryRun,
      mintTokenAmount: config.createBaseToken.mintBaseTokenAmount,
      decimals: config.baseDecimals,
    });
  } else {
    if (!config.baseMint) {
      throw new Error("Missing baseMint in configuration");
    }
    baseMint = new PublicKey(config.baseMint);
  }

  console.log(`- Using base token mint ${baseMint.toString()}`);
  console.log(`- Using quote token mint ${quoteMint.toString()}`);

  /// --------------------------------------------------------------------------
  if (config.dynamicAmm && !config.dlmm) {
    await createPermissionlessDynamicPool(
      config,
      connection,
      wallet,
      baseMint,
      quoteMint,
    );
  } else if (config.dlmm && !config.dynamicAmm) {
    await createPermissionlessDlmmPool(
      config,
      connection,
      wallet,
      baseMint,
      quoteMint,
    );
  } else if (config.dynamicAmm && config.dlmm) {
    throw new Error("Either provide only Dynamic AMM or DLMM configuration");
  } else {
    throw new Error("Must provide Dynamic AMM or DLMM configuration");
  }
}

async function createPermissionlessDynamicPool(
  config: MeteoraConfig,
  connection: Connection,
  wallet: Wallet,
  baseMint: PublicKey,
  quoteMint: PublicKey,
) {
  if (!config.dynamicAmm) {
    throw new Error("Missing dynamic amm configuration");
  }
  console.log("\n> Initializing Permissionless Dynamic AMM pool...");

  const quoteDecimals = getQuoteDecimals(config.quoteSymbol);
  const baseAmount = getAmountInLamports(
    config.dynamicAmm.baseAmount,
    config.baseDecimals,
  );
  const quoteAmount = getAmountInLamports(
    config.dynamicAmm.quoteAmount,
    quoteDecimals,
  );

  console.log(
    `- Using token A amount ${config.dynamicAmm.baseAmount}, in lamports = ${baseAmount}`,
  );
  console.log(
    `- Using token B amount ${config.dynamicAmm.quoteAmount}, in lamports = ${quoteAmount}`,
  );

  const activationType = getDynamicAmmActivationType(
    config.dynamicAmm.activationType,
  );

  const customizeParam: CustomizableParams = {
    tradeFeeNumerator: config.dynamicAmm.tradeFeeNumerator,
    activationType: activationType,
    activationPoint: config.dynamicAmm.activationPoint,
    hasAlphaVault: config.dynamicAmm.hasAlphaVault,
    padding: Array(90).fill(0),
  };
  console.log(
    `- Using tradeFeeNumerator = ${customizeParam.tradeFeeNumerator}`,
  );
  console.log(`- Using activationType = ${config.dynamicAmm.activationType}`);
  console.log(`- Using activationPoint = ${customizeParam.activationPoint}`);
  console.log(`- Using hasAlphaVault = ${customizeParam.hasAlphaVault}`);

  const initPoolTx =
    await AmmImpl.createCustomizablePermissionlessConstantProductPool(
      connection,
      wallet.publicKey,
      baseMint,
      quoteMint,
      baseAmount,
      quoteAmount,
      customizeParam,
    );
  const poolKey = deriveCustomizablePermissionlessConstantProductPoolAddress(
    baseMint,
    quoteMint,
    createProgram(connection).ammProgram.programId,
  );

  console.log(`\n> Pool address: ${poolKey}`);

  if (config.dryRun) {
    console.log(`> Simulating init pool tx...`);
    await runSimulateTransaction(connection, wallet, [initPoolTx]);
  } else {
    console.log(`>> Sending init pool transaction...`);
    const initPoolTxHash = await sendAndConfirmTransaction(
      connection,
      initPoolTx,
      [wallet.payer],
    ).catch((err) => {
      console.error(err);
      throw err;
    });
    console.log(
      `>>> Pool initialized successfully with tx hash: ${initPoolTxHash}`,
    );
  }
}

async function createPermissionlessDlmmPool(
  config: MeteoraConfig,
  connection: Connection,
  wallet: Wallet,
  baseMint: PublicKey,
  quoteMint: PublicKey,
) {
  if (!config.dlmm) {
    throw new Error("Missing DLMM configuration");
  }
  console.log("\n> Initializing Permissionless DLMM pool...");

  const binStep = config.dlmm.binStep;
  const feeBps = config.dlmm.feeBps;
  const hasAlphaVault = config.dlmm.hasAlphaVault;
  const activationPoint = new BN(config.dlmm.activationPoint);

  const activationType = getDlmmActivationType(config.dlmm.activationType);

  console.log(`- Using binStep = ${binStep}`);
  console.log(`- Using feeBps = ${feeBps}`);
  console.log(`- Using initialPrice = ${config.dlmm.initialPrice}`);
  console.log(`- Using activationType = ${config.dlmm.activationType}`);
  console.log(`- Using activationPoint = ${activationPoint}`);
  console.log(`- Using hasAlphaVault = ${hasAlphaVault}`);

  const quoteDecimals = getQuoteDecimals(config.quoteSymbol);

  const initPrice = DLMM.getPricePerLamport(
    config.baseDecimals,
    quoteDecimals,
    config.dlmm.initialPrice,
  );
  let selectiveRounding = false;
  if (config.dlmm.priceRounding == "up") {
    selectiveRounding = false;
  } else if (config.dlmm.priceRounding == "down") {
    selectiveRounding = true;
  } else {
    throw new Error(
      `Unknown price rounding: ${config.dlmm.priceRounding}. Should be 'up' or 'down'`,
    );
  }

  const activateBinId = DLMM.getBinIdFromPrice(
    initPrice,
    binStep,
    selectiveRounding,
  );

  const initPoolTx = await DLMM.createCustomizablePermissionlessLbPair(
    connection,
    new BN(binStep),
    baseMint,
    quoteMint,
    new BN(activateBinId.toString()),
    new BN(feeBps),
    activationType,
    hasAlphaVault,
    wallet.publicKey,
    activationPoint,
    {
      cluster: "mainnet-beta",
    },
  );

  let poolKey: PublicKey;
  [poolKey] = deriveCustomizablePermissionlessLbPair(
    baseMint,
    quoteMint,
    new PublicKey(LBCLMM_PROGRAM_IDS["mainnet-beta"]),
  );

  console.log(`\n> Pool address: ${poolKey}`);

  if (config.dryRun) {
    console.log(`\n> Simulating init pool tx...`);
    await runSimulateTransaction(connection, wallet, [initPoolTx]);
  } else {
    console.log(`>> Sending init pool transaction...`);
    let initPoolTxHash = await sendAndConfirmTransaction(
      connection,
      initPoolTx,
      [wallet.payer],
    ).catch((e) => {
      console.error(e);
      throw e;
    });
    console.log(
      `>>> Pool initialized successfully with tx hash: ${initPoolTxHash}`,
    );
  }
}

main();
