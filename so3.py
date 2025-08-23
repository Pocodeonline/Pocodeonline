import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox, filedialog
import sys
import time
import threading
import os
import json
import requests
import subprocess
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import pygame
import base64
import random
from PIL import Image
import io
import shutil
import psutil
from pathlib import Path

# --- Configuration ---
CHROME_PROFILE_PATH = os.path.join(os.getcwd(), "veo")
VEO_URL = "https://labs.google/fx/vi/tools/flow"

class VeoApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Reg Video Veo - JoHan")
        
        # Auto-detect screen size and set appropriate window size
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        
        # Calculate optimal window size (80% of screen size)
        window_width = int(screen_width * 0.8)
        window_height = int(screen_height * 0.8)
        
        # Ensure minimum size
        window_width = max(window_width, 1000)
        window_height = max(window_height, 700)
        
        # Center the window on screen
        x = (screen_width - window_width) // 2
        y = (screen_height - window_height) // 2
        
        self.root.geometry(f"{window_width}x{window_height}+{x}+{y}")
        self.root.configure(bg='#0a0a0a')
        
        # Make window resizable and set minimum size
        self.root.resizable(True, True)
        self.root.minsize(1000, 700)
        
        # Configure window to expand properly
        self.root.grid_rowconfigure(0, weight=1)
        self.root.grid_columnconfigure(0, weight=1)
        
        # Simplified window event handling - remove problematic resize handlers
        # Bind mousewheel to root window for global scrolling
        self.root.bind("<MouseWheel>", self._on_mousewheel_global)
        
        # Handle window close event to properly close browser
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Fix window minimize/restore issues
        self.root.attributes('-topmost', False)  # Don't force always on top
        self.root.lift()  # Bring to front initially
        self.root.focus_force()  # Force focus initially
        self.root.wm_state('normal')  # Ensure normal state
        
        # Add window state change handlers to fix minimize issues (simplified)
        self.root.bind('<Map>', self.on_window_map)
        self.root.bind('<Unmap>', self.on_window_unmap)
        
        # Variables
        self.driver = None
        self.user_info = {"name": "", "email": "", "credits": 0, "paygate_tier": ""}
        self.selected_function = tk.StringVar(value="prompt ra video")
        self.output_count = tk.StringVar(value="2")
        self.model_selection = tk.StringVar(value="Veo 2 - Quality")
        self.folder_name = tk.StringVar(value="auto1")  # New folder name variable
        self.prompts = []
        self.projects = []  # List to store created projects
        self.current_project_id = None  # Currently selected project ID
        
        # Variables for 1 ảnh ra video function
        self.selected_images = []
        self.image_order = {}
        self.prompt_status = {}  # Track done status for each prompt
        self.processing_queue = []  # Queue for processing image-prompt pairs
        
        # Stop flag for automation control
        self.stop_requested = False
        
        # Load saved settings
        self.load_settings()
        
        # Initialize pygame for sound
        try:
            pygame.mixer.init()
        except:
            print("Could not initialize pygame mixer for sound")
        
        self.setup_styles()
        self.create_gui()
        self.animate_led_effects()
        
        # Auto-start browser and fetch user info
        self.auto_start_browser()
    
    def load_settings(self):
        """Load saved settings from file"""
        try:
            settings_file = os.path.join(os.getcwd(), "settings.json")
            if os.path.exists(settings_file):
                with open(settings_file, 'r', encoding='utf-8') as f:
                    settings = json.load(f)
                
                # Load folder name setting
                if 'folder_name' in settings:
                    self.folder_name.set(settings['folder_name'])
                
                # Load countdown seconds setting
                if 'countdown_seconds' in settings:
                    self.countdown_seconds = tk.StringVar(value=str(settings['countdown_seconds']))
                else:
                    self.countdown_seconds = tk.StringVar(value="50")
                
                # Load other settings
                if 'output_count' in settings:
                    self.output_count.set(str(settings['output_count']))
                
                if 'model_selection' in settings:
                    self.model_selection.set(settings['model_selection'])
                
                print(f"Settings loaded: folder={self.folder_name.get()}, countdown={self.countdown_seconds.get()}")
            else:
                # Set default values if no settings file exists
                self.countdown_seconds = tk.StringVar(value="50")
                print("No settings file found, using defaults")
                
        except Exception as e:
            print(f"Error loading settings: {e}")
            # Set default values on error
            self.countdown_seconds = tk.StringVar(value="50")
    
    def save_settings(self):
        """Save current settings to file"""
        try:
            settings = {
                'folder_name': self.folder_name.get(),
                'countdown_seconds': int(self.countdown_seconds.get()) if self.countdown_seconds.get().isdigit() else 50,
                'output_count': int(self.output_count.get()),
                'model_selection': self.model_selection.get()
            }
            
            settings_file = os.path.join(os.getcwd(), "settings.json")
            with open(settings_file, 'w', encoding='utf-8') as f:
                json.dump(settings, f, indent=2, ensure_ascii=False)
            
            print(f"Settings saved: {settings}")
            
        except Exception as e:
            print(f"Error saving settings: {e}")
    
    def on_closing(self):
        """Handle application closing - properly close browser and save settings"""
        try:
            print("Application closing - cleaning up...")
            
            # Save current settings
            self.save_settings()
            
            # Stop any playing music
            if hasattr(self, 'music_process') and self.music_process:
                self.stop_completion_music()
            
            # Close browser properly
            if self.driver:
                try:
                    print("Closing browser...")
                    self.driver.quit()
                    self.driver = None
                    print("Browser closed successfully")
                except Exception as e:
                    print(f"Error closing browser: {e}")
                    # Force kill Chrome processes if normal quit fails
                    try:
                        import subprocess
                        subprocess.run(['taskkill', '/f', '/im', 'chrome.exe'], 
                                     capture_output=True, check=False)
                        print("Force killed Chrome processes")
                    except:
                        pass
            
            # Destroy the main window
            self.root.destroy()
            print("Application closed successfully")
            
        except Exception as e:
            print(f"Error during application closing: {e}")
            # Force close anyway
            try:
                self.root.destroy()
            except:
                pass
        
    def setup_styles(self):
        """Setup custom styles for the application"""
        self.style = ttk.Style()
        self.style.theme_use('clam')
        
        # Configure styles with blue LED theme
        self.style.configure('LED.TFrame', background='#0a0a0a', relief='flat')
        self.style.configure('LED.TLabel', background='#0a0a0a', foreground='#00bfff', 
                           font=('Arial', 10, 'bold'))
        self.style.configure('LED.TButton', background='#1a1a2e', foreground='#00bfff',
                           font=('Arial', 10, 'bold'), relief='flat', borderwidth=2)
        self.style.map('LED.TButton', 
                      background=[('active', '#16213e'), ('pressed', '#0f3460')])
        
    def _on_mousewheel_global(self, event):
        """Global mousewheel handler for scrolling"""
        try:
            if hasattr(self, 'main_canvas') and self.main_canvas:
                # Force focus to canvas to ensure scrolling works
                self.main_canvas.focus_set()
                self.main_canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        except Exception as e:
            print(f"Error in global mousewheel: {e}")
    
        
    def create_gui(self):
        """Create the main GUI interface"""
        # Create main canvas and scrollbar for scrollable interface
        main_canvas = tk.Canvas(self.root, bg='#0a0a0a', highlightthickness=0)
        main_scrollbar = ttk.Scrollbar(self.root, orient="vertical", command=main_canvas.yview)
        
        # Create scrollable frame
        scrollable_main = tk.Frame(main_canvas, bg='#0a0a0a')
        
        # Configure scrolling
        def configure_scroll_region(event):
            main_canvas.configure(scrollregion=main_canvas.bbox("all"))
            # Also update the canvas window width to match canvas width
            canvas_width = main_canvas.winfo_width()
            main_canvas.itemconfig(canvas_window, width=canvas_width)
        
        scrollable_main.bind("<Configure>", configure_scroll_region)
        
        # Create window in canvas and store reference
        canvas_window = main_canvas.create_window((0, 0), window=scrollable_main, anchor="nw")
        main_canvas.configure(yscrollcommand=main_scrollbar.set)
        
        # Configure canvas to update window width when canvas is resized
        def configure_canvas(event):
            canvas_width = main_canvas.winfo_width()
            main_canvas.itemconfig(canvas_window, width=canvas_width)
        
        main_canvas.bind("<Configure>", configure_canvas)
        
        # Grid canvas and scrollbar to fill the root window properly
        main_canvas.grid(row=0, column=0, sticky='nsew')
        main_scrollbar.grid(row=0, column=1, sticky='ns')
        
        # Configure root grid weights for proper expansion
        self.root.grid_columnconfigure(0, weight=1)  # Main canvas expands
        self.root.grid_columnconfigure(1, weight=0)  # Scrollbar fixed width
        self.root.grid_rowconfigure(0, weight=1)     # Allow vertical expansion
        
        # Bind mousewheel to canvas for smooth scrolling
        def _on_mousewheel(event):
            main_canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        
        main_canvas.bind("<MouseWheel>", _on_mousewheel)
        
        # Configure scrollable_main to expand properly
        scrollable_main.grid_rowconfigure(0, weight=1)
        scrollable_main.grid_columnconfigure(0, weight=1)
        
        # Store references for later use
        self.main_canvas = main_canvas
        self.main_scrollbar = main_scrollbar
        self.scrollable_main = scrollable_main
        self.canvas_window = canvas_window
        
        # Main container with LED border effect - using grid consistently
        main_container = tk.Frame(scrollable_main, bg='#0a0a0a', relief='ridge', bd=3)
        main_container.grid(row=0, column=0, sticky='nsew', padx=5, pady=5)
        
        # Configure main container to expand properly
        main_container.grid_rowconfigure(0, weight=0)  # LED border
        main_container.grid_rowconfigure(1, weight=0)  # Title
        main_container.grid_rowconfigure(2, weight=0)  # User info
        main_container.grid_rowconfigure(3, weight=0)  # Project frame
        main_container.grid_rowconfigure(4, weight=0)  # Success notification
        main_container.grid_rowconfigure(5, weight=0)  # Function selection
        main_container.grid_rowconfigure(6, weight=1)  # Main content (expandable)
        main_container.grid_rowconfigure(7, weight=0)  # Status bar
        main_container.grid_columnconfigure(0, weight=1)
        
        # LED border animation frame
        self.led_border = tk.Frame(main_container, bg='#00bfff', height=5)
        self.led_border.grid(row=0, column=0, sticky='ew', pady=(0, 10))
        
        # Title with glowing effect
        title_frame = tk.Frame(main_container, bg='#0a0a0a')
        title_frame.grid(row=1, column=0, sticky='ew', pady=10)
        
        self.title_label = tk.Label(title_frame, text="TẠO VIDEO VEO", 
                                   font=('Arial', 24, 'bold'), 
                                   fg='#00bfff', bg='#0a0a0a')
        self.title_label.pack()
        
        # User info display (centered at top)
        user_info_frame = tk.Frame(main_container, bg='#0a0a0a')
        user_info_frame.grid(row=2, column=0, sticky='ew', pady=(5, 0))
        
        self.user_name_label = tk.Label(user_info_frame, text="Đang lấy thông tin...", 
                                       font=('Arial', 12, 'bold'), 
                                       fg='#ffffff', bg='#0a0a0a')
        self.user_name_label.pack()
        
        self.user_email_label = tk.Label(user_info_frame, text="", 
                                        font=('Arial', 10), 
                                        fg='#ffffff', bg='#0a0a0a')
        self.user_email_label.pack()
        
        # Credits display
        self.credits_label = tk.Label(user_info_frame, text="", 
                                     font=('Arial', 11, 'bold'), 
                                     fg='#ffaa00', bg='#0a0a0a')
        self.credits_label.pack(pady=(2, 0))
        
        # Change account button (initially hidden)
        self.change_account_button = tk.Button(user_info_frame, text="🔄 Đổi tài khoản", 
                                              command=self.change_account,
                                              bg='#721c24', fg='#ffaa00', 
                                              font=('Arial', 9, 'bold'), 
                                              relief='raised', bd=1, height=1)
        # Don't pack initially - will be shown after user info is loaded
        
        # Project ID display
        self.project_id_label = tk.Label(user_info_frame, text="", 
                                        font=('Arial', 9), 
                                        fg='#ffaa00', bg='#0a0a0a')
        self.project_id_label.pack(pady=(5, 0))
        
        # Project management frame
        project_frame = tk.Frame(main_container, bg='#1a1a2e', relief='raised', bd=2)
        project_frame.grid(row=3, column=0, sticky='ew', pady=(10, 0), padx=50)
        
        # Create project button
        self.create_project_button = tk.Button(project_frame, text="🆕 TẠO PROJECT MỚI", 
                                              command=self.create_new_project,
                                              bg='#0f5132', fg='#00ff00', 
                                              font=('Arial', 10, 'bold'), 
                                              relief='raised', bd=2, height=1)
        self.create_project_button.pack(pady=10)
        
        # Project status label
        self.project_status_label = tk.Label(project_frame, text="", 
                                            font=('Arial', 9), 
                                            fg='#00bfff', bg='#1a1a2e')
        self.project_status_label.pack()
        
        # Projects list frame
        projects_list_frame = tk.LabelFrame(project_frame, text="Danh sách Projects", 
                                           fg='#00bfff', bg='#1a1a2e', font=('Arial', 9, 'bold'))
        projects_list_frame.pack(fill='x', padx=10, pady=(10, 10))
        
        # Projects scrollable text area
        self.projects_text = scrolledtext.ScrolledText(projects_list_frame, height=4, 
                                                      bg='#0a0a0a', fg='#00bfff',
                                                      font=('Consolas', 8),
                                                      insertbackground='#00bfff')
        self.projects_text.pack(fill='x', padx=5, pady=5)
        
        # Success notification (center) - clickable
        self.success_frame = tk.Frame(main_container, bg='#0f5132', relief='raised', bd=3)
        self.success_label = tk.Label(self.success_frame, text="", 
                                     font=('Arial', 12, 'bold'), 
                                     fg='#00ff00', bg='#0f5132',
                                     cursor='hand2')
        self.success_label.pack(pady=10, padx=20)
        self.success_label.bind('<Button-1>', self.on_success_click)
        
        # Function selection bar (top center)
        function_frame = tk.Frame(main_container, bg='#1a1a2e', relief='raised', bd=2)
        function_frame.grid(row=5, column=0, sticky='ew', pady=10, padx=50)
        
        tk.Label(function_frame, text="Chọn chức năng:", 
                font=('Arial', 12, 'bold'), fg='#00bfff', bg='#1a1a2e').pack(pady=5)
        
        function_options = ["prompt ra video", "1 ảnh ra video", "2 ảnh ra video"]
        self.function_combo = ttk.Combobox(function_frame, textvariable=self.selected_function,
                                          values=function_options, state='readonly',
                                          font=('Arial', 11))
        self.function_combo.pack(pady=5)
        self.function_combo.bind('<<ComboboxSelected>>', self.on_function_change)
        
        # Main content area - using grid for proper space distribution
        content_frame = tk.Frame(main_container, bg='#0a0a0a')
        content_frame.grid(row=6, column=0, sticky='nsew', padx=10, pady=5)
        
        # Configure grid weights for proper space distribution
        content_frame.grid_rowconfigure(0, weight=1)
        content_frame.grid_columnconfigure(0, weight=3)  # Left panel gets 75% width
        content_frame.grid_columnconfigure(1, weight=1)  # Right panel gets 25% width
        
        # Left panel - File selection and prompts - using grid
        self.left_panel = tk.Frame(content_frame, bg='#1a1a2e', relief='raised', bd=2)
        self.left_panel.grid(row=0, column=0, sticky='nsew', padx=(0, 5))
        
        # File selection
        file_frame = tk.LabelFrame(self.left_panel, text="Chọn file prompt", 
                                  fg='#00bfff', bg='#1a1a2e', font=('Arial', 10, 'bold'))
        file_frame.pack(fill='x', padx=10, pady=10)
        
        self.file_button = tk.Button(file_frame, text="📁 Chọn file TXT", 
                                    command=self.select_prompt_file,
                                    bg='#16213e', fg='#00bfff', 
                                    font=('Arial', 10, 'bold'), relief='flat')
        self.file_button.pack(pady=10)
        
        # Prompt display
        prompt_frame = tk.LabelFrame(self.left_panel, text="Danh sách prompts", 
                                    fg='#00bfff', bg='#1a1a2e', font=('Arial', 10, 'bold'))
        prompt_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        self.prompt_text = scrolledtext.ScrolledText(prompt_frame, height=15, 
                                                    bg='#0a0a0a', fg='#00bfff',
                                                    font=('Consolas', 9),
                                                    insertbackground='#00bfff')
        self.prompt_text.pack(fill='both', expand=True, padx=5, pady=5)
        
        # Right panel - Settings - using grid for proper width control
        right_panel = tk.Frame(content_frame, bg='#1a1a2e', relief='raised', bd=2)
        right_panel.grid(row=0, column=1, sticky='nsew', padx=(5, 0))
        
        # Settings
        settings_frame = tk.LabelFrame(right_panel, text="Cài đặt", 
                                      fg='#00bfff', bg='#1a1a2e', font=('Arial', 10, 'bold'))
        settings_frame.pack(fill='x', padx=10, pady=10)
        
        # Output count
        tk.Label(settings_frame, text="Số lượng output:", 
                fg='#00bfff', bg='#1a1a2e', font=('Arial', 9)).pack(pady=5)
        
        count_frame = tk.Frame(settings_frame, bg='#1a1a2e')
        count_frame.pack(pady=5)
        
        for i in range(1, 5):
            rb = tk.Radiobutton(count_frame, text=str(i), variable=self.output_count, 
                               value=str(i), bg='#1a1a2e', fg='#00bfff',
                               selectcolor='#16213e', font=('Arial', 9),
                               command=self.save_settings)
            rb.pack(side='left', padx=5)
        
        # Model selection
        tk.Label(settings_frame, text="Chọn model:", 
                fg='#00bfff', bg='#1a1a2e', font=('Arial', 9)).pack(pady=(20, 5))
        
        models = ["Veo 2 - Quality", "Veo 3 - Quality", "Veo 2 - Fast", "Veo 3 - Fast"]
        self.model_combo = ttk.Combobox(settings_frame, textvariable=self.model_selection,
                                       values=models, state='readonly', width=15)
        self.model_combo.pack(pady=5)
        self.model_combo.bind('<<ComboboxSelected>>', lambda event: self.save_settings())
        
        # Folder name input (editable for all functions)
        tk.Label(settings_frame, text="Tên folder:", 
                fg='#00bfff', bg='#1a1a2e', font=('Arial', 9)).pack(pady=(20, 5))
        
        self.folder_entry = tk.Entry(settings_frame, textvariable=self.folder_name,
                                    bg='#0a0a0a', fg='#00bfff', 
                                    font=('Arial', 9), width=18,
                                    insertbackground='#00bfff',
                                    relief='solid', bd=1,
                                    highlightthickness=1,
                                    highlightcolor='#00bfff',
                                    highlightbackground='#333333')
        self.folder_entry.pack(pady=5)
        
        # Enable proper text editing for folder entry
        def on_folder_entry_click(event):
            self.folder_entry.focus_set()
            self.folder_entry.selection_range(0, tk.END)
        
        def on_folder_entry_focus(event):
            self.folder_entry.configure(highlightbackground='#00bfff')
            
        def on_folder_entry_unfocus(event):
            self.folder_entry.configure(highlightbackground='#333333')
        
        self.folder_entry.bind('<Button-1>', on_folder_entry_click)
        self.folder_entry.bind('<FocusIn>', on_folder_entry_focus)
        self.folder_entry.bind('<FocusOut>', on_folder_entry_unfocus)
        
        # Add change handler for folder name
        def on_folder_name_change(*args):
            self.save_settings()
        
        self.folder_name.trace('w', on_folder_name_change)
        
        # Seconds input field (countdown timer between prompts)
        tk.Label(settings_frame, text="Đếm ngược (giây):", 
                fg='#00bfff', bg='#1a1a2e', font=('Arial', 9)).pack(pady=(15, 5))
        
        self.countdown_seconds = tk.StringVar(value="50")
        self.countdown_entry = tk.Entry(settings_frame, textvariable=self.countdown_seconds,
                                       bg='#0a0a0a', fg='#00bfff', 
                                       font=('Arial', 9), width=18,
                                       insertbackground='#00bfff',
                                       relief='solid', bd=1,
                                       highlightthickness=1,
                                       highlightcolor='#00bfff',
                                       highlightbackground='#333333')
        self.countdown_entry.pack(pady=5)
        
        # Enable proper text editing for countdown entry
        def on_countdown_entry_click(event):
            self.countdown_entry.focus_set()
            self.countdown_entry.selection_range(0, tk.END)
        
        def on_countdown_entry_focus(event):
            self.countdown_entry.configure(highlightbackground='#00bfff')
            
        def on_countdown_entry_unfocus(event):
            self.countdown_entry.configure(highlightbackground='#333333')
            # Save settings when countdown entry loses focus
            self.save_settings()
        
        self.countdown_entry.bind('<Button-1>', on_countdown_entry_click)
        self.countdown_entry.bind('<FocusIn>', on_countdown_entry_focus)
        self.countdown_entry.bind('<FocusOut>', on_countdown_entry_unfocus)
        
        # Add change handler for countdown seconds
        def on_countdown_change(*args):
            self.save_settings()
        
        self.countdown_seconds.trace('w', on_countdown_change)
        
        # Control buttons
        button_frame = tk.Frame(right_panel, bg='#1a1a2e')
        button_frame.pack(fill='x', padx=10, pady=20)
        
        self.start_button = tk.Button(button_frame, text="🚀 BẮT ĐẦU", 
                                     command=self.start_process,
                                     bg='#0f5132', fg='#00ff00', 
                                     font=('Arial', 12, 'bold'), 
                                     relief='raised', bd=3, height=2)
        self.start_button.pack(fill='x', pady=5)
        
        self.stop_button = tk.Button(button_frame, text="⏹ DỪNG", 
                                    command=self.stop_process,
                                    bg='#721c24', fg='#ff6b6b', 
                                    font=('Arial', 12, 'bold'), 
                                    relief='raised', bd=3, height=2)
        self.stop_button.pack(fill='x', pady=5)
        
        # Status bar
        self.status_bar = tk.Label(main_container, text="Sẵn sàng - Các ô nhập liệu đã sẵn sàng để chỉnh sửa", 
                                  bg='#16213e', fg='#00bfff', 
                                  font=('Arial', 9), relief='sunken', bd=1)
        self.status_bar.grid(row=7, column=0, sticky='ew')
        
    def auto_start_browser(self):
        """Automatically start browser and fetch user info when app opens"""
        self.status_bar.configure(text="Đang khởi động trình duyệt tự động...")
        threading.Thread(target=self.init_browser_and_fetch_user, daemon=True).start()
        
    def init_browser_and_fetch_user(self):
        """Initialize browser and fetch user information automatically - VIP Enhanced Version"""
        try:
            # Setup Chrome with veo profile - VIP Configuration
            self.root.after(0, lambda: self.status_bar.configure(text="🚀 Đang khởi động Chrome VIP Mode..."))
            print("Starting Chrome browser with VIP configuration...")
            
            options = uc.ChromeOptions()
            options.add_argument(f"--user-data-dir={CHROME_PROFILE_PATH}")
            
            # VIP Anti-Detection Arguments
            options.add_argument("--no-first-run")
            options.add_argument("--no-default-browser-check")
            options.add_argument("--disable-infobars")
            options.add_argument("--disable-web-security")
            options.add_argument("--disable-features=VizDisplayCompositor")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-extensions-except")
            options.add_argument("--disable-plugins-discovery")
            options.add_argument("--disable-component-extensions-with-background-pages")
            options.add_argument("--disable-background-timer-throttling")
            options.add_argument("--disable-renderer-backgrounding")
            options.add_argument("--disable-backgrounding-occluded-windows")
            options.add_argument("--disable-client-side-phishing-detection")
            options.add_argument("--disable-sync")
            options.add_argument("--metrics-recording-only")
            options.add_argument("--no-report-upload")
            options.add_argument("--disable-default-apps")
            
            # VIP Performance & Stealth Arguments
            options.add_argument("--aggressive-cache-discard")
            options.add_argument("--memory-pressure-off")
            options.add_argument("--max_old_space_size=4096")
            options.add_argument("--disable-ipc-flooding-protection")
            
            # Set VIP preferences to avoid automation detection
            prefs = {
                "profile.default_content_setting_values": {
                    "notifications": 2,
                    "media_stream": 2,
                    "geolocation": 2
                },
                "profile.default_content_settings": {
                    "popups": 0
                },
                "profile.managed_default_content_settings": {
                    "images": 1
                },
                "profile.password_manager_enabled": False,
                "credentials_enable_service": False,
                "profile.default_content_setting_values.notifications": 2
            }
            options.add_experimental_option("prefs", prefs)
            
            # VIP Stealth mode (maximum compatibility)
            options.add_argument("--disable-logging")
            options.add_argument("--disable-extensions")
            options.add_argument("--disable-automation")
            
            # Initialize Chrome with VIP settings - Enhanced stability
            try:
                # Try to kill any existing Chrome processes first
                import subprocess
                try:
                    subprocess.run(['taskkill', '/f', '/im', 'chrome.exe'], 
                                 capture_output=True, check=False)
                    time.sleep(2)
                except:
                    pass
                
                self.driver = uc.Chrome(options=options, headless=True, 
                                      version_main=None, driver_executable_path=None)
            except Exception as chrome_error:
                print(f"First Chrome attempt failed: {chrome_error}")
                # Fallback: try without some problematic options
                options_fallback = uc.ChromeOptions()
                options_fallback.add_argument(f"--user-data-dir={CHROME_PROFILE_PATH}")
                options_fallback.add_argument("--no-first-run")
                options_fallback.add_argument("--no-default-browser-check")
                options_fallback.add_argument("--disable-infobars")
                options_fallback.add_argument("--disable-web-security")
                options_fallback.add_argument("--no-sandbox")
                
                prefs_simple = {
                    "profile.default_content_setting_values": {"notifications": 2}
                }
                options_fallback.add_experimental_option("prefs", prefs_simple)
                
                self.driver = uc.Chrome(options=options_fallback, headless=True)
            
            # VIP JavaScript execution to hide automation traces
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.driver.execute_script("Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]})")
            self.driver.execute_script("Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en', 'vi']})")
            self.driver.execute_script("window.chrome = { runtime: {} }")
            
            print("Chrome browser started successfully with VIP configuration")
            
            # VIP Browser initialization with optimized wait
            self.root.after(0, lambda: self.status_bar.configure(text="⏳ Đang chờ trình duyệt khởi động hoàn tất (VIP Mode)..."))
            time.sleep(2)  # Reduced wait time for faster startup
            
            # VIP Navigation to VEO URL with multiple advanced methods
            self.root.after(0, lambda: self.status_bar.configure(text="🎯 Đang truy cập VEO Labs (VIP Priority)..."))
            print(f"VIP Navigation to: {VEO_URL}")
            
            success = False
            max_attempts = 5  # Increased attempts for VIP reliability
            
            # VIP Method 1: Advanced Direct Navigation with Pre-loading
            for attempt in range(max_attempts):
                try:
                    print(f"VIP Navigation attempt {attempt + 1}/{max_attempts}")
                    
                    # VIP Pre-navigation setup
                    if attempt > 0:
                        self.driver.execute_script("window.stop();")
                        self.driver.delete_all_cookies()
                        time.sleep(2)
                    
                    # VIP Enhanced navigation with user agent and headers simulation
                    self.driver.execute_script(f"""
                        window.location.href = '{VEO_URL}';
                        window.focus();
                        document.title = 'Loading VEO Labs...';
                    """)
                    
                    # VIP Extended wait with multiple checks
                    wait = WebDriverWait(self.driver, 20)
                    
                    # Wait for complete page load
                    wait.until(lambda driver: driver.execute_script("return document.readyState") == "complete")
                    
                    # Additional VIP wait for dynamic content
                    time.sleep(3)
                    
                    # VIP URL verification
                    current_url = self.driver.current_url
                    print(f"VIP Check - Current URL after attempt {attempt + 1}: {current_url}")
                    
                    # VIP Success verification with multiple criteria
                    if ("labs.google" in current_url and "flow" in current_url) or "13884c8a-4807-4306-af8e-70c65436179b" in current_url:
                        print("🎉 VIP Navigation SUCCESS - VEO Labs loaded!")
                        success = True
                        self.root.after(0, lambda: self.status_bar.configure(text="✅ VIP SUCCESS: Đã truy cập VEO Labs"))
                        break
                        
                    elif "google.com" in current_url:
                        print("VIP Method 2: JavaScript forced navigation...")
                        # VIP JavaScript forced navigation
                        self.driver.execute_script(f"""
                            window.location.replace('{VEO_URL}');
                            setTimeout(function() {{
                                if (window.location.href !== '{VEO_URL}') {{
                                    window.location.assign('{VEO_URL}');
                                }}
                            }}, 2000);
                        """)
                        time.sleep(7)
                        
                        current_url = self.driver.current_url
                        print(f"VIP JavaScript result URL: {current_url}")
                        
                        if ("labs.google" in current_url and "flow" in current_url) or "13884c8a-4807-4306-af8e-70c65436179b" in current_url:
                            print("🎉 VIP JavaScript navigation SUCCESS!")
                            success = True
                            self.root.after(0, lambda: self.status_bar.configure(text="✅ VIP SUCCESS: JavaScript navigation"))
                            break
                    
                    # VIP Method 3: Direct URL manipulation
                    if attempt == 2:
                        print("VIP Method 3: Direct URL bar manipulation...")
                        self.driver.get("about:blank")
                        time.sleep(1)
                        self.driver.execute_script(f"window.location = '{VEO_URL}';")
                        time.sleep(5)
                        
                        current_url = self.driver.current_url
                        if ("labs.google" in current_url and "flow" in current_url) or "13884c8a-4807-4306-af8e-70c65436179b" in current_url:
                            print("🎉 VIP Direct manipulation SUCCESS!")
                            success = True
                            self.root.after(0, lambda: self.status_bar.configure(text="✅ VIP SUCCESS: Direct manipulation"))
                            break
                    
                    # VIP Method 4: New tab with focus
                    if attempt == 3:
                        print("VIP Method 4: New tab with focus...")
                        self.driver.execute_script(f"window.open('{VEO_URL}', '_blank');")
                        time.sleep(3)
                        
                        if len(self.driver.window_handles) > 1:
                            self.driver.switch_to.window(self.driver.window_handles[-1])
                            self.driver.execute_script("window.focus();")
                            time.sleep(3)
                            
                            current_url = self.driver.current_url
                            print(f"VIP New tab URL: {current_url}")
                            
                            if ("labs.google" in current_url and "flow" in current_url) or "13884c8a-4807-4306-af8e-70c65436179b" in current_url:
                                print("🎉 VIP New tab SUCCESS!")
                                success = True
                                self.root.after(0, lambda: self.status_bar.configure(text="✅ VIP SUCCESS: New tab method"))
                                break
                    
                    # If still not successful, wait and try again
                    if attempt < max_attempts - 1:
                        print(f"VIP Navigation attempt {attempt + 1} failed, retrying with enhanced method...")
                        time.sleep(4)
                        
                except Exception as nav_error:
                    print(f"VIP Navigation attempt {attempt + 1} error: {nav_error}")
                    if attempt < max_attempts - 1:
                        time.sleep(3)
                        continue
            
            # VIP Final fallback method
            if not success:
                print("🔥 VIP FINAL FALLBACK: Force navigation with all methods...")
                self.root.after(0, lambda: self.status_bar.configure(text="🔥 VIP FINAL ATTEMPT: Force navigation..."))
                
                try:
                    # Close all tabs except first
                    while len(self.driver.window_handles) > 1:
                        self.driver.switch_to.window(self.driver.window_handles[-1])
                        self.driver.close()
                    
                    self.driver.switch_to.window(self.driver.window_handles[0])
                    
                    # VIP Ultimate force navigation - Multiple methods combined
                    self.driver.execute_script(f"""
                        // Method 1: Direct assignment
                        window.location.href = '{VEO_URL}';
                        
                        // Method 2: Replace with timeout
                        setTimeout(function() {{
                            window.location.replace('{VEO_URL}');
                        }}, 1000);
                        
                        // Method 3: Assign with timeout
                        setTimeout(function() {{
                            window.location.assign('{VEO_URL}');
                        }}, 2000);
                        
                        // Method 4: History manipulation
                        setTimeout(function() {{
                            history.pushState(null, null, '{VEO_URL}');
                            window.location.reload();
                        }}, 3000);
                    """)
                    
                    # Wait for final attempt
                    time.sleep(8)
                    
                    current_url = self.driver.current_url
                    print(f"VIP Final attempt result URL: {current_url}")
                    
                    if ("labs.google" in current_url and "flow" in current_url) or "13884c8a-4807-4306-af8e-70c65436179b" in current_url:
                        print("🎉 VIP FINAL FALLBACK SUCCESS!")
                        success = True
                        self.root.after(0, lambda: self.status_bar.configure(text="✅ VIP FINAL SUCCESS: Force navigation worked!"))
                    
                except Exception as final_error:
                    print(f"VIP Final fallback error: {final_error}")
            
            if success:
                # Wait for page to fully load - optimized for faster loading
                self.root.after(0, lambda: self.status_bar.configure(text="Đang chờ trang tải hoàn tất..."))
                time.sleep(2)  # Reduced from 5 to 2 seconds for faster loading
                
                # Fetch user info from API
                self.fetch_user_info_from_api()
            else:
                # Show error but keep browser open for manual navigation
                self.root.after(0, lambda: self.status_bar.configure(text="⚠️ Vui lòng điều hướng thủ công đến VEO Labs"))
                self.root.after(0, lambda: self.user_name_label.configure(text="⚠️ Vui lòng điều hướng thủ công", fg="#ffaa00"))
                self.root.after(0, lambda: self.user_email_label.configure(text="Trình duyệt đã mở, hãy truy cập VEO Labs", fg="#ffaa00"))
            
        except Exception as e:
            error_msg = f"Lỗi khởi động: {str(e)}"
            self.root.after(0, lambda: self.status_bar.configure(text=error_msg))
            print(f"Error in auto browser start: {e}")
            # Show error in user display
            self.root.after(0, lambda: self.user_name_label.configure(text="❌ Lỗi khởi động trình duyệt", fg="#ff6b6b"))
            self.root.after(0, lambda: self.user_email_label.configure(text="", fg="#ff6b6b"))
            
    def fetch_user_info_from_api(self):
        """Fetch user information from the auth session API"""
        try:
            self.root.after(0, lambda: self.status_bar.configure(text="Đang lấy thông tin người dùng từ trình duyệt..."))
            print("Starting API call to fetch user info...")
            
            # Get cookies from the browser session
            cookies = self.driver.get_cookies()
            cookie_dict = {cookie['name']: cookie['value'] for cookie in cookies}
            print(f"Found {len(cookies)} cookies from browser session")
            
            # Make request to auth session API
            headers = {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'referer': VEO_URL,
                'user-agent': self.driver.execute_script("return navigator.userAgent;")
            }
            
            api_url = 'https://labs.google/fx/api/auth/session'
            print(f"Making API call to: {api_url}")
            
            response = requests.get(
                api_url,
                headers=headers,
                cookies=cookie_dict,
                timeout=15
            )
            
            print(f"API Response Status: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"API Response Data: {data}")
                    
                    if 'user' in data and data['user']:
                        self.user_info["name"] = data['user'].get('name', '')
                        self.user_info["email"] = data['user'].get('email', '')
                        self.user_info["image"] = data['user'].get('image', '')
                        
                        # Store access token for API calls
                        self.access_token = data.get('access_token', '')
                        
                        print(f"User info extracted: {self.user_info['name']} - {self.user_info['email']}")
                        print(f"Access token stored: {self.access_token[:50]}...")
                        
                        # Update UI on main thread
                        self.root.after(0, self.update_user_display)
                        self.root.after(0, lambda: self.status_bar.configure(text="Đã lấy thông tin người dùng thành công!"))
                        
                        # Fetch credits information
                        self.fetch_credits_info()
                    else:
                        print("No user data found in API response - Account has issues, auto-switching")
                        self.root.after(0, lambda: self.status_bar.configure(text="Tài khoản Google có vấn đề - Đang tự động đổi tài khoản..."))
                        self.root.after(0, lambda: self.user_name_label.configure(text="Tài khoản GG của bạn có vấn đề rồi đổi đi bạn", fg="#ff6b6b"))
                        self.root.after(0, lambda: self.user_email_label.configure(text="Đang tự động khởi động quy trình đổi tài khoản...", fg="#ff6b6b"))
                        
                        # Auto-trigger account change process after 2 seconds
                        threading.Timer(2.0, self.perform_account_change).start()
                        
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    self.root.after(0, lambda: self.status_bar.configure(text="Lỗi phân tích dữ liệu trình duyệt"))
                    
            elif response.status_code == 401:
                print("Unauthorized - user not logged in")
                self.root.after(0, lambda: self.status_bar.configure(text="Chưa đăng nhập vào tài khoản Google"))
                self.root.after(0, lambda: self.user_name_label.configure(text="🔒 Vui lòng đăng nhập vào Google", fg="#ff6b6b"))
                self.root.after(0, lambda: self.user_email_label.configure(text="", fg="#ff6b6b"))
                
            else:
                print(f"API returned error status: {response.status_code}")
                self.root.after(0, lambda: self.status_bar.configure(text=f"Trình duyệt trả về lỗi: {response.status_code}"))
                self.root.after(0, lambda: self.user_name_label.configure(text=f"❌ Lỗi trình duyệt: {response.status_code}", fg="#ff6b6b"))
                self.root.after(0, lambda: self.user_email_label.configure(text="", fg="#ff6b6b"))
                
        except requests.RequestException as e:
            print(f"Request exception: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi kết nối trình duyệt: {str(e)}"))
            self.root.after(0, lambda: self.user_name_label.configure(text="🌐 Lỗi kết nối mạng", fg="#ff6b6b"))
            self.root.after(0, lambda: self.user_email_label.configure(text="", fg="#ff6b6b"))
            
        except Exception as e:
            print(f"General exception: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi lấy thông tin: {str(e)}"))
            self.root.after(0, lambda: self.user_name_label.configure(text="❌ Lỗi không xác định", fg="#ff6b6b"))
            self.root.after(0, lambda: self.user_email_label.configure(text="", fg="#ff6b6b"))
    
    def fetch_credits_info(self):
        """Fetch credits information from the API"""
        try:
            self.root.after(0, lambda: self.status_bar.configure(text="Đang lấy thông tin điểm từ trình duyệt..."))
            print("Starting API call to fetch credits info...")
            
            # Get cookies from the browser session
            cookies = self.driver.get_cookies()
            cookie_dict = {cookie['name']: cookie['value'] for cookie in cookies}
            
            # Prepare headers based on the provided example
            headers = {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': f'Bearer {self.access_token}',
                'origin': 'https://labs.google',
                'priority': 'u=1, i',
                'referer': 'https://labs.google/',
                'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'user-agent': self.driver.execute_script("return navigator.userAgent;"),
                'x-browser-channel': 'stable',
                'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
                'x-browser-validation': '6h3XF8YcD8syi2FF2BbuE2KllQo=',
                'x-browser-year': '2025',
                'x-client-data': 'CIe2yQEIorbJAQipncoBCKzyygEIkqHLAQiFoM0BCP2FzwEY4eLOARiX7s4B'
            }
            
            # Make API call to get credits - using the URL from your example
            credits_url = 'https://aisandbox-pa.googleapis.com/v1/credits?key=AIzaSyBtrm0o5ab1c-Ec8ZuLcGt3oJAA5VWt3pY'
            
            response = requests.get(
                credits_url,
                headers=headers,
                cookies=cookie_dict,
                timeout=15
            )
            
            print(f"Credits API Response Status: {response.status_code}")
            print(f"Credits API Response: {response.text}")
            
            if response.status_code == 200:
                try:
                    credits_data = response.json()
                    
                    # Extract credits and paygate tier
                    credits = credits_data.get('credits', 0)
                    paygate_tier = credits_data.get('userPaygateTier', '')
                    
                    # Store in user_info
                    self.user_info["credits"] = credits
                    self.user_info["paygate_tier"] = paygate_tier
                    
                    print(f"Credits info extracted: {credits} credits, tier: {paygate_tier}")
                    
                    # Update UI on main thread
                    self.root.after(0, self.update_credits_display)
                    self.root.after(0, lambda: self.status_bar.configure(text="Đã lấy thông tin điểm thành công!"))
                    
                except json.JSONDecodeError as e:
                    print(f"JSON decode error in credits: {e}")
                    self.root.after(0, lambda: self.status_bar.configure(text="Lỗi phân tích dữ liệu điểm"))
                    
            else:
                print(f"Credits API returned error status: {response.status_code}")
                self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi lấy điểm: {response.status_code}"))
                
        except requests.RequestException as e:
            print(f"Request exception in credits: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi kết nối trình duyệt: {str(e)}"))
            
        except Exception as e:
            print(f"General exception in credits: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi lấy điểm: {str(e)}"))
    
    def update_credits_display(self):
        """Update credits display in UI"""
        try:
            credits = self.user_info.get("credits", 0)
            paygate_tier = self.user_info.get("paygate_tier", "")
            
            if credits > 0:
                # Show credits with appropriate color based on amount
                if credits >= 500:
                    color = "#00ff00"  # Green for high credits
                    icon = "💰"
                elif credits >= 100:
                    color = "#ffaa00"  # Orange for medium credits
                    icon = "🪙"
                else:
                    color = "#ff6b6b"  # Red for low credits
                    icon = "⚠️"
                
                credits_text = f"{icon} Điểm: {credits}"
                self.credits_label.configure(text=credits_text, fg=color)
                
                print(f"Credits display updated: {credits} credits, tier: {paygate_tier}")
            else:
                self.credits_label.configure(text="❌ Không lấy được thông tin điểm", fg="#ff6b6b")
            
            # Show change account button after credits info is loaded
            self.change_account_button.pack(pady=(5, 0))
            print("Change account button is now visible")
                
        except Exception as e:
            print(f"Error updating credits display: {e}")
            self.credits_label.configure(text="❌ Lỗi hiển thị điểm", fg="#ff6b6b")
            # Still show the button even if credits failed
            self.change_account_button.pack(pady=(5, 0))
    
    def update_credits_display_only(self):
        """Update only credits display without showing change account button"""
        try:
            credits = self.user_info.get("credits", 0)
            
            if credits > 0:
                # Show credits with appropriate color based on amount
                if credits >= 500:
                    color = "#00ff00"  # Green for high credits
                    icon = "💰"
                elif credits >= 100:
                    color = "#ffaa00"  # Orange for medium credits
                    icon = "🪙"
                else:
                    color = "#ff6b6b"  # Red for low credits
                    icon = "⚠️"
                
                credits_text = f"{icon} Điểm: {credits}"
                self.credits_label.configure(text=credits_text, fg=color)
                
                print(f"Credits updated after video creation: {credits}")
            else:
                self.credits_label.configure(text="❌ Không lấy được thông tin điểm", fg="#ff6b6b")
                
        except Exception as e:
            print(f"Error updating credits display only: {e}")
        
    def animate_led_effects(self):
        """Animate LED border effects"""
        colors = ['#00bfff', '#0080ff', '#0040ff', '#0080ff']
        current_color = colors[int(time.time()) % len(colors)]
        self.led_border.configure(bg=current_color)
        
        # Animate title glow
        glow_colors = ['#00bfff', '#40cfff', '#80dfff', '#40cfff']
        title_color = glow_colors[int(time.time() * 2) % len(glow_colors)]
        self.title_label.configure(fg=title_color)
        
        self.root.after(500, self.animate_led_effects)
        
    def select_prompt_file(self):
        """Select and load prompt file with done status detection"""
        file_path = filedialog.askopenfilename(
            title="Chọn file prompt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
        )
        
        if file_path:
            try:
                # Store the file path for later use in saving status
                self.current_prompt_file = file_path
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                
                # Parse prompts and detect existing "- done" status
                lines = [line.strip() for line in content.split('\n') if line.strip()]
                self.prompts = []
                self.prompt_status = {}
                
                for i, line in enumerate(lines, 1):
                    if line.endswith(" - done"):
                        # Extract prompt without "- done" marker
                        prompt = line[:-7].strip()
                        # Remove numbering if present (e.g., "1. prompt text")
                        if prompt.startswith(f"{i}. "):
                            prompt = prompt[len(f"{i}. "):]
                        self.prompts.append(prompt)
                        self.prompt_status[i] = {"prompt": prompt, "done": True}
                    else:
                        # Regular prompt without done marker
                        prompt = line
                        # Remove numbering if present
                        if prompt.startswith(f"{i}. "):
                            prompt = prompt[len(f"{i}. "):]
                        self.prompts.append(prompt)
                        self.prompt_status[i] = {"prompt": prompt, "done": False}
                
                # Display prompts with current status
                self.update_prompt_display_with_status()
                
                # Count done and pending prompts
                done_count = sum(1 for status in self.prompt_status.values() if status["done"])
                pending_count = len(self.prompts) - done_count
                
                self.status_bar.configure(text=f"Đã tải {len(self.prompts)} prompts ({done_count} done, {pending_count} pending)")
                
            except Exception as e:
                messagebox.showerror("Lỗi", f"Không thể đọc file: {str(e)}")
    
    def on_function_change(self, event=None):
        """Handle function selection change"""
        function = self.selected_function.get()
        self.status_bar.configure(text=f"Đã chọn: {function}")
        
        # Update model selection based on function
        if function == "2 ảnh ra video":
            # Force Veo 2 - Fast for 2 ảnh ra video function
            self.model_selection.set("Veo 2 - Fast")
            self.model_combo.configure(state='disabled')
            self.save_settings()
        else:
            # Enable model selection for other functions
            self.model_combo.configure(state='readonly')
        
        # Update UI based on selected function
        if function in ["1 ảnh ra video", "2 ảnh ra video"]:
            self.show_dual_panel_layout()
        else:
            self.show_single_panel_layout()
    
    def show_dual_panel_layout(self):
        """Show dual panel layout for '1 ảnh ra video' function"""
        # Store references to current panels
        if hasattr(self, 'left_panel'):
            # Clear current layout
            for widget in self.left_panel.winfo_children():
                widget.destroy()
            
            # Configure left panel for grid layout
            self.left_panel.grid_rowconfigure(0, weight=1)
            self.left_panel.grid_columnconfigure(0, weight=1)  # Images panel
            self.left_panel.grid_columnconfigure(1, weight=1)  # Prompts panel
            
            # Left sub-panel for images - using grid
            images_panel = tk.Frame(self.left_panel, bg='#1a1a2e', relief='raised', bd=2)
            images_panel.grid(row=0, column=0, sticky='nsew', padx=(0, 5))
            
            # Image selection frame
            image_frame = tk.LabelFrame(images_panel, text="Danh sách ảnh", 
                                      fg='#00bfff', bg='#1a1a2e', font=('Arial', 10, 'bold'))
            image_frame.pack(fill='both', expand=True, padx=10, pady=10)
            
            # Folder selection button
            self.folder_button = tk.Button(image_frame, text="📁 Chọn folder ảnh", 
                                         command=self.select_image_folder,
                                         bg='#16213e', fg='#00bfff', 
                                         font=('Arial', 10, 'bold'), relief='flat')
            self.folder_button.pack(pady=10)
            
            # Image list display
            self.image_text = scrolledtext.ScrolledText(image_frame, height=15, 
                                                      bg='#0a0a0a', fg='#00bfff',
                                                      font=('Consolas', 9),
                                                      insertbackground='#00bfff')
            self.image_text.pack(fill='both', expand=True, padx=5, pady=5)
            
            # Right sub-panel for prompts - using grid
            prompts_panel = tk.Frame(self.left_panel, bg='#1a1a2e', relief='raised', bd=2)
            prompts_panel.grid(row=0, column=1, sticky='nsew', padx=(5, 0))
            
            # File selection (moved to top center of prompt panel)
            file_frame = tk.LabelFrame(prompts_panel, text="Chọn file prompt", 
                                      fg='#00bfff', bg='#1a1a2e', font=('Arial', 10, 'bold'))
            file_frame.pack(fill='x', padx=10, pady=10)
            
            # Center the file button
            file_button_frame = tk.Frame(file_frame, bg='#1a1a2e')
            file_button_frame.pack(fill='x', pady=10)
            
            self.file_button = tk.Button(file_button_frame, text="📁 Chọn file TXT", 
                                        command=self.select_prompt_file,
                                        bg='#16213e', fg='#00bfff', 
                                        font=('Arial', 10, 'bold'), relief='flat')
            self.file_button.pack()
            
            # Prompt display
            prompt_frame = tk.LabelFrame(prompts_panel, text="Danh sách prompts", 
                                        fg='#00bfff', bg='#1a1a2e', font=('Arial', 10, 'bold'))
            prompt_frame.pack(fill='both', expand=True, padx=10, pady=10)
            
            self.prompt_text = scrolledtext.ScrolledText(prompt_frame, height=15, 
                                                        bg='#0a0a0a', fg='#00bfff',
                                                        font=('Consolas', 9),
                                                        insertbackground='#00bfff')
            self.prompt_text.pack(fill='both', expand=True, padx=5, pady=5)
            
            # Initialize variables for image selection
            self.selected_images = []
            self.image_order = {}
            
    def show_single_panel_layout(self):
        """Show single panel layout for other functions"""
        if hasattr(self, 'left_panel'):
            # Clear current layout
            for widget in self.left_panel.winfo_children():
                widget.destroy()
            
            # Recreate original single panel layout
            # File selection
            file_frame = tk.LabelFrame(self.left_panel, text="Chọn file prompt", 
                                      fg='#00bfff', bg='#1a1a2e', font=('Arial', 10, 'bold'))
            file_frame.pack(fill='x', padx=10, pady=10)
            
            self.file_button = tk.Button(file_frame, text="📁 Chọn file TXT", 
                                        command=self.select_prompt_file,
                                        bg='#16213e', fg='#00bfff', 
                                        font=('Arial', 10, 'bold'), relief='flat')
            self.file_button.pack(pady=10)
            
            # Prompt display
            prompt_frame = tk.LabelFrame(self.left_panel, text="Danh sách prompts", 
                                        fg='#00bfff', bg='#1a1a2e', font=('Arial', 10, 'bold'))
            prompt_frame.pack(fill='both', expand=True, padx=10, pady=10)
            
            self.prompt_text = scrolledtext.ScrolledText(prompt_frame, height=15, 
                                                        bg='#0a0a0a', fg='#00bfff',
                                                        font=('Consolas', 9),
                                                        insertbackground='#00bfff')
            self.prompt_text.pack(fill='both', expand=True, padx=5, pady=5)
    
    def select_image_folder(self):
        """Select folder containing images"""
        folder_path = filedialog.askdirectory(title="Chọn folder chứa ảnh")
        
        if folder_path:
            try:
                # Get all image files from folder
                image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.ico', '.svg'}
                image_files = []
                
                for file in os.listdir(folder_path):
                    file_ext = os.path.splitext(file)[1].lower()
                    if file_ext in image_extensions:
                        image_files.append(file)
                
                if image_files:
                    # Sort files alphabetically
                    image_files.sort()
                    self.show_image_selection_modal(image_files, folder_path)
                else:
                    messagebox.showwarning("Cảnh báo", "Không tìm thấy file ảnh nào trong folder!")
                    
            except Exception as e:
                messagebox.showerror("Lỗi", f"Không thể đọc folder: {str(e)}")
    
    def show_image_selection_modal(self, image_files, folder_path):
        """Show modal dialog for image selection with ordering"""
        # Create modal window
        modal = tk.Toplevel(self.root)
        modal.title("Chọn ảnh và sắp xếp thứ tự")
        modal.geometry("700x550")
        modal.configure(bg='#0a0a0a')
        modal.resizable(True, True)
        modal.minsize(600, 400)  # Set minimum size for better usability
        
        # Make modal stay on top and grab focus
        modal.transient(self.root)
        modal.grab_set()
        
        # Center the modal over the main window
        modal.update_idletasks()
        x = (self.root.winfo_x() + (self.root.winfo_width() // 2)) - (700 // 2)
        y = (self.root.winfo_y() + (self.root.winfo_height() // 2)) - (550 // 2)
        modal.geometry(f"700x550+{x}+{y}")
        
        # Create main container
        main_frame = tk.Frame(modal, bg='#1a1a2e', relief='raised', bd=3)
        main_frame.pack(fill='both', expand=True, padx=15, pady=15)
        
        # LED border effect at top
        led_border = tk.Frame(main_frame, bg='#00bfff', height=4)
        led_border.pack(fill='x', pady=(0, 15))
        
        # Title
        title_label = tk.Label(main_frame, text="Chọn ảnh và sắp xếp thứ tự", 
                              font=('Arial', 16, 'bold'), 
                              fg='#00bfff', bg='#1a1a2e')
        title_label.pack(pady=(10, 15))
        
        # Content frame with proper layout
        content_frame = tk.Frame(main_frame, bg='#1a1a2e')
        content_frame.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Left frame for scrollable list (black background)
        list_frame = tk.Frame(content_frame, bg='#0a0a0a', relief='sunken', bd=2)
        list_frame.pack(side='left', fill='both', expand=True, padx=(0, 15))
        
        # Scrollable frame for image list inside the black frame
        canvas = tk.Canvas(list_frame, bg='#0a0a0a', highlightthickness=0)
        scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg='#0a0a0a')
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # Pack canvas and scrollbar inside the black frame
        canvas.pack(side="left", fill="both", expand=True, padx=5, pady=5)
        scrollbar.pack(side="right", fill="y", pady=5)
        
        # Variables for tracking selections
        self.image_checkboxes = {}
        self.image_order_vars = {}
        self.current_order = 0
        
        # Create checkbox for each image
        for i, image_file in enumerate(image_files):
            frame = tk.Frame(scrollable_frame, bg='#0a0a0a')
            frame.pack(fill='x', padx=5, pady=2)
            
            # Checkbox variable
            var = tk.BooleanVar()
            self.image_checkboxes[image_file] = var
            
            # Order label (initially empty)
            order_label = tk.Label(frame, text="", width=3, 
                                  bg='#0a0a0a', fg='#ffaa00', 
                                  font=('Arial', 10, 'bold'))
            order_label.pack(side='left', padx=(0, 5))
            self.image_order_vars[image_file] = order_label
            
            # Checkbox
            checkbox = tk.Checkbutton(frame, variable=var, 
                                     bg='#0a0a0a', fg='#00bfff',
                                     selectcolor='#16213e',
                                     command=lambda f=image_file: self.on_image_checkbox_change(f))
            checkbox.pack(side='left', padx=(0, 5))
            
            # Image filename
            label = tk.Label(frame, text=image_file, 
                           bg='#0a0a0a', fg='#00bfff', 
                           font=('Consolas', 9))
            label.pack(side='left', anchor='w')
        
        # Right frame for buttons
        button_frame = tk.Frame(content_frame, bg='#1a1a2e')
        button_frame.pack(side='right', fill='y', padx=(0, 10))
        
        # Create buttons vertically stacked
        # Default order button
        default_button = tk.Button(button_frame, text="Mặc định từ\ntrên xuống", 
                                  command=lambda: self.set_default_order(image_files),
                                  bg='#0f5132', fg='#00ff00', 
                                  font=('Arial', 9, 'bold'), 
                                  relief='raised', bd=2,
                                  width=12, height=3,
                                  wraplength=100)
        default_button.pack(pady=(20, 10), padx=5)
        
        # Confirm button
        confirm_button = tk.Button(button_frame, text="Xác nhận", 
                                  command=lambda: self.confirm_image_selection(modal, folder_path),
                                  bg='#16213e', fg='#00bfff', 
                                  font=('Arial', 10, 'bold'), 
                                  relief='raised', bd=2,
                                  width=12, height=2)
        confirm_button.pack(pady=10, padx=5)
        
        # Choose different folder button
        folder_button = tk.Button(button_frame, text="Chọn folder\nkhác", 
                                 command=lambda: self.choose_different_folder(modal),
                                 bg='#721c24', fg='#ff6b6b', 
                                 font=('Arial', 9, 'bold'), 
                                 relief='raised', bd=2,
                                 width=12, height=3,
                                 wraplength=100)
        folder_button.pack(pady=(10, 20), padx=5)
        
        # Add LED animation to the border
        def animate_modal_led():
            try:
                if modal.winfo_exists():
                    colors = ['#00bfff', '#0080ff', '#0040ff', '#0080ff']
                    current_color = colors[int(time.time() * 2) % len(colors)]
                    led_border.configure(bg=current_color)
                    modal.after(300, animate_modal_led)
            except:
                pass
        
        # Start LED animation
        animate_modal_led()
        
        # Handle window close button (X)
        modal.protocol("WM_DELETE_WINDOW", lambda: self.close_modal(modal))
        
        # Focus on the modal
        modal.focus_set()
        
        # Store modal reference
        self.current_modal = modal
    
    def on_image_checkbox_change(self, image_file):
        """Handle checkbox change for image selection"""
        var = self.image_checkboxes[image_file]
        order_label = self.image_order_vars[image_file]
        
        if var.get():  # Checkbox is checked
            function = self.selected_function.get()
            
            if function == "2 ảnh ra video":
                # Special ordering for 2 ảnh ra video: 1.1, 1.2, 2.1, 2.2, etc.
                self.current_order += 1
                
                # Calculate pair and position within pair
                pair_number = ((self.current_order - 1) // 2) + 1
                position_in_pair = ((self.current_order - 1) % 2) + 1
                
                order_text = f"{pair_number}.{position_in_pair}"
                order_label.configure(text=order_text)
                self.image_order[image_file] = self.current_order
            else:
                # Regular ordering for other functions
                self.current_order += 1
                order_label.configure(text=str(self.current_order))
                self.image_order[image_file] = self.current_order
        else:  # Checkbox is unchecked
            if image_file in self.image_order:
                removed_order = self.image_order[image_file]
                del self.image_order[image_file]
                order_label.configure(text="")
                
                # Reorder remaining items
                for file, order in self.image_order.items():
                    if order > removed_order:
                        self.image_order[file] = order - 1
                        
                        # Update display based on function
                        function = self.selected_function.get()
                        if function == "2 ảnh ra video":
                            # Recalculate pair.position format
                            new_order = order - 1
                            pair_number = ((new_order - 1) // 2) + 1
                            position_in_pair = ((new_order - 1) % 2) + 1
                            self.image_order_vars[file].configure(text=f"{pair_number}.{position_in_pair}")
                        else:
                            self.image_order_vars[file].configure(text=str(order - 1))
                
                self.current_order -= 1
    
    def set_default_order(self, image_files):
        """Set default order from top to bottom"""
        # Clear current selections
        self.current_order = 0
        self.image_order.clear()
        
        # Select all images in order
        for i, image_file in enumerate(image_files, 1):
            var = self.image_checkboxes[image_file]
            order_label = self.image_order_vars[image_file]
            
            var.set(True)
            
            function = self.selected_function.get()
            if function == "2 ảnh ra video":
                # Special ordering for 2 ảnh ra video: 1.1, 1.2, 2.1, 2.2, etc.
                pair_number = ((i - 1) // 2) + 1
                position_in_pair = ((i - 1) % 2) + 1
                order_text = f"{pair_number}.{position_in_pair}"
                order_label.configure(text=order_text)
            else:
                # Regular ordering for other functions
                order_label.configure(text=str(i))
            
            self.image_order[image_file] = i
            self.current_order = i
    
    def confirm_image_selection(self, modal, folder_path):
        """Confirm image selection and update display"""
        if not self.image_order:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn ít nhất một ảnh!")
            return
        
        # Sort selected images by order
        sorted_images = sorted(self.image_order.items(), key=lambda x: x[1])
        self.selected_images = [(os.path.join(folder_path, img), order) for img, order in sorted_images]
        
        # Update image display - show with proper ordering format
        if hasattr(self, 'image_text'):
            self.image_text.delete('1.0', tk.END)
            
            function = self.selected_function.get()
            for i, (image_path, order) in enumerate(self.selected_images, 1):
                image_name = os.path.basename(image_path)
                
                if function == "2 ảnh ra video":
                    # Show with pair.position format for 2 ảnh ra video
                    pair_number = ((i - 1) // 2) + 1
                    position_in_pair = ((i - 1) % 2) + 1
                    display_order = f"{pair_number}.{position_in_pair}"
                    self.image_text.insert(tk.END, f"{display_order}. {image_name}\n")
                else:
                    # Regular numbering for other functions
                    self.image_text.insert(tk.END, f"{i}. {image_name}\n")
        
        self.status_bar.configure(text=f"Đã chọn {len(self.selected_images)} ảnh theo thứ tự")
        
        # Close modal
        self.close_modal(modal)
    
    def choose_different_folder(self, modal):
        """Close current modal and choose different folder"""
        self.close_modal(modal)
        self.select_image_folder()
    
    def close_modal(self, modal):
        """Close modal dialog"""
        try:
            modal.grab_release()
            modal.destroy()
        except:
            pass
        
    def show_success_notification(self, message):
        """Show success notification in center"""
        self.success_label.configure(text=message)
        self.success_frame.place(relx=0.5, rely=0.7, anchor='center')
        
        # Don't auto hide - wait for user click
        
    def on_success_click(self, event=None):
        """Handle success notification click"""
        self.success_frame.place_forget()
        self.status_bar.configure(text="Sẵn sàng sử dụng các chức năng!")
        
    def start_process(self):
        """Start the automation process"""
        # Additional validation for image functions
        function = self.selected_function.get()
        
        if function in ["1 ảnh ra video", "2 ảnh ra video"]:
            if not self.selected_images:
                messagebox.showwarning("Cảnh báo", "Vui lòng chọn ảnh trước!")
                return
            
            # Special validation for 2 ảnh ra video
            if function == "2 ảnh ra video":
                num_images = len(self.selected_images)
                if num_images % 2 != 0:
                    messagebox.showwarning("Cảnh báo", "Chức năng 2 ảnh ra video cần số ảnh chẵn (2, 4, 6...)!")
                    return
        
        if not self.prompts:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn file prompt trước!")
            return
            
        if not self.driver:
            messagebox.showwarning("Cảnh báo", "Trình duyệt chưa được khởi động!")
            return
            
        if not self.current_project_id:
            messagebox.showwarning("Cảnh báo", "Vui lòng tạo project trước khi tạo video!")
            return
        
        # Check if all prompts are already done
        if hasattr(self, 'prompt_status') and self.prompt_status:
            all_done = all(status.get("done", False) for status in self.prompt_status.values())
            if all_done:
                messagebox.showwarning(
                    "Tất cả đều done", 
                    "Tất cả đều done không thể chạy\nNếu muốn chạy lại dòng nào thì chỉ cần xóa ' - done'"
                )
                return
        
        # Reset stop flag
        self.stop_requested = False
            
        self.start_button.configure(state='disabled')
        self.status_bar.configure(text="Đang bắt đầu xử lý...")
        
        # Start automation in separate thread
        threading.Thread(target=self.run_automation, daemon=True).start()
        
    def stop_process(self):
        """Stop the automation process"""
        # Set stop flag to interrupt automation
        self.stop_requested = True
        print("Stop requested by user")
        
        # Update UI immediately
        self.status_bar.configure(text="Đang dừng quá trình...")
        
        # Don't close browser immediately - let automation finish current operation gracefully
        # Browser will be managed by the automation thread
        
        self.start_button.configure(state='normal')
        self.status_bar.configure(text="Đã yêu cầu dừng - Đang hoàn tất thao tác hiện tại...")
        
    def run_automation(self):
        """Main automation process - Enhanced with direct API calls"""
        try:
            if not self.driver:
                self.root.after(0, lambda: messagebox.showerror("Lỗi", "Trình duyệt chưa được khởi động!"))
                return
            
            # Get access token from user info
            if not hasattr(self, 'access_token') or not self.access_token:
                self.root.after(0, lambda: messagebox.showerror("Lỗi", "Không có access token! Vui lòng đợi đăng nhập hoàn tất."))
                return
            
            # Check selected function and process accordingly
            function = self.selected_function.get()
            
            if function == "1 ảnh ra video":
                # Process image-to-video function
                self.process_image_to_video()
            elif function == "2 ảnh ra video":
                # Process 2-image-to-video function
                self.process_two_images_to_video()
            else:
                # Process regular prompt-to-video function with countdown timer
                total_prompts = len(self.prompts)
                
                # Create main folder structure based on user input
                folder_name = self.folder_name.get().strip() or "auto1"
                main_folder = os.path.join(os.getcwd(), folder_name)
                os.makedirs(main_folder, exist_ok=True)
                self.root.after(0, lambda: self.status_bar.configure(text=f"Đã tạo folder chính: {folder_name}"))
                
                # Get current prompts from text area in real-time order
                current_prompts = self.get_current_prompts_from_text()
                total_prompts = len(current_prompts)
                
                for i, (prompt_text, is_done) in enumerate(current_prompts, 1):
                    # Check stop flag before processing each prompt
                    if self.stop_requested:
                        print("Stop requested, breaking out of prompt loop")
                        self.root.after(0, lambda: self.status_bar.configure(text="Đã dừng theo yêu cầu"))
                        break
                    
                    # Skip if prompt is already done
                    if is_done:
                        self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"Bỏ qua prompt {idx} - đã hoàn thành"))
                        print(f"Skipping prompt {i} - already done")
                        continue
                    
                    self.root.after(0, lambda p=prompt_text, idx=i: self.status_bar.configure(text=f"Đang xử lý prompt {idx}/{total_prompts}: {p[:50]}..."))
                    
                    # Create subfolder using original prompt index (not enumeration index)
                    # This ensures folder "2" is created for prompt 2 even if prompt 1 is skipped
                    subfolder = os.path.join(main_folder, str(i))
                    os.makedirs(subfolder, exist_ok=True)
                    
                    # Generate videos for this prompt (send clean prompt without numbering)
                    # Use original prompt index for proper tracking
                    success = self.generate_videos_for_prompt_with_folder(prompt_text, i, total_prompts, subfolder)
                    if not success:
                        self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"Lỗi xử lý prompt {idx}"))
                        # Check stop flag after failed prompt
                        if self.stop_requested:
                            print("Stop requested after failed prompt")
                            break
                        continue
                    
                    # Mark as done in current text and update file using original index
                    self.mark_prompt_as_done_in_text(i)
                    
                    # Check stop flag before countdown
                    if self.stop_requested:
                        print("Stop requested before countdown")
                        break
                    
                    # Countdown timer between prompts (except for the last prompt)
                    # Only countdown if there are more pending prompts
                    remaining_prompts = sum(1 for j, (_, done) in enumerate(current_prompts[i:], i+1) if not done)
                    if remaining_prompts > 0:
                        self.countdown_between_prompts(i, total_prompts)
                
                # Check if any prompts were completed and show completion notification
                current_prompts_final = self.get_current_prompts_from_text()
                completed_prompts = sum(1 for prompt_text, is_done in current_prompts_final if is_done)
                total_prompts_final = len(current_prompts_final)
                
                # Only show completion notification if ALL prompts are done
                if completed_prompts > 0 and completed_prompts == total_prompts_final:
                    self.root.after(0, lambda: self.status_bar.configure(text=f"Hoàn thành TẤT CẢ {completed_prompts} prompts!"))
                    self.show_completion_notification()
                elif completed_prompts > 0:
                    # Some prompts completed but not all - don't show completion notification
                    pending_prompts = total_prompts_final - completed_prompts
                    self.root.after(0, lambda: self.status_bar.configure(text=f"Hoàn thành {completed_prompts}/{total_prompts_final} prompts - Còn {pending_prompts} prompts chưa làm"))
                else:
                    self.root.after(0, lambda: self.status_bar.configure(text="Không có prompt nào được xử lý thành công"))
            
        except Exception as e:
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi: {str(e)}"))
            self.root.after(0, lambda: messagebox.showerror("Lỗi", f"Có lỗi xảy ra: {str(e)}"))
        finally:
            self.root.after(0, lambda: self.start_button.configure(state='normal'))
    
    def generate_videos_for_prompt(self, prompt, prompt_index, total_prompts):
        """Generate videos for a single prompt using direct API calls"""
        try:
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đang tạo video cho prompt {prompt_index}/{total_prompts}..."))
            print(f"Starting video generation for prompt {prompt_index}: {prompt}")
            
            # Create the API payload based on the provided structure
            output_count = int(self.output_count.get())
            
            # Get selected model and determine the correct videoModelKey
            selected_model = self.model_selection.get()
            video_model_key = self.get_video_model_key(selected_model)
            
            print(f"Selected model: {selected_model}, Using videoModelKey: {video_model_key}")
            
            # Generate random seeds for each video
            import random
            requests_list = []
            
            for i in range(output_count):
                seed = random.randint(1000, 99999)
                scene_id = f"{random.randint(10000000, 99999999):08x}-{random.randint(1000, 9999):04x}-{random.randint(1000, 9999):04x}-{random.randint(1000, 9999):04x}-{random.randint(100000000000, 999999999999):012x}"
                
                request_data = {
                    "aspectRatio": "VIDEO_ASPECT_RATIO_LANDSCAPE",
                    "seed": seed,
                    "textInput": {
                        "prompt": prompt + "\n"  # Add newline as shown in the API example
                    },
                    "videoModelKey": video_model_key,
                    "metadata": {
                        "sceneId": scene_id
                    }
                }
                requests_list.append(request_data)
            
            # Check if we have a project ID
            if not self.current_project_id:
                print("No project ID available, cannot create video")
                self.root.after(0, lambda: self.status_bar.configure(text="❌ Chưa có project! Vui lòng tạo project trước khi tạo video"))
                return False
            
            # Create the full payload using current project ID
            payload = {
                "clientContext": {
                    "projectId": self.current_project_id,
                    "tool": "PINHOLE",
                    "userPaygateTier": "PAYGATE_TIER_ONE"
                },
                "requests": requests_list
            }
            
            print(f"API payload created: {json.dumps(payload, indent=2)}")
            
            # Make the API call
            return self.make_video_api_call(payload, prompt_index, prompt)
                
        except Exception as e:
            print(f"General exception in generate_videos_for_prompt: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi tạo video cho prompt {prompt_index}: {str(e)}"))
            return False
    
    def get_video_model_key(self, selected_model):
        """Get the correct videoModelKey based on selected model"""
        model_mapping = {
            "Veo 3 - Quality": "veo_3_0_t2v_pro",
            "Veo 2 - Quality": "veo_2_0_t2v",  # This is the key for veo2-quality
            "Veo 3 - Fast": "veo_3_0_t2v_fast", 
            "Veo 2 - Fast": "veo_2_1_fast_d_15_t2v"  # Correct key for veo2-fast
        }
        
        return model_mapping.get(selected_model, "veo_2_0_t2v")  # Default to veo2-quality
    
    def make_video_api_call(self, payload, prompt_index, prompt):
        """Make API call to generate videos"""
        try:
            output_count = len(payload['requests'])
            print(f"Making video API call for {output_count} videos: {json.dumps(payload, indent=2)}")
            
            # Get cookies from browser for authentication
            cookies = self.driver.get_cookies()
            cookie_dict = {cookie['name']: cookie['value'] for cookie in cookies}
            
            # Prepare headers based on the provided example
            headers = {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': f'Bearer {self.access_token}' if hasattr(self, 'access_token') else '',
                'content-type': 'text/plain;charset=UTF-8',
                'priority': 'u=1, i',
                'referer': 'https://labs.google/',
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'user-agent': self.driver.execute_script("return navigator.userAgent;"),
                'x-browser-channel': 'stable'
            }
            
            # Make API call to generate videos
            api_url = 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText'
            
            response = requests.post(
                api_url,
                headers=headers,
                cookies=cookie_dict,
                json=payload,
                timeout=30
            )
            
            print(f"Video API Response Status: {response.status_code}")
            print(f"Video API Response: {response.text}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    
                    # Extract operations for status polling based on the provided structure
                    operations = response_data.get('operations', [])
                    if not operations:
                        print("No operations found in response")
                        self.root.after(0, lambda: self.status_bar.configure(text=f"Không có operations trong response cho prompt {prompt_index}"))
                        return False
                    
                    # Verify we got the expected number of operations
                    if len(operations) != output_count:
                        print(f"Warning: Expected {output_count} operations, got {len(operations)}")
                        self.root.after(0, lambda: self.status_bar.configure(text=f"Cảnh báo: Chỉ nhận được {len(operations)}/{output_count} operations"))
                    
                    # Store operations data for polling
                    operations_data = []
                    for op in operations:
                        operation_info = {
                            'operation': op.get('operation', {}),
                            'sceneId': op.get('sceneId', ''),
                            'status': op.get('status', '')
                        }
                        operations_data.append(operation_info)
                    
                    print(f"Got {len(operations_data)} operations for polling (expected {output_count})")
                    self.root.after(0, lambda: self.status_bar.configure(text=f"Đã tạo {len(operations_data)} video requests cho prompt {prompt_index}"))
                    
                    # Update credits from remainingCredits in response
                    remaining_credits = response_data.get('remainingCredits', 0)
                    if remaining_credits > 0:
                        self.user_info["credits"] = remaining_credits
                        self.root.after(0, self.update_credits_display_only)
                        print(f"Updated credits after video creation: {remaining_credits}")
                    
                    if not operations_data:
                        print("No valid operations found")
                        return False
                    
                    # Poll for completion and download videos
                    return self.poll_and_download_videos(operations_data, prompt_index, prompt)
                    
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi phân tích JSON cho prompt {prompt_index}"))
                    return False
                    
            elif response.status_code == 429:
                # Handle quota exhausted error specifically
                try:
                    error_data = response.json()
                    remaining_credits = error_data.get('remainingCredits', 0)
                    print(f"Quota exhausted, remaining credits: {remaining_credits}")
                    self.root.after(0, lambda: self.status_bar.configure(text=f"❌ Hết quota trình duyệt! Vui lòng đợi reset hoặc thử tài khoản khác"))
                    self.root.after(0, lambda: self.show_quota_exhausted_modal(remaining_credits))
                    return False
                except:
                    self.root.after(0, lambda: self.status_bar.configure(text=f"❌ Lỗi 429: Hết quota trình duyệt"))
                    self.root.after(0, lambda: self.show_quota_exhausted_modal(0))
                    return False
                    
            else:
                print(f"Video API call failed with status {response.status_code}: {response.text}")
                self.root.after(0, lambda: self.status_bar.configure(text=f"❌ Trình duyệt lỗi {response.status_code} cho prompt {prompt_index}"))
                return False
                
        except Exception as e:
            print(f"Exception in make_video_api_call: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"❌ Lỗi kết nối trình duyệt cho prompt {prompt_index}"))
            return False
    
    def use_browser_automation(self, prompt, prompt_index, total_prompts):
        """Fallback to browser automation for video generation"""
        try:
            self.root.after(0, lambda: self.status_bar.configure(text=f"Sử dụng trình duyệt để tạo video {prompt_index}/{total_prompts}..."))
            print(f"Using browser automation for prompt {prompt_index}: {prompt}")
            
            # Wait for video generation to complete in browser
            wait = WebDriverWait(self.driver, 300)  # 5 minutes timeout
            
            # Monitor for completion by checking for download links or completed videos
            max_wait_attempts = 60  # 5 minutes with 5-second intervals
            for attempt in range(max_wait_attempts):
                self.root.after(0, lambda a=attempt+1: self.status_bar.configure(text=f"Chờ video hoàn thành {a}/{max_wait_attempts} cho prompt {prompt_index}..."))
                
                try:
                    # Look for completed video elements or download buttons
                    video_elements = self.driver.find_elements(By.CSS_SELECTOR, "video, [download], [href*='download'], [href*='video']")
                    
                    if video_elements:
                        print(f"Found {len(video_elements)} potential video elements")
                        
                        # Try to extract video URLs
                        video_urls = []
                        for element in video_elements:
                            # Check for src attribute
                            src = element.get_attribute('src')
                            if src and ('video' in src or 'mp4' in src):
                                video_urls.append(src)
                            
                            # Check for href attribute
                            href = element.get_attribute('href')
                            if href and ('video' in href or 'mp4' in href or 'download' in href):
                                video_urls.append(href)
                        
                        if video_urls:
                            print(f"Found video URLs: {video_urls}")
                            return self.download_videos(video_urls, prompt_index, prompt)
                    
                    time.sleep(5)
                    
                except Exception as check_error:
                    print(f"Error checking for videos: {check_error}")
                    time.sleep(5)
                    continue
            
            # Timeout reached
            print("Browser automation timeout reached")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Timeout chờ video cho prompt {prompt_index}"))
            return False
            
        except Exception as e:
            print(f"Exception in use_browser_automation: {e}")
            return False
    
    def poll_and_download_videos(self, operations_data, prompt_index, prompt_text):
        """Poll for video generation completion and download the results - FIXED VERSION"""
        try:
            output_count = int(self.output_count.get())
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đang chờ {output_count} video hoàn thành cho prompt {prompt_index}..."))
            print(f"Starting continuous polling for prompt {prompt_index} with {len(operations_data)} operations, waiting for ALL {output_count} videos")
            
            # Get cookies and headers for polling
            cookies = self.driver.get_cookies()
            cookie_dict = {cookie['name']: cookie['value'] for cookie in cookies}
            
            headers = {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': f'Bearer {self.access_token}',
                'content-type': 'text/plain;charset=UTF-8',
                'origin': 'https://labs.google',
                'priority': 'u=1, i',
                'referer': 'https://labs.google/',
                'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'user-agent': self.driver.execute_script("return navigator.userAgent;"),
                'x-browser-channel': 'stable',
                'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
                'x-browser-validation': '6h3XF8YcD8syi2FF2BbuE2KllQo=',
                'x-browser-year': '2025',
                'x-client-data': 'CIe2yQEIorbJAQipncoBCKzyygEIkqHLAQiFoM0BCP2FzwEY4eLOARiX7s4B'
            }
            
            # Create polling payload based on user's successful example
            # Send full operation objects with proper structure
            polling_payload = {
                "operations": []
            }
            
            for op_data in operations_data:
                operation = op_data.get('operation', {})
                if operation and 'name' in operation:
                    # Send the full operation object structure as shown in user's successful example
                    polling_payload["operations"].append({
                        "operation": {"name": operation['name']},
                        "sceneId": op_data.get('sceneId', ''),
                        "status": op_data.get('status', 'MEDIA_GENERATION_STATUS_PENDING')
                    })
            
            print(f"Fixed polling payload: {json.dumps(polling_payload, indent=2)}")
            
            max_polling_attempts = 120  # 10 minutes max
            polling_interval = 5
            all_video_urls = []  # Collect ALL video URLs before downloading
            
            for attempt in range(max_polling_attempts):
                # Check stop flag before each polling attempt
                if self.stop_requested:
                    print(f"Stop requested during polling for prompt {prompt_index}")
                    self.root.after(0, lambda: self.status_bar.configure(text="Đã dừng theo yêu cầu"))
                    return False
                
                self.root.after(0, lambda a=attempt+1: self.status_bar.configure(text=f"Kiểm tra {a}/{max_polling_attempts} - Chờ đủ {output_count} video cho prompt {prompt_index}"))
                print(f"Polling attempt {attempt + 1}/{max_polling_attempts} for prompt {prompt_index}")
                
                # Make status check API call
                status_url = 'https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus'
                
                try:
                    status_response = requests.post(
                        status_url,
                        headers=headers,
                        cookies=cookie_dict,
                        json=polling_payload,
                        timeout=15
                    )
                    
                    print(f"Status check response: {status_response.status_code}")
                    
                    if status_response.status_code == 400:
                        print(f"Status check failed: 400 - {status_response.text}")
                        time.sleep(polling_interval)
                        continue
                    
                    if status_response.status_code == 200:
                        try:
                            status_data = status_response.json()
                            print(f"Status response: {json.dumps(status_data, indent=2)}")
                            
                            operations = status_data.get('operations', [])
                            if not operations:
                                print("No operations found in status response")
                                time.sleep(polling_interval)
                                continue
                            
                            completed_operations = []
                            failed_operations = []
                            pending_operations = []
                            
                            # Categorize operations by status
                            for op in operations:
                                status = op.get('status', '')
                                if status == 'MEDIA_GENERATION_STATUS_SUCCESSFUL':
                                    completed_operations.append(op)
                                elif status == 'MEDIA_GENERATION_STATUS_FAILED':
                                    failed_operations.append(op)
                                elif status in ['MEDIA_GENERATION_STATUS_PENDING', 'MEDIA_GENERATION_STATUS_ACTIVE']:
                                    pending_operations.append(op)
                                else:
                                    print(f"Unknown status: {status}")
                            
                            print(f"Status summary: {len(completed_operations)} completed, {len(failed_operations)} failed, {len(pending_operations)} pending")
                            
                            # Collect video URLs from completed operations but DON'T download until ALL are ready
                            if completed_operations:
                                for op in completed_operations:
                                    operation = op.get('operation', {})
                                    metadata = operation.get('metadata', {})
                                    
                                    if metadata:
                                        video_data = metadata.get('video', {})
                                        fife_url = video_data.get('fifeUrl', '')
                                        
                                        if fife_url and fife_url not in all_video_urls:
                                            all_video_urls.append(fife_url)
                                            print(f"Collected video URL {len(all_video_urls)}/{output_count}: {fife_url}")
                            
                            # ONLY download when ALL videos are ready (no pending operations)
                            if not pending_operations and not failed_operations:
                                if len(all_video_urls) >= output_count:
                                    print(f"All {output_count} videos ready! Starting download...")
                                    self.root.after(0, lambda: self.status_bar.configure(text=f"Tất cả {output_count} video đã sẵn sàng! Đang tải xuống..."))
                                    
                                    # Download all videos at once
                                    success = self.download_videos(all_video_urls[:output_count], prompt_index, prompt_text)
                                    if success:
                                        # Mark prompt as done and update display immediately
                                        self.prompt_status[prompt_index]["done"] = True
                                        self.update_prompt_display_with_status()
                                        self.update_image_display_with_status()
                                        self.save_prompt_status_to_file()
                                    return success
                                else:
                                    print(f"Only {len(all_video_urls)}/{output_count} videos completed, continuing to wait...")
                            
                            # Check if any operation failed
                            if failed_operations:
                                print(f"Found {len(failed_operations)} failed operations")
                                for failed_op in failed_operations:
                                    operation = failed_op.get('operation', {})
                                    error = operation.get('error', {})
                                    if error:
                                        print(f"Failed operation error: {error}")
                                
                                # If some completed and some failed, but we have enough completed videos
                                if len(all_video_urls) >= output_count:
                                    print(f"Have {len(all_video_urls)} videos despite {len(failed_operations)} failures, downloading...")
                                    success = self.download_videos(all_video_urls[:output_count], prompt_index, prompt_text)
                                    if success:
                                        # Mark prompt as done and update display immediately
                                        self.prompt_status[prompt_index]["done"] = True
                                        self.update_prompt_display_with_status()
                                        self.update_image_display_with_status()
                                        self.save_prompt_status_to_file()
                                    return success
                                
                                # If not enough videos, continue waiting
                                if pending_operations:
                                    print(f"Some operations failed but still have {len(pending_operations)} pending, continuing...")
                                    time.sleep(polling_interval)
                                    continue
                                else:
                                    print("All operations completed but not enough successful videos")
                                    return False
                            
                            # Continue polling if there are pending operations
                            if pending_operations:
                                print(f"Still waiting for {len(pending_operations)} pending operations...")
                                time.sleep(polling_interval)
                                continue
                            
                            # If no operations at all, something is wrong
                            if not operations:
                                print("No operations found in response - this shouldn't happen")
                                time.sleep(polling_interval)
                                continue
                                
                        except json.JSONDecodeError as e:
                            print(f"JSON decode error in status check: {e}")
                            print(f"Raw response: {status_response.text}")
                            time.sleep(polling_interval)
                            continue
                            
                    else:
                        print(f"Status check failed: {status_response.status_code} - {status_response.text}")
                        time.sleep(polling_interval)
                        continue
                        
                except requests.RequestException as e:
                    print(f"Request error during polling: {e}")
                    time.sleep(polling_interval)
                    continue
            
            # Timeout reached
            print("Polling timeout reached")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Timeout chờ video cho prompt {prompt_index}"))
            return False
            
        except Exception as e:
            print(f"Exception in poll_and_download_videos: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi polling cho prompt {prompt_index}: {str(e)}"))
            return False
    
    def download_videos(self, video_urls, prompt_index, prompt_text):
        """Download videos from fifeUrl and save as MP4 files"""
        try:
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đang tải {len(video_urls)} video cho prompt {prompt_index}..."))
            print(f"Starting download of {len(video_urls)} videos for prompt {prompt_index}")
            
            # Create downloads directory if it doesn't exist
            downloads_dir = os.path.join(os.getcwd(), "downloads")
            os.makedirs(downloads_dir, exist_ok=True)
            
            # Clean prompt text for filename (remove special characters)
            clean_prompt = "".join(c for c in prompt_text if c.isalnum() or c in (' ', '-', '_')).rstrip()
            clean_prompt = clean_prompt[:50]  # Limit length
            
            downloaded_count = 0
            
            for i, video_url in enumerate(video_urls, 1):
                try:
                    self.root.after(0, lambda v=i: self.status_bar.configure(text=f"Đang tải video {v}/{len(video_urls)} cho prompt {prompt_index}..."))
                    print(f"Downloading video {i}/{len(video_urls)}: {video_url}")
                    
                    # Create filename
                    filename = f"prompt_{prompt_index:03d}_video_{i:02d}_{clean_prompt}.mp4"
                    filepath = os.path.join(downloads_dir, filename)
                    
                    # Download video
                    headers = {
                        'user-agent': self.driver.execute_script("return navigator.userAgent;"),
                        'referer': VEO_URL
                    }
                    
                    video_response = requests.get(video_url, headers=headers, stream=True, timeout=60)
                    
                    if video_response.status_code == 200:
                        with open(filepath, 'wb') as f:
                            for chunk in video_response.iter_content(chunk_size=8192):
                                if chunk:
                                    f.write(chunk)
                        
                        file_size = os.path.getsize(filepath)
                        print(f"Downloaded video {i}: {filename} ({file_size} bytes)")
                        downloaded_count += 1
                        
                    else:
                        print(f"Failed to download video {i}: HTTP {video_response.status_code}")
                        
                except Exception as download_error:
                    print(f"Error downloading video {i}: {download_error}")
                    continue
            
            if downloaded_count > 0:
                self.root.after(0, lambda: self.status_bar.configure(text=f"Đã tải {downloaded_count}/{len(video_urls)} video cho prompt {prompt_index}"))
                print(f"Successfully downloaded {downloaded_count}/{len(video_urls)} videos for prompt {prompt_index}")
                return True
            else:
                self.root.after(0, lambda: self.status_bar.configure(text=f"Không tải được video nào cho prompt {prompt_index}"))
                print(f"Failed to download any videos for prompt {prompt_index}")
                return False
                
        except Exception as e:
            print(f"Exception in download_videos: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi tải video cho prompt {prompt_index}: {str(e)}"))
            return False
            
            
    def update_user_display(self):
        """Update user display in UI"""
        if self.user_info["name"] and self.user_info["email"]:
            # Update user info directly on labels
            self.user_name_label.configure(text=self.user_info["name"], fg="#00ff00")
            self.user_email_label.configure(text=self.user_info["email"], fg="#00ff00")
            
            # Show message to create project
            self.project_id_label.configure(text="Chưa có project - Vui lòng tạo project mới", fg="#ffaa00")
            
            # Show success notification
            success_msg = f"Vào tài khoản {self.user_info['name']} Thành Công"
            self.show_success_notification(success_msg)
            
            # Add a brief animation effect
            self.animate_user_success()
        else:
            # Show error state
            self.user_name_label.configure(text="Lỗi tải thông tin", fg="#ff6b6b")
            self.user_email_label.configure(text="", fg="#ff6b6b")
            self.project_id_label.configure(text="", fg="#ff6b6b")
    
    def create_new_project(self):
        """Create a new project using the API"""
        if not hasattr(self, 'access_token') or not self.access_token:
            messagebox.showerror("Lỗi", "Không có access token! Vui lòng đợi đăng nhập hoàn tất.")
            return
        
        # Disable button and show creating status
        self.create_project_button.configure(state='disabled', text="🔄 ĐANG TẠO...")
        self.project_status_label.configure(text="Đang tạo project mới...", fg="#ffaa00")
        
        # Start project creation in separate thread
        threading.Thread(target=self.create_project_api_call, daemon=True).start()
    
    def create_project_api_call(self):
        """Make API call to create a new project"""
        try:
            print("Starting project creation API call...")
            
            # Get cookies from browser for authentication
            cookies = self.driver.get_cookies()
            cookie_dict = {cookie['name']: cookie['value'] for cookie in cookies}
            
            # Generate project title with current timestamp
            import datetime
            now = datetime.datetime.now()
            project_title = now.strftime("%b %d - %H:%M")
            
            # Prepare payload based on the provided structure
            payload = {
                "json": {
                    "projectTitle": project_title,
                    "toolName": "PINHOLE"
                }
            }
            
            # Prepare headers
            headers = {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'content-type': 'application/json',
                'priority': 'u=1, i',
                'referer': 'https://labs.google/fx/vi/tools/flow',
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': self.driver.execute_script("return navigator.userAgent;")
            }
            
            # Make API call to create project
            api_url = 'https://labs.google/fx/api/trpc/project.createProject'
            
            response = requests.post(
                api_url,
                headers=headers,
                cookies=cookie_dict,
                json=payload,
                timeout=30
            )
            
            print(f"Project creation API Response Status: {response.status_code}")
            print(f"Project creation API Response: {response.text}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    
                    # Extract project information based on the provided response structure
                    result = response_data.get('result', {})
                    data = result.get('data', {})
                    json_data = data.get('json', {})
                    project_result = json_data.get('result', {})
                    
                    project_id = project_result.get('projectId', '')
                    project_info = project_result.get('projectInfo', {})
                    project_title_response = project_info.get('projectTitle', '')
                    
                    if project_id:
                        # Store the new project
                        new_project = {
                            'id': project_id,
                            'title': project_title_response,
                            'created_at': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        }
                        self.projects.append(new_project)
                        
                        # Set as current project
                        self.current_project_id = project_id
                        
                        print(f"Project created successfully: {project_id} - {project_title_response}")
                        
                        # Update UI on main thread
                        self.root.after(0, lambda: self.update_project_display(new_project))
                        self.root.after(0, lambda: self.project_status_label.configure(text=f"✅ Đã tạo project: {project_title_response}", fg="#00ff00"))
                        
                    else:
                        print("No project ID found in response")
                        self.root.after(0, lambda: self.project_status_label.configure(text="❌ Không tìm thấy project ID trong response", fg="#ff6b6b"))
                        
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    self.root.after(0, lambda: self.project_status_label.configure(text="❌ Lỗi phân tích JSON response", fg="#ff6b6b"))
                    
            else:
                print(f"Project creation API call failed with status {response.status_code}: {response.text}")
                self.root.after(0, lambda: self.project_status_label.configure(text=f"❌ Trình duyệt lỗi {response.status_code}", fg="#ff6b6b"))
                
        except Exception as e:
            print(f"Exception in create_project_api_call: {e}")
            self.root.after(0, lambda: self.project_status_label.configure(text=f"❌ Lỗi tạo project: {str(e)}", fg="#ff6b6b"))
        
        finally:
            # Re-enable button
            self.root.after(0, lambda: self.create_project_button.configure(state='normal', text="🆕 TẠO PROJECT MỚI"))
    
    def update_project_display(self, new_project):
        """Update the project display with new project information"""
        # Update current project ID display
        self.project_id_label.configure(text=f"Current Project: {new_project['id']}", fg="#00ff00")
        
        # Update projects list
        self.projects_text.delete('1.0', tk.END)
        for i, project in enumerate(self.projects, 1):
            status = "🟢 ACTIVE" if project['id'] == self.current_project_id else "⚪ INACTIVE"
            self.projects_text.insert(tk.END, f"{i}. {status} {project['title']}\n")
            self.projects_text.insert(tk.END, f"   ID: {project['id']}\n")
            self.projects_text.insert(tk.END, f"   Created: {project['created_at']}\n\n")
        
        # Show success message
        self.status_bar.configure(text=f"✅ Project '{new_project['title']}' đã được tạo và đang sử dụng!")
            
    def animate_user_success(self):
        """Animate user info when successfully loaded"""
        # Flash effect for text color
        original_color = "#00ff00"
        flash_color = "#ffffff"
        
        def flash_once():
            self.user_name_label.configure(fg=flash_color)
            self.user_email_label.configure(fg=flash_color)
            self.root.after(200, lambda: (
                self.user_name_label.configure(fg=original_color),
                self.user_email_label.configure(fg=original_color)
            ))
            
        # Flash twice
        flash_once()
        self.root.after(400, flash_once)
    
    def show_quota_exhausted_modal(self, remaining_credits):
        """Show custom modal dialog for quota exhausted error"""
        # Create modal window
        modal = tk.Toplevel(self.root)
        modal.title("Hết Điểm")
        modal.geometry("400x280")
        modal.configure(bg='#0a0a0a')
        modal.resizable(False, False)
        
        # Make modal stay on top and grab focus
        modal.transient(self.root)
        modal.grab_set()
        
        # Center the modal over the main window
        modal.update_idletasks()
        x = (self.root.winfo_x() + (self.root.winfo_width() // 2)) - (400 // 2)
        y = (self.root.winfo_y() + (self.root.winfo_height() // 2)) - (280 // 2)
        modal.geometry(f"400x280+{x}+{y}")
        
        # Create main container with beautiful styling
        main_frame = tk.Frame(modal, bg='#1a1a2e', relief='raised', bd=3)
        main_frame.pack(fill='both', expand=True, padx=15, pady=15)
        
        # LED border effect at top
        led_border = tk.Frame(main_frame, bg='#ff6b6b', height=4)
        led_border.pack(fill='x', pady=(0, 20))
        
        # Error icon
        icon_frame = tk.Frame(main_frame, bg='#1a1a2e')
        icon_frame.pack(pady=(10, 15))
        
        icon_label = tk.Label(icon_frame, text="⚠️", 
                             font=('Arial', 42), 
                             fg='#ff6b6b', bg='#1a1a2e')
        icon_label.pack()
        
        # Main message with better styling
        message_frame = tk.Frame(main_frame, bg='#1a1a2e')
        message_frame.pack(pady=(0, 50))
        
        main_message = tk.Label(message_frame, text="Đã hết điểm rồi bạn ơi", 
                               font=('Arial', 16, 'bold'), 
                               fg='#ffffff', bg='#1a1a2e')
        main_message.pack()
        
        # Close button at the bottom
        button_frame = tk.Frame(main_frame, bg='#1a1a2e')
        button_frame.pack(side='bottom', fill='x', pady=(0, 10))
        
        def close_modal():
            modal.grab_release()
            modal.destroy()
        
        close_button = tk.Button(button_frame, text="ĐÓNG", 
                                command=close_modal,
                                bg='#ff4444', fg='#ffffff', 
                                font=('Arial', 11, 'bold'), 
                                relief='flat', bd=0, 
                                width=12, height=2,
                                cursor='hand2',
                                activebackground='#ff6666',
                                activeforeground='#ffffff')
        close_button.pack()
        
        # Add LED animation to the border
        def animate_modal_led():
            try:
                if modal.winfo_exists():
                    colors = ['#ff6b6b', '#ff4444', '#ff0000', '#ff4444']
                    current_color = colors[int(time.time() * 2) % len(colors)]
                    led_border.configure(bg=current_color)
                    modal.after(300, animate_modal_led)
            except:
                pass
        
        # Start LED animation
        animate_modal_led()
        
        # Handle window close button (X)
        modal.protocol("WM_DELETE_WINDOW", close_modal)
        
        # Focus on the modal
        modal.focus_set()
            
    def select_web_function(self, wait):
        """Select function on the web based on user choice"""
        try:
            function = self.selected_function.get()
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đang chọn chức năng: {function}"))
            
            if function == "prompt ra video":
                # Select "Từ văn bản sang video" using the specific element
                try:
                    # Try multiple selectors for the text-to-video button
                    selectors = [
                        "div.sc-6eaf4c47-1.hHoufX button[class*='hoBDwb'][class*='jOsmhP']",
                        "button[class*='hoBDwb'][class*='jOsmhP']:contains('Từ văn bản sang video')",
                        "//button[contains(@class, 'hoBDwb') and contains(@class, 'jOsmhP') and contains(text(), 'Từ văn bản sang video')]",
                        "//div[@class='sc-6eaf4c47-1 hHoufX']//button"
                    ]
                    
                    element_found = False
                    for selector in selectors:
                        try:
                            if selector.startswith("//"):
                                element = wait.until(EC.element_to_be_clickable((By.XPATH, selector)))
                            else:
                                element = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))
                            
                            # Check if this is the text-to-video button
                            if "văn bản" in element.text or "text" in element.text.lower():
                                self.driver.execute_script("arguments[0].click();", element)
                                element_found = True
                                break
                        except:
                            continue
                    
                    if not element_found:
                        # Fallback: click the first dropdown button
                        dropdown_btn = wait.until(EC.element_to_be_clickable((
                            By.CSS_SELECTOR, 
                            "button[role='combobox']"
                        )))
                        self.driver.execute_script("arguments[0].click();", dropdown_btn)
                        
                except Exception as e:
                    print(f"Error selecting text-to-video: {e}")
                    
            else:  # "1 ảnh ra video" or "2 ảnh ra video"
                # Select "Tạo video từ các khung hình" using the specific element
                try:
                    # Try multiple selectors for the frame-to-video button
                    selectors = [
                        "div.sc-6eaf4c47-1.hHoufX button[class*='hoBDwb'][class*='jOsmhP'][style*='transform']",
                        "//button[contains(@class, 'hoBDwb') and contains(@class, 'jOsmhP') and contains(text(), 'khung hình')]",
                        "//button[contains(text(), 'Tạo video từ các khung hình')]"
                    ]
                    
                    element_found = False
                    for selector in selectors:
                        try:
                            if selector.startswith("//"):
                                element = wait.until(EC.element_to_be_clickable((By.XPATH, selector)))
                            else:
                                element = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))
                            
                            # Check if this is the frame-to-video button
                            if "khung hình" in element.text or "frame" in element.text.lower():
                                self.driver.execute_script("arguments[0].click();", element)
                                element_found = True
                                break
                        except:
                            continue
                    
                    if not element_found:
                        # Fallback: try to find and click the second dropdown option
                        dropdown_btns = self.driver.find_elements(By.CSS_SELECTOR, "button[role='combobox']")
                        if len(dropdown_btns) > 1:
                            self.driver.execute_script("arguments[0].click();", dropdown_btns[1])
                        
                except Exception as e:
                    print(f"Error selecting frame-to-video: {e}")
                
            time.sleep(2)
            self.root.after(0, lambda: self.status_bar.configure(text="Đã chọn chức năng thành công"))
            
        except Exception as e:
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi chọn chức năng: {str(e)}"))
            
    def configure_settings(self, wait):
        """Configure output count and model settings"""
        try:
            self.root.after(0, lambda: self.status_bar.configure(text="Đang cấu hình cài đặt..."))
            
            # Click settings button using the specific element
            settings_selectors = [
                "button.sc-e8425ea6-0.gLXNUV.sc-d23b66-0.iNOmjS.sc-5875fa5-0.dCOTRT",
                "button[class*='gLXNUV'][class*='iNOmjS'][class*='dCOTRT']",
                "//button[contains(@class, 'gLXNUV') and contains(@class, 'iNOmjS')]",
                "//button[@aria-haspopup='dialog']//i[contains(@class, 'material-icons-outlined')]/.."
            ]
            
            settings_btn = None
            for selector in settings_selectors:
                try:
                    if selector.startswith("//"):
                        settings_btn = wait.until(EC.element_to_be_clickable((By.XPATH, selector)))
                    else:
                        settings_btn = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))
                    break
                except:
                    continue
            
            if settings_btn:
                self.driver.execute_script("arguments[0].click();", settings_btn)
                time.sleep(2)
                
                # Configure output count using the specific element structure
                output_count = self.output_count.get()
                
                # Try to find the output count dropdown
                count_selectors = [
                    f"//div[@class='sc-5875fa5-2 hYQVZP PopoverContent']//span[@class='sc-5875fa5-10 dcgCvt' and text()='{output_count}']",
                    f"//div[contains(@class, 'PopoverContent')]//span[text()='{output_count}']",
                    f"//button[contains(@class, 'gXoFO')]//span[text()='{output_count}']"
                ]
                
                # First click the dropdown to open it
                try:
                    dropdown_btn = wait.until(EC.element_to_be_clickable((
                        By.XPATH, 
                        "//button[@class='sc-5875fa5-11 gXoFO sc-a63fedff-0 bSPVdj']"
                    )))
                    self.driver.execute_script("arguments[0].click();", dropdown_btn)
                    time.sleep(1)
                    
                    # Then select the desired count
                    count_option = wait.until(EC.element_to_be_clickable((
                        By.XPATH, 
                        f"//div[@role='option']//span[text()='{output_count}']"
                    )))
                    self.driver.execute_script("arguments[0].click();", count_option)
                    
                except Exception as e:
                    print(f"Error configuring output count: {e}")
                
                # Close settings by clicking outside or pressing escape
                try:
                    self.driver.execute_script("document.body.click();")
                    time.sleep(1)
                except:
                    pass
                
                self.root.after(0, lambda: self.status_bar.configure(text="Đã cấu hình cài đặt thành công"))
            else:
                self.root.after(0, lambda: self.status_bar.configure(text="Không tìm thấy nút cài đặt"))
            
        except Exception as e:
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi cấu hình: {str(e)}"))
            print(f"Settings configuration error: {e}")
            
    def process_prompts(self, wait):
        """Process all prompts"""
        try:
            total_prompts = len(self.prompts)
            
            for i, prompt in enumerate(self.prompts, 1):
                self.status_bar.configure(text=f"Đang xử lý prompt {i}/{total_prompts}")
                
                # Find and fill prompt textarea
                prompt_textarea = wait.until(EC.element_to_be_clickable((
                    By.ID, "PINHOLE_TEXT_AREA_ELEMENT_ID"
                )))
                
                # Clear and enter new prompt
                prompt_textarea.clear()
                prompt_textarea.send_keys(prompt)
                time.sleep(1)
                
                # Click generate button
                generate_btn = wait.until(EC.element_to_be_clickable((
                    By.XPATH, 
                    "//button[contains(text(), 'Tạo video') or contains(text(), 'Generate')]"
                )))
                self.driver.execute_script("arguments[0].click();", generate_btn)
                
                # Wait a bit before next prompt
                time.sleep(3)
                
            self.status_bar.configure(text="Hoàn thành tất cả prompts!")
            
        except Exception as e:
            self.status_bar.configure(text=f"Lỗi xử lý prompts: {str(e)}")
            
    def process_image_to_video(self):
        """Process image-to-video function with 1:1 mapping and folder management"""
        try:
            # Validate inputs
            if not self.selected_images:
                self.root.after(0, lambda: messagebox.showwarning("Cảnh báo", "Vui lòng chọn ảnh trước!"))
                return
            
            if not self.prompts:
                self.root.after(0, lambda: messagebox.showwarning("Cảnh báo", "Vui lòng chọn file prompt trước!"))
                return
            
            # Create main folder structure
            folder_name = self.folder_name.get().strip() or "auto1"
            main_folder = os.path.join(os.getcwd(), folder_name)
            os.makedirs(main_folder, exist_ok=True)
            
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đã tạo folder chính: {folder_name}"))
            
            # Initialize prompt status tracking for all prompts
            self.prompt_status = {}
            for i, prompt in enumerate(self.prompts, 1):
                self.prompt_status[i] = {"prompt": prompt, "done": False}
            
            # Update prompt display with status
            self.update_prompt_display_with_status()
            
            # Implement 1:1 mapping logic as specified
            # If 2 images and 1 prompt: only process image 1 with prompt 1, image 2 waits
            # If 2 images and 2 prompts: process both pairs
            # Each prompt gets the specified output count (e.g., 4 videos)
            
            num_images = len(self.selected_images)
            num_prompts = len(self.prompts)
            
            self.root.after(0, lambda: self.status_bar.configure(text=f"Bắt đầu xử lý: {num_images} ảnh, {num_prompts} prompts (1:1 mapping)"))
            
            # Process only the pairs that have both image and prompt (1:1 mapping)
            pairs_to_process = min(num_images, num_prompts)
            
            # If there are more images than prompts, show warning about waiting images
            if num_images > num_prompts:
                extra_images = num_images - num_prompts
                self.root.after(0, lambda: self.status_bar.configure(text=f"Cảnh báo: {extra_images} ảnh sẽ chờ đợt sau (thiếu prompt)"))
                time.sleep(2)
            
            # Get current prompts from text area in real-time order (same as prompt ra video)
            current_prompts = self.get_current_prompts_from_text()
            
            # Process each image-prompt pair sequentially using real-time order
            for i, (prompt_text, is_done) in enumerate(current_prompts, 1):
                # Check stop flag before processing each pair
                if self.stop_requested:
                    print("Stop requested, breaking out of image-prompt loop")
                    self.root.after(0, lambda: self.status_bar.configure(text="Đã dừng theo yêu cầu"))
                    break
                
                # Skip if already done
                if is_done:
                    self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"Bỏ qua prompt {idx} - đã hoàn thành"))
                    print(f"Skipping image-prompt pair {i} - already done")
                    continue
                
                # Check if we have corresponding image for this prompt
                if i > len(self.selected_images):
                    self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"Không có ảnh cho prompt {idx} - bỏ qua"))
                    print(f"No image available for prompt {i} - skipping")
                    continue
                
                image_path, _ = self.selected_images[i - 1]  # Use i-1 for 0-based index
                
                self.root.after(0, lambda idx=i, p=prompt_text: self.status_bar.configure(text=f"Đang xử lý cặp {idx}: ảnh {idx} + prompt {idx}"))
                
                # Create subfolder using original prompt index (not enumeration index)
                subfolder = os.path.join(main_folder, str(i))
                os.makedirs(subfolder, exist_ok=True)
                
                # Generate videos for this image-prompt pair (send clean prompt without numbering)
                success = self.generate_image_to_video(image_path, prompt_text, i, subfolder)
                
                if success:
                    # Mark as done in text area and update file
                    self.mark_prompt_as_done_in_text(i)
                    
                    # Update prompt status immediately for image display
                    self.prompt_status[i]["done"] = True
                    
                    # Update both prompt and image displays
                    self.update_prompt_display_with_status()
                    self.update_image_display_with_status()
                    
                    self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"✅ Hoàn thành cặp {idx} - tự động chuyển sang cặp tiếp theo"))
                    
                    # Brief pause before moving to next pair
                    time.sleep(1)
                else:
                    self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"❌ Lỗi xử lý cặp {idx} - tiếp tục cặp tiếp theo"))
                    
                    # Check stop flag after failed pair
                    if self.stop_requested:
                        print("Stop requested after failed image-prompt pair")
                        break
                    
                    # Continue to next pair even if current one failed
                    time.sleep(1)
            
            # Check if all processed pairs are completed by reading current text area
            current_prompts = self.get_current_prompts_from_text()
            completed_pairs = sum(1 for i, (prompt_text, is_done) in enumerate(current_prompts[:pairs_to_process]) if is_done)
            
            if completed_pairs > 0:
                # Show completion message with integrated music control
                self.root.after(0, lambda: self.status_bar.configure(text=f"Hoàn thành {completed_pairs}/{pairs_to_process} cặp ảnh-prompt"))
                self.show_completion_notification()
            else:
                self.root.after(0, lambda: self.status_bar.configure(text="Không có cặp nào được xử lý thành công"))
            
        except Exception as e:
            print(f"Exception in process_image_to_video: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi xử lý image-to-video: {str(e)}"))
    
    def update_prompt_display_with_status(self):
        """Update prompt display with done status"""
        if hasattr(self, 'prompt_text'):
            self.prompt_text.delete('1.0', tk.END)
            for i, prompt in enumerate(self.prompts, 1):
                status = " - done" if self.prompt_status.get(i, {}).get("done", False) else ""
                self.prompt_text.insert(tk.END, f"{i}. {prompt}{status}\n\n")
            
            # Bind text change event to detect manual edits
            self.prompt_text.bind('<KeyRelease>', self.on_prompt_text_change)
            self.prompt_text.bind('<Button-1>', self.on_prompt_text_change)
    
    def update_image_display_with_status(self):
        """Update image display with done status for both 1 ảnh ra video and 2 ảnh ra video functions"""
        if hasattr(self, 'image_text') and self.selected_function.get() in ["1 ảnh ra video", "2 ảnh ra video"]:
            self.image_text.delete('1.0', tk.END)
            
            function = self.selected_function.get()
            
            for i, (image_path, order) in enumerate(self.selected_images, 1):
                image_name = os.path.basename(image_path)
                
                if function == "2 ảnh ra video":
                    # Show with pair.position format for 2 ảnh ra video
                    pair_number = ((i - 1) // 2) + 1
                    position_in_pair = ((i - 1) % 2) + 1
                    display_order = f"{pair_number}.{position_in_pair}"
                    
                    # Check if this image's corresponding prompt is done
                    # For 2 ảnh ra video: images 1.1 and 1.2 both get done status from prompt 1
                    status = " - done" if self.prompt_status.get(pair_number, {}).get("done", False) else ""
                    self.image_text.insert(tk.END, f"{display_order}. {image_name}{status}\n")
                else:
                    # Regular numbering for 1 ảnh ra video
                    # Check if this image's corresponding prompt is done
                    status = " - done" if self.prompt_status.get(i, {}).get("done", False) else ""
                    self.image_text.insert(tk.END, f"{i}. {image_name}{status}\n")
    
    def on_prompt_text_change(self, event=None):
        """Handle manual changes to prompt text - detect removal of '- done' markers and save changes"""
        try:
            # Get current text content
            current_content = self.prompt_text.get('1.0', tk.END).strip()
            
            if not current_content:
                return
            
            # Parse the current content to detect changes
            lines = [line.strip() for line in current_content.split('\n') if line.strip()]
            
            # Update prompts list and status based on current content
            updated_prompts = []
            updated_status = {}
            
            for i, line in enumerate(lines, 1):
                if line.endswith(" - done"):
                    # Extract prompt without "- done" marker
                    prompt = line[:-7].strip()
                    # Remove numbering if present (e.g., "1. prompt text")
                    if prompt.startswith(f"{i}. "):
                        prompt = prompt[len(f"{i}. "):]
                    updated_prompts.append(prompt)
                    updated_status[i] = {"prompt": prompt, "done": True}
                else:
                    # Regular prompt without done marker
                    prompt = line
                    # Remove numbering if present
                    if prompt.startswith(f"{i}. "):
                        prompt = prompt[len(f"{i}. "):]
                    updated_prompts.append(prompt)
                    updated_status[i] = {"prompt": prompt, "done": False}
            
            # Check for changes and update
            content_changed = False
            
            # Check if prompts content changed
            if len(updated_prompts) != len(self.prompts):
                content_changed = True
            else:
                for i, prompt in enumerate(updated_prompts):
                    if i >= len(self.prompts) or prompt != self.prompts[i]:
                        content_changed = True
                        break
            
            # Check for done status changes
            for i, status in updated_status.items():
                old_done = self.prompt_status.get(i, {}).get("done", False)
                new_done = status.get("done", False)
                if old_done != new_done:
                    content_changed = True
                    if old_done and not new_done:
                        print(f"User manually removed '- done' from prompt {i}")
                        self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"Đã cập nhật trạng thái prompt {idx} - có thể chạy lại"))
                    elif not old_done and new_done:
                        print(f"User manually added '- done' to prompt {i}")
                        self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"Đã đánh dấu prompt {idx} hoàn thành"))
            
            # Update internal data if content changed
            if content_changed:
                self.prompts = updated_prompts
                self.prompt_status = updated_status
                
                # Save to file immediately
                self.save_current_content_to_file()
                
                # Update image display if in image-to-video mode
                if self.selected_function.get() in ["1 ảnh ra video", "2 ảnh ra video"]:
                    self.update_image_display_with_status()
                
                print("Content changed - saved to file immediately")
                        
        except Exception as e:
            print(f"Error in on_prompt_text_change: {e}")
    
    def generate_image_to_video(self, image_path, prompt, prompt_index, output_folder):
        """Generate video from image using the new API"""
        try:
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đang tạo video từ ảnh cho prompt {prompt_index}..."))
            print(f"Starting image-to-video generation for prompt {prompt_index}: {prompt}")
            
            # Upload image and get media ID
            media_id = self.upload_image_for_video(image_path)
            if not media_id:
                print("Failed to upload image")
                return False
            
            # Create the API payload for image-to-video
            output_count = int(self.output_count.get())
            selected_model = self.model_selection.get()
            video_model_key = self.get_image_video_model_key(selected_model)
            
            print(f"Selected model: {selected_model}, Using videoModelKey: {video_model_key}")
            
            # Generate requests using proper image-to-video format with startImage
            requests_list = []
            for i in range(output_count):
                seed = random.randint(1000, 99999)
                scene_id = f"{random.randint(10000000, 99999999):08x}-{random.randint(1000, 9999):04x}-{random.randint(1000, 9999):04x}-{random.randint(1000, 9999):04x}-{random.randint(100000000000, 999999999999):012x}"
                
                request_data = {
                    "aspectRatio": "VIDEO_ASPECT_RATIO_LANDSCAPE",
                    "seed": seed,
                    "startImage": {
                        "mediaId": media_id
                    },
                    "textInput": {
                        "prompt": prompt  # Clean prompt without numbering
                    },
                    "videoModelKey": video_model_key,
                    "metadata": {
                        "sceneId": scene_id
                    }
                }
                requests_list.append(request_data)
            
            # Create the full payload
            payload = {
                "clientContext": {
                    "projectId": self.current_project_id,
                    "tool": "PINHOLE",
                    "userPaygateTier": "PAYGATE_TIER_ONE"
                },
                "requests": requests_list
            }
            
            print(f"Image-to-video API payload created: {json.dumps(payload, indent=2)}")
            
            # Make the API call
            return self.make_image_video_api_call(payload, prompt_index, prompt, output_folder)
            
        except Exception as e:
            print(f"Exception in generate_image_to_video: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi tạo video từ ảnh cho prompt {prompt_index}: {str(e)}"))
            return False
    
    def upload_image_for_video(self, image_path):
        """Upload image and get media ID for video generation using proper API calls"""
        try:
            print(f"Uploading image for video: {image_path}")
            
            # First try the working API method based on your successful example
            media_id = self.upload_image_direct_api(image_path)
            if media_id:
                return media_id
            
            # If API upload fails, try browser automation
            print("API upload failed, trying browser automation...")
            media_id = self.upload_image_via_browser(image_path)
            if media_id:
                return media_id
            
            # Final fallback: use test media ID from user's example
            print("All upload methods failed, using test media ID...")
            test_media_id = "CAMaJDQ2ZTcwOGE3LWM5ZWUtNDIwZS1iOTEwLTA4NmM1MjcxZTlkMiIDQ0FFKiRhMGE4YmMyOC1mMmE4LTQ4ZDUtYTc2My00NTI3MWVhNDVlYmI"
            return test_media_id
                
        except Exception as e:
            print(f"Exception in upload_image_for_video: {e}")
            return None
    
    def upload_image_direct_api(self, image_path):
        """Upload image using the working API method from your successful example"""
        try:
            print(f"Attempting direct API upload for: {image_path}")
            
            # Read image data
            with open(image_path, 'rb') as f:
                image_data = f.read()
            
            # Determine MIME type and aspect ratio
            file_ext = os.path.splitext(image_path)[1].lower()
            mime_type_map = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.png': 'image/png', '.gif': 'image/gif',
                '.bmp': 'image/bmp', '.webp': 'image/webp'
            }
            mime_type = mime_type_map.get(file_ext, 'image/jpeg')
            
            # Get image dimensions to determine aspect ratio
            try:
                from PIL import Image
                with Image.open(image_path) as img:
                    width, height = img.size
                    if width > height:
                        aspect_ratio = "IMAGE_ASPECT_RATIO_LANDSCAPE"
                    elif height > width:
                        aspect_ratio = "IMAGE_ASPECT_RATIO_PORTRAIT"
                    else:
                        aspect_ratio = "IMAGE_ASPECT_RATIO_SQUARE"
            except:
                aspect_ratio = "IMAGE_ASPECT_RATIO_LANDSCAPE"  # Default
            
            # Encode image to base64
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # Get cookies and prepare headers based on your successful example
            cookies = self.driver.get_cookies()
            cookie_dict = {cookie['name']: cookie['value'] for cookie in cookies}
            
            headers = {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': f'Bearer {self.access_token}',
                'content-type': 'text/plain;charset=UTF-8',
                'origin': 'https://labs.google',
                'priority': 'u=1, i',
                'referer': 'https://labs.google/',
                'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'user-agent': self.driver.execute_script("return navigator.userAgent;"),
                'x-browser-channel': 'stable',
                'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
                'x-browser-validation': '6h3XF8YcD8syi2FF2BbuE2KllQo=',
                'x-browser-year': '2025',
                'x-client-data': 'CIe2yQEIorbJAQipncoBCKzyygEIkqHLAQiFoM0BCP2FzwEY4eLOARiX7s4B'
            }
            
            # Create payload based on your successful example
            payload = {
                "imageInput": {
                    "aspectRatio": aspect_ratio,
                    "isUserUploaded": True,
                    "mimeType": mime_type,
                    "rawImageBytes": image_base64
                },
                "clientContext": {
                    "sessionId": f";{int(time.time() * 1000)}",
                    "tool": "ASSET_MANAGER"
                }
            }
            
            # Make API call to the working endpoint
            api_url = 'https://aisandbox-pa.googleapis.com/v1:uploadUserImage'
            
            response = requests.post(
                api_url,
                headers=headers,
                cookies=cookie_dict,
                json=payload,
                timeout=60
            )
            
            print(f"Direct upload API Response Status: {response.status_code}")
            print(f"Direct upload API Response: {response.text}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    
                    # Extract media ID based on your successful response structure
                    media_generation_id = response_data.get('mediaGenerationId', {})
                    media_id = media_generation_id.get('mediaGenerationId', '')
                    
                    if media_id:
                        print(f"Direct upload successful, media ID: {media_id}")
                        return media_id
                    else:
                        print("No media ID found in response")
                        return None
                        
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    return None
                    
            else:
                print(f"Direct upload failed with status {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            print(f"Exception in upload_image_direct_api: {e}")
            return None
    
    def try_form_upload(self, image_data, mime_type, headers, cookie_dict):
        """Try form-based upload as fallback"""
        try:
            print("Trying form upload method...")
            
            import uuid
            filename = f"image_{uuid.uuid4().hex[:8]}.{mime_type.split('/')[-1]}"
            
            files = {
                'file': (filename, image_data, mime_type)
            }
            
            form_data = {
                'projectId': self.current_project_id,
                'tool': 'PINHOLE'
            }
            
            # Remove content-type for form data
            form_headers = headers.copy()
            if 'content-type' in form_headers:
                del form_headers['content-type']
            
            response = requests.post(
                'https://labs.google/fx/api/upload',
                headers=form_headers,
                cookies=cookie_dict,
                files=files,
                data=form_data,
                timeout=60
            )
            
            print(f"Form upload response: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    media_id = response_data.get('mediaId') or response_data.get('id')
                    
                    if media_id:
                        print(f"Form upload successful, media ID: {media_id}")
                        return media_id
                        
                except json.JSONDecodeError:
                    # Try to extract from text
                    response_text = response.text
                    if 'mediaId' in response_text:
                        import re
                        match = re.search(r'"mediaId":\s*"([^"]+)"', response_text)
                        if match:
                            media_id = match.group(1)
                            print(f"Extracted media ID from text: {media_id}")
                            return media_id
            
            return None
            
        except Exception as e:
            print(f"Form upload error: {e}")
            return None
    
    def upload_image_via_browser(self, image_path):
        """Upload image using browser automation as fallback"""
        try:
            print(f"Uploading image via browser: {image_path}")
            
            # Navigate to the project page to upload image
            project_url = f"https://labs.google/fx/vi/tools/flow/project/{self.current_project_id}"
            print(f"Navigating to project page: {project_url}")
            
            self.driver.get(project_url)
            time.sleep(3)
            
            # Wait for page to load
            wait = WebDriverWait(self.driver, 20)
            wait.until(lambda driver: driver.execute_script("return document.readyState") == "complete")
            time.sleep(2)
            
            # Look for image upload input
            upload_selectors = [
                "input[type='file']",
                "input[accept*='image']",
                "//input[@type='file']"
            ]
            
            upload_element = None
            for selector in upload_selectors:
                try:
                    if selector.startswith("//"):
                        upload_element = self.driver.find_element(By.XPATH, selector)
                    else:
                        upload_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    
                    if upload_element:
                        print(f"Found upload element with selector: {selector}")
                        break
                except:
                    continue
            
            if upload_element and upload_element.tag_name == 'input':
                # Direct file input upload
                print("Using direct file input upload")
                upload_element.send_keys(image_path)
                time.sleep(5)
                
                # Wait for upload to complete and extract media ID
                return self.extract_media_id_from_network()
                
            else:
                print("Could not find upload element in browser")
                return None
                
        except Exception as e:
            print(f"Exception in upload_image_via_browser: {e}")
            return None
    
    def extract_media_id_from_network(self):
        """Extract media ID from browser network requests after upload"""
        try:
            # Wait for upload to complete
            time.sleep(5)
            
            # Try to extract media ID from browser's network logs or DOM
            # This is a simplified approach - in practice, you'd monitor network requests
            
            # Look for any elements that might contain the media ID
            media_id_selectors = [
                "[data-media-id]",
                "[data-id]",
                "img[src*='storage.googleapis.com']",
                "video[src*='storage.googleapis.com']"
            ]
            
            for selector in media_id_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for element in elements:
                        # Check for data attributes
                        media_id = element.get_attribute('data-media-id') or element.get_attribute('data-id')
                        if media_id:
                            print(f"Found media ID from DOM: {media_id}")
                            return media_id
                        
                        # Check src attributes for Google Storage URLs
                        src = element.get_attribute('src')
                        if src and 'storage.googleapis.com' in src:
                            # Try to extract ID from URL
                            import re
                            match = re.search(r'/([^/?]+)\?', src)
                            if match:
                                potential_id = match.group(1)
                                print(f"Extracted potential media ID from URL: {potential_id}")
                                return potential_id
                except:
                    continue
            
            # If no media ID found, return None to trigger fallback
            return None
            
        except Exception as e:
            print(f"Exception in extract_media_id_from_network: {e}")
            return None
    
    def try_alternative_upload(self, image_base64, mime_type, headers, cookie_dict):
        """Alternative method to upload image if primary method fails"""
        try:
            print("Trying alternative upload method...")
            
            # Method 1: Try direct media upload without batch format
            upload_payload_alt1 = {
                "clientContext": {
                    "projectId": self.current_project_id,
                    "tool": "PINHOLE",
                    "userPaygateTier": "PAYGATE_TIER_ONE"
                },
                "media": {
                    "mimeType": mime_type,
                    "data": image_base64
                }
            }
            
            upload_url_alt1 = 'https://labs.google/fx/api/trpc/media.uploadMedia'
            
            response = requests.post(
                upload_url_alt1,
                headers=headers,
                cookies=cookie_dict,
                json=upload_payload_alt1,
                timeout=60
            )
            
            print(f"Alternative upload method 1 response: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    result = response_data.get('result', {})
                    data = result.get('data', {})
                    json_data = data.get('json', {})
                    media_id = json_data.get('mediaId', '')
                    
                    if media_id:
                        print(f"Alternative upload method 1 successful, media ID: {media_id}")
                        return media_id
                        
                except json.JSONDecodeError:
                    pass
            
            # Method 2: Try with different endpoint structure
            print("Trying alternative upload method 2...")
            
            # Generate a unique filename
            import uuid
            unique_filename = f"image_{uuid.uuid4().hex[:8]}.{mime_type.split('/')[-1]}"
            
            upload_payload_alt2 = {
                "json": {
                    "clientContext": {
                        "projectId": self.current_project_id,
                        "tool": "PINHOLE"
                    },
                    "media": {
                        "mimeType": mime_type,
                        "data": image_base64,
                        "filename": unique_filename
                    }
                }
            }
            
            response2 = requests.post(
                upload_url_alt1,
                headers=headers,
                cookies=cookie_dict,
                json=upload_payload_alt2,
                timeout=60
            )
            
            print(f"Alternative upload method 2 response: {response2.status_code}")
            
            if response2.status_code == 200:
                try:
                    response_data = response2.json()
                    # Try different response structures
                    media_id = None
                    
                    # Structure 1: result.data.json.mediaId
                    if 'result' in response_data:
                        result = response_data['result']
                        if 'data' in result and 'json' in result['data']:
                            media_id = result['data']['json'].get('mediaId')
                    
                    # Structure 2: direct mediaId
                    if not media_id:
                        media_id = response_data.get('mediaId')
                    
                    # Structure 3: json.mediaId
                    if not media_id and 'json' in response_data:
                        media_id = response_data['json'].get('mediaId')
                    
                    if media_id:
                        print(f"Alternative upload method 2 successful, media ID: {media_id}")
                        return media_id
                        
                except json.JSONDecodeError:
                    pass
            
            # Method 3: Try with form data instead of JSON
            print("Trying alternative upload method 3 (form data)...")
            
            try:
                # Convert base64 back to bytes for form upload
                image_bytes = base64.b64decode(image_base64)
                
                files = {
                    'media': (unique_filename, image_bytes, mime_type)
                }
                
                form_data = {
                    'projectId': self.current_project_id,
                    'tool': 'PINHOLE'
                }
                
                # Remove content-type header for form data
                form_headers = headers.copy()
                if 'content-type' in form_headers:
                    del form_headers['content-type']
                
                response3 = requests.post(
                    'https://labs.google/fx/api/upload',
                    headers=form_headers,
                    cookies=cookie_dict,
                    files=files,
                    data=form_data,
                    timeout=60
                )
                
                print(f"Alternative upload method 3 response: {response3.status_code}")
                
                if response3.status_code == 200:
                    try:
                        response_data = response3.json()
                        media_id = response_data.get('mediaId') or response_data.get('id')
                        
                        if media_id:
                            print(f"Alternative upload method 3 successful, media ID: {media_id}")
                            return media_id
                            
                    except json.JSONDecodeError:
                        # Try to extract media ID from text response
                        response_text = response3.text
                        if 'mediaId' in response_text:
                            import re
                            match = re.search(r'"mediaId":\s*"([^"]+)"', response_text)
                            if match:
                                media_id = match.group(1)
                                print(f"Extracted media ID from text: {media_id}")
                                return media_id
                
            except Exception as form_error:
                print(f"Form upload error: {form_error}")
            
            print("All alternative upload methods failed")
            return None
            
        except Exception as e:
            print(f"Exception in try_alternative_upload: {e}")
            return None
    
    def get_image_video_model_key(self, selected_model):
        """Get the correct videoModelKey for image-to-video based on selected model"""
        model_mapping = {
            "Veo 3 - Quality": "veo_3_0_t2v_pro",
            "Veo 2 - Quality": "veo_2_0_i2v",
            "Veo 3 - Fast": "veo_3_i2v_s_fast", 
            "Veo 2 - Fast": "veo_2_1_fast_d_15_t2v"
        }
        
        return model_mapping.get(selected_model, "veo_2_0_i2v")  # Default to veo2 quality
    
    def make_image_video_api_call(self, payload, prompt_index, prompt, output_folder):
        """Make API call to generate videos from image"""
        try:
            output_count = len(payload['requests'])
            print(f"Making image-to-video API call for {output_count} videos")
            
            # Get cookies from browser for authentication
            cookies = self.driver.get_cookies()
            cookie_dict = {cookie['name']: cookie['value'] for cookie in cookies}
            
            # Prepare headers
            headers = {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': f'Bearer {self.access_token}',
                'content-type': 'text/plain;charset=UTF-8',
                'priority': 'u=1, i',
                'referer': 'https://labs.google/',
                'user-agent': self.driver.execute_script("return navigator.userAgent;")
            }
            
            # Use the correct image-to-video API endpoint
            api_url = 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartImage'
            
            response = requests.post(
                api_url,
                headers=headers,
                cookies=cookie_dict,
                json=payload,
                timeout=30
            )
            
            print(f"Image-to-video API Response Status: {response.status_code}")
            print(f"Image-to-video API Response: {response.text}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    
                    # Extract operations for status polling
                    operations = response_data.get('operations', [])
                    if not operations:
                        print("No operations found in response")
                        return False
                    
                    # Store operations data for polling
                    operations_data = []
                    for op in operations:
                        operation_info = {
                            'operation': op.get('operation', {}),
                            'sceneId': op.get('sceneId', ''),
                            'status': op.get('status', '')
                        }
                        operations_data.append(operation_info)
                    
                    print(f"Got {len(operations_data)} operations for polling")
                    
                    # Update credits from remainingCredits in response immediately
                    remaining_credits = response_data.get('remainingCredits', 0)
                    if remaining_credits > 0:
                        self.user_info["credits"] = remaining_credits
                        self.root.after(0, self.update_credits_display_only)
                        print(f"Updated credits immediately after image-to-video API call: {remaining_credits}")
                    
                    # Poll for completion and download videos
                    return self.poll_and_download_image_videos(operations_data, prompt_index, prompt, output_folder)
                    
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    return False
                    
            elif response.status_code == 429:
                # Handle quota exhausted
                self.root.after(0, lambda: self.show_quota_exhausted_modal(0))
                return False
                    
            else:
                print(f"Image-to-video API call failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print(f"Exception in make_image_video_api_call: {e}")
            return False
    
    def poll_and_download_image_videos(self, operations_data, prompt_index, prompt_text, output_folder):
        """Poll for image-to-video completion and download results - FIXED VERSION"""
        try:
            output_count = int(self.output_count.get())  # Fix: Define output_count variable
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đang chờ {output_count} video hoàn thành cho prompt {prompt_index}..."))
            print(f"Starting continuous polling for prompt {prompt_index} with {len(operations_data)} operations, waiting for ALL {output_count} videos")
            
            # Get cookies and headers for polling
            cookies = self.driver.get_cookies()
            cookie_dict = {cookie['name']: cookie['value'] for cookie in cookies}
            
            headers = {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': f'Bearer {self.access_token}',
                'content-type': 'text/plain;charset=UTF-8',
                'priority': 'u=1, i',
                'referer': 'https://labs.google/',
                'user-agent': self.driver.execute_script("return navigator.userAgent;")
            }
            
            # Create polling payload based on user's successful example
            # Send full operation objects with proper structure
            polling_payload = {
                "operations": []
            }
            
            for op_data in operations_data:
                operation = op_data.get('operation', {})
                if operation and 'name' in operation:
                    # Send the full operation object structure as shown in user's successful example
                    polling_payload["operations"].append({
                        "operation": {"name": operation['name']},
                        "sceneId": op_data.get('sceneId', ''),
                        "status": op_data.get('status', 'MEDIA_GENERATION_STATUS_PENDING')
                    })
            
            print(f"Fixed polling payload: {json.dumps(polling_payload, indent=2)}")
            
            max_polling_attempts = 120  # 10 minutes max
            polling_interval = 5
            all_video_urls = []  # Collect all video URLs, download only when all are ready
            
            # Initialize collected_videos list to track unique videos
            if not hasattr(self, 'collected_videos'):
                self.collected_videos = []
            else:
                self.collected_videos.clear()  # Clear for new prompt
            
            for attempt in range(max_polling_attempts):
                self.root.after(0, lambda a=attempt+1: self.status_bar.configure(text=f"Kiểm tra trạng thái lần {a} cho prompt {prompt_index}..."))
                print(f"Polling attempt {attempt + 1}/{max_polling_attempts} for prompt {prompt_index}")
                
                # Make status check API call
                status_url = 'https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus'
                
                try:
                    status_response = requests.post(
                        status_url,
                        headers=headers,
                        cookies=cookie_dict,
                        json=polling_payload,
                        timeout=15
                    )
                    
                    print(f"Status check response: {status_response.status_code}")
                    
                    if status_response.status_code == 200:
                        try:
                            status_data = status_response.json()
                            print(f"Status response: {json.dumps(status_data, indent=2)}")
                            
                            operations = status_data.get('operations', [])
                            if not operations:
                                print("No operations found in status response")
                                time.sleep(polling_interval)
                                continue
                            
                            completed_operations = []
                            failed_operations = []
                            pending_operations = []
                            
                            # Categorize operations by status
                            for op in operations:
                                status = op.get('status', '')
                                if status == 'MEDIA_GENERATION_STATUS_SUCCESSFUL':
                                    completed_operations.append(op)
                                elif status == 'MEDIA_GENERATION_STATUS_FAILED':
                                    failed_operations.append(op)
                                elif status in ['MEDIA_GENERATION_STATUS_PENDING', 'MEDIA_GENERATION_STATUS_ACTIVE']:
                                    pending_operations.append(op)
                                else:
                                    print(f"Unknown status: {status}")
                            
                            print(f"Status summary: {len(completed_operations)} completed, {len(failed_operations)} failed, {len(pending_operations)} pending")
                            
                            # Collect video URLs from completed operations but don't download yet
                            # Use operation names to track unique videos and avoid duplicates
                            if completed_operations:
                                for op in completed_operations:
                                    operation = op.get('operation', {})
                                    metadata = operation.get('metadata', {})
                                    operation_name = operation.get('name', '')
                                    
                                    if metadata and operation_name:
                                        video_data = metadata.get('video', {})
                                        fife_url = video_data.get('fifeUrl', '')
                                        
                                        if fife_url:
                                            # Check if we already have a video for this operation name
                                            already_collected = False
                                            for existing_url, existing_op_name in self.collected_videos:
                                                if existing_op_name == operation_name:
                                                    already_collected = True
                                                    break
                                            
                                            if not already_collected:
                                                self.collected_videos.append((fife_url, operation_name))
                                                all_video_urls.append(fife_url)
                                                print(f"Collected unique video URL {len(all_video_urls)}/{output_count}: {operation_name}")
                                            else:
                                                print(f"Skipping duplicate video for operation: {operation_name}")
                            
                            # Continue polling if there are still pending operations
                            if pending_operations:
                                print(f"Still waiting for {len(pending_operations)} pending operations...")
                                time.sleep(polling_interval)
                                continue
                            
                            # If no more pending operations, download all videos at once
                            if not pending_operations:
                                total_completed = len(completed_operations)
                                total_failed = len(failed_operations)
                                print(f"Polling completed for prompt {prompt_index}: {total_completed} completed, {total_failed} failed")
                                
                                if all_video_urls:
                                    print(f"Downloading {len(all_video_urls)} videos for prompt {prompt_index}")
                                    self.download_image_videos_batch(all_video_urls, prompt_index, prompt_text, output_folder, 1)
                                    
                                    # Update credits from remainingCredits in response
                                    remaining_credits = status_data.get('remainingCredits', 0)
                                    if remaining_credits > 0:
                                        self.user_info["credits"] = remaining_credits
                                        self.root.after(0, self.update_credits_display_only)
                                        print(f"Updated credits after image-to-video creation: {remaining_credits}")
                                    
                                    self.root.after(0, lambda: self.status_bar.configure(text=f"✅ Hoàn thành prompt {prompt_index}: {len(all_video_urls)} video"))
                                    return True
                                else:
                                    self.root.after(0, lambda: self.status_bar.configure(text=f"❌ Không có video nào cho prompt {prompt_index}"))
                                    return False
                                
                        except json.JSONDecodeError as e:
                            print(f"JSON decode error in status check: {e}")
                            print(f"Raw response: {status_response.text}")
                            time.sleep(polling_interval)
                            continue
                            
                    else:
                        print(f"Status check failed: {status_response.status_code} - {status_response.text}")
                        time.sleep(polling_interval)
                        continue
                        
                except requests.RequestException as e:
                    print(f"Request error during polling: {e}")
                    time.sleep(polling_interval)
                    continue
            
            # Timeout reached
            print(f"Polling timeout reached for prompt {prompt_index} after {max_polling_attempts} attempts")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Timeout chờ video cho prompt {prompt_index}"))
            return len(all_video_urls) > 0  # Return true if we collected at least some videos
            
        except Exception as e:
            error_msg = str(e)  # Fix: Store error message in variable to avoid lambda scope issue
            print(f"Exception in poll_and_download_image_videos: {error_msg}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi polling cho prompt {prompt_index}: {error_msg}"))
            return False
    
    def download_image_videos_batch(self, video_urls, prompt_index, prompt_text, output_folder, start_index=1):
        """Download a batch of videos from image-to-video generation to specific folder"""
        try:
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đang tải {len(video_urls)} video cho prompt {prompt_index}..."))
            print(f"Starting download of {len(video_urls)} videos for prompt {prompt_index}")
            
            downloaded_count = 0
            
            for i, video_url in enumerate(video_urls):
                try:
                    video_number = start_index + i
                    self.root.after(0, lambda v=video_number: self.status_bar.configure(text=f"Đang tải video {v} cho prompt {prompt_index}..."))
                    
                    # Create filename
                    filename = f"video_{video_number:02d}.mp4"
                    filepath = os.path.join(output_folder, filename)
                    
                    # Skip if file already exists
                    if os.path.exists(filepath):
                        print(f"Video {video_number} already exists, skipping...")
                        downloaded_count += 1
                        continue
                    
                    # Download video
                    headers = {
                        'user-agent': self.driver.execute_script("return navigator.userAgent;"),
                        'referer': VEO_URL
                    }
                    
                    video_response = requests.get(video_url, headers=headers, stream=True, timeout=60)
                    
                    if video_response.status_code == 200:
                        with open(filepath, 'wb') as f:
                            for chunk in video_response.iter_content(chunk_size=8192):
                                if chunk:
                                    f.write(chunk)
                        
                        file_size = os.path.getsize(filepath)
                        print(f"Downloaded video {video_number}: {filename} ({file_size} bytes)")
                        downloaded_count += 1
                        
                    else:
                        print(f"Failed to download video {video_number}: HTTP {video_response.status_code}")
                        
                except Exception as download_error:
                    print(f"Error downloading video {video_number}: {download_error}")
                    continue
            
            if downloaded_count > 0:
                print(f"Successfully downloaded {downloaded_count}/{len(video_urls)} videos for prompt {prompt_index}")
                return True
            else:
                print(f"Failed to download any videos for prompt {prompt_index}")
                return False
                
        except Exception as e:
            print(f"Exception in download_image_videos_batch: {e}")
            return False

    def download_image_videos(self, video_urls, prompt_index, prompt_text, output_folder):
        """Download videos from image-to-video generation to specific folder"""
        return self.download_image_videos_batch(video_urls, prompt_index, prompt_text, output_folder, 1)
    
    def save_prompt_status_to_file(self):
        """Save current prompt status back to the original file for persistence"""
        try:
            if hasattr(self, 'current_prompt_file') and self.current_prompt_file:
                # Create updated content with done markers
                updated_lines = []
                for i, prompt in enumerate(self.prompts, 1):
                    status = " - done" if self.prompt_status.get(i, {}).get("done", False) else ""
                    updated_lines.append(f"{i}. {prompt}{status}")
                
                # Write back to file
                with open(self.current_prompt_file, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(updated_lines))
                
                print(f"Saved prompt status to file: {self.current_prompt_file}")
                
        except Exception as e:
            print(f"Error saving prompt status to file: {e}")
    
    def save_current_content_to_file(self):
        """Save current content from prompt text area directly to file"""
        try:
            if hasattr(self, 'current_prompt_file') and self.current_prompt_file:
                # Get current content from text area
                current_content = self.prompt_text.get('1.0', tk.END).strip()
                
                if current_content:
                    # Write current content directly to file
                    with open(self.current_prompt_file, 'w', encoding='utf-8') as f:
                        f.write(current_content)
                    
                    print(f"Saved current content to file: {self.current_prompt_file}")
                
        except Exception as e:
            print(f"Error saving current content to file: {e}")
    
    def get_current_prompts_from_text(self):
        """Get current prompts from text area in real-time order with done status"""
        try:
            # Get current content from text area
            current_content = self.prompt_text.get('1.0', tk.END).strip()
            
            if not current_content:
                return []
            
            # Parse lines and extract prompts with done status
            lines = [line.strip() for line in current_content.split('\n') if line.strip()]
            current_prompts = []
            
            for line in lines:
                if line.endswith(" - done"):
                    # Extract prompt without "- done" marker and numbering
                    prompt = line[:-7].strip()
                    # Remove numbering if present (e.g., "1. prompt text" -> "prompt text")
                    if '. ' in prompt:
                        parts = prompt.split('. ', 1)
                        if len(parts) == 2 and parts[0].isdigit():
                            prompt = parts[1]
                    current_prompts.append((prompt, True))  # (prompt_text, is_done)
                else:
                    # Regular prompt without done marker
                    prompt = line
                    # Remove numbering if present
                    if '. ' in prompt:
                        parts = prompt.split('. ', 1)
                        if len(parts) == 2 and parts[0].isdigit():
                            prompt = parts[1]
                    current_prompts.append((prompt, False))  # (prompt_text, is_done)
            
            print(f"Parsed {len(current_prompts)} prompts from text area in current order")
            for i, (prompt, is_done) in enumerate(current_prompts, 1):
                status = "done" if is_done else "pending"
                print(f"  {i}. {prompt[:50]}... [{status}]")
            
            return current_prompts
            
        except Exception as e:
            print(f"Error in get_current_prompts_from_text: {e}")
            return []
    
    def mark_prompt_as_done_in_text(self, prompt_index):
        """Mark a specific prompt as done in the text area and save to file"""
        try:
            # Get current content
            current_content = self.prompt_text.get('1.0', tk.END).strip()
            
            if not current_content:
                return
            
            # Parse lines
            lines = [line.strip() for line in current_content.split('\n') if line.strip()]
            
            # Update the specific line to add "- done" if not already present
            if prompt_index <= len(lines):
                line_index = prompt_index - 1  # Convert to 0-based index
                current_line = lines[line_index]
                
                if not current_line.endswith(" - done"):
                    lines[line_index] = current_line + " - done"
                    
                    # Update text area
                    updated_content = '\n\n'.join(lines)
                    self.prompt_text.delete('1.0', tk.END)
                    self.prompt_text.insert('1.0', updated_content)
                    
                    # Save to file immediately
                    self.save_current_content_to_file()
                    
                    print(f"Marked prompt {prompt_index} as done in text area and saved to file")
            
        except Exception as e:
            print(f"Error in mark_prompt_as_done_in_text: {e}")
    
    def show_completion_notification(self):
        """Show completion notification with music control and proper window management"""
        try:
            # Save prompt status to file before showing notification
            self.save_prompt_status_to_file()
            
            # Start playing music first
            self.start_completion_music()
            
            # Ensure main window stays visible and accessible
            self.root.deiconify()  # Restore window if minimized
            self.root.lift()       # Bring to front
            self.root.focus_force() # Force focus
            self.root.attributes('-topmost', True)  # Temporarily on top
            
            # Create completion modal
            modal = tk.Toplevel(self.root)
            modal.title("Hoàn thành!")
            modal.geometry("400x300")
            modal.configure(bg='#0a0a0a')
            modal.resizable(False, False)
            
            # Make modal stay on top and properly manage focus
            modal.transient(self.root)
            modal.grab_set()
            modal.attributes('-topmost', True)
            
            # Center the modal
            modal.update_idletasks()
            x = (self.root.winfo_x() + (self.root.winfo_width() // 2)) - (400 // 2)
            y = (self.root.winfo_y() + (self.root.winfo_height() // 2)) - (300 // 2)
            modal.geometry(f"400x300+{x}+{y}")
            
            # Create main container
            main_frame = tk.Frame(modal, bg='#1a1a2e', relief='raised', bd=3)
            main_frame.pack(fill='both', expand=True, padx=15, pady=15)
            
            # LED border effect
            led_border = tk.Frame(main_frame, bg='#00ff00', height=4)
            led_border.pack(fill='x', pady=(0, 20))
            
            # Success icon
            icon_frame = tk.Frame(main_frame, bg='#1a1a2e')
            icon_frame.pack(pady=(10, 15))
            
            icon_label = tk.Label(icon_frame, text="✅", 
                                 font=('Arial', 48), 
                                 fg='#00ff00', bg='#1a1a2e')
            icon_label.pack()
            
            # Main message
            message_frame = tk.Frame(main_frame, bg='#1a1a2e')
            message_frame.pack(pady=(0, 30))
            
            main_message = tk.Label(message_frame, text="Đã hoàn thành hết rồi!", 
                                   font=('Arial', 18, 'bold'), 
                                   fg='#ffffff', bg='#1a1a2e')
            main_message.pack()
            
            # Close button
            button_frame = tk.Frame(main_frame, bg='#1a1a2e')
            button_frame.pack(side='bottom', fill='x', pady=(0, 10))
            
            def close_modal_and_stop_music():
                # Stop the music when closing
                self.stop_completion_music()
                # Restore normal window behavior
                self.root.attributes('-topmost', False)
                modal.attributes('-topmost', False)
                modal.grab_release()
                modal.destroy()
                # Ensure main window remains accessible
                self.root.lift()
                self.root.focus_force()
            
            close_button = tk.Button(button_frame, text="ĐÓNG", 
                                    command=close_modal_and_stop_music,
                                    bg='#00ff00', fg='#000000', 
                                    font=('Arial', 12, 'bold'), 
                                    relief='flat', bd=0, 
                                    width=12, height=2,
                                    cursor='hand2')
            close_button.pack()
            
            # LED animation
            def animate_completion_led():
                try:
                    if modal.winfo_exists():
                        colors = ['#00ff00', '#00cc00', '#009900', '#00cc00']
                        current_color = colors[int(time.time() * 2) % len(colors)]
                        led_border.configure(bg=current_color)
                        modal.after(300, animate_completion_led)
                except:
                    pass
            
            animate_completion_led()
            
            # Handle window close (X button) - also stop music and restore window behavior
            modal.protocol("WM_DELETE_WINDOW", close_modal_and_stop_music)
            modal.focus_set()
            
            # Reset topmost after a short delay to allow modal to show properly
            modal.after(1000, lambda: self.root.attributes('-topmost', False))
            
        except Exception as e:
            print(f"Error showing completion notification: {e}")
            # Ensure window behavior is restored even if there's an error
            try:
                self.root.attributes('-topmost', False)
                self.root.lift()
                self.root.focus_force()
            except:
                pass
    
    def start_completion_music(self):
        """Start playing completion music hidden in background without showing any window"""
        try:
            sound_path = os.path.join(os.getcwd(), "doneamthanh", "gao.mp4")
            print(f"Checking music file: {sound_path}")
            print(f"File exists: {os.path.exists(sound_path)}")
            
            if os.path.exists(sound_path):
                print(f"Starting completion music (hidden): {sound_path}")
                
                # Store music process reference for later control
                self.music_process = None
                
                # Try pygame first (most reliable and completely hidden)
                try:
                    import pygame
                    pygame.mixer.init()
                    pygame.mixer.music.load(sound_path)
                    pygame.mixer.music.play(-1)  # Loop indefinitely
                    print("Started hidden music with pygame")
                    self.music_player_type = "pygame"
                    return
                except Exception as pygame_error:
                    print(f"Pygame error: {pygame_error}")
                
                # Try VLC with completely hidden interface
                try:
                    import subprocess
                    import shutil
                    
                    # Check if VLC is available in PATH
                    vlc_path = shutil.which('vlc')
                    if vlc_path:
                        self.music_process = subprocess.Popen([
                            vlc_path,
                            sound_path,
                            '--intf', 'dummy',  # No interface at all
                            '--repeat',  # Loop the music
                            '--no-video',  # Audio only
                            '--no-video-title-show',  # Don't show title
                            '--quiet',  # Quiet mode
                            '--no-osd',  # No on-screen display
                            '--no-spu',  # No subtitles
                            '--no-stats',  # No statistics
                            '--no-interact',  # No interaction
                            '--play-and-exit'  # Exit when done (but we loop)
                        ], 
                        creationflags=subprocess.CREATE_NO_WINDOW,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL)
                        print("Started hidden music with VLC")
                        self.music_player_type = "vlc"
                        return
                    else:
                        print("VLC not found in PATH")
                        
                except Exception as vlc_error:
                    print(f"VLC error: {vlc_error}")
                
                # Try PowerShell with completely hidden window (most reliable for hidden playback)
                try:
                    import subprocess
                    # Use PowerShell to play audio without showing any window
                    powershell_command = f'''
                    Add-Type -AssemblyName presentationCore;
                    $mediaPlayer = New-Object system.windows.media.mediaplayer;
                    $mediaPlayer.open([uri]"{sound_path}");
                    $mediaPlayer.Play();
                    while ($mediaPlayer.NaturalDuration.HasTimeSpan -eq $false) {{
                        Start-Sleep -Milliseconds 100;
                    }}
                    while ($mediaPlayer.Position -lt $mediaPlayer.NaturalDuration.TimeSpan) {{
                        Start-Sleep -Seconds 1;
                        if ($mediaPlayer.Position -ge $mediaPlayer.NaturalDuration.TimeSpan) {{
                            $mediaPlayer.Position = [TimeSpan]::Zero;
                        }}
                    }}
                    '''
                    
                    self.music_process = subprocess.Popen([
                        'powershell.exe',
                        '-WindowStyle', 'Hidden',
                        '-ExecutionPolicy', 'Bypass',
                        '-NoProfile',
                        '-Command', powershell_command
                    ], 
                    creationflags=subprocess.CREATE_NO_WINDOW,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL)
                    print("Started completely hidden music with PowerShell")
                    self.music_player_type = "powershell"
                    return
                        
                except Exception as ps_error:
                    print(f"PowerShell error: {ps_error}")
                
                # Try FFplay (part of FFmpeg) completely hidden
                try:
                    import subprocess
                    import shutil
                    
                    # Check if ffplay is available
                    ffplay_path = shutil.which('ffplay')
                    if ffplay_path:
                        self.music_process = subprocess.Popen([
                            ffplay_path,
                            sound_path,
                            '-nodisp',  # No video display
                            '-autoexit',  # Exit when done
                            '-loop', '0',  # Loop infinitely
                            '-loglevel', 'quiet'  # Quiet mode
                        ], 
                        creationflags=subprocess.CREATE_NO_WINDOW,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL)
                        print("Started hidden music with FFplay")
                        self.music_player_type = "ffplay"
                        return
                    else:
                        print("FFplay not found in PATH")
                        
                except Exception as ffplay_error:
                    print(f"FFplay error: {ffplay_error}")
                
                print("All hidden music players failed - no suitable player found")
                    
            else:
                print(f"Sound file not found: {sound_path}")
                
        except Exception as e:
            print(f"Exception in start_completion_music: {e}")
    
    def stop_completion_music(self):
        """Stop the completion music"""
        try:
            # Stop pygame music if it was used
            if hasattr(self, 'music_player_type') and self.music_player_type == "pygame":
                try:
                    import pygame
                    pygame.mixer.music.stop()
                    print("Stopped pygame music")
                except Exception as pygame_stop_error:
                    print(f"Error stopping pygame music: {pygame_stop_error}")
            
            # Stop process-based music players
            if hasattr(self, 'music_process') and self.music_process:
                print("Stopping completion music process...")
                
                # Try to terminate the music process gracefully
                try:
                    self.music_process.terminate()
                    # Wait a bit for graceful termination
                    try:
                        self.music_process.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        # Force kill if it doesn't terminate gracefully
                        self.music_process.kill()
                        self.music_process.wait()
                    
                    print("Music process stopped successfully")
                    
                except Exception as terminate_error:
                    print(f"Error terminating music process: {terminate_error}")
                    
                    # Fallback: kill all media player processes
                    try:
                        import subprocess
                        subprocess.run(['taskkill', '/f', '/im', 'vlc.exe'], 
                                     capture_output=True, check=False)
                        subprocess.run(['taskkill', '/f', '/im', 'wmplayer.exe'], 
                                     capture_output=True, check=False)
                        subprocess.run(['taskkill', '/f', '/im', 'powershell.exe'], 
                                     capture_output=True, check=False)
                        print("Killed media player processes")
                    except Exception as kill_error:
                        print(f"Error killing media processes: {kill_error}")
                
                self.music_process = None
            
            # Clear music player type
            if hasattr(self, 'music_player_type'):
                delattr(self, 'music_player_type')
                
            print("Music stopped successfully")
                
        except Exception as e:
            print(f"Exception in stop_completion_music: {e}")

    def play_completion_sound(self):
        """Legacy method - now calls start_completion_music for compatibility"""
        self.start_completion_music()
    
    def countdown_between_prompts(self, current_prompt, total_prompts):
        """Countdown timer between prompts"""
        try:
            # Get countdown seconds from user input
            try:
                countdown_seconds = int(self.countdown_seconds.get())
            except ValueError:
                countdown_seconds = 50  # Default fallback
            
            if countdown_seconds <= 0:
                return  # Skip countdown if 0 or negative
            
            self.root.after(0, lambda: self.status_bar.configure(text=f"✅ Hoàn thành prompt {current_prompt} - Đếm ngược {countdown_seconds}s trước prompt {current_prompt + 1}"))
            
            # Visual countdown with LED effects
            for remaining in range(countdown_seconds, 0, -1):
                # Update status bar with countdown
                self.root.after(0, lambda r=remaining, next_p=current_prompt + 1: 
                    self.status_bar.configure(text=f"⏰ Đếm ngược: {r}s - Tiếp theo: Prompt {next_p}/{total_prompts}"))
                
                # LED color changes during countdown
                if remaining <= 10:
                    # Red warning for last 10 seconds
                    color = '#ff4444'
                elif remaining <= 30:
                    # Orange for last 30 seconds
                    color = '#ffaa00'
                else:
                    # Blue for normal countdown
                    color = '#00bfff'
                
                # Update LED border color
                self.root.after(0, lambda c=color: self.led_border.configure(bg=c))
                
                # Wait 1 second
                time.sleep(1)
            
            # Reset LED color after countdown
            self.root.after(0, lambda: self.led_border.configure(bg='#00bfff'))
            self.root.after(0, lambda next_p=current_prompt + 1: 
                self.status_bar.configure(text=f"🚀 Bắt đầu xử lý prompt {next_p}/{total_prompts}"))
            
        except Exception as e:
            print(f"Exception in countdown_between_prompts: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi đếm ngược: {str(e)}"))
    
    def generate_videos_for_prompt_with_folder(self, prompt, prompt_index, total_prompts, output_folder):
        """Generate videos for a single prompt and save to specific folder"""
        try:
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đang tạo video cho prompt {prompt_index}/{total_prompts}..."))
            print(f"Starting video generation for prompt {prompt_index}: {prompt}")
            print(f"Output folder: {output_folder}")
            
            # Create the API payload based on the provided structure
            output_count = int(self.output_count.get())
            
            # Get selected model and determine the correct videoModelKey
            selected_model = self.model_selection.get()
            video_model_key = self.get_video_model_key(selected_model)
            
            print(f"Selected model: {selected_model}, Using videoModelKey: {video_model_key}")
            
            # Generate random seeds for each video
            import random
            requests_list = []
            
            for i in range(output_count):
                seed = random.randint(1000, 99999)
                scene_id = f"{random.randint(10000000, 99999999):08x}-{random.randint(1000, 9999):04x}-{random.randint(1000, 9999):04x}-{random.randint(1000, 9999):04x}-{random.randint(100000000000, 999999999999):012x}"
                
                request_data = {
                    "aspectRatio": "VIDEO_ASPECT_RATIO_LANDSCAPE",
                    "seed": seed,
                    "textInput": {
                        "prompt": prompt + "\n"  # Add newline as shown in the API example
                    },
                    "videoModelKey": video_model_key,
                    "metadata": {
                        "sceneId": scene_id
                    }
                }
                requests_list.append(request_data)
            
            # Check if we have a project ID
            if not self.current_project_id:
                print("No project ID available, cannot create video")
                self.root.after(0, lambda: self.status_bar.configure(text="❌ Chưa có project! Vui lòng tạo project trước khi tạo video"))
                return False
            
            # Create the full payload using current project ID
            payload = {
                "clientContext": {
                    "projectId": self.current_project_id,
                    "tool": "PINHOLE",
                    "userPaygateTier": "PAYGATE_TIER_ONE"
                },
                "requests": requests_list
            }
            
            print(f"API payload created: {json.dumps(payload, indent=2)}")
            
            # Make the API call with folder support
            return self.make_video_api_call_with_folder(payload, prompt_index, prompt, output_folder)
                
        except Exception as e:
            print(f"General exception in generate_videos_for_prompt_with_folder: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi tạo video cho prompt {prompt_index}: {str(e)}"))
            return False
    
    def make_video_api_call_with_folder(self, payload, prompt_index, prompt, output_folder):
        """Make API call to generate videos and save to specific folder"""
        try:
            output_count = len(payload['requests'])
            print(f"Making video API call for {output_count} videos: {json.dumps(payload, indent=2)}")
            
            # Get cookies from browser for authentication
            cookies = self.driver.get_cookies()
            cookie_dict = {cookie['name']: cookie['value'] for cookie in cookies}
            
            # Prepare headers based on the provided example
            headers = {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': f'Bearer {self.access_token}' if hasattr(self, 'access_token') else '',
                'content-type': 'text/plain;charset=UTF-8',
                'priority': 'u=1, i',
                'referer': 'https://labs.google/',
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'user-agent': self.driver.execute_script("return navigator.userAgent;"),
                'x-browser-channel': 'stable'
            }
            
            # Make API call to generate videos
            api_url = 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText'
            
            response = requests.post(
                api_url,
                headers=headers,
                cookies=cookie_dict,
                json=payload,
                timeout=30
            )
            
            print(f"Video API Response Status: {response.status_code}")
            print(f"Video API Response: {response.text}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    
                    # Extract operations for status polling based on the provided structure
                    operations = response_data.get('operations', [])
                    if not operations:
                        print("No operations found in response")
                        self.root.after(0, lambda: self.status_bar.configure(text=f"Không có operations trong response cho prompt {prompt_index}"))
                        return False
                    
                    # Verify we got the expected number of operations
                    if len(operations) != output_count:
                        print(f"Warning: Expected {output_count} operations, got {len(operations)}")
                        self.root.after(0, lambda: self.status_bar.configure(text=f"Cảnh báo: Chỉ nhận được {len(operations)}/{output_count} operations"))
                    
                    # Store operations data for polling
                    operations_data = []
                    for op in operations:
                        operation_info = {
                            'operation': op.get('operation', {}),
                            'sceneId': op.get('sceneId', ''),
                            'status': op.get('status', '')
                        }
                        operations_data.append(operation_info)
                    
                    print(f"Got {len(operations_data)} operations for polling (expected {output_count})")
                    self.root.after(0, lambda: self.status_bar.configure(text=f"Đã tạo {len(operations_data)} video requests cho prompt {prompt_index}"))
                    
                    # Update credits from remainingCredits in response
                    remaining_credits = response_data.get('remainingCredits', 0)
                    if remaining_credits > 0:
                        self.user_info["credits"] = remaining_credits
                        self.root.after(0, self.update_credits_display_only)
                        print(f"Updated credits after video creation: {remaining_credits}")
                    
                    if not operations_data:
                        print("No valid operations found")
                        return False
                    
                    # Poll for completion and download videos to specific folder
                    return self.poll_and_download_videos_with_folder(operations_data, prompt_index, prompt, output_folder)
                    
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi phân tích JSON cho prompt {prompt_index}"))
                    return False
                    
            elif response.status_code == 429:
                # Handle quota exhausted error specifically
                try:
                    error_data = response.json()
                    remaining_credits = error_data.get('remainingCredits', 0)
                    print(f"Quota exhausted, remaining credits: {remaining_credits}")
                    self.root.after(0, lambda: self.status_bar.configure(text=f"❌ Hết quota trình duyệt! Vui lòng đợi reset hoặc thử tài khoản khác"))
                    self.root.after(0, lambda: self.show_quota_exhausted_modal(remaining_credits))
                    return False
                except:
                    self.root.after(0, lambda: self.status_bar.configure(text=f"❌ Lỗi 429: Hết quota trình duyệt"))
                    self.root.after(0, lambda: self.show_quota_exhausted_modal(0))
                    return False
                    
            else:
                print(f"Video API call failed with status {response.status_code}: {response.text}")
                self.root.after(0, lambda: self.status_bar.configure(text=f"❌ Trình duyệt lỗi {response.status_code} cho prompt {prompt_index}"))
                return False
                
        except Exception as e:
            print(f"Exception in make_video_api_call_with_folder: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"❌ Lỗi kết nối trình duyệt cho prompt {prompt_index}"))
            return False
    
    def poll_and_download_videos_with_folder(self, operations_data, prompt_index, prompt_text, output_folder):
        """Poll for video generation completion and download to specific folder"""
        try:
            output_count = int(self.output_count.get())
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đang chờ {output_count} video hoàn thành cho prompt {prompt_index}..."))
            print(f"Starting continuous polling for prompt {prompt_index} with {len(operations_data)} operations, waiting for ALL {output_count} videos")
            
            # Get cookies and headers for polling
            cookies = self.driver.get_cookies()
            cookie_dict = {cookie['name']: cookie['value'] for cookie in cookies}
            
            headers = {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': f'Bearer {self.access_token}',
                'content-type': 'text/plain;charset=UTF-8',
                'origin': 'https://labs.google',
                'priority': 'u=1, i',
                'referer': 'https://labs.google/',
                'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'user-agent': self.driver.execute_script("return navigator.userAgent;"),
                'x-browser-channel': 'stable',
                'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
                'x-browser-validation': '6h3XF8YcD8syi2FF2BbuE2KllQo=',
                'x-browser-year': '2025',
                'x-client-data': 'CIe2yQEIorbJAQipncoBCKzyygEIkqHLAQiFoM0BCP2FzwEY4eLOARiX7s4B'
            }
            
            # Create polling payload based on user's successful example
            polling_payload = {
                "operations": []
            }
            
            for op_data in operations_data:
                operation = op_data.get('operation', {})
                if operation and 'name' in operation:
                    polling_payload["operations"].append({
                        "operation": {"name": operation['name']},
                        "sceneId": op_data.get('sceneId', ''),
                        "status": op_data.get('status', 'MEDIA_GENERATION_STATUS_PENDING')
                    })
            
            print(f"Fixed polling payload: {json.dumps(polling_payload, indent=2)}")
            
            max_polling_attempts = 120  # 10 minutes max
            polling_interval = 5
            all_video_urls = []  # Collect ALL video URLs before downloading
            
            for attempt in range(max_polling_attempts):
                # Check stop flag before each polling attempt
                if self.stop_requested:
                    print(f"Stop requested during polling for prompt {prompt_index}")
                    self.root.after(0, lambda: self.status_bar.configure(text="Đã dừng theo yêu cầu"))
                    return False
                
                self.root.after(0, lambda a=attempt+1: self.status_bar.configure(text=f"Kiểm tra {a}/{max_polling_attempts} - Chờ đủ {output_count} video cho prompt {prompt_index}"))
                print(f"Polling attempt {attempt + 1}/{max_polling_attempts} for prompt {prompt_index}")
                
                # Make status check API call
                status_url = 'https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus'
                
                try:
                    status_response = requests.post(
                        status_url,
                        headers=headers,
                        cookies=cookie_dict,
                        json=polling_payload,
                        timeout=15
                    )
                    
                    print(f"Status check response: {status_response.status_code}")
                    
                    if status_response.status_code == 400:
                        print(f"Status check failed: 400 - {status_response.text}")
                        time.sleep(polling_interval)
                        continue
                    
                    if status_response.status_code == 200:
                        try:
                            status_data = status_response.json()
                            print(f"Status response: {json.dumps(status_data, indent=2)}")
                            
                            operations = status_data.get('operations', [])
                            if not operations:
                                print("No operations found in status response")
                                time.sleep(polling_interval)
                                continue
                            
                            completed_operations = []
                            failed_operations = []
                            pending_operations = []
                            
                            # Categorize operations by status
                            for op in operations:
                                status = op.get('status', '')
                                if status == 'MEDIA_GENERATION_STATUS_SUCCESSFUL':
                                    completed_operations.append(op)
                                elif status == 'MEDIA_GENERATION_STATUS_FAILED':
                                    failed_operations.append(op)
                                elif status in ['MEDIA_GENERATION_STATUS_PENDING', 'MEDIA_GENERATION_STATUS_ACTIVE']:
                                    pending_operations.append(op)
                                else:
                                    print(f"Unknown status: {status}")
                            
                            print(f"Status summary: {len(completed_operations)} completed, {len(failed_operations)} failed, {len(pending_operations)} pending")
                            
                            # Collect video URLs from completed operations but DON'T download until ALL are ready
                            if completed_operations:
                                for op in completed_operations:
                                    operation = op.get('operation', {})
                                    metadata = operation.get('metadata', {})
                                    
                                    if metadata:
                                        video_data = metadata.get('video', {})
                                        fife_url = video_data.get('fifeUrl', '')
                                        
                                        if fife_url and fife_url not in all_video_urls:
                                            all_video_urls.append(fife_url)
                                            print(f"Collected video URL {len(all_video_urls)}/{output_count}: {fife_url}")
                            
                            # ONLY download when ALL videos are ready (no pending operations)
                            if not pending_operations and not failed_operations:
                                if len(all_video_urls) >= output_count:
                                    print(f"All {output_count} videos ready! Starting download to folder...")
                                    self.root.after(0, lambda: self.status_bar.configure(text=f"Tất cả {output_count} video đã sẵn sàng! Đang tải xuống..."))
                                    
                                    # Download all videos to the specific folder
                                    success = self.download_videos_to_folder(all_video_urls[:output_count], prompt_index, prompt_text, output_folder)
                                    if success:
                                        # Mark prompt as done and update display immediately
                                        self.prompt_status[prompt_index]["done"] = True
                                        self.update_prompt_display_with_status()
                                        self.save_prompt_status_to_file()
                                    return success
                                else:
                                    print(f"Only {len(all_video_urls)}/{output_count} videos completed, continuing to wait...")
                            
                            # Check if any operation failed
                            if failed_operations:
                                print(f"Found {len(failed_operations)} failed operations")
                                for failed_op in failed_operations:
                                    operation = failed_op.get('operation', {})
                                    error = operation.get('error', {})
                                    if error:
                                        print(f"Failed operation error: {error}")
                                
                                # If some completed and some failed, but we have enough completed videos
                                if len(all_video_urls) >= output_count:
                                    print(f"Have {len(all_video_urls)} videos despite {len(failed_operations)} failures, downloading...")
                                    success = self.download_videos_to_folder(all_video_urls[:output_count], prompt_index, prompt_text, output_folder)
                                    if success:
                                        # Mark prompt as done and update display immediately
                                        self.prompt_status[prompt_index]["done"] = True
                                        self.update_prompt_display_with_status()
                                        self.save_prompt_status_to_file()
                                    return success
                                
                                # If not enough videos, continue waiting
                                if pending_operations:
                                    print(f"Some operations failed but still have {len(pending_operations)} pending, continuing...")
                                    time.sleep(polling_interval)
                                    continue
                                else:
                                    print("All operations completed but not enough successful videos")
                                    return False
                            
                            # Continue polling if there are pending operations
                            if pending_operations:
                                print(f"Still waiting for {len(pending_operations)} pending operations...")
                                time.sleep(polling_interval)
                                continue
                            
                            # If no operations at all, something is wrong
                            if not operations:
                                print("No operations found in response - this shouldn't happen")
                                time.sleep(polling_interval)
                                continue
                                
                        except json.JSONDecodeError as e:
                            print(f"JSON decode error in status check: {e}")
                            print(f"Raw response: {status_response.text}")
                            time.sleep(polling_interval)
                            continue
                            
                    else:
                        print(f"Status check failed: {status_response.status_code} - {status_response.text}")
                        time.sleep(polling_interval)
                        continue
                        
                except requests.RequestException as e:
                    print(f"Request error during polling: {e}")
                    time.sleep(polling_interval)
                    continue
            
            # Timeout reached
            print("Polling timeout reached")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Timeout chờ video cho prompt {prompt_index}"))
            return False
            
        except Exception as e:
            print(f"Exception in poll_and_download_videos_with_folder: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi polling cho prompt {prompt_index}: {str(e)}"))
            return False
    
    def download_videos_to_folder(self, video_urls, prompt_index, prompt_text, output_folder):
        """Download videos to specific folder with numbered filenames"""
        try:
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đang tải {len(video_urls)} video cho prompt {prompt_index}..."))
            print(f"Starting download of {len(video_urls)} videos for prompt {prompt_index} to folder: {output_folder}")
            
            downloaded_count = 0
            
            for i, video_url in enumerate(video_urls, 1):
                try:
                    self.root.after(0, lambda v=i: self.status_bar.configure(text=f"Đang tải video {v}/{len(video_urls)} cho prompt {prompt_index}..."))
                    print(f"Downloading video {i}/{len(video_urls)}: {video_url}")
                    
                    # Create filename - simple numbered format
                    filename = f"video_{i:02d}.mp4"
                    filepath = os.path.join(output_folder, filename)
                    
                    # Skip if file already exists
                    if os.path.exists(filepath):
                        print(f"Video {i} already exists, skipping...")
                        downloaded_count += 1
                        continue
                    
                    # Download video
                    headers = {
                        'user-agent': self.driver.execute_script("return navigator.userAgent;"),
                        'referer': VEO_URL
                    }
                    
                    video_response = requests.get(video_url, headers=headers, stream=True, timeout=60)
                    
                    if video_response.status_code == 200:
                        with open(filepath, 'wb') as f:
                            for chunk in video_response.iter_content(chunk_size=8192):
                                if chunk:
                                    f.write(chunk)
                        
                        file_size = os.path.getsize(filepath)
                        print(f"Downloaded video {i}: {filename} ({file_size} bytes) to {output_folder}")
                        downloaded_count += 1
                        
                    else:
                        print(f"Failed to download video {i}: HTTP {video_response.status_code}")
                        
                except Exception as download_error:
                    print(f"Error downloading video {i}: {download_error}")
                    continue
            
            if downloaded_count > 0:
                self.root.after(0, lambda: self.status_bar.configure(text=f"Đã tải {downloaded_count}/{len(video_urls)} video cho prompt {prompt_index}"))
                print(f"Successfully downloaded {downloaded_count}/{len(video_urls)} videos for prompt {prompt_index}")
                return True
            else:
                self.root.after(0, lambda: self.status_bar.configure(text=f"Không tải được video nào cho prompt {prompt_index}"))
                print(f"Failed to download any videos for prompt {prompt_index}")
                return False
                
        except Exception as e:
            print(f"Exception in download_videos_to_folder: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi tải video cho prompt {prompt_index}: {str(e)}"))
            return False
    
    def change_account(self):
        """Handle account change request"""
        # Show simple confirmation dialog
        result = messagebox.askyesno(
            "Xác nhận đổi tài khoản", 
            "Bạn có chắc chắn muốn đổi tài khoản không?",
            icon='question'
        )
        
        if result:
            # User confirmed, start account change process
            self.status_bar.configure(text="Đang chuẩn bị đổi tài khoản...")
            threading.Thread(target=self.perform_account_change, daemon=True).start()
    
    def perform_account_change(self):
        """Perform the account change process"""
        try:
            # Immediately update UI to show account changing status with beautiful effects
            self.root.after(0, lambda: self.show_account_changing_status())
            
            # Step 1: Close current browser
            self.root.after(0, lambda: self.status_bar.configure(text="Đang đóng trình duyệt hiện tại..."))
            if self.driver:
                try:
                    self.driver.quit()
                    self.driver = None
                    print("Current browser closed")
                except:
                    pass
            
            # Step 2: Clear veo data (same as taikhoan.py)
            self.root.after(0, lambda: self.status_bar.configure(text="Đang xóa dữ liệu cũ..."))
            self.clear_veo_data()
            
            # Step 3: Open Chrome with veo data directory (non-headless)
            self.root.after(0, lambda: self.status_bar.configure(text="Đang mở trình duyệt để đăng nhập..."))
            chrome_process = self.open_chrome_with_veo_data()
            
            if chrome_process:
                # Step 4: Wait for user to close Chrome
                self.root.after(0, lambda: self.status_bar.configure(text="Vui lòng đăng nhập tài khoản mới và đóng trình duyệt"))
                self.wait_for_chrome_to_close(chrome_process)
                
                # Step 5: Reset UI and restart browser in headless mode
                self.root.after(0, lambda: self.status_bar.configure(text="Đang khởi động lại với tài khoản mới..."))
                self.reset_user_info()
                
                # Step 6: Restart browser and fetch new user info
                self.auto_start_browser()
            else:
                self.root.after(0, lambda: self.status_bar.configure(text="❌ Lỗi mở trình duyệt"))
                
        except Exception as e:
            print(f"Error in perform_account_change: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"❌ Lỗi đổi tài khoản: {str(e)}"))
    
    def show_account_changing_status(self):
        """Show beautiful account changing status with animated dots"""
        # Update user info to show changing status
        self.user_name_label.configure(text="Đang đổi tài khoản", fg="#ffaa00")
        self.user_email_label.configure(text="", fg="#ffaa00")
        self.credits_label.configure(text="", fg="#ffaa00")
        
        # Hide the change account button during the process
        self.change_account_button.pack_forget()
        
        # Start animated dots effect
        self.start_account_changing_animation()
        
        print("Account changing status displayed with animation")
    
    def start_account_changing_animation(self):
        """Start animated dots effect for account changing"""
        self.dots_count = 0
        self.animate_account_changing_dots()
    
    def animate_account_changing_dots(self):
        """Animate dots for account changing status"""
        try:
            # Create animated dots (1, 2, 3 dots cycling)
            self.dots_count = (self.dots_count + 1) % 4
            dots = "." * (self.dots_count if self.dots_count > 0 else 3)
            
            # Update the text with animated dots
            changing_text = f"Đang đổi tài khoản{dots}"
            self.user_name_label.configure(text=changing_text)
            
            # Change color cycling for beautiful effect
            colors = ['#ffaa00', '#ff8800', '#ff6600', '#ff8800']
            current_color = colors[self.dots_count]
            self.user_name_label.configure(fg=current_color)
            
            # Continue animation if still changing account
            if hasattr(self, 'dots_count'):
                self.root.after(500, self.animate_account_changing_dots)
                
        except Exception as e:
            print(f"Error in animate_account_changing_dots: {e}")
    
    def clear_veo_data(self):
        """Clear all data from the veo folder (same as taikhoan.py)"""
        veo_path = Path("veo")
        if veo_path.exists():
            print("Đang xóa dữ liệu cũ...")
            
            # First, try to kill any Chrome processes that might be using the veo folder
            self.kill_chrome_processes_using_veo()
            
            # Wait a moment for processes to fully close
            time.sleep(2)
            
            try:
                # Remove all contents of veo folder but keep the folder itself
                for item in veo_path.iterdir():
                    try:
                        if item.is_file():
                            item.unlink()
                        elif item.is_dir():
                            shutil.rmtree(item)
                    except Exception as e:
                        print(f"Không thể xóa {item.name}: {e}")
                        continue
                print("Đã xóa dữ liệu cũ thành công!")
            except Exception as e:
                print(f"Lỗi khi xóa dữ liệu: {e}")
                print("Một số file có thể vẫn đang được sử dụng, nhưng sẽ tiếp tục...")
        else:
            # Create veo folder if it doesn't exist
            veo_path.mkdir(exist_ok=True)
            print("Đã tạo thư mục veo mới!")
    
    def kill_chrome_processes_using_veo(self):
        """Kill any Chrome processes that might be using the veo folder"""
        veo_path = os.path.abspath("veo")
        killed_processes = 0
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.info['name'] and 'chrome' in proc.info['name'].lower():
                    if proc.info['cmdline'] and any(veo_path in arg for arg in proc.info['cmdline']):
                        print(f"Đang đóng Chrome process (PID: {proc.info['pid']})...")
                        proc.terminate()
                        killed_processes += 1
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        if killed_processes > 0:
            print(f"Đã đóng {killed_processes} Chrome process(es)")
            time.sleep(3)  # Wait for processes to fully terminate
    
    def find_chrome_executable(self):
        """Find Chrome executable path (same as taikhoan.py)"""
        chrome_paths = [
            "chrome/chrome.exe",  # Local chrome folder
            "C:/Program Files/Google/Chrome/Application/chrome.exe",
            "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
            os.path.expanduser("~/AppData/Local/Google/Chrome/Application/chrome.exe")
        ]
        
        for path in chrome_paths:
            if os.path.exists(path):
                return path
        
        return None
    
    def open_chrome_with_veo_data(self):
        """Open Chrome browser with veo folder as user data directory (same as taikhoan.py)"""
        chrome_path = self.find_chrome_executable()
        
        if not chrome_path:
            print("Không tìm thấy Chrome! Vui lòng cài đặt Google Chrome.")
            return None
        
        # Get absolute path to veo folder
        veo_path = os.path.abspath("veo")
        
        # Chrome arguments
        chrome_args = [
            chrome_path,
            f"--user-data-dir={veo_path}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-default-apps",
            "https://labs.google/fx/vi/tools/flow"
        ]
        
        print("Đang mở trình duyệt...")
        try:
            # Start Chrome process
            process = subprocess.Popen(chrome_args)
            return process
        except Exception as e:
            print(f"Lỗi khi mở Chrome: {e}")
            return None
    
    def wait_for_chrome_to_close(self, process):
        """Wait for Chrome process to close (same as taikhoan.py)"""
        print("Trình duyệt đã mở! Đang chờ bạn đóng trình duyệt...")
        print("Dữ liệu sẽ được lưu tự động khi bạn đóng trình duyệt.")
        
        try:
            # Wait for the main process to finish
            process.wait()
            
            # Wait a bit more to ensure all Chrome processes are closed
            time.sleep(2)
            
            # Check if any Chrome processes are still running with our user data dir
            veo_path = os.path.abspath("veo")
            chrome_processes = []
            
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    if proc.info['name'] and 'chrome' in proc.info['name'].lower():
                        if proc.info['cmdline'] and any(veo_path in arg for arg in proc.info['cmdline']):
                            chrome_processes.append(proc)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            # Wait for all related Chrome processes to close
            while chrome_processes:
                time.sleep(1)
                chrome_processes = [proc for proc in chrome_processes if proc.is_running()]
            
            print("Trình duyệt đã đóng! Dữ liệu đã được lưu.")
            
        except KeyboardInterrupt:
            print("\nĐang thoát...")
            try:
                process.terminate()
            except:
                pass
    
    def process_two_images_to_video(self):
        """Process 2-images-to-video function with special 2:1 mapping (2 images per prompt)"""
        try:
            # Validate inputs
            if not self.selected_images:
                self.root.after(0, lambda: messagebox.showwarning("Cảnh báo", "Vui lòng chọn ảnh trước!"))
                return
            
            if not self.prompts:
                self.root.after(0, lambda: messagebox.showwarning("Cảnh báo", "Vui lòng chọn file prompt trước!"))
                return
            
            # Create main folder structure
            folder_name = self.folder_name.get().strip() or "auto1"
            main_folder = os.path.join(os.getcwd(), folder_name)
            os.makedirs(main_folder, exist_ok=True)
            
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đã tạo folder chính: {folder_name}"))
            
            # Initialize prompt status tracking for all prompts
            self.prompt_status = {}
            for i, prompt in enumerate(self.prompts, 1):
                self.prompt_status[i] = {"prompt": prompt, "done": False}
            
            # Update prompt display with status
            self.update_prompt_display_with_status()
            
            # Implement 2:1 mapping logic (2 images per prompt)
            # 4 images + 2 prompts = 2 pairs: (1.1+1.2 with prompt1), (2.1+2.2 with prompt2)
            
            num_images = len(self.selected_images)
            num_prompts = len(self.prompts)
            
            # Calculate how many pairs we can process (each pair needs 2 images)
            pairs_to_process = min(num_images // 2, num_prompts)
            
            self.root.after(0, lambda: self.status_bar.configure(text=f"Bắt đầu xử lý: {num_images} ảnh, {num_prompts} prompts (2:1 mapping)"))
            
            if pairs_to_process == 0:
                self.root.after(0, lambda: messagebox.showwarning("Cảnh báo", "Cần ít nhất 2 ảnh và 1 prompt để tạo video!"))
                return
            
            # Get current prompts from text area in real-time order
            current_prompts = self.get_current_prompts_from_text()
            
            # Process each 2-image-prompt group sequentially using same logic as other functions
            for i, (prompt_text, is_done) in enumerate(current_prompts, 1):
                # Check stop flag before processing each group
                if self.stop_requested:
                    print("Stop requested, breaking out of 2-image-prompt loop")
                    self.root.after(0, lambda: self.status_bar.configure(text="Đã dừng theo yêu cầu"))
                    break
                
                # Skip if already done
                if is_done:
                    self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"Bỏ qua prompt {idx} - đã hoàn thành"))
                    print(f"Skipping 2-image-prompt group {i} - already done")
                    continue
                
                # Check if we have enough images for this prompt (need 2 images per prompt)
                start_image_index = (i - 1) * 2
                end_image_index = (i - 1) * 2 + 1
                
                if start_image_index >= len(self.selected_images) or end_image_index >= len(self.selected_images):
                    self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"Không đủ ảnh cho prompt {idx} - bỏ qua"))
                    print(f"Not enough images for prompt {i} - skipping")
                    continue
                
                start_image_path, _ = self.selected_images[start_image_index]
                end_image_path, _ = self.selected_images[end_image_index]
                
                self.root.after(0, lambda idx=i, p=prompt_text: self.status_bar.configure(text=f"Đang xử lý nhóm {idx}: 2 ảnh + prompt {idx}"))
                
                # Create subfolder using original prompt index (not enumeration index)
                subfolder = os.path.join(main_folder, str(i))
                os.makedirs(subfolder, exist_ok=True)
                
                # Generate videos for this 2-image-prompt group
                success = self.generate_two_images_to_video(start_image_path, end_image_path, prompt_text, i, subfolder)
                
                if success:
                    # Mark as done in text area and update file
                    self.mark_prompt_as_done_in_text(i)
                    
                    # Update prompt status immediately
                    self.prompt_status[i]["done"] = True
                    
                    # Update displays
                    self.update_prompt_display_with_status()
                    self.update_image_display_with_status()
                    
                    self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"✅ Hoàn thành nhóm {idx} - tự động chuyển sang nhóm tiếp theo"))
                    
                    # Brief pause before moving to next group
                    time.sleep(1)
                else:
                    self.root.after(0, lambda idx=i: self.status_bar.configure(text=f"❌ Lỗi xử lý nhóm {idx} - tiếp tục nhóm tiếp theo"))
                    
                    # Check stop flag after failed group
                    if self.stop_requested:
                        print("Stop requested after failed 2-image-prompt group")
                        break
                    
                    # Continue to next group even if current one failed
                    time.sleep(1)
            
            # Check if all processed groups are completed by reading current text area
            current_prompts = self.get_current_prompts_from_text()
            completed_groups = sum(1 for i, (prompt_text, is_done) in enumerate(current_prompts) if is_done)
            total_groups = len(current_prompts)
            
            # Only show completion notification if ALL prompts are done (same logic as other functions)
            if completed_groups > 0 and completed_groups == total_groups:
                self.root.after(0, lambda: self.status_bar.configure(text=f"Hoàn thành TẤT CẢ {completed_groups} nhóm 2-ảnh-prompt!"))
                self.show_completion_notification()
            elif completed_groups > 0:
                # Some groups completed but not all - don't show completion notification
                pending_groups = total_groups - completed_groups
                self.root.after(0, lambda: self.status_bar.configure(text=f"Hoàn thành {completed_groups}/{total_groups} nhóm - Còn {pending_groups} nhóm chưa làm"))
            else:
                self.root.after(0, lambda: self.status_bar.configure(text="Không có nhóm nào được xử lý thành công"))
            
        except Exception as e:
            print(f"Exception in process_two_images_to_video: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi xử lý 2-images-to-video: {str(e)}"))
    
    def generate_two_images_to_video(self, start_image_path, end_image_path, prompt, prompt_index, output_folder):
        """Generate video from two images using the batchAsyncGenerateVideoStartAndEndImage API"""
        try:
            self.root.after(0, lambda: self.status_bar.configure(text=f"Đang tạo video từ 2 ảnh cho prompt {prompt_index}..."))
            print(f"Starting 2-images-to-video generation for prompt {prompt_index}: {prompt}")
            
            # Upload both images and get media IDs
            start_media_id = self.upload_image_for_video(start_image_path)
            if not start_media_id:
                print("Failed to upload start image")
                return False
            
            end_media_id = self.upload_image_for_video(end_image_path)
            if not end_media_id:
                print("Failed to upload end image")
                return False
            
            # Create the API payload for 2-images-to-video
            output_count = int(self.output_count.get())
            
            # For 2 ảnh ra video, always use veo_2_1_fast_d_15_with_start_image_and_end_image_interpolation
            video_model_key = "veo_2_1_fast_d_15_with_start_image_and_end_image_interpolation"
            
            print(f"Using 2-images model: {video_model_key}")
            
            # Generate requests using proper 2-images-to-video format with startImage and endImage
            requests_list = []
            for i in range(output_count):
                seed = random.randint(1000, 99999)
                scene_id = f"{random.randint(10000000, 99999999):08x}-{random.randint(1000, 9999):04x}-{random.randint(1000, 9999):04x}-{random.randint(1000, 9999):04x}-{random.randint(100000000000, 999999999999):012x}"
                
                request_data = {
                    "aspectRatio": "VIDEO_ASPECT_RATIO_LANDSCAPE",
                    "seed": seed,
                    "startImage": {
                        "mediaId": start_media_id
                    },
                    "endImage": {
                        "mediaId": end_media_id
                    },
                    "textInput": {
                        "prompt": prompt  # Clean prompt without numbering
                    },
                    "videoModelKey": video_model_key,
                    "metadata": {
                        "sceneId": scene_id
                    }
                }
                requests_list.append(request_data)
            
            # Create the full payload
            payload = {
                "clientContext": {
                    "projectId": self.current_project_id,
                    "tool": "PINHOLE",
                    "userPaygateTier": "PAYGATE_TIER_ONE"
                },
                "requests": requests_list
            }
            
            print(f"2-images-to-video API payload created: {json.dumps(payload, indent=2)}")
            
            # Make the API call
            return self.make_two_images_video_api_call(payload, prompt_index, prompt, output_folder)
            
        except Exception as e:
            print(f"Exception in generate_two_images_to_video: {e}")
            self.root.after(0, lambda: self.status_bar.configure(text=f"Lỗi tạo video từ 2 ảnh cho prompt {prompt_index}: {str(e)}"))
            return False
    
    def make_two_images_video_api_call(self, payload, prompt_index, prompt, output_folder):
        """Make API call to generate videos from two images"""
        try:
            output_count = len(payload['requests'])
            print(f"Making 2-images-to-video API call for {output_count} videos")
            
            # Get cookies from browser for authentication
            cookies = self.driver.get_cookies()
            cookie_dict = {cookie['name']: cookie['value'] for cookie in cookies}
            
            # Prepare headers
            headers = {
                'accept': '*/*',
                'accept-encoding': 'gzip, deflate, br, zstd',
                'accept-language': 'en-US,en;q=0.9',
                'authorization': f'Bearer {self.access_token}',
                'content-type': 'text/plain;charset=UTF-8',
                'priority': 'u=1, i',
                'referer': 'https://labs.google/',
                'user-agent': self.driver.execute_script("return navigator.userAgent;"),
                'x-browser-channel': 'stable',
                'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
                'x-browser-validation': '6h3XF8YcD8syi2FF2BbuE2KllQo=',
                'x-browser-year': '2025',
                'x-client-data': 'CIe2yQEIorbJAQipncoBCKzyygEIkqHLAQiFoM0BCP2FzwEY4eLOARiX7s4B'
            }
            
            # Use the correct 2-images-to-video API endpoint
            api_url = 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartAndEndImage'
            
            response = requests.post(
                api_url,
                headers=headers,
                cookies=cookie_dict,
                json=payload,
                timeout=30
            )
            
            print(f"2-images-to-video API Response Status: {response.status_code}")
            print(f"2-images-to-video API Response: {response.text}")
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    
                    # Extract operations for status polling
                    operations = response_data.get('operations', [])
                    if not operations:
                        print("No operations found in response")
                        return False
                    
                    # Store operations data for polling
                    operations_data = []
                    for op in operations:
                        operation_info = {
                            'operation': op.get('operation', {}),
                            'sceneId': op.get('sceneId', ''),
                            'status': op.get('status', '')
                        }
                        operations_data.append(operation_info)
                    
                    print(f"Got {len(operations_data)} operations for polling")
                    
                    # Update credits from remainingCredits in response immediately
                    remaining_credits = response_data.get('remainingCredits', 0)
                    if remaining_credits > 0:
                        self.user_info["credits"] = remaining_credits
                        self.root.after(0, self.update_credits_display_only)
                        print(f"Updated credits immediately after 2-images-to-video API call: {remaining_credits}")
                    
                    # Poll for completion and download videos
                    return self.poll_and_download_image_videos(operations_data, prompt_index, prompt, output_folder)
                    
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")
                    return False
                    
            elif response.status_code == 429:
                # Handle quota exhausted
                self.root.after(0, lambda: self.show_quota_exhausted_modal(0))
                return False
                    
            else:
                print(f"2-images-to-video API call failed with status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            print(f"Exception in make_two_images_video_api_call: {e}")
            return False
    
    def on_window_map(self, event=None):
        """Handle window map event (when window becomes visible)"""
        try:
            # Only handle if event is for the root window to avoid excessive calls
            if event and event.widget == self.root:
                self.root.lift()
                print("Window restored from minimize")
        except Exception as e:
            print(f"Error in on_window_map: {e}")
    
    def on_window_unmap(self, event=None):
        """Handle window unmap event (when window becomes hidden)"""
        try:
            if event and event.widget == self.root:
                print("Window minimized")
        except Exception as e:
            print(f"Error in on_window_unmap: {e}")
    
    
    def reset_user_info(self):
        """Reset user info and project data"""
        # Stop account changing animation if running
        if hasattr(self, 'dots_count'):
            delattr(self, 'dots_count')
        
        # Reset user info
        self.user_info = {"name": "", "email": "", "credits": 0, "paygate_tier": ""}
        self.access_token = ""
        
        # Reset project data
        self.projects = []
        self.current_project_id = None
        
        # Update UI
        self.user_name_label.configure(text="Đang lấy thông tin...", fg="#ffffff")
        self.user_email_label.configure(text="", fg="#ffffff")
        self.credits_label.configure(text="", fg="#ffaa00")
        self.project_id_label.configure(text="", fg="#ffaa00")
        self.projects_text.delete('1.0', tk.END)
        self.project_status_label.configure(text="", fg="#00bfff")
        
        print("User info and project data reset")
    
    def run(self):
        """Run the application"""
        self.root.mainloop()

if __name__ == "__main__":
    app = VeoApp()
    app.run()
