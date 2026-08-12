window.EMS = window.EMS || {};
window.EMS.Navigation = {
    Initialize: function() {
        document.addEventListener("click", (e) => {
            const link = e.target.closest("a");
            if (link) {
                const href = link.getAttribute("href");
                if (href && href.endsWith(".html") && !href.startsWith("http") && !link.target) {
                    e.preventDefault();
                    this.NavigateTo(href);
                }
            }
        });

        window.addEventListener("popstate", (e) => {
            if (e.state && e.state.url) {
                this.LoadPage(e.state.url, false);
            } else {
                // Fallback to reload current location
                this.LoadPage(window.location.pathname, false);
            }
        });
    },

    NavigateTo: function(url) {
        history.pushState({ url: url }, "", url);
        this.LoadPage(url, true);
    },

    LoadPage: function(url, isForward = true) {
        if (window.EMS.Layout) {
            window.EMS.Layout.Navigate(url);
        } else {
            window.location.href = url;
        }
    }
};
