# --- IMPORTS & SETUP ---
import os
import requests
import customtkinter as ctk
from tkinter import filedialog, Canvas, messagebox
import tkinter as tk
import re
import threading
import time
import base64
import requests
import uuid
import colorsys
import pandas as pd

# --- GitHub config ---
GITHUB_OWNER = 'Pocodeonline'
GITHUB_REPO = 'Pocodeonline'
GITHUB_FILE = 'lux.txt'
GITHUB_TOKEN = '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'

# --- GitHub helper functions ---
def github_get_file_content():
    url = f'https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/{GITHUB_FILE}'
    headers = {'Authorization': f'token {GITHUB_TOKEN}'}
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        content = r.json()['content']
        return base64.b64decode(content).decode('utf-8'), r.json()['sha']
    elif r.status_code == 404:
        return '', None  # File chưa tồn tại
    else:
        raise Exception(f'Không đọc được file GitHub: {r.text}')

def github_append_line(line):
    # Đọc file hiện tại
    content, sha = github_get_file_content()
    lines = content.splitlines() if content else []
    lines.append(line)
    new_content = '\n'.join(lines) + '\n'
    url = f'https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/{GITHUB_FILE}'
    headers = {'Authorization': f'token {GITHUB_TOKEN}'}
    data = {
        'message': 'Append new user to lux.txt',
        'content': base64.b64encode(new_content.encode('utf-8')).decode('utf-8'),
        'branch': 'main',
    }
    if sha:
        data['sha'] = sha
    r = requests.put(url, headers=headers, json=data)
    if r.status_code not in (200, 201):
        raise Exception(f'Lưu file GitHub thất bại: {r.text}')

# --- GitHub helper functions for telelux.txt ---
GITHUB_TELE_FILE = 'telelux.txt'

def get_device_id():
    return str(uuid.getnode())

def github_get_tele_file():
    url = f'https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/{GITHUB_TELE_FILE}'
    headers = {'Authorization': f'token {GITHUB_TOKEN}'}
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        content = r.json()['content']
        return base64.b64decode(content).decode('utf-8'), r.json()['sha']
    elif r.status_code == 404:
        return '', None
    else:
        raise Exception(f'Không đọc được file GitHub: {r.text}')

def github_update_tele(id_tele, device_id):
    content, sha = github_get_tele_file()
    lines = content.splitlines() if content else []
    found = False
    new_lines = []
    for line in lines:
        parts = [x.strip() for x in line.split('|')]
        if len(parts) == 2 and parts[1] == device_id:
            new_lines.append(f'{id_tele} | {device_id}')
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f'{id_tele} | {device_id}')
    new_content = '\n'.join(new_lines) + '\n'
    url = f'https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/{GITHUB_TELE_FILE}'
    headers = {'Authorization': f'token {GITHUB_TOKEN}'}
    data = {
        'message': 'Update telelux.txt',
        'content': base64.b64encode(new_content.encode('utf-8')).decode('utf-8'),
        'branch': 'main',
    }
    if sha:
        data['sha'] = sha
    r = requests.put(url, headers=headers, json=data)
    if r.status_code not in (200, 201):
        raise Exception(f'Lưu file GitHub thất bại: {r.text}')

def github_get_tele_by_device(device_id):
    content, _ = github_get_tele_file()
    for line in content.splitlines():
        parts = [x.strip() for x in line.split('|')]
        if len(parts) == 2 and parts[1] == device_id:
            return parts[0]
    return None

# --- APP INIT ---
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

app = ctk.CTk()
app.title("DP TOOL - LUX")
app.geometry("1200x800")
app.resizable(True, True)
app.minsize(1000, 700)

# --- Hiệu ứng particles ---
import random, math
from PIL import Image, ImageTk, ImageDraw

def create_gradient_image(width, height, color1, color2):
    image = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(image)
    for y in range(height):
        r = int(color1[0] + (color2[0] - color1[0]) * y / height)
        g = int(color1[1] + (color2[1] - color1[1]) * y / height)
        b = int(color1[2] + (color2[2] - color1[2]) * y / height)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    return ImageTk.PhotoImage(image)

black_bg = tk.Label(app, background='#000000')
black_bg.place(x=0, y=0, relwidth=1, relheight=1)
gradient_bg = create_gradient_image(1200, 800, (13, 17, 23), (0, 0, 0))
bg_label = tk.Label(app, image=gradient_bg)
bg_label.place(x=0, y=0, relwidth=1, relheight=1)

particle_canvas = Canvas(
    app, width=1200, height=800, highlightthickness=0, highlightbackground='#000000', bg='#111111'
)
particle_canvas.place(x=0, y=0, relwidth=1, relheight=1)

class Particle:
    def __init__(self, canvas):
        self.canvas = canvas
        self.reset()
        self.id = canvas.create_oval(
            self.x, self.y, self.x + self.size, self.y + self.size,
            fill=self.color, outline=self.color
        )
    def reset(self):
        self.x = random.randint(0, 1000)
        self.y = random.randint(0, 700)
        self.size = random.randint(1, 3)
        self.speed = random.uniform(0.2, 1)
        self.angle = random.uniform(0, 2 * math.pi)
        self.color = random.choice(['#4158D0', '#C850C0', '#FFCC70'])
    def move(self):
        self.angle += random.uniform(-0.1, 0.1)
        self.x += math.cos(self.angle) * self.speed
        self.y += math.sin(self.angle) * self.speed
        if not (0 <= self.x <= 1000 and 0 <= self.y <= 700):
            self.reset()
        self.canvas.moveto(self.id, self.x, self.y)
particles = [Particle(particle_canvas) for _ in range(100)]
def animate_particles():
    for particle in particles:
        try: particle.move()
        except: pass
    app.animation_after_id = app.after(20, animate_particles)
app.animation_after_id = app.after(20, animate_particles)

# --- MENU & LAYOUT ---
left_frame = ctk.CTkFrame(app, width=250, fg_color="#111111", border_width=0, corner_radius=0)
right_frame = ctk.CTkFrame(app, fg_color="#111111", border_width=0, corner_radius=0)
right_frame.configure(width=950)

left_frame.pack(side="left", fill="both")
right_frame.pack(side="left", fill="both", expand=True)

menu_frame = ctk.CTkFrame(left_frame, fg_color="transparent")
menu_frame.pack(pady=20, padx=10, fill="x")
border_frame = ctk.CTkFrame(menu_frame, fg_color="transparent", border_width=3, border_color="#0066cc", corner_radius=15)
border_frame.pack(pady=10, padx=10, fill="x")
menu_label = ctk.CTkLabel(border_frame, text="⚡ MENU ⚡", font=("Arial Black", 32, "bold"), text_color="#ffffff", fg_color="transparent")
menu_label.pack(pady=15)

def animate_lightning():
    menu_label.configure(text=f"⚡ MENU ⚡")
    app.after(300, animate_lightning)
animate_lightning()

separator_frame = ctk.CTkFrame(left_frame, height=3, fg_color="#87ceeb", corner_radius=5)
separator_frame.pack(pady=15, padx=20, fill="x")

# --- LUX MENU BUTTON ---
menu_buttons = []
class HoverButton(ctk.CTkButton):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.active = False
        self.configure(
            corner_radius=10, border_width=2, hover_color="#2d5fff", fg_color="#1a1a1a",
            border_color="#2d5fff", height=35, font=("Arial", 12, "bold"), text_color="#ffffff"
        )
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)
        self.bind("<Button-1>", self.on_click)
    def on_enter(self, event):
        if not self.active:
            self.configure(border_color="#3d7fff", fg_color="#1d1d1d")
    def on_leave(self, event):
        if not self.active:
            self.configure(border_color="#2d5fff", fg_color="#1a1a1a")
    def on_click(self, event):
        self.configure(fg_color="#2d5fff")
    def set_active(self, active=True):
        self.active = active
        if active:
            self.configure(fg_color="#2d5fff", border_color="#3d7fff")
        else:
            self.configure(fg_color="#1a1a1a", border_color="#2d5fff")

def create_gradient_button(parent, text, command, active_button=None):
    btn = HoverButton(parent, text=text, command=command)
    btn.pack(pady=8, padx=15, fill="x")
    def on_enter_gradient(event):
        btn.configure(border_color="#ff1493", fg_color="#ff69b4", hover_color="#ff1493")
    def on_leave_gradient(event):
        if not btn.active:
            btn.configure(border_color="#2d5fff", fg_color="#1a1a1a", hover_color="#2d5fff")
    btn.bind("<Enter>", on_enter_gradient)
    btn.bind("<Leave>", on_leave_gradient)
    return btn

# --- LUX FRAME ---
lux_frame = ctk.CTkFrame(right_frame)
lux_tele_id = None
lux_tele_id_var = ctk.StringVar()
lux_input_var = ctk.StringVar()

# --- Helper: Centered, beautiful popup with DP TOOLS header ---
def create_centered_popup(width, height, title_text="DP TOOLS", subtitle=None):
    popup = ctk.CTkToplevel(app)
    popup.geometry(f"{width}x{height}")
    popup.resizable(False, False)
    popup.grab_set()
    # Center the popup
    popup.update_idletasks()
    x = (popup.winfo_screenwidth() // 2) - (width // 2)
    y = (popup.winfo_screenheight() // 2) - (height // 2)
    popup.geometry(f"{width}x{height}+{x}+{y}")
    # Header
    header = ctk.CTkLabel(popup, text=title_text, font=("Impact", 32, "bold"), text_color="#00ffff")
    header.pack(pady=(18, 0))
    if subtitle:
        ctk.CTkLabel(popup, text=subtitle, font=("Arial Black", 16, "bold"), text_color="#00bfff").pack(pady=(8, 0))
    # Add a colored separator
    sep = ctk.CTkFrame(popup, height=3, fg_color="#00bfff", corner_radius=5)
    sep.pack(pady=(8, 18), padx=30, fill="x")
    return popup

# --- Step 1: Nhập Telegram ID hoặc tự động lấy ---
def show_lux_tele_id_popup(force=False):
    global lux_tele_id
    device_id = get_device_id()
    if not force:
        try:
            id_tele = github_get_tele_by_device(device_id)
            if id_tele:
                lux_tele_id = id_tele
                show_lux_main()
                return
        except Exception as e:
            pass  # Nếu lỗi vẫn cho nhập lại
    popup = create_centered_popup(420, 260, title_text="DP TOOLS", subtitle="Nhập ID Telegram của bạn")
    entry = ctk.CTkEntry(popup, textvariable=lux_tele_id_var, width=220, font=("Arial", 18), corner_radius=12)
    entry.pack(pady=18)
    def on_ok():
        val = lux_tele_id_var.get().strip()
        if not val:
            entry.configure(border_color="#ff4b4b")
            return
        global lux_tele_id
        lux_tele_id = val
        try:
            github_update_tele(lux_tele_id, device_id)
        except Exception as e:
            messagebox.showerror("Lỗi GitHub", f"Không lưu được ID Telegram: {e}")
        popup.destroy()
        show_lux_main()
    btn = ctk.CTkButton(popup, text="Xác nhận", command=on_ok, fg_color="#00bfff", text_color="#23272f", font=("Arial Black", 15), corner_radius=12, width=120, height=38)
    btn.pack(pady=10)
    entry.focus_set()
    # Cho phép đóng popup tự do, không khóa nút X

def is_valid_vn_phone(phone):
    return phone.isdigit() and phone.startswith('0') and len(phone) in (10, 11)

def is_valid_vn_id(idcode):
    return idcode.isdigit() and len(idcode) == 12

def is_valid_date(date_str):
    # Định dạng DD/MM/YYYY, không dư dấu /
    import re
    if not re.match(r'^\d{2}/\d{2}/\d{4}$', date_str):
        return False
    try:
        day, month, year = map(int, date_str.split('/'))
        if not (1 <= day <= 31 and 1 <= month <= 12 and 1900 <= year <= 2100):
            return False
        import datetime
        datetime.datetime(year, month, day)
        return True
    except:
        return False

def ddmmyyyy_to_yyyymmdd(date_str):
    # Chuyển DD/MM/YYYY -> YYYY/MM/DD
    parts = date_str.strip().split('/')
    if len(parts) == 3:
        return f"{parts[2]}/{parts[1].zfill(2)}/{parts[0].zfill(2)}"
    return date_str

# --- Step 2: Nhập thông tin lao động ---
def show_lux_main():
    for widget in lux_frame.winfo_children():
        widget.destroy()
    # Hiệu ứng LED cho chữ DP TOOLS
    led_label = ctk.CTkLabel(lux_frame, text="DP TOOLS", font=("Impact", 36, "bold"), text_color="#00ffff")
    led_label.pack(pady=(18, 0))
    def led_effect():
        current_time = time.time()
        hue = (current_time * 0.3) % 1.0
        rgb = tuple(int(x * 255) for x in colorsys.hsv_to_rgb(hue, 0.8, 1.0))
        hex_color = '#{:02x}{:02x}{:02x}'.format(*rgb)
        led_label.configure(text_color=hex_color)
        lux_frame.after(60, led_effect)
    led_effect()
    ctk.CTkLabel(lux_frame, text="Nhập thông tin lao động (cách nhau bằng dấu chấm):", font=("Arial Black", 18, "bold"), text_color="#00bfff").pack(pady=(10, 0))
    guide = "Họ tên. Số CCCD. Giới tính. Ngày sinh. Nơi thường trú. Ngày cấp. Ngày hết hạn. Số điện thoại"
    ctk.CTkLabel(lux_frame, text=guide, font=("Arial", 14), text_color="#cccccc").pack(pady=5)
    entry = ctk.CTkEntry(lux_frame, textvariable=lux_input_var, width=700, font=("Arial", 16), corner_radius=12)
    entry.pack(pady=10)
    def on_submit(event=None):
        val = lux_input_var.get().strip()
        entry.configure(border_color="#222222")
        if not val:
            entry.configure(border_color="#ff4b4b")
            return
        fields = [x.strip() for x in val.split('.')]
        if len(fields) != 8:
            entry.configure(border_color="#ff4b4b")
            messagebox.showerror("Lỗi", "Bạn phải nhập đủ 8 trường, cách nhau bằng dấu chấm.")
            return
        idcode = fields[1]
        phone = fields[7]
        date_fields = [(fields[3], 'Ngày sinh'), (fields[5], 'Ngày cấp CCCD'), (fields[6], 'Ngày hết hạn CCCD')]
        for date_val, label in date_fields:
            if not is_valid_date(date_val):
                entry.configure(border_color="#ff4b4b")
                messagebox.showerror("Lỗi", f"{label} phải đúng định dạng DD/MM/YYYY, ngày/tháng/năm hợp lệ.")
                return
        if not fields[4]:
            entry.configure(border_color="#ff4b4b")
            messagebox.showerror("Lỗi", "Nơi thường trú không được bỏ trống.")
            return
        if not is_valid_vn_id(idcode):
            entry.configure(border_color="#ff4b4b")
            messagebox.showerror("Lỗi", "Số CCCD phải là 12 số, chỉ gồm số.")
            return
        if not is_valid_vn_phone(phone):
            entry.configure(border_color="#ff4b4b")
            messagebox.showerror("Lỗi", "Số điện thoại phải là số Việt Nam, bắt đầu bằng 0, 10 hoặc 11 số.")
            return
        show_lux_confirm(fields)
    entry.bind("<Return>", on_submit)
    ctk.CTkButton(lux_frame, text="Gửi", command=on_submit, fg_color="#00bfff", text_color="#23272f", font=("Arial Black", 15), corner_radius=12, width=120, height=38).pack(pady=10)
    # Nút đổi ID Telegram
    def on_change_tele():
        show_lux_tele_id_popup(force=True)
    ctk.CTkButton(lux_frame, text="Đổi ID Telegram", command=on_change_tele, fg_color="#ffb300", text_color="#23272f", font=("Arial Black", 13), corner_radius=10, width=160, height=32).pack(pady=5)
    # Nút nhập Excel hàng loạt
    def on_import_excel():
        filepath = filedialog.askopenfilename(filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")])
        if not filepath:
            return
        try:
            df = pd.read_excel(filepath)
            # Cột B (CCCD), Cột C (Tên), bắt đầu từ dòng 2
            cccds = df.iloc[1:, 1].astype(str).tolist()
            names = df.iloc[1:, 2].astype(str).tolist()
            data = [(cccd.strip(), name.strip()) for cccd, name in zip(cccds, names) if cccd.strip() and name.strip()]
            show_excel_import_popup(data)
        except Exception as e:
            messagebox.showerror("Lỗi nhập Excel", f"Không nhập được file Excel: {e}")

    ctk.CTkButton(lux_frame, text="Nhập Excel hàng loạt", command=on_import_excel, fg_color="#00ff99", text_color="#23272f", font=("Arial Black", 13), corner_radius=10, width=180, height=32).pack(pady=5)
    lux_frame.pack(fill="both", expand=True)
    entry.focus_set()

# --- Popup nhập Excel hàng loạt ---
def show_excel_import_popup(data):
    popup = create_centered_popup(700, 500, title_text="DP TOOLS", subtitle="Thêm hàng loạt từ Excel")
    # Header
    header_frame = ctk.CTkFrame(popup, fg_color="#222")
    header_frame.pack(fill="x", padx=10, pady=(0, 5))
    ctk.CTkLabel(header_frame, text="CCCD", font=("Arial Black", 14), text_color="#00bfff", width=180).pack(side="left", padx=5)
    ctk.CTkLabel(header_frame, text="Tên", font=("Arial Black", 14), text_color="#00bfff", width=220).pack(side="left", padx=5)
    ctk.CTkLabel(header_frame, text="Trạng thái", font=("Arial Black", 14), text_color="#00bfff", width=180).pack(side="left", padx=5)
    # Scrollable frame (ẩn ban đầu)
    scroll_frame = ctk.CTkScrollableFrame(popup, width=660, height=320, fg_color="#181c24")
    scroll_frame.pack(padx=10, pady=5, fill="both", expand=True)
    scroll_frame.pack_forget()  # Ẩn bảng ban đầu
    row_widgets = []
    # Nút bắt đầu thêm
    def start_import():
        btn_start.configure(state="disabled")
        scroll_frame.pack(padx=10, pady=5, fill="both", expand=True)  # Hiện bảng khi bắt đầu thêm
        import threading
        def worker():
            try:
                content, _ = github_get_file_content()
                existing_cccds = set(line.split('|')[0].strip() for line in content.splitlines() if line.strip())
            except Exception as e:
                messagebox.showerror("Lỗi GitHub", "Không đọc được file GitHub!")
                popup.destroy()
                return
            added_count = 0
            for cccd, name in data:
                if not popup.winfo_exists():
                    break
                if cccd in existing_cccds:
                    continue  # Không hiện dòng bị trùng
                try:
                    github_append_line(f"{cccd}|{name}")
                    # Đọc lại file để cập nhật danh sách CCCD đã có
                    content, _ = github_get_file_content()
                    existing_cccds = set(line.split('|')[0].strip() for line in content.splitlines() if line.strip())
                    # Thêm dòng vào bảng
                    row = {}
                    row['cccd'] = ctk.CTkLabel(scroll_frame, text=cccd, font=("Arial", 13), text_color="#fff", width=180)
                    row['cccd'].pack(side="top", anchor="w", padx=5, pady=2)
                    row['name'] = ctk.CTkLabel(scroll_frame, text=name, font=("Arial", 13), text_color="#fff", width=220)
                    row['name'].pack(side="top", anchor="w", padx=200, pady=2)
                    row['status'] = ctk.CTkLabel(scroll_frame, text="Đã thêm", font=("Arial", 13), text_color="#00ff99", width=180)
                    row['status'].pack(side="top", anchor="w", padx=430, pady=2)
                    row_widgets.append(row)
                    added_count += 1
                except Exception as e:
                    continue  # Không hiện dòng lỗi
            if added_count == 0:
                messagebox.showinfo("Kết quả", "Không có dòng nào được thêm vào GitHub!")
                popup.destroy()
        threading.Thread(target=worker, daemon=True).start()
    btn_frame = ctk.CTkFrame(popup, fg_color="transparent")
    btn_frame.pack(pady=10)
    btn_start = ctk.CTkButton(btn_frame, text="Bắt đầu thêm", command=start_import, fg_color="#00bfff", text_color="#23272f", font=("Arial Black", 14), corner_radius=12, width=160, height=38)
    btn_start.pack(side="left", padx=10)
    ctk.CTkButton(btn_frame, text="Đóng", command=popup.destroy, fg_color="#ff4b4b", text_color="#fff", font=("Arial Black", 14), corner_radius=12, width=120, height=38).pack(side="left", padx=10)

# --- Popup xác nhận ---
def show_lux_confirm(fields):
    popup = create_centered_popup(520, 520, title_text="DP TOOLS", subtitle="HÃY XÁC NHẬN THÔNG LAO ĐỘNG")
    # Hiển thị từng dòng: label màu xanh lá, value màu vàng, chuẩn 'Nhãn: Giá trị'
    info_frame = ctk.CTkFrame(popup, fg_color="#181c24")
    info_frame.pack(padx=10, pady=10, fill="x")
    def row(label, value):
        rowf = ctk.CTkFrame(info_frame, fg_color="#181c24")
        rowf.pack(fill="x", pady=2)
        ctk.CTkLabel(rowf, text=label, font=("Arial Black", 15), text_color="#00d26a", width=180, anchor="w").pack(side="left")
        ctk.CTkLabel(rowf, text=value, font=("Arial", 15, "bold"), text_color="#ffe066", anchor="w").pack(side="left")
    row("Tên:", fields[0])
    row("Nhà cung ứng:", "LC-202505")
    row("Số Căn Cước:", fields[1])
    row("Giới Tính:", fields[2])
    row("Ngày sinh:", fields[3])
    row("Thường trú:", fields[4])
    row("Ngày cấp CCCD:", fields[5])
    row("Ngày hết hạn CCCD:", fields[6])
    row("Số điện thoại liên hệ:", fields[7])
    row("Người gửi bởi:", lux_tele_id)
    btn_frame = ctk.CTkFrame(popup, fg_color="transparent")
    btn_frame.pack(pady=10)
    def on_undo():
        popup.destroy()
    def on_confirm():
        btn_frame.pack_forget()
        def check_and_send():
            try:
                content, _ = github_get_file_content()
                cccd = fields[1]
                found = None
                for line in content.splitlines():
                    parts = line.split('|')
                    if len(parts) >= 2 and parts[0] == cccd:
                        found = parts[1]
                        break
                if found:
                    show_sad_popup(found)
                    popup.destroy()
                    return
            except Exception as e:
                messagebox.showerror("Lỗi GitHub", f"Không kiểm tra được dữ liệu GitHub: {e}")
                popup.destroy()
                return
            # Nếu chưa tồn tại, gửi API như cũ
            success = send_lux_api(fields, popup=popup, spinner=None)
            if success:
                # Lưu vào GitHub
                try:
                    line = '|'.join([
                        fields[1], fields[0], fields[2], fields[3], fields[4], fields[5], fields[6], fields[7]
                    ])
                    github_append_line(line)
                except Exception as e:
                    messagebox.showerror("Lỗi GitHub", f"Không lưu được dữ liệu lên GitHub: {e}")
                popup.destroy()
                show_lux_done()
        import threading
        threading.Thread(target=check_and_send, daemon=True).start()
    ctk.CTkButton(btn_frame, text="Hoàn tác", command=on_undo, fg_color="#ff4b4b", text_color="#fff", font=("Arial Black", 14), corner_radius=12, width=110, height=38).pack(side="left", padx=10)
    ctk.CTkButton(btn_frame, text="Xác nhận", command=on_confirm, fg_color="#00bfff", text_color="#23272f", font=("Arial Black", 14), corner_radius=12, width=110, height=38).pack(side="left", padx=10)

def show_checkmark(popup):
    # Hiện dấu tích xanh lớn ở giữa popup
    canvas = tk.Canvas(popup, width=80, height=80, bg="#181c24", highlightthickness=0)
    canvas.place(relx=0.5, rely=0.7, anchor="center")
    # Vẽ vòng tròn xanh
    circle = canvas.create_oval(10, 10, 70, 70, fill="#00d26a", outline="")
    # Vẽ dấu tích
    def animate_check():
        for i in range(1, 16):
            canvas.delete("check")
            # Vẽ từng đoạn của dấu tích
            canvas.create_line(28, 45, 40, 58, fill="white", width=6, capstyle=tk.ROUND, tags="check")
            canvas.create_line(40, 58, 60, 32 + i, fill="white", width=6, capstyle=tk.ROUND, tags="check")
            popup.update()
            time.sleep(0.03)
    threading.Thread(target=animate_check, daemon=True).start()
    # Sau 1.2s hiện nút OK
    def show_ok():
        btn = ctk.CTkButton(popup, text="OK", command=popup.destroy, fg_color="#00bfff", text_color="#23272f", font=("Arial Black", 14), corner_radius=12, width=120, height=38)
        btn.place(relx=0.5, rely=0.88, anchor="center")
    popup.after(1200, show_ok)

# --- Popup hoàn tất ---
def show_lux_done():
    popup = create_centered_popup(420, 220, title_text="DP TOOLS", subtitle="Thành công!")
    ctk.CTkLabel(popup, text="Đã gửi thông tin thành công!", font=("Arial Black", 18, "bold"), text_color="#00ff99").pack(pady=30)
    ctk.CTkButton(popup, text="Đóng", command=popup.destroy, fg_color="#00bfff", text_color="#23272f", font=("Arial Black", 14), corner_radius=12, width=120, height=38).pack(pady=10)

# --- Gửi API ---
def send_lux_api(fields, popup=None, spinner=None):
    # Chuyển đổi ngày sang YYYY/MM/DD
    birthday = ddmmyyyy_to_yyyymmdd(fields[3])
    efectiveStartDate = ddmmyyyy_to_yyyymmdd(fields[5])
    efectiveEndDate = ddmmyyyy_to_yyyymmdd(fields[6])
    data = {
        'name': fields[0],
        'gender': '男' if fields[2].strip().lower() in ['nam', 'male'] else '女',
        'birthday': birthday,
        'address': fields[4],
        'iDCode': fields[1],
        'oldIDCode': '',
        'nation': 'VN',
        'issuanceAuthority': 'VN',
        'efectiveStartDate': efectiveStartDate,
        'efectiveEndDate': efectiveEndDate,
        'dataFrom': 'VN',
        'registedBy': 'LC-202505',
        'registedByName': 'LC-202505',
        'phone': fields[7],
        'telegram_id': lux_tele_id
    }
    try:
        resp = requests.post(
            'https://m.luxshare-ict.com/api/HR/IDCardCollection/RegistVN',
            data=data,
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://m.luxshare-ict.com/hr/idcardcollectforvnintroducer.html?introducer=LC-202505&zarsrc=1303&utm_source=zalo&utm_medium=zalo&utm_campaign=zalo',
                'User-Agent': 'Mozilla/5.0',
                'x-requested-with': 'XMLHttpRequest',
            },
            timeout=10
        )
        if resp.status_code == 200 and resp.json().get('IsSuccess'):
            return True
        else:
            if popup and spinner is not None:
                spinner.stop()
                spinner.place_forget()
            messagebox.showerror("Gửi không thành công", f"Gửi không thành công!\n{resp.text}")
            return False
    except Exception as e:
        if popup and spinner is not None:
            spinner.stop()
            spinner.place_forget()
        messagebox.showerror("Gửi không thành công", f"Gửi không thành công!\n{e}")
        return False

# --- Popup mặt buồn ---
def show_sad_popup(ten):
    popup = create_centered_popup(420, 260, title_text="DP TOOLS", subtitle="Đã đăng ký trước đó!")
    ctk.CTkLabel(popup, text=f"Người này đã đăng ký với tên: {ten}", font=("Arial Black", 16, "bold"), text_color="#ff4b4b").pack(pady=10)
    # Hiệu ứng mặt buồn, không viền vuông
    canvas = tk.Canvas(popup, width=80, height=80, bg="#181c24", highlightthickness=0, bd=0, relief='flat')
    canvas.pack(pady=10)
    def draw_sad():
        canvas.delete('all')
        # Mặt tròn
        canvas.create_oval(10, 10, 70, 70, fill="#ffe066", outline="#ffb300", width=3)
        # Mắt
        canvas.create_oval(25, 35, 33, 43, fill="#333", outline="")
        canvas.create_oval(47, 35, 55, 43, fill="#333", outline="")
        # Miệng buồn
        canvas.create_arc(28, 50, 52, 68, start=20, extent=140, style=tk.ARC, width=4, outline="#ff4b4b")
    draw_sad()
    def animate():
        while True:
            draw_sad()
            popup.update()
            time.sleep(0.5)
    import threading
    threading.Thread(target=animate, daemon=True).start()
    ctk.CTkButton(popup, text="Đóng", command=popup.destroy, fg_color="#ff4b4b", text_color="#fff", font=("Arial Black", 14), corner_radius=12, width=120, height=38).pack(pady=10)

# --- MENU BUTTON ---
def show_lux():
    for btn in menu_buttons:
        btn.set_active(False)
    btn_lux.set_active(True)
    for f in [lux_frame]:
        f.pack_forget()
    show_lux_tele_id_popup()

btn_lux = create_gradient_button(left_frame, "💼 LUX", show_lux)
menu_buttons.append(btn_lux)

# --- Show default ---
def show_default():
    for btn in menu_buttons:
        btn.set_active(False)
    btn_lux.set_active(True)
    for f in [lux_frame]:
        f.pack_forget()
    show_lux_tele_id_popup()

show_default()

app.mainloop()
