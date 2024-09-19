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
    LIGHT_BLUE: '\x1b[38;5;12m',
    DARK_BLUE: '\x1b[38;5;19m',
    RESET: '\x1b[0m'
};

const ERROR_LOG_PATH = 'failed_accounts.txt';
const PROXIES_FILE_PATH = 'proxies.txt';

async function readProxies(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const proxies = [];
    for await (const line of rl) {
        if (line.trim()) {
            const [ip, port, username, password] = line.split(':');
            if (ip && port && username && password) {
                proxies.push({ server: `${ip}:${port}`, username, password });
            } else {
                console.error(`Proxy format error: ${line}`);
            }
        }
    }
    return proxies;
}

async function countNonEmptyLines(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        if (line.trim()) count++;
    }
    return count;
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


async function printCustomLogo(LIGHT_BLUE = true) {
    const logo = [
        "🔥🔥    🔥🔥      🔥🔥   🔥🔥🔥  🔥🔥🔥   🔥  🔥    🔥🔥   🔥  🔥🔥   🔥",
        "🔥 🔥  🔥 🔥     🔥  🔥    🔥   🔥        🔥  🔥   🔥  🔥  🔥  🔥 🔥  🔥",
        "🔥  🔥🔥  🔥    🔥 🔥 🔥   🔥   🔥        🔥🔥🔥   🔥🔥🔥  🔥  🔥  🔥 🔥",
        "🔥   🔥    🔥  🔥      🔥  🔥   🔥        🔥  🔥  🔥    🔥 🔥  🔥   🔥🔥",
        "🔥         🔥 🔥        🔥 🔥    🔥🔥 🔥  🔥  🔥 🔥      🔥🔥  🔥     🔥",
        "",
        "chờ một lát..."
    ];
    console.clear();
    try {
        for (let i = 0; i < 5; i++) {
            if (LIGHT_BLUE) {
                console.log('\x1b[5m\x1b[32m' + logo.join('\n') + '\x1b[0m');
            } else {
                console.log('\x1b[32m' + logo.join('\n'));
            }
            await new Promise(resolve => setTimeout(resolve, 300));
            console.clear();
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error(`${COLORS.RED}Error displaying logo: ${error.message}`);
    }
}

async function processAccount(browserContext, accountUrl, accountNumber, proxy) {
    const page = await browserContext.newPage();
    let success = false;
    const maxRetries = 3; // Maximum retries
    const retryDelay = 3000; // Delay between retries (3000ms = 3 seconds)

    const loadPage = async () => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}🐮 Đang chạy tài khoản \x1b[38;5;11m${accountNumber} \x1b[38;5;207mIP \x1b[38;5;11m:\x1b[38;5;13m${proxy.server}${COLORS.RESET}`);
                await page.goto(accountUrl, { waitUntil: 'networkidle0' });

                // Handle optional skip button
                const skipButtonSelector = "body > div:nth-child(6) > div > div.ant-modal-wrap > div > div:nth-child(2) > div > div > div.btn_box___Az8hH > div.btn_style___CgrXw.btn_style_cancel___ZHjYK";
                try {
                    const skipButton = await page.waitForSelector(skipButtonSelector, { timeout: 8000 });
                    if (skipButton) {
                        await skipButton.click();
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Skip bỏ qua mainet matchain acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                    }
                } catch {
                    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}Không thấy skip acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                }

                // Check for page load
                const pageLoadedSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_balance___ClINX";
                await page.waitForSelector(pageLoadedSelector, { timeout: 6000 });
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Đã vào giao diện ${await page.title()} Acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                const tasks = [
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(1) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(1) > div.btn___xz27R.claim___VQBtK", taskNumber: 1 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(2) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(2) > div.btn___xz27R.claim___VQBtK", taskNumber: 2 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(3) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(3) > div.btn___xz27R.claim___VQBtK", taskNumber: 3 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(4) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(4) > div.btn___xz27R.claim___VQBtK", taskNumber: 4 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(1) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(1) > div.btn___xz27R.claim___VQBtK", taskNumber: 5 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(2) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(2) > div.btn___xz27R.claim___VQBtK", taskNumber: 6 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(3) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(3) > div.btn___xz27R.claim___VQBtK", taskNumber: 7 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(4) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(4) > div.btn___xz27R.claim___VQBtK", taskNumber: 8 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(5) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(5) > div.btn___xz27R.claim___VQBtK", taskNumber: 9 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(6) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(6) > div.btn___xz27R.claim___VQBtK", taskNumber: 10 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(7) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(7) > div.btn___xz27R.claim___VQBtK", taskNumber: 11 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(8) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(8) > div.btn___xz27R.claim___VQBtK", taskNumber: 12 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(9) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(9) > div.btn___xz27R.claim___VQBtK", taskNumber: 13 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(10) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(10) > div.btn___xz27R.claim___VQBtK", taskNumber: 14 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(11) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(11) > div.btn___xz27R.claim___VQBtK", taskNumber: 15 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(12) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(12) > div.btn___xz27R.claim___VQBtK", taskNumber: 16 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(13) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(13) > div.btn___xz27R.claim___VQBtK", taskNumber: 17 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(14) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(14) > div.btn___xz27R.claim___VQBtK", taskNumber: 18 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(15) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(15) > div.btn___xz27R.claim___VQBtK", taskNumber: 19 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(16) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(16) > div.btn___xz27R.claim___VQBtK", taskNumber: 20 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(1) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(1) > div.btn___xz27R.claim___VQBtK", taskNumber: 21 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(2) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(2) > div.btn___xz27R.claim___VQBtK", taskNumber: 22 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(3) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(3) > div.btn___xz27R.claim___VQBtK", taskNumber: 23 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(4) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(4) > div.btn___xz27R.claim___VQBtK", taskNumber: 24 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(5) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(5) > div.btn___xz27R.claim___VQBtK", taskNumber: 25 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(6) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(6) > div.btn___xz27R.claim___VQBtK", taskNumber: 26 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(7) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(7) > div.btn___xz27R.claim___VQBtK", taskNumber: 27 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(8) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(8) > div.btn___xz27R.claim___VQBtK", taskNumber: 28 },
                    { buttonSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(9) > div.btn___xz27R", claimSelector: "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(9) > div.btn___xz27R.claim___VQBtK", taskNumber: 29 }
                ];

                for (const { buttonSelector, claimSelector, taskNumber } of tasks) {
                    try {
                        await page.waitForSelector(buttonSelector, { timeout: 600 });
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task \x1b[38;5;11m${taskNumber} \x1b[38;5;10mcho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                        await page.click(buttonSelector);
                        await page.waitForSelector(claimSelector, { timeout: 6000 });
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task \x1b[38;5;11m${taskNumber} \x1b[38;5;10mcho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                        await page.click(claimSelector);
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task \x1b[38;5;11m${taskNumber} \x1b[38;5;10mAcc\x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                    } catch {
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task ${taskNumber} đã hoàn thành rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                    }
                }

                success = true;
                break; // Exit retry loop if successful
            } catch (error) {
                if (attempt < maxRetries) {
                    await page.waitForTimeout(retryDelay);
                } else {
                    console.error(`${COLORS.RED}Xảy ra lỗi khi xử lý tài khoản ${accountNumber}: ${error.message}${COLORS.RESET}`);
                    await logFailedAccount(accountNumber, error.message);
                }
            }
        }
    };

    try {
        await loadPage();
    } finally {
        await page.close();
    }

    return success;
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
                '--disable-gpu',
                '--disable-cpu',
                `--proxy-server=${proxy.server}`
            ]
        });

        const browserContext = await browser.newContext({
            httpCredentials: {
                storageState: null,
                username: proxy.username,
                password: proxy.password,
            }
        });

        let accountSuccess = false;
        try {
            accountSuccess = await processAccount(browserContext, accountUrl, accountNumber, proxy);
            if (accountSuccess) totalSuccessCount++;
            else totalFailureCount++;
        } catch (error) {
            totalFailureCount++;
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
                .then(() => {
                    activeCount--;
                    console.log(`${COLORS.GREEN}Hoàn tất tài khoản ${accountNumber}${COLORS.RESET}`);
                })
                .catch(() => {
                    activeCount--;
                    console.log(`${COLORS.RED}Tài khoản ${accountNumber} gặp lỗi${COLORS.RESET}`);
                });
        }

        if (activeCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 31000));
        }
    }

    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Hoàn tất xử lý tất cả tài khoản \x1b[38;5;231mTool \x1b[38;5;11m[ \x1b[38;5;231mMatchain \x1b[38;5;11m] ${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.SILVER}Tổng tài khoản thành công: ${COLORS.YELLOW}${totalSuccessCount}${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.SILVER}Tổng tài khoản lỗi: ${COLORS.YELLOW}${totalFailureCount}${COLORS.RESET}`);
}

async function logFailedAccount(accountNumber, errorMessage) {
    fs.appendFileSync(ERROR_LOG_PATH, `Tài khoản số ${accountNumber} gặp lỗi\n`);
}

async function countdownTimer(seconds) {
    for (let i = seconds; i >= 0; i--) {
        process.stdout.write(`\r${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}Đang nghỉ ngơi còn lại ${COLORS.YELLOW}${i} ${COLORS.RED}giây${COLORS.RESET}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log();
}

(async () => {
    await printCustomLogo(true);
    const filePath = 'matchain.txt';

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
            console.log(`${COLORS.SILVER}MATCHAIIN ${COLORS.LIGHT_PINK}code by ${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] ${COLORS.RESET}`);
            console.log(`${COLORS.GREEN}tele${COLORS.YELLOW}: ${COLORS.PINK}tphuc_0 ${COLORS.RESET}`);
            console.log(`${COLORS.GREEN}Hiện tại bạn có ${COLORS.YELLOW}${nonEmptyLines}${COLORS.GREEN} tài khoản${COLORS.RESET}`);

            const userInput = await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Nhập số lượng tài khoản muốn 🐮 chạy ${COLORS.YELLOW}(${COLORS.GREEN}hoặc ${COLORS.YELLOW}'all' ${COLORS.GREEN}để chạy tất cả${COLORS.YELLOW}, ${COLORS.RED}0 ${COLORS.GREEN}để thoát${COLORS.YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            });

            let numAccounts;
            if (userInput.toLowerCase() === 'all') {
                numAccounts = links.length;
            } else if (!isNaN(userInput)) {
                numAccounts = parseInt(userInput, 10);
                if (numAccounts <= 0) break;
                if (numAccounts > links.length) numAccounts = links.length;
            } else {
                console.log(`${COLORS.RED}Nhập không hợp lệ!${COLORS.RESET}`);
                continue;
            }

            const restTime = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Nhập thời gian nghỉ ngơi sau khi 🐮 chạy xong tất cả các tài khoản ${COLORS.YELLOW}(${COLORS.GREEN}Khuyên ${COLORS.YELLOW}28800 ${COLORS.GREEN}nha${COLORS.YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            const repeatCount = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Nhập số lần lặp lại sau thời gian nghỉ ngơi ${COLORS.YELLOW}(${COLORS.GREEN}hoặc ${COLORS.YELLOW}0 ${COLORS.GREEN}để chạy một lần): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            if (isNaN(repeatCount) || repeatCount < 0) {
                console.log(`${COLORS.RED}Nhập không hợp lệ!${COLORS.RESET}`);
                continue;
            }

            // Thêm đoạn mã yêu cầu số lượng trong hàm runPlaywrightInstances
            const instancesCount = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Nhập số lượng luồng máy bạn có thể xử lý tài khoản để chạy ${COLORS.YELLOW}( ${COLORS.GREEN}Ai máy yếu khuyên  ${COLORS.YELLOW}6 ${COLORS.GREEN}nha${COLORS.YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            if (isNaN(instancesCount) || instancesCount <= 0) {
                console.log(`${COLORS.RED}Nhập không hợp lệ!${COLORS.RESET}`);
                continue;
            }

            for (let i = 0; i <= repeatCount; i++) {
                console.log(`${COLORS.SILVER}Chạy lần ${COLORS.GREEN}${i + 1}${COLORS.RESET}`);
                await runPlaywrightInstances(links.slice(0, numAccounts), proxies, instancesCount);

                if (i < repeatCount) {
                    await countdownTimer(restTime);
                }
            }

            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Đã hoàn tất tất cả các số lần muốn chạy lại.${COLORS.RESET}`);
        }
    } catch (e) {
        console.log(`${COLORS.RED}Lỗi${COLORS.RESET}`);
    }
})();
