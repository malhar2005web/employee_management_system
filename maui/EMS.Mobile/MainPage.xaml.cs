using Microsoft.Maui.Controls;

namespace EMS.Mobile;

public partial class MainPage : ContentPage
{
    private readonly Native.Bridge.NativeBridgeHost _bridgeHost;

    public MainPage(Native.Bridge.BridgeRouter router, Microsoft.Extensions.Logging.ILogger<Native.Bridge.NativeBridgeHost> logger)
    {
        InitializeComponent();
        EmsWebView.Source = "wwwroot/login.html";
        _bridgeHost = new Native.Bridge.NativeBridgeHost(EmsWebView, router, logger);
        Unloaded += (s, e) => _bridgeHost.Dispose();
    }

    private async void OnWebViewNavigated(object? sender, WebNavigatedEventArgs e)
    {
        if (e.Result == WebNavigationResult.Success)
        {
            var linkScript = @"
                if (!document.getElementById('ems-mobile-loaded-marker')) {
                    var link1 = document.createElement('link');
                    link1.rel = 'stylesheet';
                    link1.href = 'css/mobile.css';
                    document.head.appendChild(link1);

                    var link2 = document.createElement('link');
                    link2.rel = 'stylesheet';
                    link2.href = 'css/glass.css';
                    document.head.appendChild(link2);

                    var link3 = document.createElement('link');
                    link3.rel = 'stylesheet';
                    link3.href = 'css/components.css';
                    document.head.appendChild(link3);

                    var marker = document.createElement('div');
                    marker.id = 'ems-mobile-loaded-marker';
                    marker.style.display = 'none';
                    document.body.appendChild(marker);

                    var appScript = document.createElement('script');
                    appScript.src = 'js/app.js';
                    document.head.appendChild(appScript);
                }
            ";
            await EmsWebView.EvaluateJavaScriptAsync(linkScript);
        }
    }

    protected override bool OnBackButtonPressed()
    {
        EmsWebView.EvaluateJavaScriptAsync("if (window.EMS && window.EMS.Layout) { window.EMS.Layout.handleBackButton(); }");
        return true;
    }
}
