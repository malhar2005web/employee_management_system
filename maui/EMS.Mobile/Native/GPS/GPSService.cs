using EMS.Mobile.Native.Permissions;

namespace EMS.Mobile.Native.GPS;

public class GPSService
{
    public async Task<LocationDto?> GetLocationAsync(PermissionService permissionService)
    {
        var perm = await permissionService.CheckAndRequestPermissionAsync<Microsoft.Maui.ApplicationModel.Permissions.LocationWhenInUse>();
        if (perm != PermissionState.Granted)
        {
            if (perm == PermissionState.PermanentlyDenied)
            {
                permissionService.OpenAppSettings();
            }
            return null;
        }

        try
        {
            // 1. Try Last Known Location first to save battery
            var location = await Geolocation.Default.GetLastKnownLocationAsync();
            if (location != null && DateTimeOffset.UtcNow.Subtract(location.Timestamp).TotalMinutes < 5)
            {
                return new LocationDto 
                { 
                    Latitude = location.Latitude, 
                    Longitude = location.Longitude, 
                    Accuracy = location.Accuracy ?? 0 
                };
            }

            // 2. Fallback to live GPS lookup with 15-second timeout
            var request = new GeolocationRequest(GeolocationAccuracy.Medium, TimeSpan.FromSeconds(15));
            location = await Geolocation.Default.GetLocationAsync(request);
            if (location != null)
            {
                return new LocationDto 
                { 
                    Latitude = location.Latitude, 
                    Longitude = location.Longitude, 
                    Accuracy = location.Accuracy ?? 0 
                };
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to get GPS location: {ex.Message}");
        }

        return null;
    }
}

public class LocationDto
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double Accuracy { get; set; }
}
