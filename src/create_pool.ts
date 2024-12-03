import { Connection, PublicKey } from "@solana/web3.js";
import { DEFAULT_COMMITMENT_LEVEL, MeteoraConfig, safeParseJsonFromFile, parseKeypairFromSecretKey, parseCliArguments, getDecimalizedAmount } from ".";
import { AmmImpl } from "@mercurial-finance/dynamic-amm-sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { createProgram, deriveCustomizablePermissionlessConstantProductPoolAddress } from "@mercurial-finance/dynamic-amm-sdk/src/amm/utils";
import { NATIVE_MINT, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { BN } from "bn.js";
import { ActivationType } from "@meteora-ag/alpha-vault";
import { CustomizableParams } from "@mercurial-finance/dynamic-amm-sdk/src/amm/types";

async function main() {

  const cliArguments = parseCliArguments();
  if (!cliArguments.config) {
    throw new Error("Please provide a config file path to --config flag");
  }
  const configFilePath = cliArguments.config!;
  console.log(`> Using config file: ${configFilePath}`);

  let config: MeteoraConfig = safeParseJsonFromFile(configFilePath);
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Private key not provided in environment variables");
  }
  let keypair = parseKeypairFromSecretKey(process.env.PRIVATE_KEY!); 

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
  let quoteMint = new PublicKey(config.quoteMint);

  if (config.createBaseToken && !config.dryRun) {
    console.log('\n> Minting base token...');
    if (!config.mintBaseTokenAmountLamport) {
      throw new Error("Missing mintBaseTokenAmountLamport in configuration");
    }
    const baseMintAmount = new BN(config.mintBaseTokenAmountLamport); 

    baseMint = await createAndMintToken(connection, wallet, config.baseDecimals, baseMintAmount);

    console.log(`>> Mint ${getDecimalizedAmount(baseMintAmount, config.baseDecimals)} token to payer wallet`);
  }  
  
  console.log(`- Using base token mint ${baseMint.toString()}`);
  console.log(`- Using quote token mint ${quoteMint.toString()}`);

  /// --------------------------------------------------------------------------
  if (config.dynamicAmm) {
    await createPermissionlessDynamicPool(config, connection, wallet, baseMint, quoteMint);
  }
}

async function createPermissionlessDynamicPool(config: MeteoraConfig, connection: Connection, wallet: Wallet, baseMint: PublicKey, quoteMint: PublicKey) {
  if (!config.dynamicAmm) {
    throw new Error("Missing dynamic amm configuration");
  }
  console.log("\n> Initializing Permissionless Dynamic AMM pool...");

  const baseAmount = new BN(config.dynamicAmm.baseAmountLamport);
  const quoteAmount = new BN(config.dynamicAmm.quoteAmountLamport);

  console.log(`- Using token A amount ${getDecimalizedAmount(baseAmount, config.baseDecimals)}`);
  console.log(`- Using token B amount ${getDecimalizedAmount(quoteAmount, config.quoteDecimals)}`);

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

  const initalizeTx = await AmmImpl.createCustomizablePermissionlessConstantProductPool(
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
    initalizeTx.sign(wallet.payer);

    console.log(`>> Sending transaction...`);
    const txHash = await connection.sendRawTransaction(initalizeTx.serialize());
    await connection.confirmTransaction(txHash, DEFAULT_COMMITMENT_LEVEL);

    console.log(`>>> Pool initialized successfully with tx hash: ${txHash}`);
  }
}

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