import {ethers, BigNumber, utils, providers, Contract, Signer, ContractTransaction, ContractReceipt} from "ethers"
import {task} from "hardhat/config"
import type {HardhatRuntimeEnvironment, TaskArguments} from "hardhat/types"

const jsonRpcProvider = process.env.ALCHEMY_GOERLI_RPC_URL // https://docs.ethers.io/v5/api/providers/#providers-getDefaultProvider
const provider = ethers.getDefaultProvider("goerli")


task("getPrizePoolInfo", "Prints an PrizePool contract info")
    .addParam("address", "PrizePoolContract Address")
    .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment): Promise<void> => {

        // @ts-ignore
        const [deployer] = await hre.ethers.getSigners();
        // @ts-ignore
        const PrizePool = await hre.ethers.getContractFactory("PrizePool");
        const prizePool = PrizePool.attach(taskArgs.address);
        const ticketAddress = await prizePool.ticketAddress();
        console.log(`TicketNFT Address  ${JSON.stringify((ticketAddress))}`)

        console.log(` noneFungiblePrizeStatus ${((await prizePool.prizePoolStatus()))}`)
        console.log(` Query721TokenAwardNum ${(await prizePool.queryAllPrizeListLength()).toBigInt()}`)
        console.log(` queryRevealedPrizeCount ${(await prizePool.queryRevealedPrizeCount()).toBigInt()}`)
        console.log(` queryRemainPrizeCount ${(await prizePool.queryRemainPrizeCount()).toBigInt()}`)
        console.log(` queryTokenIdRemainPrizeIdStructListLength ${(await prizePool.queryRequestedRevealTicketCount()).toBigInt()}`)


        const prizeCount = (await prizePool.queryAllPrizeListLength()).toNumber()
        for (let i = 0; i < prizeCount; i++) {
            const prizeInfo = await prizePool.queryTicketAwarded(i);
            console.log(`PrizePool prize info 
           prizeType: ${prizeInfo[5]} status: ${prizeInfo[2]}
           prizeAddress: ${prizeInfo[0]} prizeTokenId: ${prizeInfo[1]} amount: ${prizeInfo[6]}
            originOwner: ${prizeInfo[4]} awardId: ${prizeInfo[3]}`);

        }

        const requestedRevealEventCount = (await prizePool.queryRequestedRevealTicketCount()).toNumber()
        for (let i = 0; i < requestedRevealEventCount; i++) {
            const requestedRevealTicketEvent = await prizePool.queryRequestRevealTicketIdOfIndex(i);
            console.log(`requestedRevealTicketEvent ticketId: ${requestedRevealTicketEvent.toBigInt()} `)
        }

        for (let i = 0; i < prizeCount; i++) {
            const revealedPrizeOfTicket = await prizePool.queryRevealedPrizeOfTicketId(i);
            console.log(`revealedPrizeOfTicket
           prizeId: ${revealedPrizeOfTicket[0]}  randomNumber: ${revealedPrizeOfTicket[1]} `
            )
        }

        for (let i = 0; i < prizeCount; i++) {
            const prizeInfoTicketGet = await prizePool.queryTicketPrize(ticketAddress, i);
            console.log(`prizeInfoTicketGet
           prizeAddress: ${prizeInfoTicketGet[0]} prizeTokenId: ${prizeInfoTicketGet[1]} originOwner: ${prizeInfoTicketGet[2]}
           prizeType: ${prizeInfoTicketGet[3]} status: ${prizeInfoTicketGet[4]} amount: ${prizeInfoTicketGet[5]}
           `
            )
        }

    })
