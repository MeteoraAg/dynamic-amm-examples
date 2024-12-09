import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  DEFAULT_COMMITMENT_LEVEL,
  MeteoraConfig,
  safeParseJsonFromFile,
  parseCliArguments,
  getAmountInLamports,
  getQuoteMint,
  getQuoteDecimals,
  safeParseKeypairFromFile,
  runSimulateTransaction,
  getDynamicAmmActivationType,
  getDlmmActivationType,
  FcfsAlphaVaultConfig,
  ProrataAlphaVaultConfig,
  getAlphaVaultWhitelistMode,
  validate_config,
  parseConfigFromCli,
} from ".";
import { AmmImpl } from "@mercurial-finance/dynamic-amm-sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  createProgram,
  deriveCustomizablePermissionlessConstantProductPoolAddress,
} from "@mercurial-finance/dynamic-amm-sdk/src/amm/utils";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { BN } from "bn.js";
import AlphaVault, { PoolType } from "@meteora-ag/alpha-vault";
import { CustomizableParams } from "@mercurial-finance/dynamic-amm-sdk/src/amm/types";
import DLMM, {
  LBCLMM_PROGRAM_IDS,
  deriveCustomizablePermissionlessLbPair,
} from "@meteora-ag/dlmm";
import Decimal from "decimal.js";
import { createTokenMint } from "./create_token_mint";

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
      decimals: config.baseDecimals
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
    hasAlphaVault: config.alphaVault != null,
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

  let initAlphaVaultTx: Transaction | null = null;
  if (config.alphaVault) {
    if (config.alphaVault.alphaVaultType == "fcfs") {
      initAlphaVaultTx = await createFcfsAlphaVault(
        connection,
        wallet,
        PoolType.DYNAMIC,
        poolKey,
        baseMint,
        quoteMint,
        quoteDecimals,
        config.alphaVault as FcfsAlphaVaultConfig,
      );
    } else if (config.alphaVault.alphaVaultType == "prorata") {
      initAlphaVaultTx = await createProrataAlphaVault(
        connection,
        wallet,
        PoolType.DYNAMIC,
        poolKey,
        baseMint,
        quoteMint,
        quoteDecimals,
        config.alphaVault as ProrataAlphaVaultConfig,
      );
    }

    if (!config.dryRun) {
      if (!config.skipCreatePool) {
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

      if (initAlphaVaultTx) {
        console.log(`>> Sending init alpha vault transaction...`);
        const initAlphaVaulTxHash = await sendAndConfirmTransaction(
          connection,
          initAlphaVaultTx,
          [wallet.payer],
        ).catch((err) => {
          console.error(err);
          throw err;
        });
        console.log(
          `>>> Alpha vault initialized successfully with tx hash: ${initAlphaVaulTxHash}`,
        );
      }
    } else {
      if (!config.skipCreatePool) {
        console.log(`> Simulating init pool tx...`);
        await runSimulateTransaction(connection, wallet, [initPoolTx]);
      }

      if (initAlphaVaultTx) {
        console.log(`> Simulating init alpha vault tx...`);
        await runSimulateTransaction(connection, wallet, [initAlphaVaultTx]);
      }
    }
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
  const hasAlphaVault = config.alphaVaultType != null;
  const activationPoint = new BN(config.dlmm.activationPoint);

  const activationType = getDlmmActivationType(config.dlmm.activationType);

  console.log(`- Using binStep = ${binStep}`);
  console.log(`- Using feeBps = ${feeBps}`);
  console.log(`- Using initialPrice = ${config.dlmm.initialPrice}`);
  console.log(`- Using activationType = ${config.dlmm.activationType}`);
  console.log(`- Using activationPoint = ${activationPoint}`);
  console.log(`- Using hasAlphaVault = ${hasAlphaVault}`);

  const quoteDecimals = getQuoteDecimals(config.quoteSymbol);
  const toLamportMultiplier = new Decimal(
    10 ** (config.baseDecimals - quoteDecimals),
  );

  const activateBinId = DLMM.getBinIdFromPrice(
    new Decimal(config.dlmm.initialPrice).mul(toLamportMultiplier),
    binStep,
    false,
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

  let initAlphaVaultTx: Transaction | null = null;
  if (config.alphaVault) {
    if (config.alphaVault.alphaVaultType == "fcfs") {
      initAlphaVaultTx = await createFcfsAlphaVault(
        connection,
        wallet,
        PoolType.DLMM,
        poolKey,
        baseMint,
        quoteMint,
        quoteDecimals,
        config.alphaVault as FcfsAlphaVaultConfig,
      );
    } else if (config.alphaVault.alphaVaultType == "prorata") {
      initAlphaVaultTx = await createProrataAlphaVault(
        connection,
        wallet,
        PoolType.DLMM,
        poolKey,
        baseMint,
        quoteMint,
        quoteDecimals,
        config.alphaVault as ProrataAlphaVaultConfig,
      );
    }
  }

  if (!config.dryRun) {
    if (!config.skipCreatePool) {
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

    if (initAlphaVaultTx) {
      console.log(`>> Sending init alpha vault transaction...`);
      const initAlphaVaulTxHash = await sendAndConfirmTransaction(
        connection,
        initAlphaVaultTx,
        [wallet.payer],
      ).catch((err) => {
        console.error(err);
        throw err;
      });
      console.log(
        `>>> Alpha vault initialized successfully with tx hash: ${initAlphaVaulTxHash}`,
      );
    }
  } else {
    if (!config.skipCreatePool) {
      console.log(`\n> Simulating init pool tx...`);
      await runSimulateTransaction(connection, wallet, [initPoolTx]);
    }

    if (initAlphaVaultTx) {
      console.log(`\n> Simulating init alpha vault tx...`);
      await runSimulateTransaction(connection, wallet, [initAlphaVaultTx]);
    }
  }
}

async function createAndMintToken(
  connection: Connection,
  wallet: Wallet,
  mintDecimals: number,
  mintAmountLamport: BN,
): Promise<PublicKey> {
  const mint = await createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    null,
    mintDecimals,
  );

  const walletTokenATA = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    mint,
    wallet.publicKey,
    true,
  );
  await mintTo(
    connection,
    wallet.payer,
    mint,
    walletTokenATA.address,
    wallet.publicKey,
    mintAmountLamport,
    [],
    {
      commitment: DEFAULT_COMMITMENT_LEVEL,
    },
  );

  return mint;
}

async function createFcfsAlphaVault(
  connection: Connection,
  wallet: Wallet,
  poolType: PoolType,
  poolAddress: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  quoteDecimals: number,
  params: FcfsAlphaVaultConfig,
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
    {
      cluster: "mainnet-beta",
    },
  );
  return tx;
}

async function createProrataAlphaVault(
  connection: Connection,
  wallet: Wallet,
  poolType: PoolType,
  poolAddress: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  quoteDecimals: number,
  params: ProrataAlphaVaultConfig,
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
    {
      cluster: "mainnet-beta",
    },
  );
  return tx;
}

main();
