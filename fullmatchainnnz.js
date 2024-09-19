const https = require('https');
const readline = require('readline');

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

// Hàm để hiển thị menu và lấy lựa chọn từ người dùng
function showMenu() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log("Chọn chức năng:");
        console.log("1. Claim + mua x2");
        console.log("2. Làm task cho acc");

        rl.question("Nhập lựa chọn của bạn (1 hoặc 2): ", (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

// Chạy chương trình
(async function main() {
    try {
        if (await checkInternetConnection()) {
            const choice = await showMenu();
            let url;

            if (choice === '1') {
                url = 'https://raw.githubusercontent.com/Pocodeonline/Pocodeonline/main/matchainsv.js'; // Claim + mua x2
            } else if (choice === '2') {
                url = 'https://raw.githubusercontent.com/Pocodeonline/Pocodeonline/main/taskmatchain.js'; // Làm task cho acc
            } else {
                console.error('\x1b[38;5;9mLựa chọn không hợp lệ. Vui lòng thử lại.\x1b[0m');
                return;
            }

            try {
                await executeCode(url);
            } catch (error) {
                console.error('\x1b[38;5;9mĐã gặp lỗi khi thực thi mã:', error, '\x1b[0m');
            }
        } else {
            console.error('\x1b[38;5;9mKhông có kết nối mạng. Vui lòng kiểm tra kết nối của bạn.\x1b[0m');
        }
    } catch (error) {
        console.error('\x1b[38;5;9mĐã gặp lỗi);
    }
})();
