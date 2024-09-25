const { chromium } = require('playwright');
const fs = require('fs').promises;
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

async function readFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return content.split('\n').filter(line => line.trim());
}

async function readProxies(filePath) {
    const lines = await readFile(filePath);
    return lines.map(line => {
        const [ip, port, username, password] = line.split(':');
        return { server: `${ip}:${port}`, username, password };
    });
}

async function printCustomLogo() {
    const logo = "ĐANG VÀO TOOL MATCHAIN...";
    console.clear();
    for (let i = 0; i < 3; i++) {
        console.log('\x1b[32m' + logo);
        await new Promise(resolve => setTimeout(resolve, 300));
        console.clear();
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

async function processAccount(page, accountUrl, accountNumber, proxy) {
    const log = (message, color = COLORS.GREEN) => console.log(`${COLORS.YELLOW}[ ${COLORS.SILVER}WKOEI ${COLORS.YELLOW}] ${COLORS.LIGHT_PINK}• ${color}${message}${COLORS.RESET}`);

    try {
        log(`🐮 Đang chạy tài khoản ${accountNumber} IP: ${proxy.server}`);
        await page.goto(accountUrl, { waitUntil: 'networkidle' });

        // Handle optional skip button
        try {
            await page.click("body > div:nth-child(6) > div > div.ant-modal-wrap > div > div:nth-child(2) > div > div > div.btn_box___Az8hH > div.btn_style___CgrXw.btn_style_cancel___ZHjYK", { timeout: 5000 });
            log(`Skip bỏ qua mainet matchain acc ${accountNumber}`);
        } catch (err) {
            log(`Không thấy skip acc ${accountNumber}`, COLORS.RED);
        }

        await page.waitForSelector("#root > div > div > div.content___jvMX0.home___efXf1 > div.container_balance___ClINX", { timeout: 5000 });
        log(`Đã vào giao diện ${await page.title()} Acc ${accountNumber}`);

        const currentBalance = await page.textContent("#root > div > div > div.content___jvMX0.home___efXf1 > div.container_mining___mBJYP > p");
        log(`Số dư hiện tại của acc ${accountNumber}: ${currentBalance}`);

        // Claim process
        try {
            await page.click('#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka', { timeout: 4000 });
            log(`Claim Acc ${accountNumber} thành công...`, COLORS.LIGHT_BLUE);
        } catch {
            log(`Acc ${accountNumber} claim rồi`, COLORS.RED);
        }

        // Start mining process
        const startMiningButton = await page.$("#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka.farming____9oEZ");
        if (startMiningButton) {
            await startMiningButton.click();
            log(`Đã đào lại cho acc ${accountNumber}`);

            const countdownHours = await page.textContent("#root > div > div > div.content___jvMX0.home___efXf1 > div.container_countdown___G04z1 > ul");
            log(`Thời gian còn lại của acc ${accountNumber}: ${countdownHours}`);

            await page.click("#root > div > div > div.content___jvMX0.home___efXf1 > div.container___Joeqw > div.item___aAzf7.left_item___po1MT > div > div.content_top___biYaq > div:nth-child(1) > img");
            log(`Đang mua x2 cho acc ${accountNumber}`);

            await page.click("#root > div > div.container___tYOO7 > div.content___xItdF > div.btn___FttFE");
            log(`Đã mua x2 cho acc ${accountNumber}`);

            const finalPoints = await page.textContent("#root > div > div > div.content___jvMX0.home___efXf1 > div.container___Joeqw > div.item___aAzf7.left_item___po1MT > div > div.content_bottom___dCWi7 > div > div.points___ya4CK");
            log(`-50 point mua x2 acc ${accountNumber}: ${finalPoints}`);
            log(`Mua x2 thành công cho acc ${accountNumber}`);
        } else {
            log(`Acc ${accountNumber} start rồi hoặc không tồn tại.`, COLORS.RED);
        }

        return true;
    } catch (error) {
        log(`Tài khoản số ${accountNumber} gặp lỗi: ${error.message}`, COLORS.RED);
        await fs.appendFile(ERROR_LOG_PATH, `Tài khoản số ${accountNumber} gặp lỗi\n`);
        return false;
    }
}

async function runPlaywrightInstances(links, proxies, maxBrowsers) {
    let successCount = 0;
    let failureCount = 0;
    const browser = await chromium.launch({ headless: true });

    const processAccountQueue = async (queue) => {
        while (queue.length > 0) {
            const { accountUrl, accountNumber, proxy } = queue.shift();
            const context = await browser.newContext({
                proxy: { server: proxy.server, username: proxy.username, password: proxy.password },
                viewport: null,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });
            const page = await context.newPage();
            
            try {
                const success = await processAccount(page, accountUrl, accountNumber, proxy);
                success ? successCount++ : failureCount++;
            } finally {
                await context.close();
            }
        }
    };

    const accountQueue = links.map((url, index) => ({
        accountUrl: url,
        accountNumber: index + 1,
        proxy: proxies[index % proxies.length]
    }));

    const workerPromises = [];
    for (let i = 0; i < maxBrowsers; i++) {
        workerPromises.push(processAccountQueue(accountQueue));
    }

    await Promise.all(workerPromises);
    await browser.close();

    console.log(`${COLORS.YELLOW}[ ${COLORS.SILVER}WIT KOEI ${COLORS.YELLOW}] ${COLORS.LIGHT_PINK}• ${COLORS.GREEN}Hoàn tất xử lý tất cả tài khoản ${COLORS.SILVER}Tool ${COLORS.YELLOW}[ ${COLORS.SILVER}MATCHAIN CLAIM X2 ${COLORS.YELLOW}].`);
    console.log(`${COLORS.YELLOW}[ ${COLORS.SILVER}WIT KOEI ${COLORS.YELLOW}] ${COLORS.LIGHT_PINK}• ${COLORS.SILVER}Tổng tài khoản thành công: ${COLORS.YELLOW}${successCount}`);
    console.log(`${COLORS.YELLOW}[ ${COLORS.SILVER}WIT KOEI ${COLORS.YELLOW}] ${COLORS.LIGHT_PINK}• ${COLORS.SILVER}Tổng tài khoản lỗi: ${COLORS.YELLOW}${failureCount}`);
}

async function getUserInput(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

async function countdownTimer(seconds) {
    for (let i = seconds; i > 0; i--) {
        process.stdout.write(`\r${COLORS.YELLOW}[ ${COLORS.SILVER}WIT KOEI ${COLORS.YELLOW}] ${COLORS.LIGHT_PINK}• ${COLORS.RED}Đang nghỉ ngơi còn lại ${COLORS.YELLOW}${i} ${COLORS.RED}giây`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log();
}

(async () => {
    await printCustomLogo();
    const filePath = 'matchain.txt';

    try {
        const proxies = await readProxies(PROXIES_FILE_PATH);
        if (proxies.length === 0) throw new Error('Không tìm thấy proxy nào.');

        while (true) {
            const links = await readFile(filePath);
            if (links.length === 0) throw new Error('File không chứa tài khoản nào.');

            console.log(`${COLORS.SILVER}MATCHAIN CLAIM X2 ${COLORS.LIGHT_PINK}code by ${COLORS.YELLOW}[ ${COLORS.SILVER}WIT KOEI ${COLORS.YELLOW}] ${COLORS.RESET}`);
            console.log(`${COLORS.LIGHT_PINK}tele${COLORS.YELLOW}: ${COLORS.PINK}tphuc_0 ${COLORS.RESET}`);
            console.log(`${COLORS.GREEN}Hiện tại bạn có ${COLORS.YELLOW}${links.length}${COLORS.GREEN} tài khoản`);

            const userInput = await getUserInput(`${COLORS.YELLOW}[ ${COLORS.SILVER}WIT KOEI ${COLORS.YELLOW}] ${COLORS.LIGHT_PINK}• ${COLORS.GREEN}Nhập số lượng tài khoản muốn 🐮 chạy ${COLORS.YELLOW}(${COLORS.GREEN}hoặc ${COLORS.YELLOW}'all' ${COLORS.GREEN}để chạy tất cả${COLORS.YELLOW}, ${COLORS.RED}0 ${COLORS.GREEN}để thoát${COLORS.YELLOW}): `);
            
            let numAccounts = userInput.toLowerCase() === 'all' ? links.length : parseInt(userInput);
            if (numAccounts <= 0) break;
            if (numAccounts > links.length) numAccounts = links.length;

            const restTime = parseInt(await getUserInput(`${COLORS.YELLOW}[ ${COLORS.SILVER}WIT KOEI ${COLORS.YELLOW}] ${COLORS.LIGHT_PINK}• ${COLORS.GREEN}Nhập thời gian nghỉ ngơi sau khi 🐮 chạy xong tất cả các tài khoản ${COLORS.YELLOW}( ${COLORS.GREEN}Khuyên ${COLORS.YELLOW}28800 ${COLORS.GREEN}nha${COLORS.YELLOW}): `));
            const repeatCount = parseInt(await getUserInput(`${COLORS.YELLOW}[ ${COLORS.SILVER}WIT KOEI ${COLORS.YELLOW}] ${COLORS.LIGHT_PINK}• ${COLORS.GREEN}Nhập số lần lặp lại sau thời gian nghỉ ngơi ${COLORS.YELLOW}( ${COLORS.GREEN}hoặc ${COLORS.YELLOW}0 ${COLORS.GREEN}để chạy một lần): `));
            const instancesCount = parseInt(await getUserInput(`${COLORS.YELLOW}[ ${COLORS.SILVER}WIT KOEI ${COLORS.YELLOW}] ${COLORS.LIGHT_PINK}• ${COLORS.GREEN}Nhập số lượng luồng máy bạn có thể xử lý tài khoản để chạy ${COLORS.YELLOW}( ${COLORS.GREEN}Ai máy yếu khuyên  ${COLORS.YELLOW}6 ${COLORS.GREEN}nha${COLORS.YELLOW}): `));

            if (isNaN(restTime) || isNaN(repeatCount) || repeatCount < 0 || isNaN(instancesCount) || instancesCount <= 0) {
                console.log(`${COLORS.RED}Nhập không hợp lệ!${COLORS.RESET}`);
                continue;
            }

            for (let i = 0; i <= repeatCount; i++) {
                console.log(`${COLORS.SILVER}Chạy lần ${COLORS.GREEN}${i + 1}${COLORS.RESET}`);
                await runPlaywrightInstances(links.slice(0, numAccounts), proxies, instancesCount);
                if (i < repeatCount) await countdownTimer(restTime);
            }

            console.log(`${COLORS.YELLOW}[ ${COLORS.SILVER}WIT KOEI ${COLORS.YELLOW}] ${COLORS.LIGHT_PINK}• ${COLORS.GREEN}Đã hoàn tất tất cả các số lần muốn chạy lại.${COLORS.RESET}`);
        }
    } catch (e) {
        console.log(`${COLORS.RED}Lỗi: ${e.message}${COLORS.RESET}`);
    }
})();
