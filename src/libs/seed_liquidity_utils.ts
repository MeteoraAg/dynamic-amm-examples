import {
  Cluster,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { DEFAULT_ADD_LIQUIDITY_CU, runSimulateTransaction } from "./utils";
import { BN } from "bn.js";
import DLMM, {
  CompressedBinDepositAmounts,
  MAX_BIN_PER_POSITION,
  PositionV2,
  binIdToBinArrayIndex,
  deriveBinArray,
  deriveCustomizablePermissionlessLbPair,
  derivePosition,
  getEstimatedComputeUnitIxWithBuffer,
  getOrCreateATAInstruction,
} from "@meteora-ag/dlmm";
import {
  compressBinAmount,
  distributeAmountToCompressedBinsByRatio,
  generateAmountForBinRange,
  getPositionCount,
} from "./math";
import {
  getAssociatedTokenAddressSync,
  AccountLayout,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

export async function seedLiquiditySingleBin(
  connection: Connection,
  payerKeypair: Keypair,
  baseKeypair: Keypair,
  operatorKeypair: Keypair,
  positionOwner: PublicKey,
  feeOwner: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  dlmm_program_id: PublicKey,
  seedAmount: BN,
  price: number,
  priceRounding: string,
  lockReleasePoint: BN,
  seedTokenXToPositionOwner: boolean,
  dryRun: boolean,
  computeUnitPriceMicroLamports: number | bigint,
  opts?: {
    cluster?: Cluster | "localhost";
  },
) {
  if (priceRounding != "up" && priceRounding != "down") {
    throw new Error("Invalid selective rounding value. Must be 'up' or 'down'");
  }

  let poolKey: PublicKey;
  [poolKey] = deriveCustomizablePermissionlessLbPair(
    baseMint,
    quoteMint,
    dlmm_program_id,
  );
  console.log(`- Using pool key ${poolKey.toString()}`);
  const pair = await DLMM.create(connection, poolKey, {
    cluster: opts?.cluster ?? "mainnet-beta",
  });

  console.log(`- Using seedAmount in lamports = ${seedAmount}`);
  console.log(`- Using priceRounding = ${priceRounding}`);
  console.log(`- Using price ${price}`);
  console.log(`- Using operator ${operatorKeypair.publicKey}`);
  console.log(`- Using positionOwner ${positionOwner}`);
  console.log(`- Using feeOwner ${feeOwner}`);
  console.log(`- Using lockReleasePoint ${lockReleasePoint}`);
  console.log(`- Using seedTokenXToPositionOwner ${seedTokenXToPositionOwner}`);

  if (!seedTokenXToPositionOwner) {
    console.log(
      `WARNING: You selected seedTokenXToPositionOwner = false, you should manually send 1 lamport of token X to the position owner account to prove ownership.`,
    );
  }

  const seedLiquidityIxs = await pair.seedLiquiditySingleBin(
    payerKeypair.publicKey,
    baseKeypair.publicKey,
    seedAmount,
    price,
    priceRounding == "up",
    positionOwner,
    feeOwner,
    operatorKeypair.publicKey,
    lockReleasePoint,
    seedTokenXToPositionOwner,
  );

  const setCUPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: computeUnitPriceMicroLamports,
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: payerKeypair.publicKey,
    blockhash,
    lastValidBlockHeight,
  })
    .add(setCUPriceIx)
    .add(...seedLiquidityIxs);

  if (dryRun) {
    console.log(`\n> Simulating seedLiquiditySingleBin transaction...`);
    await runSimulateTransaction(
      connection,
      [payerKeypair, baseKeypair, operatorKeypair],
      payerKeypair.publicKey,
      [tx],
    );
  } else {
    console.log(`>> Sending seedLiquiditySingleBin transaction...`);
    const txHash = await sendAndConfirmTransaction(connection, tx, [
      payerKeypair,
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

export async function seedLiquidityLfg(
  connection: Connection,
  payerKeypair: Keypair,
  baseKeypair: Keypair,
  operatorKeypair: Keypair,
  positionOwner: PublicKey,
  feeOwner: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  dlmm_program_id: PublicKey,
  seedAmount: BN,
  curvature: number,
  minPricePerLamport: BN,
  maxPricePerLamport: BN,
  lockReleasePoint: BN,
  seedTokenXToPositionOwner: boolean,
  dryRun: boolean,
  computeUnitPriceMicroLamports: number | bigint,
  opts?: {
    cluster?: Cluster | "localhost";
  },
) {
  let cluster = opts?.cluster ?? "mainnet-beta";

  let poolKey: PublicKey;
  [poolKey] = deriveCustomizablePermissionlessLbPair(
    baseMint,
    quoteMint,
    dlmm_program_id,
  );
  console.log(`- Using pool key ${poolKey.toString()}`);

  const pair = await DLMM.create(connection, poolKey, {
    cluster: opts?.cluster ?? "mainnet-beta",
  });
  await pair.refetchStates();

  console.log(`- Using seedAmount in lamports = ${seedAmount}`);
  console.log(`- Using curvature = ${curvature}`);
  console.log(`- Using minPrice per lamport ${minPricePerLamport}`);
  console.log(`- Using maxPrice per lamport ${maxPricePerLamport}`);
  console.log(`- Using operator ${operatorKeypair.publicKey}`);
  console.log(`- Using positionOwner ${positionOwner}`);
  console.log(`- Using feeOwner ${feeOwner}`);
  console.log(`- Using lockReleasePoint ${lockReleasePoint}`);
  console.log(`- Using seedTokenXToPositionOwner ${seedTokenXToPositionOwner}`);

  if (!seedTokenXToPositionOwner) {
    console.log(
      `WARNING: You selected seedTokenXToPositionOwner = false, you should manually send 1 lamport of token X to the position owner account to prove ownership.`,
    );
  }

  const minBinId = new BN(
    DLMM.getBinIdFromPrice(minPricePerLamport, pair.lbPair.binStep, false),
  );
  const maxBinId = new BN(
    DLMM.getBinIdFromPrice(maxPricePerLamport, pair.lbPair.binStep, true),
  );

  if (minBinId.toNumber() < pair.lbPair.activeId) {
    throw new Error("minPrice < current pair price");
  }

  if (minBinId.toNumber() > maxBinId.toNumber()) {
    throw new Error("Price range too small");
  }

  const k = 1.0 / curvature;

  const binDepositAmount = generateAmountForBinRange(
    seedAmount,
    pair.lbPair.binStep,
    pair.tokenX.decimal,
    pair.tokenY.decimal,
    minBinId,
    maxBinId,
    k,
  );

  const decompressMultiplier = new BN(10 ** pair.tokenX.decimal);

  let { compressedBinAmount, compressionLoss } = compressBinAmount(
    binDepositAmount,
    decompressMultiplier,
  );

  // Distribute loss after compression back to bins based on bin ratio with total deposited amount
  let { newCompressedBinAmount: compressedBinDepositAmount, loss: finalLoss } =
    distributeAmountToCompressedBinsByRatio(
      compressedBinAmount,
      compressionLoss,
      decompressMultiplier,
      new BN(2 ** 32 - 1), // u32
    );

  // This amount will be deposited to the last bin without compression
  const positionCount = getPositionCount(minBinId, maxBinId.sub(new BN(1)));

  const preflightIxs: Array<TransactionInstruction> = [];
  const initializeBinArraysAndPositionIxs: Array<
    Array<TransactionInstruction>
  > = [];
  const addLiquidityIxs: Array<Array<TransactionInstruction>> = [];
  const appendedInitBinArrayIx = new Set();

  const { ataPubKey: userTokenX, ix: createPayerTokenXIx } =
    await getOrCreateATAInstruction(
      connection,
      pair.lbPair.tokenXMint,
      operatorKeypair.publicKey,
      payerKeypair.publicKey,
    );

  // create userTokenX account
  createPayerTokenXIx && preflightIxs.push(createPayerTokenXIx);

  const operatorTokenX = getAssociatedTokenAddressSync(
    pair.lbPair.tokenXMint,
    operatorKeypair.publicKey,
    true,
  );
  const positionOwnerTokenX = getAssociatedTokenAddressSync(
    pair.lbPair.tokenXMint,
    positionOwner,
    true,
  );

  const positionOwnerTokenXAccount =
    await connection.getAccountInfo(positionOwnerTokenX);
  if (positionOwnerTokenXAccount) {
    const account = AccountLayout.decode(positionOwnerTokenXAccount.data);
    if (account.amount == BigInt(0)) {
      // send 1 lamport to position owner token X to prove ownership
      const transferIx = createTransferInstruction(
        operatorTokenX,
        positionOwnerTokenX,
        payerKeypair.publicKey,
        1,
      );
      preflightIxs.push(transferIx);
    }
  } else {
    const createPositionOwnerTokenXIx = createAssociatedTokenAccountInstruction(
      payerKeypair.publicKey,
      positionOwnerTokenX,
      positionOwner,
      pair.lbPair.tokenXMint,
    );
    preflightIxs.push(createPositionOwnerTokenXIx);

    // send 1 lamport to position owner token X to prove ownership
    const transferIx = createTransferInstruction(
      operatorTokenX,
      positionOwnerTokenX,
      payerKeypair.publicKey,
      1,
    );
    preflightIxs.push(transferIx);
  }

  for (let i = 0; i < positionCount.toNumber(); i++) {
    const lowerBinId = minBinId.add(MAX_BIN_PER_POSITION.mul(new BN(i)));
    const upperBinId = lowerBinId.add(MAX_BIN_PER_POSITION).sub(new BN(1));

    const lowerBinArrayIndex = binIdToBinArrayIndex(lowerBinId);
    const upperBinArrayIndex = binIdToBinArrayIndex(upperBinId);

    const [positionPda, _bump] = derivePosition(
      pair.pubkey,
      baseKeypair.publicKey,
      lowerBinId,
      MAX_BIN_PER_POSITION,
      pair.program.programId,
    );

    const [lowerBinArray] = deriveBinArray(
      pair.pubkey,
      lowerBinArrayIndex,
      pair.program.programId,
    );

    const [upperBinArray] = deriveBinArray(
      pair.pubkey,
      upperBinArrayIndex,
      pair.program.programId,
    );

    const accounts = await connection.getMultipleAccountsInfo([
      lowerBinArray,
      upperBinArray,
      positionPda,
    ]);

    let instructions: TransactionInstruction[] = [];

    const lowerBinArrayAccount = accounts[0];
    if (
      !lowerBinArrayAccount &&
      !appendedInitBinArrayIx.has(lowerBinArray.toBase58())
    ) {
      instructions.push(
        await pair.program.methods
          .initializeBinArray(lowerBinArrayIndex)
          .accounts({
            lbPair: pair.pubkey,
            binArray: lowerBinArray,
            funder: payerKeypair.publicKey,
          })
          .instruction(),
      );

      appendedInitBinArrayIx.add(lowerBinArray.toBase58());
    }

    const upperBinArrayAccount = accounts[1];
    if (
      !upperBinArrayAccount &&
      !appendedInitBinArrayIx.has(upperBinArray.toBase58())
    ) {
      instructions.push(
        await pair.program.methods
          .initializeBinArray(upperBinArrayIndex)
          .accounts({
            lbPair: pair.pubkey,
            binArray: upperBinArray,
            funder: payerKeypair.publicKey,
          })
          .instruction(),
      );

      appendedInitBinArrayIx.add(upperBinArray.toBase58());
    }

    const positionAccount = accounts[2];
    if (!positionAccount) {
      instructions.push(
        await pair.program.methods
          .initializePositionByOperator(
            lowerBinId.toNumber(),
            MAX_BIN_PER_POSITION.toNumber(),
            feeOwner,
            lockReleasePoint,
          )
          .accounts({
            payer: payerKeypair.publicKey,
            base: baseKeypair.publicKey,
            position: positionPda,
            lbPair: pair.pubkey,
            owner: positionOwner,
            operator: operatorKeypair.publicKey,
            operatorTokenX,
            ownerTokenX: positionOwnerTokenX,
          })
          .instruction(),
      );
    }

    // Initialize bin arrays and initialize position account in 1 tx
    if (instructions.length > 1) {
      if (cluster != "localhost") {
        instructions.push(
          await getEstimatedComputeUnitIxWithBuffer(
            connection,
            instructions,
            payerKeypair.publicKey,
          ),
        );
      }

      initializeBinArraysAndPositionIxs.push(instructions);
      instructions = [];
    }

    const positionDeposited =
      positionAccount &&
      pair.program.coder.accounts
        .decode<PositionV2>("positionV2", positionAccount.data)
        .liquidityShares.reduce((total, cur) => total.add(cur), new BN(0))
        .gt(new BN(0));

    if (!positionDeposited) {
      const cappedUpperBinId = Math.min(
        upperBinId.toNumber(),
        maxBinId.toNumber() - 1,
      );

      const bins: CompressedBinDepositAmounts = [];

      for (let i = lowerBinId.toNumber(); i <= cappedUpperBinId; i++) {
        bins.push({
          binId: i,
          amount: compressedBinDepositAmount.get(i).toNumber(),
        });
      }

      instructions.push(
        await pair.program.methods
          .addLiquidityOneSidePrecise({
            bins,
            decompressMultiplier,
          })
          .accounts({
            position: positionPda,
            lbPair: pair.pubkey,
            binArrayBitmapExtension: pair.binArrayBitmapExtension
              ? pair.binArrayBitmapExtension.publicKey
              : pair.program.programId,
            userToken: userTokenX,
            reserve: pair.lbPair.reserveX,
            tokenMint: pair.lbPair.tokenXMint,
            binArrayLower: lowerBinArray,
            binArrayUpper: upperBinArray,
            sender: operatorKeypair.publicKey,
          })
          .instruction(),
      );

      // Last position
      if (i + 1 >= positionCount.toNumber() && !finalLoss.isZero()) {
        instructions.push(
          await pair.program.methods
            .addLiquidityOneSide({
              amount: finalLoss,
              activeId: pair.lbPair.activeId,
              maxActiveBinSlippage: 0,
              binLiquidityDist: [
                {
                  binId: cappedUpperBinId,
                  weight: 1,
                },
              ],
            })
            .accounts({
              position: positionPda,
              lbPair: pair.pubkey,
              binArrayBitmapExtension: pair.binArrayBitmapExtension
                ? pair.binArrayBitmapExtension.publicKey
                : pair.program.programId,
              userToken: userTokenX,
              reserve: pair.lbPair.reserveX,
              tokenMint: pair.lbPair.tokenXMint,
              binArrayLower: lowerBinArray,
              binArrayUpper: upperBinArray,
              sender: operatorKeypair.publicKey,
            })
            .instruction(),
        );
      }

      addLiquidityIxs.push([
        ComputeBudgetProgram.setComputeUnitLimit({
          units: DEFAULT_ADD_LIQUIDITY_CU,
        }),
        ...instructions,
      ]);
    }
  }

  // run preflight ixs
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const setCUPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: computeUnitPriceMicroLamports,
  });
  const tx = new Transaction({
    feePayer: payerKeypair.publicKey,
    blockhash,
    lastValidBlockHeight,
  })
    .add(setCUPriceIx)
    .add(...preflightIxs);

  const signers = [payerKeypair];

  if (dryRun) {
    throw new Error(
      "dryRun is not supported for this script, please set dryRun config to false",
    );
  }

  console.log(`>> Running preflight instructions...`);
  try {
    console.log(`>> Sending preflight transaction...`);
    const txHash = await sendAndConfirmTransaction(connection, tx, signers);
    console.log(`>>> Preflight successfully with tx hash: ${txHash}`);
  } catch (err) {
    console.error(err);
    throw new Error(err);
  }

  console.log(`>> Running initializeBinArraysAndPosition instructions...`);
  // Initialize all bin array and position, transaction order can be in sequence or not
  {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const transactions: Array<Promise<string>> = [];

    for (const groupIx of initializeBinArraysAndPositionIxs) {
      const tx = new Transaction({
        feePayer: payerKeypair.publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(...groupIx);

      const signers = [payerKeypair, baseKeypair, operatorKeypair];

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
  console.log(`>>> Finished initializeBinArraysAndPosition instructions!`);

  console.log(`>> Running addLiquidity instructions...`);
  {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const transactions: Array<Promise<string>> = [];

    // Deposit to positions created in above step. The add liquidity order can be in sequence or not.
    for (const groupIx of addLiquidityIxs) {
      const tx = new Transaction({
        feePayer: payerKeypair.publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(...groupIx);

      const signers = [payerKeypair, operatorKeypair];

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
  console.log(`>>> Finished addLiquidity instructions!`);
}
