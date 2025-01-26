
import { bundle } from "jito-ts";

import { convertToVersionedTransaction, sendBundle } from "./libs/jito_bundle";
import { DEFAULT_COMMITMENT_LEVEL, MeteoraConfig, createPermissionlessDynamicPoolTx, createTokenMint, getQuoteMint, parseConfigFromCli, safeParseKeypairFromFile } from ".";
import { Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { createLockLiquidityTxs } from "./libs/lock_liquidity_utils";
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

  let baseMint: PublicKey;
  let quoteMint = getQuoteMint(config.quoteSymbol);

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

  console.log(`- Using base token mint ${baseMint.toString()}`);
  console.log(`- Using quote token mint ${quoteMint.toString()}`);

  const createPoolTx = await createPermissionlessDynamicPoolTx(
    config,
    connection,
    wallet,
    baseMint,
    quoteMint,
  );

  const lockLiquidityTxs = await createLockLiquidityTxs(
    connection,
    wallet,
    baseMint,
    quoteMint,
    config.lockLiquidity,
  );

  if (lockLiquidityTxs.length > 3) {
    throw new Error("Only support up to 3 lockLiquidity tx");
  }

  const jitoBundle = new bundle.Bundle([], 5); // init with 0 txs, expecting 3 to be added (+1 for the tip)
  jitoBundle.addTransactions(convertToVersionedTransaction(createPoolTx, [wallet.payer]));
  for (const tx of lockLiquidityTxs) {
    jitoBundle.addTransactions(convertToVersionedTransaction(tx, [wallet.payer]));
  }
  const bundleTx = await sendBundle(jitoBundle, "mainnet.block-engine.jito.wtf", wallet.payer, config.rpcUrl, config.dryRun, config.tipAmount); // optionally add another arg to process result (res) => void

}

main();