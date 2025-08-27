import os
import sys
import time

# ANSI escape code cho màu đỏ
RED = "\033[91m"
RESET = "\033[0m"

def main():
    # Xóa màn hình tùy hệ điều hành
    os.system('cls' if os.name == 'nt' else 'clear')

    print(RED + "Đang bảo trì... Vui lòng đợi" + RESET)

    # Giữ màn hình không tắt ngay
    print("\nNhấn Enter để thoát...")
    input()

if __name__ == "__main__":
    main()
