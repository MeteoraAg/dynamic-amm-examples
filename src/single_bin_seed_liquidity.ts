import {
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
import { BN } from "bn.js";
import DLMM, {
  LBCLMM_PROGRAM_IDS,
  binIdToBinArrayIndex,
  computeBudgetIx,
  deriveBinArray,
  deriveBinArrayBitmapExtension,
  deriveCustomizablePermissionlessLbPair,
  derivePosition,
  getBinArrayLowerUpperBinId,
  getPriceOfBinByBinId,
  isOverflowDefaultBinArrayBitmap,
} from "@meteora-ag/dlmm";
import Decimal from "decimal.js";
import { getMint } from "@solana/spl-token";

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
  const baseMintAccount = await getMint(connection, baseMint);
  const baseDecimals = baseMintAccount.decimals;

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
    baseDecimals,
  );
  const selectiveRounding = config.singleBinSeedLiquidity.selectiveRounding;
  if (selectiveRounding != "up" && selectiveRounding != "down") {
    throw new Error("Invalid selective rounding value. Must be 'up' or 'down'");
  }
  const basePositionKey = new PublicKey(
    config.singleBinSeedLiquidity.basePositionKey,
  );
  const baseKeypair = safeParseKeypairFromFile(
    config.singleBinSeedLiquidity.basePositionKeypairFilepath,
  );
}

function price_per_token_per_lamport(
  price: number,
  baseDecimals: number,
  quoteDecimals: number,
): BN {
  const priceD = new Decimal(price);
  const pricePerToken = priceD
    .mul(new Decimal(10 ** quoteDecimals))
    .div(new Decimal(10 ** baseDecimals));
  return new BN(pricePerToken.toString());
}

main();
