import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";

import { searcher, bundle } from "jito-ts";
import { DEFAULT_COMMITMENT_LEVEL } from "./constants";
import { BundleResult } from "jito-ts/dist/gen/block-engine/bundle";

const getRandomeTipAccountAddress = async (
  searcherClient: searcher.SearcherClient,
) => {
  const account = await searcherClient.getTipAccounts();
  if (account.ok) {
    return new PublicKey(account.value[Math.floor(Math.random() * account.value.length)]);
  }
  throw new Error("Failed to get tip accounts");
};

export const bundleAndSendTransactions = async (
  keypair: Keypair,
  rpcUrl: string,
  searcherUrl: string,
  transactions: VersionedTransaction[],
  tipAmount: number = 1000,
  onResult?: (result: BundleResult) => void,
) => {
  const connection = new Connection(rpcUrl, DEFAULT_COMMITMENT_LEVEL);
  // Create the searcher client that will interact with Jito
  const searcherClient = searcher.searcherClient(searcherUrl);

  // Subscribe to the bundle result
  if (onResult) {
    searcherClient.onBundleResult(onResult, (e) => {
      throw e;
    });
  }

  // Get a random tip account address
  const tipAccount = await getRandomeTipAccountAddress(searcherClient);
  console.log("tip account:", tipAccount);

  const jitoBundle = new bundle.Bundle(transactions, transactions.length + 1);
  const blockHash = await connection.getLatestBlockhash();
  jitoBundle.addTipTx(keypair, tipAmount, tipAccount, blockHash.blockhash);

  try {
    const resp = await searcherClient.sendBundle(jitoBundle);
    console.log("resp:", resp);
  } catch (e) {
    console.error("error sending bundle:", e);
  }
};

export const sendBundle = async (
    bundle: bundle.Bundle,
    searcherUrl: string,
    keypair: Keypair,
    rpcUrl: string,
    dryRun: boolean,
    tipAmount: number = 1000,
    onResult?: (result: BundleResult) => void
) => {
    const searcherClient = searcher.searcherClient(searcherUrl);
    const connection = new Connection(rpcUrl, DEFAULT_COMMITMENT_LEVEL);
    const blockHash = await connection.getLatestBlockhash();
    // Get a random tip account address
    const tipAccount = await getRandomeTipAccountAddress(searcherClient);
    console.log("tip account:", tipAccount);
    bundle.addTipTx(keypair, tipAmount, tipAccount, blockHash.blockhash);
    if (onResult) {
        searcherClient.onBundleResult(onResult, (e) => {
            throw e;
        });
    }
    if (dryRun) {
        if ((connection as any).simulateBundle) {
            const resp = await (connection as any).simulateBundle(bundle);
            console.log("resp:", resp);
        } else {
            throw new Error("simulateBundle not supported");
        }
    } else {
        try {
            const resp = await searcherClient.sendBundle(bundle);
            console.log("resp:", resp);
        } catch (e) {
            console.error("error sending bundle:", e);
        }
    }
};

