/* tslint:disable:no-console */

/* External Imports */
import { config } from 'dotenv'
import { Contract, ContractFactory, ethers, Wallet } from 'ethers-v4'
import { stripZeros, hexlify, RLP, getAddress } from 'ethers-v4/utils'
import { Provider } from 'ethers-v4/providers'

/* Internal Imports */
import { ContractDeploymentFunction } from '../types'
import { add0x } from '../app'
import { sleep, isHexStringEmptyOrUndefined } from './misc'
import { keccak256 } from './crypto'

/**
 * Makes sure the necessary environment parameters are defined and loads environment config.
 *
 * @param configDirectoryPath The absolute path to the config directory for this deployment.
 */
const checkParamsAndLoadConfig = (configDirectoryPath: string) => {
  if (
    !process.argv.length ||
    process.argv[process.argv.length - 1].endsWith('.js')
  ) {
    console.log(
      '\n\nError: Environment argument not provided. Usage: "yarn run deploy:<contract> <env>"\n'
    )
    process.exit(0)
  }

  // Get the environment and read the appropriate environment file
  const environment = process.argv[process.argv.length - 1]
  config({ path: `${configDirectoryPath}/.${environment}.env` })
}

/**
 * Used by `deployContractsFunction` below to deploy a contract from a wallet and contract JSON.
 *
 * @param contractJson The json of the contract to deploy.
 * @param wallet The wallet used to deploy.
 * @param args Any necessary constructor args.
 * @returns the deployed Contract reference.
 */
export const deployContract = async (
  contractJson: any,
  wallet: Wallet,
  ...args: any
): Promise<Contract> => {
  const factory = new ContractFactory(
    contractJson.abi,
    contractJson.bytecode,
    wallet
  )
  const contract = await factory.deploy(...args)
  console.log(
    `Address: [${contract.address}], Tx: [${contract.deployTransaction.hash}]`
  )
  return contract.deployed()
}

/**
 * Handles deploying contracts by calling the provided `deployContractsFunction`.
 * This function loads all of the necessary config and context for a deployment,
 * allowing `deployContractsFunction` to focus on what is being deployed.
 *
 * @param deployContractFunction The function that dictates what is deployed
 * @param configDirectoryPath The absolute path to the config directory for this deployment
 * @param rootContract Whether or not this is the main contract being deployed (as compared to a dependency).
 * @returns The address of the deployed contract
 */
export const deploy = async (
  deployContractFunction: ContractDeploymentFunction,
  configDirectoryPath: string,
  rootContract: boolean = true
): Promise<string> => {
  // If this doesn't work, nothing will happen.
  checkParamsAndLoadConfig(configDirectoryPath)

  if (rootContract) {
    console.log(`\n\n********** STARTING DEPLOYMENT ***********\n\n`)
  }
  // Make sure mnemonic exists
  const deployMnemonic = process.env.DEPLOY_MNEMONIC
  if (!deployMnemonic) {
    console.log(
      `Error: No DEPLOY_MNEMONIC env var set. Please add it to .<environment>.env file it and try again. See .env.example for more info.\n`
    )
    return
  }

  // Connect provider
  let provider: Provider
  const network = process.env.DEPLOY_NETWORK
  if (!network || network === 'local') {
    provider = new ethers.providers.JsonRpcProvider(
      process.env.DEPLOY_LOCAL_URL || 'http://127.0.0.1:8545'
    )
  } else {
    provider = ethers.getDefaultProvider(network)
  }

  // Create wallet
  const wallet = Wallet.fromMnemonic(deployMnemonic).connect(provider)

  if (rootContract) {
    console.log(
      `\nDeploying to network [${network || 'local'}] in 5 seconds!\n`
    )
    await sleep(5_000)
  }

  return deployContractFunction(wallet)
}

/**
 * Gets the address the of a deployed contract, assuming it is deployed from the
 * provided address with the provided nonce through the given provider.
 *
 * @param nonce The nonce from which the deployed address should be derived.
 * @param provider The provider used to deploy the contract
 * @param address The address from which the contract will be deployed
 * @returns contractAddress The address of the first deployed contract or `null` if one hasn't been deployed yet
 */
export const getDeployedContractAddress = async (
  nonce: number,
  provider: Provider,
  address: string
): Promise<string | undefined> => {
  const contractAddress = generateAddress(address, nonce)

  if (!isHexStringEmptyOrUndefined(await provider.getCode(contractAddress))) {
    return contractAddress
  }
}

/**
 * Generates a contract address based on an account address and nonce
 * @param addresss The account address
 * @param nonce The nonce
 * @returns contractAddress The address
 */
export const generateAddress = async (address: string, nonce: number) => {
  return getAddress(
    add0x(
      keccak256(RLP.encode([getAddress(address), stripZeros(hexlify(nonce))]))
    ).substring(26)
  )
}
