window.EMS = window.EMS || {};
window.EMS.Theme = {
    currentTheme: "system",
    Initialize: function() {
        this.currentTheme = localStorage.getItem("ems_theme") || "system";
        this.ApplyTheme(this.currentTheme);
        
        // Listen to system theme changes
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
            if (this.currentTheme === "system") {
                this.ApplyTheme("system");
            }
        });
    },
    ApplyTheme: function(theme) {
        this.currentTheme = theme;
        localStorage.setItem("ems_theme", theme);
        
        let dark = false;
        if (theme === "dark") {
            dark = true;
        } else if (theme === "system") {
            dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        
        if (dark) {
            document.documentElement.classList.add("dark-mode");
        } else {
            document.documentElement.classList.remove("dark-mode");
        }
    }
};
