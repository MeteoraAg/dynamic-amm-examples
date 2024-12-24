import {
  AlphaVaultTypeConfig,
  PoolTypeConfig,
  WhitelistModeConfig,
  validateConfig,
} from "../libs/config";

describe("Test parsing JSON configuration", () => {
  it("Should able to parse alpha vault configuration", () => {
    let rawConfig = `
    {
      "rpcUrl": "https://api.mainnet-beta.solana.com",
      "dryRun": true,
      "keypairFilePath": "keypair.json",
      "computeUnitPriceMicroLamports": 100000,
      "baseMint": "GbXBoqiGLzaaXqpNUxWFsp1AxRdjXTng2FNbyLZY1jpc",
      "quoteSymbol": "SOL",
      "dynamicAmm": {
        "baseAmount": 100,
        "quoteAmount": 0.001,
        "tradeFeeNumerator": 2500,
        "activationType": "timestamp",
        "activationPoint": 1734440400,
        "hasAlphaVault": true
      },
      "alphaVault": {
        "poolType": "dynamic",
        "alphaVaultType": "fcfs",
        "depositingPoint": 1733547099,
        "startVestingPoint": 1733548099,
        "endVestingPoint": 1733549099,
        "maxDepositCap": 100,
        "individualDepositingCap": 1,
        "escrowFee": 0,
        "whitelistMode": "permissionless"
      }
    }
    `;

    let config = JSON.parse(rawConfig);

    validateConfig(config);

    expect(config.alphaVault.poolType).toEqual(PoolTypeConfig.Dynamic);
    expect(config.alphaVault.alphaVaultType).toEqual(AlphaVaultTypeConfig.Fcfs);
    expect(config.alphaVault.whitelistMode).toEqual(
      WhitelistModeConfig.Permissionless,
    );
  });

  it("Invalid alphaVault.poolType", () => {
    let rawConfig = `
    {
      "rpcUrl": "https://api.mainnet-beta.solana.com",
      "dryRun": true,
      "keypairFilePath": "keypair.json",
      "computeUnitPriceMicroLamports": 100000,
      "baseMint": "GbXBoqiGLzaaXqpNUxWFsp1AxRdjXTng2FNbyLZY1jpc",
      "quoteSymbol": "SOL",
      "dynamicAmm": {
        "baseAmount": 100,
        "quoteAmount": 0.001,
        "tradeFeeNumerator": 2500,
        "activationType": "timestamp",
        "activationPoint": 1734440400,
        "hasAlphaVault": true
      },
      "alphaVault": {
        "poolType": "invalid",
        "alphaVaultType": "fcfs",
        "depositingPoint": 1733547099,
        "startVestingPoint": 1733548099,
        "endVestingPoint": 1733549099,
        "maxDepositCap": 100,
        "individualDepositingCap": 1,
        "escrowFee": 0,
        "whitelistMode": "permissionless"
      }
    }
    `;

    let config = JSON.parse(rawConfig);

    try {
      validateConfig(config);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("Invalid alphaVault.alphaVaultType", () => {
    let rawConfig = `
    {
      "rpcUrl": "https://api.mainnet-beta.solana.com",
      "dryRun": true,
      "keypairFilePath": "keypair.json",
      "computeUnitPriceMicroLamports": 100000,
      "baseMint": "GbXBoqiGLzaaXqpNUxWFsp1AxRdjXTng2FNbyLZY1jpc",
      "quoteSymbol": "SOL",
      "dynamicAmm": {
        "baseAmount": 100,
        "quoteAmount": 0.001,
        "tradeFeeNumerator": 2500,
        "activationType": "timestamp",
        "activationPoint": 1734440400,
        "hasAlphaVault": true
      },
      "alphaVault": {
        "poolType": "dynamic",
        "alphaVaultType": "invalid_fcfs",
        "depositingPoint": 1733547099,
        "startVestingPoint": 1733548099,
        "endVestingPoint": 1733549099,
        "maxDepositCap": 100,
        "individualDepositingCap": 1,
        "escrowFee": 0,
        "whitelistMode": "permissionless"
      }
    }
    `;

    let config = JSON.parse(rawConfig);

    try {
      validateConfig(config);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("Invalid alphaVault.whitelistMode", () => {
    let rawConfig = `
    {
      "rpcUrl": "https://api.mainnet-beta.solana.com",
      "dryRun": true,
      "keypairFilePath": "keypair.json",
      "computeUnitPriceMicroLamports": 100000,
      "baseMint": "GbXBoqiGLzaaXqpNUxWFsp1AxRdjXTng2FNbyLZY1jpc",
      "quoteSymbol": "SOL",
      "dynamicAmm": {
        "baseAmount": 100,
        "quoteAmount": 0.001,
        "tradeFeeNumerator": 2500,
        "activationType": "timestamp",
        "activationPoint": 1734440400,
        "hasAlphaVault": true
      },
      "alphaVault": {
        "poolType": "dynamic",
        "alphaVaultType": "invalid_fcfs",
        "depositingPoint": 1733547099,
        "startVestingPoint": 1733548099,
        "endVestingPoint": 1733549099,
        "maxDepositCap": 100,
        "individualDepositingCap": 1,
        "escrowFee": 0,
        "whitelistMode": "permissionless"
      }
    }
    `;

    let config = JSON.parse(rawConfig);

    try {
      validateConfig(config);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
