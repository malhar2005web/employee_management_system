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
                if (document.documentElement) document.documentElement.classList.add('is-mobile-app');
                if (document.body) document.body.classList.add('is-mobile-app');

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
