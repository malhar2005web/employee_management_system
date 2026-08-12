using System.IO;
using Microsoft.Maui.Controls;

namespace EMS.Desktop;

public partial class MainPage : ContentPage
{
    public MainPage()
    {
        InitializeComponent();
        
#if WINDOWS
        try
        {
            // Redirect WebView2 User Data Folder to LocalAppData Cache to bypass permission limits
            var cacheDir = Path.Combine(FileSystem.CacheDirectory, "WebView2_Cache");
            Directory.CreateDirectory(cacheDir);
            System.Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", cacheDir);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to set UDF directory: {ex.Message}");
        }
#endif

        InitializeWebView();
    }

    private void InitializeWebView()
    {
#if WINDOWS
        async Task SetupWebView2(Microsoft.UI.Xaml.Controls.WebView2 platformWebView)
        {
            try 
            {
                await platformWebView.EnsureCoreWebView2Async();
                
                var localFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources", "Raw", "wwwroot");
                
                platformWebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "ems.local",
                    localFolder,
                    Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind.Allow);
                
                // Pre-inject desktop.js before any document is parsed or loaded to intercept fetch calls immediately
                var desktopJsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources", "Raw", "desktop.js");
                if (File.Exists(desktopJsPath))
                {
                    var desktopJsContent = await File.ReadAllTextAsync(desktopJsPath);
                    await platformWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(desktopJsContent);
                }
                
                EmsWebView.Source = "https://ems.local/login.html";
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to map CoreWebView2: {ex.Message}");
                EmsWebView.Source = "wwwroot/login.html";
            }
        }

        if (EmsWebView.Handler?.PlatformView is Microsoft.UI.Xaml.Controls.WebView2 pw)
        {
            MainThread.BeginInvokeOnMainThread(async () => await SetupWebView2(pw));
        }
        else
        {
            EmsWebView.HandlerChanged += async (s, e) => 
            {
                if (EmsWebView.Handler?.PlatformView is Microsoft.UI.Xaml.Controls.WebView2 pwEvent)
                {
                    await SetupWebView2(pwEvent);
                }
            };
        }
#else
        EmsWebView.Source = "wwwroot/login.html";
#endif
    }

    private async void OnWebViewNavigated(object? sender, WebNavigatedEventArgs e)
    {
        if (e.Result == WebNavigationResult.Success)
        {
            await InjectDesktopCssOverrideAsync();
        }
    }

    private async Task InjectDesktopCssOverrideAsync()
    {
        try
        {
            // Inject CSS override
            using var cssStream = await FileSystem.OpenAppPackageFileAsync("desktop.css");
            using var cssReader = new StreamReader(cssStream);
            var cssContent = await cssReader.ReadToEndAsync();

            if (!string.IsNullOrWhiteSpace(cssContent))
            {
                var mapLink = cssContent.Replace("\\", "\\\\").Replace("`", "\\`").Replace("$", "\\$");
                var cssScript = $"var style = document.createElement('style'); style.id = 'ems-desktop-overrides'; style.innerHTML = `{mapLink}`; document.head.appendChild(style);";
                await EmsWebView.EvaluateJavaScriptAsync(cssScript);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to inject CSS overrides: {ex.Message}");
        }
    }
}
