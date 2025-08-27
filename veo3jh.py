import os

RED = "\033[91m"
RESET = "\033[0m"

os.system('cls' if os.name == 'nt' else 'clear')
print(RED + "Đang bảo trì... Vui lòng đợi" + RESET)
input("\nNhấn Enter để thoát...")
