import { Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { DEFAULT_COMMITMENT_LEVEL, getAmountInLamports } from ".";
import { BN } from "bn.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

export interface CreateTokenMintOptions {
  dryRun: boolean;
  mintTokenAmount: string | number;
  decimals: number;
}

export async function createTokenMint(connection: Connection, wallet: Wallet, options: CreateTokenMintOptions): Promise<PublicKey> {
  if (!options.dryRun) {
    throw new Error("cannot create token mint when in dry run mode");
  }

  const mintAmount = getAmountInLamports(
    options.mintTokenAmount,
    options.decimals,
  );

  const mint: PublicKey = await createAndMintToken(
    connection,
    wallet,
    options.decimals,
    mintAmount,
  );

  console.log(
    `>> Mint token mint ${mint} to payer wallet. Amount ${options.mintTokenAmount} in lamport ${mintAmount}`,
  );

  return mint;
}

async function createAndMintToken(
  connection: Connection,
  wallet: Wallet,
  mintDecimals: number,
  mintAmountLamport: BN,
): Promise<PublicKey> {
  const mint = await createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    null,
    mintDecimals,
  );

  const walletTokenATA = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    mint,
    wallet.publicKey,
    true,
  );
  await mintTo(
    connection,
    wallet.payer,
    mint,
    walletTokenATA.address,
    wallet.publicKey,
    mintAmountLamport,
    [],
    {
      commitment: DEFAULT_COMMITMENT_LEVEL,
    },
  );

  return mint;
}