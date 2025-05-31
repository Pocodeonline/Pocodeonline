import os
import subprocess
import cv2
import numpy as np
import time
import pyperclip
import base64
import easyocr
import threading
from colorama import init

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

print(f"{COLORS['YELLOW']} {COLORS['BRIGHT_CYAN']}Tool Send Voucher CocaZalo By SoHan JVS {COLORS['RESET']}")

class Auto:
    def __init__(self, device_id):
        self.device_id = device_id

    def screen_capture(self):
        try:
            tmp_path = "/sdcard/temp_screencap.png"
            subprocess.run(
                ["adb", "-s", self.device_id, "shell", "screencap", "-p", tmp_path],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            local_tmp = "temp_screencap.png"
            subprocess.run(
                ["adb", "-s", self.device_id, "pull", tmp_path, local_tmp],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            img = cv2.imread(local_tmp)
            if img is None:
                print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không đọc được file ảnh temp_screencap.png")
            os.remove(local_tmp)
            subprocess.run(
                ["adb", "-s", self.device_id, "shell", "rm", tmp_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            return img
        except subprocess.CalledProcessError as e:
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Lỗi khi chụp màn hình bằng adb shell screencap:", e)
            return None

    def find_image(self, template_path, threshold=0.95):
        screen = self.screen_capture()
        if screen is None:
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không có ảnh màn hình để xử lý.")
            return None

        template = cv2.imread(template_path)
        if template is None:
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm thấy file ảnh mẫu:", template_path)
            return None

        res = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
        loc = np.where(res >= threshold)
        points = list(zip(*loc[::-1]))
        if points:
            return points[0]
        return None

    def click(self, x, y):
        x_int = round(x)
        y_int = round(y)
        cmd = f"adb -s {self.device_id} shell input tap {x_int} {y_int}"
        os.system(cmd)
        time.sleep(0.1)

    def escape_adb_input_text(self, text):
        escape_chars = ['&','|','<','>','*','^','"',"'",'\\','/']
        safe_text = text.replace(' ', '%s')
        for ch in escape_chars:
            safe_text = safe_text.replace(ch, f"\\{ch}")
        return safe_text

    def input_text_full(self, text):
        safe_text = self.escape_adb_input_text(text)
        os.system(f'adb -s {self.device_id} shell input text "{safe_text}"')
        time.sleep(0.2)

    def click_and_hold(self, x, y, duration_ms=600):
        cmd = f'adb -s {self.device_id} shell input swipe {round(x)} {round(y)} {round(x)} {round(y)} {duration_ms}'
        os.system(cmd)
        time.sleep(duration_ms / 1000 + 0.1)

def wait_for_image(auto, img_path, timeout=30, threshold=0.95):
    start = time.time()
    while time.time() - start < timeout:
        pos = auto.find_image(img_path, threshold)
        if pos:
            return pos
        time.sleep(0.5)
    return None

def solve_captcha_from_imagefile(img_path):
    try:
        img = cv2.imread(img_path)
        if img is None:
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không đọc được file ảnh captcha.")
            return None
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        img_resized = cv2.resize(img_gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
        _, img_thresh = cv2.threshold(img_resized, 150, 255, cv2.THRESH_BINARY_INV)

        reader = easyocr.Reader(['en'], gpu=False)
        result = reader.readtext(img_thresh)
        text = ''.join([res[1] for res in result])
        cleaned_text = ''.join(ch for ch in text if ch.isalnum())
        return cleaned_text.strip()
    except Exception as e:
        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Lỗi giải mã captcha từ ảnh:", e)
        return None

def handle_done_click(auto):
    start = time.time()
    timeout_check = 2
    while time.time() - start < timeout_check:
        if auto.find_image('loicapcha.png', 0.95):
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Nhập lỗi captcha xóa captcha cũ và đang làm captcha mới")

            auto.click(168.2, 1007.0)
            time.sleep(0.3)

            for _ in range(7):
                os.system(f'adb -s {auto.device_id} shell input keyevent 67')  # Backspace
                time.sleep(0.05)

            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã xóa captcha cũ trong ô nhập captcha.")

            if wait_for_image(auto, 'loadlaicapcha.png', timeout=20):
                auto.click(829.3, 1015.1)
                print("Đã làm mới captcha.")

                auto.click_and_hold(683.0, 1015.1, 600)

                pos_dl = wait_for_image(auto, 'downloadcaptcha.png', timeout=30)
                if pos_dl:
                    auto.click(152.0, 879.6)
                    print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đang tải mã captcha về để giải.")
                else:
                    print("Không thấy chỗ tải captcha, thoát.")
                    return 'repeat_captcha'

                captcha_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "captcha.png")

                wait_time = 0
                while not os.path.exists(captcha_img_path) and wait_time < 30:
                    time.sleep(1)
                    wait_time += 1

                if not os.path.exists(captcha_img_path):
                    print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không thấy file captcha để giải.")
                    return 'repeat_captcha'

                captcha_text = solve_captcha_from_imagefile(captcha_img_path)
                print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Captcha mới được giải từ ảnh: \x1b[93m{captcha_text}")

                try:
                    os.remove(captcha_img_path)
                except:
                    pass

                if not captcha_text:
                    print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không giải mã được captcha tải về.")
                    return 'repeat_captcha'

                pos_nhapcapcha_2 = wait_for_image(auto, 'nhapcapcha.png', timeout=10)
                if pos_nhapcapcha_2:
                    x2, y2 = pos_nhapcapcha_2
                    auto.click(x2, y2)
                    time.sleep(0.3)

                auto.input_text_full(captcha_text)
                time.sleep(0.3)

                if wait_for_image(auto, 'done.png', timeout=30):
                    auto.click(447.3, 1188.5)
                    print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã done được với captcha \x1b[93m[ \x1b[96m'{captcha_text}'.")
                    return handle_done_click(auto)
            else:
                print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không load lại được thoát vòng kiểm tra.")
                return 'repeat_captcha'

        if auto.find_image('nhaplaima.png', 0.95):
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[93m[ \x1b[96mMã đã nhập rồi nhập mã mới thôi.")
            auto.click(447.3, 546.4)
            time.sleep(1)
            return 'code_error'

        if auto.find_image('macocasai.png', 0.95):
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Mã coca sai chạy mã mới thôi\x1b[93m...")
            if wait_for_image(auto, 'loadlai.png', timeout=30):
                auto.click(859.1, 94.0)
                if wait_for_image(auto, 'dongyloadlai.png', timeout=30):
                    auto.click(683.0, 110.2)
                    time.sleep(1)
                    return 'code_retry_same'

        if auto.find_image('chucmung.png', 0.95):
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Nhập mã coca thành công ")
            if wait_for_image(auto, 'tieptucnhaptiepmamoi.png', timeout=60):
                auto.click(444.6, 649.3)
                print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã done tiếp tục nhập mã mới.")
                return 'success'

        time.sleep(0.2)
    return None

DEVICE_SERIAL = None
WATCH_PATH = "/storage/emulated/0/Download/zalo"
LOCAL_SAVE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_FILENAME = "captcha.png"

def get_connected_device():
    devices_raw = subprocess.check_output("adb devices").decode()
    devices = []
    for line in devices_raw.splitlines():
        if "\tdevice" in line:
            devices.append(line.split("\t")[0])
    if devices:
        return devices[0]
    else:
        return None

def list_all_files_with_time(device, base_path):
    try:
        find_cmd = f'adb -s {device} shell find "{base_path}" -type f'
        output = subprocess.check_output(find_cmd, shell=True).decode(errors='ignore')
        filepaths = output.strip().splitlines()

        files_with_time = []
        for f in filepaths:
            stat_cmd = f'adb -s {device} shell stat -c %Y "{f}"'
            stat_out = subprocess.check_output(stat_cmd, shell=True).decode(errors='ignore').strip()
            try:
                timestamp = int(stat_out)
            except:
                timestamp = 0
            files_with_time.append((f, timestamp))

        return files_with_time

    except subprocess.CalledProcessError:
        return []

def pull_and_rename(device, remote_path, local_path):
    print(f"Đang tải file {remote_path} về {local_path}")
    cmd = f'adb -s {device} pull "{remote_path}" "{local_path}"'
    result = subprocess.run(cmd, shell=True)
    if result.returncode == 0:
        print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Tải thành công captcha")
    else:
        print("Tải thất bại.")

def watch_and_pull_latest(stop_event):
    device = DEVICE_SERIAL or get_connected_device()
    if not device:
        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm thấy thiết bị ADB nào.")
        return

    print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đang tìm file captcha trên thiết bị \x1b[93m{device}")

    last_timestamp = 0

    while not stop_event.is_set():
        try:
            files = list_all_files_with_time(device, WATCH_PATH)
            if not files:
                time.sleep(2)
                continue

            files.sort(key=lambda x: x[1], reverse=True)
            latest_file, latest_time = files[0]

            if latest_time > last_timestamp:
                local_path = os.path.join(LOCAL_SAVE_DIR, LOCAL_FILENAME)
                pull_and_rename(device, latest_file, local_path)
                last_timestamp = latest_time
            else:
                time.sleep(2)

        except Exception as e:
            print("Lỗi tìm file:", e)
            time.sleep(5)

# --- MỞ RỘNG: Hàm xóa tất cả file trong thư mục WATCH_PATH trên thiết bị ---
def remove_all_files_in_watchpath(device, watch_path):
    try:
        # Liệt kê tất cả file trong folder
        list_files_cmd = f'adb -s {device} shell find "{watch_path}" -type f'
        output = subprocess.check_output(list_files_cmd, shell=True).decode(errors='ignore').strip()
        if not output:
            print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Không có file nào trong thư mục \x1b[93m{watch_path} \x1b[32mcủa thiết bị để xóa.")
            return
        files = output.splitlines()
        for f in files:
            rm_cmd = f'adb -s {device} shell rm "{f}"'
            subprocess.run(rm_cmd, shell=True)
            print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã xóa file: \x1b[93m{f}")
        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã xóa hết file trong thư mục thiết bị.")
    except subprocess.CalledProcessError as e:
        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Lỗi khi xóa file trong thư mục ", e)
# ---------------------------------------------------------------------------

def main():
    out = subprocess.check_output("adb devices", shell=True).decode()
    devices = []
    for line in out.strip().split('\n')[1:]:
        if 'device' in line:
            devices.append(line.split('\t')[0])
    if not devices:
        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm thấy thiết bị adb nào.")
        return

    device = devices[0]
    print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đang sử dụng thiết bị : \x1b[93m{device}")

    auto = Auto(device)

    print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đang mở app zalo trên thiết bị\x1b[93m...")
    pos = auto.find_image('zalo.png', threshold=0.95)
    if not pos:
        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không thấy app zalo trên màn hình thiết bị.")
        return
    auto.click(555.7, 251.1)
    print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Vào app zalo thành công")

    logged_in = input("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[96mBạn đã vào zalo và setup cấu hình nhập mã sẵn chưa rồi nhấn \x1b[93my \x1b[96mđể chạy nào\x1b[93m? (\x1b[32my/\x1b[31mn\x1b[93m): ").strip().lower()
    if logged_in != 'y':
        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Vui lòng setup cấu hình nhập mã sẵn khi chạy.")
        return

    # Xóa hết ảnh trong thư mục theo dõi trước khi chạy tiếp
    print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Xóa tất cả file trong thư mục trên thiết bị trước khi chạy...")
    remove_all_files_in_watchpath(device, WATCH_PATH)

    print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đang đợi ảnh mục 3 gạch xuất hiện\x1b[93m...")
    pos_luot = wait_for_image(auto, '3gach.png', timeout=60)
    if not pos_luot:
        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm thấy ảnh mục 3 gạch")
        return
    auto.click(62.6, 207.7)
    print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã vào mục 3 gạch.")

    print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đang đợi vào trang mục nhập mã")
    pos_nhapma = wait_for_image(auto, 'nhapma.png', timeout=60)
    if not pos_nhapma:
        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm thấy trang mục nhập mã")
        return
    auto.click(390.4, 779.4)
    print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã vào mục nhập mã")

    try:
        with open('macoca.txt', 'r', encoding='utf-8') as f:
            raw_lines = f.readlines()
        codes = [line.strip() for line in raw_lines if line.strip()]
        if not codes:
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] File \x1b[93mmacoca.txt \x1b[31mrỗng hoặc không có mã voucher nào")
            return
    except Exception as e:
        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Lỗi đọc file \x1b[93mmacoca.txt:", e)
        return

    total_points = 0
    code_index = 0
    error_count = 0
    ERROR_LIMIT = 3

    stop_event = threading.Event()
    watcher_thread = threading.Thread(target=watch_and_pull_latest, args=(stop_event,), daemon=True)
    watcher_thread.start()

    while code_index < len(codes):
        code = codes[code_index]
        print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đang xử lý mã thứ \x1b[93m{code_index+1}\x1b[32m/\x1b[93m{len(codes)}: \x1b[96m{code}")

        pos_dienma = wait_for_image(auto, 'dienma.png', timeout=60)
        if not pos_dienma:
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm thấy chỗ nhập mã thoát chương trình.")
            stop_event.set()
            watcher_thread.join()
            return

        auto.click(469.0, 874.2)
        time.sleep(0.3)

        auto.input_text_full(code)
        time.sleep(0.5)

        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đang giữ tìm chỗ tải captcha\x1b[93m...")
        start_hold = time.time()
        captcha_found = False
        while time.time() - start_hold < 60:
            pos_dl = auto.find_image('downloadcaptcha.png', 0.95)
            if pos_dl:
                captcha_found = True
                auto.click(152.0, 879.6)
                print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Phát hiện file captcha và đã tải")
                break
            else:
                auto.click_and_hold(683.0, 1015.1, 600)

        if not captcha_found:
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không thấy chỗ tải captcha chuyển sang mã tiếp theo.")
            code_index += 1
            continue

        captcha_img_path = os.path.join(LOCAL_SAVE_DIR, "captcha.png")
        wait_time = 0
        while not os.path.exists(captcha_img_path) and wait_time < 30:
            time.sleep(1)
            wait_time += 1

        if not os.path.exists(captcha_img_path):
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm thấy file captcha để giải\x1b[93m, \x1b[31mchuyển mã tiếp theo.")
            code_index += 1
            continue

        captcha_text = solve_captcha_from_imagefile(captcha_img_path)
        print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Captcha được giải là: \x1b[93m{captcha_text}")

        try:
            os.remove(captcha_img_path)
        except:
            pass

        if not captcha_text:
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không giải mã được captcha, thử lại mã hiện tại.")
            continue

        pos_captcha = wait_for_image(auto, 'nhapcapcha.png', timeout=60)
        if not pos_captcha:
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm thấy chỗ nhập captcha chuyển mã tiếp theo.")
            code_index += 1
            continue

        auto.click(*pos_captcha)
        time.sleep(0.3)

        auto.input_text_full(captcha_text)
        time.sleep(0.3)

        pos_done = wait_for_image(auto, 'done.png', timeout=60)
        if not pos_done:
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm chỗ ấn xong để chuyển mã tiếp theo.")
            code_index += 1
            continue

        auto.click(447.3, 1188.5)
        print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã  done với mã \x1b[93m{code}.")

        # Đếm lỗi sau click done
        error_detected_this_round = 0
        start_check_error = time.time()
        while time.time() - start_check_error < 3:
            if auto.find_image('nhaplaima.png', 0.95):
                error_detected_this_round += 1
            if auto.find_image('loicapcha.png', 0.95):
                error_detected_this_round += 1
            if auto.find_image('nhapkhongdungma.png', 0.95):
                error_detected_this_round += 1
            time.sleep(0.5)
            if error_detected_this_round >= 3:
                break

        error_count += error_detected_this_round
        if error_count >= ERROR_LIMIT:  # 3 lỗi là dừng
            print(f"\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Phát hiện \x1b[31m3 lần lỗi \x1b[32mnhập mã\x1b[93m/\x1b[32mcaptcha dừng để nhập tay mã chính xác.")
            while True:
                user_input = input("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Bạn hãy nhập tay mã chính xác\x1b[93m, \x1b[32msau khi xong muốn tiếp tục chạy mã tiếp theo không\x1b[93m? (\x1b[32my\x1b[93m/\x1b[31mn\x1b[93m): ").strip().lower()
                if user_input == 'y':
                    # Cộng điểm +5 do nhập tay thành công
                    total_points += 5
                    print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã cộng +\x1b[93m5 \x1b[32mđiểm do nhập mã bằng tay thành công\x1b[93m!")

                    # Reset lại số lỗi khi tiếp tục
                    error_count = 0

                    pos_loadlai = wait_for_image(auto, 'loadlai.png', timeout=30)
                    if pos_loadlai:
                        auto.click(*pos_loadlai)
                        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đang load lại mã\x1b[93m...")
                    else:
                        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm thấy ảnh chỗ load lại bỏ qua bước này.")

                    pos_dongy = wait_for_image(auto, 'dongyloadlai.png', timeout=30)
                    if pos_dongy:
                        auto.click(*pos_dongy)
                        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã load lại mã thành công")
                    else:
                        print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm thấy chỗ xác nhận load lại bỏ qua bước này.")

                    code_index += 1
                    break
                elif user_input == 'n':
                    print("\x1b[32m> \x1b[96mNgười dùng chọn dừng chương trình.")
                    stop_event.set()
                    watcher_thread.join()
                    return
                else:
                    print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Vui lòng nhập \x1b[93m'\x1b[32my\x1b[93m' \x1b[32mhoặc \x1b[93m'\x1b[31mn\x1b[93m'")
            continue

        result = handle_done_click(auto)

        if result == 'repeat_captcha':
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Lặp lại bước captcha với mã hiện tại.")
            continue

        elif result == 'code_error':
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Mã bị lỗi hoặc captcha sai chuyển sang mã tiếp theo.")
            error_count += 1
            code_index += 1
            continue

        elif result == 'code_retry_same':
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Mã coca bị sai làm lại")
            continue

        elif result == 'success':
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Chúc mừng bạn +5 điểm nhập mã thành công\x1b[93m!")
            total_points += 5
            # Reset lỗi sau khi thành công
            error_count = 0
            code_index += 1
            continue

        else:
            print("\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Không phát hiện cảnh báo nào\x1b[93m, \x1b[32mtiếp tục với mã tiếp theo")
            code_index += 1

    stop_event.set()
    watcher_thread.join()
    print(f"\x1b[32m> \x1b[96mĐã chạy hết mã trong \x1b[93mmacoca.txt. \x1b[96mTổng điểm nhập mã là: \x1b[93m{total_points}")

if __name__ == "__main__":
    main()
