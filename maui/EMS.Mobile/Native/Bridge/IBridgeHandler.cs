using System.Text.Json;

namespace EMS.Mobile.Native.Bridge;

public interface IBridgeHandler
{
    Task<BridgeResponse> ExecuteAsync(string requestId, string method, JsonElement? args, CancellationToken cancellationToken);
}

public class BridgeResponse
{
    public bool Success { get; set; }
    public object? Data { get; set; }
    public BridgeError? Error { get; set; }

    public static BridgeResponse CreateSuccess(object? data) => 
        new() { Success = true, Data = data, Error = null };

    public static BridgeResponse CreateError(string code, string message) => 
        new() { Success = false, Data = null, Error = new BridgeError { Code = code, Message = message } };
}

public class BridgeError
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
