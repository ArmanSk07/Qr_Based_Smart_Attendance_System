from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"
    verbose_name = "Attendance Management"  # sidebar name

    def ready(self):
        # signals ko import karna zaroori hai, tabhi wo register honge
        import core.signals  # noqa
