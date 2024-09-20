const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

const SILVER = '\x1b[38;5;231m';
const LIGHT_PINK = '\x1b[38;5;207m';
const PINK = '\x1b[38;5;13m';
const YELLOW = '\x1b[38;5;11m';
const GREEN = '\x1b[38;5;10m';
const RED = '\x1b[38;5;9m';
const LIGHT_BLUE = '\x1b[38;5;12m';
const DARK_BLUE = '\x1b[38;5;19m';
const RESET = '\x1b[0m';

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
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        if (line.trim()) {
            count++;
        }
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
            console.log('\x1b[32m' + logo.join('\n'));
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        console.clear();
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

async function processAccount(browserContext, accountUrl, accountNumber, proxy) {
    const page = await browserContext.newPage();
    const maxRetries = 3; // Số lần tối đa để thử lại
    const retryDelay = 3000; // Thời gian chờ giữa các lần thử lại (2000ms = 2 giây)
    let success = false;

    // Thực hiện các thử lại
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${PINK}🐮 Đang chạy tài khoản ${YELLOW}${accountNumber} ${PINK}IP ${YELLOW}:${PINK}${proxy.server}`);
            
            // Điều hướng đến URL và đợi tải trang
            await page.goto(accountUrl, { waitUntil: 'networkidle0' });
            
            // Chờ và xác nhận phần tử đã tải xong
            const pageLoadedSelector = '#__nuxt > div > div > div.fixed.bottom-0.w-full.left-0.z-\\[12\\] > div > div.grid.grid-cols-5.w-full.gap-2 > button:nth-child(3) > div > div.shadow_filter.w-\\[4rem\\].h-\\[4rem\\].absolute.-translate-y-\\[50\\%\\] > img';
            await page.waitForSelector(pageLoadedSelector, { timeout: 20000 });
            console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Đã vào giao diện ${await page.title()} Acc ${YELLOW}${accountNumber}`);

            const jointask = "#__nuxt > div > div > div.fixed.bottom-0.w-full.left-0.z-\\[12\\] > div > div.grid.grid-cols-5.w-full.gap-2 > button:nth-child(2) > div";
            await page.waitForSelector(jointask, { timeout: 6000 });
            await page.click(jointask);
            console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Bắt đầu làm task ${await page.title()} Acc \x1b[38;5;11m${accountNumber}${RESET}`);

            const tasks = [
                { buttonSelector: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(2) > button", claimSelector: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(2) > button > p", taskNumber: 1 },
                { buttonSelector: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(3) > button", claimSelector: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(3) > button > p", taskNumber: 2 },
                { buttonSelector: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(4) > button", claimSelector: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(4) > button > p", taskNumber: 3 },
                { buttonSelector: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(5) > button", claimSelector: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(5) > button > p", taskNumber: 4 },
                { buttonSelector: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(6) > button", claimSelector: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(6) > button > p", taskNumber: 5 }
            ];

            for (const { buttonSelector, claimSelector, taskNumber } of tasks) {
                try {
                    await page.waitForSelector(buttonSelector, { timeout: 600 });
                    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}làm task \x1b[38;5;11m${taskNumber} \x1b[38;5;10mcho acc \x1b[38;5;11m${accountNumber}${RESET}`);
                    await page.click(buttonSelector);
                    await page.waitForSelector(claimSelector, { timeout: 6000 });
                    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}claim task \x1b[38;5;11m${taskNumber} \x1b[38;5;10mcho acc \x1b[38;5;11m${accountNumber}${RESET}`);
                    await page.click(claimSelector);
                    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}đã làm task \x1b[38;5;11m${taskNumber} \x1b[38;5;10mAcc\x1b[38;5;11m${accountNumber}${RESET}`);
                } catch {
                    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}task ${taskNumber} đã hoàn thành rồi \x1b[38;5;11m${accountNumber}${RESET}`);
                }
            }

            const jointask2 = "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.fixed.top-0.left-0.w-full.z-\\[1\\].pt-\\[2\\.75rem\\] > div > div.menu.w-full.flex.justify-center > div > div:nth-child(2)";
            await page.waitForSelector(jointask2, { timeout: 6000 });
            await page.click(jointask2);

            console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Bắt đầu làm thêm bổ sung task 2 ${await page.title()} Acc \x1b[38;5;11m${accountNumber}${RESET}`);
            const tasks2 = [
                { buttonSelector1: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div.task-block.h-fit.overflow-auto.task-dog-bg.mb-\\[0\\.5rem\\] > div > div > div > div:nth-child(2) > button", claimSelector1: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div.task-block.h-fit.overflow-auto.task-dog-bg.mb-\\[0\\.5rem\\] > div > div > div > div:nth-child(2) > button > p", taskNumber2: 6 },
                { buttonSelector1: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div.task-block.h-fit.overflow-auto.task-dog-bg.mb-\\[0\\.5rem\\] > div > div > div > div:nth-child(3) > button", claimSelector1: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div.task-block.h-fit.overflow-auto.task-dog-bg.mb-\\[0\\.5rem\\] > div > div > div > div:nth-child(3) > button > p", taskNumber2: 7 },
                { buttonSelector1: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div.task-block.h-fit.overflow-auto.task-dog-bg.mb-\\[0\\.5rem\\] > div > div > div > div:nth-child(4) > button", claimSelector1: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div.task-block.h-fit.overflow-auto.task-dog-bg.mb-\\[0\\.5rem\\] > div > div > div > div:nth-child(4) > button > p", taskNumber2: 8 },
                { buttonSelector1: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(2) > div > div > div > div:nth-child(2) > button", claimSelector1: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(2) > div > div > div > div:nth-child(2) > button > p", taskNumber2: 9 },
                { buttonSelector1: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(2) > div > div > div > div:nth-child(3) > button", claimSelector1: "#__nuxt > div > div > div.main-wapper.flex.flex-col.items-center.px-2.animate_show_page.max-w-\\[768px\\].h-\\[100dvh\\].mx-auto.animate_show_page.bg-white-0.relative.z-\\[1\\].transition-all.duration-200.overflow-y-auto > div.w-full.flex-1.z-0.pt-\\[7\\.875rem\\].pb-\\[6rem\\] > div > div > div:nth-child(2) > div > div > div > div:nth-child(3) > button > p", taskNumber2: 10 }
            ];

            for (const { buttonSelector1, claimSelector1, taskNumber2 } of tasks2) {
                try {
                    await page.waitForSelector(buttonSelector1, { timeout: 600 });
                    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}làm task \x1b[38;5;11m${taskNumber2} \x1b[38;5;10mcho acc \x1b[38;5;11m${accountNumber}${RESET}`);
                    await page.click(buttonSelector1);
                    await page.waitForSelector(claimSelector1, { timeout: 6000 });
                    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}claim task \x1b[38;5;11m${taskNumber2} \x1b[38;5;10mcho acc \x1b[38;5;11m${accountNumber}${RESET}`);
                    await page.click(claimSelector1);
                    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}đã làm task \x1b[38;5;11m${taskNumber2} \x1b[38;5;10mAcc\x1b[38;5;11m${accountNumber}${RESET}`);
                } catch {
                    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}task ${taskNumber2} đã hoàn thành rồi \x1b[38;5;11m${accountNumber}${RESET}`);
                }
            }
            success = true;
            break;
        } catch (error) {
            if (attempt < maxRetries) {
                console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Đang thử lại acc ${YELLOW}${accountNumber} ${RED}lần${YELLOW} ${attempt + 1}`);
                await page.waitForTimeout(retryDelay);
            } else {
                // Lưu thông tin lỗi nếu tất cả các lần thử đều không thành công
                console.error(`${RED}Tài khoản số ${accountNumber} gặp lỗi`);
                await logFailedAccount(accountNumber, error.message);
            }
        }
    }

    try {
        // Đảm bảo đóng trang sau khi hoàn thành
        await page.close();
    } catch (closeError) {
        console.error(`${RED}Không thể đóng trang: ${closeError.message}`);
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
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-cpu',
                `--proxy-server=${proxy.server}`
            ]
        });

        const browserContext = await browser.newContext({
            httpCredentials: {
                storageState: null,
                username: proxy.username,
                password: proxy.password
            },
            bypassCSP: true,
        });

        let accountSuccess = false;
        try {
            accountSuccess = await processAccount(browserContext, accountUrl, accountNumber, proxy);
            if (accountSuccess) totalSuccessCount++;
            else totalFailureCount++;
        } catch (error) {
            console.error('Error processing account:', error);
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
                    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Hoàn tất tài khoản ${accountNumber}`);
                })
                .catch(() => {
                    activeCount--;
                    console.log(`${RED}Tài khoản ${accountNumber} gặp lỗi`);
                });
        }

        if (activeCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 14000));
        }
    }

    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Hoàn tất xử lý tất cả tài khoản \x1b[38;5;231mTool \x1b[38;5;11m[ \x1b[38;5;231mGUMART TASK \x1b[38;5;11m].`);
    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${SILVER}Tổng tài khoản thành công: ${YELLOW}${totalSuccessCount}`);
    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${SILVER}Tổng tài khoản lỗi: ${YELLOW}${totalFailureCount}`);
}

async function logFailedAccount(accountNumber, errorMessage) {
    fs.appendFileSync(ERROR_LOG_PATH, `Tài khoản số ${accountNumber} gặp lỗi\n`);
}

async function countdownTimer(seconds) {
    for (let i = seconds; i >= 0; i--) {
        process.stdout.write(`\r${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Đang nghỉ ngơi còn lại ${YELLOW}${i} ${RED}giây`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log();
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
            console.log(`${SILVER}GUMART TASK ${LIGHT_PINK}code by ${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] ${RESET}`);
            console.log(`${LIGHT_PINK}tele${YELLOW}: ${PINK}tphuc_0 ${RESET}`);
            console.log(`${GREEN}Hiện tại bạn có ${YELLOW}${nonEmptyLines}${GREEN} tài khoản`);

            const userInput = await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lượng tài khoản muốn 🐮 chạy ${YELLOW}(${GREEN}hoặc ${YELLOW}'all' ${GREEN}để chạy tất cả${YELLOW}, ${RED}0 ${GREEN}để thoát${YELLOW}): `, (answer) => {
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
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập thời gian nghỉ ngơi sau khi 🐮 chạy xong tất cả các tài khoản ${YELLOW}( ${GREEN}Khuyên ${YELLOW}9200 ${GREEN}nha${YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            const repeatCount = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lần lặp lại sau thời gian nghỉ ngơi ${YELLOW}( ${GREEN}hoặc ${YELLOW}0 ${GREEN}để chạy một lần): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            if (isNaN(repeatCount) || repeatCount < 0) {
                console.log(`${RED}Nhập không hợp lệ!${RESET}`);
                continue;
            }

            // Thêm đoạn mã yêu cầu số lượng trong hàm runPlaywrightInstances
            const instancesCount = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lượng luồng máy bạn có thể xử lý tài khoản để chạy ${YELLOW}( ${GREEN}Ai máy yếu khuyên  ${YELLOW}6 ${GREEN}nha${YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            if (isNaN(instancesCount) || instancesCount <= 0) {
                console.log(`${RED}Nhập không hợp lệ!${RESET}`);
                continue;
            }

            for (let i = 0; i <= repeatCount; i++) {
                console.log(`${SILVER}Chạy lần ${GREEN}${i + 1}${RESET}`);
                await runPlaywrightInstances(links.slice(0, numAccounts), proxies, instancesCount);

                if (i < repeatCount) {
                    await countdownTimer(restTime);
                }
            }

            console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Đã hoàn tất tất cả các số lần muốn chạy lại.${RESET}`);
        }
    } catch (e) {
        console.log(`${RED}Lỗi${RESET}`);
    }
})();
