export interface MeteoraConfig {
  rpcUrl: string;
  dryRun: boolean;
  keypairFilePath: string;
  createBaseToken: CreateBaseMintConfig | null;
  baseMint: string | null;
  quoteSymbol: string;
  baseDecimals: number;
  // If we want to skip the create pool transaction / simulation, set it to true
  skipCreatePool: boolean;
  dynamicAmm: DynamicAmmConfig | null;
  dlmm: DlmmConfig | null;
  alphaVault: FcfsAlphaVaultConfig | ProrataAlphaVaultConfig | null;
}

export interface CreateBaseMintConfig {
  mintBaseTokenAmount: number | string;
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

export interface FcfsAlphaVaultConfig {
  alphaVaultType: string;
  // absolute value, depend on the pool activation type it will be the timestamp in secs or the slot number
  depositingPoint: number;
  // absolute value
  startVestingPoint: number;
  // absolute value
  endVestingPoint: number;
  // total max deposit
  maxDepositCap: number;
  // user max deposit
  individualDepositingCap: number;
  // fee to create stake escrow account
  escrowFee: number;
  // whitelist mode: permissionless / permission_with_merkle_proof / permission_with_authority
  whitelistMode: string;
}

export interface ProrataAlphaVaultConfig {
  alphaVaultType: string;
  // absolute value, depend on the pool activation type it will be the timestamp in secs or the slot number
  depositingPoint: number;
  // absolute value
  startVestingPoint: number;
  // absolute value
  endVestingPoint: number;
  // total max deposit
  maxBuyingCap: number;
  // fee to create stake escrow account
  escrowFee: number;
  // whitelist mode: permissionless / permission_with_merkle_proof / permission_with_authority
  whitelistMode: string;
}
