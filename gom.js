const ethers = require('ethers');
const fs = require('fs').promises;
require('dotenv').config();

const SILVER = '\x1b[38;5;231m';
const LIGHT_PINK = '\x1b[38;5;207m';
const PINK = '\x1b[38;5;13m';
const YELLOW = '\x1b[38;5;11m';
const GREEN = '\x1b[38;5;10m';
const RED = '\x1b[38;5;9m';
const LIGHT_BLUE = '\x1b[38;5;12m';
const DARK_BLUE = '\x1b[38;5;19m';
const RESET = '\x1b[0m';

const TOKEN_ADDRESS = '0xB2174052dd2F3FCAB9Ba622F2e04FBEA13fc0dFC';

const ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "transfer",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const provider = new ethers.JsonRpcProvider('https://rpc.matchain.io');
const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ABI, provider);

async function chuyenToken(khoaRiengTu, index, DESTINATION_ADDRESS) {
  try {
    const vi = new ethers.Wallet(khoaRiengTu, provider);
    const hopDongKetNoi = tokenContract.connect(vi);

    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Kiểm tra số dư cho ví: ${vi.address}`);
    const soDu = await hopDongKetNoi.balanceOf(vi.address);

    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Tìm thấy token:`, soDu.toString());

    if (soDu == 0n) {
      console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED} Không có token để chuyển từ ví: ${vi.address}`);
      return;
    }

    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Chuyển ${ethers.formatEther(soDu)} token từ ${vi.address} đến ${DESTINATION_ADDRESS}`);
    const giaoDich = await hopDongKetNoi.transfer(DESTINATION_ADDRESS, soDu);
    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Mã giao dịch: ${giaoDich.hash}`);
    await giaoDich.wait();
    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Chuyển token thành công từ ví ${index + 1}: ${vi.address}`);
  } catch (loi) {
    console.error(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED} Không đủ gas để chuyển token`);
  }
}

async function main() {
  try {
    const DESTINATION_ADDRESS = (await fs.readFile('gomlolchovichinh.txt', 'utf-8')).trim();
    const danhSachKhoaRiengTu = (await fs.readFile('diachidegomlol.txt', 'utf-8')).split('\n').filter(Boolean);

    // Split the danhSachKhoaRiengTu array into chunks of 50
    const chunkSize = 500;
    const chunks = danhSachKhoaRiengTu.reduce((resultArray, item, index) => { 
      const chunkIndex = Math.floor(index / chunkSize);
      if(!resultArray[chunkIndex]) {
        resultArray[chunkIndex] = [] // start a new chunk
      }
      resultArray[chunkIndex].push(item)
      return resultArray
    }, []);

    // Process each chunk in parallel
    for (const [chunkIndex, chunk] of chunks.entries()) {
      await Promise.all(chunk.map(async (khoaRiengTu, index) => {
        await chuyenToken(khoaRiengTu.trim(), chunkIndex * chunkSize + index, DESTINATION_ADDRESS);
      }));
    }
  } catch (loi) {
    console.error(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED} Lỗi khi đọc khóa riêng tư hoặc xử lý chuyển token:`, loi);
  }
}

main().then(() => console.log(`${GREEN}Đã xử lý tất cả các acc  chuyển `)).catch(console.error);
