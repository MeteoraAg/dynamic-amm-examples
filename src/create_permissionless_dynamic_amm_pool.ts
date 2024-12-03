import { Connection, PublicKey } from "@solana/web3.js";
import { DEFAULT_COMMITMENT_LEVEL, MeteoraConfig, safeParseJsonFromFile, parseKeypairFromSecretKey, parseCliArguments } from ".";
import { AmmImpl } from "@mercurial-finance/dynamic-amm-sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { createMint, createProgram, deriveCustomizablePermissionlessConstantProductPoolAddress } from "@mercurial-finance/dynamic-amm-sdk/src/amm/utils";
import { NATIVE_MINT } from "@solana/spl-token";
import { BN } from "bn.js";
import { ActivationType } from "@meteora-ag/alpha-vault";
import { CustomizableParams } from "@mercurial-finance/dynamic-amm-sdk/src/amm/types";

const DEFAULT_CONFIG_FILE_PATH = "./meteora_config.json";

async function main() {
  console.log("Creating Permissionless Dynamic AMM pool...");

  const cliArguments = parseCliArguments();
  let configFilePath = DEFAULT_CONFIG_FILE_PATH;
  if (cliArguments.config) {
    configFilePath = cliArguments.config!;
  }
  console.log(`> Using config file: ${configFilePath}`);

  let config: MeteoraConfig = safeParseJsonFromFile(configFilePath);
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Private key not provided in environment variables");
  }
  let keypair = parseKeypairFromSecretKey(process.env.PRIVATE_KEY!); 

  console.log('Initializing with configuration...')
  console.log(`- Using RPC URL ${config.rpcUrl}`);
  console.log(`- Dry run = ${config.dryRun}`);
  console.log(`- Using payer ${keypair.publicKey} to execute commands`);

  const connection = new Connection(config.rpcUrl, DEFAULT_COMMITMENT_LEVEL);
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: connection.commitment
  });

  if (!config.dynamicAmm) {
    throw new Error("Missing dynamic_amm configuration");
  }
 
  let tokenA: PublicKey;
  if (config.dynamicAmm.createToken == true) {
    throw new Error("Minting new token not supported");
  } else {
    if (!config.dynamicAmm.tokenAAddress == null) {
      throw new Error("Token address not provided in configuration file");
    }
    tokenA = new PublicKey(config.dynamicAmm.tokenAAddress!);
  }

  console.log(`- Using token A address ${tokenA.toString()}`);
  console.log(`- Using token B address ${NATIVE_MINT.toString()}`);

  const tokenAAmount = new BN(config.dynamicAmm.tokenAAmount);
  const tokenBAmount = new BN(config.dynamicAmm.tokenBAmount);

  console.log(`- Using token A amount ${tokenAAmount.toString()}`);
  console.log(`- Using token B amount ${tokenBAmount.toString()}`);

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
    tokenA,
    NATIVE_MINT,
    tokenAAmount,
    tokenBAmount,
    customizeParam
  );
  const poolKey = deriveCustomizablePermissionlessConstantProductPoolAddress(
    tokenA,
    NATIVE_MINT,
    createProgram(connection).ammProgram.programId,
  );

  console.log(`> Pool address: ${poolKey}`);

  if (!config.dryRun) {
    initalizeTx.sign(wallet.payer);

    console.log(`>> Sending transaction...`);
    const txHash = await connection.sendRawTransaction(initalizeTx.serialize());
    await connection.confirmTransaction(txHash, "finalized");

    console.log(`>>> Pool initialized successfully with tx hash: ${txHash}`);
  }

}

main();