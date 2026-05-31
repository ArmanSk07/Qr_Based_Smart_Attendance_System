from django.contrib import admin
# for importing image and repath for pfp and students image
from django.urls import path, include, re_path 
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from django.views.static import serve

# Import your views
# 🟢 FIXED: Added request_password_reset and reset_password_confirm to the import list
from core.views import (
    BranchViewSet, SubBranchViewSet, StudentViewSet,
    mark_attendance, get_attendance, mark_attendance_qr,
    restore_database, api_login, change_password, check_and_alert,
    mark_attendance_via_browser,
    request_password_reset,
    reset_password_confirm,
    get_campus_locations,
)

router = DefaultRouter()
router.register(r"branches", BranchViewSet)
router.register(r"sub-branches", SubBranchViewSet)
router.register(r"students", StudentViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),

    # --- THIS IS THE NEW LINE FOR THE QR CODE ---
    path("mark-attendance/<int:subject_id>/", mark_attendance_via_browser),

    path("api/", include(router.urls)),
    
    # Custom Endpoints
    path("api/mark-attendance/", mark_attendance),
    path("api/mark-attendance-qr/", mark_attendance_qr),
    path("api/get-attendance/", get_attendance),
    path("api/restore/", restore_database),
    path("api/login/", api_login),
    path("api/change-password/", change_password),
    path("api/send-alerts/", check_and_alert),
    
    # 🟢 Password Reset Endpoints
    path("api/request-reset/", request_password_reset),
    path("api/reset-confirm/<uidb64>/<token>/", reset_password_confirm),

    # 🟢 Geo-Location Endpoints
    path("api/campus-locations/", get_campus_locations),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
]