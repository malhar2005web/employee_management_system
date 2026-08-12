window.EMS = window.EMS || {};
window.EMS.Layout = {
    observer: null,
    components: [],
    
    Initialize: function() {
        this.components = [
            window.EMS.Components.Header,
            window.EMS.Components.Drawer,
            window.EMS.Components.BottomNav,
            window.EMS.Components.FloatingButton,
            window.EMS.Components.OfflineBanner,
            window.EMS.Components.Loader
        ];
        
        this.StartObservers();
        this.Sweep();
    },
    
    StartObservers: function() {
        if (this.observer) return;
        
        this.observer = new MutationObserver(() => {
            this.components.forEach(c => {
                if (c && c.Refresh) c.Refresh();
            });
        });
        
        this.observer.observe(document.body, { childList: true, subtree: true });
    },
    
    StopObservers: function() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    },
    
    Sweep: function() {
        this.components.forEach(c => {
            if (c && c.Initialize) c.Initialize();
        });
    },
    
    Cleanup: function() {
        this.StopObservers();
        this.components.forEach(c => {
            if (c && c.Destroy) c.Destroy();
        });
    },
    
    Navigate: function(url) {
        this.Cleanup();
        
        // Show loading shimmer before fetch begins
        if (window.EMS.Components.Loader) {
            window.EMS.Components.Loader.Initialize();
            window.EMS.Components.Loader.Show(3);
        }

        fetch(url)
            .then(resp => resp.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                
                document.title = doc.title;
                
                const currentContent = document.querySelector(".main-content");
                const newContent = doc.querySelector(".main-content");
                if (currentContent && newContent) {
                    currentContent.innerHTML = newContent.innerHTML;
                    
                    // Evaluate scripts of new content to wire up dynamic interactions on new pages
                    const scripts = newContent.querySelectorAll("script");
                    scripts.forEach(script => {
                        const newScript = document.createElement("script");
                        if (script.src) {
                            newScript.src = script.src;
                        } else {
                            newScript.textContent = script.textContent;
                        }
                        document.body.appendChild(newScript);
                        newScript.remove(); // execute and clean
                    });
                } else {
                    document.body.innerHTML = doc.body.innerHTML;
                }
                
                // Hide loaders and boot components
                if (window.EMS.Components.Loader) {
                    window.EMS.Components.Loader.Hide();
                }
                this.Initialize();
            })
            .catch(err => {
                console.error("Navigation failed", err);
                window.location.href = url;
            });
    },
    
    handleBackButton: function() {
        if (window.EMS.GestureDrawer && window.EMS.GestureDrawer.IsOpen()) {
            window.EMS.GestureDrawer.Close();
            return;
        }
        
        if (history.state && history.state.url) {
            history.back();
        } else {
            if (window.EMS.Native && window.EMS.Native.exit) {
                window.EMS.Native.exit();
            }
        }
    }
};
