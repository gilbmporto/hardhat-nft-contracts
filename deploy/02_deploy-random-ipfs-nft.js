const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const { storeImages, storeTokenUriMetadata } = require("../utils/uploadToPinata")

const imagesLocation = "./images/randomNft"

const metadataTemplate = {
    name: "",
    description: "",
    image: "",
    attributes: [
        {
            trait_type: "Cuteness",
            value: 100,
        },
    ],
}

let tokenUris = [
    "ipfs://QmdM6nLhSkZgngNjhKu4xadphzuP1siPtCaZvq1B2iopR2",
    "ipfs://QmPkaJ5eh3M5fMrXzXtxK4n2zdRJYEMqDvnjc6jnKsFc4u",
    "ipfs://QmciEtnnFLZe29Nx2c7qRpDW621FrnrJRTyHV7mz5WG1mw",
]

const FUND_AMOUNT = "10000000000000000000" // 10 LINK

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    // We need to get the IPFS hashes of our images
    if (process.env.UPLOAD_TO_PINATA === "true") {
        tokenUris = await handleTokenUris()
    }

    let vrfCoordinatorV2Address, subscriptionId

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const tx = await vrfCoordinatorV2Mock.createSubscription()
        const txReceipt = await tx.wait(1)
        subscriptionId = txReceipt.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
        subscriptionId = networkConfig[chainId].subscriptionId
    }

    log("-------------------------------------------")
    // await storeImages(imagesLocation)

    const args = [
        vrfCoordinatorV2Address,
        subscriptionId,
        networkConfig[chainId].gasLane,
        networkConfig[chainId].callbackGasLimit,
        tokenUris,
        networkConfig[chainId].mintFee,
    ]

    const randomIpfsNft = await deploy("RandomIpfsNft", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    log("-------------------------------------------")

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), randomIpfsNft.address)
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying contract deployed with EtherScan...")
        await verify(randomIpfsNft.address, args)
    }
    log("-----------------------------------------")
}

async function handleTokenUris() {
    tokenUris = []
    // Store the image in IPFS
    // Store the metadata in IPFS
    const { responses: imageUploadResponses, files } = await storeImages(imagesLocation)
    try {
        for (imageUploadResponseIndex in imageUploadResponses) {
            // Create metadata
            // Upload the metadata
            let tokenUriMetadata = { ...metadataTemplate }
            tokenUriMetadata.name = files[imageUploadResponseIndex].replace(".png", "")
            tokenUriMetadata.description = `A really cute ${tokenUriMetadata.name} pup!`
            tokenUriMetadata.image = `ipfs://${imageUploadResponses[imageUploadResponseIndex].IpfsHash}`
            console.log(`Uploading ${tokenUriMetadata.name}...`)
            // Now, we'll store this JSON to Pinata (IPFS)
            const metadataUploadResponse = await storeTokenUriMetadata(tokenUriMetadata)
            tokenUris.push(`ipfs://${metadataUploadResponse.IpfsHash}`)
        }
        console.log("Token URIs were successfully updated! They are:")
        console.log(tokenUris)
        return tokenUris
    } catch (error) {
        console.log(error)
    }
}

module.exports.tags = ["all", "randomipfs", "main"]
