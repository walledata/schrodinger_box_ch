import {time, loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
// @ts-ignore
import {ethers} from "hardhat";
import {BigNumber, Contract, ContractTransaction, Signer, ContractReceipt} from "ethers";
import {TransactionResponse} from "@ethersproject/abstract-provider";

describe("Shrodinger", function () {

    async function deployTicketNFT(name: string, symbol: string, baseURI: string) {

        const TicketNFT = await ethers.getContractFactory("TicketNFT");

        let result = await execDeployTransactionAndGetGasPriceNGasUsed(await TicketNFT.deploy(name, symbol, baseURI));
        const ticketNFT = result.contract;

        let ticketNFTDeployTxFee = result.txFee;
        let ticketNFTDeployGasUsed = result.transactionReceipt.gasUsed.toBigInt()

        return {ticketNFT, ticketNFTDeployGasUsed, ticketNFTDeployTxFee};
    }



    async function deployVRFContract() {
        const VRFCoordinatorV2Mock = await ethers.getContractFactory(
            "VRFCoordinatorV2Mock"
        )

        console.log(`BASE_FEE ${JSON.stringify(ethers.utils.formatEther("250000000000000000"))}`)
        console.log(`BASE_FEE gwei  ${ethers.utils.formatUnits("1776000000000", "ether")}`)
        console.log(`fundAmount ${JSON.stringify(ethers.utils.formatEther("5000000000000000000"))}`)


        const BASE_FEE = "250000000000000000" // 0.25 LINK
        const GAS_PRICE_LINK = "1776000000000" // 0.000001776 LINK per gas
        const vRFCoordinatorV2Mock = await VRFCoordinatorV2Mock.deploy(
            BASE_FEE, GAS_PRICE_LINK
        )
        let subscriptionId = ethers.BigNumber.from(9342);
        console.log(`vRFCoordinatorV2Mock deployed to ${vRFCoordinatorV2Mock.address}`);
        const transaction: ContractTransaction = await vRFCoordinatorV2Mock.createSubscription();
        const transactionReceipt: ContractReceipt = await transaction.wait(1);
        if (transactionReceipt.events) {
            subscriptionId = ethers.BigNumber.from(transactionReceipt.events[0].topics[1])
            console.log(`vRFCoordinatorV2Mock subscriptionId ${subscriptionId}`);
            const fundAmount: BigNumber = BigNumber.from("300000000000000000000"); // 3 LINK
            await vRFCoordinatorV2Mock.fundSubscription(subscriptionId, fundAmount);

            const [balance,
                reqCount,
                vrfOwner,
                consumers] = await vRFCoordinatorV2Mock.getSubscription(subscriptionId);
            console.log(`vRFCoordinatorV2Mock getSubscription after fundSubscription balance:  ${balance.toBigInt()}   reqCount:${reqCount.toBigInt()}   vrfOwner:${vrfOwner}    consumers:${JSON.stringify(consumers)}`)
        }
        return {vRFCoordinatorV2Mock, subscriptionId};
    }


    async function deploySchrodingerContractFixture() {

        const {
            ticketNFT,
            ticketNFTDeployGasUsed,
            ticketNFTDeployTxFee
        } = await deployTicketNFT("ticketNft2", "ticketNft2", "http://db.a111a123.club/json?");
        const [owner] = await ethers.getSigners();
        console.log(`ticketNFT deployed to ${ticketNFT.address}`);

        const {vRFCoordinatorV2Mock, subscriptionId} = await deployVRFContract();
        let result;

        const PrizePool = await ethers.getContractFactory("PrizePool", {

        });


        result = await execDeployTransactionAndGetGasPriceNGasUsed(await PrizePool.deploy(ticketNFT.address, owner.address, subscriptionId, vRFCoordinatorV2Mock.address));
        const prizePool = result.contract;

        let prizePoolDeployTxFee = result.txFee;
        let prizePoolDeployGasUsed = result.transactionReceipt.gasUsed.toBigInt()

        console.log(`prizePool deployed to ${prizePool.address}`);
        const [balance,
            reqCount,
            vrfOwner,
            consumers] = await vRFCoordinatorV2Mock.getSubscription(subscriptionId);
        console.log(`vRFCoordinatorV2Mock getSubscription balance:  ${balance.toBigInt()}   reqCount:${reqCount.toBigInt()}   vrfOwner:${vrfOwner}    consumers:${JSON.stringify(consumers)}`)


        return {
            prizePool: prizePool,
            ticketNFT,
            owner,
            subscriptionId,
            vRFCoordinatorV2Mock,
            ticketNFTDeployGasUsed,
            ticketNFTDeployTxFee,
            prizePoolDeployGasUsed,
            prizePoolDeployTxFee
        };
    }

    async function deployPrizeNFT(name: string, symbol: string, baseURI: string, signer: Signer) {
        const SampleGiftNFT = await ethers.getContractFactory("SampleGiftNFT", signer);
        const sampleGiftNFT = await SampleGiftNFT.deploy(name, symbol, baseURI);
        return sampleGiftNFT;
    }

    async function transferFromNftOfPrizePoolContract(prizePoolContract: Contract, prizeOwner: Signer, prizeNFTContractAddress: string, tokenId: string) {
        const SampleGiftNFT = await ethers.getContractFactory("SampleGiftNFT", prizeOwner);
        const prizeNFTContractSignByPrizeOwner = await SampleGiftNFT.attach(prizeNFTContractAddress);

        let prizeNFTTransferTxFee = BigInt(0);
        let prizeNFTTransferGasUsed = BigInt(0);
        let result = await execTransactionAndGetGasPriceNGasUsed(await prizeNFTContractSignByPrizeOwner.approve(prizePoolContract.address, tokenId));
        prizeNFTTransferTxFee += result.txFee;
        prizeNFTTransferGasUsed += result.transactionReceipt.gasUsed.toBigInt();

        const prizePoolContractSignByPrizeOwner = await prizePoolContract.connect(prizeOwner)

        result = await execTransactionAndGetGasPriceNGasUsed(await prizePoolContractSignByPrizeOwner.fillNonFungiblePrize721(prizeNFTContractAddress, tokenId));
        prizeNFTTransferTxFee += result.txFee;
        prizeNFTTransferGasUsed += result.transactionReceipt.gasUsed.toBigInt();


        return {prizeNFTTransferTxFee, prizeNFTTransferGasUsed}
    }

    async function scriptsForRegisterPrizeNFTsToPrizePoolContract(prizePoolContract: Contract, nftPrizeCount = 3) {
        const [owner, prizeOwner1, prizeOwner2, prizeNFT1Deployer, prizeNFT2Deployer] = await ethers.getSigners();
        const prizeNFT1 = await deployPrizeNFT("prizeNFT1", "prizeNFT1", "http://db.a111a123.club/json?", prizeNFT1Deployer);
        const prizeNFT2 = await deployPrizeNFT("prizeNFT2", "prizeNFT2", "http://db.a111a123.club/json?", prizeNFT2Deployer);

        const random1 = Math.floor(Math.random() * Math.floor(nftPrizeCount / 3)) + 1;
        const random2 = Math.floor(Math.random() * Math.floor(nftPrizeCount / 3)) + 1;
        const random3 = nftPrizeCount - random1 - random2
        console.log(` random1: ${random1}  random2: ${random2}  random3: ${random3}`)

        const prizeNFT1SignByPrizeOwner1 = await prizeNFT1.connect(prizeOwner1)
        for (let i = 0; i < random1; i++) {
            await prizeNFT1SignByPrizeOwner1.mint(prizeOwner1.address)
        }

        const prizeNFT2SignByPrizeOwner1 = await prizeNFT2.connect(prizeOwner1)
        for (let i = 0; i < random2; i++) {
            await prizeNFT2SignByPrizeOwner1.mint(prizeOwner1.address)
        }

        const prizeNFT1SignByPrizeOwner2 = await prizeNFT1.connect(prizeOwner2)
        for (let i = 0; i < random3; i++) {
            await prizeNFT1SignByPrizeOwner2.mint(prizeOwner2.address)
        }


        const registerNFTList = [];

        let allPrizeNFTTransferTxFee = BigInt(0);
        let allPrizeNFTTransferGasUsed = BigInt(0);

        for (let i = 0; i < random1; i++) {
            const tokenOfPrizeOwner1OfPrizeNFT1 = (await prizeNFT1.tokenOfOwnerByIndex(prizeOwner1.address, 0)).toString();
            let {
                prizeNFTTransferTxFee,
                prizeNFTTransferGasUsed
            } = await transferFromNftOfPrizePoolContract(prizePoolContract, prizeOwner1, prizeNFT1.address, tokenOfPrizeOwner1OfPrizeNFT1);
            allPrizeNFTTransferTxFee += prizeNFTTransferTxFee;
            allPrizeNFTTransferGasUsed += prizeNFTTransferGasUsed;
            registerNFTList.push({
                "prizeContract": prizeNFT1,
                "prizeTokenId": tokenOfPrizeOwner1OfPrizeNFT1,
                "originOwnerAddress": await prizeNFT1SignByPrizeOwner1.signer.getAddress()
            })
        }

        for (let i = 0; i < random2; i++) {
            const tokenOfPrizeOwner1OfPrizeNFT2 = (await prizeNFT2.tokenOfOwnerByIndex(prizeOwner1.address, 0)).toString();
            let {
                prizeNFTTransferTxFee,
                prizeNFTTransferGasUsed
            } = await transferFromNftOfPrizePoolContract(prizePoolContract, prizeOwner1, prizeNFT2.address, tokenOfPrizeOwner1OfPrizeNFT2);
            allPrizeNFTTransferTxFee += prizeNFTTransferTxFee;
            allPrizeNFTTransferGasUsed += prizeNFTTransferGasUsed;
            registerNFTList.push({
                "prizeContract": prizeNFT2,
                "prizeTokenId": tokenOfPrizeOwner1OfPrizeNFT2,
                "originOwnerAddress": await prizeNFT2SignByPrizeOwner1.signer.getAddress()
            })
        }

        for (let i = 0; i < random3; i++) {
            const tokenOfPrizeOwner2OfPrizeNFT1 = (await prizeNFT1.tokenOfOwnerByIndex(prizeOwner2.address, 0)).toString();
            let {
                prizeNFTTransferTxFee,
                prizeNFTTransferGasUsed
            } = await transferFromNftOfPrizePoolContract(prizePoolContract, prizeOwner2, prizeNFT1.address, tokenOfPrizeOwner2OfPrizeNFT1);
            allPrizeNFTTransferTxFee += prizeNFTTransferTxFee;
            allPrizeNFTTransferGasUsed += prizeNFTTransferGasUsed;
            registerNFTList.push({
                "prizeContract": prizeNFT1,
                "prizeTokenId": tokenOfPrizeOwner2OfPrizeNFT1,
                "originOwnerAddress": await prizeNFT1SignByPrizeOwner2.signer.getAddress()
            })
        }


        return {registerNFTList, allPrizeNFTTransferGasUsed, allPrizeNFTTransferTxFee};
    }

    async function execTransactionAndGetGasPriceNGasUsed(transaction: ContractTransaction, waitConfirmations = 1) {
        const transactionReceipt: ContractReceipt = await transaction.wait(waitConfirmations);
        let txFee = transactionReceipt.gasUsed.toBigInt() * (transaction.gasPrice?.toBigInt() ?? BigInt(0))
        return {
            "transaction": transaction,
            "transactionReceipt": transactionReceipt,
            "txFee": txFee
        };
    }

    async function execDeployTransactionAndGetGasPriceNGasUsed(contract: Contract, waitConfirmations = 1) {

        let transactionResponse: TransactionResponse = contract.deployTransaction;
        let transactionReceipt: ContractReceipt = await transactionResponse.wait(waitConfirmations);


        let txFee = transactionReceipt.gasUsed.toBigInt() * (transactionResponse.gasPrice?.toBigInt() ?? BigInt(0))
        return {
            "contract": contract,
            "transaction": transactionResponse,
            "transactionReceipt": transactionReceipt,
            "txFee": txFee
        };
    }



    async function scriptOpenBox(prizePoolContract: Contract, customer: Signer, ticketNFTAddress: string, ticketTokenId: number, vRFCoordinatorV2Mock: Contract) {

        let allTxFee = BigInt(0);
        let allGasUsed = BigInt(0);
        let openTxFee = BigInt(0);
        let openGasUsed = BigInt(0);
        let fulfillRandomWordsGasUsed = BigInt(0);
        const customerValueBeforeAward = (await ethers.provider.getBalance(customer.getAddress())).toBigInt();
        const prizePoolContractSignByCustomer = await prizePoolContract.connect(customer);

        let result = await execTransactionAndGetGasPriceNGasUsed(await prizePoolContractSignByCustomer.getChainLink(ticketNFTAddress, ticketTokenId));
        allTxFee += result.txFee;
        allGasUsed += result.transactionReceipt.gasUsed.toBigInt();
        openTxFee += result.txFee;
        openGasUsed += result.transactionReceipt.gasUsed.toBigInt();


        let result2;
        let [nftAward, tokenIdAward, originOwner, prizeType, status, amount] = await prizePoolContractSignByCustomer.queryTicketPrize(ticketNFTAddress, ticketTokenId);
        await expect(prizeType).to.be.eq(0);

        const requestId = await prizePoolContractSignByCustomer.s_requestId();
        const subscriptionId = await prizePoolContractSignByCustomer.s_subscriptionId();

        let balanceBefore,
            balanceAfter,
            reqCount,
            vrfOwner,
            consumers;

        [balanceBefore,
            reqCount,
            vrfOwner,
            consumers] = await vRFCoordinatorV2Mock.getSubscription(subscriptionId);
        result2 = await execTransactionAndGetGasPriceNGasUsed(await vRFCoordinatorV2Mock.fulfillRandomWords(requestId, prizePoolContractSignByCustomer.address));


        [balanceAfter,
            reqCount,
            vrfOwner,
            consumers] = await vRFCoordinatorV2Mock.getSubscription(subscriptionId);
        const linkUsed = balanceBefore - balanceAfter;

        fulfillRandomWordsGasUsed += result2.transactionReceipt.gasUsed.toBigInt();

        [nftAward, tokenIdAward, originOwner, prizeType, status, amount] = await prizePoolContractSignByCustomer.queryTicketPrize(ticketNFTAddress, ticketTokenId);
        await expect(prizeType).to.be.not.eq(0);



        const customerValueBeforeReceivePrize = (await ethers.provider.getBalance(customer.getAddress())).toBigInt();
        result = await execTransactionAndGetGasPriceNGasUsed(await prizePoolContractSignByCustomer.retrievePrize(ticketNFTAddress, ticketTokenId));
        const customerValueAfterReceivePrize = (await ethers.provider.getBalance(customer.getAddress())).toBigInt();
        allTxFee += result.txFee;
        allGasUsed += result.transactionReceipt.gasUsed.toBigInt();
        const customerValueDiffAfterReceivePrizeOffTxFee = customerValueAfterReceivePrize - (customerValueBeforeReceivePrize - result.txFee);

        const customerValueAfterAward = (await ethers.provider.getBalance(customer.getAddress())).toBigInt();
        const customerValueDiff = customerValueAfterAward - customerValueBeforeAward;
        const allDiff = BigInt(allTxFee) + BigInt(customerValueDiff) - BigInt(customerValueDiffAfterReceivePrizeOffTxFee);
        await expect(allDiff).to.be.eq(0);

        return {
            "allTxFee": allTxFee,
            "allGasUsed": allGasUsed,
            "openTxFee": openTxFee,
            "openGasUsed": openGasUsed,
            "fulfillRandomWordsGasUsed": fulfillRandomWordsGasUsed,
            "linkUsed": linkUsed,
        };
    }


    describe("Deployment", function () {
        it("Process All",
            async function () {
                const {
                    prizePool,
                    ticketNFT,
                    vRFCoordinatorV2Mock,
                    ticketNFTDeployGasUsed,
                    ticketNFTDeployTxFee,
                    prizePoolDeployGasUsed,
                    prizePoolDeployTxFee
                } = await loadFixture(
                    deploySchrodingerContractFixture
                );

                const TicketNFT = await ethers.getContractFactory("TicketNFT");
                const ticketNFTInstance = await TicketNFT.attach(ticketNFT.address);

                let allDeployTxFee = BigInt(0);
                let allDeployGasUsed = BigInt(0);

                console.log(`ticketNFTDeployTxFee ${ethers.utils.formatEther(ticketNFTDeployTxFee)}`);
                console.log(`ticketNFTDeployGasUsed ${ticketNFTDeployGasUsed}`);
                allDeployTxFee += ticketNFTDeployTxFee;
                allDeployGasUsed += ticketNFTDeployGasUsed;

                console.log(`prizePoolDeployTxFee ${ethers.utils.formatEther(prizePoolDeployTxFee)}`);
                console.log(`prizePoolDeployGasUsed ${prizePoolDeployGasUsed}`);
                allDeployTxFee += prizePoolDeployTxFee;
                allDeployGasUsed += prizePoolDeployGasUsed;

                console.log(`allDeployTxFee ${ethers.utils.formatEther(allDeployTxFee)}`);
                console.log(`allDeployGasUsed ${allDeployGasUsed}`);

                let allUserTxFee = BigInt(0);
                let allUserGasUsed = BigInt(0);

                let ticketMintTxFee = BigInt(0);
                let ticketMintGasUsed = BigInt(0);


                const nftPrizeCountNumber = 70;
                const prizeSouvenirCountNumber = 30;
                const nftPrizeCount = BigInt(nftPrizeCountNumber);
                const prizeSouvenirCount = BigInt(prizeSouvenirCountNumber);

                let allSettleTicketTxFee = BigInt(0);
                let allSettleTicketGasUsed = BigInt(0);

                let allSettlePrizeTxFee = BigInt(0);
                let allSettlePrizeGasUsed = BigInt(0);


                const [owner, prizeOwner1, prizeOwner2, prizeNFT1Deployer, prizeNFT2Deployer, tokenMinter1, tokenMinter2] = await ethers.getSigners();
                const prizePoolSignByTokenMinter1 = await prizePool.connect(tokenMinter1);
                const {
                    registerNFTList,
                    allPrizeNFTTransferGasUsed,
                    allPrizeNFTTransferTxFee
                } = await scriptsForRegisterPrizeNFTsToPrizePoolContract(prizePool, nftPrizeCountNumber)

                allSettlePrizeTxFee += allPrizeNFTTransferTxFee;
                allSettlePrizeGasUsed += allPrizeNFTTransferGasUsed;

                const prizeCountNumber = nftPrizeCountNumber + prizeSouvenirCountNumber;
                const prizeCount = nftPrizeCount + prizeSouvenirCount;
                console.log(`Prize Count ${prizeCount} `);

                const tokenMinter1MintNumber = Math.floor(Math.random() * Math.floor(prizeCountNumber / 2)) + 1;
                const tokenMinter2MintNumber = prizeCountNumber - tokenMinter1MintNumber;

                let result = await execTransactionAndGetGasPriceNGasUsed(await ticketNFTInstance.setMintMax(prizeCount));
                console.log(`setMintMax transaction txFee:  ${ethers.utils.formatEther(result.txFee)}`);
                console.log(`setMintMax transaction gasPrice:  ${ethers.utils.formatUnits(result.transaction.gasPrice?.toBigInt() ?? 0, "gwei")} gasUsed:  ${result.transactionReceipt.gasUsed}  value: ${result.transaction.value}  `);
                allSettleTicketTxFee += result.txFee;
                allSettleTicketGasUsed += result.transactionReceipt.gasUsed.toBigInt()

                const ONE_GWEI = 1_000_000_000;
                const mintPrice = 2 * ONE_GWEI;

                result = await execTransactionAndGetGasPriceNGasUsed(await ticketNFTInstance.setMintPrice(mintPrice));
                console.log(`setMintPrice transaction txFee:  ${ethers.utils.formatEther(result.txFee)}`);
                console.log(`setMintPrice transaction gasPrice:  ${ethers.utils.formatUnits(result.transaction.gasPrice?.toBigInt() ?? 0, "gwei")} gasUsed:  ${result.transactionReceipt.gasUsed}  value: ${result.transaction.value}  `);
                allSettleTicketTxFee += result.txFee;
                allSettleTicketGasUsed += result.transactionReceipt.gasUsed.toBigInt()

                result = await execTransactionAndGetGasPriceNGasUsed(await ticketNFTInstance.flipSaleState());
                console.log(`flipSaleState transaction txFee:  ${ethers.utils.formatEther(result.txFee)}`);
                console.log(`flipSaleState transaction gasPrice:  ${ethers.utils.formatUnits(result.transaction.gasPrice?.toBigInt() ?? 0, "gwei")} gasUsed:  ${result.transactionReceipt.gasUsed}  value: ${result.transaction.value}  `);
                allSettleTicketTxFee += result.txFee;
                allSettleTicketGasUsed += result.transactionReceipt.gasUsed.toBigInt()

                console.log(`allSettleTicketTxFee ${ethers.utils.formatEther(allSettleTicketTxFee)}`);
                console.log(`allSettleTicketGasUsed ${allSettleTicketGasUsed}`);

                console.log(`ticketNFT mint max  ${(await ticketNFTInstance.MINT_MAX()).toString()}`);
                console.log(`ticketNFT mint price  ${(await ticketNFTInstance.MINT_MAX()).toString()}`);
                console.log(`ticketNFT queryTokenId  ${(await ticketNFTInstance.queryCurrentTokenId()).toString()}`);

                let result2 = await execTransactionAndGetGasPriceNGasUsed(await (await ticketNFTInstance.connect(tokenMinter1)).setMintBatch(tokenMinter1.address, 1, {value: mintPrice * 1}));
                console.log(`setMintBatch1 gasUsed  ${result2.transactionReceipt.gasUsed.toBigInt()}`);
                ticketMintGasUsed += result2.transactionReceipt.gasUsed.toBigInt();
                ticketMintTxFee += result2.txFee;
                await ticketNFTInstance.pause();

                await expect((await ticketNFTInstance.connect(tokenMinter1)).setMintBatch(tokenMinter1.address, 1, {value: mintPrice * 1})).to.be.rejectedWith(
                    "ERC1155Pausable: token transfer while paused"
                );
                await ticketNFTInstance.unpause();
                if (tokenMinter1MintNumber > 1) {
                    result2 = await execTransactionAndGetGasPriceNGasUsed(await (await ticketNFTInstance.connect(tokenMinter1)).setMintBatch(tokenMinter1.address, (tokenMinter1MintNumber - 1), {value: mintPrice * (tokenMinter1MintNumber - 1)}));
                    console.log(`setMintBatch1 gasUsed  ${result2.transactionReceipt.gasUsed.toBigInt()}`);
                    ticketMintGasUsed += result2.transactionReceipt.gasUsed.toBigInt();
                    ticketMintTxFee += result2.txFee;
                }


                result2 = await execTransactionAndGetGasPriceNGasUsed(await (await ticketNFTInstance.connect(tokenMinter2)).setMintBatch(tokenMinter2.address, tokenMinter2MintNumber, {value: mintPrice * tokenMinter2MintNumber}));
                ticketMintGasUsed += result2.transactionReceipt.gasUsed.toBigInt();
                ticketMintTxFee += result2.txFee;

                allUserGasUsed += ticketMintGasUsed;
                allUserTxFee += ticketMintTxFee;
                console.log(`setMintBatch2 gasUsed  ${result2.transactionReceipt.gasUsed.toBigInt()}`);
                console.log(`ticketNFT totalSupply  ${(await ticketNFTInstance["totalSupply()"]()).toString()}`);
                console.log(`ticketNFT totalSupply token 1  ${(await ticketNFTInstance["totalSupply(uint256)"](1)).toString()}`);

                let lastQueryRandomnessTime = await prizePool.queryLastRequestRevealTime()
                console.log(`prizePool  queryLastRequestRevealTime:  ${lastQueryRandomnessTime} `);
                let balance = await ethers.provider.getBalance(prizePool.address);
                let status = await prizePool.prizePoolStatus();
                console.log(`prizePool  balance:  ${balance}  prizePoolStatus:  ${status}`);
                await expect((prizePoolSignByTokenMinter1).getChainLink(ticketNFTInstance.address, 0)).to.be.rejectedWith(
                    "Prize is not complete filling"
                );
                console.log(`prizePool queryAllPrizeListLength  ${(await prizePool.queryAllPrizeListLength()).toString()}`);
                console.log(`prizePool prizePoolStatus  ${(await prizePool.prizePoolStatus()).toString()}`);



                result = await execTransactionAndGetGasPriceNGasUsed(await prizePool.fillFungiblePrize(prizeSouvenirCount, {value: 1000000000000000n}));
                const allPrizeTokenTxFee = result.txFee;
                const allPrizeTokenGasUsed = result.transactionReceipt.gasUsed.toBigInt();
                console.log(`ticketMapingSouvenir transaction txFee:  ${ethers.utils.formatEther(result.txFee)}`);
                console.log(`ticketMapingSouvenir transaction gasPrice:  ${ethers.utils.formatUnits(result.transaction.gasPrice?.toBigInt() ?? 0, "gwei")} gasUsed:  ${result.transactionReceipt.gasUsed}  value: ${result.transaction.value}  `);

                console.log(`allPrizeTokenTxFee ${ethers.utils.formatEther(allPrizeTokenTxFee)}`);
                console.log(`allPrizeTokenGasUsed ${allPrizeTokenGasUsed}`);
                console.log(`allPrizeTokenGasUsed average ${allPrizeTokenGasUsed / BigInt(prizeSouvenirCount)}`);

                allSettlePrizeTxFee += allPrizeTokenTxFee;
                allSettlePrizeGasUsed += allPrizeTokenGasUsed;
                console.log(`allSettlePrizeTxFee ${ethers.utils.formatEther(allSettlePrizeTxFee)}`);
                console.log(`allSettlePrizeGasUsed ${allSettlePrizeGasUsed}`);
                console.log(`allSettlePrizeGasUsed average ${allSettlePrizeGasUsed / BigInt(prizeCount)}`);

                result = await execTransactionAndGetGasPriceNGasUsed(await prizePool.flipRequestRevealState());
                console.log(`prizePool noneFungiblePrizeStatus after filling ${(await prizePool.prizePoolStatus()).toString()}`);
                allSettlePrizeTxFee += result.txFee;
                allSettlePrizeTxFee += result.transactionReceipt.gasUsed.toBigInt();

                const prizeContractValueBeforeAward = (await ethers.provider.getBalance(prizePool.address)).toBigInt();
                console.log(`prizePool value ${prizeContractValueBeforeAward}`);

                balance = await ethers.provider.getBalance(prizePool.address);
                status = await prizePool.prizePoolStatus();
                console.log(`prizePool  balance:  ${balance}      prizePoolStatus:  ${status}`);
                const tokenAwardNum = (await prizePool.queryAllPrizeListLength()).toNumber();
                console.log(`prizePool queryAllPrizeListLength  ${tokenAwardNum}`);

                const tokenMinter1ValueBeforeAward = (await ethers.provider.getBalance(tokenMinter1.address)).toBigInt();
                const tokenMinter2ValueBeforeAward = (await ethers.provider.getBalance(tokenMinter2.address)).toBigInt();


                let openNReceiveTxFee = BigInt(0);
                let openNReceiveGasUsed = BigInt(0);
                let allFulfillRandomWordsGasUsed = BigInt(0);
                let maxFulfillRandomWordsGasUsed = BigInt(0);
                let allLinkUsed = BigInt(0);
                let maxLinkUsed = BigInt(0);

                let openTxFee = BigInt(0);
                let openGasUsed = BigInt(0);
                let maxOpenGasUsed = BigInt(0);

                let scriptOpenBoxResult;

                for (let i = 0; i < tokenMinter1MintNumber; i++) {
                    scriptOpenBoxResult = await scriptOpenBox(prizePool, tokenMinter1, ticketNFTInstance.address, i, vRFCoordinatorV2Mock);
                    openTxFee += scriptOpenBoxResult.openTxFee
                    openGasUsed += scriptOpenBoxResult.openGasUsed
                    maxOpenGasUsed = scriptOpenBoxResult.openGasUsed > maxOpenGasUsed ? scriptOpenBoxResult.openGasUsed : maxOpenGasUsed

                    openNReceiveTxFee += scriptOpenBoxResult.allTxFee
                    openNReceiveGasUsed += scriptOpenBoxResult.allGasUsed
                    allFulfillRandomWordsGasUsed += scriptOpenBoxResult.fulfillRandomWordsGasUsed
                    maxFulfillRandomWordsGasUsed = scriptOpenBoxResult.fulfillRandomWordsGasUsed > maxFulfillRandomWordsGasUsed ? scriptOpenBoxResult.fulfillRandomWordsGasUsed : maxFulfillRandomWordsGasUsed

                    allLinkUsed += BigInt(scriptOpenBoxResult.linkUsed);
                    maxLinkUsed = scriptOpenBoxResult.linkUsed > maxLinkUsed ? BigInt(scriptOpenBoxResult.linkUsed) : maxLinkUsed
                }
                for (let i = tokenMinter1MintNumber; i < tokenMinter1MintNumber + tokenMinter2MintNumber; i++) {
                    scriptOpenBoxResult = await scriptOpenBox(prizePool, tokenMinter2, ticketNFTInstance.address, i, vRFCoordinatorV2Mock);
                    openTxFee += scriptOpenBoxResult.openTxFee
                    openGasUsed += scriptOpenBoxResult.openGasUsed
                    maxOpenGasUsed = scriptOpenBoxResult.openGasUsed > maxOpenGasUsed ? scriptOpenBoxResult.openGasUsed : maxOpenGasUsed

                    openNReceiveTxFee += scriptOpenBoxResult.allTxFee
                    openNReceiveGasUsed += scriptOpenBoxResult.allGasUsed
                    allFulfillRandomWordsGasUsed += scriptOpenBoxResult.fulfillRandomWordsGasUsed
                    maxFulfillRandomWordsGasUsed = scriptOpenBoxResult.fulfillRandomWordsGasUsed > maxFulfillRandomWordsGasUsed ? scriptOpenBoxResult.fulfillRandomWordsGasUsed : maxFulfillRandomWordsGasUsed

                    allLinkUsed += BigInt(scriptOpenBoxResult.linkUsed);
                    maxLinkUsed = scriptOpenBoxResult.linkUsed > maxLinkUsed ? BigInt(scriptOpenBoxResult.linkUsed) : maxLinkUsed
                }


                const tokenMinter1ValueAfterAward = (await ethers.provider.getBalance(tokenMinter1.address)).toBigInt();
                const tokenMinter2ValueAfterAward = (await ethers.provider.getBalance(tokenMinter2.address)).toBigInt();
                const prizeContractValueAfterAward = (await ethers.provider.getBalance(prizePool.address)).toBigInt();
                const prizeContractDiff = prizeContractValueAfterAward - prizeContractValueBeforeAward;
                const tokenMinter1ValueDiff = tokenMinter1ValueAfterAward - tokenMinter1ValueBeforeAward;
                const tokenMinter2ValueDiff = tokenMinter2ValueAfterAward - tokenMinter2ValueBeforeAward;
                const customerValueDiff = tokenMinter1ValueDiff + tokenMinter2ValueDiff;
                const openNReceiveDiff = BigInt(customerValueDiff) + BigInt(prizeContractDiff) + BigInt(openNReceiveTxFee);

                allUserGasUsed += openNReceiveGasUsed;
                allUserTxFee += openNReceiveTxFee;
                console.log(`prizePool after reward value ${prizeContractValueAfterAward}`);
                console.log(`tokenMinter1ValueDiff ${ethers.utils.formatEther(tokenMinter1ValueDiff)}`);
                console.log(`tokenMinter2ValueDiff ${ethers.utils.formatEther(tokenMinter2ValueDiff)}`);
                console.log(`prizeContractDiff ${ethers.utils.formatEther(prizeContractDiff)}`);

                console.log(`customerValueDiff ${ethers.utils.formatEther(customerValueDiff)}`);
                console.log(`openNReceiveDiff:  ${ethers.utils.formatEther(BigInt(customerValueDiff) + BigInt(prizeContractDiff) + BigInt(openNReceiveTxFee))}`);

                console.log(`ticketMintTxFee ${ethers.utils.formatEther(ticketMintTxFee)}`);
                console.log(`ticketMintGasUsed ${ticketMintGasUsed}`);
                console.log(`ticketMintGasUsed average ${ticketMintGasUsed / prizeCount}`);

                console.log(`openTxFee ${ethers.utils.formatEther(openTxFee)}`);
                console.log(`openGasUsed ${openGasUsed}`);
                console.log(`openGasUsed average ${openGasUsed / prizeCount}`);
                console.log(`maxOpenGasUsed ${maxOpenGasUsed}`);

                console.log(`openNReceiveTxFee ${ethers.utils.formatEther(openNReceiveTxFee)}`);
                console.log(`openNReceiveGasUsed ${openNReceiveGasUsed}`);
                console.log(`openNReceiveGasUsed average ${openNReceiveGasUsed / prizeCount}`);

                console.log(`allUserTxFee ${ethers.utils.formatEther(allUserTxFee)}`);
                console.log(`allUserGasUsed ${allUserGasUsed}`);
                console.log(`allUserGasUsed average ${allUserGasUsed / prizeCount}`);

                console.log(`allFulfillRandomWordsGasUsed ${allFulfillRandomWordsGasUsed}`);
                console.log(`allFulfillRandomWordsGasUsed average ${allFulfillRandomWordsGasUsed / prizeCount}`);
                console.log(`maxFulfillRandomWordsGasUsed ${maxFulfillRandomWordsGasUsed}`);

                let allProjectTxFee = BigInt(0);
                let allProjectGasUsed = BigInt(0);
                allProjectTxFee += allDeployTxFee;
                allProjectGasUsed += allDeployGasUsed;
                allProjectTxFee += allSettleTicketTxFee;
                allProjectGasUsed += allSettleTicketGasUsed;
                allProjectTxFee += allSettlePrizeTxFee;
                allProjectGasUsed += allSettlePrizeGasUsed;

                console.log(`allProjectTxFee ${ethers.utils.formatEther(allProjectTxFee)}`);
                console.log(`allProjectGasUsed ${allProjectGasUsed}`);
                console.log(`allProjectGasUsed average ${allProjectGasUsed / prizeCount}`);

                console.log(`allLinkUsed ${ethers.utils.formatUnits(allLinkUsed, "ether")}`);
                console.log(`allLinkUsed average ${ethers.utils.formatUnits(allLinkUsed / prizeCount, "ether")}`);
                console.log(`maxLinkUsed ${ethers.utils.formatUnits(maxLinkUsed, "ether")}`);

                await expect(openNReceiveDiff).to.be.eq(0);

            });


    });
});
