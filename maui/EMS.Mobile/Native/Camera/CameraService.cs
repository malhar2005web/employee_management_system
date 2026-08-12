using EMS.Mobile.Native.Permissions;

namespace EMS.Mobile.Native.Camera;

public class CameraService
{
    public async Task<string?> CapturePhotoAsync(PermissionService permissionService)
    {
        var perm = await permissionService.CheckAndRequestPermissionAsync<Microsoft.Maui.ApplicationModel.Permissions.Camera>();
        if (perm != PermissionState.Granted)
        {
            if (perm == PermissionState.PermanentlyDenied)
            {
                permissionService.OpenAppSettings();
            }
            return null;
        }

        if (MediaPicker.Default.IsCaptureSupported)
        {
            var photo = await MediaPicker.Default.CapturePhotoAsync();
            if (photo != null)
            {
                var localPath = Path.Combine(FileSystem.CacheDirectory, photo.FileName);
                using var sourceStream = await photo.OpenReadAsync();
                using var localStream = File.OpenWrite(localPath);
                await sourceStream.CopyToAsync(localStream);
                return localPath;
            }
        }
        return null;
    }

    public async Task<string?> PickPhotoAsync(PermissionService permissionService)
    {
        var photo = await MediaPicker.Default.PickPhotoAsync();
        if (photo != null)
        {
            var localPath = Path.Combine(FileSystem.CacheDirectory, photo.FileName);
            using var sourceStream = await photo.OpenReadAsync();
            using var localStream = File.OpenWrite(localPath);
            await sourceStream.CopyToAsync(localStream);
            return localPath;
        }
        return null;
    }
}
