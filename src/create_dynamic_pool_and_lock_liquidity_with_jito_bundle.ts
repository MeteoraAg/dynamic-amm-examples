
import { bundle } from "jito-ts";

import { convertToVersionedTransaction, sendBundle } from "./libs/jito_bundle";
import { DEFAULT_COMMITMENT_LEVEL, MeteoraConfig, createPermissionlessDynamicPoolTx, createTokenMint, getAmountInLamports, getQuoteDecimals, getQuoteMint, parseConfigFromCli, safeParseKeypairFromFile } from ".";
import { Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import sqrt from "bn-sqrt";
import AmmImpl from "@mercurial-finance/dynamic-amm-sdk";
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


  if (!config.baseMint) {
    throw new Error("Missing baseMint in configuration");
  }

  if (!config.dynamicAmm) {
    throw new Error("Missing dynamicAmm configuration");
  }

  if (!config.lockLiquidity) {
    throw new Error("Missing lockLiquidity configuration");
  }

  if (!config.tipAmount) {
    throw new Error("Missing tipAmount in configuration");
  }

  let baseMint = new PublicKey(config.baseMint);
  let quoteMint = getQuoteMint(config.quoteSymbol);

  console.log(`- Using base token mint ${baseMint.toString()}`);
  console.log(`- Using quote token mint ${quoteMint.toString()}`);

  const quoteDecimals = getQuoteDecimals(config.quoteSymbol);
  const baseMintAccount = await getMint(connection, baseMint);
  const baseDecimals = baseMintAccount.decimals;

  const baseAmount = getAmountInLamports(
    config.dynamicAmm.baseAmount,
    baseDecimals,
  );
  const quoteAmount = getAmountInLamports(
    config.dynamicAmm.quoteAmount,
    quoteDecimals,
  );

  const CONFIG_ADDRESS = new PublicKey('GnfMQ8oPzq84oK4PxTjhC1aUEMrLLasDfF9LsmW46U7j');
  const txs = await AmmImpl.createPermissionlessConstantProductMemecoinPoolWithConfig(
    connection,
    wallet.publicKey,
    baseMint,
    quoteMint,
    baseAmount,
    quoteAmount,
    CONFIG_ADDRESS,
    {
      isMinted: true
    },
    {
      lockLiquidity: true
    }
  );

  const jitoBundle = new bundle.Bundle([], 5); // init with 0 txs, expecting 3 to be added (+1 for the tip)
  for (const tx of txs) {
    jitoBundle.addTransactions(convertToVersionedTransaction(tx, [wallet.payer]));
  }
  const bundleTx = await sendBundle(jitoBundle, "mainnet.block-engine.jito.wtf", wallet.payer, config.rpcUrl, config.dryRun, config.tipAmount); // optionally add another arg to process result (res) => void

}

main();