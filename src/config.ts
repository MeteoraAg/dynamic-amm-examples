

export interface MeteoraConfig {
  rpcUrl: string;
  dryRun: boolean;
  keypairFilePath: string;
  createBaseToken: boolean;
  mintBaseTokenAmount: number | string | null;
  baseMint: string;
  quoteSymbol: string;
  baseDecimals: number;
  hasAlphaVault: boolean;
  dynamicAmm: DynamicAmmConfig | null;
  dlmm: DlmmConfig | null;
}

export interface DynamicAmmConfig {
  baseAmount: number | string;
  quoteAmount: number | string;
  tradeFeeNumerator: number;
  activationType: string;
  activationPoint: number | null;
}

export interface DlmmConfig {
  binStep: number;
  feeBps: number;
  minPrice: number;
  maxPrice: number;
  activationType: string;
  activationPoint: number | null;
}