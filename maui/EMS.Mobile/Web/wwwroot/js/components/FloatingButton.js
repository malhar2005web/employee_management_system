window.EMS = window.EMS || {};
window.EMS.Components = window.EMS.Components || {};

window.EMS.Components.FloatingButton = {
    el: null,
    
    Initialize: function() {
        const mount = document.getElementById("ems-fab-mount");
        if (!mount || document.querySelector(".mobile-fab")) return;
        
        this.el = document.createElement("button");
        this.el.className = "mobile-fab";
        this.el.type = "button";
        this.el.innerHTML = `<i class="fa-solid fa-plus"></i>`;
        mount.appendChild(this.el);
        
        this.el.addEventListener("click", () => {
            this.OnFabClicked();
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
        
        if (currentPath === "admin-dashboard.html" || currentPath === "") {
            this.el.style.display = "flex";
            this.el.setAttribute("title", "Create Duty");
            this.el.setAttribute("aria-label", "Create Duty");
        } else if (currentPath === "admin-customers.html") {
            this.el.style.display = "flex";
            this.el.setAttribute("title", "Add Client");
            this.el.setAttribute("aria-label", "Add Client");
        } else if (currentPath === "admin-employees.html") {
            this.el.style.display = "flex";
            this.el.setAttribute("title", "Add Employee");
            this.el.setAttribute("aria-label", "Add Employee");
        } else if (currentPath === "admin-projects.html") {
            this.el.style.display = "flex";
            this.el.setAttribute("title", "Create Project");
            this.el.setAttribute("aria-label", "Create Project");
        } else {
            this.el.style.display = "none";
        }
    },
    
    OnFabClicked: function() {
        const currentPath = window.location.pathname.split("/").pop();
        
        if (currentPath === "admin-dashboard.html" || currentPath === "") {
            const btn = document.querySelector('[data-action="create-duty"]') || document.querySelector('.btn-primary') || document.querySelector('.card-header button');
            if (btn) btn.click();
        } else if (currentPath === "admin-customers.html") {
            const btn = document.querySelector('[data-target="#addClientModal"]') || document.querySelector('.btn-primary') || document.querySelector('.card-header button');
            if (btn) btn.click();
        } else if (currentPath === "admin-employees.html") {
            const btn = document.querySelector('[data-target="#addEmployeeModal"]') || document.querySelector('.btn-primary') || document.querySelector('.card-header button');
            if (btn) btn.click();
        } else if (currentPath === "admin-projects.html") {
            const btn = document.querySelector('[data-target="#addProjectModal"]') || document.querySelector('.btn-primary') || document.querySelector('.card-header button');
            if (btn) btn.click();
        }
    }
};
