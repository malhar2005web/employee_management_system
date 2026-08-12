using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace EMS.Mobile.Native.Bridge;

public class NativeBridgeHost : IDisposable
{
    private readonly WebView _webView;
    private readonly BridgeRouter _router;
    private readonly ILogger<NativeBridgeHost> _logger;
    private bool _disposed = false;

    public NativeBridgeHost(WebView webView, BridgeRouter router, ILogger<NativeBridgeHost> logger)
    {
        _webView = webView;
        _router = router;
        _logger = logger;
        _webView.Navigating += OnWebViewNavigating;
    }

    private async void OnWebViewNavigating(object? sender, WebNavigatingEventArgs e)
    {
        if (e.Url.StartsWith("ems-bridge://"))
        {
            e.Cancel = true;
            await HandleBridgeCallAsync(e.Url);
        }
    }

    private async Task HandleBridgeCallAsync(string url)
    {
        string requestId = "N/A";
        try
        {
            var encodedPayload = url.Substring("ems-bridge://".Length);
            var jsonPayload = Uri.UnescapeDataString(encodedPayload);
            
            using var doc = JsonDocument.Parse(jsonPayload);
            var root = doc.RootElement;
            
            var method = root.GetProperty("method").GetString() ?? string.Empty;
            var callbackId = root.GetProperty("callbackId").GetInt32();
            
            if (root.TryGetProperty("requestId", out var reqIdProp))
            {
                requestId = reqIdProp.GetString() ?? Guid.NewGuid().ToString();
            }
            else
            {
                requestId = Guid.NewGuid().ToString();
            }
            
            JsonElement? args = null;
            if (root.TryGetProperty("args", out var argsProp))
            {
                args = argsProp;
            }

            var response = await Task.Run(() => _router.RouteAsync(requestId, method, args));
            
            var responseJson = JsonSerializer.Serialize(response, new JsonSerializerOptions 
            { 
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase 
            });

            var escapedJson = responseJson.Replace("\\", "\\\\").Replace("'", "\\'").Replace("`", "\\`").Replace("\"", "\\\"");
            var jsCall = $"window.EMS.Native.resolveCallback({callbackId}, {response.Success.ToString().ToLower()}, JSON.parse('{escapedJson}'));";
            
            MainThread.BeginInvokeOnMainThread(async () =>
            {
                if (!_disposed)
                {
                    await _webView.EvaluateJavaScriptAsync(jsCall);
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Bridge] {RequestId} | Failed executing bridge call from URL", requestId);
        }
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _webView.Navigating -= OnWebViewNavigating;
            _disposed = true;
        }
    }
}
