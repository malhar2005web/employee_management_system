window.EMS = window.EMS || {};
window.EMS.Components = window.EMS.Components || {};

window.EMS.Components.Loader = {
    shimmers: [],
    contentEl: null,
    
    Initialize: function() {
        this.contentEl = document.querySelector(".main-content");
    },
    
    Destroy: function() {
        this.Hide();
    },
    
    Refresh: function() {},
    
    Show: function(count = 3) {
        if (!this.contentEl) return;
        
        const childNodes = this.contentEl.children;
        for (let i = 0; i < childNodes.length; i++) {
            if (!childNodes[i].classList.contains("shimmer-card")) {
                childNodes[i].style.opacity = "0";
                childNodes[i].style.transition = "opacity 0.35s var(--ease-premium)";
            }
        }
        
        for (let i = 0; i < count; i++) {
            const shimmer = document.createElement("div");
            shimmer.className = "shimmer-card";
            this.contentEl.appendChild(shimmer);
            this.shimmers.push(shimmer);
        }
    },
    
    Hide: function() {
        this.shimmers.forEach(s => s.remove());
        this.shimmers = [];
        
        if (!this.contentEl) return;
        
        const childNodes = this.contentEl.children;
        for (let i = 0; i < childNodes.length; i++) {
            childNodes[i].style.opacity = "1";
        }
    }
};
