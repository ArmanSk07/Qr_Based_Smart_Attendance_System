from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.contrib.auth.models import Group
from .models import Branch, SubBranch, Student, Enrollment


# ==========================================
# 1. PERMISSION GROUP SIGNALS (BRANCH ONLY)
# ==========================================

# We ONLY create groups for Branches (Parent).
# We do NOT create groups for Subjects (Child).
# This creates the behavior you want: Assigning the Branch automatically 
# gives access to all its Subjects without needing extra checkboxes.

@receiver(post_save, sender=Branch)
def manage_branch_group(sender, instance, created, **kwargs):
    """
    Creates/Updates 'Branch: [Name]' group.
    """
    group_name = f"Branch: {instance.name}"
    Group.objects.get_or_create(name=group_name)

@receiver(post_delete, sender=Branch)
def delete_branch_group(sender, instance, **kwargs):
    """
    Deletes 'Branch: [Name]' group when Branch is deleted.
    """
    group_name = f"Branch: {instance.name}"
    Group.objects.filter(name=group_name).delete()


# ==========================================
# 2. ENROLLMENT LOGIC (EXISTING)
# ==========================================

@receiver(post_save, sender=SubBranch)
def enroll_existing_students_to_new_subject(sender, instance, created, **kwargs):
    """
    Enroll existing branch students into new subject.
    """
    if not created:
        return

    branch = instance.branch
    students = Student.objects.filter(branch=branch)

    for student in students:
        Enrollment.objects.get_or_create(
            student=student,
            sub_branch=instance,
        )


@receiver(post_save, sender=Student)
def enroll_new_student_to_existing_subjects(sender, instance, created, **kwargs):
    """
    Enroll new student into all branch subjects.
    """
    if not created:
        return

    branch = instance.branch
    subjects = SubBranch.objects.filter(branch=branch)

    for sub in subjects:
        Enrollment.objects.get_or_create(
            student=instance,
            sub_branch=sub,
        )