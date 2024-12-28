import {
  Connection,
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
  FcfsAlphaVaultConfig,
  ProrataAlphaVaultConfig,
  getAlphaVaultWhitelistMode,
  parseConfigFromCli,
  modifyComputeUnitPriceIx,
} from ".";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";

import { BN } from "bn.js";
import AlphaVault, { PoolType } from "@meteora-ag/alpha-vault";
import {
  LBCLMM_PROGRAM_IDS,
  deriveCustomizablePermissionlessLbPair,
} from "@meteora-ag/dlmm";
import {
  deriveCustomizablePermissionlessConstantProductPoolAddress,
  createProgram,
} from "@mercurial-finance/dynamic-amm-sdk/dist/cjs/src/amm/utils";

// async function main() {
//   let config: MeteoraConfig = parseConfigFromCli();

//   console.log(`> Using keypair file path ${config.keypairFilePath}`);
//   let keypair = safeParseKeypairFromFile(config.keypairFilePath);

//   console.log("\n> Initializing with general configuration...");
//   console.log(`- Using RPC URL ${config.rpcUrl}`);
//   console.log(`- Dry run = ${config.dryRun}`);
//   console.log(`- Using payer ${keypair.publicKey} to execute commands`);

//   const connection = new Connection(config.rpcUrl, DEFAULT_COMMITMENT_LEVEL);
//   const wallet = new Wallet(keypair);
//   const provider = new AnchorProvider(connection, wallet, {
//     commitment: connection.commitment,
//   });

//   if (!config.baseMint) {
//     throw new Error("Missing baseMint in configuration");
//   }
//   const baseMint = new PublicKey(config.baseMint);
//   let quoteMint = getQuoteMint(config.quoteSymbol);
//   const quoteDecimals = getQuoteDecimals(config.quoteSymbol);

//   console.log(`- Using base token mint ${baseMint.toString()}`);
//   console.log(`- Using quote token mint ${quoteMint.toString()}`);

//   if (!config.alphaVault) {
//     throw new Error("Missing alpha vault in configuration");
//   }

//   const poolType = getAlphaVaultPoolType(config.alphaVault.poolType);

//   let poolKey: PublicKey;
//   if (poolType == PoolType.DYNAMIC) {
//     poolKey = deriveCustomizablePermissionlessConstantProductPoolAddress(
//       baseMint,
//       quoteMint,
//       createProgram(connection).ammProgram.programId,
//     );
//   } else if (poolType == PoolType.DLMM) {
//     [poolKey] = deriveCustomizablePermissionlessLbPair(
//       baseMint,
//       quoteMint,
//       new PublicKey(LBCLMM_PROGRAM_IDS["mainnet-beta"]),
//     );
//   } else {
//     throw new Error(`Invalid pool type ${poolType}`);
//   }

//   console.log(
//     `\n> Pool address: ${poolKey}, pool type ${config.alphaVault.poolType}`,
//   );

//   let initAlphaVaultTx: Transaction | null = null;
//   if (config.alphaVault.alphaVaultType == "fcfs") {
//     initAlphaVaultTx = await createFcfsAlphaVault(
//       connection,
//       wallet,
//       poolType,
//       poolKey,
//       baseMint,
//       quoteMint,
//       quoteDecimals,
//       config.alphaVault as FcfsAlphaVaultConfig,
//     );
//   } else if (config.alphaVault.alphaVaultType == "prorata") {
//     initAlphaVaultTx = await createProrataAlphaVault(
//       connection,
//       wallet,
//       poolType,
//       poolKey,
//       baseMint,
//       quoteMint,
//       quoteDecimals,
//       config.alphaVault as ProrataAlphaVaultConfig,
//     );
//   } else {
//     throw new Error(
//       `Invalid alpha vault type ${config.alphaVault.alphaVaultType}`,
//     );
//   }
//   modifyComputeUnitPriceIx(
//     initAlphaVaultTx,
//     config.computeUnitPriceMicroLamports,
//   );

//   if (config.dryRun) {
//     console.log(`\n> Simulating init alpha vault tx...`);
//     await runSimulateTransaction(connection, [wallet.payer], wallet.publicKey, [
//       initAlphaVaultTx,
//     ]);
//   } else {
//     console.log(`>> Sending init alpha vault transaction...`);
//     const initAlphaVaulTxHash = await sendAndConfirmTransaction(
//       connection,
//       initAlphaVaultTx,
//       [wallet.payer],
//     ).catch((err) => {
//       console.error(err);
//       throw err;
//     });
//     console.log(
//       `>>> Alpha vault initialized successfully with tx hash: ${initAlphaVaulTxHash}`,
//     );
//   }
// }

// main();
