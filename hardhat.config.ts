import "@nomicfoundation/hardhat-toolbox";
import {HardhatUserConfig, task} from "hardhat/config";
import "hardhat-contract-sizer"
import * as dotenv from "dotenv"
import "./tasks"

dotenv.config()

// Go to https://www.alchemyapi.io, sign up, create
// a new App in its dashboard, and replace "KEY" with its key
const ALCHEMY_GOERLI_RPC_URL = process.env.ALCHEMY_GOERLI_RPC_URL;

// Replace this private key with your Goerli account private key
// To export your private key from Metamask, open Metamask and
// go to Account Details > Export Private Key
// Beware: NEVER put real Ether into testing accounts
const GOERLI_PRIVATE_KEY = process.env.GOERLI_PRIVATE_KEY;



const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.9",
      },
      {
        version: "0.8.13",
      },
      {
        version: "0.6.6",
      },
      {
        version: "0.4.24",
      },
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    goerli: {
      url: ALCHEMY_GOERLI_RPC_URL,
      accounts: GOERLI_PRIVATE_KEY !== undefined  ? [GOERLI_PRIVATE_KEY] : [],
    }
  }
};

export default config;
