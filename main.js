const mineflayer = require('mineflayer')
const fs = require('fs')
const yaml = require('js-yaml')
const pathfinder = require('mineflayer-pathfinder').pathfinder
const Movements = require('mineflayer-pathfinder').Movements
const { GoalNear } = require('mineflayer-pathfinder').goals
const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

const indexIslands = yaml.load(fs.readFileSync('to_index.yml', 'utf8'))

let prices = []

//const bot = mineflayer.createBot({
//    host: 'skyblock.net',
//    port: 25565,
//    username: 'tcm4760@gmail.com',
//    password: 'snD6oPqEkgZKA!hBCcvN',
//    version: false,
//    auth: 'mojang'
//})

const bot = mineflayer.createBot({
    host: '127.0.0.1',
    port: 25565,
    username: 'temi_bot',
    version: false,
    auth: 'mojang'
})

bot.loadPlugin(pathfinder)

function searchSigns() {
    const signVectors = bot.findBlocks({
        matching: function (block) {
            return block.name === 'oak_wall_sign'
        },
        maxDistance: 128,
        count: 1000
    })

    for (const blockVector of signVectors) {
        const block = bot.blockAt(blockVector, extraInfos = true)
        const textArray = block.signText.split("\n")

        const buySellStr = textArray[2].replace(/\s+/g, '') //Removes white space
        const buySellSplit = buySellStr.split(":") //Separates buy and sell statements

        for (const priceStr of buySellSplit) {
            const priceArr = priceStr.split(/([0-9]+)/).sort()  //Splits by integers and insures number is first with sort
            if (["B", "S"].includes(priceArr[2])) {
                const price = {
                    userName: textArray[0],
                    quantity: textArray[1],
                    buy: priceArr[2] === "B",
                    cost: priceArr[1],
                    item: textArray[3],
                    pricePer: priceArr[1] / textArray[1]
                }
                console.log(price)
                prices.push(price)
            }
        }
    }
}

async function scrape() {
    await searchSigns()
}

async function gotoPos(x, y, z) {

}


async function scrapeIslands() {
    for (const island of indexIslands) {
        console.log(`Visiting ${island["player"]}`)
        bot.chat(`/visit ${island["player"]}`)

        if (island.hasOwnProperty("locations")) {
            await sleep(3000)
            if (island["snap_on_visit"]) {
                await sleep(2000)
                await scrape()
            }

            for (const location of island["locations"]) {
                await gotoPos(location["x"], location["y"], location["z"])
                await sleep(2000)
                await scrape()
            }

            return
        }

        await sleep(5000)
        await scrape()
    }
}

bot.on('chat', async (username, message) => {
    if (username === "wateryoolukinat" && message.includes("here")) {
        let player = bot.players["wateryoolukinat"]
        if (player.entity !== null) {
            console.log("going to jo")
            bot.chat("/msg wateryoolukinat coming!")
            let position = player.entity.position
            bot.pathfinder.setGoal(new GoalNear(position.x, position.y, position.z, 1))
        } else {
            bot.chat("/msg wateryoolukinat ur too far")
        }
    } else if (username === "wateryoolukinat" && message.includes("do it")) {
        await scrape()
        bot.chat("/msg wateryoolukinat did it")
    } else if (username === "wateryoolukinat" && message.includes("goto ")) {
        const place = message.split("goto ")
        bot.chat(`/msg wateryoolukinat going to ${place[1]}`)
        bot.chat(`/visit ${place[1]}`)
    }
})

bot.on('spawn', async () => {
    const mcData = require('minecraft-data')(bot.version)
    const defaultMove = new Movements(bot, mcData)
    bot.pathfinder.setMovements(defaultMove)

    console.log("spawned and starting!")
    await sleep(3402)
    await scrapeIslands()

    fs.writeFile('prices.json', JSON.stringify(prices) + '\n', function (err) {if (err) throw err})
    console.log("Scraping complete!")
})