using System.Text.Json;
using EMS.Mobile.Native.Camera;
using EMS.Mobile.Native.Permissions;

namespace EMS.Mobile.Native.Bridge;

public class CameraHandler : IBridgeHandler
{
    private readonly CameraService _cameraService;
    private readonly PermissionService _permissionService;

    public CameraHandler(CameraService cameraService, PermissionService permissionService)
    {
        _cameraService = cameraService;
        _permissionService = permissionService;
    }

    public async Task<BridgeResponse> ExecuteAsync(string requestId, string method, JsonElement? args, CancellationToken cancellationToken)
    {
        string? imagePath = null;
        
        if (method == "pickImage")
        {
            imagePath = await _cameraService.PickPhotoAsync(_permissionService);
        }
        else if (method == "capturePhoto")
        {
            imagePath = await _cameraService.CapturePhotoAsync(_permissionService);
        }

        if (!string.IsNullOrEmpty(imagePath))
        {
            return BridgeResponse.CreateSuccess(new { filePath = imagePath });
        }

        return BridgeResponse.CreateError("CAMERA_ERROR", "Failed to capture or pick photo.");
    }
}
