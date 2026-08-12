using System.Text.Json;
using EMS.Shared.Models;

namespace EMS.Shared.Storage;

public static class SecureStorageManager
{
    private const string TokenKey = "ems_auth_token";
    private const string UserKey = "ems_auth_user";

    public static async Task SaveTokenAsync(string token)
    {
        await SecureStorage.Default.SetAsync(TokenKey, token);
    }

    public static async Task<string?> GetTokenAsync()
    {
        return await SecureStorage.Default.GetAsync(TokenKey);
    }

    public static async Task SaveUserAsync(UserDto user)
    {
        var userJson = JsonSerializer.Serialize(user);
        await SecureStorage.Default.SetAsync(UserKey, userJson);
    }

    public static async Task<UserDto?> GetUserAsync()
    {
        var userJson = await SecureStorage.Default.GetAsync(UserKey);
        if (string.IsNullOrEmpty(userJson))
            return null;

        try
        {
            return JsonSerializer.Deserialize<UserDto>(userJson);
        }
        catch
        {
            return null;
        }
    }

    public static void ClearAuth()
    {
        SecureStorage.Default.Remove(TokenKey);
        SecureStorage.Default.Remove(UserKey);
    }
}
