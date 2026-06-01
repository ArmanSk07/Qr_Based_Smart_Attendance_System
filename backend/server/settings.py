"""
Django settings for server project.
Refined for Security & Clean Architecture.
"""

from pathlib import Path
import os
from datetime import timedelta
import dj_database_url

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# --- 1. ENVIRONMENT VARIABLES (SECURITY) ---
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BASE_DIR, '.env'))
except ImportError:
    pass 

def get_env(key, default=None):
    return os.environ.get(key, default)

SECRET_KEY = get_env('SECRET_KEY', 'django-insecure-fallback-key-do-not-use-in-prod')

# 🔒 SECURITY FIX 1: Read DEBUG from environment. Defaults to False in production.
DEBUG = get_env('DEBUG', 'False').lower() in ('true', '1', 'yes')

# 🔒 SECURITY FIX 2: Read allowed hosts from env. No more wildcard '*'.
_raw_hosts = get_env('ALLOWED_HOSTS', '127.0.0.1,localhost')
ALLOWED_HOSTS = [h.strip() for h in _raw_hosts.split(',') if h.strip()]


# --- 2. APPLICATION DEFINITION ---
INSTALLED_APPS = [
    'jazzmin',                    
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third Party
    'rest_framework',
    'rest_framework.authtoken',   
    'corsheaders',                

    # Local Apps
    'core.apps.CoreConfig',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',        # 🟢 CRITICAL: MUST BE AT TOP
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',    
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'server.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'server.wsgi.application'


# --- 3. DATABASE ---
# Default to SQLite if DATABASE_URL is not provided (for fallback),
# but use PostgreSQL via the URL in your .env file.
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=get_env('DATABASE_URL', f'sqlite:///{BASE_DIR}/db.sqlite3'),
        conn_max_age=600
    )
}


# --- 4. PASSWORD VALIDATION ---
AUTH_PASSWORD_VALIDATORS = [
    { 'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator', },
    { 'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8} },
    { 'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator', },
    { 'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator', },
]


# --- 5. INTERNATIONALIZATION ---
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata' 
USE_I18N = True
USE_TZ = True


# --- 6. STATIC & MEDIA FILES ---
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')


# 🔒 SECURITY FIX 3: Use an explicit CORS whitelist instead of allow-all.
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
_raw_cors = get_env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,https://qrbasedattendancefrontendui.vercel.app')
CORS_ALLOWED_ORIGINS = [o.strip() for o in _raw_cors.split(',') if o.strip()]

# 🔒 SECURITY FIX 4: Secure cookies in production (when DEBUG=False).
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'

# 🟢 ADDED: Explicitly allow the headers and methods Vite uses
CORS_ALLOW_METHODS = [
    "DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT",
]
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# --- 8. DRF CONFIGURATION ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication', 
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated', 
    ],
}


# --- 9. JAZZMIN UI CONFIGURATION ---
JAZZMIN_SETTINGS = {
    "site_title": "QR Attendance",
    "site_header": "Attendance Admin",
    "site_brand": "Admin Portal",
    "welcome_sign": "Welcome to the Attendance System",
    "copyright": "Final Year Project",
    "search_model": "core.Student",
    "hide_models": ["auth.Group", "authtoken.TokenProxy", "core.SubBranch", "core.Enrollment"], 
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.user": "fas fa-user",
        "core.Branch": "fas fa-code-branch",
        "core.Student": "fas fa-user-graduate",
        "core.Attendance": "fas fa-calendar-check",
    },
    "order_with_respect_to": ["core", "auth"],
    "show_ui_builder": False,
}

JAZZMIN_UI_TWEAKS = {
    "navbar_small_text": False, "footer_small_text": False, "body_small_text": True, "brand_small_text": False, 
    "brand_colour": "navbar-purple", "accent": "accent-purple", "navbar": "navbar-white navbar-light", 
    "no_navbar_border": True, "navbar_fixed": True, "layout_boxed": False, "footer_fixed": False, 
    "sidebar_fixed": True, "sidebar": "sidebar-light-purple", "sidebar_nav_small_text": False, 
    "theme": "pulse", "button_classes": {
        "primary": "btn-primary", "secondary": "btn-secondary", "info": "btn-info", "warning": "btn-warning", 
        "danger": "btn-danger", "success": "btn-success"
    }
}


# --- 10. EMAIL CONFIGURATION ---
# 🟢 NOTE: Links will appear in your VS Code Terminal, not your Gmail inbox!
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'your-email@gmail.com'
EMAIL_HOST_PASSWORD = 'your-app-password'