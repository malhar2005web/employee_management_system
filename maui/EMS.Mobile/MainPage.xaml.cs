using Microsoft.Maui.Controls;

namespace EMS.Mobile;

public partial class MainPage : ContentPage
{
    private const string ServerUrl = "http://173.249.59.181:8080/login.html";
    private readonly Native.Bridge.NativeBridgeHost _bridgeHost;

    public MainPage(Native.Bridge.BridgeRouter router, Microsoft.Extensions.Logging.ILogger<Native.Bridge.NativeBridgeHost> logger)
    {
        InitializeComponent();
        EmsWebView.Source = ServerUrl;
        _bridgeHost = new Native.Bridge.NativeBridgeHost(EmsWebView, router, logger);
        Unloaded += (s, e) => _bridgeHost.Dispose();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await RequestEssentialPermissionsAsync();
    }

    private async Task RequestEssentialPermissionsAsync()
    {
        try
        {
            // 1. Request Location Permission (Fine & Coarse for client visits and attendance tracking)
            var locStatus = await Microsoft.Maui.ApplicationModel.Permissions.CheckStatusAsync<Microsoft.Maui.ApplicationModel.Permissions.LocationWhenInUse>();
            if (locStatus != PermissionStatus.Granted)
            {
                await Microsoft.Maui.ApplicationModel.Permissions.RequestAsync<Microsoft.Maui.ApplicationModel.Permissions.LocationWhenInUse>();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[EMS.Mobile] Location permission request error: {ex.Message}");
        }

        try
        {
            // 2. Request Notification Permission (Android 13+ push notifications, task alerts, and OTP)
            var notifStatus = await Microsoft.Maui.ApplicationModel.Permissions.CheckStatusAsync<Microsoft.Maui.ApplicationModel.Permissions.PostNotifications>();
            if (notifStatus != PermissionStatus.Granted)
            {
                await Microsoft.Maui.ApplicationModel.Permissions.RequestAsync<Microsoft.Maui.ApplicationModel.Permissions.PostNotifications>();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[EMS.Mobile] Notification permission request error: {ex.Message}");
        }
    }

    private async void OnWebViewNavigated(object? sender, WebNavigatedEventArgs e)
    {
        if (e.Result == WebNavigationResult.Failure)
        {
            var offlineHtml = @"
                <!DOCTYPE html>
                <html>
                <head>
                    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%); color: #0f172a; text-align: center; padding: 24px; box-sizing: border-box; }
                        .card { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); padding: 36px 24px; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); max-width: 360px; width: 100%; border: 1px solid rgba(255,255,255,0.8); }
                        .icon { font-size: 52px; margin-bottom: 16px; }
                        h2 { margin: 0 0 8px; font-size: 22px; font-weight: 800; color: #0f766e; }
                        p { margin: 0 0 24px; font-size: 14px; color: #64748b; line-height: 1.5; }
                        .btn { background: linear-gradient(135deg, #0f766e, #0d9488); color: white; border: none; padding: 14px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer; width: 100%; box-shadow: 0 6px 18px rgba(15,118,110,0.3); transition: transform 0.2s ease; }
                        .btn:active { transform: scale(0.98); }
                    </style>
                </head>
                <body>
                    <div class='card'>
                        <div class='icon'>📡</div>
                        <h2>Connection Error</h2>
                        <p>Unable to connect to the EMS server.<br>Please check your internet or Wi-Fi connection and tap below to retry.</p>
                        <button class='btn' onclick='window.location.href=\""http://173.249.59.181:8080/login.html\""'>Retry Connection</button>
                    </div>
                </body>
                </html>";
            EmsWebView.Source = new HtmlWebViewSource { Html = offlineHtml };
            return;
        }

        if (e.Result == WebNavigationResult.Success)
        {
            // Inject mobile identification and bridge
            var bridgeScript = @"
                if (document.documentElement) {
                    document.documentElement.classList.add('is-mobile-app');
                    document.documentElement.classList.add('is-apk');
                }
                if (document.body) {
                    document.body.classList.add('is-mobile-app');
                    document.body.classList.add('is-apk');
                }

                (function() {
                    const styleId = 'ems-apk-mobile-overrides';
                    let styleEl = document.getElementById(styleId);
                    if (!styleEl) {
                        styleEl = document.createElement('style');
                        styleEl.id = styleId;
                        document.head.appendChild(styleEl);
                    }
                    styleEl.textContent = `
                        /* Topbar: Hide search box and breadcrumbs text in APK */
                        .topbar .search-box,
                        .topbar-nav {
                            display: none !important;
                        }
                        .topbar {
                            display: flex !important;
                            justify-content: space-between !important;
                            align-items: center !important;
                            padding: 8px 14px !important;
                            height: 58px !important;
                            min-height: 58px !important;
                            margin-bottom: 14px !important;
                            width: 100% !important;
                            box-sizing: border-box !important;
                            border-radius: 16px !important;
                            position: relative !important;
                            top: 0 !important;
                        }
                        .topbar-actions {
                            display: flex !important;
                            align-items: center !important;
                            gap: 10px !important;
                            margin-left: auto !important;
                            flex-shrink: 0 !important;
                        }
                        .topbar-actions .icon-btn {
                            display: inline-flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            width: 42px !important;
                            height: 42px !important;
                            min-width: 42px !important;
                            border-radius: 12px !important;
                            background: rgba(255, 255, 255, 0.9) !important;
                            border: 1px solid rgba(15, 118, 110, 0.2) !important;
                            color: #0f766e !important;
                            font-size: 16px !important;
                            flex-shrink: 0 !important;
                            position: relative !important;
                        }
                        .topbar-user {
                            display: flex !important;
                            align-items: center !important;
                            gap: 6px !important;
                            flex-shrink: 0 !important;
                        }
                        .topbar-user img {
                            width: 36px !important;
                            height: 36px !important;
                            border-radius: 50% !important;
                            object-fit: cover !important;
                        }
                        /* Module Card Head Title Stacking */
                        .card-head {
                            display: flex !important;
                            flex-direction: column !important;
                            align-items: flex-start !important;
                            gap: 12px !important;
                            width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        .card-head h3 {
                            font-size: 16px !important;
                            font-weight: 800 !important;
                            margin: 0 !important;
                            width: 100% !important;
                        }
                        /* Horizontal scrollable tab bars across all modules */
                        .tab-group,
                        .tab-nav,
                        .tab-nav-wrapper,
                        .tabs-bar,
                        .profile-sub-tabs-list,
                        .filter-tabs,
                        #comm-tabs,
                        #org-tabs,
                        #task-tabs,
                        #audit-sub-tabs,
                        #main-attendance-leave-tabs,
                        #attendance-subtabs,
                        #customer-main-tabs,
                        #blueprint-dept-pills {
                            display: flex !important;
                            flex-direction: row !important;
                            flex-wrap: nowrap !important;
                            white-space: nowrap !important;
                            overflow-x: auto !important;
                            overflow-y: hidden !important;
                            -webkit-overflow-scrolling: touch !important;
                            touch-action: pan-x !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                            scrollbar-width: none !important;
                            -ms-overflow-style: none !important;
                            padding-bottom: 6px !important;
                            gap: 8px !important;
                        }
                        .tab-group::-webkit-scrollbar,
                        .tab-nav::-webkit-scrollbar,
                        .tabs-bar::-webkit-scrollbar,
                        #comm-tabs::-webkit-scrollbar,
                        #blueprint-dept-pills::-webkit-scrollbar {
                            display: none !important;
                            height: 0 !important;
                        }
                        .tab-group button,
                        .tab-nav .tab-btn,
                        .tabs-bar .tab-item,
                        .profile-sub-tab-btn,
                        .filter-tab-btn,
                        #comm-tabs button {
                            flex-shrink: 0 !important;
                            white-space: nowrap !important;
                            display: inline-flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            font-size: 13px !important;
                            padding: 8px 14px !important;
                            border-radius: 12px !important;
                            min-height: 38px !important;
                            box-sizing: border-box !important;
                            touch-action: manipulation !important;
                        }
                        /* Page header action bar horizontal scrolling */
                        .page-header {
                            display: flex !important;
                            flex-direction: column !important;
                            align-items: flex-start !important;
                            gap: 12px !important;
                            width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        .page-header > div:last-child {
                            display: flex !important;
                            flex-wrap: nowrap !important;
                            overflow-x: auto !important;
                            -webkit-overflow-scrolling: touch !important;
                            scrollbar-width: none !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            padding-bottom: 4px !important;
                            gap: 8px !important;
                        }
                        .page-header > div:last-child::-webkit-scrollbar {
                            display: none !important;
                        }
                        .page-header button {
                            flex-shrink: 0 !important;
                            white-space: nowrap !important;
                        }
                    `;
                })();

                if (!window.EMS || !window.EMS.Native) {
                    (function() {
                        let nextCallbackId = 1;
                        const pendingCallbacks = new Map();
                        window.EMS = window.EMS || {};
                        window.EMS.version = '1.1';
                        window.EMS.Native = {
                            invoke: function(methodName, args) {
                                args = args || {};
                                return new Promise((resolve, reject) => {
                                    const callbackId = nextCallbackId++;
                                    pendingCallbacks.set(callbackId, { resolve, reject });
                                    const payload = { method: methodName, callbackId: callbackId, args: args };
                                    const bridgeUrl = 'ems-bridge://' + encodeURIComponent(JSON.stringify(payload));
                                    const iframe = document.createElement('iframe');
                                    iframe.style.display = 'none';
                                    iframe.src = bridgeUrl;
                                    document.body.appendChild(iframe);
                                    setTimeout(() => iframe.remove(), 100);
                                });
                            },
                            resolveCallback: function(callbackId, success, resultJson) {
                                const promise = pendingCallbacks.get(callbackId);
                                if (promise) {
                                    pendingCallbacks.delete(callbackId);
                                    let result = resultJson;
                                    if (typeof resultJson === 'string') {
                                        try { result = JSON.parse(resultJson); } catch(e) {}
                                    }
                                    if (success) promise.resolve(result);
                                    else promise.reject(result);
                                }
                            },
                            pickImage: function() { return this.invoke('pickImage'); },
                            capturePhoto: function() { return this.invoke('capturePhoto'); },
                            location: function() { return this.invoke('location'); },
                            notification: function(title, message) { return this.invoke('notification', { title: title, message: message }); },
                            uploadFile: function(filePath) { return this.invoke('uploadFile', { filePath: filePath }); },
                            exit: function() { return this.invoke('exit'); }
                        };
                    })();
                }
            ";
            await EmsWebView.EvaluateJavaScriptAsync(bridgeScript);
        }
    }

    protected override bool OnBackButtonPressed()
    {
        // If drawer is open, close it first
        EmsWebView.EvaluateJavaScriptAsync("if (document.body.classList.contains('sidebar-drawer-open')) { if (window.closeSidebarDrawer) window.closeSidebarDrawer(); }");

        if (EmsWebView.CanGoBack)
        {
            EmsWebView.GoBack();
            return true;
        }
        return base.OnBackButtonPressed();
    }
}
