window.EMS = window.EMS || {};
window.EMS.Components = window.EMS.Components || {};

window.EMS.Components.Header = {
    el: null,
    
    Initialize: function() {
        if (document.querySelector(".mobile-header")) return;
        
        this.el = document.createElement("header");
        this.el.className = "mobile-header glass-panel";
        this.el.innerHTML = `
            <div class="mobile-header-hamburger" aria-label="Open Sidebar Menu"><i class="fa-solid fa-bars"></i></div>
            <div class="mobile-header-title">PCS EMS</div>
            <div style="width: 40px;"></div>
        `;
        
        document.body.prepend(this.el);
        
        this.el.querySelector(".mobile-header-hamburger").addEventListener("click", () => {
            if (window.EMS.GestureDrawer) {
                window.EMS.GestureDrawer.Open();
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
        
        const titleEl = document.querySelector(".main-content h1") || document.querySelector("h2");
        const titleText = titleEl ? titleEl.textContent.trim() : "PCS EMS";
        this.el.querySelector(".mobile-header-title").textContent = titleText;
    }
};
