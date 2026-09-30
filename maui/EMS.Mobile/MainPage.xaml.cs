using Microsoft.Maui.Controls;

namespace EMS.Mobile;

public partial class MainPage : ContentPage
{
    private const string ServerUrl = "http://173.249.59.181:8080/login.html";
    private readonly Native.Bridge.NativeBridgeHost _bridgeHost;

    public MainPage(Native.Bridge.BridgeRouter router, Microsoft.Extensions.Logging.ILogger<Native.Bridge.NativeBridgeHost> logger)
    {
        InitializeComponent();
#if ANDROID
        Microsoft.Maui.Handlers.WebViewHandler.Mapper.AppendToMapping("EmsWebViewCustomizer", (handler, view) =>
        {
            if (handler.PlatformView is Android.Webkit.WebView aWebView)
            {
                aWebView.SetLayerType(Android.Views.LayerType.Hardware, null);
                aWebView.Settings.JavaScriptEnabled = true;
                aWebView.Settings.DomStorageEnabled = true;
                aWebView.Settings.DatabaseEnabled = true;
                aWebView.Settings.CacheMode = Android.Webkit.CacheModes.NoCache;
                aWebView.ClearCache(true);
            }
        });
#endif
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
                        .page-header > div:last-child:not(#overview-card-picker):not(.overview-card-dropdown):not(#comm-tabs) {
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
                        .page-header > div:last-child:not(#overview-card-picker):not(.overview-card-dropdown):not(#comm-tabs)::-webkit-scrollbar {
                            display: none !important;
                        }
                        .page-header button {
                            flex-shrink: 0 !important;
                            white-space: nowrap !important;
                        }

                        /* 10. APK Performance Optimization: Disable heavy real-time GPU backdrop blur */
                        .card, .glass {
                            backdrop-filter: none !important;
                            -webkit-backdrop-filter: none !important;
                            background: rgba(255, 255, 255, 0.95) !important;
                        }

                        /* 11. Notice Board & Communication Tabs in APK */
                        .page-header:has(#comm-tabs) {
                            display: flex !important;
                            flex-direction: column !important;
                            width: 100% !important;
                            gap: 12px !important;
                        }
                        #comm-tabs {
                            order: -1 !important;
                            display: flex !important;
                            flex-direction: row !important;
                            flex-wrap: nowrap !important;
                            white-space: nowrap !important;
                            overflow-x: auto !important;
                            -webkit-overflow-scrolling: touch !important;
                            touch-action: pan-x !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            flex-shrink: 0 !important;
                            box-sizing: border-box !important;
                            padding: 6px !important;
                            margin-bottom: 8px !important;
                            background: rgba(255, 255, 255, 0.7) !important;
                            border-radius: 14px !important;
                            border: 1px solid rgba(15, 118, 110, 0.15) !important;
                        }
                        #comm-tabs button {
                            flex-shrink: 0 !important;
                            white-space: nowrap !important;
                        }

                        /* 12. Dashboard Overview Cards Customizer in APK */
                        #overview-card-picker {
                            display: none;
                            flex-direction: column !important;
                            flex-wrap: nowrap !important;
                            position: fixed !important;
                            top: 50% !important;
                            left: 50% !important;
                            transform: translate(-50%, -50%) !important;
                            width: 92% !important;
                            max-width: 440px !important;
                            max-height: 82vh !important;
                            overflow-y: auto !important;
                            -webkit-overflow-scrolling: touch !important;
                            box-sizing: border-box !important;
                            z-index: 99999 !important;
                            padding: 18px 16px !important;
                            border-radius: 20px !important;
                            background: #ffffff !important;
                            box-shadow: 0 25px 70px rgba(0, 0, 0, 0.35) !important;
                            border: 1px solid rgba(15, 118, 110, 0.2) !important;
                        }
                        #overview-card-picker.is-open {
                            display: flex !important;
                        }
                        #overview-card-picker > div:first-child {
                            display: flex !important;
                            flex-direction: column !important;
                            align-items: stretch !important;
                            gap: 12px !important;
                            width: 100% !important;
                            box-sizing: border-box !important;
                            margin-bottom: 14px !important;
                            padding-bottom: 12px !important;
                            border-bottom: 1px solid rgba(226, 232, 240, 0.8) !important;
                        }
                        #overview-card-picker > div:first-child > div:last-child {
                            display: flex !important;
                            justify-content: space-between !important;
                            align-items: center !important;
                            gap: 8px !important;
                            width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        #overview-card-options-grid {
                            display: flex !important;
                            flex-direction: column !important;
                            gap: 10px !important;
                            max-height: 52vh !important;
                            overflow-y: auto !important;
                            -webkit-overflow-scrolling: touch !important;
                            width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        .overview-option-item {
                            width: 100% !important;
                            box-sizing: border-box !important;
                            padding: 12px 14px !important;
                        }

                        /* 13. Unified Template / Export / Import Button in APK */
                        .btn-pill-template,
                        .btn-pill-export,
                        .btn-pill-import {
                            display: none !important;
                        }

                        /* 6. Workflow Templates Blueprint Grid & Cards in APK */
                        #blueprint-cards-grid {
                            display: flex !important;
                            flex-direction: column !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                            gap: 16px !important;
                        }
                        .blueprint-card {
                            width: 100% !important;
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                            padding: 16px 14px !important;
                            overflow: hidden !important;
                        }
                        .blueprint-card > div:last-child {
                            display: flex !important;
                            justify-content: space-between !important;
                            align-items: center !important;
                            flex-wrap: wrap !important;
                            gap: 8px !important;
                            width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        .blueprint-card .btn-use-bp {
                            flex-shrink: 0 !important;
                            padding: 7px 14px !important;
                            white-space: nowrap !important;
                            margin-left: auto !important;
                        }
                        #filter-blueprint-dept,
                        #filter-blueprint-category {
                            max-width: 100% !important;
                            width: 100% !important;
                            min-width: 0 !important;
                            box-sizing: border-box !important;
                        }

                        /* 7. Customer Bill Search Box & Refresh Button in APK */
                        #tab-content-billing-report .card > div:first-child > div:last-child {
                            display: flex !important;
                            align-items: center !important;
                            gap: 8px !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        #report-search {
                            width: 100% !important;
                            min-width: 0 !important;
                            box-sizing: border-box !important;
                        }
                        #tab-content-billing-report .search-box {
                            flex: 1 1 auto !important;
                            min-width: 0 !important;
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        #btn-refresh-report {
                            flex-shrink: 0 !important;
                            white-space: nowrap !important;
                        }

                        /* 8. Customer Master Search Box & Industry Filter in APK */
                        #tab-content-master .card-head > div:last-child {
                            display: flex !important;
                            flex-wrap: wrap !important;
                            align-items: center !important;
                            gap: 8px !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        #tab-content-master .card-head .search-box {
                            flex: 1 1 130px !important;
                            min-width: 0 !important;
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        #cust-search {
                            width: 100% !important;
                            min-width: 0 !important;
                            box-sizing: border-box !important;
                        }
                        #cust-industry-filter {
                            flex: 1 1 110px !important;
                            min-width: 0 !important;
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                        }

                        /* 9. Workstation Monitoring Controls Bar & Date Range in APK */
                        .controls-bar {
                            display: flex !important;
                            flex-direction: column !important;
                            align-items: stretch !important;
                            flex-wrap: wrap !important;
                            gap: 12px !important;
                            padding: 12px 14px !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        .controls-left,
                        .controls-right {
                            display: flex !important;
                            flex-wrap: wrap !important;
                            align-items: center !important;
                            gap: 8px 10px !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                        }
                        .controls-left label {
                            margin-left: 0 !important;
                            white-space: nowrap !important;
                            font-size: 13px !important;
                        }
                        .controls-left .select-pill {
                            flex: 1 1 120px !important;
                            min-width: 0 !important;
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                            font-size: 13px !important;
                        }
                        .controls-right .btn-pill {
                            flex: 1 1 110px !important;
                            text-align: center !important;
                            justify-content: center !important;
                            box-sizing: border-box !important;
                        }
                    `;
                })();

                (function() {
                    function setupApkDataActionsMenu() {
                        const templateBtn = document.querySelector('.btn-pill-template');
                        const exportBtn = document.querySelector('.btn-pill-export');
                        const importBtn = document.querySelector('.btn-pill-import');

                        if ((templateBtn || exportBtn || importBtn) && !document.querySelector('.btn-apk-data-menu')) {
                            const parent = (templateBtn || exportBtn || importBtn).parentElement;
                            if (!parent) return;

                            const menuBtn = document.createElement('button');
                            menuBtn.type = 'button';
                            menuBtn.className = 'btn-pill-action btn-apk-data-menu';
                            menuBtn.style.cssText = 'background: linear-gradient(135deg, #0f766e, #0d9488) !important; color: white !important; font-weight: 700 !important; font-size: 12.5px !important; padding: 8px 14px !important; border-radius: 12px !important; border: none !important; display: inline-flex !important; align-items: center !important; gap: 6px !important; flex-shrink: 0 !important; cursor: pointer !important; box-shadow: 0 4px 12px rgba(15,118,110,0.25) !important;';
                            menuBtn.innerHTML = '<i class=\'fa-solid fa-file-invoice\'></i> Template &amp; Data <i class=\'fa-solid fa-chevron-down\' style=\'font-size:10px; margin-left:3px;\'></i>';

                            const firstBtn = templateBtn || exportBtn || importBtn;
                            parent.insertBefore(menuBtn, firstBtn);

                            menuBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                openApkDataSheet();
                            });
                        }
                    }

                    function openApkDataSheet() {
                        let sheet = document.getElementById('apk-data-actions-sheet');
                        if (!sheet) {
                            sheet = document.createElement('div');
                            sheet.id = 'apk-data-actions-sheet';
                            sheet.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.55); z-index:999999; display:flex; align-items:flex-end; justify-content:center;';
                            sheet.innerHTML = `
                                <div style='background:#ffffff; border-radius:24px 24px 0 0; width:100%; max-width:480px; padding:22px 20px 32px; box-shadow:0 -10px 40px rgba(0,0,0,0.25); box-sizing:border-box;'>
                                    <div style='width:40px; height:4px; border-radius:2px; background:#cbd5e1; margin:0 auto 16px;'></div>
                                    <div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;'>
                                        <h3 style='margin:0; font-size:16px; font-weight:800; color:#0f766e;'><i class='fa-solid fa-file-invoice' style='margin-right:6px;'></i>Template &amp; Data Actions</h3>
                                        <button type='button' id='apk-sheet-close' style='background:#f1f5f9; border:none; border-radius:50%; width:32px; height:32px; font-size:14px; font-weight:700; color:#64748b; cursor:pointer;'>✕</button>
                                    </div>
                                    <div style='display:flex; flex-direction:column; gap:10px;'>
                                        <button type='button' id='apk-action-template' style='display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:14px; border:1px solid #e2e8f0; background:#f8fafc; font-size:14px; font-weight:700; color:#0f172a; cursor:pointer; text-align:left;'>
                                            <span style='width:38px; height:38px; border-radius:10px; background:rgba(15,118,110,0.12); color:#0f766e; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;'><i class='fa-solid fa-file-download'></i></span>
                                            <div>
                                                <div>Download Template</div>
                                                <div style='font-size:11.5px; color:#64748b; font-weight:500;'>Get official blank Excel/CSV template</div>
                                            </div>
                                        </button>
                                        <button type='button' id='apk-action-export' style='display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:14px; border:1px solid #e2e8f0; background:#f8fafc; font-size:14px; font-weight:700; color:#0f172a; cursor:pointer; text-align:left;'>
                                            <span style='width:38px; height:38px; border-radius:10px; background:rgba(16,185,129,0.12); color:#059669; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;'><i class='fa-solid fa-file-export'></i></span>
                                            <div>
                                                <div>Export Data</div>
                                                <div style='font-size:11.5px; color:#64748b; font-weight:500;'>Download complete module records</div>
                                            </div>
                                        </button>
                                        <button type='button' id='apk-action-import' style='display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:14px; border:1px solid #e2e8f0; background:#f8fafc; font-size:14px; font-weight:700; color:#0f172a; cursor:pointer; text-align:left;'>
                                            <span style='width:38px; height:38px; border-radius:10px; background:rgba(2,132,199,0.12); color:#0284c7; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;'><i class='fa-solid fa-file-import'></i></span>
                                            <div>
                                                <div>Import Data</div>
                                                <div style='font-size:11.5px; color:#64748b; font-weight:500;'>Bulk upload from Excel or CSV file</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            `;
                            document.body.appendChild(sheet);

                            sheet.addEventListener('click', (e) => {
                                if (e.target === sheet) sheet.style.display = 'none';
                            });
                            sheet.querySelector('#apk-sheet-close').addEventListener('click', () => {
                                sheet.style.display = 'none';
                            });
                            sheet.querySelector('#apk-action-template').addEventListener('click', () => {
                                sheet.style.display = 'none';
                                const btn = document.querySelector('.btn-pill-template');
                                if (btn) btn.click();
                            });
                            sheet.querySelector('#apk-action-export').addEventListener('click', () => {
                                sheet.style.display = 'none';
                                const btn = document.querySelector('.btn-pill-export');
                                if (btn) btn.click();
                            });
                            sheet.querySelector('#apk-action-import').addEventListener('click', () => {
                                sheet.style.display = 'none';
                                const btn = document.querySelector('.btn-pill-import');
                                if (btn) btn.click();
                            });
                        }
                        sheet.style.display = 'flex';
                    }

                    function fixOverviewCardPicker() {
                        const picker = document.getElementById('overview-card-picker');
                        const closeBtn = document.getElementById('close-overview-picker-btn');
                        const headerWrap = document.getElementById('overview-heading-wrap');

                        if (headerWrap && !headerWrap._apkPickerBound) {
                            headerWrap._apkPickerBound = true;
                            headerWrap.addEventListener('click', () => {
                                if (picker) {
                                    const isOpen = picker.classList.contains('is-open');
                                    if (!isOpen) {
                                        picker.classList.add('is-open');
                                        picker.style.display = 'flex';
                                    } else {
                                        picker.classList.remove('is-open');
                                        picker.style.display = 'none';
                                    }
                                }
                            });
                        }

                        if (closeBtn && picker && !closeBtn._apkPickerCloseBound) {
                            closeBtn._apkPickerCloseBound = true;
                            closeBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                picker.classList.remove('is-open');
                                picker.style.display = 'none';
                            }, true);
                        }
                    }

                    function applyApkLayoutFixes() {
                        setupApkDataActionsMenu();
                        fixOverviewCardPicker();

                        // Blueprint grid
                        const bpGrid = document.getElementById('blueprint-cards-grid');
                        if (bpGrid) bpGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))';

                        // Customer bill
                        const repSearch = document.getElementById('report-search');
                        if (repSearch && repSearch.parentElement) {
                            repSearch.style.width = '100%';
                            repSearch.parentElement.style.flex = '1 1 auto';
                            repSearch.parentElement.style.minWidth = '0';
                        }

                        // Customer master
                        const custSearch = document.getElementById('cust-search');
                        if (custSearch && custSearch.parentElement) {
                            custSearch.style.width = '100%';
                            custSearch.parentElement.style.flex = '1 1 130px';
                            custSearch.parentElement.style.minWidth = '0';
                        }

                        // Workstation controls
                        const ctrlBar = document.querySelector('.controls-bar');
                        if (ctrlBar) ctrlBar.style.flexWrap = 'wrap';
                        const ctrlLeft = document.querySelector('.controls-left');
                        if (ctrlLeft) ctrlLeft.style.flexWrap = 'wrap';

                        // Comm tabs
                        const commTabs = document.getElementById('comm-tabs');
                        if (commTabs && commTabs.parentElement) {
                            commTabs.parentElement.style.flexWrap = 'wrap';
                            commTabs.style.order = '-1';
                            commTabs.style.width = '100%';
                            commTabs.style.flexShrink = '0';
                        }
                    }

                    // Run immediately and on events (optimized, non-polling)
                    applyApkLayoutFixes();
                    window.addEventListener('load', applyApkLayoutFixes);
                    window.addEventListener('hashchange', applyApkLayoutFixes);
                    document.addEventListener('click', () => setTimeout(applyApkLayoutFixes, 80));

                    // Debounced light observer for dynamic content injection
                    let timeoutId = null;
                    const observer = new MutationObserver(() => {
                        if (timeoutId) clearTimeout(timeoutId);
                        timeoutId = setTimeout(applyApkLayoutFixes, 250);
                    });
                    if (document.body) {
                        observer.observe(document.body, { childList: true, subtree: false });
                    }
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
