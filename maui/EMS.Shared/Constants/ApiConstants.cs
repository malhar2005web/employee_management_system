namespace EMS.Shared.Constants;

public static class ApiConstants
{
#if DEBUG
    // On Android, localhost points to the emulator loopback, so we use 10.0.2.2
    public static string ApiBaseUrl => 
        DeviceInfo.Platform == DevicePlatform.Android ? "http://10.0.2.2:5008" : "http://localhost:5008";
#else
    public static string ApiBaseUrl => "https://api.company.com";
#endif

    public const string LoginEndpoint = "/api/v1/auth/login";
    public const string RefreshEndpoint = "/api/v1/auth/refresh";
    public const string MeEndpoint = "/api/v1/auth/me";
}
