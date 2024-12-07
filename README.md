# Meteora Pool Toolkit
Scripts to create Meteora pools easily.

## Installation
We need [bun](https://bun.sh/) to run the scripts, install it via [bun installation](https://bun.sh/docs/installation).

Then install the dependencies by running the command `bun install` 

## Configuration
There are a various of config file that can be found at `config` directory that we need to carefully take a look first. It contains all the configurations required to run the scripts.
Also we need to provide the keypair for the payer wallet in `keypair.json` file. 

### General configuration
- `rpcUrl`: Solana RPC URL to get data and send transactions.
- `keypairFilePath`: Keypair file path to send transactions.
- `dryRun`: Set to true to send transactions.
- `createBaseToken`: Configuration to create base token.
- `baseMint`: Base token address if the `createBaseToken` field is not set. 
- `quoteSymbol`: Quote token symbol, only `SOL` or `USDC` is supported.
- `baseDecimals`: Base token decimal.
- `alphaVaultType`: Alpha vault configuration is we want to deploy alpha vault after pool creation.
- `skipCreatePool`: Set to true to skip sending / simulating transaction to create pool.
- `dynamicAmm`: Dynamic AMM pool configuration.
- `dlmm`: DLMM pool configuration.
- `alphaVault`: Fcfs or Prorata Alpha Vault configuration.

**Some configuration constraints**:
- `createBaseToken` and `baseMint` cannot be used together.
- `dynamicAmm` and `dlmm` cannot be used together.

### Create Base Token configuration
- `mintBaseTokenAmount`: Base token amount to be minted.

### Dynamic AMM configuration
- `baseAmount`: Base token amount.
- `quoteAmount`: Quote token amount.
- `tradeFeeNumerator`: Trade fee numerator, with fee denominator is set to 100_000.
- `activationType`: To activate pool trading base on `slot` or `timestamp`.
- `activationPoint`: To activate pool trading at a point, either slot valut or timestamp value base on `activationType`.

### DLMM configuration
- `binStep`: DLMM pool bin step.
- `feeBps`: Fee bps for DLMM pool.
- `minPrice`: Min pool price.
- `maxPrice`: Max pool price.
- `activationType`: To activate pool trading base on `slot` or `timestamp`.
- `activationPoint`: To activate pool trading at a point, either slot valut or timestamp value base on `activationType`.

### Alpha Vault configuration
- `alphaVaultType`: Alpha Vault type, could be `fcfs` or `prorata`
- `depositingPoint`: Absolute value that, the slot or timestamp that allows deposit depend on the pool activation type.
- `startVestingPoint`: Absolute value, the slot or timestamp that start vesting depend on the pool activation type. 
- `endVestingPoint`: Absolute value, the slot or timestamp that end vesting depend on the pool activation type.  
- `maxDepositCap`: Maximum deposit cap.
- `individualDepositingCap`: Individual deposit cap.
- `escrowFee`: Fee to create stake escrow account.
- `whitelistMode`: `permissionless` or `permission_with_merkle_proof` or `permission_with_authority`.

### Prorata configuration
- `depositingPoint`: Absolute value that, the slot or timestamp that allows deposit depend on the pool activation type.
- `startVestingPoint`: Absolute value, the slot or timestamp that start vesting depend on the pool activation type. 
- `endVestingPoint`: Absolute value, the slot or timestamp that end vesting depend on the pool activation type.  
- `maxBuyingCap`: Maximum buying cap.
- `escrowFee`: Fee to create stake escrow account.
- `whitelistMode`: `permissionless` or `permission_with_merkle_proof` or `permission_with_authority`.

## Run the scripts
Run the script with config file specified in the CLI, for example:
```bash
bun run src/create_pool --config ./config/create_dynamic_amm_pool.json
```

## After deployment
To view pool on the UI, access the links below
- For Dynamic AMM pool: `https://app.meteora.ag/pools/<POOL_ADDRESS>`
- For DLMM pool: `https://app.meteora.ag/dlmm/<POOL_ADDRESS>`
