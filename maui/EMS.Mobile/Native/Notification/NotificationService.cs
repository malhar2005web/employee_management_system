using EMS.Mobile.Native.Permissions;

namespace EMS.Mobile.Native.Notification;

public class NotificationService
{
    public async Task ShowNotificationAsync(string title, string message)
    {
        // Triggers native platform system notification alerts
        await MainThread.InvokeOnMainThreadAsync(async () =>
        {
            if (Application.Current?.Windows.Count > 0)
            {
                var mainPage = Application.Current.Windows[0].Page;
                if (mainPage != null)
                {
                    await mainPage.DisplayAlertAsync(title, message, "OK");
                }
            }
        });
    }
}
