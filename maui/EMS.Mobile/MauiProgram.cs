using Microsoft.Extensions.Logging;

namespace EMS.Mobile;

public static class MauiProgram
{
	public static MauiApp CreateMauiApp()
	{
		var builder = MauiApp.CreateBuilder();
		builder
			.UseMauiApp<App>()
			.ConfigureFonts(fonts =>
			{
				fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
				fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
			});

		// Register Services
		builder.Services.AddSingleton<Native.Permissions.PermissionService>();
		builder.Services.AddSingleton<Native.Camera.CameraService>();
		builder.Services.AddSingleton<Native.GPS.GPSService>();
		builder.Services.AddSingleton<Native.Notification.NotificationService>();
		builder.Services.AddSingleton<Native.Storage.StorageService>();

		// Register SOLID Bridge Handlers
		builder.Services.AddSingleton<Native.Bridge.CameraHandler>();
		builder.Services.AddSingleton<Native.Bridge.LocationHandler>();
		builder.Services.AddSingleton<Native.Bridge.NotificationHandler>();

		// Register Bridge Router
		builder.Services.AddSingleton<Native.Bridge.BridgeRouter>();

		// Register Pages
		builder.Services.AddSingleton<MainPage>();

#if ANDROID
		Microsoft.Maui.Handlers.WebViewHandler.Mapper.AppendToMapping("AndroidCustomWebView", (handler, view) =>
		{
			handler.PlatformView.Settings.SetGeolocationEnabled(true);
			handler.PlatformView.Settings.JavaScriptEnabled = true;
			handler.PlatformView.Settings.DomStorageEnabled = true;
			handler.PlatformView.Settings.DatabaseEnabled = true;
			handler.PlatformView.Settings.JavaScriptCanOpenWindowsAutomatically = true;
			handler.PlatformView.Settings.MixedContentMode = Android.Webkit.MixedContentHandling.AlwaysAllow;
			if (!string.IsNullOrEmpty(handler.PlatformView.Settings.UserAgentString) && !handler.PlatformView.Settings.UserAgentString.Contains("EMS-Mobile"))
			{
				handler.PlatformView.Settings.UserAgentString += " EMS-Mobile";
			}
			handler.PlatformView.SetWebChromeClient(new AndroidPermissionWebChromeClient());
		});
#endif

#if DEBUG
		builder.Logging.AddDebug();
#endif

		return builder.Build();
	}
}

#if ANDROID
public class AndroidPermissionWebChromeClient : Android.Webkit.WebChromeClient
{
	public override void OnGeolocationPermissionsShowPrompt(string? origin, Android.Webkit.GeolocationPermissions.ICallback? callback)
	{
		callback?.Invoke(origin, true, false);
	}
}
#endif
