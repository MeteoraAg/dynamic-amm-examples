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
  ProrataAlphaVaultConfig,
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
import {
  createFcfsAlphaVault,
  createProrataAlphaVault,
} from "../libs/create_alpha_vault_utils";
import AlphaVault, {
  ActivationType,
  Permissionless,
  PoolType,
  VaultMode,
} from "@meteora-ag/alpha-vault";
import { Clock, ClockLayout } from "@meteora-ag/dlmm";
import { BN } from "bn.js";
import AmmImpl from "@mercurial-finance/dynamic-amm-sdk";

describe("Test create dynamic pool with permissioned authority fcfs alpha vault", () => {
  const WEN_DECIMALS = 5;
  const USDC_DECIMALS = 6;
  const WEN_SUPPLY = 100_000_000;
  const USDC_SUPPLY = 100_000_000;
  const dryRun = false;
  const computeUnitPriceMicroLamports = 100000;

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

  it("Happy case", async () => {
    const activationType = "timestamp";
    const clockAccount = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
    const clock: Clock = ClockLayout.decode(clockAccount.data);

    const activationPoint = clock.unixTimestamp.add(new BN(30));

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
        activationType,
        activationPoint,
        hasAlphaVault: true,
      },
      dlmm: null,
      alphaVault: null,
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
  });
});
