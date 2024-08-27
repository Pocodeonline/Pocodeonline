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
            const [server, username, password] = line.split('|');
            proxies.push({ server, username, password });
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

async function processAccount(context, accountUrl, accountNumber) {
    const page = await context.newPage();
    let success = false;
    try {
        console.log(`🐮 Đang chạy tài khoản ${accountNumber}`);
        await page.goto(accountUrl);

        // Check for page load
        const pageLoadedSelector = '#__nuxt > div > div > div.fixed.bottom-0.w-full.left-0.z-\\[12\\] > div > div.grid.grid-cols-5.w-full.gap-2 > button:nth-child(3) > div > div.shadow_filter.w-\\[4rem\\].h-\\[4rem\\].absolute.-translate-y-\\[50\\%\\] > img';
        await page.waitForSelector(pageLoadedSelector, { timeout: 10000 });
        console.log(`Đã Vào Giao diện ${await page.title()} Acc ${accountNumber}`);
        await page.waitForTimeout(400);

        // Wait for the first claim button to be visible and clickable using CSS Selector
        const claimButtonSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > div > div > div > div.transition-all > button';
        await page.waitForSelector(claimButtonSelector, { visible: true, timeout: 10000 });

        // Click the first claim button
        await page.click(claimButtonSelector);
        await page.waitForTimeout(400);

        // Wait for the second element (img) to be visible and clickable using CSS Selector
        const imgSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > button > div > p';
        await page.waitForSelector(imgSelector, { visible: true, timeout: 10000 });

        // Click the image element
        await page.click(imgSelector);
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

async function runPlaywrightInstances(links, numAccounts, restTime, proxies) {
    const concurrencyLimit = 10; // Limit concurrent processes to 3 browsers

    let successCount = 0;
    let failureCount = 0;
    let activeBrowsers = 0;
    let accountIndex = 0;
    let proxyIndex = 0;

    while (accountIndex < numAccounts || activeBrowsers > 0) {
        if (activeBrowsers < concurrencyLimit && accountIndex < numAccounts) {
            const proxy = proxies[proxyIndex % proxies.length];
            const accountUrl = links[accountIndex];
            activeBrowsers++;
            proxyIndex++;

            const browser = await chromium.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--headless',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    `--proxy-server=${proxy.server}`
                ]
            });
            const context = await browser.newContext({
                httpCredentials: {
                    username: proxy.username,
                    password: proxy.password
                }
            });
            // Process the account with the created context
            processAccount(context, accountUrl, accountIndex + 1)
                .then(result => {
                    if (result.success) {
                        successCount++;
                    } else {
                        failureCount++;
                    }
                })
                .catch(() => failureCount++)
                .finally(async () => {
                    activeBrowsers--;
                    await browser.close();
                });
            accountIndex++;
        }

        // Wait for remaining active browsers if any
        if (activeBrowsers > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        } else if (accountIndex < numAccounts) {
            // Wait before starting the next batch of accounts
            console.log(`Nghỉ ngơi ${restTime} giây trước khi chạy tiếp...`);
            for (let remaining = restTime; remaining > 0; remaining--) {
                process.stdout.write(`Nghỉ ngơi ${remaining} giây trước khi chạy tiếp...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                process.stdout.write('\r');
            }
            console.log('Nghỉ ngơi xong!');
        }
    }

    console.log(`${GREEN}Tổng số tài khoản thành công: ${successCount}`);
    console.log(`${RED}Tổng số tài khoản lỗi: ${failureCount}`);
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

            await runPlaywrightInstances(links, numAccounts, restTime, proxies);
        }
    } catch (e) {
        console.log(`Lỗi: ${e.message}`);
    }
})();
