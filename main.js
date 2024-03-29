const mineflayer = require('mineflayer')
const fs = require('fs')
const lodash = require("lodash")
const yaml = require('js-yaml')
const pathfinder = require('mineflayer-pathfinder').pathfinder
const Movements = require('mineflayer-pathfinder').Movements
const { GoalNear } = require('mineflayer-pathfinder').goals
const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

const indexIslands = yaml.load(fs.readFileSync('to_index.yml', 'utf8'))
//const indexIslands = yaml.load(fs.readFileSync("temp_index.yml", 'utf8'))

let prices = []

const bot = mineflayer.createBot({
    host: 'skyblock.net',
    port: 25565,
    username: 'username',
    password: 'Password',
    version: false,
    auth: 'mojang'
})

bot.loadPlugin(pathfinder)

function searchSigns() {
    const signVectors = bot.findBlocks({
        matching: function (block) {
            return block.name === 'oak_wall_sign'
        },
        maxDistance: 256,
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
                if (!lodash.some(prices, price)) //Checks if price is a duplicate
                    prices.push(price)
            }
        }
    }
}

async function scrape() {
    console.log("scraping...")
    await searchSigns()
}

async function gotoPos(x, y, z, near = 4) {
    console.log(`going to ${x}, ${y}, ${z}`)
    
    const {data} = await new Promise( resolve => {
        bot.on("goal_reached", resolve)
        bot.on("path_update", (data) => {
            if (["timeout", "noPath"].includes(data.status)) {
                resolve("failed")
            }
        })

        bot.pathfinder.setGoal(new GoalNear(x, y, z, near))
    })

    return data
}


async function scrapeIslands() {
    for (const island of indexIslands["islands"]) {
        await sleep(randomNumber(2000, 8000))
        console.log(`Visiting ${island["island"]}`)
        bot.chat(`/visit ${island["island"]}`)

        if (island.hasOwnProperty("locations")) {
            await sleep(3000)
            if (island["snap_on_visit"] === "yes") {
                await sleep(2000)
                await scrape()
            }

            for (const location of island["locations"]) {
                await gotoPos(location["x"], location["y"], location["z"])
                await sleep(2000)
                await scrape()
            }
        } else {
            await sleep(5000)
            await scrape()
        }
    }
}


function convertToCSV(objArray) {
    let array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
    let str = '';

    for (const row of array) {
        let line = '';
        for (const [key, item] of Object.entries(row)) {
            if (line !== '') line += ','

            line += item;
        }

        str += line + '\r\n';
    }

    return str;
}


function randomNumber(min, max){
    const r = Math.random()*(max-min) + min
    return Math.floor(r)
}


bot.on('spawn', async () => {
    const mcData = require('minecraft-data')(bot.version)
    const defaultMove = new Movements(bot, mcData)
    defaultMove.canDig = false
    defaultMove.maxDropDown = 256
    bot.pathfinder.setMovements(defaultMove)

    console.log("spawned and starting!")
    await sleep(3402)
    await scrapeIslands()

    const output = convertToCSV(prices)
    fs.writeFile('prices.csv', output + '\n', function (err) {if (err) throw err})
    console.log("Scraping complete!")
})
