import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
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
  parseConfigFromCli,
} from ".";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import DLMM, {
  LBCLMM_PROGRAM_IDS,
  deriveCustomizablePermissionlessLbPair,
} from "@meteora-ag/dlmm";
import BN from "bn.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

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
  const DLMM_PROGRAM_ID = new PublicKey(LBCLMM_PROGRAM_IDS["mainnet-beta"]);

  if (!config.baseMint) {
    throw new Error("Missing baseMint in configuration");
  }
  const baseMint = new PublicKey(config.baseMint);
  let quoteMint = getQuoteMint(config.quoteSymbol);
  const quoteDecimals = getQuoteDecimals(config.quoteSymbol);

  console.log(`- Using base token mint ${baseMint.toString()}`);
  console.log(`- Using quote token mint ${quoteMint.toString()}`);

  let poolKey: PublicKey;
  [poolKey] = deriveCustomizablePermissionlessLbPair(
    baseMint,
    quoteMint,
    DLMM_PROGRAM_ID,
  );
  console.log(`- Using pool key ${poolKey.toString()}`);

  if (!config.singleBinSeedLiquidity) {
    throw new Error(`Missing DLMM Single bin seed liquidity in configuration`);
  }

  const pair = await DLMM.create(connection, poolKey, {
    cluster: "mainnet-beta",
  });

  const seedAmount = getAmountInLamports(
    config.singleBinSeedLiquidity.seedAmount,
    config.baseDecimals,
  );
  const priceRounding = config.singleBinSeedLiquidity.priceRounding;
  if (priceRounding != "up" && priceRounding != "down") {
    throw new Error("Invalid selective rounding value. Must be 'up' or 'down'");
  }
  const baseKeypair = safeParseKeypairFromFile(
    config.singleBinSeedLiquidity.basePositionKeypairFilepath,
  );
  const operatorKeypair = safeParseKeypairFromFile(config.singleBinSeedLiquidity.operatorKeypairFilepath);
  const basePublickey = baseKeypair.publicKey;
  const price = config.singleBinSeedLiquidity.price;
  const feeOwner = new PublicKey(config.singleBinSeedLiquidity.feeOwner);
  const operator = operatorKeypair.publicKey;
  const lockReleasePoint = new BN(
    config.singleBinSeedLiquidity.lockReleasePoint,
  );

  console.log(`- Using seedAmount in lamports = ${seedAmount}`);
  console.log(`- Using priceRounding = ${priceRounding}`);
  console.log(`- Using price ${price}`);
  console.log(`- Using feeOwner ${feeOwner}`);
  console.log(`- Using operator ${operator}`);
  console.log(`- Using lockReleasePoint ${lockReleasePoint}`);

  // create operator_token_x account if not existed
  // const operatorTokenXInfo = await getOrCreateAssociatedTokenAccount(
  //   connection,
  //   wallet.payer,
  //   baseMint,
  //   operatorKeypair.publicKey,
  //   false,
  //   "confirmed",
  //   {
  //     commitment: "confirmed",
  //   },
  //   TOKEN_PROGRAM_ID,
  //   ASSOCIATED_TOKEN_PROGRAM_ID
  // );

  // console.log(operatorTokenXInfo);
  // console.log(operatorTokenXInfo.amount == BigInt(0));

  const seedLiquidityIxs = await pair.seedLiquiditySingleBin(
    wallet.publicKey,
    basePublickey,
    seedAmount,
    price,
    priceRounding == "up",
    feeOwner,
    operator,
    lockReleasePoint,
  );

  const setCUPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: config.computeUnitPriceMicroLamports,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: keypair.publicKey,
    blockhash,
    lastValidBlockHeight,
  })
    .add(setCUPriceIx)
    .add(...seedLiquidityIxs);

  if (config.dryRun) {
    console.log(`\n> Simulating seedLiquiditySingleBin transaction...`);
    await runSimulateTransaction(
      connection,
      [wallet.payer, baseKeypair, operatorKeypair],
      wallet.publicKey,
      [tx],
    );
  } else {
    console.log(`>> Sending seedLiquiditySingleBin transaction...`);
    const txHash = await sendAndConfirmTransaction(connection, tx, [
      wallet.payer,
      baseKeypair,
      operatorKeypair,
    ]).catch((err) => {
      console.error(err);
      throw err;
    });
    console.log(
      `>>> SeedLiquiditySingleBin successfully with tx hash: ${txHash}`,
    );
  }
}

main();
