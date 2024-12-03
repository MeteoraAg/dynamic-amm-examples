

export interface MeteoraConfig {
  rpcUrl: string;
  dryRun: boolean;
  dynamicAmm: DynamicAmmConfig | null;
}

export interface DynamicAmmConfig {
  createToken: boolean;
  tokenAAddress: string | null;
  tokenADecimals: number;
  // Amount in lamports
  tokenAAmount: string;
  // Amount in lamports
  tokenBAmount: string;
  tradeFeeNumerator: number;
  activationType: string;
  activationPoint: number | null;
  hasAlphaVault: boolean;
}