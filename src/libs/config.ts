import {
  parseCliArguments,
  safeParseJsonFromFile,
  validate_config,
} from "./utils";
import Ajv, { JSONSchemaType } from "ajv";

const CONFIG_SCHEMA: JSONSchemaType<MeteoraConfig> = {
  type: "object",
  properties: {
    rpcUrl: {
      type: "string",
    },
    dryRun: {
      type: "boolean",
    },
    keypairFilePath: {
      type: "string",
    },
    createBaseToken: {
      type: "object",
      nullable: true,
      properties: {
        mintBaseTokenAmount: {
          anyOf: [{ type: "number" }, { type: "string" }],
        },
      },
      required: ["mintBaseTokenAmount"],
      additionalProperties: false,
    },
    baseMint: {
      type: "string",
      nullable: true,
    },
    quoteSymbol: {
      type: "string",
    },
    baseDecimals: {
      type: "number",
    },
    dynamicAmm: {
      type: "object",
      nullable: true,
      properties: {
        baseAmount: {
          anyOf: [{ type: "number" }, { type: "string" }],
        },
        quoteAmount: {
          anyOf: [{ type: "number" }, { type: "string" }],
        },
        tradeFeeNumerator: {
          type: "number",
        },
        activationType: {
          type: "string",
        },
        activationPoint: {
          type: "number",
          nullable: true,
        },
      },
      required: [
        "baseAmount",
        "quoteAmount",
        "tradeFeeNumerator",
        "activationType",
      ],
      additionalProperties: false,
    },
    dlmm: {
      type: "object",
      nullable: true,
      properties: {
        binStep: {
          type: "number",
        },
        feeBps: {
          type: "number",
        },
        initialPrice: {
          type: "number",
        },
        activationType: {
          type: "string",
        },
        activationPoint: {
          type: "number",
          nullable: true,
        },
        priceRounding: {
          type: "string"
        }
      },
      required: ["binStep", "feeBps", "initialPrice", "activationType", "priceRounding"],
      additionalProperties: false,
    },
    alphaVault: {
      type: "object",
      nullable: true,
      properties: {
        poolType: { type: "string" },
        alphaVaultType: { type: "string" },
        depositingPoint: { type: "number" },
        startVestingPoint: { type: "number" },
        endVestingPoint: { type: "number" },
        maxDepositCap: { type: "number", nullable: true },
        individualDepositingCap: { type: "number", nullable: true },
        maxBuyingCap: { type: "number", nullable: true },
        escrowFee: { type: "number" },
        whitelistMode: { type: "string" },
      },
      required: [
        "poolType",
        "alphaVaultType",
        "depositingPoint",
        "startVestingPoint",
        "endVestingPoint",
        "escrowFee",
        "whitelistMode",
      ],
    },
    lockLiquidity: {
      type: "object",
      nullable: true,
      properties: {
        alllocations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              percentage: {
                type: "number",
              },
              address: {
                type: "string",
              },
            },
            required: ["percentage", "address"],
          },
        },
      },
      required: ["allocations"],
    },
    lfgSeedLiquidity: {
      type: "object",
      nullable: true,
      properties: {
        minPrice: {
          type: "number",
        },
        maxPrice: { type: "number" },
        binStep: { type: "number" },
        curvature: { type: "number" },
        seedAmount: { type: "string" },
        basePositionKey: { type: "string" },
        basePositionKeypairFilepath: { type: "string" },
      },
      required: [
        "minPrice",
        "maxPrice",
        "binStep",
        "curvature",
        "seedAmount",
        "basePositionKey",
        "basePositionKeypairFilepath",
      ],
    },
    singleBinSeedLiquidity: {
      type: "object",
      nullable: true,
      properties: {
        price: { type: "number" },
        selectiveRounding: { type: "string" },
        seedAmount: { type: "string" },
        basePositionKey: { type: "string" },
        basePositionKeypairFilepath: { type: "string" },
      },
      required: [
        "price",
        "selectiveRounding",
        "seedAmount",
        "basePositionKey",
        "basePositionKeypairFilepath",
      ],
    },
  },
  required: ["rpcUrl", "dryRun", "keypairFilePath"],
  additionalProperties: true,
};

export interface MeteoraConfig {
  rpcUrl: string;
  dryRun: boolean;
  keypairFilePath: string;
  createBaseToken: CreateBaseMintConfig | null;
  baseMint: string | null;
  quoteSymbol: string;
  baseDecimals: number;
  dynamicAmm: DynamicAmmConfig | null;
  dlmm: DlmmConfig | null;
  alphaVault: FcfsAlphaVaultConfig | ProrataAlphaVaultConfig | null;
  lockLiquidity: LockLiquidityConfig | null;
  lfgSeedLiquidity: LfgSeedLiquidityConfig | null;
  singleBinSeedLiquidity: SingleBinSeedLiquidityConfig | null;
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
  initialPrice: number;
  activationType: string;
  activationPoint: number | null;
  priceRounding: string;
}

export interface FcfsAlphaVaultConfig {
  poolType: string;
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
  poolType: string;
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

export interface LockLiquidityConfig {
  allocations: LockLiquidityAllocation[];
}

export interface LockLiquidityAllocation {
  percentage: number;
  address: string;
}

export interface LfgSeedLiquidityConfig {
  minPrice: number;
  maxPrice: number;
  binStep: number;
  curvature: number;
  seedAmount: string;
  basePositionKey: string;
  basePositionKeypairFilepath: string;
}

export interface SingleBinSeedLiquidityConfig {
  price: number;
  selectiveRounding: string;
  seedAmount: string;
  basePositionKey: string;
  basePositionKeypairFilepath: string;
}

/// Parse and validate config from CLI
export function parseConfigFromCli(): MeteoraConfig {
  const ajv = new Ajv();
  const cliArguments = parseCliArguments();
  if (!cliArguments.config) {
    throw new Error("Please provide a config file path to --config flag");
  }
  const configFilePath = cliArguments.config!;
  console.log(`> Using config file: ${configFilePath}`);

  const validate = ajv.compile(CONFIG_SCHEMA);

  let config: MeteoraConfig = safeParseJsonFromFile(configFilePath);

  const isValid = validate(config);
  if (!isValid) {
    console.error(validate.errors);
    throw new Error("Config file is invalid");
  }

  validate_config(config);

  return config;
}
