const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

const COLORS = {
    SILVER: '\x1b[38;5;231m',
    LIGHT_PINK: '\x1b[38;5;207m',
    PINK: '\x1b[38;5;13m',
    YELLOW: '\x1b[38;5;11m',
    GREEN: '\x1b[38;5;10m',
    RED: '\x1b[38;5;9m',
    RESET: '\x1b[0m'
};

const ERROR_LOG_PATH = 'failed_accounts.txt';
const PROXIES_FILE_PATH = 'proxies.txt'; // Path to the proxies file

async function readProxies(filePath) {
    const proxies = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
            const parts = trimmedLine.split(':');
            if (parts.length === 4) {
                const [ip, port, username, password] = parts;
                proxies.push({ server: `${ip}:${port}`, username, password });
            } else {
                console.error(`${COLORS.RED}Proxy format error: ${line}${COLORS.RESET}`);
            }
        }
    }
    return proxies;
}

async function countNonEmptyLines(filePath) {
    let count = 0;
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (line.trim()) count++;
    }
    return count;
}

async function readAccounts(filePath) {
    const links = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        const trimmedLine = line.trim();
        if (trimmedLine) links.push(trimmedLine);
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
        console.log((blink ? '\x1b[5m' : '') + `${COLORS.GREEN}${logo.join('\n')}${COLORS.RESET}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        console.clear();
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

async function processAccount(browserContext, accountUrl, accountNumber, proxy) {
    const page = await browserContext.newPage();
    try {
        console.log(`${COLORS.PINK}🐮 Đang chạy tài khoản ${COLORS.YELLOW}${accountNumber} ${COLORS.PINK}IP ${COLORS.YELLOW}:${COLORS.PINK}${proxy.server}${COLORS.RESET}`);
        await page.goto(accountUrl, { waitUntil: 'networkidle' });

        const pageLoadedSelector = '#__nuxt > div > div > div.fixed.bottom-0.w-full.left-0.z-\\[12\\] > div > div.grid.grid-cols-5.w-full.gap-2 > button:nth-child(3) > div > div.shadow_filter.w-\\[4rem\\].h-\\[4rem\\].absolute.-translate-y-\\[50\\%\\] > img';
        await page.waitForSelector(pageLoadedSelector, { timeout: 20000 });
        console.log(`${COLORS.GREEN}Đã vào giao diện ${await page.title()} Acc ${COLORS.YELLOW}${accountNumber}${COLORS.RESET}`);

        const claimButtonSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > div > div > div > div.transition-all > button';
        await page.waitForSelector(claimButtonSelector, { visible: true, timeout: 1200 });
        await page.click(claimButtonSelector);

        const imgSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > button > div > p';
        let imgElementFound = true;

        try {
            await page.waitForSelector(imgSelector, { visible: true, timeout: 300 });
            await page.click(imgSelector);
            imgElementFound = false;
        } catch (error) {
            imgElementFound = true;
        }

        if (!imgElementFound) {
            const timeSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > button > div > div > p';
            const timeElement = await page.waitForSelector(timeSelector);
            const time = await timeElement.evaluate(el => el.innerText);
            console.log(`${COLORS.RED}X2 của Acc ${COLORS.YELLOW}${accountNumber} còn ${time} mới mua được...${COLORS.RESET}`);
        }

        await page.waitForTimeout(400);

        const pointsSelector = '#__nuxt > div > div > section > div.w-full.flex.flex-col.gap-4.px-4.py-2.relative.z-\\[3\\] > div.flex.flex-col.gap-2.items-center > div > p';
        const pointsElement = await page.waitForSelector(pointsSelector);
        const points = await pointsElement.evaluate(el => el.innerText);
        console.log(`Đã claim point thành công ✅ Số dư : ${points}${COLORS.RESET}`);

        console.log(`${COLORS.GREEN}Đã làm xong acc ${accountNumber} ✅${COLORS.RESET}`);
    } catch (e) {
        console.log(`${COLORS.RED}Tài khoản số ${accountNumber} gặp lỗi: ${e.message}${COLORS.RESET}`);
        await logFailedAccount(accountNumber, e.message);
        return false; // Indicate that this account failed
    } finally {
        await page.close();
    }
    return true; // Indicate that this account succeeded
}

async function runPlaywrightInstances(links, proxies, maxBrowsers) {
    let totalSuccessCount = 0;
    let totalFailureCount = 0;
    let proxyIndex = 0;
    let activeCount = 0;

    async function processAccountWithBrowser(accountUrl, accountNumber, proxy) {
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--headless',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                `--proxy-server=${proxy.server}`
            ]
        });

        const browserContext = await browser.newContext({
            httpCredentials: {
                username: proxy.username,
                password: proxy.password
            }
        });

        let accountSuccess = false;
        try {
            accountSuccess = await processAccount(browserContext, accountUrl, accountNumber, proxy);
            if (accountSuccess) totalSuccessCount++;
            else totalFailureCount++;
        } catch (error) {
            totalFailureCount++;
            console.log(`${COLORS.RED}Tài khoản ${accountNumber} gặp lỗi: ${error.message}${COLORS.RESET}`);
        } finally {
            await browserContext.close();
            await browser.close();
        }
    }

    const accountQueue = [...links];
    while (accountQueue.length > 0 || activeCount > 0) {
        while (activeCount < maxBrowsers && accountQueue.length > 0) {
            const accountUrl = accountQueue.shift();
            const accountNumber = links.indexOf(accountUrl) + 1;
            const proxy = proxies[proxyIndex % proxies.length];
            proxyIndex++;

            activeCount++;
            processAccountWithBrowser(accountUrl, accountNumber, proxy)
                .finally(() => {
                    activeCount--;
                    console.log(`${COLORS.GREEN}Hoàn tất tài khoản ${accountNumber}${COLORS.RESET}`);
                });
        }

        if (activeCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.log(`${COLORS.GREEN}Hoàn tất xử lý tất cả tài khoản${COLORS.RESET}`);
    console.log(`${COLORS.SILVER}Tổng tài khoản thành công: ${COLORS.YELLOW}${totalSuccessCount}${COLORS.RESET}`);
    console.log(`${COLORS.SILVER}Tổng tài khoản lỗi: ${COLORS.YELLOW}${totalFailureCount}${COLORS.RESET}`);
}

async function logFailedAccount(accountNumber, errorMessage) {
    fs.appendFileSync(ERROR_LOG_PATH, `Tài khoản số ${accountNumber} gặp lỗi: ${errorMessage}\n`);
}

async function countdownTimer(seconds) {
    for (let i = seconds; i >= 0; i--) {
        process.stdout.write(`\r${COLORS.RED}Đang nghỉ ngơi còn lại ${COLORS.YELLOW}${i} ${COLORS.RED}giây${COLORS.RESET}`);
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
            console.log(`${COLORS.RED}Không tìm thấy proxy nào.${COLORS.RESET}`);
            return;
        }

        while (true) {
            const nonEmptyLines = await countNonEmptyLines(filePath);
            if (nonEmptyLines === 0) {
                console.log(`${COLORS.RED}File không chứa tài khoản nào.${COLORS.RESET}`);
                break;
            }

            const links = await readAccounts(filePath);
            console.log(`${COLORS.SILVER}GUMART 🛒 ${COLORS.LIGHT_PINK}code by 🐮${COLORS.RESET}`);
            console.log(`${COLORS.LIGHT_PINK}tele${COLORS.YELLOW}: ${COLORS.PINK}tphuc_0 ${COLORS.RESET}`);
            console.log(`${COLORS.GREEN}Hiện tại bạn có ${COLORS.YELLOW}${nonEmptyLines}${COLORS.GREEN} tài khoản${COLORS.RESET}`);

            const userInput = await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${COLORS.GREEN}Nhập số lượng tài khoản muốn 🐮 chạy ${COLORS.YELLOW}(${COLORS.GREEN}hoặc ${COLORS.YELLOW}'all' ${COLORS.GREEN}để chạy tất cả${COLORS.YELLOW}, ${COLORS.RED}0 ${COLORS.GREEN}để thoát${COLORS.YELLOW}): `, (answer) => {
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
                console.log(`${COLORS.RED}Nhập không hợp lệ!${COLORS.RESET}`);
                continue;
            }

            const restTime = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${COLORS.GREEN}Nhập thời gian nghỉ ngơi sau khi 🐮 chạy xong tất cả các tài khoản ${COLORS.YELLOW}(${COLORS.GREEN}Khuyên ${COLORS.YELLOW}9000 ${COLORS.GREEN}nha${COLORS.YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            const repeatCount = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${COLORS.GREEN}Nhập số lần lặp lại sau thời gian nghỉ ngơi ${COLORS.YELLOW}(${COLORS.GREEN}hoặc ${COLORS.YELLOW}0 ${COLORS.GREEN}để chạy một lần): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            if (isNaN(repeatCount) || repeatCount < 0) {
                console.log(`${COLORS.RED}Nhập không hợp lệ!${COLORS.RESET}`);
                continue;
            }

            for (let i = 0; i <= repeatCount; i++) {
                console.log(`${COLORS.SILVER}Chạy lần ${COLORS.GREEN}${i + 1}${COLORS.RESET}`);
                await runPlaywrightInstances(links.slice(0, numAccounts), proxies, 8);

                if (i < repeatCount) {
                    await countdownTimer(restTime);
                }
            }

            console.log(`${COLORS.GREEN}Đã hoàn tất tất cả các vòng lặp.${COLORS.RESET}`);
        }
    } catch (e) {
        console.log(`${COLORS.RED}Lỗi: ${e.message}${COLORS.RESET}`);
    }
})();
