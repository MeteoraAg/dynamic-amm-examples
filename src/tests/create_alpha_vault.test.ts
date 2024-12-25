import {
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { SOL_TOKEN_MINT } from "../libs/constants";
import {
  createPermissionlessDlmmPool,
  createPermissionlessDynamicPool,
  deriveAlphaVault,
} from "../index";
import { web3 } from "@coral-xyz/anchor";
import {
  AlphaVaultTypeConfig,
  FcfsAlphaVaultConfig,
  MeteoraConfig,
  PoolTypeConfig,
  WhitelistModeConfig,
} from "../libs/config";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  connection,
  payerKeypair,
  rpcUrl,
  keypairFilePath,
  payerWallet,
  DLMM_PROGRAM_ID,
  DYNAMIC_AMM_PROGRAM_ID,
  ALPHA_VAULT_PROGRAM_ID,
} from "./setup";
import { deriveCustomizablePermissionlessConstantProductPoolAddress } from "@mercurial-finance/dynamic-amm-sdk/dist/cjs/src/amm/utils";
import { createFcfsAlphaVault } from "../libs/create_alpha_vault_utils";
import AlphaVault, { Permissionless, PoolType } from "@meteora-ag/alpha-vault";
import { Clock, ClockLayout } from "@meteora-ag/dlmm";
import { BN } from "bn.js";
import AmmImpl from "@mercurial-finance/dynamic-amm-sdk";

describe("Test create alpha vault", () => {
  const WEN_DECIMALS = 5;
  const USDC_DECIMALS = 6;
  const WEN_SUPPLY = 100_000_000;
  const USDC_SUPPLY = 100_000_000;

  let WEN: PublicKey;
  let USDC: PublicKey;
  let userWEN: web3.PublicKey;
  let userUSDC: web3.PublicKey;

  beforeAll(async () => {
    WEN = await createMint(
      connection,
      payerKeypair,
      payerKeypair.publicKey,
      null,
      WEN_DECIMALS,
      Keypair.generate(),
      undefined,
      TOKEN_PROGRAM_ID,
    );

    USDC = await createMint(
      connection,
      payerKeypair,
      payerKeypair.publicKey,
      null,
      USDC_DECIMALS,
      Keypair.generate(),
      undefined,
      TOKEN_PROGRAM_ID,
    );

    const userWenInfo = await getOrCreateAssociatedTokenAccount(
      connection,
      payerKeypair,
      WEN,
      payerKeypair.publicKey,
      false,
      "confirmed",
      {
        commitment: "confirmed",
      },
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    userWEN = userWenInfo.address;

    const userUsdcInfo = await getOrCreateAssociatedTokenAccount(
      connection,
      payerKeypair,
      USDC,
      payerKeypair.publicKey,
      false,
      "confirmed",
      {
        commitment: "confirmed",
      },
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    userUSDC = userUsdcInfo.address;

    await mintTo(
      connection,
      payerKeypair,
      WEN,
      userWEN,
      payerKeypair.publicKey,
      WEN_SUPPLY * 10 ** WEN_DECIMALS,
      [],
      {
        commitment: "confirmed",
      },
      TOKEN_PROGRAM_ID,
    );

    await mintTo(
      connection,
      payerKeypair,
      USDC,
      userUSDC,
      payerKeypair.publicKey,
      USDC_SUPPLY * 10 ** USDC_DECIMALS,
      [],
      {
        commitment: "confirmed",
      },
      TOKEN_PROGRAM_ID,
    );
  });

  it("Test create permissonless dynamic pool with fcfs alpha vault", async () => {
    const currentSlot = await connection.getSlot({
      commitment: "confirmed",
    });
    const activationPoint = currentSlot + 30;
    const depositingPoint = currentSlot;
    const startVestingPoint = currentSlot + 10;
    const endVestingPoint = currentSlot + 20;

    // 1. Create pool
    const config: MeteoraConfig = {
      dryRun: false,
      rpcUrl,
      keypairFilePath,
      computeUnitPriceMicroLamports: 100000,
      createBaseToken: null,
      baseMint: WEN.toString(),
      quoteSymbol: "SOL",
      dynamicAmm: {
        baseAmount: 1000,
        quoteAmount: 1,
        tradeFeeNumerator: 2500,
        activationType: "slot",
        activationPoint: activationPoint,
        hasAlphaVault: true,
      },
      dlmm: null,
      alphaVault: {
        poolType: PoolTypeConfig.Dynamic,
        alphaVaultType: AlphaVaultTypeConfig.Fcfs,
        depositingPoint,
        startVestingPoint,
        endVestingPoint,
        maxDepositCap: 0.5,
        individualDepositingCap: 0.01,
        escrowFee: 0,
        whitelistMode: WhitelistModeConfig.Permissionless,
      },
      lockLiquidity: null,
      lfgSeedLiquidity: null,
      singleBinSeedLiquidity: null,
    };

    await createPermissionlessDynamicPool(
      config,
      connection,
      payerWallet,
      WEN,
      SOL_TOKEN_MINT,
      {
        programId: DYNAMIC_AMM_PROGRAM_ID,
      },
    );

    const poolKey = deriveCustomizablePermissionlessConstantProductPoolAddress(
      WEN,
      SOL_TOKEN_MINT,
      DYNAMIC_AMM_PROGRAM_ID,
    );

    const pool = await AmmImpl.create(connection, poolKey, {
      programId: DYNAMIC_AMM_PROGRAM_ID.toString(),
    });

    // 2. Create alpha vault
    const initAlphaVaultTx = await createFcfsAlphaVault(
      connection,
      payerWallet,
      PoolType.DYNAMIC,
      poolKey,
      WEN,
      SOL_TOKEN_MINT,
      9,
      config.alphaVault as FcfsAlphaVaultConfig,
    );

    const initAlphaVaulTxHash = await sendAndConfirmTransaction(
      connection,
      initAlphaVaultTx,
      [payerKeypair],
    ).catch((err) => {
      console.error(err);
      throw err;
    });
    console.log(
      `>>> Alpha vault initialized successfully with tx hash: ${initAlphaVaulTxHash}`,
    );

    const [alphaVaultPubkey] = deriveAlphaVault(
      payerKeypair.publicKey,
      poolKey,
      ALPHA_VAULT_PROGRAM_ID,
    );

    const alphaVault = await AlphaVault.create(connection, alphaVaultPubkey);
    expect(alphaVault.vault.baseMint).toEqual(WEN);
    expect(alphaVault.vault.quoteMint).toEqual(SOL_TOKEN_MINT);
    expect(alphaVault.vault.poolType).toEqual(PoolType.DYNAMIC);
    expect(alphaVault.vault.whitelistMode).toEqual(Permissionless);
  });

  it("Test create permissonless dlmm pool with fcfs alpha vault", async () => {});

  it("Test create permissonless dynamic pool with prorata alpha vault", async () => {});

  it("Test create permissonless dlmm pool with prorata alpha vault", async () => {});
});
