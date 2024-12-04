import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { DEFAULT_COMMITMENT_LEVEL, MeteoraConfig, safeParseJsonFromFile, parseKeypairFromSecretKey, parseCliArguments, getDecimalizedAmount, getAmountInLamports, getQuoteMint, getQuoteDecimals, safeParseKeypairFromFile } from ".";
import { AmmImpl } from "@mercurial-finance/dynamic-amm-sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { createProgram, deriveCustomizablePermissionlessConstantProductPoolAddress } from "@mercurial-finance/dynamic-amm-sdk/src/amm/utils";
import { NATIVE_MINT, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { BN } from "bn.js";
import { ActivationType } from "@meteora-ag/alpha-vault";
import { CustomizableParams } from "@mercurial-finance/dynamic-amm-sdk/src/amm/types";
import DLMM, { LBCLMM_PROGRAM_IDS, deriveCustomizablePermissionlessLbPair } from "@meteora-ag/dlmm";
import { ActivationType as DlmmActivationType } from "@meteora-ag/dlmm";
import Decimal from "decimal.js";
import { simulateTransaction } from "@coral-xyz/anchor/dist/cjs/utils/rpc";

async function main() {
  const cliArguments = parseCliArguments();
  if (!cliArguments.config) {
    throw new Error("Please provide a config file path to --config flag");
  }
  const configFilePath = cliArguments.config!;
  console.log(`> Using config file: ${configFilePath}`);

  let config: MeteoraConfig = safeParseJsonFromFile(configFilePath);

  console.log(`> Using keypair file path ${config.keypairFilePath}`);
  let keypair = safeParseKeypairFromFile(config.keypairFilePath);

  console.log('\n> Initializing with general configuration...')
  console.log(`- Using RPC URL ${config.rpcUrl}`);
  console.log(`- Dry run = ${config.dryRun}`);
  console.log(`- Using payer ${keypair.publicKey} to execute commands`);

  const connection = new Connection(config.rpcUrl, DEFAULT_COMMITMENT_LEVEL);
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: connection.commitment
  });

  let baseMint = new PublicKey(config.baseMint);
  let quoteMint = getQuoteMint(config.quoteSymbol);

  if (config.createBaseToken && !config.dryRun) {
    console.log('\n> Minting base token...');
    if (!config.mintBaseTokenAmount) {
      throw new Error("Missing mintBaseTokenAmount in configuration");
    }
    const baseMintAmount = getAmountInLamports(config.mintBaseTokenAmount, config.baseDecimals);

    baseMint = await createAndMintToken(connection, wallet, config.baseDecimals, baseMintAmount);

    console.log(`>> Mint ${config.mintBaseTokenAmount} token to payer wallet`);
  }

  console.log(`- Using base token mint ${baseMint.toString()}`);
  console.log(`- Using quote token mint ${quoteMint.toString()}`);

  /// --------------------------------------------------------------------------
  if (config.dynamicAmm && !config.dlmm) {
    await createPermissionlessDynamicPool(config, connection, wallet, baseMint, quoteMint);
  } else if (config.dlmm && !config.dynamicAmm) {
    await createPermissionlessDlmmPool(config, connection, wallet, baseMint, quoteMint);
  } else if (config.dynamicAmm && config.dlmm) {
    throw new Error("Either provide only Dynamic AMM or DLMM configuration");
  } else {
    throw new Error("Must provide Dynamic AMM or DLMM configuration");
  }
}

async function createPermissionlessDynamicPool(config: MeteoraConfig, connection: Connection, wallet: Wallet, baseMint: PublicKey, quoteMint: PublicKey) {
  if (!config.dynamicAmm) {
    throw new Error("Missing dynamic amm configuration");
  }
  console.log("\n> Initializing Permissionless Dynamic AMM pool...");

  const quoteDecimals = getQuoteDecimals(config.quoteSymbol);
  const baseAmount = getAmountInLamports(config.dynamicAmm.baseAmount, config.baseDecimals);
  const quoteAmount = getAmountInLamports(config.dynamicAmm.quoteAmount, quoteDecimals);

  console.log(`- Using token A amount ${config.dynamicAmm.baseAmount}, in lamports = ${baseAmount}`);
  console.log(`- Using token B amount ${config.dynamicAmm.quoteAmount}, in lamports = ${quoteAmount}`);

  let activationType = ActivationType.TIMESTAMP;
  if (config.dynamicAmm.activationType == "timestamp") {
    activationType = ActivationType.TIMESTAMP;
  } else if (config.dynamicAmm.activationType == "slot") {
    activationType = ActivationType.SLOT;
  } else {
    throw new Error(`Invalid activation type ${config.dynamicAmm.activationType}`);
  }

  const customizeParam: CustomizableParams = {
    tradeFeeNumerator: config.dynamicAmm.tradeFeeNumerator,
    activationType: activationType,
    activationPoint: config.dynamicAmm.activationPoint,
    hasAlphaVault: config.dynamicAmm.hasAlphaVault,
    padding: Array(90).fill(0)
  };
  console.log(`- Using tradeFeeNumerator = ${customizeParam.tradeFeeNumerator}`);
  console.log(`- Using activationType = ${config.dynamicAmm.activationType}`);
  console.log(`- Using activationPoint = ${customizeParam.activationPoint}`);
  console.log(`- Using hasAlphaVault = ${customizeParam.hasAlphaVault}`);

  const rawTx = await AmmImpl.createCustomizablePermissionlessConstantProductPool(
    connection,
    wallet.publicKey,
    baseMint,
    quoteMint,
    baseAmount,
    quoteAmount,
    customizeParam
  );
  const poolKey = deriveCustomizablePermissionlessConstantProductPoolAddress(
    baseMint,
    quoteMint,
    createProgram(connection).ammProgram.programId,
  );

  console.log(`\n> Pool address: ${poolKey}`);

  if (!config.dryRun) {
    console.log(`>> Sending transaction...`);
    const txHash = await sendAndConfirmTransaction(connection, rawTx, [
      wallet.payer,
    ]).catch(err => {
      console.error(err);
      throw err;
    });
    console.log(`>>> Pool initialized successfully with tx hash: ${txHash}`);
  } else {
    const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: wallet.publicKey,
    }).add(rawTx);

    let simulateResp = await simulateTransaction(connection, transaction, [wallet.payer]);
    if (simulateResp.value.err) {
      console.error("Simulate transaction failed:", simulateResp.value.err);
      throw simulateResp.value.err;
    }

    console.log(">>> Simulating init pool transaction succeeded");
  }
}

async function createPermissionlessDlmmPool(config: MeteoraConfig, connection: Connection, wallet: Wallet, baseMint: PublicKey, quoteMint: PublicKey) {
  if (!config.dlmm) {
    throw new Error("Missing DLMM configuration");
  }
  console.log("\n> Initializing Permissionless DLMM pool...");

  const binStep = config.dlmm.binStep;
  const feeBps = config.dlmm.feeBps;
  const hasAlphaVault = config.dlmm.hasAlphaVault;
  const activationPoint = config.dlmm.activationPoint;

  let activationType = DlmmActivationType.Timestamp;
  if (config.dlmm.activationType == "timestamp") {
    activationType = DlmmActivationType.Timestamp;
  } else if (config.dlmm.activationType == "slot") {
    activationType = DlmmActivationType.Slot;
  } else {
    throw new Error(`Invalid activation type ${config.dlmm.activationType}`);
  }

  console.log(`- Using binStep = ${binStep}`);
  console.log(`- Using feeBps = ${feeBps}`);
  console.log(`- Using minPrice = ${config.dlmm.minPrice}`);
  console.log(`- Using activationType = ${config.dlmm.activationType}`);
  console.log(`- Using activationPoint = ${config.dlmm.activationPoint}`);
  console.log(`- Using hasAlphaVault = ${config.dlmm.hasAlphaVault}`);

  const quoteDecimals = getQuoteDecimals(config.quoteSymbol);
  const toLamportMultiplier = new Decimal(10 ** (config.baseDecimals - quoteDecimals));

  const minBinId = DLMM.getBinIdFromPrice(
    new Decimal(config.dlmm.minPrice).mul(toLamportMultiplier),
    binStep,
    false
  );

  const rawTx = await DLMM.createCustomizablePermissionlessLbPair(
    connection, new BN(binStep), baseMint, quoteMint, new BN(minBinId.toString()), new BN(feeBps), activationType, hasAlphaVault, wallet.publicKey, activationPoint, {
    cluster: "mainnet-beta"
  }
  )

  let pairKey: PublicKey;
  [pairKey] = deriveCustomizablePermissionlessLbPair(baseMint, quoteMint, new PublicKey(LBCLMM_PROGRAM_IDS["mainnet-beta"]));

  console.log(`\n> Pool address: ${pairKey}`);

  if (!config.dryRun) {
    console.log(`>> Sending transaction...`);
    let txHash = await sendAndConfirmTransaction(connection, rawTx, [
      wallet.payer,
    ]).catch((e) => {
      console.error(e);
      throw e;
    });
    console.log(`>>> Pool initialized successfully with tx hash: ${txHash}`);
  } else {
    const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: wallet.publicKey,
    }).add(rawTx);

    let simulateResp = await simulateTransaction(connection, transaction, [wallet.payer]);
    console.log(simulateResp);
    if (simulateResp.value.err) {
      console.error("Simulate transaction failed:", simulateResp.value.err);
      throw simulateResp.value.err;
    }
    console.log(">>> Simulating init pool transaction succeeded");
  }
}

// async function seedLiquidity

async function createAndMintToken(connection: Connection, wallet: Wallet, mintDecimals: number, mintAmountLamport: BN): Promise<PublicKey> {
  const mint = await createMint(connection, wallet.payer, wallet.publicKey, null, mintDecimals);

  const walletTokenATA = await getOrCreateAssociatedTokenAccount(connection, wallet.payer, mint, wallet.publicKey, true);
  await mintTo(
    connection, wallet.payer, mint, walletTokenATA.address, wallet.publicKey, mintAmountLamport, [], {
    commitment: DEFAULT_COMMITMENT_LEVEL
  }
  )

  return mint;
}

main();