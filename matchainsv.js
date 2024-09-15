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
    const maxRetries = 3; // Số lần tối đa để thử lại
    const retryDelay = 3000; // Thời gian chờ giữa các lần thử lại (5000ms = 5 giây)
    const maxUpdateAttempts = 3; // Số lần tối đa để thử cập nhật điểm

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
                } catch (err) {
                    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}Không thấy skip acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                }

                // Check for page load
                const pageLoadedSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_balance___ClINX";
                await page.waitForSelector(pageLoadedSelector, { timeout: 6000 });
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Đã vào giao diện ${await page.title()} Acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                await page.waitForTimeout(1500);
                const currentBalanceSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_mining___mBJYP > p";
                const currentBalance = await page.textContent(currentBalanceSelector);
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Số dư hiện tại của acc \x1b[38;5;11m${accountNumber} \x1b[38;5;11m: ${currentBalance}${COLORS.RESET}`);
                await page.waitForTimeout(1500);
                // Check if claim button exists
                
                const claimmatchainButtonSelector = '#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka';
                try {
                    await page.waitForSelector(claimmatchainButtonSelector, { timeout: 4500 });
                    await page.waitForTimeout(1000);
                } catch (error) {
                    console.log(`\x1b[33m[ \x1b[37mWIT KOEI \x1b[33m] \x1b[35m• \x1b[31mAcc \x1b[33m${accountNumber} \x1b[31m claim rồi`);
                }
                if (claimmatchainButtonSelector) {
                    await page.click(claimmatchainButtonSelector);
                    console.log(`\x1b[33m[ \x1b[37mWIT KOEI \x1b[33m] \x1b[35m• \x1b[36mClaim Acc \x1b[33m${accountNumber} \x1b[35m thành công...`);
                    await page.waitForTimeout(1500);
                    // Confirm startmining process
                    const startminingButtonSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka.farming____9oEZ";
                    let startminingButtonExists = false;

                    try {
                        startminingButtonExists = await page.waitForSelector(startminingButtonSelector, { visible: true, timeout: 10000 });
                    } catch (err) {
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}Acc \x1b[38;5;11m${accountNumber} \x1b[38;5;9mstart rồi hoặc không tồn tại.${COLORS.RESET}`);
                        return;
                    }

                    // Confirm startmining process
                    if (startminingButtonExists) {
                        await page.click(startminingButtonSelector);
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Đã đào lại cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        // Print remaining time
                        const countdownHoursSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_countdown___G04z1 > ul";
                        const countdownHours = await page.textContent(countdownHoursSelector, { timeout: 30000 });
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Thời gian còn lại của acc \x1b[38;5;11m${accountNumber}: ${countdownHours}${COLORS.RESET}`);

                        // Click on specific element
                        const clickItemSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container___Joeqw > div.item___aAzf7.left_item___po1MT > div > div.content_top___biYaq > div:nth-child(1) > img";
                        await page.waitForSelector(clickItemSelector, { timeout: 4500 });
                        await page.click(clickItemSelector);
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Đang mua x2 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        // Click on specific element
                        const clickx2Selector = "#root > div > div.container___tYOO7 > div.content___xItdF > div.btn___FttFE";
                        await page.waitForSelector(clickx2Selector, { timeout: 4500 });
                        await page.click(clickx2Selector);
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Đã mua x2 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                        await page.waitForTimeout(5000);

                        // Wait for final element and get its text
                        const finalPointsSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container___Joeqw > div.item___aAzf7.left_item___po1MT > div > div.content_bottom___dCWi7 > div > div.points___ya4CK";
                        await page.waitForSelector(finalPointsSelector);
                        const finalPoints = await page.textContent(finalPointsSelector);
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}-50 point mua x2 acc \x1b[38;5;11m${accountNumber} \x1b[38;5;11m: ${finalPoints}${COLORS.RESET}`);

                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Mua x2 thành công cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                        // Click on specific element to start task

                        const taskStartSelector = "#root > div > div > ul > li:nth-child(2) > img";
                        await page.waitForSelector(taskStartSelector, { timeout: 3000 });
                        await page.click(taskStartSelector);
                        console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Bắt đầu làm nhiệm vụ cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                        
                        // Wait for the task 1 button to be clickable
                        const task1ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(1) > div.btn___xz27R";
                        const claimtask1ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(1) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task1ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 1 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task1ButtonSelector);
                            await page.waitForSelector(claimtask1ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 1 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask1ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 1 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 1 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        // Wait for the task 2 button to be clickable
                        const task2ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(2) > div.btn___xz27R";
                        const claimtask2ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(2) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task2ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 2 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task2ButtonSelector);
                            await page.waitForSelector(claimtask2ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 2 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask2ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 2 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 2 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        // Wait for the task 3 button to be clickable
                        const task3ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(3) > div.btn___xz27R";
                        const claimtask3ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(3) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task3ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 3 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task3ButtonSelector);
                            await page.waitForSelector(claimtask3ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 3 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask3ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 3 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 3 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        // Wait for the task 4 button to be clickable
                        const task4ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(4) > div.btn___xz27R";
                        const claimtask4ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(4) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task4ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 4 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task4ButtonSelector);
                            await page.waitForSelector(claimtask4ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 4 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask4ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 4 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 4 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        // Wait for the task 5 button to be clickable
                        const task5ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(2) > div.btn___xz27R";
                        const claimtask5ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(2) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task5ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 5 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task5ButtonSelector);
                            await page.waitForSelector(claimtask5ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 5 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask5ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 5 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 5 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        // Wait for the task 6 button to be clickable
                        const task6ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(3) > div.btn___xz27R";
                        const claimtask6ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(3) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task6ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 6 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task6ButtonSelector);
                            await page.waitForSelector(claimtask6ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 6 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask6ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 6 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 6 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        // Wait for the task 7 button to be clickable
                        const task7ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(3) > div.btn___xz27R";
                        const claimtask7ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(3) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task7ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 7 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task7ButtonSelector);
                            await page.waitForSelector(claimtask7ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 7 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask7ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 7 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 7 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        // Wait for the task 7 button to be clickable
                        const task8ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(1) > div.btn___xz27R";
                        const claimtask8ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(1) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task8ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 8 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task8ButtonSelector);
                            await page.waitForSelector(claimtask8ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 8 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask8ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 8 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 8 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }
                        
                        // Wait for the task 7 button to be clickable
                        const task9ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(4) > div.btn___xz27R";
                        const claimtask9ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(4) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task9ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 9 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task9ButtonSelector);
                            await page.waitForSelector(claimtask9ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 9 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask9ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 9 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 9 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task10ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(5) > div.btn___xz27R";
                        const claimtask10ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(5) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task10ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 10 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task10ButtonSelector);
                            await page.waitForSelector(claimtask10ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 10 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask10ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 10 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 10 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task11ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(6) > div.btn___xz27R";
                        const claimtask11ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(6) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task11ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 11 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task11ButtonSelector);
                            await page.waitForSelector(claimtask11ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 11 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask11ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 11 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 11 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task12ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(7) > div.btn___xz27R";
                        const claimtask12ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(7) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task12ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 12 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task12ButtonSelector);
                            await page.waitForSelector(claimtask12ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 12 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask12ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 12 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 12 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task13ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(8) > div.btn___xz27R";
                        const claimtask13ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(8) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task13ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 13 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task13ButtonSelector);
                            await page.waitForSelector(claimtask13ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 13 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask13ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 13 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 13 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task14ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(9) > div.btn___xz27R";
                        const claimtask14ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(9) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task14ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 14 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task14ButtonSelector);
                            await page.waitForSelector(claimtask14ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 14 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask14ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 14 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 14 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task15ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(10) > div.btn___xz27R";
                        const claimtask15ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(10) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task15ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 15 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task15ButtonSelector);
                            await page.waitForSelector(claimtask15ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 15 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask15ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 15 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 15 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task16ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(11) > div.btn___xz27R";
                        const claimtask16ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(11) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task16ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 16 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task16ButtonSelector);
                            await page.waitForSelector(claimtask16ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 16 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask16ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 16 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 16 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task17ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(12) > div.btn___xz27R";
                        const claimtask17ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(12) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task17ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 17 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task17ButtonSelector);
                            await page.waitForSelector(claimtask17ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 17 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask17ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 17 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 17 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task18ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(13) > div.btn___xz27R";
                        const claimtask18ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(13) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task18ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 18 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task18ButtonSelector);
                            await page.waitForSelector(claimtask18ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 18 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask18ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 18 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 18 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task19ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(14) > div.btn___xz27R";
                        const claimtask19ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(14) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task19ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 19 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task19ButtonSelector);
                            await page.waitForSelector(claimtask19ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 19 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask19ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 19 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 19 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task20ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(15) > div.btn___xz27R";
                        const claimtask20ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(15) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task20ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 20 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task20ButtonSelector);
                            await page.waitForSelector(claimtask20ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 20 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask20ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 20 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 20 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }


                        const task21ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(16) > div.btn___xz27R";
                        const claimtask21ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.matchain_ecosystem____eeip > ul > li:nth-child(16) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task21ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 21 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task21ButtonSelector);
                            await page.waitForSelector(claimtask21ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 21 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask21ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 21 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 21 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task22ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(1) > div.btn___xz27R";
                        const claimtask22ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(1) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task22ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 22 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task22ButtonSelector);
                            await page.waitForSelector(claimtask22ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 22 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask22ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 22 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 22 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task23ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(2) > div.btn___xz27R";
                        const claimtask23ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(2) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task23ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 23 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task23ButtonSelector);
                            await page.waitForSelector(claimtask23ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 23 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask23ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 23 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 23 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task24ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(3) > div.btn___xz27R";
                        const claimtask24ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(3) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task24ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 24 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task24ButtonSelector);
                            await page.waitForSelector(claimtask24ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 24 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask24ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 24 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 24 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task25ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(4) > div.btn___xz27R";
                        const claimtask25ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(4) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task25ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 25 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task25ButtonSelector);
                            await page.waitForSelector(claimtask25ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 25 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask25ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 25 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 25 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task26ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(5) > div.btn___xz27R";
                        const claimtask26ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(5) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task26ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 26 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task26ButtonSelector);
                            await page.waitForSelector(claimtask26ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 26 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask26ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 26 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 26 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task27ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(6) > div.btn___xz27R";
                        const claimtask27ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(6) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task27ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 27 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task27ButtonSelector);
                            await page.waitForSelector(claimtask27ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 27 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask27ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 27 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 27 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task28ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(7) > div.btn___xz27R";
                        const claimtask28ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(7) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task28ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 28 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task28ButtonSelector);
                            await page.waitForSelector(claimtask28ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 28 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask28ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 28 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 28 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task29ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(8) > div.btn___xz27R";
                        const claimtask29ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(8) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task29ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 29 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task29ButtonSelector);
                            await page.waitForSelector(claimtask29ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 29 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask29ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 29 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 29 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        const task30ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(9) > div.btn___xz27R";
                        const claimtask30ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div:nth-child(3) > ul > li:nth-child(9) > div.btn___xz27R.claim___VQBtK";
                        try {
                            await page.waitForSelector(task30ButtonSelector, { timeout: 3000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 30 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(task30ButtonSelector);
                            await page.waitForSelector(claimtask30ButtonSelector, { timeout: 6000 });
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 30 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            await page.click(claimtask30ButtonSelector);
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 30 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

                        } catch (error) {
                            // If the task button is not found, log a message and continue
                            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 30 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            // Continue with the next part of the code
                        }

                        success = true;
                    }
                }
                break; // Exit retry loop if successful
            } catch (error) {
                if (attempt < maxRetries) {
                    await page.waitForTimeout(retryDelay);
                } else {
                    console.error(`${COLORS.RED}Xảy ra lỗi khi xử lý tài khoản ${accountNumber}${COLORS.RESET}`);
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
                '--disable-dev-shm-usage',
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
