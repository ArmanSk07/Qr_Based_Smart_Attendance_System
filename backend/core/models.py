from django.db import models
import uuid
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import Group

# ==============================================================================
# 1. CORE MODELS
# ==============================================================================

class Branch(models.Model):
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class SubBranch(models.Model):
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name="sub_branches",
    )
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.branch.name} - {self.name}"


class Student(models.Model):
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name="students",
    )
    sub_branches = models.ManyToManyField(
        SubBranch,
        through="Enrollment",
        related_name="students",
        blank=True,
    )

    name = models.CharField(max_length=100)
    
    # 🟢 CHANGED: IntegerField ensures 1, 2, 10 sorts correctly (not 1, 10, 2)
    roll_no = models.IntegerField() 
    
    phone = models.CharField(max_length=15, blank=True, null=True)

    # 1 student = 1 QR Payload
    qr_payload = models.CharField(max_length=100, unique=True, blank=True)
    photo = models.ImageField(upload_to="student_photos/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # 🟢 NEW: This creates the default sorting for Admin & API
    class Meta:
        ordering = ['roll_no'] 

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.qr_payload:
            self.qr_payload = f"{self.roll_no}-{uuid.uuid4().hex[:6]}"
        super().save(*args, **kwargs)


class Enrollment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    sub_branch = models.ForeignKey(SubBranch, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "sub_branch")

    def __str__(self):
        return f"{self.student.name} -> {self.sub_branch}"


class Attendance(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    sub_branch = models.ForeignKey(
        SubBranch,
        on_delete=models.CASCADE,
        related_name="attendance",
    )
    date = models.DateField()
    present = models.BooleanField(default=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "sub_branch", "date")

    def __str__(self):
        return f"{self.student.name} - {self.sub_branch} - {self.date}"


# ==============================================================================
# 1b. GEO-LOCATION MODEL
# ==============================================================================

class CampusLocation(models.Model):
    """
    Defines an allowed attendance zone.

    - branch = a specific Branch  →  applies ONLY to that branch.
    - branch = NULL (leave blank) →  GLOBAL root location, applies to ALL branches.

    Attendance is allowed if device is within allowed_radius_meters of
    ANY active location that matches the branch OR any active global location.
    """
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name="campus_locations",
        null=True,
        blank=True,
        help_text="Leave blank to create a GLOBAL location that applies to ALL branches.",
    )
    name = models.CharField(max_length=150, help_text="Human-readable label, e.g. 'Main Campus' or 'Lab 2'")
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    allowed_radius_meters = models.PositiveIntegerField(
        default=100,
        help_text="Radius in meters within which attendance is allowed"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Global locations (branch=NULL) sort first
        ordering = ["branch__name", "name"]

    def __str__(self):
        status = "✅" if self.is_active else "❌"
        branch_label = self.branch.name if self.branch else "🌐 ALL BRANCHES (Global)"
        return f"{status} {branch_label} → {self.name} ({self.allowed_radius_meters}m)"


# ==============================================================================
# 2. AUTOMATION SIGNALS
# ==============================================================================

@receiver(post_save, sender=Branch)
def create_group_for_branch(sender, instance, created, **kwargs):
    if created:
        Group.objects.get_or_create(name=f"Branch: {instance.name}")

@receiver(post_save, sender=SubBranch)
def create_group_for_subbranch(sender, instance, created, **kwargs):
    if created:
        Group.objects.get_or_create(name=f"Subject: {instance.name}")

# ==============================================================================
# 3. PROXY MODEL
# ==============================================================================

class UserRole(Group):
    class Meta:
        proxy = True
        verbose_name = "Group"
        verbose_name_plural = "Groups"