import threading
import os
import subprocess
import time
import cv2
import numpy as np
from colorama import init  # Colors for console output

COLORS = {
    'RED': '\x1b[31m',
    'GREEN': '\x1b[32m',
    'YELLOW': '\x1b[33m',
    'CYAN': '\x1b[36m',
    'MAGENTA': '\x1b[35m',
    'BLUE': '\x1b[94m',
    'BRIGHT_YELLOW': '\x1b[93m',
    'BRIGHT_CYAN': '\x1b[96m',
    'RESET': '\x1b[0m'
}
init()

# Function to get connected devices
def get_connected_devices():
    out = subprocess.check_output("adb devices", shell=True, stderr=subprocess.DEVNULL).decode()
    devices = []
    for line in out.strip().split('\n')[1:]:
        if 'device' in line:
            devices.append(line.split('\t')[0])
    return devices

# Function to capture screen of the emulator
def capture_screen(device_id, retries=6, wait_time=4):
    try:
        tmp_path = "/sdcard/temp_screencap.png"
        local_tmp = "temp_screencap.png"
        
        # Capture screenshot on device and save it (suppress output)
        subprocess.Popen(["adb", "-s", device_id, "shell", "screencap", "-p", tmp_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).wait()
        
        for attempt in range(retries):
            # Pull the screenshot to the local machine (suppress output)
            pull_result = subprocess.Popen(["adb", "-s", device_id, "pull", tmp_path, local_tmp], stdout=subprocess.PIPE, stderr=subprocess.PIPE).wait()
            
            if pull_result == 0 and os.path.exists(local_tmp):
                # Check if the image was pulled correctly
                img = cv2.imread(local_tmp)
                if img is not None:
                    # Image read successfully, proceed
                    if os.path.exists(local_tmp):
                        os.remove(local_tmp)
                    # Remove the temporary screenshot file on the device
                    subprocess.Popen(["adb", "-s", device_id, "shell", "rm", tmp_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).wait()
                    return img
                else:
                    print(f"{COLORS['RED']}[ERROR] Không thể đọc file ảnh {local_tmp} lần {attempt + 1}")
            else:
                print(f"{COLORS['YELLOW']}[WARNING] Không thể tải ảnh màn hình từ {device_id} lần {attempt + 1}, thử lại...")

            time.sleep(wait_time)  # Wait before retrying
        
        # If all attempts fail
        print(f"{COLORS['RED']}[ERROR] Không thể tải ảnh màn hình từ {device_id} sau {retries} lần thử.")
        return None

    except subprocess.CalledProcessError as e:
        print(f"{COLORS['RED']}[ERROR] Lỗi khi chụp màn hình của {device_id}: {e}")
        return None
    except Exception as e:
        print(f"{COLORS['RED']}[ERROR] Lỗi không xác định trong capture_screen: {e}")
        return None

# Function to wait for an image on the emulator screen
def wait_for_image(auto, img_name, timeout=30, threshold=0.95):
    start = time.time()
    while time.time() - start < timeout:
        pos = auto.find_image(img_name, threshold)
        if pos:
            return pos
    return None

class Auto:
    def __init__(self, device_id, line_data, verbose=False):
        self.device_id = device_id
        self.line_data = line_data  # Holds the line of data from dulieu.txt (name|email|phone)
        self.verbose = verbose  # To control whether we print detailed actions like clicking
        
    def click(self, x, y):
        # Simulate a tap on the screen at the given coordinates (x, y)
        cmd = f"adb -s {self.device_id} shell input tap {round(x)} {round(y)}"
        subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).wait()

    def input_text(self, text):
        # Use the adb command to input the text directly without delay
        safe_text = text.replace(' ', ' ')  # URL encode spaces as %20
    
        # Escape special characters
        escape_chars = ['&', '|', '<', '>', '*', '^', '"', "'", '\\', '/', '$']
        for ch in escape_chars:
            safe_text = safe_text.replace(ch, f"\\{ch}")

        # URL encode Vietnamese characters as well
        vietnamese_map = {
            'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
            'ă': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
            'â': 'a', 'ấ': 'a', 'ầ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
            'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
            'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
            'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
            'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
            'ô': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
            'ơ': 'o', 'ớ': 'o', 'ờ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
            'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
            'ư': 'u', 'ứ': 'u', 'ừ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
            'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
            'đ': 'd'
        }
    
        for key, value in vietnamese_map.items():
            safe_text = safe_text.replace(key, value)
    
        # Use adb to input the entire text at once, skipping typing individual characters
        cmd = f'adb -s {self.device_id} shell input text "{safe_text}"'
        subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).wait()

    def find_image(self, template_filename, threshold=0.55):
        # Capture the screen from the device
        screen = capture_screen(self.device_id)
        if screen is None:
            print(f"{COLORS['RED']}[ERROR] Không có ảnh màn hình từ {self.device_id}")
            return None
        
        template_path = os.path.join("image", template_filename)
        template = cv2.imread(template_path)
        if template is None:
            print(f"{COLORS['RED']}[ERROR] Không tìm thấy file ảnh mẫu: {template_path}")
            return None
        
        res = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
        loc = np.where(res >= threshold)
        points = list(zip(*loc[::-1]))  # Get the coordinates where the image is found
        if points:
            return points[0]
        return None

    def perform_actions(self):
        # Start by opening Zalo
        self.click(552.9, 261.9)  # Click on Zalo app icon
        print(f"{COLORS['GREEN']}Đã mở Zalo trên {self.device_id}")
        
        # Wait for QR Code scanning screen
        wait_for_image(self, 'quetqr.png')
        self.click(753.4, 91.2)  # Click on QR Scan option
        
        # Wait for the "Chọn QR Code" screen
        wait_for_image(self, 'chonqrcosan.png')
        print(f"{COLORS['YELLOW']}Vui lòng quét QR trên {self.device_id}")
        
        # After QR is scanned, ask for countdown time (in minutes or seconds)
        countdown_time = input(f"{COLORS['GREEN']}Nhập thời gian đếm ngược cho {self.device_id} (mm:ss hoặc chỉ giây): ").strip()
        
        # Parse the input time
        if ":" in countdown_time:
            minutes, seconds = map(int, countdown_time.split(":"))
            total_seconds = minutes * 60 + seconds
        else:
            total_seconds = int(countdown_time)
        
        # Perform countdown
        for remaining_seconds in range(total_seconds, 0, -1):
            minutes = remaining_seconds // 60
            seconds = remaining_seconds % 60
            time_str = f"{minutes:01}:{seconds:02}"
            print(f"\r{COLORS['CYAN']}Đếm ngược trên {self.device_id}: {time_str}", end="")  # Delay 1 second for each decrement
            time.sleep(1)
        
        # After countdown is over, perform the next actions
        print(f"\n{COLORS['CYAN']}Đếm ngược hoàn thành cho {self.device_id}")
        self.click(750.7, 85.8)
        # Wait for "tailaitrang.png" image to appear
        wait_for_image(self, 'tailaitrang.png')
        self.click(734.5, 1321.2)  # Click at the required position after 'tailaitrang.png' appears
        time.sleep(2)
        # Wait for the "luot.png" image and swipe down
        wait_for_image(self, 'luot.png')
        
        # Perform swipe immediately after the image appears
        self.swipe(447.3, 1429.6, 447.3, 15.4)
        time.sleep(0.1)    # Swipe down quickly
        
        # Continue after swipe
        wait_for_image(self, 'nhapten.png')  # Wait for "Nhập tên" image to appear
        self.click(157.4, 362.2)  # Click on the "Tên" input field
        self.input_text("Hà Ngọc Hưng")  # Paste the name directly
        
        self.click(179.1, 730.6)  # Click on the "Email" input field
        self.input_text("hunghung1416@gmail.com")  # Paste the email directly
        
        self.click(206.2, 901.3)  # Click on the "Số điện thoại" input field
        self.input_text("066204009139") 
         # Paste the phone number directly
        self.click(265.8, 559.9)
        # Click the final registration button (skip image recognition)
        self.click(72.4, 1020.7)
        
        # Wait for "next.png" image to appear and click it
        if wait_for_image(self, 'next.png'):
            self.click(417.5, 1505.4)  # Click on "Next"
        
        # Continue with the rest of the registration process
        self.continue_registration()

    def swipe(self, x1, y1, x2, y2):
        # Perform swipe action immediately without delay
        subprocess.Popen(f"adb -s {self.device_id} shell input touchscreen swipe {x1} {y1} {x2} {y2}", shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).wait()

    def continue_registration(self):
        
        # Wait for city selection
        wait_for_image(self, 'chontinhthanh.png')
        self.click(184.5, 424.5)
        time.sleep(0.3)
        self.click(141.2, 513.9)
        time.sleep(0.2)
        # Select store
        self.click(623.4, 424.5)
        time.sleep(0.3)
        self.click(211.6, 559.9)
        time.sleep(0.2)
        # Select working hours
        self.click(157.4, 706.2)
        
        # Final registration step
        wait_for_image(self, 'dangki.png')
        self.click(341.6, 1508.2)
        
        # Check registration success
        if wait_for_image(self, 'thanhcong.png'):
            print(f"{COLORS['GREEN']}Đăng ký thông tin {self.line_data.split('|')[0]} thành công trên {self.device_id}")
        else:
            print(f"{COLORS['RED']}Đăng ký thất bại cho {self.line_data.split('|')[0]} vì đăng kí QR này rồi")

# Main function to coordinate the whole process
def main():
    devices = get_connected_devices()
    if not devices:
        print(f"{COLORS['RED']}[ERROR] Không tìm thấy thiết bị adb nào.")
        return
    
    print(f"{COLORS['GREEN']}> Có {len(devices)} thiết bị giả lập đang mở và đã kết nối.")
    devices_data = []
    
    # Read data from dulieu.txt and split each line into two parts
    with open('dulieu.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Iterate through devices and assign each pair of devices to a single line of data
    for i, device in enumerate(devices):
        line_index = i // 2  # Use floor division to map two devices to one line of data
        if line_index >= len(lines):
            print(f"{COLORS['RED']}[ERROR] Dữ liệu trong dulieu.txt không đủ cho {len(devices)} thiết bị.")
            return
        
        data = lines[line_index].strip()  # Get the corresponding data line
        devices_data.append((device, Auto(device, data, verbose=False)))  # Set verbose=False to suppress detailed clicks
    
    # Setup Zalo and QR code scanning steps
    logged_in = input(f"{COLORS['GREEN']}> Bạn đã vào zalo và setup cấu hình nhập mã sẵn chưa? Nhấn y để tiếp tục: ").strip().lower()
    if logged_in != 'y':
        print(f"{COLORS['RED']}[ERROR] Vui lòng setup cấu hình nhập mã sẵn.")
        return
    
    # Create a thread for each device to run perform_actions concurrently
    threads = []
    for device, auto in devices_data:
        thread = threading.Thread(target=auto.perform_actions)
        threads.append(thread)
        thread.start()
    
    # Wait for all threads to complete
    for thread in threads:
        thread.join()
    
    print(f"{COLORS['GREEN']}> Đã thực hiện hành động cho tất cả các thiết bị.")

if __name__ == "__main__":
    main()
