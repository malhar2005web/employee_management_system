using System.Text.Json;
using EMS.Mobile.Native.GPS;
using EMS.Mobile.Native.Permissions;

namespace EMS.Mobile.Native.Bridge;

public class LocationHandler : IBridgeHandler
{
    private readonly GPSService _gpsService;
    private readonly PermissionService _permissionService;

    public LocationHandler(GPSService gpsService, PermissionService permissionService)
    {
        _gpsService = gpsService;
        _permissionService = permissionService;
    }

    public async Task<BridgeResponse> ExecuteAsync(string requestId, string method, JsonElement? args, CancellationToken cancellationToken)
    {
        var location = await _gpsService.GetLocationAsync(_permissionService);
        if (location != null)
        {
            return BridgeResponse.CreateSuccess(location);
        }
        return BridgeResponse.CreateError("LOCATION_FAILED", "Failed to retrieve device GPS coordinates.");
    }
}
