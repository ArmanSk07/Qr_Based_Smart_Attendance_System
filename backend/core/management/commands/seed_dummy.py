"""
Management command to clear ALL data and create dummy branches, subjects, and students.
Usage: python manage.py seed_dummy
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group
from core.models import Attendance, Enrollment, Student, SubBranch, Branch


DUMMY_DATA = {
    "Computer Science": {
        "subjects": ["Java", "Python", "Data Structures", "DBMS", "Operating Systems", "Computer Networks"],
        "students": [
            ("Inshira Achwwa", "0000000000"),
            ("Arman Khan", "0000000000"),
            ("Affan Ansari", "0000000000"),
            ("Arman Khan", "0000000000"),
            ("Tabish Ansari", "0000000000"),
            ("Zeedan Ansari", "0000000000"),
            ("Tasmiya Ansari", "0000000000"),
            ("Ataur Rahman", "0000000000"),
            ("Zainab Chaukar", "0000000000"),
            ("Sadiq Bhati", "0000000000"),
            ("Tarique Chaudhary", "0000000000"),
            ("Fahim Chaudhary", "0000000000"),
            ("Aamir Chawre", "0000000000"),
            ("Arman Khan", "0000000000"),
            ("Rizwana Falke", "0000000000"),
            ("Alifiya Khan", "0000000000"),
            ("Areeba Khan", "0000000000"),
            ("Arman Khan", "+918369192386"),
            ("Shifa Khan", "0000000000"),
            ("Siddique Khan", "0000000000"),
        ],
    },
    "Information Technology": {
        "subjects": ["Web Development", "Cyber Security", "Cloud Computing", "AI & ML", "Software Engineering"],
        "students": [
            ("Bilal Qureshi", "0000000000"),
            ("Farah Siddiqui", "0000000000"),
            ("Hamza Malik", "0000000000"),
            ("Priya Sharma", "0000000000"),
            ("Junaid Memon", "0000000000"),
            ("Khadija Ansari", "0000000000"),
            ("Daniel Thomas", "0000000000"),
            ("Noman Sheikh", "0000000000"),
            ("Sneha Patil", "0000000000"),
            ("Saad Hussain", "0000000000"),
        ],
    },
    "Electronics": {
        "subjects": ["Circuit Theory", "Digital Electronics", "Microprocessors", "Signal Processing", "VLSI Design", "Embedded Systems"],
        "students": [
            ("Yaseen Tamboli", "0000000000"),
            ("Mariam Qazi", "0000000000"),
            ("Rohan Kulkarni", "0000000000"),
            ("Sana Momin", "0000000000"),
            ("Owais Nadaf", "0000000000"),
            ("Joseph Fernandes", "0000000000"),
            ("Tabassum Attar", "0000000000"),
            ("Kavya Nair", "0000000000"),
            ("Waseem Desai", "0000000000"),
            ("Zoya Mulani", "0000000000"),
        ],
    },
    "Artificial Intelligence": {
        "subjects": ["Machine Learning", "Deep Learning", "NLP", "Computer Vision", "Robotics"],
        "students": [
            ("Ayaan Shaikh", "0000000000"),
            ("Rahul Tiwari", "0000000000"),
            ("Nazia Pathan", "0000000000"),
            ("Aditya Joshi", "0000000000"),
            ("Zainul Abideen", "0000000000"),
            ("Mary D'Souza", "0000000000"),
            ("Irfan Mujawar", "0000000000"),
            ("Ananya Iyer", "0000000000"),
            ("Shoaib Mulla", "0000000000"),
            ("Samuel Wilson", "0000000000"),
        ],
    },
    "Mechanical": {
        "subjects": ["Thermodynamics", "Fluid Mechanics", "Manufacturing", "CAD/CAM", "Material Science", "Automobile Engineering"],
        "students": [
            ("Rameez Sayyed", "0000000000"),
            ("Vikram Chandra", "0000000000"),
            ("Usman Bagwan", "0000000000"),
            ("Deepak Dubey", "0000000000"),
            ("Asif Patel", "0000000000"),
            ("Rebecca Mathew", "0000000000"),
            ("Faizan Memon", "0000000000"),
            ("Arjun Reddy", "0000000000"),
            ("Nafisa Kazi", "0000000000"),
            ("John Abraham", "0000000000"),
        ],
    },
}


class Command(BaseCommand):
    help = "Clears all data and creates 3 dummy branches with 5-6 subjects and 10 students each."

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("\n[!] Clearing ALL existing data..."))

        # 1. Clear everything
        Attendance.objects.all().delete()
        Enrollment.objects.all().delete()
        Student.objects.all().delete()
        SubBranch.objects.all().delete()
        Branch.objects.all().delete()

        # Clean up old Branch/Subject groups
        Group.objects.filter(name__startswith="Branch:").delete()
        Group.objects.filter(name__startswith="Subject:").delete()

        self.stdout.write(self.style.SUCCESS("[OK] All data cleared.\n"))

        # 2. Create dummy data
        for branch_name, data in DUMMY_DATA.items():
            # Create Branch (signal auto-creates Group)
            branch = Branch.objects.create(name=branch_name)
            self.stdout.write(self.style.SUCCESS(f"[Branch] {branch_name}"))

            # Create Subjects (signal auto-creates Group + auto-enrolls students)
            for sub_name in data["subjects"]:
                SubBranch.objects.create(branch=branch, name=sub_name)
                self.stdout.write(f"   [Subject] {sub_name}")

            # Create Students (signal auto-enrolls in all subjects)
            for roll, (name, phone) in enumerate(data["students"], start=1):
                Student.objects.create(
                    name=name,
                    roll_no=roll,
                    branch=branch,
                    phone=phone,
                )
                self.stdout.write(f"   [Student #{roll}] {name}")

            self.stdout.write("")  # blank line

        # Summary
        self.stdout.write(self.style.SUCCESS(
            f"\n[DONE] Created:"
            f"\n   * {Branch.objects.count()} Branches"
            f"\n   * {SubBranch.objects.count()} Subjects"
            f"\n   * {Student.objects.count()} Students"
            f"\n   * {Enrollment.objects.count()} Enrollments (auto)"
            f"\n   * {Attendance.objects.count()} Attendance records"
        ))