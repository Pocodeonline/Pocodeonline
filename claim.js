const ethers = require('ethers');
const fs = require('fs').promises;
require('dotenv').config();
const { promisify } = require('util');
const { pipeline } = require('stream');
const { Transform } = require('stream');

const SILVER = '\x1b[38;5;231m';
const LIGHT_PINK = '\x1b[38;5;207m';
const PINK = '\x1b[38;5;13m';
const YELLOW = '\x1b[38;5;11m';
const GREEN = '\x1b[38;5;10m';
const RED = '\x1b[38;5;9m';
const LIGHT_BLUE = '\x1b[38;5;12m';
const DARK_BLUE = '\x1b[38;5;19m';
const RESET = '\x1b[0m';

// Địa chỉ của smart contract
const CONTRACT_ADDRESS = '0xD5B3BC210352D71f9c7fe7d94cb86FC49B42209a';

const ABI = [
  {
    "inputs": [],
    "name": "claim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const provider = new ethers.JsonRpcProvider('https://rpc.matchain.io');
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

async function claimForWallet(privateKey, index) {
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    const connectedContract = contract.connect(wallet);

    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Đang claim ví ${index + 1}: ${wallet.address}${YELLOW}`); // Modified line
    const tx = await connectedContract.claim();
    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Transaction hash${YELLOW}: ${tx.hash}`);
    await tx.wait();
    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Claim thành công ví ${index + 1}: ${wallet.address}${YELLOW}`); // Modified line

    // Lưu địa chỉ ví claim thành công vào file note.txt
    await fs.appendFile('vithanhcong.txt', `${wallet.address}\n`);
  } catch (error) {
    console.error(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED} Claim lỗi${YELLOW}: ${error.message}`);
  }
}

async function main() {
  try {
    const privateKeys = (await fs.readFile('claim.txt', 'utf-8')).split('\n').filter(Boolean);

    // Split the privateKeys array into chunks of 500
    const chunkSize = 500;
    const chunks = privateKeys.reduce((resultArray, item, index) => { 
      const chunkIndex = Math.floor(index / chunkSize);
      if(!resultArray[chunkIndex]) {
        resultArray[chunkIndex] = [] // start a new chunk
      }
      resultArray[chunkIndex].push(item)
      return resultArray
    }, []);

    // Process each chunk in parallel
    for (const [chunkIndex, chunk] of chunks.entries()) {
      await Promise.all(chunk.map(async (privateKey, index) => {
        await claimForWallet(privateKey.trim(), chunkIndex * chunkSize + index); // Modified line
      }));
    }
  } catch (error) {
    console.error(`${RED}Lỗi đọc khóa ví ${YELLOW}:`, error);
  }
}

main().then(() => console.log(`${GREEN} Đã claim tất cả...`)).catch(console.error);
