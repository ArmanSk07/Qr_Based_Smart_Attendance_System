from rest_framework import serializers
from .models import Branch, SubBranch, Student, Attendance

# ------------------- BRANCH -------------------
class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = "__all__"


# ------------------- SUB-BRANCH -------------------
class SubBranchSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    students_count = serializers.IntegerField(source="students.count", read_only=True)

    class Meta:
        model = SubBranch
        fields = [
            "id", "name", "branch", "branch_name", 
            "students_count", "created_at"
        ]


# ------------------- STUDENT -------------------
class StudentSerializer(serializers.ModelSerializer):
    sub_branches = serializers.PrimaryKeyRelatedField(
        many=True, read_only=True
    )
    sub_branches_detail = SubBranchSerializer(
        source="sub_branches", many=True, read_only=True
    )

    class Meta:
        model = Student
        fields = [
            "id", "name", "roll_no", "phone", "branch", 
            "qr_payload", "photo", "created_at", 
            "sub_branches", "sub_branches_detail"
        ]

    # 🟢 NEW: Prevent 'Recursive URL' corruption when editing
    # If the frontend sends the existing URL string (instead of a new file),
    # we remove it from the data so Django doesn't try to save the text as a file.
    def update(self, instance, validated_data):
        photo_data = validated_data.get('photo')
        
        if photo_data and isinstance(photo_data, str):
            validated_data.pop('photo') # Ignore string URLs

        return super().update(instance, validated_data)


# ------------------- ATTENDANCE -------------------
class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    sub_branch_name = serializers.CharField(source="sub_branch.name", read_only=True)

    class Meta:
        model = Attendance
        fields = [
            "id", "student", "student_name", 
            "sub_branch", "sub_branch_name", 
            "date", "present", "timestamp"
        ]