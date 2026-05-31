from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User, Group
from django.forms import CheckboxSelectMultiple
from django.db import models
from django.db.models import Q
from django.utils.html import format_html
from django.urls import reverse

# Import your models
from .models import Branch, SubBranch, Student, Attendance, Enrollment, UserRole, CampusLocation

# ==============================================================================
# 1. CUSTOM FILTER: BRANCH & SUB-BRANCH GROUPS
# ==============================================================================

class BranchGroupFilter(admin.SimpleListFilter):
    title = 'Branch Context'
    parameter_name = 'branch_context'

    def lookups(self, request, model_admin):
        # Shows all Branches in the filter dropdown
        branches = Branch.objects.all()
        return [(b.id, b.name) for b in branches]

    def queryset(self, request, queryset):
        # If a branch is selected...
        if self.value():
            branch_id = self.value()
            try:
                # 1. Get the Branch object
                branch = Branch.objects.get(id=branch_id)
                
                # 2. Get all SubBranches for this Branch
                sub_branches = SubBranch.objects.filter(branch=branch)
                
                # 3. Create a list of group names we want to see
                #    A. The Branch Group itself (e.g., "Branch: CS")
                target_names = [f"Branch: {branch.name}"]
                
                #    B. All Subject Groups (e.g., "Subject: Java")
                for sb in sub_branches:
                    target_names.append(f"Subject: {sb.name}")

                # 4. Filter the list to show ONLY these groups
                return queryset.filter(name__in=target_names)
                
            except Branch.DoesNotExist:
                return queryset
        return queryset

# ==============================================================================
# 2. TREE STRUCTURE LOGIC (Helper Function)
# ==============================================================================

def get_tree_style_users(group_name):
    try:
        group = Group.objects.get(name=group_name)
        users = group.user_set.all()
        
        if not users.exists():
            return format_html('<span style="color: #999;">No users assigned</span>')
        
        html_content = '<ul style="margin: 0; padding-left: 10px; list-style: none;">'
        for user in users:
            role = " (Admin)" if user.is_superuser else ""
            html_content += f'<li style="padding: 2px 0;">↳ <strong>{user.username}</strong>{role}</li>'
        html_content += '</ul>'
        
        return format_html(html_content)
    except Group.DoesNotExist:
        return format_html('<span style="color: red;">Group not found (Save to create)</span>')

# ==============================================================================
# 3. GROUP ADMIN (UserRole) - NOW WITH BRANCH FILTER
# ==============================================================================

# Unregister default Group
admin.site.unregister(Group)

class UserInline(admin.TabularInline):
    model = User.groups.through
    extra = 1
    verbose_name = "User in this Group"
    verbose_name_plural = "Add Users to this Group"

@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    fields = ('name',) 
    list_display = ('hierarchy_name', 'parent_branch', 'view_users_in_list') 
    inlines = [UserInline]
    search_fields = ('name',)  

    # --- ADDED THE CUSTOM FILTER HERE ---
    list_filter = (BranchGroupFilter,) 

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Annotate with a sort key: Branch groups first, then Subject groups sorted by their parent branch
        from django.db.models import Case, When, Value, IntegerField, CharField
        qs = qs.annotate(
            sort_type=Case(
                When(name__startswith='Branch:', then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            ),
        ).order_by('sort_type', 'name')
        return qs

    def hierarchy_name(self, obj):
        """Display Branch groups normally, Subject groups indented with a tree marker."""
        name = obj.name
        if name.startswith('Branch:'):
            branch_label = name.replace('Branch: ', '').strip()
            return format_html(
                '<strong style="font-size:1.05em; color:#4f46e5;">🏛️ {}</strong>',
                branch_label
            )
        elif name.startswith('Subject:'):
            subject_label = name.replace('Subject: ', '').strip()
            return format_html(
                '<span style="padding-left:30px; color: var(--text-secondary, #555);">└── 📚 {}</span>',
                subject_label
            )
        return name
    hierarchy_name.short_description = "Name (Hierarchy)"
    hierarchy_name.admin_order_field = 'name'

    def parent_branch(self, obj):
        """For Subject groups, show which Branch they belong to."""
        name = obj.name
        if name.startswith('Subject:'):
            subject_label = name.replace('Subject: ', '').strip()
            # Find the SubBranch model to get the parent Branch
            try:
                sb = SubBranch.objects.filter(name=subject_label).first()
                if sb:
                    return format_html(
                        '<span style="background:#e0e7ff; color:#4338ca; padding:2px 10px; border-radius:12px; font-size:0.85em; font-weight:600;">{}</span>',
                        sb.branch.name
                    )
            except Exception:
                pass
            return format_html('<span style="color:#999;">—</span>')
        elif name.startswith('Branch:'):
            return format_html('<span style="color:#10b981; font-weight:600;">Root</span>')
        return '—'
    parent_branch.short_description = "Belongs To"

    def view_users_in_list(self, obj):
        return get_tree_style_users(obj.name)
    view_users_in_list.short_description = "Members"

# ==============================================================================
# 4. CUSTOM USER ADMIN
# ==============================================================================

admin.site.unregister(User)

@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    formfield_overrides = {
        models.ManyToManyField: {'widget': CheckboxSelectMultiple},
    }
    list_display = ('username', 'first_name', 'get_assignments', 'is_staff')
    list_filter = ('groups', 'is_staff', 'is_superuser')
    search_fields = ('username', 'first_name', 'email')

    def get_assignments(self, obj):
        return ", ".join([g.name for g in obj.groups.all()])
    get_assignments.short_description = 'Assigned Role'

    # 🟢 FIX: Removed 'password' from the General fieldset to hide the raw hash!
    fieldsets = (
        ("General", {'fields': ('username',)}), 
        ('Personal Info', {'fields': ('first_name', 'last_name', 'email')}),
        ('Assignments', {
            'fields': ('groups',),
            'description': 'Select Branch/Subject group here.',
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser'),
            'classes': ('collapse',),
        }),
    )

# ==============================================================================
# 5. BRANCH ADMIN
# ==============================================================================

@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("name", "view_connected_users", "created_at")
    search_fields = ("name",)
    list_filter = ("created_at",)

    def view_connected_users(self, obj):
        group_name = f"Branch: {obj.name}"
        return get_tree_style_users(group_name)
    
    view_connected_users.short_description = "Teachers Working Here (Tree)"

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        Group.objects.get_or_create(name=f"Branch: {obj.name}")

# ==============================================================================
# 6. SUB-BRANCH ADMIN
# ==============================================================================

@admin.register(SubBranch)
class SubBranchAdmin(admin.ModelAdmin):
    list_display = ("name", "branch", "view_connected_users")
    list_filter = ("branch", "created_at")
    search_fields = ("name", "branch__name") 

    def view_connected_users(self, obj):
        group_name = f"Subject: {obj.name}"
        return get_tree_style_users(group_name)
    view_connected_users.short_description = "Users Assigned"

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        Group.objects.get_or_create(name=f"Subject: {obj.name}")


# ==============================================================================
# 7. STUDENT ADMIN
# ==============================================================================

class EnrollmentInline(admin.TabularInline):
    model = Enrollment
    extra = 1
    # We use raw_id_fields to prevent the 500 error if the list is too long
    raw_id_fields = ("sub_branch",)

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("name", "roll_no", "branch", "qr_payload")
    list_filter = ("branch",)
    search_fields = ("name", "roll_no", "qr_payload")
    
    # 🔴 THIS IS THE FIX: We exclude 'sub_branches' because we are using the Inline table below.
    # If you remove this line, the server WILL crash.
    exclude = ("sub_branches",)

    inlines = [EnrollmentInline]

    

# ==============================================================================
# 8. ATTENDANCE & ENROLLMENT
# ==============================================================================

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("student", "sub_branch", "date", "present")
    list_filter = ("date", "sub_branch", "present")
    search_fields = ("student__name", "student__roll_no")

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("student", "sub_branch")
    list_filter = ("sub_branch",)
    search_fields = ("student__name", "sub_branch__name")


# ==============================================================================
# 9. CAMPUS LOCATION ADMIN
# ==============================================================================

@admin.register(CampusLocation)
class CampusLocationAdmin(admin.ModelAdmin):
    list_display = ("name", "location_scope", "latitude", "longitude", "allowed_radius_meters", "is_active", "created_at")
    list_filter = ("is_active", "branch")
    search_fields = ("name", "branch__name")
    list_editable = ("is_active", "allowed_radius_meters")
    ordering = ("branch__name", "name")

    fieldsets = (
        ("Location Info", {
            "fields": ("branch", "name", "latitude", "longitude"),
            "description": (
                "🌐 Leave 'Branch' BLANK to create a GLOBAL location that applies to ALL branches. "
                "Or select a specific branch to restrict this zone to that branch only."
            ),
        }),
        ("Radius & Status", {
            "fields": ("allowed_radius_meters", "is_active"),
            "description": "Set how far (in meters) from this point attendance is allowed.",
        }),
    )

    def location_scope(self, obj):
        if obj.branch is None:
            return format_html(
                '<span style="background:#10b981; color:white; padding:2px 10px; '
                'border-radius:12px; font-size:0.85em; font-weight:600;">🌐 Global (All Branches)</span>'
            )
        return format_html(
            '<span style="background:#4f46e5; color:white; padding:2px 10px; '
            'border-radius:12px; font-size:0.85em; font-weight:600;">🏛️ {}</span>',
            obj.branch.name
        )
    location_scope.short_description = "Scope (Branch)"
    location_scope.admin_order_field = "branch__name"