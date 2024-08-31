const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

const SILVER = '\x1b[38;5;231m';
const LIGHT_PINK = '\x1b[38;5;207m';
const PINK = '\x1b[38;5;13m';
const YELLOW = '\x1b[38;5;11m';
const GREEN = '\x1b[38;5;10m';
const RED = '\x1b[38;5;9m';
const RESET = '\x1b[0m';

const ERROR_LOG_PATH = 'failed_accounts.txt';
const PROXIES_FILE_PATH = 'proxies.txt'; // Path to the proxies file

async function readProxies(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const proxies = [];
    for await (const line of rl) {
        if (line.trim()) {
            const parts = line.split(':');
            if (parts.length === 4) {
                const [ip, port, username, password] = parts;
                proxies.push({ server: `${ip}:${port}`, username, password });
            } else {
                console.error(`Proxy format error: ${line}`);
            }
        }
    }
    return proxies;
}

async function countNonEmptyLines(filePath) {
    if (!fs.existsSync(filePath)) return 0;
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    return lines.filter(line => line.trim()).length;
}

async function readAccounts(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const links = [];
    for await (const line of rl) {
        if (line.trim()) links.push(line.trim());
    }
    return links;
}

async function printCustomLogo(blink = false) {
    const logo = [
        " 🛒🛒🛒    🛒       🛒  🛒      🛒      🛒🛒      🛒🛒🛒  🛒🛒🛒🛒🛒 ",
        "🛒    🛒   🛒       🛒  🛒🛒  🛒🛒     🛒  🛒     🛒    🛒    🛒 ",
        "🛒         🛒       🛒  🛒 🛒🛒 🛒    🛒🛒🛒🛒    🛒    🛒    🛒",
        "🛒   🛒🛒  🛒       🛒  🛒  🛒  🛒   🛒      🛒   🛒🛒🛒🛒    🛒 ",
        "🛒    🛒   🛒       🛒  🛒      🛒  🛒        🛒  🛒    🛒    🛒",
        " 🛒🛒🛒     🛒🛒🛒🛒🛒  🛒      🛒 🛒          🛒 🛒     🛒   🛒",
        "                                                                         ",
        "chờ một lát..."
    ];
    console.clear();
    for (let i = 0; i < 5; i++) {
        if (blink) {
            console.log('\x1b[5m\x1b[32m' + logo.join('\n') + '\x1b[0m');
        } else {
            console.log('\x1b[5m\x1b[32m' + logo.join('\n'));
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        console.clear();
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

async function processAccount(context, accountUrl, accountNumber, proxy) {
    const page = await context.newPage();
    let success = false;
    try {
        console.log(`\x1b[38;5;207m🐮 Đang chạy tài khoản \x1b[38;5;11m${accountNumber} \x1b[38;5;207mIP \x1b[38;5;11m:\x1b[38;5;13m${proxy.server}`);
        await page.goto(accountUrl);

        // Check for page load
        const pageLoadedSelector = '#__nuxt > div > div > div.fixed.bottom-0.w-full.left-0.z-\\[12\\] > div > div.grid.grid-cols-5.w-full.gap-2 > button:nth-child(3) > div > div.shadow_filter.w-\\[4rem\\].h-\\[4rem\\].absolute.-translate-y-\\[50\\%\\] > img';
        await page.waitForSelector(pageLoadedSelector, { timeout: 10000 });
        console.log(`\x1b[38;5;10mĐã Vào Giao diện ${await page.title()} Acc \x1b[38;5;11m${accountNumber}`);

        const claimButtonSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > div > div > div > div.transition-all > button';
        await page.waitForSelector(claimButtonSelector, { visible: true, timeout: 1200 });
        await page.click(claimButtonSelector);

        const imgSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > button > div > p';
        let imgElementFound = false;

        try {
            await page.waitForSelector(imgSelector, { visible: true, timeout: 300 });
            await page.click(imgSelector);
            imgElementFound = true;
        } catch (error) {
        }

        if (!imgElementFound) {

            const timeSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > button > div > div > p';
            const timeElement = await page.waitForSelector(timeSelector);
            const time = await timeElement.evaluate(el => el.innerText); // Use evaluate to get the text
            console.log(`\x1b[38;5;9mX2 Của Acc \x1b[38;5;11m${accountNumber} Còn ${time} Mới Mua Được...`);
        }

        await page.waitForTimeout(400);

        // Get points information
        const pointsSelector = '#__nuxt > div > div > section > div.w-full.flex.flex-col.gap-4.px-4.py-2.relative.z-\\[3\\] > div.flex.flex-col.gap-2.items-center > div > p';
        const pointsElement = await page.waitForSelector(pointsSelector);
        const points = await pointsElement.evaluate(el => el.innerText); // Use evaluate to get the text
        console.log(`Đã claim point thành công ✅ Số dư : ${points}`);

        console.log(`${GREEN}Đã làm xong acc ${accountNumber} ✅`);
        success = true;
    } catch (e) {
        console.log(`Tài khoản số ${accountNumber} gặp lỗi`);
        await logFailedAccount(accountNumber);
    } finally {
        await page.close();
    }
    return { success };
}

async function runPlaywrightInstances(links, numAccounts, proxies) {
    const concurrencyLimit = 10; // Number of browsers to run concurrently
    const totalProxies = proxies.length;
    let proxyIndex = 0; // To track the current proxy being used

    let totalSuccessCount = 0;
    let totalFailureCount = 0;

    let accountsProcessed = 0; // Track the number of accounts processed
    let remainingLinks = links.slice(0, numAccounts); // Process only the number of accounts specified

    while (remainingLinks.length > 0) {
        const batchSize = Math.min(concurrencyLimit, remainingLinks.length);
        const batchAccounts = remainingLinks.splice(0, batchSize); // Get the next batch of accounts

        // Determine the proxies for this batch
        const batchProxies = [];
        for (let i = 0; i < batchSize; i++) {
            batchProxies.push(proxies[proxyIndex % totalProxies]);
            proxyIndex++;
        }

        // Launch and handle each browser with its corresponding proxy
        const browserPromises = batchAccounts.map(async (accountUrl, index) => {
            const proxy = batchProxies[index]; // Use the proxy for this specific account
            const browser = await chromium.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--headless',            
                    `--proxy-server=${proxy.server}`
                ]
            });
            const context = await browser.newContext({
                httpCredentials: {
                    username: proxy.username,
                    password: proxy.password
                }
            });

            try {
                const result = await processAccount(context, accountUrl, accountsProcessed + index + 1, proxy);
                if (result.success) {
                    totalSuccessCount++;
                } else {
                    totalFailureCount++;
                }
            } catch (e) {
                console.log(`Tài khoản số ${accountsProcessed + index + 1} gặp lỗi`);
                totalFailureCount++;
            } finally {
                await browser.close();
            }
        });

        await Promise.all(browserPromises);
        accountsProcessed += batchSize; // Update number of processed accounts
    }

    // Final report
    console.log(`${GREEN}Tổng số tài khoản thành công: ${totalSuccessCount}`);
    console.log(`${RED}Tổng số tài khoản lỗi: ${totalFailureCount}`);
}

async function logFailedAccount(accountNumber) {
    fs.appendFileSync(ERROR_LOG_PATH, `Tài khoản số ${accountNumber}\n`);
}

async function countdownTimer(seconds) {
    for (let i = seconds; i >= 0; i--) {
        process.stdout.write(`\r\x1b[38;5;9mĐang nghỉ ngơi còn lại \x1b[38;5;11m${i} \x1b[38;5;9mgiây `);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log(); // Move to the next line after countdown
}

(async () => {
    await printCustomLogo(true);
    const filePath = 'gumart.txt';

    try {
        const proxies = await readProxies(PROXIES_FILE_PATH);
        if (proxies.length === 0) {
            console.log(`${RED}Không tìm thấy proxy nào.`);
            return;
        }

        while (true) {
            const nonEmptyLines = await countNonEmptyLines(filePath);
            if (nonEmptyLines === 0) {
                console.log(`${RED}File không chứa tài khoản nào.`);
                break;
            }

            const links = await readAccounts(filePath);
            console.log(`${SILVER}GUMART 🛒 ${LIGHT_PINK}code by 🐮${RESET}`);
            console.log(`${LIGHT_PINK}tele${YELLOW}: ${PINK}tphuc_0 ${RESET}`);
            console.log(`${GREEN}Hiện tại bạn có ${YELLOW}${nonEmptyLines}${GREEN} tài khoản `);

            const userInput = await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${GREEN}Nhập số lượng tài khoản muốn 🐮 chạy ${YELLOW}(${GREEN}hoặc ${YELLOW}'all' ${GREEN}để chạy tất cả${YELLOW}, ${RED}0 ${GREEN}để thoát${YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            });

            let numAccounts;
            if (userInput.toLowerCase() === 'all') {
                numAccounts = links.length;
            } else if (!isNaN(userInput)) {
                numAccounts = parseInt(userInput, 10);
                if (numAccounts <= 0) {
                    break;
                }
                if (numAccounts > links.length) {
                    numAccounts = links.length;
                }
            } else {
                console.log(`${RED}Nhập không hợp lệ!`);
                continue;
            }

            const restTime = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${GREEN}Nhập thời gian nghỉ ngơi sau khi 🐮 chạy xong tất cả các tài khoản ${YELLOW}(${GREEN}Khuyên ${YELLOW}9000 ${GREEN}nha${YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            const repeatCount = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${GREEN}Nhập số lần lặp lại sau thời gian nghỉ ngơi ${YELLOW}(${GREEN}hoặc ${YELLOW}0 ${GREEN}để chạy một lần): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            if (isNaN(repeatCount) || repeatCount < 0) {
                console.log(`${RED}Nhập không hợp lệ!`);
                continue;
            }

            // Run the Playwright instances and get the number of accounts processed
            for (let i = 0; i <= repeatCount; i++) {
                console.log(`\x1b[38;5;231mChạy lần \x1b[38;5;10m${i + 1}`);
                await runPlaywrightInstances(links, numAccounts, proxies);

                if (i < repeatCount) { // Only rest if more repeats are needed
                    await countdownTimer(restTime); // Display countdown timer
                }
            }

            console.log(`${GREEN}Đã hoàn tất tất cả các vòng lặp.`);
        }
    } catch (e) {
        console.log(`Lỗi: ${e.message}`);
    }
})();