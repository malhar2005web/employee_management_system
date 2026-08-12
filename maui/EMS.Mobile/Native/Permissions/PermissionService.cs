namespace EMS.Mobile.Native.Permissions;

public enum PermissionState
{
    Unknown,
    Granted,
    Denied,
    PermanentlyDenied
}

public class PermissionService
{
    public async Task<PermissionState> CheckAndRequestPermissionAsync<TPermission>() 
        where TPermission : Microsoft.Maui.ApplicationModel.Permissions.BasePermission, new()
    {
        var status = await Microsoft.Maui.ApplicationModel.Permissions.CheckStatusAsync<TPermission>();
        
        if (status == PermissionStatus.Granted)
            return PermissionState.Granted;
            
        status = await Microsoft.Maui.ApplicationModel.Permissions.RequestAsync<TPermission>();
        
        if (status == PermissionStatus.Granted)
            return PermissionState.Granted;
            
        if (status == PermissionStatus.Denied)
            return PermissionState.Denied;
            
        return PermissionState.PermanentlyDenied;
    }

    public void OpenAppSettings()
    {
        AppInfo.Current.ShowSettingsUI();
    }
}
