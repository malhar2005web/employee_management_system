window.EMS = window.EMS || {};
window.EMS.Components = window.EMS.Components || {};

window.EMS.Components.BottomNav = {
    el: null,
    
    Initialize: function() {
        if (document.querySelector(".mobile-bottom-nav")) return;
        
        this.el = document.createElement("nav");
        this.el.className = "mobile-bottom-nav glass-panel";
        this.el.innerHTML = `
            <a class="mobile-nav-item" data-tab="dashboard" href="admin-dashboard.html">
                <i class="fa-solid fa-house"></i>
                <span>Dashboard</span>
            </a>
            <a class="mobile-nav-item" data-tab="attendance" href="admin-attendance.html">
                <i class="fa-solid fa-calendar-days"></i>
                <span>Attendance</span>
            </a>
            <div class="mobile-fab-container" id="ems-fab-mount"></div>
            <a class="mobile-nav-item" data-tab="clients" href="admin-customers.html">
                <i class="fa-solid fa-users"></i>
                <span>Clients</span>
            </a>
            <div class="mobile-nav-item" data-tab="more" id="ems-bottom-more">
                <i class="fa-solid fa-ellipsis"></i>
                <span>More</span>
            </div>
        `;
        
        document.body.appendChild(this.el);
        
        this.el.querySelector("#ems-bottom-more").addEventListener("click", () => {
            if (window.EMS.GestureDrawer) {
                if (window.EMS.GestureDrawer.IsOpen()) {
                    window.EMS.GestureDrawer.Close();
                } else {
                    window.EMS.GestureDrawer.Open();
                }
            }
        });
        
        this.Refresh();
    },
    
    Destroy: function() {
        if (this.el) {
            this.el.remove();
            this.el = null;
        }
    },
    
    Refresh: function() {
        if (!this.el) return;
        
        const currentPath = window.location.pathname.split("/").pop();
        const items = this.el.querySelectorAll(".mobile-nav-item");
        
        items.forEach(item => {
            item.classList.remove("active");
            const href = item.getAttribute("href");
            if (href === currentPath || (currentPath === "" && href === "admin-dashboard.html")) {
                item.classList.add("active");
            }
        });
    }
};
