import {
  Connection,
  PublicKey,
  Keypair,
} from "@solana/web3.js";
import BN from "bn.js";
import { Wallet, AnchorProvider, Program } from '@project-serum/anchor';
import AmmImpl from '@mercurial-finance/dynamic-amm-sdk';
import { Amm as AmmIdl, IDL as AmmIDL } from './idl';

export const PROGRAM_ID = 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB';

const mainnetConnection = new Connection('https://api.mainnet-beta.solana.com');
const mockWallet = new Wallet(new Keypair());
const provider = new AnchorProvider(mainnetConnection, mockWallet, {
  commitment: 'confirmed',
});

async function swapQuote(poolAddress: PublicKey, swapAmount: BN, swapAtoB: boolean) {
  const ammProgram = new Program<AmmIdl>(AmmIDL, PROGRAM_ID, provider);
  let poolState = await ammProgram.account.pool.fetch(poolAddress);
  const tokenList = await fetch('https://token.jup.ag/all').then(res => res.json());
  const tokenAInfo = tokenList.find(token => token.address === poolState.tokenAMint.toString());
  const tokenBInfo = tokenList.find(token => token.address === poolState.tokenBMint.toString());
  const pool = await AmmImpl.create(provider.connection, poolAddress, tokenAInfo, tokenBInfo);
  let inTokenMint = swapAtoB ? poolState.tokenAMint : poolState.tokenBMint;
  let swapQuote = pool.getSwapQuote(inTokenMint, swapAmount, 100);
  console.log("🚀 ~ swapQuote:", swapQuote);
  console.log("SwapInAmount %s swapOutAmount %s fee %s", swapQuote.swapInAmount.toString(), swapQuote.swapOutAmount.toString(), swapQuote.fee.toString());
}

async function main() {
  await swapQuote(new PublicKey(
    "Htnih5T64YYvwbkNDmeac2jbiAe1Gec7s5MCiUjTwUPw"
  ), new BN(10_000_000), false);
}


main()