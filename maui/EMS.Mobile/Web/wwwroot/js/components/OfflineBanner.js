window.EMS = window.EMS || {};
window.EMS.Components = window.EMS.Components || {};

window.EMS.Components.OfflineBanner = {
    el: null,
    
    Initialize: function() {
        if (document.querySelector(".offline-banner")) return;
        
        this.el = document.createElement("div");
        this.el.className = "offline-banner";
        this.el.innerHTML = `
            <span><i class="fa-solid fa-cloud-slash"></i> You are currently offline.</span>
            <button id="ems-offline-retry" type="button">Tap to Retry</button>
        `;
        
        document.body.prepend(this.el);
        
        window.addEventListener("online", () => this.Refresh());
        window.addEventListener("offline", () => this.Refresh());
        
        this.el.querySelector("#ems-offline-retry").addEventListener("click", () => {
            this.TryReconnect();
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
        
        if (navigator.onLine) {
            this.el.style.display = "none";
        } else {
            this.el.style.display = "flex";
        }
    },
    
    TryReconnect: async function() {
        const btn = this.el.querySelector("#ems-offline-retry");
        btn.textContent = "Checking...";
        btn.disabled = true;
        
        try {
            const resp = await fetch("/api/v1/auth/authCheck", { method: "GET", cache: "no-store" });
            if (resp.ok) {
                this.el.style.display = "none";
                location.reload();
            } else {
                throw new Error("still offline");
            }
        } catch (e) {
            btn.textContent = "Tap to Retry";
            btn.disabled = false;
            if (window.EMS.Native && window.EMS.Native.notification) {
                window.EMS.Native.notification("Offline Mode", "Still unable to connect to EMS servers.");
            }
        }
    }
};
