import {Contract, ContractReceipt, ContractTransaction, ethers, Signer} from "ethers";
import {TransactionResponse} from "@ethersproject/abstract-provider";
import {HardhatRuntimeEnvironment} from "hardhat/types";

const WAIT_CONFIRMATIONS = 1;
async function execTransaction(transaction: ContractTransaction, displayName: string) {
    console.log(`${displayName} transaction ${JSON.stringify(transaction.hash)}`)
    await transaction.wait(WAIT_CONFIRMATIONS);
    console.log(`${displayName} transaction confirmed`)
}

async function execDeployTransaction(contract: Contract, displayName: string) {
    console.log(`${displayName} deployed to ${contract.address}`);
    let transactionResponse: TransactionResponse = contract.deployTransaction;
    console.log(`${displayName} deploy transactionResponse ${JSON.stringify(transactionResponse.hash)}`)
    let transactionReceipt: ContractReceipt = await transactionResponse.wait(WAIT_CONFIRMATIONS);
    console.log(`${displayName} deploy transactionResponse confirmed`)
    return contract;
}

export {execTransaction, execDeployTransaction}