

export interface MeteoraConfig {
  rpcUrl: string;
  dryRun: boolean;
  createBaseToken: boolean;
  mintBaseTokenAmountLamport: number | string | null;
  baseMint: string;
  quoteMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  dynamicAmm: DynamicAmmConfig | null;
  dlmm: DlmmConfig | null;
}

export interface DynamicAmmConfig {
  baseAmountLamport: number | string;
  quoteAmountLamport: number | string;
  tradeFeeNumerator: number;
  activationType: string;
  activationPoint: number | null;
  hasAlphaVault: boolean;
}

export interface DlmmConfig {

}