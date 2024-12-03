# Meteora Pool Toolkit
Scripts to create Meteora pools easily.

## Installation
We need [bun](https://bun.sh/) to run the scripts, install it via [bun installation](https://bun.sh/docs/installation).

Then install the dependencies by running the command `bun install` 

## Configuration
There are a various of config file that can be found at `config` directory that we need to carefully take a look first. It contains all the configurations required to run the scripts.
Also we need to provide the private key for the payer wallet through environment variable `PRIVATE_KEY` in `.env` file. 

### General configuration
- `rpcUrl`: Solana Mainnet RPC URL to get data and send transactions.
- `dryRun`: Set to true to send transactions.
- `createBaseToken`: Set to true to create base token.
- `baseMint`: Base token address if the `createBaseToken` field is set to false.
- `quoteMint`: Quote token address.
- `baseDecimals`: Base token decimal.
- `quoteDecimals`: Quote token decimal.

### Dynamic AMM configuration
- `baseAmount`: Base token amount in lamports.
- `quoteAmount`: Quote token amount in lamports.
- `tradeFeeNumerator`: Trade fee numerator, with fee denominator is set to 100_000.
- `activationType`: To activate pool trading base on `slot` or `timestamp`.
- `activationPoint`: To activate pool trading at a point, base on `activationType`.
- `hasAlphaVault`: Whether the pool support alpha vault.


## Run the scripts
### Create dynamic AMM permissionless pool
Run the script:
```bash
bun run create-dynamic-amm-pool
```