

export interface MeteoraConfig {
  rpcUrl: string;
  dryRun: boolean;
  createBaseToken: boolean;
  mintBaseTokenAmount: number | string | null;
  baseMint: string;
  quoteMint: string;
  baseDecimals: number;
  quoteDecimals: number;
  dynamicAmm: DynamicAmmConfig | null;
  dlmm: DlmmConfig | null;
}

export interface DynamicAmmConfig {
  baseAmount: number | string;
  quoteAmount: number | string;
  tradeFeeNumerator: number;
  activationType: string;
  activationPoint: number | null;
  hasAlphaVault: boolean;
}

export interface DlmmConfig {
  binStep: number;
  feeBps: number;
  minPrice: number;
  maxPrice: number;
  activationType: string;
  activationPoint: number | null;
  hasAlphaVault: boolean;
}