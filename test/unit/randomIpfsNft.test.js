const { expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Random IPFS NFT Unit Tests", function () {
        let randomIpfsNft, deployer, vrfCoordinatorV2Mock

        beforeEach(async () => {
            accounts = await ethers.getSigners()
            deployer = accounts[0]
            await deployments.fixture(["mocks", "randomipfs"])
            randomIpfsNft = await ethers.getContract("RandomIpfsNft")
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        })

        describe("Testing constructor", () => {
            it("The starting params are correct", async function () {
                const dogTokenUri0 = await randomIpfsNft.getDogTokenUris(0)
                const mintFee = (await randomIpfsNft.getMintFee()).toString()
                expect(dogTokenUri0).to.contain("ipfs://")
                expect(mintFee).to.equal(ethers.utils.parseUnits("0.01"))
            })
        })

        describe("Testing requestNft", () => {
            it("Should fail if payment isn't sent with the request", async function () {
                await expect(randomIpfsNft.requestNft()).to.be.revertedWithCustomError(
                    randomIpfsNft,
                    "RandomIpfsNft__NeedMoreETHToMint"
                )
            })
            it("Always reverts if payment amount is less than the mint fee", async function () {
                await expect(
                    randomIpfsNft.requestNft({
                        value: ethers.utils.parseEther("0.001"),
                    })
                ).to.be.revertedWithCustomError(randomIpfsNft, "RandomIpfsNft__NeedMoreETHToMint")
            })
            it("Emits an event and starts a random word request", async function () {
                const fee = await randomIpfsNft.getMintFee()
                await expect(randomIpfsNft.requestNft({ value: fee.toString() })).to.emit(
                    randomIpfsNft,
                    "NftRequested"
                )
            })
        })

        describe("Testing fulfillRandomWords", () => {
            it("Mints NFT after random number is returned", async function () {
                await new Promise(async (resolve, reject) => {
                    randomIpfsNft.once("NftMinted", async () => {
                        try {
                            const tokenUri = await randomIpfsNft.tokenURI("0")
                            const tokenCounter = await randomIpfsNft.getTokenCounter()
                            expect(tokenUri.toString()).to.contain("ipfs://")
                            expect(tokenCounter).to.equal("1")
                            resolve()
                        } catch (e) {
                            console.log(e)
                            reject(e)
                        }
                    })
                    try {
                        const fee = await randomIpfsNft.getMintFee()
                        const requestNftResponse = await randomIpfsNft.requestNft({
                            value: fee.toString(),
                        })
                        const requestNftReceipt = await requestNftResponse.wait(1)
                        // console.log(requestNftReceipt.events[1].args)
                        await vrfCoordinatorV2Mock.fulfillRandomWords(
                            requestNftReceipt.events[1].args.requestId,
                            randomIpfsNft.address
                        )
                    } catch (e) {
                        console.log(e)
                        reject(e)
                    }
                })
            })
        })

        describe("Testing getBreedFromModdedRng", () => {
            it("Must return a pug if moddedRng < 10", async () => {
                const dogNumber = (await randomIpfsNft.getBreedFromModdedRng(5)).toString()
                expect(dogNumber).to.equal("0")
            })
            it("Must return a shiba-inu if moddedRng is between 10 - 39", async () => {
                const dogNumber = (await randomIpfsNft.getBreedFromModdedRng(29)).toString()
                expect(dogNumber).to.equal("1")
            })
            it("Must return a st. bernard if moddedRng is between 40 - 99", async () => {
                const dogNumber = (await randomIpfsNft.getBreedFromModdedRng(88)).toString()
                expect(dogNumber).to.equal("2")
            })
            it("Must revert if moddedRng > 99", async () => {
                await expect(
                    randomIpfsNft.getBreedFromModdedRng(101)
                ).to.be.revertedWithCustomError(randomIpfsNft, "RandomIpfsNft__RangeOutOfBounds")
            })
        })
    })
