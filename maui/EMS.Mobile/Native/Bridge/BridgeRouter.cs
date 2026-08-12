using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace EMS.Mobile.Native.Bridge;

public class BridgeRouter
{
    private readonly Dictionary<string, IBridgeHandler> _handlers = new();
    private readonly ILogger<BridgeRouter> _logger;
    private readonly SemaphoreSlim _cameraLock = new(1, 1);
    private readonly SemaphoreSlim _locationLock = new(1, 1);

    public BridgeRouter(
        CameraHandler cameraHandler,
        LocationHandler locationHandler,
        NotificationHandler notificationHandler,
        ILogger<BridgeRouter> logger)
    {
        _logger = logger;
        _handlers.Add("pickImage", cameraHandler);
        _handlers.Add("capturePhoto", cameraHandler);
        _handlers.Add("location", locationHandler);
        _handlers.Add("notification", notificationHandler);
    }

    public async Task<BridgeResponse> RouteAsync(string requestId, string method, JsonElement? args)
    {
        if (!_handlers.TryGetValue(method, out var handler))
        {
            _logger.LogWarning("[Bridge] {RequestId} | Unknown method: {Method}", requestId, method);
            return BridgeResponse.CreateError("UNKNOWN_METHOD", $"Method '{method}' is not whitelisted.");
        }

        SemaphoreSlim? activeLock = null;
        if (method == "capturePhoto" || method == "pickImage") activeLock = _cameraLock;
        else if (method == "location") activeLock = _locationLock;

        if (activeLock != null && activeLock.CurrentCount == 0)
        {
            _logger.LogWarning("[Bridge] {RequestId} | Blocked duplicate concurrency for {Method}", requestId, method);
            return BridgeResponse.CreateError("CONCURRENCY_LOCKED", $"An operation of type '{method}' is already running.");
        }

        if (activeLock != null) await activeLock.WaitAsync();

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        try
        {
            _logger.LogInformation("[Bridge] {RequestId} | Starting method: {Method}", requestId, method);
            var response = await handler.ExecuteAsync(requestId, method, args, cts.Token);
            _logger.LogInformation("[Bridge] {RequestId} | Completed method: {Method} | Success: {Success}", requestId, method, response.Success);
            return response;
        }
        catch (OperationCanceledException)
        {
            return BridgeResponse.CreateError("TIMEOUT", $"Operation '{method}' timed out.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Bridge] {RequestId} | Exception in handler {Method}", requestId, method);
            return BridgeResponse.CreateError("HANDLER_ERROR", ex.Message);
        }
        finally
        {
            activeLock?.Release();
        }
    }
}
