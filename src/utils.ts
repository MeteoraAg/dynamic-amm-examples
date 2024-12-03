import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";

export function safeParseJsonFromFile<T>(filePath: string): T {
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Error reading or parsing JSON file:', error);
        throw new Error(`failed to parse file ${filePath}`); 
    }
}

export function safeParseKeypairFromFile(filePath: string): Keypair {
    let keypairJson: Array<number> = safeParseJsonFromFile(filePath);
    let keypairBytes = Uint8Array.from(keypairJson);
    let keypair = Keypair.fromSecretKey(keypairBytes);
    return keypair; 
}

export function parseKeypairFromSecretKey(secretKey: string): Keypair {
    const keypairBytes = bs58.decode(secretKey);
    const keypair = Keypair.fromSecretKey(keypairBytes);
    return keypair;
}