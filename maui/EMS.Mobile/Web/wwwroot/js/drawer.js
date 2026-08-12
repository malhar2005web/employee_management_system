window.EMS = window.EMS || {};
window.EMS.GestureDrawer = {
    startX: 0,
    isDragging: false,
    drawerEl: null,
    overlayEl: null,
    edgeThreshold: 40,
    swipeThreshold: 60,
    
    Initialize: function(drawerElement, overlayElement) {
        this.drawerEl = drawerElement;
        this.overlayEl = overlayElement;
        
        document.addEventListener("touchstart", this.OnTouchStart.bind(this), { passive: true });
        document.addEventListener("touchmove", this.OnTouchMove.bind(this), { passive: false });
        document.addEventListener("touchend", this.OnTouchEnd.bind(this));
        
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.IsOpen()) {
                this.Close();
            }
        });
    },
    
    IsOpen: function() {
        return this.drawerEl && this.drawerEl.classList.contains("active");
    },
    
    Open: function() {
        if (!this.drawerEl) return;
        this.drawerEl.classList.add("active");
        this.overlayEl.classList.add("active");
        this.overlayEl.style.opacity = "";
        this.overlayEl.style.visibility = "";
        this.drawerEl.style.transform = "";
        this.FocusTrap(true);
        this.drawerEl.setAttribute("aria-hidden", "false");
    },
    
    Close: function() {
        if (!this.drawerEl) return;
        this.drawerEl.classList.remove("active");
        this.overlayEl.classList.remove("active");
        this.overlayEl.style.opacity = "";
        this.overlayEl.style.visibility = "";
        this.drawerEl.style.transform = "";
        this.FocusTrap(false);
        this.drawerEl.setAttribute("aria-hidden", "true");
    },
    
    OnTouchStart: function(e) {
        const touch = e.touches[0];
        const open = this.IsOpen();
        
        if (!open && touch.clientX < this.edgeThreshold) {
            this.startX = touch.clientX;
            this.isDragging = true;
            this.drawerEl.style.transition = "none";
            this.overlayEl.style.transition = "none";
        } else if (open) {
            this.startX = touch.clientX;
            this.isDragging = true;
            this.drawerEl.style.transition = "none";
            this.overlayEl.style.transition = "none";
        }
    },
    
    OnTouchMove: function(e) {
        if (!this.isDragging) return;
        const touch = e.touches[0];
        const open = this.IsOpen();
        
        let deltaX = touch.clientX - this.startX;
        
        if (!open) {
            if (deltaX < 0) deltaX = 0;
            if (deltaX > 290) deltaX = 290;
            
            const percentage = (deltaX / 290);
            this.drawerEl.style.transform = `translate3d(${deltaX - 290}px, 0, 0)`;
            this.overlayEl.style.opacity = percentage;
            this.overlayEl.style.visibility = "visible";
        } else {
            if (deltaX > 0) deltaX = 0;
            if (deltaX < -290) deltaX = -290;
            
            const percentage = 1 + (deltaX / 290);
            this.drawerEl.style.transform = `translate3d(${deltaX}px, 0, 0)`;
            this.overlayEl.style.opacity = percentage;
            this.overlayEl.style.visibility = "visible";
        }
        
        e.preventDefault();
    },
    
    OnTouchEnd: function(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        this.drawerEl.style.transition = "transform 0.35s var(--ease-premium)";
        this.overlayEl.style.transition = "opacity 0.3s var(--ease-premium), visibility 0.3s var(--ease-premium)";
        
        const open = this.IsOpen();
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - this.startX;
        
        if (!open) {
            if (deltaX > this.swipeThreshold) {
                this.Open();
            } else {
                this.Close();
            }
        } else {
            if (deltaX < -this.swipeThreshold) {
                this.Close();
            } else {
                this.Open();
            }
        }
    },
    
    FocusTrap: function(enable) {
        if (!enable) return;
        
        const focusable = this.drawerEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        
        first.focus();
        
        const keyHandler = (e) => {
            if (!this.IsOpen()) {
                this.drawerEl.removeEventListener("keydown", keyHandler);
                return;
            }
            if (e.key === "Tab") {
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        last.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === last) {
                        first.focus();
                        e.preventDefault();
                    }
                }
            }
        };
        this.drawerEl.addEventListener("keydown", keyHandler);
    }
};
