import {ethers, BigNumber, utils, providers} from "ethers"
import { task } from "hardhat/config"
import type {HardhatRuntimeEnvironment, TaskArguments} from "hardhat/types"

const jsonRpcProvider = process.env.ALCHEMY_GOERLI_RPC_URL // https://docs.ethers.io/v5/api/providers/#providers-getDefaultProvider
const provider = ethers.getDefaultProvider("goerli")

task("vrfGetSubscription", "Prints an account's balance")
    .addParam("sub", "Subscription Id")
  .setAction(async (taskArgs: TaskArguments,hre: HardhatRuntimeEnvironment): Promise<void> => {


      const vRFCoordinatorV2MockAbi = [
          {
              "inputs": [
                  {
                      "internalType": "uint64",
                      "name": "subId",
                      "type": "uint64"
                  }
              ],
              "name": "getSubscription",
              "outputs": [
                  {
                      "internalType": "uint96",
                      "name": "balance",
                      "type": "uint96"
                  },
                  {
                      "internalType": "uint64",
                      "name": "reqCount",
                      "type": "uint64"
                  },
                  {
                      "internalType": "address",
                      "name": "owner",
                      "type": "address"
                  },
                  {
                      "internalType": "address[]",
                      "name": "consumers",
                      "type": "address[]"
                  }
              ],
              "stateMutability": "view",
              "type": "function"
          },
      ];

      const vRFCoordinatorV2Mock = new ethers.Contract("0x2ca8e0c643bde4c2e08ab1fa0da3401adad7734d", vRFCoordinatorV2MockAbi, provider);
      console.log(`vRFCoordinatorV2Mock getSubscription receiver721Example  ${JSON.stringify((await vRFCoordinatorV2Mock.getSubscription(taskArgs.sub)))}`)




  })
