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

async function printCustomLogo(LIGHT_BLUE = true) {
    const logo = [
        "CHỜ MỘT LÁT ĐANG VÀO TOOL CRYTORANK..."
    ];
    console.clear();
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
}

async function processAccount(browserContext, accountUrl, accountNumber, proxy) {
    const page = await browserContext.newPage();
    const maxRetries = 3; // Số lần tối đa để thử lại
    const retryDelay = 3000; // Thời gian chờ giữa các lần thử lại (2000ms = 2 giây)
    let success = false;

    // Thực hiện các thử lại
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`\x1b[33m[ \x1b[37mWIT KOEI \x1b[33m] \x1b[35m• \x1b[35m🐮 Đang chạy tài khoản \x1b[33m${accountNumber} \x1b[31mIP \x1b[33m: \x1b[35m${proxy.server}`);

            await page.goto(accountUrl);
    
            const skipButtonSelector = '#root > div > div.fixed.left-0.top-0.z-\\[100\\].flex.h-full.w-full.flex-col.items-center.gap-6.bg-black.px-4.pb-10.pt-12 > div.flex.w-full.gap-4 > button.ease.h-11.w-full.rounded-\\[10px\\].px-3.font-semibold.transition-opacity.duration-150.active\\:opacity-\\[0\\.7\\].border.border-main-blue.text-main-blue.w-full';
            
            try {
                await page.waitForSelector(skipButtonSelector, { timeout: 13000 });
                const skipButton = await page.$(skipButtonSelector);
                if (skipButton) {
                    await skipButton.click();
                    console.log(`\x1b[33m[ \x1b[37mWIT KOEI \x1b[33m] \x1b[35m• \x1b[34mskip acc \x1b[33m${accountNumber}`);
                } else {
                    console.log(`\x1b[31mKhông thấy skip \x1b[33m${accountNumber}`);
                }
            } catch (err) {
                console.error(`\x1b[31mError while waiting for skip button: ${err.message}`);
            }
    
    
            const balanceSelector = '#root > div > div.grid.h-\\[calc\\(100svh-96px\\)\\].grid-rows-\\[1fr_auto\\].overflow-auto.px-4.pb-6.pt-8 > div > div.relative.z-10.flex.h-full.flex-col.items-center > div.flex.w-full.justify-between > div.relative.flex.h-10.items-center.gap-2.rounded-\\[10px\\].bg-\\[\\#06080B4D\\].px-3 > span.absolute.right-3.text-sm';
            const balanceElement = await page.waitForSelector(balanceSelector, { timeout: 6000 });
            const balanceText = await balanceElement.evaluate(el => el.innerText);
            console.log(`\x1b[33m[ \x1b[37mWIT KOEI \x1b[33m] \x1b[35m• \x1b[36mSố dư acc \x1b[33m${accountNumber} \x1b[35m là \x1b[33m: \x1b[33m${balanceText}`);
            await page.waitForTimeout(1000);
    
            const claimButtonSelector = '#root > div > div.fixed.z-20.left-0.right-0.bottom-0.flex.w-full.items-center.justify-center.gap-3\\.5.bg-black.py-4.pb-6.pl-4.pr-4 > a.relative.flex.w-auto.min-w-\\[54px\\].flex-col.items-center.justify-center.gap-2.text-xs.font-semibold.after\\:absolute.after\\:right-\\[16px\\].after\\:top-\\[1px\\].after\\:h-\\[6px\\].after\\:w-\\[6px\\].after\\:rounded-full.after\\:bg-red.text-gray-3';
            await page.waitForSelector(claimButtonSelector, { timeout: 5000 });
            await page.click(claimButtonSelector);
            await page.waitForTimeout(2000);
    
            const successButtonSelector = '#root > div > div.grid.h-\\[calc\\(100svh-96px\\)\\].grid-rows-\\[1fr_auto\\].overflow-auto.px-4.pb-6.pt-8 > div > div:nth-child(2) > div > div:nth-child(1) > div.ml-auto.flex.items-center.justify-center > button';
            try {
                await page.waitForSelector(successButtonSelector, { timeout: 3000 });
                await page.click(successButtonSelector);
                await page.waitForTimeout(2000);
                console.log(`\x1b[33m[ \x1b[37mWIT KOEI \x1b[33m] \x1b[35m• \x1b[36mĐiểm danh Acc \x1b[33m${accountNumber} \x1b[35m hôm nay thành công`);
            } catch (error) {
                console.log(`\x1b[33m[ \x1b[37mWIT KOEI \x1b[33m] \x1b[35m• \x1b[31mAcc \x1b[33m${accountNumber} \x1b[31m hôm nay điểm danh rồi`);
            }
    
            const nextSVGSelector = '#root > div > div.fixed.z-20.left-0.right-0.bottom-0.flex.w-full.items-center.justify-center.gap-3\\.5.bg-black.py-4.pb-6.pl-4.pr-4 > a:nth-child(1)';
            await page.waitForSelector(nextSVGSelector, { timeout: 5000 });
            await page.click(nextSVGSelector);
    
           await page.waitForTimeout(2000);
            const claimpointsButtonSelector = '#root > div > div.grid.h-\\[calc\\(100svh-96px\\)\\].grid-rows-\\[1fr_auto\\].overflow-auto.px-4.pb-6.pt-8 > div > div.relative.z-10.flex.h-full.flex-col.items-center > div:nth-child(3) > button';
            try {
                await page.waitForSelector(claimpointsButtonSelector, { timeout: 5000 });
                const claimButton = await page.$(claimpointsButtonSelector);
                if (claimButton) {
                    await claimButton.click();
                    console.log(`\x1b[33m[ \x1b[37mWIT KOEI \x1b[33m] \x1b[32m• \x1b[33mAcc \x1b[33m${accountNumber} \x1b[32m claim thành công `);
                }
            } catch (error) {
                console.log(`\x1b[33m[ \x1b[37mWIT KOEI \x1b[33m] \x1b[35m• \x1b[31mAcc \x1b[33m${accountNumber} \x1b[31m claim rồi...`);
            }
    
            await page.waitForTimeout(2000);
    
            const imgSelector = '#root > div > div.grid.h-\\[calc\\(100svh-96px\\)\\].grid-rows-\\[1fr_auto\\].overflow-auto.px-4.pb-6.pt-8 > div > div.relative.z-10.flex.h-full.flex-col.items-center > div:nth-child(3) > button';
            let imgElementFound = true;
    
            try {
                await page.waitForSelector(imgSelector, { visible: true, timeout: 4000 });
                await page.click(imgSelector);
                await page.waitForTimeout(2000);
                imgElementFound = false;
            } catch (error) {
                imgElementFound = true;
            }
    
            // Nếu phần tử img không được tìm thấy, in ra thời gian còn lại
            if (!imgElementFound) {
                const timeSelector = '#root > div > div.grid.h-\\[calc\\(100svh-96px\\)\\].grid-rows-\\[1fr_auto\\].overflow-auto.px-4.pb-6.pt-8 > div > div.relative.z-10.flex.h-full.flex-col.items-center > div:nth-child(3) > div > div';
                const timeElement = await page.waitForSelector(timeSelector, { timeout: 6000 });
                const time = await timeElement.evaluate(el => el.innerText);
                console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Startmining của Acc ${YELLOW}${accountNumber} còn ${time} mới mua được...`);
            }
            
            // Đánh dấu thành công và thoát khỏi vòng lặp
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
            ],
        });

        const browserContext = await browser.newContext({
            httpCredentials: {
                storageState: null,
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
            await new Promise(resolve => setTimeout(resolve, 23000));
        }
    }

    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Hoàn tất xử lý tất cả tài khoản \x1b[38;5;231mTool \x1b[38;5;11m[ \x1b[38;5;231mCrytorank \x1b[38;5;11m].`);
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
    const filePath = 'crytorank.txt';

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
            console.log(`${SILVER}GUMART ${LIGHT_PINK}code by ${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] ${RESET}`);
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
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập thời gian nghỉ ngơi sau khi 🐮 chạy xong tất cả các tài khoản ${YELLOW}(${GREEN}Khuyên ${YELLOW}21600 ${GREEN}nha${YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            const repeatCount = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lần lặp lại sau thời gian nghỉ ngơi ${YELLOW}(${GREEN}hoặc ${YELLOW}0 ${GREEN}để chạy một lần): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            if (isNaN(repeatCount) || repeatCount < 0) {
                console.log(`${RED}Nhập không hợp lệ!`);
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
