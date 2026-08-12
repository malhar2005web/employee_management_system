using System.Text.Json;
using EMS.Mobile.Native.Notification;

namespace EMS.Mobile.Native.Bridge;

public class NotificationHandler : IBridgeHandler
{
    private readonly NotificationService _notificationService;

    public NotificationHandler(NotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    public async Task<BridgeResponse> ExecuteAsync(string requestId, string method, JsonElement? args, CancellationToken cancellationToken)
    {
        string title = "EMS Notification";
        string message = "";

        if (args.HasValue && args.Value.ValueKind == JsonValueKind.Object)
        {
            if (args.Value.TryGetProperty("title", out var titleProp))
                title = titleProp.GetString() ?? title;

            if (args.Value.TryGetProperty("message", out var msgProp))
                message = msgProp.GetString() ?? message;
        }

        await _notificationService.ShowNotificationAsync(title, message);
        return BridgeResponse.CreateSuccess(null);
    }
}
