# Meteora Pool Toolkit
Scripts to create Meteora pools easily.

## Installation
We need [bun](https://bun.sh/) to run the scripts, install it via [bun installation](https://bun.sh/docs/installation).

Then install the dependencies by running the command `bun install` 

## Configuration
There are various config file that can be found at `config` directory that we need to carefully take a look first. It contains all the configurations required to run the scripts.
Also we need to provide the keypair for the payer wallet in `keypair.json` file. 

### General configuration
- `rpcUrl`: Solana RPC URL to get data and send transactions.
- `keypairFilePath`: Keypair file path to send transactions.
- `dryRun`: Set to true to send transactions.
- `computeUnitPriceMicroLamports`: CU price in micro lamports unit. For example: 100000.
- `createBaseToken`: Configuration to create base token.
- `baseMint`: Base token address if the `createBaseToken` field is not set. 
- `quoteSymbol`: Quote token symbol, only `SOL` or `USDC` is supported.
- `dynamicAmm`: Dynamic AMM pool configuration.
- `dlmm`: DLMM pool configuration.
- `alphaVault`: Fcfs or Prorata Alpha Vault configuration.

**Some configuration constraints**:
- `createBaseToken` and `baseMint` cannot be used together.
- `dynamicAmm` and `dlmm` cannot be used together.

### Create Base Token configuration
- `mintBaseTokenAmount`: Base token amount to be minted.
- `baseDecimals`: Base token decimal.

### Dynamic AMM configuration
- `baseAmount`: Base token amount.
- `quoteAmount`: Quote token amount.
- `tradeFeeNumerator`: Trade fee numerator, with fee denominator is set to 100_000.
- `activationType`: To activate pool trading base on `slot` or `timestamp`.
- `activationPoint`: To activate pool trading at a point, either slot value or timestamp value base on `activationType`.
- `hasAlphaVault`: Whether alpha vault is enabled or not for this pool.

### DLMM configuration
- `binStep`: DLMM pool bin step.
- `feeBps`: Fee bps for DLMM pool.
- `initialPrice`: Initial pool price.
- `activationType`: To activate pool trading base on `slot` or `timestamp`.
- `activationPoint`: To activate pool trading at a point, either slot value or timestamp value base on `activationType`.
- `priceRounding`: Should be `up` or `down`.
- `hasAlphaVault`: Whether alpha vault is enabled or not for this pool.

**NOTICE**: There is only one DLMM pool that can be created with the same base and quote tokens, using the instruction `initializeCustomizablePermissionlessLbPair`. So if users try to create a new DLMM pool with the same base and quote tokens but with different parameters, the transaction will fail.

### Alpha Vault configuration
- `poolType`: `dynamic` or `dlmm` pool type.
- `alphaVaultType`: Alpha Vault type, could be `fcfs` or `prorata`
- `depositingPoint`: Absolute value that, the slot or timestamp that allows deposit depending on the pool activation type.
- `startVestingPoint`: Absolute value, the slot or timestamp that start vesting depending on the pool activation type. 
- `endVestingPoint`: Absolute value, the slot or timestamp that end vesting depending on the pool activation type.  
- `maxDepositCap`: Maximum deposit cap.
- `individualDepositingCap`: Individual deposit cap.
- `escrowFee`: Fee to create staking escrow account.
- `whitelistMode`: `permissionless` or `permission_with_merkle_proof` or `permission_with_authority`.

### Prorata configuration
- `depositingPoint`: Absolute value that, the slot or timestamp that allows deposit depending on the pool activation type.
- `startVestingPoint`: Absolute value, the slot or timestamp that start vesting depending on the pool activation type. 
- `endVestingPoint`: Absolute value, the slot or timestamp that end vesting depending on the pool activation type.  
- `maxBuyingCap`: Maximum buying cap.
- `escrowFee`: Fee to create staking escrow account.
- `whitelistMode`: `permissionless` or `permission_with_merkle_proof` or `permission_with_authority`.

## Testings
First, start the localnet
```bash
bun run start-test-validator
```

Then run the test: `bun test`

## Run the scripts
Run the script with the specified config file in the CLI, some examples:

**Create a dynamic AMM pool**
```bash
bun run src/create_pool.ts --config ./config/create_dynamic_amm_pool.json
```

**Create a dynamic AMM pool with new token mint**
```bash
bun run src/create_pool.ts --config ./config/create_dynamic_amm_pool_with_new_token.json
```

**Create a new DLMM pool**
```bash
bun run src/create_pool.ts --config ./config/create_dlmm_pool.json
```

**Create a new DLMM pool with alpha vault**
```bash
bun run src/create_pool.ts --config ./config/create_dlmm_pool_with_fcfs_alpha_vault.json
```
Then run
```bash
bun run src/create_alpha_vault.ts --config ./config/create_dlmm_pool_with_fcfs_alpha_vault.json
```

**Lock liquidity for Dynamic AMM pool**
```bash
bun run src/lock_liquidity.ts --config ./config/lock_liquidity.json
```

**Seed liquidity for DLMM pool with single bin strategy**
```bash
bun run src/seed_liquidity_single_bin.ts --config ./config/seed_liquidity_single_bin.json
```

**Seed liquidity for DLMM pool with LFG strategy**
```bash
bun run src/seed_liquidity_lfg.ts --config ./config/seed_liquidity_lfg.json
```

## After deployment
To view pool on the UI, access the links below
- For Dynamic AMM pool: `https://app.meteora.ag/pools/<POOL_ADDRESS>`
- For DLMM pool: `https://app.meteora.ag/dlmm/<POOL_ADDRESS>`
