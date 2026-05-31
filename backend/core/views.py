from datetime import datetime, date
import os
import re  # Regex for phone validation
from django.conf import settings 
from django.contrib.auth import authenticate
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.utils import timezone


from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str


# DRF Imports
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token 
from rest_framework import status

# Twilio
from twilio.rest import Client
import dotenv
dotenv.load_dotenv() # <---- Loading and running .env file all time

# Local Imports
from .models import Branch, SubBranch, Student, Attendance, Enrollment, CampusLocation
from .serializers import (
    BranchSerializer, SubBranchSerializer, 
    StudentSerializer, AttendanceSerializer
)

# Geo-location validation
from geopy.distance import geodesic

# -------------------- TWILIO ENV CONFIG --------------------
TWILIO_SID = os.environ.get("TWILIO_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_FROM", "")


# -------------------- GEO-LOCATION VALIDATION HELPER --------------------

def _validate_geo_location(branch_id, latitude, longitude):
    """
    Server-side geo-validation.

    Returns (is_allowed: bool, error_message: str | None).

    Rules:
    - Checks BOTH branch-specific locations AND global locations (branch=NULL).
    - If NO active locations exist at all (branch-specific + global) → always allowed (backward compat).
    - If active locations exist but coordinates are missing → rejected.
    - If coordinates are provided → allowed if inside ANY active location's radius.
    """
    from django.db.models import Q

    # Fetch active locations: branch-specific + global (branch=NULL)
    active_locations = CampusLocation.objects.filter(
        Q(branch_id=branch_id) | Q(branch__isnull=True),
        is_active=True,
    )

    if not active_locations.exists():
        # No geo-fence configured at all — allow attendance normally
        return True, None

    if latitude is None or longitude is None:
        return False, "Location is required for this campus. Please enable location access."

    try:
        device_coords = (float(latitude), float(longitude))
    except (TypeError, ValueError):
        return False, "Invalid location coordinates received."

    for location in active_locations:
        center_coords = (float(location.latitude), float(location.longitude))
        distance_meters = geodesic(device_coords, center_coords).meters
        if distance_meters <= location.allowed_radius_meters:
            return True, None  # Inside at least one valid zone

    return False, "You are outside the allowed campus area. Attendance not permitted."


# -------------------- AUTHENTICATION LOGIN PAGE--------------------

@api_view(["POST"])
@permission_classes([AllowAny]) 
def api_login(request):
    username = request.data.get("username")
    password = request.data.get("password")
    
    user = authenticate(username=username, password=password)
    
    if user is not None:
        token, created = Token.objects.get_or_create(user=user)
        
        # 🟢 NEW: Get list of group names (e.g., ['Branch: Computer'])
        groups = list(user.groups.values_list('name', flat=True))
        
        return Response({
            "status": "success", 
            "token": token.key,           
            "username": user.username,
            "is_superuser": user.is_superuser,
            "groups": groups # 🟢 ADDED THIS
        })
    else:
        return Response(
            {"status": "error", "message": "Invalid Credentials"}, status=401
        )

@api_view(["POST"])
@permission_classes([AllowAny])
def change_password(request):
    username = request.data.get("username")
    old_password = request.data.get("old_password")
    new_password = request.data.get("new_password")
    
    user = authenticate(username=username, password=old_password)
    if user is not None:
        user.set_password(new_password)
        user.save()
        return Response({"status": "success", "message": "Password Updated"})
    else:
        return Response(
            {"status": "error", "message": "Old Password Incorrect"}, status=400
        )


# -------------------- DATA VIEWSETS --------------------

class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [IsAuthenticated] 

class SubBranchViewSet(viewsets.ModelViewSet):
    queryset = SubBranch.objects.all()
    serializer_class = SubBranchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SubBranch.objects.all()
        branch_id = self.request.query_params.get("branch")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]


# -------------------- ATTENDANCE (Manual) --------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_attendance(request):
    student_id = request.data.get("studentId")
    sub_branch_id = request.data.get("subBranchId") or request.data.get("sub_branch_id")
    date_str = request.data.get("date")

    # 🟢 GEO: Read optional coordinates from frontend
    latitude = request.data.get("latitude")
    longitude = request.data.get("longitude")

    if not student_id or not sub_branch_id or not date_str:
        return Response({"status": "error", "message": "Missing Data"}, status=400)

    try:
        student = Student.objects.get(id=student_id)
        sub_branch = SubBranch.objects.get(id=sub_branch_id, branch=student.branch)
    except (Student.DoesNotExist, SubBranch.DoesNotExist):
        return Response({"status": "error", "message": "Not Found"}, status=404)

    # 🟢 GEO VALIDATION (server-side, using branch from the student record)
    geo_allowed, geo_error = _validate_geo_location(student.branch_id, latitude, longitude)
    if not geo_allowed:
        return Response({"status": "error", "message": geo_error}, status=403)

    Enrollment.objects.get_or_create(student=student, sub_branch=sub_branch)

    try:
        mark_date = date.fromisoformat(date_str)
    except ValueError:
        return Response({"status": "error", "message": "Invalid Date"}, status=400)

    # 🟢 ---------------- START WEEKEND BLOCK ---------------- 🟢
    # 5 = Saturday, 6 = Sunday. 
    # To allow Saturday, remove "or mark_date.weekday() == 5"
    if mark_date.weekday() == 5 or mark_date.weekday() == 6:
        return Response({"status": "error", "message": "Cannot mark attendance on Weekends (Sat/Sun)!"}, status=400)
    # 🟢 ---------------- END WEEKEND BLOCK ---------------- 🟢

    #  RESTRICTION: Only Allow Current Month
    today = datetime.now().date()
    if mark_date.month != today.month or mark_date.year != today.year:
        return Response(
            {"status": "error", "message": "Attendance modification is locked for past or future months."}, 
            status=403
        )

    if Attendance.objects.filter(student=student, sub_branch=sub_branch, date=mark_date).exists():
        return Response({"status": "exists", "message": "Already marked"})

    Attendance.objects.create(
        student=student, sub_branch=sub_branch, date=mark_date, present=True
    )
    return Response({"status": "success"})


# -------------------- ATTENDANCE (Via QR Link) --------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mark_attendance_via_browser(request, subject_id):
    subject = get_object_or_404(SubBranch, id=subject_id)
    
    # 🟢 ---------------- START WEEKEND BLOCK (BROWSER) ---------------- 🟢
    today_check = date.today()
    if today_check.weekday() == 5 or today_check.weekday() == 6:
        return HttpResponse(f"""
            <div style='text-align:center; padding-top:50px; font-family:sans-serif;'>
                <h1 style='color:red;'>⛔ Weekend Access Denied</h1>
                <p>You cannot mark attendance on Saturday or Sunday.</p>
            </div>
        """)
    # 🟢 ---------------- END WEEKEND BLOCK ---------------- 🟢

  # 🟢 FIXED: Student model has no 'user' field, so we match by name only.
    student = Student.objects.filter(name=request.user.username).first()
    
    if not student:
        return HttpResponse(f"❌ Error: No Student found for user {request.user.username}", status=404)

    # Always marks for TODAY
    attendance, created = Attendance.objects.get_or_create(
        student=student,
        sub_branch=subject,
        date=date.today(),
        defaults={'present': True}
    )

    if created:
        return HttpResponse(f"""
            <div style='text-align:center; padding-top:50px; font-family:sans-serif;'>
                <h1 style='color:green; font-size:40px;'>✅ Success!</h1>
                <p>Attendance Marked for <strong>{subject.name}</strong></p>
                <p>Student: {student.name}</p>
            </div>
        """)
    else:
        return HttpResponse(f"""
            <div style='text-align:center; padding-top:50px; font-family:sans-serif;'>
                <h1 style='color:orange;'>⚠️ Already Marked</h1>
                <p>You are already present for <strong>{subject.name}</strong> today.</p>
            </div>
        """)


# -------------------- ATTENDANCE (QR Payload) --------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_attendance_qr(request):
    qr_payload_raw = request.data.get("qrPayload") or request.data.get("qr_payload")
    sub_branch_id = request.data.get("subBranchId") or request.data.get("sub_branch_id")
    date_str = request.data.get("date")

    if not qr_payload_raw or not sub_branch_id:
        return Response({"status": "error", "message": "Missing QR or Subject"}, status=400)

    payload = str(qr_payload_raw).strip().strip('"')
    scanned_id = payload

    if payload.startswith("SECURE_APP_VER1:"):
        scanned_id = payload.split(":", 1)[1].strip()

    # 🟢 FIX 2: Prevent Overlap by scoping student search strictly to the active branch
    sub_branch = get_object_or_404(SubBranch, id=sub_branch_id)
    current_branch = sub_branch.branch

    # 🟢 GEO VALIDATION (server-side)
    latitude = request.data.get("latitude")
    longitude = request.data.get("longitude")
    geo_allowed, geo_error = _validate_geo_location(current_branch.id, latitude, longitude)
    if not geo_allowed:
        return Response({"status": "error", "message": geo_error}, status=403)

    student = Student.objects.filter(qr_payload=payload, branch=current_branch).first()
    if student is None and scanned_id.isdigit():
        student = Student.objects.filter(id=int(scanned_id), branch=current_branch).first()
    if student is None:
        student = Student.objects.filter(roll_no=scanned_id, branch=current_branch).first()

    if student is None:
        return Response({"status": "error", "message": "Student not found in this branch"}, status=404)

    # Enroll if not already enrolled in this sub-branch
    Enrollment.objects.get_or_create(student=student, sub_branch=sub_branch)

    if date_str:
        try:
            mark_date = date.fromisoformat(date_str)
        except ValueError:
            return Response({"status": "error", "message": "Invalid Date"}, status=400)
    else:
        mark_date = datetime.now().date()

    # 🟢 ---------------- START WEEKEND BLOCK (QR) ---------------- 🟢
    if mark_date.weekday() == 5 or mark_date.weekday() == 6:
        return Response({"status": "error", "message": "Cannot mark attendance on Weekends (Sat/Sun)!"}, status=400)
    # 🟢 ---------------- END WEEKEND BLOCK ---------------- 🟢

    #  RESTRICTION: Only Allow Current Month
    today = datetime.now().date()
    if mark_date.month != today.month or mark_date.year != today.year:
        return Response(
            {"status": "error", "message": "Attendance modification is locked for past or future months."}, 
            status=403
        )

    # 🟢 FIX 1: Check if Already Marked BEFORE creating a new record
    if Attendance.objects.filter(student=student, sub_branch=sub_branch, date=mark_date).exists():
        return Response({
            "status": "exists", 
            "message": "Already marked",
            "student": student.name,
            "subBranch": sub_branch.name,
            "date": str(mark_date)
        })

    attendance, created = Attendance.objects.get_or_create(
        student=student, sub_branch=sub_branch, date=mark_date,
        defaults={"present": True}
    )

    if not created:
        attendance.present = True
        attendance.save()

    return Response({
        "status": "success",
        "student": student.name,
        "subBranch": sub_branch.name,
        "date": str(mark_date),
        "created": created
    })


# -------------------- GET CAMPUS LOCATIONS (for branch) --------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_campus_locations(request):
    """
    Returns active CampusLocations for a given branch.
    Frontend uses this to know whether geo-validation is required.
    Query param: ?branch_id=<id>
    """
    branch_id = request.query_params.get("branch_id")
    if not branch_id:
        return Response({"status": "error", "message": "branch_id is required"}, status=400)

    locations = CampusLocation.objects.filter(branch_id=branch_id, is_active=True).values(
        "id", "name", "latitude", "longitude", "allowed_radius_meters"
    )
    return Response({"status": "ok", "locations": list(locations)})


# -------------------- GET ATTENDANCE LIST --------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_attendance(request):
    attendance = Attendance.objects.all()
    serializer = AttendanceSerializer(attendance, many=True)
    
    data = []
    for record in serializer.data:
        data.append({
            "id": record["id"],
            "studentId": record["student"],
            "subBranchId": record.get("sub_branch"),
            "date": record["date"],
            "present": record["present"],
        })
    return Response(data)


# -------------------- MONTHLY SMS ALERT (UPDATED) --------------------
# -------------------- MONTHLY SMS ALERT (UPDATED) --------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def check_and_alert(request):
    today = datetime.now()
    current_month = today.month
    current_year = today.year
    
    # 🟢 ---------------- START WEEKEND CALCULATION LOGIC ---------------- 🟢
    days_passed = 0
    for d in range(1, today.day + 1):
        day_date = datetime(current_year, current_month, d)
        
        # NOTE: To include Saturday as a working day, remove "and day_date.weekday() != 5"
        if day_date.weekday() != 5 and day_date.weekday() != 6:
            days_passed += 1

    if days_passed == 0: 
        days_passed = 1
    # 🟢 ---------------- END WEEKEND CALCULATION LOGIC ---------------- 🟢

    # 1. Get the branch ID from the frontend request
    branch_id = request.data.get("branchId") or request.data.get("branch_id")

    # 2. Filter students based on the active branch
    if branch_id:
        students = Student.objects.filter(branch_id=branch_id)
        print(f"DEBUG: Found {students.count()} students in branch ID {branch_id}")
    else:
        return Response({"status": "error", "message": "Branch ID is required to send SMS"}, status=400)

    alerts_sent = 0
    client = None

    if TWILIO_SID and TWILIO_TOKEN:
        try:
            client = Client(TWILIO_SID, TWILIO_TOKEN)
        except Exception as e:
            print(f"Twilio Init Error: {e}")

    try:
        for student in students:
            present_count = Attendance.objects.filter(
                student=student,
                date__year=current_year,
                date__month=current_month,
                present=True,
            ).count()

            percentage = (present_count / days_passed) * 100 if days_passed > 0 else 0
            
            print(f"Checking {student.name}: Present={present_count}/{days_passed} ({percentage}%) Phone={student.phone}")

            if percentage < 75:
                # 🟢 ---------------- START PHONE VALIDATION ---------------- 🟢
                if student.phone and client:
                    raw_phone = str(student.phone).strip()

                    # 1. Remove any spaces or dashes to get clean digits
                    clean_phone = re.sub(r'\s+|-', '', raw_phone)

                    # 2. If it is 10 digits, add +91 automatically
                    if len(clean_phone) == 10 and clean_phone.isdigit():
                        clean_phone = "+91" + clean_phone

                    # 3. STRICT CHECK: Must start with +91, then 6,7,8 or 9, then 9 more digits
                    is_valid_indian = re.match(r'^\+91[6-9]\d{9}$', clean_phone)

                    # 4. 🟢 DUMMY NUMBER BLOCKER (Saves Twilio Credits)
                    is_dummy = False
                    if is_valid_indian:
                        ten_digits = clean_phone.replace("+91", "")
                        
                        # Rule A: All same digits (e.g., 9999999999, 8888888888)
                        if len(set(ten_digits)) == 1:
                            is_dummy = True
                        
                        # Rule B: Common sequential numbers
                        elif ten_digits in ["9876543210", "8765432109", "1234567890"]:
                            is_dummy = True
                            
                        # Rule C: Too many repeating zeros (e.g., 9000000000)
                        elif ten_digits.count('0') >= 7:
                            is_dummy = True

                    # Final decision: Skip if it failed regex OR if it was flagged as a dummy
                    if not is_valid_indian or is_dummy:
                        print(f"💰 SAVE CREDIT: Skipped {student.name} due to invalid/dummy number: {raw_phone}")
                        continue 
                    
                    # 🟢 ---------------- END PHONE VALIDATION ---------------- 🟢

                    msg = f"ALERT: {student.name} has {int(percentage)}% attendance. Please attend regularly."
                    
                    try:
                        client.messages.create(body=msg, from_=TWILIO_FROM, to=clean_phone)
                        print(f"SUCCESS: Sent to {student.name}")
                        alerts_sent += 1
                    except Exception as e:
                        print(f"Twilio Error for {student.name}: {e}")
                else:
                     print(f"SKIPPED {student.name}: Missing Phone or Client not ready.")
            else:
                print(f"SKIPPED {student.name}: Attendance is Good ({int(percentage)}%)")

        return Response({"status": "success", "sent_count": alerts_sent, "branch_filtered": True})
    except Exception as e:
        print("Global Twilio Error:", e)
        return Response({"status": "error", "message": str(e)}, status=500)

# -------------------- BACKUP / RESTORE --------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def restore_database(request):
    data = request.data
    try:
        with transaction.atomic():
            Attendance.objects.all().delete()
            Enrollment.objects.all().delete()
            Student.objects.all().delete()
            SubBranch.objects.all().delete()
            Branch.objects.all().delete()

            for b in data.get("branches", []):
                Branch.objects.create(
                    id=b["id"], name=b["name"], created_at=b.get("created_at")
                )

            sub_list = data.get("subBranches", []) or data.get("sub_branches", [])
            for sb in sub_list:
                branch_val = sb.get("branchId") or sb.get("branch")
                SubBranch.objects.create(
                    id=sb["id"], name=sb["name"], branch_id=branch_val, created_at=sb.get("created_at")
                )

            for s in data.get("students", []):
                photo_val = s.get("photoDataUrl") or s.get("photo_url") or s.get("photo")
                branch_val = s.get("branchId") or s.get("branch")
                
                student = Student.objects.create(
                    id=s["id"],
                    name=s["name"],
                    roll_no=s.get("rollNo") or s.get("roll_no"),
                    branch_id=branch_val,
                    qr_payload=s.get("qrPayload") or s.get("qr_payload") or "",
                    photo=photo_val,
                    phone=s.get("phone"),
                    created_at=s.get("created_at"),
                )

                sub_val = s.get("subBranchId") or s.get("sub_branch")
                if sub_val:
                    if SubBranch.objects.filter(id=sub_val).exists():
                        Enrollment.objects.get_or_create(student=student, sub_branch_id=sub_val)

            for a in data.get("attendance", []):
                sub_val = a.get("subBranchId") or a.get("sub_branch")
                if sub_val:
                    Attendance.objects.create(
                        id=a["id"],
                        student_id=a["studentId"],
                        sub_branch_id=sub_val,
                        date=a["date"],
                        present=a["present"]
                    )

        return Response({"status": "success"})
    except Exception as e:
        print("Restore Error:", str(e))
        return Response({"status": "error", "message": str(e)}, status=400)


        # -------------------- FORGOT PASSWORD LOGIC --------------------

@api_view(["POST"])
@permission_classes([AllowAny])
def request_password_reset(request):
    email_or_username = request.data.get("identifier")
    
    user = User.objects.filter(email=email_or_username).first() or \
           User.objects.filter(username=email_or_username).first()

    if user and user.email:
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        
        # This link will point to your React Frontend Route
        reset_link = f"http://localhost:5173/reset-password/{uid}/{token}/"
        
        # 🟢 CHANGED: Instead of send_mail(), we return the email and link to React!
        return Response({
            "status": "success", 
            "message": "User found. Link generated.",
            "reset_link": reset_link,
            "user_email": user.email
        })
    
    return Response({"status": "error", "message": "User or registered email not found."}, status=404)

@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password_confirm(request, uidb64, token):
    """Validates token and sets new password."""
    new_password = request.data.get("new_password")
    
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user, token):
        user.set_password(new_password)
        user.save()
        return Response({"status": "success", "message": "Password has been reset successfully."})
    
    return Response({"status": "error", "message": "Invalid or expired reset link."}, status=400)