# Meteora Pool Toolkit
Scripts to create Meteora pools easily.

## Installation
We need [bun](https://bun.sh/) to run the scripts, install it via [bun installation](https://bun.sh/docs/installation).

Then install the dependencies by running the command `bun install` 

## Configuration
There is a configuration file called `meteora_config.json` that we need to carefully take a look first. It contains all the configurations required to run the scripts.
Also we need to provide the private key for the payer wallet through environment variable `PRIVATE_KEY` in `.env` file. 

### General configuration
- `rpcUrl`: Solana Mainnet RPC URL to get data and send transactions.
- `dryRun`: Set to true to send transactions.

### Dynamic AMM configuration
- `createToken`: Set to true to create token A.
- `tokenAAddress`: Token A address if the `createToken` field is set to false.
- `tokenADecimals`: Token A decimals if the `tokenADecimals` field is set true.
- `tokenAAmount`: Token A amount in lamports.
- `tokenBAmount`: Token B amount in lamports.
- `tradeFeeNumerator`: Trade fee numerator, with fee denominator is set to 100_000.
- `activationType`: To activate pool trading base on `slot` or `timestamp`.
- `activationPoint`: To activate pool trading at a point, base on `activationType`.
- `hasAlphaVault`: Whether the pool support alpha vault.


## Run the scripts
### Create dynamic AMM permissionless pool
Run the script:
```bash
bun run src/create_permissionless_dynamic_amm_pool.ts
```