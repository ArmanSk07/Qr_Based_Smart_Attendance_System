document.addEventListener("DOMContentLoaded", function() {
    // Find the actions dropdown
    const actionSelect = document.querySelector('select[name="action"]');
    if (actionSelect) {
        // Find the first option (which is usually empty "---------")
        const defaultOption = actionSelect.options[0];
        if (defaultOption && defaultOption.text.includes("---")) {
            defaultOption.text = "Select Action";
            defaultOption.disabled = true; // Optional: make it unselectable
            defaultOption.selected = true;
        }
    }
});