window.EMS = window.EMS || {};
window.EMS.Components = window.EMS.Components || {};

window.EMS.Components.Drawer = {
    drawerEl: null,
    overlayEl: null,
    
    Initialize: function() {
        if (document.querySelector(".mobile-drawer")) return;
        
        const origSidebar = document.querySelector(".sidebar");
        if (!origSidebar) return;
        
        this.overlayEl = document.createElement("div");
        this.overlayEl.className = "mobile-drawer-overlay";
        document.body.appendChild(this.overlayEl);
        
        this.drawerEl = document.createElement("nav");
        this.drawerEl.className = "mobile-drawer glass-panel";
        this.drawerEl.setAttribute("role", "navigation");
        this.drawerEl.setAttribute("aria-hidden", "true");
        this.drawerEl.setAttribute("aria-label", "Sidebar Navigation Menu");
        
        this.drawerEl.innerHTML = origSidebar.innerHTML;
        document.body.appendChild(this.drawerEl);
        
        this.overlayEl.addEventListener("click", () => {
            if (window.EMS.GestureDrawer) {
                window.EMS.GestureDrawer.Close();
            }
        });
        
        if (window.EMS.GestureDrawer) {
            window.EMS.GestureDrawer.Initialize(this.drawerEl, this.overlayEl);
        }
        
        this.Refresh();
    },
    
    Destroy: function() {
        if (window.EMS.GestureDrawer) {
            window.EMS.GestureDrawer.Close();
        }
        if (this.drawerEl) {
            this.drawerEl.remove();
            this.drawerEl = null;
        }
        if (this.overlayEl) {
            this.overlayEl.remove();
            this.overlayEl = null;
        }
    },
    
    Refresh: function() {
        if (!this.drawerEl) return;
        
        const currentPath = window.location.pathname.split("/").pop();
        const links = this.drawerEl.querySelectorAll("a");
        links.forEach(link => {
            const href = link.getAttribute("href");
            if (href === currentPath || (currentPath === "" && href === "admin-dashboard.html")) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });
    }
};
