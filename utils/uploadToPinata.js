const pinataSDK = require("@pinata/sdk")
const path = require("path")
const fs = require("fs")
require("dotenv").config()

const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET)

async function storeImages(imagesFilePath) {
    const fullImagesPath = path.resolve(imagesFilePath)
    const files = fs.readdirSync(fullImagesPath)
    console.log(files)
    let responses = []
    console.log("Uploading to Pinata!")
    for (fileIndex in files) {
        let options = {
            pinataMetadata: {
                name: `${files[fileIndex]}`,
            },
        }
        const readableStreamForFile = fs.createReadStream(`${fullImagesPath}/${files[fileIndex]}`)
        try {
            console.log(`Uploading ${files[fileIndex]}`)
            const response = await pinata.pinFileToIPFS(readableStreamForFile, options)
            responses.push(response)
        } catch (e) {
            console.log(e.message)
        }
    }
    return { responses, files }
}

async function storeTokenUriMetadata(metadata) {
    try {
        const response = await pinata.pinJSONToIPFS(metadata)
        return response
    } catch (error) {
        console.log(error)
    }
    return null
}

module.exports = { storeImages, storeTokenUriMetadata }
