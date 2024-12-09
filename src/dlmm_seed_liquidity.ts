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
  getDynamicAmmActivationType,
  getDlmmActivationType,
  parseConfigFromCli,
} from ".";
import { AmmImpl } from "@mercurial-finance/dynamic-amm-sdk";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  createProgram,
  deriveCustomizablePermissionlessConstantProductPoolAddress,
} from "@mercurial-finance/dynamic-amm-sdk/src/amm/utils";
import { BN } from "bn.js";
import { CustomizableParams } from "@mercurial-finance/dynamic-amm-sdk/src/amm/types";
import DLMM, {
  LBCLMM_PROGRAM_IDS,
  deriveCustomizablePermissionlessLbPair,
  getBinArrayLowerUpperBinId,
  getPriceOfBinByBinId,
} from "@meteora-ag/dlmm";
import Decimal from "decimal.js";
import { createTokenMint } from "./libs/create_token_mint";

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
    new PublicKey(LBCLMM_PROGRAM_IDS["mainnet-beta"]),
  );

  if (!config.dlmmSeedLiquidity) {
    throw new Error(`Missing DLMM seed liquidity in configuration`);
  }

  const pair = await DLMM.create(connection, poolKey, {
    cluster: "mainnet-beta",
  });

  const seedAmount = getAmountInLamports(
    config.dlmmSeedLiquidity.seedAmount,
    config.baseDecimals,
  );
  const curvature = config.dlmmSeedLiquidity.curvature;
  const minPrice = config.dlmmSeedLiquidity.minPrice;
  const maxPrice = config.dlmmSeedLiquidity.maxPrice;
  const baseKeypair = Keypair.generate();

  const { initializeBinArraysAndPositionIxs, addLiquidityIxs } =
    await pair.seedLiquidity(
      keypair.publicKey,
      seedAmount,
      curvature,
      minPrice,
      maxPrice,
      baseKeypair.publicKey,
    );

  // Initialize all bin array and position, transaction order can be in sequence or not
  {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    const transactions = [];

    for (const groupIx of initializeBinArraysAndPositionIxs) {
      const tx = new Transaction({
        feePayer: keypair.publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(...groupIx);

      const signers = [keypair, baseKeypair];

      transactions.push(sendAndConfirmTransaction(connection, tx, signers));
    }

    await Promise.all(transactions)
      .then((txs) => {
        txs.map(console.log);
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
  }

  const beforeTokenXBalance = await connection
    .getTokenAccountBalance(wallet.publicKey)
    .then((i) => new BN(i.value.amount));

  {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const transactions = [];

    // Deposit to positions created in above step. The add liquidity order can be in sequence or not.
    for (const groupIx of addLiquidityIxs) {
      const tx = new Transaction({
        feePayer: keypair.publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(...groupIx);

      const signers = [keypair];

      transactions.push(sendAndConfirmTransaction(connection, tx, signers));
    }

    await Promise.all(transactions)
      .then((txs) => {
        txs.map(console.log);
      })
      .catch((e) => {
        console.error(e);
        throw e;
      });
  }

  const afterTokenXBalance = await connection
    .getTokenAccountBalance(wallet.publicKey)
    .then((i) => new BN(i.value.amount));

  const actualDepositedAmount = beforeTokenXBalance.sub(afterTokenXBalance);
  if (actualDepositedAmount.toString() != seedAmount.toString()) {
    throw new Error(
      `actual deposited amount ${actualDepositedAmount} is not equal to seed amount ${seedAmount}`,
    );
  }

  let binArrays = await pair.getBinArrays();
  binArrays = binArrays.sort((a, b) => a.account.index.cmp(b.account.index));

  const binLiquidities = binArrays
    .map((ba) => {
      const [lowerBinId, upperBinId] = getBinArrayLowerUpperBinId(
        ba.account.index,
      );
      const binWithLiquidity: [number, number][] = [];
      for (let i = lowerBinId.toNumber(); i <= upperBinId.toNumber(); i++) {
        const binAmountX = ba.account.bins[i - lowerBinId.toNumber()].amountX;
        const binPrice = getPriceOfBinByBinId(i, pair.lbPair.binStep);
        const liquidity = new Decimal(binAmountX.toString())
          .mul(binPrice)
          .floor()
          .toNumber();
        binWithLiquidity.push([i, liquidity]);
      }
      return binWithLiquidity;
    })
    .flat();

  console.log(binLiquidities.filter((b) => b[1] > 0).reverse());
  console.log(binLiquidities.filter((b) => b[1] > 0));

  // use babar to print chart in console if needed
  // console.log(babar(binLiquidities));
}

main();
